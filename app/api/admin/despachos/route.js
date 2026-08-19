import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { logAuditEvent } from "@/lib/audit";
import { belongsToEmpresaId } from "@/lib/firestoreTenant";
import {
  authErrorResponse,
  getRequestEmpresaId,
  requirePermission,
} from "@/lib/serverAuth";

function text(value) {
  return String(value || "").trim();
}

function number(value) {
  return Number(value) || 0;
}

function summarizeItems(items = []) {
  return items.reduce(
    (acc, item) => {
      const cantidad = number(item.cantidad);
      const costoTotal = number(item.costo) * cantidad;
      const ventaTotal = number(item.precioDetal) * cantidad;

      acc.lineas += 1;
      acc.cantidad += cantidad;
      acc.costo += costoTotal;
      acc.venta += ventaTotal;
      acc.ganancia += ventaTotal - costoTotal;
      return acc;
    },
    { lineas: 0, cantidad: 0, costo: 0, venta: 0, ganancia: 0 }
  );
}

function validateRequired(header, items) {
  const errors = [];

  if (!text(header.fecha)) errors.push("Fecha requerida.");
  if (!text(header.diaRuta)) errors.push("Dia de ruta requerido.");
  if (!text(header.ruta)) errors.push("Ruta requerida.");
  if (!text(header.carteristaId)) errors.push("Carterista requerido.");
  if (!text(header.ayudanteId)) errors.push("Ayudante requerido.");
  if (!items.length) errors.push("Agrega productos al despacho.");

  items.forEach((item) => {
    const nombre = text(item.nombre) || "Producto";
    if (!text(item.productoId)) errors.push(`${nombre}: productoId requerido.`);
    if (number(item.cantidad) <= 0) {
      errors.push(`${nombre}: cantidad debe ser mayor a cero.`);
    }
  });

  return errors;
}

async function getEmpleado(db, empleadoId, empresaId, label) {
  const snap = await db.collection("empleados").doc(empleadoId).get();

  if (!snap.exists || !belongsToEmpresaId(snap.data(), empresaId)) {
    return { error: `${label} invalido para esta empresa.` };
  }

  return { empleado: { id: snap.id, ...snap.data() } };
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "despachos.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const header = body.header || {};
    const rawItems = body.items || [];
    const requiredErrors = validateRequired(header, rawItems);

    if (requiredErrors.length > 0) {
      return NextResponse.json(
        { error: "Despacho invalido", detalles: requiredErrors },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const carteristaResult = await getEmpleado(
      db,
      text(header.carteristaId),
      empresaId,
      "Carterista"
    );
    if (carteristaResult.error) {
      return NextResponse.json({ error: carteristaResult.error }, { status: 403 });
    }

    const ayudanteResult = await getEmpleado(
      db,
      text(header.ayudanteId),
      empresaId,
      "Ayudante"
    );
    if (ayudanteResult.error) {
      return NextResponse.json({ error: ayudanteResult.error }, { status: 403 });
    }

    const cleanItems = [];
    const itemErrors = [];

    for (const item of rawItems) {
      const productoId = text(item.productoId);
      const productoSnap = await db.collection("productos").doc(productoId).get();
      const nombreEntrada = text(item.nombre) || productoId || "Producto";

      if (!productoSnap.exists || !belongsToEmpresaId(productoSnap.data(), empresaId)) {
        itemErrors.push(`${nombreEntrada}: producto invalido para esta empresa.`);
        continue;
      }

      const producto = { id: productoSnap.id, ...productoSnap.data() };
      const cantidad = number(item.cantidad);
      const stockActual = number(producto.stock);
      const costo = number(item.costo || producto.costo || producto.precioMayor);
      const precioDetal = number(item.precioDetal || producto.precioDetal);

      if (cantidad > stockActual) {
        itemErrors.push(
          `${producto.nombre || nombreEntrada}: despacho ${cantidad}, stock disponible ${stockActual}.`
        );
      }

      if (costo <= 0) itemErrors.push(`${producto.nombre || nombreEntrada}: costo/base requerido.`);
      if (precioDetal <= 0) {
        itemErrors.push(`${producto.nombre || nombreEntrada}: precio de venta requerido.`);
      }

      cleanItems.push({
        productoId,
        nombre: text(producto.nombre || item.nombre),
        sku: text(producto.sku || item.sku),
        categoria: text(producto.categoria || item.categoria),
        cantidad,
        costo,
        precioDetal,
        stockActual,
        subtotalCosto: cantidad * costo,
        subtotalVenta: cantidad * precioDetal,
      });
    }

    if (itemErrors.length > 0) {
      return NextResponse.json(
        { error: "Despacho invalido", detalles: itemErrors },
        { status: 400 }
      );
    }

    const resumen = summarizeItems(cleanItems);
    const margenEstimado = resumen.venta > 0 ? (resumen.ganancia / resumen.venta) * 100 : 0;
    const despachoRef = db.collection("despachos").doc();
    const batch = db.batch();

    batch.set(despachoRef, {
      empresaId,
      fecha: text(header.fecha),
      diaRuta: text(header.diaRuta),
      ruta: text(header.ruta),
      carteristaId: text(header.carteristaId),
      carteristaNombre: text(carteristaResult.empleado.nombre),
      ayudanteId: text(header.ayudanteId),
      ayudanteNombre: text(ayudanteResult.empleado.nombre),
      observaciones: text(header.observaciones),
      items: cleanItems,
      totalLineas: resumen.lineas,
      totalCantidad: resumen.cantidad,
      totalCosto: resumen.costo,
      totalVentaEstimada: resumen.venta,
      gananciaEstimada: resumen.ganancia,
      margenEstimado,
      auditoriaEstado: "listo",
      auditoriaAlertas: [],
      estado: "despachado",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    cleanItems.forEach((item) => {
      batch.update(db.collection("productos").doc(item.productoId), {
        stock: FieldValue.increment(-item.cantidad),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        updatedByEmail: actor.email,
      });

      batch.set(db.collection("kardex").doc(), {
        empresaId,
        productoId: item.productoId,
        productoNombre: item.nombre,
        tipo: "salida_despacho",
        cantidad: -item.cantidad,
        costo: item.costo,
        subtotal: item.subtotalCosto,
        referenciaId: despachoRef.id,
        ruta: text(header.ruta),
        diaRuta: text(header.diaRuta),
        fecha: text(header.fecha),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
      });
    });

    await batch.commit();

    await logAuditEvent({
      empresaId,
      actor,
      action: "despacho.create",
      resource: "despachos",
      resourceId: despachoRef.id,
      after: {
        ruta: text(header.ruta),
        carteristaNombre: text(carteristaResult.empleado.nombre),
        totalCantidad: resumen.cantidad,
        totalCosto: resumen.costo,
        totalVentaEstimada: resumen.venta,
      },
    });

    return NextResponse.json({ id: despachoRef.id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

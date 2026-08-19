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

function addDays(dateString, days) {
  const date = new Date(`${dateString || new Date().toISOString().slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + (Number(days) || 0));
  return date.toISOString().slice(0, 10);
}

function summarizeItems(items = []) {
  return items.reduce(
    (acc, item) => {
      const cantidad = number(item.cantidad);
      const costo = number(item.costoUnitario);
      acc.lineas += 1;
      acc.cantidad += cantidad;
      acc.total += cantidad * costo;
      return acc;
    },
    { lineas: 0, cantidad: 0, total: 0 }
  );
}

function getRevisionState(totalFacturaProveedor, totalCalculado) {
  const totalFactura = number(totalFacturaProveedor);
  const diferenciaFactura = totalFactura ? totalFactura - totalCalculado : 0;
  const diferenciaAbsoluta = Math.abs(diferenciaFactura);
  const tolerancia = 100;
  const estadoRevision =
    !totalFactura || diferenciaAbsoluta === 0
      ? "cuadrada"
      : diferenciaAbsoluta <= tolerancia
        ? "diferencia_menor"
        : "diferencia_fuerte";

  return {
    totalFactura,
    diferenciaFactura,
    estadoRevision,
  };
}

function validateItems(items = []) {
  const alertas = [];

  items.forEach((item) => {
    const cantidad = number(item.cantidad);
    const costo = number(item.costoUnitario);
    const minimo = number(item.precioMinimo);
    const detal = number(item.precioDetal);
    const maximo = number(item.precioMaximo);
    const nombre = item.nombre || "Producto";

    if (!text(item.productoId)) alertas.push(`${nombre}: productoId requerido.`);
    if (cantidad <= 0) alertas.push(`${nombre}: cantidad debe ser mayor a cero.`);
    if (costo <= 0) alertas.push(`${nombre}: costo unitario debe ser mayor a cero.`);
    if (minimo <= 0) alertas.push(`${nombre}: precio minimo debe ser mayor a cero.`);
    if (detal <= 0) alertas.push(`${nombre}: precio detal debe ser mayor a cero.`);
    if (maximo <= 0) alertas.push(`${nombre}: precio maximo debe ser mayor a cero.`);
    if (minimo > detal) {
      alertas.push(`${nombre}: precio minimo no puede ser mayor que precio detal.`);
    }
    if (detal > maximo) {
      alertas.push(`${nombre}: precio detal no puede ser mayor que precio maximo.`);
    }
    if (costo > maximo) {
      alertas.push(`${nombre}: costo supera el precio maximo de venta.`);
    }
  });

  return alertas;
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "compras.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const header = body.header || {};
    const rawItems = body.items || [];

    if (!text(header.proveedor)) {
      return NextResponse.json({ error: "Proveedor requerido" }, { status: 400 });
    }

    if (!rawItems.length) {
      return NextResponse.json({ error: "Agrega productos a la compra" }, { status: 400 });
    }

    const itemErrors = validateItems(rawItems);
    if (itemErrors.length > 0) {
      return NextResponse.json({ error: "Compra invalida", detalles: itemErrors }, { status: 400 });
    }

    const db = getAdminDb();
    const proveedorId = text(header.proveedorId);
    let proveedor = null;

    if (proveedorId) {
      const proveedorSnap = await db.collection("proveedores").doc(proveedorId).get();
      if (proveedorSnap.exists) {
        proveedor = { id: proveedorSnap.id, ...proveedorSnap.data() };
        if (!belongsToEmpresaId(proveedor, empresaId)) {
          return NextResponse.json({ error: "Proveedor de otra empresa" }, { status: 403 });
        }
      }
    }

    const cleanItems = [];
    for (const item of rawItems) {
      const productoId = text(item.productoId);
      const productoSnap = await db.collection("productos").doc(productoId).get();

      if (!productoSnap.exists || !belongsToEmpresaId(productoSnap.data(), empresaId)) {
        return NextResponse.json(
          { error: `Producto invalido para esta empresa: ${item.nombre || productoId}` },
          { status: 403 }
        );
      }

      const cantidad = number(item.cantidad);
      const costoUnitario = number(item.costoUnitario);
      cleanItems.push({
        productoId,
        nombre: text(item.nombre),
        sku: text(item.sku),
        categoria: text(item.categoria),
        cantidad,
        costoUnitario,
        precioMinimo: number(item.precioMinimo),
        precioDetal: number(item.precioDetal),
        precioMaximo: number(item.precioMaximo),
        stockActual: number(item.stockActual),
        subtotal: cantidad * costoUnitario,
      });
    }

    const resumen = summarizeItems(cleanItems);
    const revision = getRevisionState(header.totalFacturaProveedor, resumen.total);
    const compraRef = db.collection("compras").doc();
    const batch = db.batch();

    batch.set(compraRef, {
      empresaId,
      fecha: text(header.fecha) || new Date().toISOString().slice(0, 10),
      proveedorId,
      proveedor: text(header.proveedor),
      facturaProveedor: text(header.facturaProveedor),
      totalFacturaProveedor: revision.totalFactura,
      diferenciaFactura: revision.diferenciaFactura,
      estadoRevisionFactura: revision.estadoRevision,
      alertaFactura: revision.estadoRevision !== "cuadrada",
      metodoPago: text(header.metodoPago || "contado"),
      observaciones: text(header.observaciones),
      items: cleanItems,
      totalLineas: resumen.lineas,
      totalCantidad: resumen.cantidad,
      totalCompra: resumen.total,
      estado: "registrada",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    if (text(header.metodoPago) === "credito" && resumen.total > 0) {
      const cuentaRef = db.collection("cuentasPagar").doc();
      const diasCredito = number(proveedor?.diasCredito);

      batch.set(cuentaRef, {
        empresaId,
        compraId: compraRef.id,
        proveedorId,
        proveedor: text(header.proveedor),
        facturaProveedor: text(header.facturaProveedor),
        fechaCompra: text(header.fecha),
        fechaVencimiento: addDays(header.fecha, diasCredito),
        total: resumen.total,
        totalFacturaProveedor: revision.totalFactura,
        diferenciaFactura: revision.diferenciaFactura,
        estadoRevisionFactura: revision.estadoRevision,
        abonado: 0,
        saldoPendiente: resumen.total,
        metodoPago: text(header.metodoPago),
        estado: "pendiente",
        pagos: [],
        observaciones: text(header.observaciones),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        updatedByEmail: actor.email,
      });
    }

    cleanItems.forEach((item) => {
      batch.update(db.collection("productos").doc(item.productoId), {
        stock: FieldValue.increment(item.cantidad),
        costo: item.costoUnitario,
        precioMayor: item.precioMinimo,
        precioMinimo: item.precioMinimo,
        precioDetal: item.precioDetal,
        precioMaximo: item.precioMaximo,
        precioPacaMayor: item.precioMaximo,
        precioPacaDetal: item.precioMaximo,
        proveedorId,
        proveedor: text(header.proveedor),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        updatedByEmail: actor.email,
      });

      batch.set(db.collection("kardex").doc(), {
        empresaId,
        productoId: item.productoId,
        productoNombre: item.nombre,
        tipo: "entrada_compra",
        cantidad: item.cantidad,
        costo: item.costoUnitario,
        subtotal: item.subtotal,
        referenciaId: compraRef.id,
        proveedor: text(header.proveedor),
        facturaProveedor: text(header.facturaProveedor),
        estadoRevisionFactura: revision.estadoRevision,
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
      action: "compra.create",
      resource: "compras",
      resourceId: compraRef.id,
      after: {
        proveedor: text(header.proveedor),
        totalCompra: resumen.total,
        totalCantidad: resumen.cantidad,
        estadoRevisionFactura: revision.estadoRevision,
      },
    });

    return NextResponse.json({ id: compraRef.id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

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

const AJUSTES_PERMITIDOS = new Set([
  "ajuste_manual_entrada",
  "ajuste_manual_salida",
]);

function text(value) {
  return String(value || "").trim();
}

function number(value) {
  return Number(value) || 0;
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "inventario.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const productoId = text(body.productoId);
    const tipo = text(body.tipo || "ajuste_manual_entrada");
    const cantidad = number(body.cantidad);
    const motivo = text(body.motivo);

    if (!productoId) {
      return NextResponse.json({ error: "Producto requerido" }, { status: 400 });
    }

    if (!AJUSTES_PERMITIDOS.has(tipo)) {
      return NextResponse.json({ error: "Tipo de ajuste invalido" }, { status: 400 });
    }

    if (cantidad <= 0) {
      return NextResponse.json(
        { error: "La cantidad del ajuste debe ser mayor a cero" },
        { status: 400 }
      );
    }

    if (!motivo) {
      return NextResponse.json({ error: "Motivo del ajuste requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const productoRef = db.collection("productos").doc(productoId);
    const productoSnap = await productoRef.get();

    if (!productoSnap.exists || !belongsToEmpresaId(productoSnap.data(), empresaId)) {
      return NextResponse.json({ error: "Producto de otra empresa o inexistente" }, { status: 403 });
    }

    const producto = { id: productoSnap.id, ...productoSnap.data() };
    const stockActual = number(producto.stock);
    const isSalida = tipo === "ajuste_manual_salida";
    const delta = isSalida ? cantidad * -1 : cantidad;

    if (isSalida && cantidad > stockActual) {
      return NextResponse.json(
        {
          error: "No puedes sacar mas unidades que el stock actual.",
          detalles: [`${producto.nombre || productoId}: stock ${stockActual}, salida ${cantidad}`],
        },
        { status: 400 }
      );
    }

    const costo = number(producto.costo || producto.precioMayor);
    const ajusteRef = db.collection("kardex").doc();
    const fecha = new Date().toISOString().slice(0, 10);
    const batch = db.batch();

    batch.update(productoRef, {
      stock: FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    batch.set(ajusteRef, {
      empresaId,
      productoId,
      productoNombre: producto.nombre || "Producto",
      sku: producto.sku || "",
      tipo,
      cantidad: delta,
      costo,
      subtotal: Math.abs(delta) * costo,
      stockAntes: stockActual,
      stockDespues: stockActual + delta,
      referenciaId: ajusteRef.id,
      observacion: motivo,
      afectaStock: true,
      fecha,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
    });

    await batch.commit();

    await logAuditEvent({
      empresaId,
      actor,
      action: "inventario.ajuste.create",
      resource: "kardex",
      resourceId: ajusteRef.id,
      before: {
        productoId,
        stock: stockActual,
      },
      after: {
        productoId,
        tipo,
        cantidad: delta,
        stock: stockActual + delta,
        motivo,
      },
    });

    return NextResponse.json({
      id: ajusteRef.id,
      stockAntes: stockActual,
      stockDespues: stockActual + delta,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

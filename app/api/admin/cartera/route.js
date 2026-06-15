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
import { getDebtColor } from "@/lib/operacion";

function number(value) {
  return Number(value) || 0;
}

function text(value) {
  return String(value || "").trim();
}

async function getClienteOrThrow(db, clienteId, empresaId) {
  const clienteRef = db.collection("clientes").doc(clienteId);
  const snap = await clienteRef.get();

  if (!snap.exists) {
    const error = new Error("Cliente no existe");
    error.status = 404;
    throw error;
  }

  const cliente = snap.data();
  if (!belongsToEmpresaId(cliente, empresaId)) {
    const error = new Error("Cliente de otra empresa");
    error.status = 403;
    throw error;
  }

  return { clienteRef, cliente };
}

async function guardarMovimiento({ db, actor, empresaId, body }) {
  const clienteId = text(body.clienteId);
  if (!clienteId) {
    return NextResponse.json({ error: "Cliente requerido" }, { status: 400 });
  }

  const { clienteRef, cliente } = await getClienteOrThrow(db, clienteId, empresaId);
  const abono = number(body.abono);
  const ajusteManual = body.ajusteDeuda !== "" && body.ajusteDeuda !== null;
  const ajusteDeuda = ajusteManual ? number(body.ajusteDeuda) : null;
  const deudaAnterior = number(cliente.deudaActual);
  const nuevaDeuda =
    ajusteDeuda !== null ? Math.max(ajusteDeuda, 0) : Math.max(deudaAnterior - abono, 0);
  const diasDeuda = nuevaDeuda > 0 ? number(body.diasDeuda || cliente.diasDeuda) : 0;
  const nota = text(body.nota);

  if (abono <= 0 && ajusteDeuda === null && !nota) {
    return NextResponse.json(
      { error: "Registra un abono, ajuste o nota para guardar." },
      { status: 400 }
    );
  }

  if (abono > deudaAnterior && !ajusteManual) {
    return NextResponse.json(
      { error: "El abono no puede superar la deuda actual sin ajuste manual." },
      { status: 400 }
    );
  }

  const movimiento = {
    empresaId,
    clienteId,
    clienteNombre: cliente.nombre || "",
    telefono: cliente.telefono || "",
    diaRuta: cliente.diaRuta || "",
    ruta: cliente.ruta || "",
    abono,
    deudaAnterior,
    nuevaDeuda,
    diasDeuda,
    nota,
    tipo: abono > 0 ? "abono" : ajusteManual ? "ajuste" : "nota",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
  };

  const batch = db.batch();
  batch.update(clienteRef, {
    deudaActual: nuevaDeuda,
    diasDeuda,
    semaforoDeuda: getDebtColor(diasDeuda),
    ultimaNotaCartera: nota,
    ultimoAbono: abono,
    ultimoMovimientoCartera: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
  });
  const movimientoRef = db.collection("movimientosCartera").doc();
  batch.set(movimientoRef, movimiento);
  await batch.commit();

  await logAuditEvent({
    empresaId,
    actor,
    action: "cartera.movimiento",
    resource: "clientes",
    resourceId: clienteId,
    before: cliente,
    after: {
      deudaActual: nuevaDeuda,
      diasDeuda,
      semaforoDeuda: getDebtColor(diasDeuda),
      movimientoId: movimientoRef.id,
    },
    metadata: { tipo: movimiento.tipo, abono },
  });

  return NextResponse.json({ clienteId, movimientoId: movimientoRef.id, nuevaDeuda });
}

async function cambiarEstado({ db, actor, empresaId, body }) {
  const clienteId = text(body.clienteId);
  const estadoCliente = text(body.estadoCliente || "activo");
  const estadosPermitidos = ["activo", "riesgo_perdida", "perdido"];

  if (!clienteId || !estadosPermitidos.includes(estadoCliente)) {
    return NextResponse.json({ error: "Estado o cliente invalido" }, { status: 400 });
  }

  const { clienteRef, cliente } = await getClienteOrThrow(db, clienteId, empresaId);
  const riesgoPerdida = estadoCliente === "riesgo_perdida";
  const perdido = estadoCliente === "perdido";
  const recuperado = estadoCliente === "activo";
  const labels = {
    activo: "Cliente recuperado",
    riesgo_perdida: "Cliente marcado en riesgo de perdida",
    perdido: "Cliente marcado como perdido",
  };

  const updatePayload = {
    estadoCliente,
    riesgoPerdida,
    perdido,
    riesgoPerdidaFecha: riesgoPerdida ? FieldValue.serverTimestamp() : null,
    perdidoFecha: perdido ? FieldValue.serverTimestamp() : null,
    recuperadoFecha: recuperado ? FieldValue.serverTimestamp() : null,
    fechaEstadoCliente: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
  };

  const movimiento = {
    empresaId,
    clienteId,
    clienteNombre: cliente.nombre || "",
    telefono: cliente.telefono || "",
    diaRuta: cliente.diaRuta || "",
    ruta: cliente.ruta || "",
    deudaAnterior: number(cliente.deudaActual),
    nuevaDeuda: number(cliente.deudaActual),
    diasDeuda: number(cliente.diasDeuda),
    nota: labels[estadoCliente],
    tipo: recuperado ? "cliente_recuperado" : perdido ? "cliente_perdido" : "riesgo_perdida",
    estadoCliente,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
  };

  const batch = db.batch();
  batch.update(clienteRef, updatePayload);
  const movimientoRef = db.collection("movimientosCartera").doc();
  batch.set(movimientoRef, movimiento);
  await batch.commit();

  await logAuditEvent({
    empresaId,
    actor,
    action: "cartera.estado",
    resource: "clientes",
    resourceId: clienteId,
    before: cliente,
    after: { estadoCliente, riesgoPerdida, perdido, movimientoId: movimientoRef.id },
  });

  return NextResponse.json({ clienteId, movimientoId: movimientoRef.id, estadoCliente });
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "cartera.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const action = text(body.action);
    const db = getAdminDb();

    if (action === "movimiento") {
      return guardarMovimiento({ db, actor, empresaId, body });
    }

    if (action === "estado") {
      return cambiarEstado({ db, actor, empresaId, body });
    }

    return NextResponse.json({ error: "Accion de cartera no soportada" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

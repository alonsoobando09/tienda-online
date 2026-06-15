import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { logAuditEvent } from "@/lib/audit";
import { belongsToEmpresaId } from "@/lib/firestoreTenant";
import { getDebtColor } from "@/lib/operacion";
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

function buildClientePayload(input, empresaId) {
  const diasDeuda = number(input.diasDeuda);

  return {
    nombre: text(input.nombre),
    telefono: text(input.telefono),
    direccion: text(input.direccion),
    local: text(input.local),
    diaRuta: text(input.diaRuta || "martes"),
    ruta: text(input.ruta || "Ruta 1"),
    deudaActual: number(input.deudaActual),
    diasDeuda,
    semaforoDeuda: getDebtColor(diasDeuda),
    observaciones: text(input.observaciones),
    solicitudBorrado: Boolean(input.solicitudBorrado),
    empresaId,
  };
}

async function getCliente(db, id, empresaId) {
  const ref = db.collection("clientes").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    const error = new Error("Cliente no existe");
    error.status = 404;
    throw error;
  }

  const data = snap.data();
  if (!belongsToEmpresaId(data, empresaId)) {
    const error = new Error("Cliente de otra empresa");
    error.status = 403;
    throw error;
  }

  return { ref, data };
}

async function getRouteClients(db, empresaId, diaRuta, ruta, excludeId = "") {
  const snapshot = await db
    .collection("clientes")
    .where("empresaId", "==", empresaId)
    .where("diaRuta", "==", diaRuta)
    .where("ruta", "==", ruta)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((cliente) => cliente.id !== excludeId)
    .sort((a, b) => {
      const order = number(a.ordenVisita || 999999) - number(b.ordenVisita || 999999);
      if (order !== 0) return order;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });
}

async function applyRouteOrder(db, empresaId, clienteId, payload, desiredOrder) {
  const routeClients = await getRouteClients(
    db,
    empresaId,
    payload.diaRuta,
    payload.ruta,
    clienteId
  );
  const maxOrder = routeClients.length + 1;
  const order = Math.min(Math.max(number(desiredOrder) || maxOrder, 1), maxOrder);
  const ordered = [
    ...routeClients.slice(0, order - 1),
    { id: clienteId, ...payload },
    ...routeClients.slice(order - 1),
  ];
  const batch = db.batch();

  ordered.forEach((cliente, index) => {
    const ref = db.collection("clientes").doc(cliente.id);
    const ordenVisita = index + 1;

    if (cliente.id === clienteId) {
      batch.set(
        ref,
        {
          ...payload,
          ordenVisita,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      batch.update(ref, {
        ordenVisita,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  await batch.commit();
  return order;
}

async function compactRoute(db, empresaId, diaRuta, ruta) {
  const items = await getRouteClients(db, empresaId, diaRuta, ruta);
  const batch = db.batch();

  items.forEach((cliente, index) => {
    batch.update(db.collection("clientes").doc(cliente.id), {
      ordenVisita: index + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  if (items.length > 0) await batch.commit();
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "clientes.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const payload = buildClientePayload(body, empresaId);

    if (!payload.nombre) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const db = getAdminDb();
    const clienteRef = db.collection("clientes").doc();
    const sameRoute = await getRouteClients(db, empresaId, payload.diaRuta, payload.ruta);
    const selected = sameRoute.find((cliente) => cliente.id === text(body.insertarDespuesDe));
    const manualOrder = number(body.ordenVisita);
    const desiredOrder = manualOrder || (selected ? number(selected.ordenVisita) + 1 : 0);
    const ordenVisita = await applyRouteOrder(db, empresaId, clienteRef.id, payload, desiredOrder);

    await clienteRef.set(
      {
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
        updatedBy: actor.uid,
        updatedByEmail: actor.email,
      },
      { merge: true }
    );

    await logAuditEvent({
      empresaId,
      actor,
      action: "cliente.create",
      resource: "clientes",
      resourceId: clienteRef.id,
      after: { ...payload, ordenVisita },
    });

    return NextResponse.json({ id: clienteRef.id, ordenVisita });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request) {
  try {
    const actor = await requirePermission(request, "clientes.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const id = text(body.id);

    if (!id) {
      return NextResponse.json({ error: "ID de cliente requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const { data: before } = await getCliente(db, id, empresaId);
    const payload = buildClientePayload(body, empresaId);

    await applyRouteOrder(db, empresaId, id, payload, body.ordenVisita);

    if (before.diaRuta !== payload.diaRuta || before.ruta !== payload.ruta) {
      await compactRoute(db, empresaId, before.diaRuta || "martes", before.ruta || "Ruta 1");
    }

    await db.collection("clientes").doc(id).set(
      {
        updatedBy: actor.uid,
        updatedByEmail: actor.email,
      },
      { merge: true }
    );

    await logAuditEvent({
      empresaId,
      actor,
      action: "cliente.update",
      resource: "clientes",
      resourceId: id,
      before,
      after: payload,
    });

    return NextResponse.json({ id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const actor = await requirePermission(request, "clientes.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const action = text(body.action);
    const id = text(body.id);

    if (!id) {
      return NextResponse.json({ error: "ID de cliente requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const { ref, data: before } = await getCliente(db, id, empresaId);
    const update = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    };
    let auditAction = "";
    let auditAfter = { action };

    if (action === "aprobar_orden") {
      Object.assign(update, {
        pendienteRevisionOrden: false,
        revisionOrdenAprobada: true,
        revisionOrdenFecha: FieldValue.serverTimestamp(),
      });
      auditAction = "cliente.aprobar_orden";
      auditAfter = {
        action,
        pendienteRevisionOrden: false,
        revisionOrdenAprobada: true,
      };
    } else if (action === "quitar_solicitud_borrado") {
      Object.assign(update, {
        solicitudBorrado: false,
        solicitudBorradoRevisada: true,
        solicitudBorradoRevisadaFecha: FieldValue.serverTimestamp(),
      });
      auditAction = "cliente.quitar_solicitud_borrado";
      auditAfter = {
        action,
        solicitudBorrado: false,
        solicitudBorradoRevisada: true,
      };
    } else if (action === "estado") {
      const estadoCliente = text(body.estadoCliente || "activo");
      const riesgoPerdida = estadoCliente === "riesgo_perdida";
      const perdido = estadoCliente === "perdido";
      const recuperado = estadoCliente === "activo";
      const labels = {
        activo: "Cliente recuperado",
        riesgo_perdida: "Cliente marcado en riesgo de perdida",
        perdido: "Cliente pasado a archivo perdido",
      };

      if (!["activo", "riesgo_perdida", "perdido"].includes(estadoCliente)) {
        return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
      }

      Object.assign(update, {
        estadoCliente,
        perdido,
        riesgoPerdida,
        fechaEstadoCliente: FieldValue.serverTimestamp(),
        fechaPerdido: perdido ? FieldValue.serverTimestamp() : before.fechaPerdido || null,
        fechaRiesgoPerdida: riesgoPerdida
          ? FieldValue.serverTimestamp()
          : before.fechaRiesgoPerdida || null,
        fechaRecuperado: recuperado ? FieldValue.serverTimestamp() : before.fechaRecuperado || null,
        solicitudBorrado: recuperado ? false : Boolean(before.solicitudBorrado),
      });

      const movimientoRef = db.collection("movimientosCartera").doc();
      await movimientoRef.set({
        empresaId,
        clienteId: id,
        clienteNombre: before.nombre || "",
        telefono: before.telefono || "",
        diaRuta: before.diaRuta || "",
        ruta: before.ruta || "",
        deudaAnterior: number(before.deudaActual),
        nuevaDeuda: number(before.deudaActual),
        diasDeuda: number(before.diasDeuda),
        tipo: recuperado
          ? "cliente_recuperado"
          : perdido
            ? "cliente_perdido"
            : "riesgo_perdida",
        nota: labels[estadoCliente],
        estadoCliente,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
      });
      auditAction = "cliente.estado";
      auditAfter = {
        action,
        estadoCliente,
        perdido,
        riesgoPerdida,
        solicitudBorrado: recuperado ? false : Boolean(before.solicitudBorrado),
      };
    } else {
      return NextResponse.json({ error: "Accion no soportada" }, { status: 400 });
    }

    await ref.update(update);

    await logAuditEvent({
      empresaId,
      actor,
      action: auditAction,
      resource: "clientes",
      resourceId: id,
      before,
      after: auditAfter,
    });

    return NextResponse.json({ id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const actor = await requirePermission(request, "clientes.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const { id } = await request.json();
    const clienteId = text(id);

    if (!clienteId) {
      return NextResponse.json({ error: "ID de cliente requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const { ref, data: before } = await getCliente(db, clienteId, empresaId);
    await ref.delete();
    await compactRoute(db, empresaId, before.diaRuta || "martes", before.ruta || "Ruta 1");

    await logAuditEvent({
      empresaId,
      actor,
      action: "cliente.delete",
      resource: "clientes",
      resourceId: clienteId,
      before,
    });

    return NextResponse.json({ id: clienteId });
  } catch (error) {
    return authErrorResponse(error);
  }
}

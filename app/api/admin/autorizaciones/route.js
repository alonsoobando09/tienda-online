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

async function getAutorizacion(db, id, empresaId) {
  const ref = db.collection("autorizacionesRuta").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    const error = new Error("Autorizacion no existe");
    error.status = 404;
    throw error;
  }

  const data = snap.data() || {};
  if (!belongsToEmpresaId(data, empresaId)) {
    const error = new Error("Autorizacion de otra empresa");
    error.status = 403;
    throw error;
  }

  return { ref, data };
}

async function replaceActiveAuthorizations(batch, db, empresaId, uid, fecha, excludeId = "") {
  const snap = await db
    .collection("autorizacionesRuta")
    .where("empresaId", "==", empresaId)
    .where("uid", "==", uid)
    .where("fecha", "==", fecha)
    .where("estado", "==", "activa")
    .get();

  snap.docs.forEach((docu) => {
    if (docu.id === excludeId) return;
    batch.update(docu.ref, {
      estado: "reemplazada",
      reemplazadaPor: excludeId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "autorizaciones.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const empleadoId = text(body.empleadoId);

    if (!empleadoId) {
      return NextResponse.json({ error: "Empleado requerido" }, { status: 400 });
    }

    const motivo = text(body.motivo);
    if (!motivo) {
      return NextResponse.json({ error: "Motivo requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const empleadoSnap = await db.collection("empleados").doc(empleadoId).get();

    if (!empleadoSnap.exists) {
      return NextResponse.json({ error: "Empleado no existe" }, { status: 404 });
    }

    const empleado = empleadoSnap.data() || {};
    if (!belongsToEmpresaId(empleado, empresaId)) {
      return NextResponse.json({ error: "Empleado de otra empresa" }, { status: 403 });
    }

    if (!empleado.uid) {
      return NextResponse.json(
        { error: "El empleado no tiene UID de Firebase" },
        { status: 400 }
      );
    }

    const ref = db.collection("autorizacionesRuta").doc();
    const batch = db.batch();
    const payload = {
      empresaId,
      empleadoId,
      uid: empleado.uid,
      empleadoNombre: empleado.nombre || "",
      empleadoRol: empleado.rol || empleado.role || "",
      fecha: text(body.fecha) || new Date().toISOString().slice(0, 10),
      diaRuta: text(body.diaRuta || empleado.diaRuta || "martes"),
      ruta: text(body.ruta || empleado.ruta || "Ruta 1"),
      motivo,
      estado: text(body.estado || "activa"),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    };

    if (!["activa", "pausada"].includes(payload.estado)) {
      return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
    }

    if (payload.estado === "activa") {
      await replaceActiveAuthorizations(batch, db, empresaId, empleado.uid, payload.fecha, ref.id);
    }

    batch.set(ref, payload);
    await batch.commit();

    await logAuditEvent({
      empresaId,
      actor,
      action: "autorizacion.create",
      resource: "autorizacionesRuta",
      resourceId: ref.id,
      after: payload,
    });

    return NextResponse.json({ id: ref.id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const actor = await requirePermission(request, "autorizaciones.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const id = text(body.id);
    const estado = text(body.estado);

    if (!id || !["activa", "pausada", "reemplazada"].includes(estado)) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    const db = getAdminDb();
    const { ref, data: before } = await getAutorizacion(db, id, empresaId);
    const batch = db.batch();

    if (estado === "activa") {
      await replaceActiveAuthorizations(batch, db, empresaId, before.uid, before.fecha, id);
    }

    batch.update(ref, {
      estado,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });
    await batch.commit();

    await logAuditEvent({
      empresaId,
      actor,
      action: "autorizacion.estado",
      resource: "autorizacionesRuta",
      resourceId: id,
      before,
      after: { estado },
    });

    return NextResponse.json({ id, estado });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const actor = await requirePermission(request, "autorizaciones.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const { id } = await request.json();
    const autorizacionId = text(id);

    if (!autorizacionId) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const { ref, data: before } = await getAutorizacion(db, autorizacionId, empresaId);
    await ref.delete();

    await logAuditEvent({
      empresaId,
      actor,
      action: "autorizacion.delete",
      resource: "autorizacionesRuta",
      resourceId: autorizacionId,
      before,
    });

    return NextResponse.json({ id: autorizacionId });
  } catch (error) {
    return authErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { logAuditEvent } from "@/lib/audit";
import { belongsToEmpresaId } from "@/lib/firestoreTenant";
import { ROLES } from "@/lib/permissions";
import {
  authErrorResponse,
  getRequestEmpresaId,
  requirePermission,
} from "@/lib/serverAuth";

function cleanText(value) {
  return String(value || "").trim();
}

function cleanEmail(value) {
  return cleanText(value).toLowerCase();
}

function buildEmpleadoPayload(input, empresaId) {
  return {
    nombre: cleanText(input.nombre),
    cargo: cleanText(input.cargo),
    rol: cleanText(input.rol || ROLES.CARTERISTA),
    uid: cleanText(input.uid),
    telefono: cleanText(input.telefono),
    email: cleanEmail(input.email),
    documento: cleanText(input.documento),
    pagoDiario: Number(input.pagoDiario) || 0,
    diaRuta: cleanText(input.diaRuta || "martes"),
    ruta: cleanText(input.ruta || "Ruta 1"),
    estado: cleanText(input.estado || "activo"),
    empresaId,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildUsuarioPayload(empleadoId, payload) {
  return {
    uid: payload.uid,
    empleadoId,
    nombre: payload.nombre,
    email: payload.email,
    rol: payload.rol,
    cargo: payload.cargo,
    telefono: payload.telefono,
    diaRuta: payload.diaRuta,
    ruta: payload.ruta,
    estado: payload.estado,
    empresaId: payload.empresaId,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function assertCanAssignRole(actor, role) {
  if (role === ROLES.SUPERADMIN && actor.role !== ROLES.SUPERADMIN) {
    const error = new Error("Solo superadmin puede asignar rol superadmin");
    error.status = 403;
    throw error;
  }
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "empleados.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const payload = buildEmpleadoPayload(body, empresaId);

    assertCanAssignRole(actor, payload.rol);

    if (!payload.nombre) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const db = getAdminDb();
    const empleadoRef = await db.collection("empleados").add({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    if (payload.uid) {
      await db
        .collection("usuarios")
        .doc(payload.uid)
        .set(buildUsuarioPayload(empleadoRef.id, payload), { merge: true });
    }

    await logAuditEvent({
      empresaId,
      actor,
      action: "empleado.create",
      resource: "empleados",
      resourceId: empleadoRef.id,
      after: { ...payload, id: empleadoRef.id },
    });

    return NextResponse.json({ id: empleadoRef.id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request) {
  try {
    const actor = await requirePermission(request, "empleados.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const id = cleanText(body.id);

    if (!id) {
      return NextResponse.json({ error: "ID de empleado requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const empleadoRef = db.collection("empleados").doc(id);
    const beforeSnap = await empleadoRef.get();

    if (!beforeSnap.exists) {
      return NextResponse.json({ error: "Empleado no existe" }, { status: 404 });
    }

    const before = beforeSnap.data();
    if (!belongsToEmpresaId(before, empresaId)) {
      return NextResponse.json({ error: "Empleado de otra empresa" }, { status: 403 });
    }

    const payload = buildEmpleadoPayload(body, empresaId);
    assertCanAssignRole(actor, payload.rol);

    await empleadoRef.update({
      ...payload,
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    if (before.uid && before.uid !== payload.uid) {
      await db.collection("usuarios").doc(before.uid).delete();
    }

    if (payload.uid) {
      await db
        .collection("usuarios")
        .doc(payload.uid)
        .set(buildUsuarioPayload(id, payload), { merge: true });
    }

    await logAuditEvent({
      empresaId,
      actor,
      action: "empleado.update",
      resource: "empleados",
      resourceId: id,
      before,
      after: payload,
    });

    return NextResponse.json({ id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const actor = await requirePermission(request, "empleados.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const { id } = await request.json();
    const empleadoId = cleanText(id);

    if (!empleadoId) {
      return NextResponse.json({ error: "ID de empleado requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const empleadoRef = db.collection("empleados").doc(empleadoId);
    const beforeSnap = await empleadoRef.get();

    if (!beforeSnap.exists) {
      return NextResponse.json({ error: "Empleado no existe" }, { status: 404 });
    }

    const before = beforeSnap.data();
    if (!belongsToEmpresaId(before, empresaId)) {
      return NextResponse.json({ error: "Empleado de otra empresa" }, { status: 403 });
    }

    await empleadoRef.delete();

    if (before.uid) {
      await db.collection("usuarios").doc(before.uid).delete();
    }

    await logAuditEvent({
      empresaId,
      actor,
      action: "empleado.delete",
      resource: "empleados",
      resourceId: empleadoId,
      before,
    });

    return NextResponse.json({ id: empleadoId });
  } catch (error) {
    return authErrorResponse(error);
  }
}

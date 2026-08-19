import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { logAuditEvent } from "@/lib/audit";
import { DEFAULT_EMPRESA_ID, normalizeEmpresaId } from "@/lib/tenant";
import { authErrorResponse, requirePermission } from "@/lib/serverAuth";

function text(value) {
  return String(value || "").trim();
}

function buildEmpresaPayload(input) {
  const nombre = text(input.nombre);
  const slug = normalizeEmpresaId(input.empresaId || input.slug || nombre)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    empresaId: slug || DEFAULT_EMPRESA_ID,
    nombre,
    nit: text(input.nit),
    telefono: text(input.telefono),
    email: text(input.email).toLowerCase(),
    ciudad: text(input.ciudad),
    direccion: text(input.direccion),
    plan: text(input.plan || "operativo"),
    estado: text(input.estado || "activa"),
    observaciones: text(input.observaciones),
  };
}

export async function GET(request) {
  try {
    await requirePermission(request, "platform.manage");

    const snapshot = await getAdminDb().collection("empresas").get();
    const empresas = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

    if (!empresas.some((empresa) => empresa.empresaId === DEFAULT_EMPRESA_ID)) {
      empresas.unshift({
        id: DEFAULT_EMPRESA_ID,
        empresaId: DEFAULT_EMPRESA_ID,
        nombre: "Proveedor Central",
        estado: "activa",
        plan: "principal",
      });
    }

    return NextResponse.json(empresas);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "platform.manage");
    const body = await request.json();
    const payload = buildEmpresaPayload(body);

    if (!payload.nombre) {
      return NextResponse.json({ error: "Nombre de empresa requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const empresaRef = db.collection("empresas").doc(payload.empresaId);
    const before = await empresaRef.get();

    if (before.exists) {
      return NextResponse.json({ error: "Ya existe una empresa con ese ID" }, { status: 409 });
    }

    await empresaRef.set({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    await logAuditEvent({
      empresaId: payload.empresaId,
      actor,
      action: "empresa.create",
      resource: "empresas",
      resourceId: empresaRef.id,
      after: payload,
    });

    return NextResponse.json({ id: empresaRef.id, empresaId: payload.empresaId });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request) {
  try {
    const actor = await requirePermission(request, "platform.manage");
    const body = await request.json();
    const empresaId = normalizeEmpresaId(body.id || body.empresaId);
    const payload = buildEmpresaPayload({ ...body, empresaId });

    if (!payload.nombre) {
      return NextResponse.json({ error: "Nombre de empresa requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const empresaRef = db.collection("empresas").doc(empresaId);
    const beforeSnap = await empresaRef.get();

    if (!beforeSnap.exists) {
      return NextResponse.json({ error: "Empresa no existe" }, { status: 404 });
    }

    const before = beforeSnap.data();
    await empresaRef.set(
      {
        ...payload,
        empresaId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        updatedByEmail: actor.email,
      },
      { merge: true }
    );

    await logAuditEvent({
      empresaId,
      actor,
      action: "empresa.update",
      resource: "empresas",
      resourceId: empresaId,
      before,
      after: payload,
    });

    return NextResponse.json({ id: empresaId, empresaId });
  } catch (error) {
    return authErrorResponse(error);
  }
}

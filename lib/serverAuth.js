import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ADMIN_EMAILS } from "@/lib/authRoles";
import { DEFAULT_EMPRESA_ID, normalizeEmpresaId } from "@/lib/tenant";
import { ROLES, assertPermission, normalizeRole } from "@/lib/permissions";

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

export async function requireServerProfile(request) {
  const token = getBearerToken(request);

  if (!token) {
    const error = new Error("Token requerido");
    error.status = 401;
    throw error;
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const email = String(decoded.email || "").toLowerCase();

  if (ADMIN_EMAILS.includes(email) || decoded.superadmin === true) {
    return {
      uid: decoded.uid,
      email,
      nombre: decoded.name || "Superadministrador",
      role: ROLES.SUPERADMIN,
      empresaId: DEFAULT_EMPRESA_ID,
      isSuperadmin: true,
      allowed: true,
    };
  }

  const userDoc = await getAdminDb().collection("usuarios").doc(decoded.uid).get();

  if (!userDoc.exists) {
    const error = new Error("Usuario sin perfil operativo");
    error.status = 403;
    throw error;
  }

  const data = userDoc.data() || {};
  const estado = String(data.estado || "activo").trim().toLowerCase();

  if (estado === "inactivo" || estado === "bloqueado") {
    const error = new Error("Usuario inactivo o bloqueado");
    error.status = 403;
    throw error;
  }

  return {
    ...data,
    uid: decoded.uid,
    email: data.email || email,
    nombre: data.nombre || decoded.name || email,
    role: normalizeRole(data.rol || data.role),
    empresaId: normalizeEmpresaId(data.empresaId || data.empresa || data.tenantId),
    allowed: true,
  };
}

export async function requirePermission(request, permission) {
  const profile = await requireServerProfile(request);
  assertPermission(permission, profile);
  return profile;
}

export function getRequestEmpresaId(request, profile) {
  const { searchParams } = new URL(request.url);
  const requestedEmpresaId = normalizeEmpresaId(searchParams.get("empresaId"));

  if (profile.role === ROLES.SUPERADMIN) {
    return requestedEmpresaId;
  }

  return normalizeEmpresaId(profile.empresaId);
}

export function authErrorResponse(error) {
  return Response.json(
    { error: error?.message || "No autorizado" },
    { status: error?.status || 500 }
  );
}

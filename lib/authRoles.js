import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_EMPRESA_ID, normalizeEmpresaId } from "@/lib/tenant";
import { ROLES, normalizeRole as normalizePermissionRole } from "@/lib/permissions";

export const ADMIN_EMAILS = ["alriver1995zit@gmail.com"];

export const roleHome = {
  superadmin: "/admin",
  admin: "/admin",
  carterista: "/carterista",
  ayudante: "/carterista",
  bodega: "/admin/despachos",
};

export function normalizeRole(role) {
  return normalizePermissionRole(role);
}

export async function getUserProfile(user) {
  if (!user) {
    return {
      user: null,
      role: null,
      isAdmin: false,
      allowed: false,
    };
  }

  const email = String(user.email || "").toLowerCase();

  if (ADMIN_EMAILS.includes(email)) {
    return {
      user,
      uid: user.uid,
      email,
      nombre: user.displayName || "Administrador",
      role: ROLES.SUPERADMIN,
      empresaId: DEFAULT_EMPRESA_ID,
      isAdmin: true,
      isSuperadmin: true,
      allowed: true,
    };
  }

  const token = await user.getIdTokenResult(true);

  if (token.claims.admin === true) {
    return {
      user,
      uid: user.uid,
      email,
      nombre: user.displayName || "Administrador",
      role: token.claims.superadmin === true ? ROLES.SUPERADMIN : ROLES.ADMIN,
      empresaId: DEFAULT_EMPRESA_ID,
      isAdmin: true,
      isSuperadmin: token.claims.superadmin === true,
      allowed: true,
    };
  }

  const docRef = doc(db, "usuarios", user.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return {
      user,
      uid: user.uid,
      email,
      nombre: user.displayName || email,
      role: null,
      isAdmin: false,
      allowed: false,
    };
  }

  const data = docSnap.data();
  const role = normalizeRole(data.rol || data.role);
  const estado = String(data.estado || "activo").trim().toLowerCase();
  const active = estado !== "inactivo" && estado !== "bloqueado";

  return {
    ...data,
    user,
    uid: user.uid,
    email,
    nombre: data.nombre || data.name || user.displayName || email,
    role,
    empresaId: normalizeEmpresaId(data.empresaId || data.empresa || data.tenantId),
    isAdmin: role === ROLES.ADMIN || role === ROLES.SUPERADMIN,
    isSuperadmin: role === ROLES.SUPERADMIN,
    estado,
    allowed: Boolean(role) && active,
  };
}

export function getRoleHome(role) {
  return roleHome[normalizeRole(role)] || "/";
}

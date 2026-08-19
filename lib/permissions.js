export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  BODEGA: "bodega",
  CARTERISTA: "carterista",
  AYUDANTE: "ayudante",
};

export const ROLE_LABELS = {
  [ROLES.SUPERADMIN]: "Superadministrador",
  [ROLES.ADMIN]: "Administrador",
  [ROLES.BODEGA]: "Bodega",
  [ROLES.CARTERISTA]: "Carterista",
  [ROLES.AYUDANTE]: "Ayudante",
};

export const PERMISSIONS = {
  "platform.manage": [ROLES.SUPERADMIN],
  "empresa.read": [ROLES.SUPERADMIN, ROLES.ADMIN],
  "empresa.update": [ROLES.SUPERADMIN, ROLES.ADMIN],

  "dashboard.read": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA],
  "errores.read": [ROLES.SUPERADMIN, ROLES.ADMIN],
  "auditoria.read": [ROLES.SUPERADMIN, ROLES.ADMIN],

  "usuarios.manage": [ROLES.SUPERADMIN, ROLES.ADMIN],
  "empleados.manage": [ROLES.SUPERADMIN, ROLES.ADMIN],

  "productos.read": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA, ROLES.CARTERISTA],
  "productos.manage": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA],

  "clientes.read": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.CARTERISTA, ROLES.AYUDANTE],
  "clientes.manage": [ROLES.SUPERADMIN, ROLES.ADMIN],
  "clientes.route.create": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.CARTERISTA],

  "compras.manage": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA],
  "proveedores.manage": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA],
  "inventario.manage": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA],
  "despachos.manage": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA],
  "recepciones.manage": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BODEGA],
  "autorizaciones.manage": [ROLES.SUPERADMIN, ROLES.ADMIN],

  "facturas.manage": [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.CARTERISTA],
  "cartera.manage": [ROLES.SUPERADMIN, ROLES.ADMIN],
  "liquidaciones.manage": [ROLES.SUPERADMIN, ROLES.ADMIN],
  "reportes.read": [ROLES.SUPERADMIN, ROLES.ADMIN],

  "ruta.work": [ROLES.CARTERISTA, ROLES.AYUDANTE],
  "ubicacion.write": [ROLES.CARTERISTA, ROLES.AYUDANTE],
};

export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function isSuperadmin(role) {
  return normalizeRole(role) === ROLES.SUPERADMIN;
}

export function canAccessRole(userRole, allowedRoles = []) {
  const role = normalizeRole(userRole);
  const allowed = allowedRoles.map(normalizeRole);
  return isSuperadmin(role) || allowed.includes(role);
}

export function can(permission, profileOrRole) {
  const role = normalizeRole(
    typeof profileOrRole === "string" ? profileOrRole : profileOrRole?.role || profileOrRole?.rol
  );
  const allowed = PERMISSIONS[permission] || [];
  return canAccessRole(role, allowed);
}

export function assertPermission(permission, profileOrRole) {
  if (!can(permission, profileOrRole)) {
    throw new Error(`Permiso denegado: ${permission}`);
  }
}

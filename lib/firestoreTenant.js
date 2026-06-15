import { DEFAULT_EMPRESA_ID, normalizeEmpresaId } from "@/lib/tenant";

export const TENANT_COLLECTIONS = [
  "productos",
  "clientes",
  "empleados",
  "proveedores",
  "compras",
  "cuentasPagar",
  "despachos",
  "recepciones",
  "liquidaciones",
  "facturas",
  "facturasRuta",
  "gastosRuta",
  "gestionesRuta",
  "movimientosCartera",
  "ubicacionesRuta",
  "kardex",
  "autorizacionesRuta",
  "erroresSistema",
  "auditoria",
];

export function getDocEmpresaId(data) {
  return normalizeEmpresaId(data?.empresaId || DEFAULT_EMPRESA_ID);
}

export function belongsToEmpresaId(data, empresaId) {
  return getDocEmpresaId(data) === normalizeEmpresaId(empresaId);
}

export function filterByEmpresaId(items, empresaId) {
  return items.filter((item) => belongsToEmpresaId(item, empresaId));
}

export function assertSameEmpresa(data, empresaId) {
  if (!belongsToEmpresaId(data, empresaId)) {
    throw new Error("El documento no pertenece a la empresa actual.");
  }
}

export function withTenantCreate(data, profile) {
  const empresaId = normalizeEmpresaId(profile?.empresaId || profile?.empresaIdActual);

  return {
    ...data,
    empresaId,
    createdBy: profile?.uid || data.createdBy || "",
    createdByEmail: profile?.email || data.createdByEmail || "",
    updatedBy: profile?.uid || data.updatedBy || "",
    updatedByEmail: profile?.email || data.updatedByEmail || "",
  };
}

export function withTenantUpdate(data, profile) {
  return {
    ...data,
    updatedBy: profile?.uid || data.updatedBy || "",
    updatedByEmail: profile?.email || data.updatedByEmail || "",
  };
}

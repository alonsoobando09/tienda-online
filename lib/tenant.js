export const DEFAULT_EMPRESA_ID =
  process.env.NEXT_PUBLIC_DEFAULT_EMPRESA_ID || "proveedor-central";

export function normalizeEmpresaId(value) {
  return String(value || DEFAULT_EMPRESA_ID).trim() || DEFAULT_EMPRESA_ID;
}

export function getCurrentEmpresaId() {
  if (typeof window === "undefined") return DEFAULT_EMPRESA_ID;
  return normalizeEmpresaId(localStorage.getItem("empresaId") || DEFAULT_EMPRESA_ID);
}

export function getProfileEmpresaId(profile) {
  return normalizeEmpresaId(profile?.empresaId || profile?.empresa || profile?.tenantId);
}

export function withEmpresaId(data, profile) {
  return {
    ...data,
    empresaId: getProfileEmpresaId(profile),
  };
}

export function belongsToEmpresa(item, profile) {
  const empresaId = getProfileEmpresaId(profile);
  const itemEmpresaId = item?.empresaId || DEFAULT_EMPRESA_ID;
  return normalizeEmpresaId(itemEmpresaId) === empresaId;
}

export function filterByEmpresa(items, profile) {
  return items.filter((item) => belongsToEmpresa(item, profile));
}

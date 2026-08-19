export function normalizeRouteClosurePart(value) {
  return String(value || "sin-dato")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-dato";
}

export function buildRouteClosureId({ empresaId, fecha, diaRuta, ruta }) {
  return [empresaId, fecha, diaRuta, ruta]
    .map(normalizeRouteClosurePart)
    .join("__");
}

export function getRouteWorkDate(data = {}) {
  return data.fechaDespacho || data.fecha || data.fechaRecepcion || "";
}

export function isRouteClosed(data) {
  return data?.estado === "cerrado" || data?.cierreEstado === "cerrado";
}

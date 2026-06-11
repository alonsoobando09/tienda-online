export const diasRuta = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miercoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sabado" },
];

export const rutasBase = [
  "Ruta 1",
  "Ruta 2",
  "Ruta 3",
  "Ruta 4",
  "Ruta 5",
];

export function getTodayRouteDay(date = new Date()) {
  const day = date.getDay();
  const days = {
    1: "lunes",
    2: "martes",
    3: "miercoles",
    4: "jueves",
    5: "viernes",
    6: "sabado",
  };

  return days[day] || "";
}

export function getDiaLabel(value) {
  return diasRuta.find((day) => day.value === value)?.label || value || "Sin dia";
}

export function sortClientesByRoute(clientes) {
  return [...clientes].sort((a, b) => {
    const day = String(a.diaRuta || "").localeCompare(String(b.diaRuta || ""));
    if (day !== 0) return day;

    const route = String(a.ruta || "").localeCompare(String(b.ruta || ""));
    if (route !== 0) return route;

    return Number(a.ordenVisita || 0) - Number(b.ordenVisita || 0);
  });
}

export function getDebtColor(days) {
  const value = Number(days) || 0;

  if (value >= 60) return "negro";
  if (value >= 30) return "rojo";
  if (value >= 15) return "amarillo";
  return "verde";
}

export function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

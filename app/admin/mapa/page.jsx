"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getDiaLabel } from "@/lib/operacion";
import { Clock, LocateFixed, MapPin, RefreshCcw, Search } from "lucide-react";

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value) {
  const ms = timestampMs(value);
  if (!ms) return "Sin hora";
  return new Date(ms).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function mapPosition(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 50;
  if (max === min) return 50;
  return Math.min(Math.max(((value - min) / (max - min)) * 84 + 8, 8), 92);
}

function getLocationStatus(item) {
  const ms = timestampMs(item.timestamp);
  if (!ms) {
    return {
      key: "sin_reporte",
      label: "Sin hora",
      tone: "danger",
      minutes: null,
    };
  }

  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));

  if (minutes <= 15) {
    return {
      key: "activo",
      label: "Activo",
      tone: "success",
      minutes,
    };
  }

  if (minutes <= 60) {
    return {
      key: "reciente",
      label: "Reciente",
      tone: "warning",
      minutes,
    };
  }

  return {
    key: "atrasado",
    label: "Atrasado",
    tone: "danger",
    minutes,
  };
}

function minutesLabel(minutes) {
  if (minutes === null) return "Sin lectura";
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `Hace ${hours} h ${rest} min` : `Hace ${hours} h`;
}

export default function MapaAdminPage() {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  async function cargarUbicaciones() {
    setLoading(true);
    const snap = await getDocs(collection(db, "ubicacionesRuta"));
    setUbicaciones(
      snap.docs.map((docu) => ({
        id: docu.id,
        ...docu.data(),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarUbicaciones();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const ultimasUbicaciones = useMemo(() => {
    const grouped = new Map();

    ubicaciones.forEach((item) => {
      const key = item.uid || item.empleadoNombre || item.id;
      const current = grouped.get(key);
      const itemTime = timestampMs(item.timestamp);
      const currentTime = timestampMs(current?.timestamp);

      if (!current || itemTime > currentTime) {
        grouped.set(key, {
          ...item,
          estadoUbicacion: getLocationStatus(item),
        });
      }
    });

    return [...grouped.values()].sort(
      (a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp)
    );
  }, [ubicaciones]);

  const ubicacionesFiltradas = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ultimasUbicaciones.filter((item) => {
      const matchesStatus =
        statusFilter === "todos" || item.estadoUbicacion?.key === statusFilter;
      const text = [
        item.empleadoNombre,
        item.empleadoRol,
        item.ruta,
        getDiaLabel(item.diaRuta),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || text.includes(query));
    });
  }, [search, statusFilter, ultimasUbicaciones]);

  const resumen = useMemo(() => {
    return ultimasUbicaciones.reduce(
      (acc, item) => {
        const status = item.estadoUbicacion?.key || "sin_reporte";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { activo: 0, reciente: 0, atrasado: 0, sin_reporte: 0 }
    );
  }, [ultimasUbicaciones]);

  const bounds = useMemo(() => {
    const points = ultimasUbicaciones.filter((item) => item.lat && item.lng);
    const lats = points.map((item) => Number(item.lat));
    const lngs = points.map((item) => Number(item.lng));

    if (points.length === 0) {
      return {
        minLat: 0,
        maxLat: 0,
        minLng: 0,
        maxLng: 0,
      };
    }

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [ultimasUbicaciones]);

  return (
    <AdminGuard>
      <AdminShell
        title="Mapa en tiempo real"
        subtitle="Ultima ubicacion reportada por carteristas y ayudantes en ruta."
        actions={
          <button className="admin-button" disabled={loading} onClick={cargarUbicaciones}>
            <RefreshCcw size={18} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        <section className="map-grid">
          <article className="admin-card map-panel">
            <div className="admin-section-title">
              <div>
                <h2>Ubicaciones activas</h2>
                <p>{ultimasUbicaciones.length} personas con ultimo reporte GPS.</p>
              </div>
              <LocateFixed size={28} />
            </div>

            <div className="map-status-grid">
              <button
                className={`map-status-card ${statusFilter === "todos" ? "active" : ""}`}
                onClick={() => setStatusFilter("todos")}
                type="button"
              >
                <span>Todos</span>
                <strong>{ultimasUbicaciones.length}</strong>
              </button>
              <button
                className={`map-status-card success ${
                  statusFilter === "activo" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("activo")}
                type="button"
              >
                <span>Activos</span>
                <strong>{resumen.activo}</strong>
              </button>
              <button
                className={`map-status-card warning ${
                  statusFilter === "reciente" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("reciente")}
                type="button"
              >
                <span>Recientes</span>
                <strong>{resumen.reciente}</strong>
              </button>
              <button
                className={`map-status-card danger ${
                  statusFilter === "atrasado" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("atrasado")}
                type="button"
              >
                <span>Atrasados</span>
                <strong>{resumen.atrasado + resumen.sin_reporte}</strong>
              </button>
            </div>

            <div className="map-canvas">
              {ubicacionesFiltradas.map((item) => {
                const left = mapPosition(Number(item.lng), bounds.minLng, bounds.maxLng);
                const top = 100 - mapPosition(Number(item.lat), bounds.minLat, bounds.maxLat);

                return (
                  <a
                    className={`map-marker ${item.estadoUbicacion?.key || "sin_reporte"}`}
                    href={`https://www.google.com/maps?q=${item.lat},${item.lng}`}
                    key={item.id}
                    rel="noreferrer"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    target="_blank"
                    title={`${item.empleadoNombre} - ${item.ruta}`}
                  >
                    <MapPin size={18} />
                    <span>{item.empleadoNombre || "Ruta"}</span>
                  </a>
                );
              })}
              {ubicacionesFiltradas.length === 0 && (
                <div className="map-empty-state">
                  No hay ubicaciones con estos filtros.
                </div>
              )}
            </div>
          </article>

          <article className="admin-card">
            <h2>Lecturas recientes</h2>
            <label className="admin-search">
              <Search size={18} />
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar carterista, ayudante o ruta"
                value={search}
              />
            </label>
            <div className="liquidation-lines">
              <span>Total reportes</span>
              <strong>{ubicaciones.length}</strong>
              <span>Ultimos usuarios</span>
              <strong>{ultimasUbicaciones.length}</strong>
              <span>Con filtro aplicado</span>
              <strong>{ubicacionesFiltradas.length}</strong>
            </div>

            <div className="map-legend">
              <span><i className="success" /> 0 a 15 minutos</span>
              <span><i className="warning" /> 16 a 60 minutos</span>
              <span><i className="danger" /> Mas de 60 minutos</span>
            </div>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Detalle por persona</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Ruta</th>
                <th>Estado</th>
                <th>Hora</th>
                <th>Precision</th>
                <th>Coordenadas</th>
              </tr>
            </thead>
            <tbody>
              {ubicacionesFiltradas.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.empleadoNombre || "Sin nombre"}</strong>
                    <br />
                    <small>{item.empleadoRol || "Sin rol"}</small>
                  </td>
                  <td>
                    {getDiaLabel(item.diaRuta)}
                    <br />
                    <small>{item.ruta || "Sin ruta"}</small>
                  </td>
                  <td>
                    <span className={`admin-badge ${item.estadoUbicacion?.tone || "danger"}`}>
                      {item.estadoUbicacion?.label || "Sin reporte"}
                    </span>
                    <br />
                    <small>
                      <Clock size={12} /> {minutesLabel(item.estadoUbicacion?.minutes ?? null)}
                    </small>
                  </td>
                  <td>{formatTime(item.timestamp)}</td>
                  <td>{Math.round(Number(item.accuracy) || 0)} m</td>
                  <td>
                    <a
                      href={`https://www.google.com/maps?q=${item.lat},${item.lng}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir mapa
                    </a>
                  </td>
                </tr>
              ))}
              {ubicacionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan="6">Todavia no hay ubicaciones reportadas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

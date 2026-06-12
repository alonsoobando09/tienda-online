"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getDiaLabel } from "@/lib/operacion";
import { LocateFixed, MapPin, RefreshCcw } from "lucide-react";

function formatTime(value) {
  if (!value?.toDate) return "Sin hora";
  return value.toDate().toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function mapPosition(value, min, max) {
  if (max === min) return 50;
  return Math.min(Math.max(((value - min) / (max - min)) * 84 + 8, 8), 92);
}

export default function MapaAdminPage() {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const itemTime = item.timestamp?.toMillis?.() || 0;
      const currentTime = current?.timestamp?.toMillis?.() || 0;

      if (!current || itemTime > currentTime) {
        grouped.set(key, item);
      }
    });

    return [...grouped.values()].sort(
      (a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)
    );
  }, [ubicaciones]);

  const bounds = useMemo(() => {
    const points = ultimasUbicaciones.filter((item) => item.lat && item.lng);
    const lats = points.map((item) => Number(item.lat));
    const lngs = points.map((item) => Number(item.lng));

    return {
      minLat: Math.min(...lats, 0),
      maxLat: Math.max(...lats, 0),
      minLng: Math.min(...lngs, 0),
      maxLng: Math.max(...lngs, 0),
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
                <p>{ultimasUbicaciones.length} personas con reporte GPS.</p>
              </div>
              <LocateFixed size={28} />
            </div>

            <div className="map-canvas">
              {ultimasUbicaciones.map((item) => {
                const left = mapPosition(Number(item.lng), bounds.minLng, bounds.maxLng);
                const top = 100 - mapPosition(Number(item.lat), bounds.minLat, bounds.maxLat);

                return (
                  <a
                    className="map-marker"
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
            </div>
          </article>

          <article className="admin-card">
            <h2>Lecturas recientes</h2>
            <div className="liquidation-lines">
              <span>Total reportes</span>
              <strong>{ubicaciones.length}</strong>
              <span>Ultimos usuarios</span>
              <strong>{ultimasUbicaciones.length}</strong>
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
                <th>Hora</th>
                <th>Precision</th>
                <th>Coordenadas</th>
              </tr>
            </thead>
            <tbody>
              {ultimasUbicaciones.map((item) => (
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
              {ultimasUbicaciones.length === 0 && (
                <tr>
                  <td colSpan="5">Todavia no hay ubicaciones reportadas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

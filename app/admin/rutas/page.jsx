"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getDiaLabel, money, sortClientesByRoute } from "@/lib/operacion";
import { MapPinned, Users } from "lucide-react";

export default function RutasAdminPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  async function cargarRutas(showLoading = true) {
    if (showLoading) setLoading(true);
    const snapshot = await getDocs(collection(db, "clientes"));
    const data = snapshot.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    setClientes(sortClientesByRoute(data));
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarRutas(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const rutas = useMemo(() => {
    const map = new Map();

    clientes.forEach((cliente) => {
      const key = `${cliente.diaRuta || "sin-dia"}__${cliente.ruta || "Sin ruta"}`;
      const current = map.get(key) || {
        key,
        diaRuta: cliente.diaRuta || "sin-dia",
        ruta: cliente.ruta || "Sin ruta",
        clientes: 0,
        deuda: 0,
        solicitudesBorrado: 0,
        maxOrden: 0,
      };

      current.clientes += 1;
      current.deuda += Number(cliente.deudaActual) || 0;
      current.solicitudesBorrado += cliente.solicitudBorrado ? 1 : 0;
      current.maxOrden = Math.max(
        current.maxOrden,
        Number(cliente.ordenVisita) || 0
      );

      map.set(key, current);
    });

    return [...map.values()].sort((a, b) => {
      const day = String(a.diaRuta).localeCompare(String(b.diaRuta));
      if (day !== 0) return day;
      return String(a.ruta).localeCompare(String(b.ruta));
    });
  }, [clientes]);

  return (
    <AdminGuard>
      <AdminShell
        title="Rutas"
        subtitle="Control de rutas por dia, orden de visita, cartera y clientes pendientes."
        actions={
          <button className="admin-button secondary" onClick={cargarRutas}>
            Actualizar
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Rutas activas</h3>
            <h2>{rutas.length}</h2>
            <p>Combinaciones de dia y ruta.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Clientes</h3>
            <h2>{clientes.length}</h2>
            <p>Clientes organizados por recorrido.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Cartera</h3>
            <h2>{money(clientes.reduce((acc, c) => acc + (Number(c.deudaActual) || 0), 0))}</h2>
            <p>Total registrado en clientes.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Por revisar</h3>
            <h2>{clientes.filter((cliente) => cliente.solicitudBorrado).length}</h2>
            <p>Clientes marcados para posible borrado.</p>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Planillas de ruta</h2>
              <p>Resumen operativo para despacho, visita y cartera.</p>
            </div>
            <Link className="admin-button" href="/admin/clientes">
              <Users size={18} />
              Gestionar clientes
            </Link>
          </div>

          {loading ? (
            <p>Cargando rutas...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Dia</th>
                  <th>Clientes</th>
                  <th>Ultimo orden</th>
                  <th>Cartera</th>
                  <th>Revision</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map((ruta) => (
                  <tr key={ruta.key}>
                    <td>
                      <strong>{ruta.ruta}</strong>
                      <br />
                      <small>
                        <MapPinned size={14} /> Recorrido operativo
                      </small>
                    </td>
                    <td>{getDiaLabel(ruta.diaRuta)}</td>
                    <td>{ruta.clientes}</td>
                    <td>#{ruta.maxOrden || "-"}</td>
                    <td>{money(ruta.deuda)}</td>
                    <td>
                      <span
                        className={`debt-pill ${
                          ruta.solicitudesBorrado ? "amarillo" : "verde"
                        }`}
                      >
                        {ruta.solicitudesBorrado
                          ? `${ruta.solicitudesBorrado} por revisar`
                          : "Sin pendientes"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

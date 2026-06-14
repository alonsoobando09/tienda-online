"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getDiaLabel, money, sortClientesByRoute } from "@/lib/operacion";
import { AlertTriangle, MapPinned, Users } from "lucide-react";

export default function RutasAdminPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState("todos");
  const [routeFilter, setRouteFilter] = useState("todas");
  const [alertFilter, setAlertFilter] = useState("todas");

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
        clientesConDeuda: 0,
        clientesNuevosRuta: 0,
        deuda: 0,
        solicitudesBorrado: 0,
        ordenPendiente: 0,
        riesgo: 0,
        perdidos: 0,
        maxOrden: 0,
      };

      current.clientes += 1;
      const deuda = Number(cliente.deudaActual) || 0;
      current.deuda += deuda;
      if (deuda > 0) current.clientesConDeuda += 1;
      if (cliente.creadoPorCarterista) current.clientesNuevosRuta += 1;
      current.solicitudesBorrado += cliente.solicitudBorrado ? 1 : 0;
      current.ordenPendiente += cliente.pendienteRevisionOrden ? 1 : 0;
      current.riesgo +=
        cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida ? 1 : 0;
      current.perdidos += cliente.estadoCliente === "perdido" || cliente.perdido ? 1 : 0;
      current.maxOrden = Math.max(
        current.maxOrden,
        Number(cliente.ordenVisita) || 0
      );

      map.set(key, current);
    });

    return [...map.values()]
      .map((ruta) => ({
        ...ruta,
        totalAlertas:
          ruta.solicitudesBorrado +
          ruta.ordenPendiente +
          ruta.riesgo +
          ruta.perdidos,
        deudaPromedio: ruta.clientesConDeuda
          ? ruta.deuda / ruta.clientesConDeuda
          : 0,
      }))
      .sort((a, b) => {
      const day = String(a.diaRuta).localeCompare(String(b.diaRuta));
      if (day !== 0) return day;
      return String(a.ruta).localeCompare(String(b.ruta));
    });
  }, [clientes]);

  const diasDisponibles = useMemo(
    () => [...new Set(rutas.map((ruta) => ruta.diaRuta))].sort(),
    [rutas]
  );

  const rutasDisponibles = useMemo(
    () => [...new Set(rutas.map((ruta) => ruta.ruta))].sort(),
    [rutas]
  );

  const rutasFiltradas = useMemo(
    () =>
      rutas.filter((ruta) => {
        if (dayFilter !== "todos" && ruta.diaRuta !== dayFilter) return false;
        if (routeFilter !== "todas" && ruta.ruta !== routeFilter) return false;
        if (alertFilter === "con_alertas" && ruta.totalAlertas <= 0) return false;
        if (alertFilter === "sin_alertas" && ruta.totalAlertas > 0) return false;
        return true;
      }),
    [alertFilter, dayFilter, routeFilter, rutas]
  );

  const resumenFiltrado = useMemo(
    () =>
      rutasFiltradas.reduce(
        (acc, ruta) => {
          acc.clientes += ruta.clientes;
          acc.clientesConDeuda += ruta.clientesConDeuda;
          acc.deuda += ruta.deuda;
          acc.alertas += ruta.totalAlertas;
          acc.nuevos += ruta.clientesNuevosRuta;
          return acc;
        },
        { clientes: 0, clientesConDeuda: 0, deuda: 0, alertas: 0, nuevos: 0 }
      ),
    [rutasFiltradas]
  );

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
            <h2>{resumenFiltrado.clientes}</h2>
            <p>{resumenFiltrado.clientesConDeuda} con deuda.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Cartera</h3>
            <h2>{money(resumenFiltrado.deuda)}</h2>
            <p>Total de rutas visibles.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Alertas ruta</h3>
            <h2>{resumenFiltrado.alertas}</h2>
            <p>{resumenFiltrado.nuevos} clientes creados en ruta.</p>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Planillas de ruta</h2>
              <p>{rutasFiltradas.length} planillas visibles para despacho, visita y cartera.</p>
            </div>
            <div className="admin-actions">
              <select
                className="admin-select-inline"
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
              >
                <option value="todos">Todos los dias</option>
                {diasDisponibles.map((dia) => (
                  <option key={dia} value={dia}>
                    {getDiaLabel(dia)}
                  </option>
                ))}
              </select>
              <select
                className="admin-select-inline"
                value={routeFilter}
                onChange={(event) => setRouteFilter(event.target.value)}
              >
                <option value="todas">Todas las rutas</option>
                {rutasDisponibles.map((ruta) => (
                  <option key={ruta} value={ruta}>
                    {ruta}
                  </option>
                ))}
              </select>
              <select
                className="admin-select-inline"
                value={alertFilter}
                onChange={(event) => setAlertFilter(event.target.value)}
              >
                <option value="todas">Todas</option>
                <option value="con_alertas">Con alertas</option>
                <option value="sin_alertas">Sin alertas</option>
              </select>
              <Link className="admin-button" href="/admin/clientes">
                <Users size={18} />
                Gestionar clientes
              </Link>
            </div>
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
                  <th>Riesgo</th>
                  <th>Perdidos</th>
                  <th>Revision</th>
                </tr>
              </thead>
              <tbody>
                {rutasFiltradas.map((ruta) => (
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
                    <td>
                      {money(ruta.deuda)}
                      <small>
                        {ruta.clientesConDeuda} clientes / prom.{" "}
                        {money(ruta.deudaPromedio)}
                      </small>
                    </td>
                    <td>{ruta.riesgo}</td>
                    <td>{ruta.perdidos}</td>
                    <td>
                      <span
                        className={`debt-pill ${
                          ruta.totalAlertas > 0
                            ? "amarillo"
                            : "verde"
                        }`}
                      >
                        {ruta.totalAlertas > 0
                          ? `${ruta.totalAlertas} alertas`
                          : "Sin pendientes"}
                      </span>
                      {ruta.totalAlertas > 0 && (
                        <small>
                          <AlertTriangle size={13} /> {ruta.solicitudesBorrado} borrar /{" "}
                          {ruta.ordenPendiente} orden / {ruta.riesgo} riesgo /{" "}
                          {ruta.perdidos} perdidos
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
                {!rutasFiltradas.length && (
                  <tr>
                    <td colSpan="8">No hay rutas con esos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

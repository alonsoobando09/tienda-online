"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getDiaLabel, money } from "@/lib/operacion";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Search,
  UserX,
} from "lucide-react";

const estadoLabels = {
  pendiente: "Pendiente",
  visitado: "Visitado",
  no_encontrado: "No disponible",
  riesgo_perdida: "Riesgo",
};

const estadoPills = {
  pendiente: "amarillo",
  visitado: "verde",
  no_encontrado: "rojo",
  riesgo_perdida: "gris",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return Number(new Date(value)) || 0;
}

function formatDateTime(value) {
  const time = getTimestampValue(value);
  if (!time) return "Sin hora";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(time));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export default function GestionesAdminPage() {
  const [gestiones, setGestiones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fechaFilter, setFechaFilter] = useState(todayKey());
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [rutaFilter, setRutaFilter] = useState("todas");
  const [carteristaFilter, setCarteristaFilter] = useState("todos");
  const [search, setSearch] = useState("");

  async function cargarGestiones(showLoading = true) {
    if (showLoading) setLoading(true);

    try {
      const [gestionesSnap, clientesSnap] = await Promise.all([
        getDocs(collection(db, "gestionesRuta")),
        getDocs(collection(db, "clientes")),
      ]);

      setGestiones(
        gestionesSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt))
      );
      setClientes(clientesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarGestiones(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const clienteMap = useMemo(() => {
    const map = new Map();
    clientes.forEach((cliente) => map.set(cliente.id, cliente));
    return map;
  }, [clientes]);

  const rutasDisponibles = useMemo(
    () =>
      [
        ...new Set(
          gestiones.map((gestion) => gestion.ruta).filter(Boolean)
        ),
      ].sort(),
    [gestiones]
  );

  const carteristasDisponibles = useMemo(
    () =>
      [
        ...new Set(
          gestiones.map((gestion) => gestion.carteristaNombre).filter(Boolean)
        ),
      ].sort(),
    [gestiones]
  );

  const gestionesFiltradas = useMemo(() => {
    const term = normalize(search);

    return gestiones.filter((gestion) => {
      const cliente = clienteMap.get(gestion.clienteId);
      if (fechaFilter && gestion.fecha !== fechaFilter) return false;
      if (estadoFilter !== "todos" && gestion.estadoVisita !== estadoFilter) return false;
      if (rutaFilter !== "todas" && gestion.ruta !== rutaFilter) return false;
      if (
        carteristaFilter !== "todos" &&
        gestion.carteristaNombre !== carteristaFilter
      ) {
        return false;
      }
      if (!term) return true;

      return [
        gestion.clienteNombre,
        gestion.telefono,
        gestion.ruta,
        gestion.carteristaNombre,
        cliente?.direccion,
        cliente?.local,
      ]
        .filter(Boolean)
        .some((value) => normalize(value).includes(term));
    });
  }, [
    carteristaFilter,
    clienteMap,
    estadoFilter,
    fechaFilter,
    gestiones,
    rutaFilter,
    search,
  ]);

  const resumen = useMemo(
    () =>
      gestionesFiltradas.reduce(
        (acc, gestion) => {
          const estado = gestion.estadoVisita || "pendiente";
          acc.total += 1;
          acc[estado] = (acc[estado] || 0) + 1;
          acc.deuda += Number(gestion.deudaActual) || 0;
          return acc;
        },
        {
          total: 0,
          pendiente: 0,
          visitado: 0,
          no_encontrado: 0,
          riesgo_perdida: 0,
          deuda: 0,
        }
      ),
    [gestionesFiltradas]
  );

  return (
    <AdminGuard>
      <AdminShell
        title="Gestiones de ruta"
        subtitle="Bitacora diaria de clientes visitados, no disponibles, en riesgo y recuperados."
        actions={
          <button className="admin-button secondary" disabled={loading} onClick={cargarGestiones}>
            <RefreshCcw size={18} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-blue">
            <h3>Gestiones</h3>
            <h2>{resumen.total}</h2>
            <p>Movimientos visibles con filtros actuales.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <h3>Visitados</h3>
            <h2>{resumen.visitado}</h2>
            <p>Clientes encontrados y atendidos.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>No disponibles</h3>
            <h2>{resumen.no_encontrado}</h2>
            <p>Casa, descanso, vacaciones o no abrio.</p>
          </article>
          <article className="admin-card">
            <h3>Riesgo gris</h3>
            <h2>{resumen.riesgo_perdida}</h2>
            <p>{money(resumen.deuda)} asociado a estas gestiones.</p>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Bitacora operativa</h2>
              <p>
                Revisa quien marco cada cliente, con fecha, ruta, estado y cartera.
              </p>
            </div>
            <div className="admin-actions">
              <input
                className="admin-input-inline"
                type="date"
                value={fechaFilter}
                onChange={(event) => setFechaFilter(event.target.value)}
              />
              <select
                className="admin-select-inline"
                value={estadoFilter}
                onChange={(event) => setEstadoFilter(event.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="visitado">Visitados</option>
                <option value="no_encontrado">No disponibles</option>
                <option value="riesgo_perdida">Riesgo</option>
                <option value="pendiente">Pendiente</option>
              </select>
              <select
                className="admin-select-inline"
                value={rutaFilter}
                onChange={(event) => setRutaFilter(event.target.value)}
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
                value={carteristaFilter}
                onChange={(event) => setCarteristaFilter(event.target.value)}
              >
                <option value="todos">Todos los carteristas</option>
                {carteristasDisponibles.map((carterista) => (
                  <option key={carterista} value={carterista}>
                    {carterista}
                  </option>
                ))}
              </select>
              <label className="admin-search-inline">
                <Search size={16} />
                <input
                  placeholder="Buscar cliente, ruta o direccion"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
          </div>

          {loading ? (
            <p>Cargando gestiones...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Ruta</th>
                  <th>Carterista</th>
                  <th>Cartera</th>
                  <th>Hora</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {gestionesFiltradas.map((gestion) => {
                  const cliente = clienteMap.get(gestion.clienteId);
                  const estado = gestion.estadoVisita || "pendiente";
                  const estadoCliente = gestion.estadoCliente || cliente?.estadoCliente || "";

                  return (
                    <tr key={gestion.id}>
                      <td>
                        <strong>{gestion.clienteNombre || "Cliente sin nombre"}</strong>
                        <br />
                        <small>{cliente?.direccion || "Sin direccion"}</small>
                        <br />
                        <small>{gestion.telefono || cliente?.telefono || "Sin telefono"}</small>
                      </td>
                      <td>
                        <span className={`debt-pill ${estadoPills[estado] || "amarillo"}`}>
                          {estadoLabels[estado] || estado}
                        </span>
                        {estadoCliente === "activo" && estado === "visitado" && (
                          <>
                            <br />
                            <small>Activo / recuperado</small>
                          </>
                        )}
                      </td>
                      <td>
                        {getDiaLabel(gestion.diaRuta)}
                        <br />
                        <small>{gestion.ruta || "Sin ruta"}</small>
                      </td>
                      <td>{gestion.carteristaNombre || "Sin carterista"}</td>
                      <td>{money(gestion.deudaActual || 0)}</td>
                      <td>{formatDateTime(gestion.createdAt)}</td>
                      <td className="admin-row-actions">
                        {estado === "visitado" && <CheckCircle2 size={18} />}
                        {estado === "no_encontrado" && <UserX size={18} />}
                        {estado === "riesgo_perdida" && <AlertTriangle size={18} />}
                        <Link
                          className="admin-button secondary"
                          href={`/admin/clientes?cliente=${gestion.clienteId}`}
                        >
                          Cliente
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!gestionesFiltradas.length && (
                  <tr>
                    <td colSpan="7">No hay gestiones con esos filtros.</td>
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

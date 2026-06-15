"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { DEFAULT_EMPRESA_ID } from "@/lib/tenant";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

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

function getEmpresaActual() {
  if (typeof window === "undefined") return DEFAULT_EMPRESA_ID;
  return localStorage.getItem("empresaId") || DEFAULT_EMPRESA_ID;
}

export default function ErroresAdminPage() {
  const [errores, setErrores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState("abiertos");
  const [areaFilter, setAreaFilter] = useState("todas");
  const [search, setSearch] = useState("");

  async function cargarErrores(showLoading = true) {
    if (showLoading) setLoading(true);

    try {
      const empresaId = getEmpresaActual();
      const snap = await getDocs(collection(db, "erroresSistema"));
      setErrores(
        snap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .filter((item) => (item.empresaId || DEFAULT_EMPRESA_ID) === empresaId)
          .sort(
            (a, b) =>
              getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt)
          )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarErrores(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const areasDisponibles = useMemo(
    () => [...new Set(errores.map((error) => error.area).filter(Boolean))].sort(),
    [errores]
  );

  const erroresFiltrados = useMemo(() => {
    const term = normalize(search);

    return errores.filter((error) => {
      const estado = error.estado || "abierto";
      if (estadoFilter === "abiertos" && estado !== "abierto") return false;
      if (estadoFilter !== "todos" && estadoFilter !== "abiertos" && estado !== estadoFilter) {
        return false;
      }
      if (areaFilter !== "todas" && error.area !== areaFilter) return false;
      if (!term) return true;

      return [
        error.message,
        error.name,
        error.area,
        error.modulo,
        error.path,
        error.userEmail,
        error.userRole,
      ]
        .filter(Boolean)
        .some((value) => normalize(value).includes(term));
    });
  }, [areaFilter, errores, estadoFilter, search]);

  const resumen = useMemo(
    () =>
      errores.reduce(
        (acc, error) => {
          const estado = error.estado || "abierto";
          acc.total += 1;
          acc[estado] = (acc[estado] || 0) + 1;
          if (getTimestampValue(error.createdAt) >= Date.now() - 24 * 60 * 60 * 1000) {
            acc.ultimas24h += 1;
          }
          if (error.area === "next-error-boundary") acc.graves += 1;
          return acc;
        },
        {
          total: 0,
          abierto: 0,
          revisado: 0,
          resuelto: 0,
          ultimas24h: 0,
          graves: 0,
        }
      ),
    [errores]
  );

  async function cambiarEstado(error, estado) {
    await updateDoc(doc(db, "erroresSistema", error.id), {
      estado,
      revisadoAt: estado === "revisado" ? serverTimestamp() : error.revisadoAt || null,
      resueltoAt: estado === "resuelto" ? serverTimestamp() : error.resueltoAt || null,
      updatedAt: serverTimestamp(),
    });
    await cargarErrores(false);
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Errores del sistema"
        subtitle="Registro operativo de fallos para revisar, priorizar y resolver."
        actions={
          <button className="admin-button secondary" disabled={loading} onClick={cargarErrores}>
            <RefreshCcw size={18} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-red">
            <AlertTriangle size={22} />
            <h3>Abiertos</h3>
            <h2>{resumen.abierto}</h2>
            <p>Requieren revision.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <ShieldCheck size={22} />
            <h3>Revisados</h3>
            <h2>{resumen.revisado}</h2>
            <p>Ya fueron vistos.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <CheckCircle2 size={22} />
            <h3>Resueltos</h3>
            <h2>{resumen.resuelto}</h2>
            <p>Cerrados por el equipo.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Ultimas 24h</h3>
            <h2>{resumen.ultimas24h}</h2>
            <p>{resumen.graves} errores graves acumulados.</p>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Bitacora de errores</h2>
              <p>{erroresFiltrados.length} visibles de {errores.length} registros.</p>
            </div>
            <div className="admin-actions">
              <select
                className="admin-select-inline"
                value={estadoFilter}
                onChange={(event) => setEstadoFilter(event.target.value)}
              >
                <option value="abiertos">Abiertos</option>
                <option value="todos">Todos</option>
                <option value="revisado">Revisados</option>
                <option value="resuelto">Resueltos</option>
              </select>
              <select
                className="admin-select-inline"
                value={areaFilter}
                onChange={(event) => setAreaFilter(event.target.value)}
              >
                <option value="todas">Todas las areas</option>
                {areasDisponibles.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <label className="admin-search-inline">
                <Search size={17} />
                <input
                  placeholder="Buscar mensaje, usuario o ruta"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Area</th>
                <th>Mensaje</th>
                <th>Usuario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {erroresFiltrados.map((error) => {
                const estado = error.estado || "abierto";
                const estadoColor =
                  estado === "resuelto"
                    ? "verde"
                    : estado === "revisado"
                      ? "amarillo"
                      : "rojo";

                return (
                  <tr key={error.id}>
                    <td>{formatDateTime(error.createdAt)}</td>
                    <td>
                      <strong>{error.area || "cliente"}</strong>
                      <br />
                      <small>{error.path || "Sin ruta"}</small>
                    </td>
                    <td>
                      <strong>{error.name || "Error"}</strong>
                      <br />
                      <small>{error.message || "Sin mensaje"}</small>
                    </td>
                    <td>
                      {error.userEmail || "Sin usuario"}
                      <br />
                      <small>{error.userRole || "Sin rol"}</small>
                    </td>
                    <td>
                      <span className={`debt-pill ${estadoColor}`}>{estado}</span>
                    </td>
                    <td className="admin-row-actions">
                      {estado !== "revisado" && (
                        <button
                          className="admin-button secondary"
                          onClick={() => cambiarEstado(error, "revisado")}
                          type="button"
                        >
                          Revisar
                        </button>
                      )}
                      {estado !== "resuelto" && (
                        <button
                          className="admin-button"
                          onClick={() => cambiarEstado(error, "resuelto")}
                          type="button"
                        >
                          Resolver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && erroresFiltrados.length === 0 && (
                <tr>
                  <td colSpan="6">No hay errores con esos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { auth } from "@/lib/firebase";
import { DEFAULT_EMPRESA_ID, getCurrentEmpresaId } from "@/lib/tenant";
import { Activity, Database, RefreshCcw, Search, ShieldCheck } from "lucide-react";

function formatDateTime(value) {
  if (!value) return "Sin hora";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export default function AuditoriaAdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resourceFilter, setResourceFilter] = useState("todos");
  const [search, setSearch] = useState("");

  async function cargarAuditoria(showLoading = true) {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesion no disponible. Ingresa nuevamente.");

      const params = new URLSearchParams({
        empresaId: getCurrentEmpresaId() || DEFAULT_EMPRESA_ID,
      });
      const response = await fetch(`/api/admin/auditoria?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo cargar auditoria.");
      }

      setItems(result.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarAuditoria(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const recursos = useMemo(
    () => [...new Set(items.map((item) => item.resource).filter(Boolean))].sort(),
    [items]
  );

  const filtrados = useMemo(() => {
    const term = normalize(search);

    return items.filter((item) => {
      if (resourceFilter !== "todos" && item.resource !== resourceFilter) {
        return false;
      }

      if (!term) return true;

      return [
        item.action,
        item.resource,
        item.resourceId,
        item.actorEmail,
        item.actorRole,
      ]
        .filter(Boolean)
        .some((value) => normalize(value).includes(term));
    });
  }, [items, resourceFilter, search]);

  const resumen = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc.total += 1;
          acc.recursos.add(item.resource);
          if (item.createdAt && Date.now() - new Date(item.createdAt).getTime() <= 86400000) {
            acc.ultimas24h += 1;
          }
          if (item.actorEmail) acc.usuarios.add(item.actorEmail);
          return acc;
        },
        { total: 0, ultimas24h: 0, recursos: new Set(), usuarios: new Set() }
      ),
    [items]
  );

  return (
    <AdminGuard>
      <AdminShell
        title="Auditoria"
        subtitle="Historial seguro de cambios criticos por empresa, usuario y modulo."
        actions={
          <button className="admin-button secondary" disabled={loading} onClick={cargarAuditoria}>
            <RefreshCcw size={18} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        {error && <div className="admin-card">{error}</div>}

        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-blue">
            <ShieldCheck size={22} />
            <h3>Eventos</h3>
            <h2>{resumen.total}</h2>
            <p>Ultimos registros visibles.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <Activity size={22} />
            <h3>Ultimas 24h</h3>
            <h2>{resumen.ultimas24h}</h2>
            <p>Cambios recientes.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <Database size={22} />
            <h3>Recursos</h3>
            <h2>{resumen.recursos.size}</h2>
            <p>Modulos tocados.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Usuarios</h3>
            <h2>{resumen.usuarios.size}</h2>
            <p>Actores con actividad.</p>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Historial de cambios</h2>
              <p>{filtrados.length} visibles de {items.length} eventos.</p>
            </div>
            <div className="admin-actions">
              <select
                className="admin-select-inline"
                value={resourceFilter}
                onChange={(event) => setResourceFilter(event.target.value)}
              >
                <option value="todos">Todos los modulos</option>
                {recursos.map((resource) => (
                  <option key={resource} value={resource}>
                    {resource}
                  </option>
                ))}
              </select>
              <label className="admin-search-inline">
                <Search size={17} />
                <input
                  placeholder="Buscar usuario, accion o documento"
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
                <th>Accion</th>
                <th>Modulo</th>
                <th>Documento</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <strong>{item.action || "accion"}</strong>
                  </td>
                  <td>{item.resource || "sin_modulo"}</td>
                  <td>
                    <small>{item.resourceId || "sin_documento"}</small>
                  </td>
                  <td>
                    {item.actorEmail || "Sin usuario"}
                    <br />
                    <small>{item.actorRole || "Sin rol"}</small>
                  </td>
                </tr>
              ))}
              {!loading && filtrados.length === 0 && (
                <tr>
                  <td colSpan="5">No hay eventos de auditoria con esos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

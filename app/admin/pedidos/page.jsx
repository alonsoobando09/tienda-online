"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

const estados = ["pendiente", "pagado", "enviado", "entregado", "cancelado"];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("activos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  async function cargarPedidos() {
    setLoading(true);
    const res = await fetch("/api/admin/facturas");
    const data = await res.json();
    setPedidos(
      Array.isArray(data) ? data.filter((pedido) => pedido.source === "tienda") : []
    );
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    fetch("/api/admin/facturas")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setPedidos(
            Array.isArray(data)
              ? data.filter((pedido) => pedido.source === "tienda")
              : []
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const pedidosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();

    return pedidos.filter((pedido) => {
      const estado = pedido.estado || "pendiente";
      const fecha = pedido.fecha || "";

      if (stateFilter === "activos" && ["entregado", "cancelado"].includes(estado)) {
        return false;
      }
      if (stateFilter !== "activos" && stateFilter !== "todos" && estado !== stateFilter) {
        return false;
      }
      if (dateFrom && fecha && fecha < dateFrom) return false;
      if (dateTo && fecha && fecha > dateTo) return false;
      if (!term) return true;

      return [
        pedido.numero,
        pedido.id,
        pedido.cliente?.nombre,
        pedido.clienteNombre,
        pedido.clienteTelefono,
        pedido.tipoPago,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [dateFrom, dateTo, pedidos, search, stateFilter]);

  const resumen = useMemo(() => {
    return pedidosFiltrados.reduce(
      (acc, pedido) => {
        const total = Number(pedido.total) || 0;
        const estado = pedido.estado || "pendiente";

        acc.pedidos += 1;
        acc.total += total;
        if (estado === "pendiente") acc.pendiente += total;
        if (estado === "pagado") acc.pagado += total;
        if (estado === "enviado") acc.enviado += 1;
        if (estado === "entregado") acc.entregado += 1;
        if (["pagado", "enviado"].includes(estado)) acc.porEntregar += 1;
        if (!pedido.clienteTelefono && !pedido.cliente?.telefono) acc.sinTelefono += 1;
        return acc;
      },
      {
        pedidos: 0,
        total: 0,
        pendiente: 0,
        pagado: 0,
        enviado: 0,
        entregado: 0,
        porEntregar: 0,
        sinTelefono: 0,
      }
    );
  }, [pedidosFiltrados]);

  async function cambiarEstado(id, estado) {
    await fetch(`/api/admin/facturas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    await cargarPedidos();
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Pedidos"
        subtitle="Seguimiento de pedidos de tienda: pago, despacho, envio y entrega."
        actions={
          <button className="admin-button secondary" disabled={loading} onClick={cargarPedidos}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card">
            <p>Pedidos visibles</p>
            <h2>{resumen.pedidos}</h2>
          </article>
          <article className="admin-card">
            <p>Total pedidos</p>
            <h2>{money.format(resumen.total)}</h2>
          </article>
          <article className="admin-card">
            <p>Pendiente de pago</p>
            <h2>{money.format(resumen.pendiente)}</h2>
          </article>
          <article className="admin-card">
            <p>Pagado</p>
            <h2>{money.format(resumen.pagado)}</h2>
          </article>
          <article className="admin-card admin-stat-red">
            <p>Por entregar</p>
            <h2>{resumen.porEntregar}</h2>
            <span>{resumen.sinTelefono} sin telefono.</span>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <div>
              <h2>Bandeja de pedidos</h2>
              <p>Pedidos de checkout separados de las facturas de ruta.</p>
            </div>
            <div className="admin-toolbar-actions">
              <input
                className="admin-input-inline"
                placeholder="Buscar pedido"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <input
                className="admin-input-inline"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <input
                className="admin-input-inline"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
              <select
                className="admin-select-inline"
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
              >
                <option value="activos">Activos</option>
                <option value="todos">Todos</option>
                {estados.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p>Cargando pedidos...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Productos</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>{pedido.numero || pedido.id}</td>
                    <td>
                      <strong>
                        {pedido.cliente?.nombre || pedido.clienteNombre || "Cliente"}
                      </strong>
                      <small>{pedido.clienteTelefono || "Sin telefono"}</small>
                    </td>
                    <td>{pedido.fecha || "Sin fecha"}</td>
                    <td>{money.format(pedido.total || 0)}</td>
                    <td>{pedido.tipoPago || "pendiente"}</td>
                    <td>{pedido.productosCount || pedido.productos?.length || 0}</td>
                    <td>
                      <select
                        value={pedido.estado || "pendiente"}
                        onChange={(event) => cambiarEstado(pedido.id, event.target.value)}
                      >
                        {estados.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Link
                        className="admin-button secondary"
                        href={`/admin/facturas/${pedido.id}`}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
                {!pedidosFiltrados.length && (
                  <tr>
                    <td colSpan="8">No hay pedidos de tienda con esos filtros.</td>
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

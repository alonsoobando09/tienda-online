"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(factura, dateKey) {
  if (factura.fecha) return String(factura.fecha).slice(0, 10) === dateKey;
  const created = factura.createdAt;
  if (created?.seconds) {
    return new Date(created.seconds * 1000).toISOString().slice(0, 10) === dateKey;
  }
  return false;
}

export default function VentasPage() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("todas");
  const [periodFilter, setPeriodFilter] = useState("todas");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/admin/facturas")
      .then((res) => res.json())
      .then((data) => {
        if (active) setFacturas(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const ventasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = todayKey();

    return facturas.filter((factura) => {
      if (sourceFilter !== "todas" && factura.source !== sourceFilter) return false;
      if (periodFilter === "hoy" && !sameDay(factura, today)) return false;
      if (dateFrom && factura.fecha && factura.fecha < dateFrom) return false;
      if (dateTo && factura.fecha && factura.fecha > dateTo) return false;
      if (!term) return true;

      return [
        factura.numero,
        factura.id,
        factura.cliente?.nombre,
        factura.clienteNombre,
        factura.clienteTelefono,
        factura.ruta,
        factura.carteristaNombre,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [dateFrom, dateTo, facturas, periodFilter, search, sourceFilter]);

  const resumen = useMemo(() => {
    return ventasFiltradas.reduce(
      (acc, factura) => {
        const total = Number(factura.total) || 0;
        const cobrado =
          factura.source === "ruta"
            ? Number(factura.cobrado) || 0
            : ["pagado", "enviado", "entregado"].includes(factura.estado)
              ? total
              : 0;
        const pendiente =
          factura.source === "ruta"
            ? Number(factura.fiadoHoy) || 0
            : factura.estado === "pendiente"
              ? total
              : 0;

        acc.ventas += 1;
        acc.bruto += total;
        acc.cobrado += cobrado;
        acc.pendiente += pendiente;
        if (pendiente > 0) acc.facturasPendientes += 1;
        if (factura.source === "ruta") {
          acc.ruta += total;
          acc.fiadoRuta += Number(factura.fiadoHoy) || 0;
        } else {
          acc.tienda += total;
        }
        if (!factura.clienteTelefono && !factura.cliente?.telefono) {
          acc.sinTelefono += 1;
        }
        return acc;
      },
      {
        ventas: 0,
        bruto: 0,
        cobrado: 0,
        pendiente: 0,
        tienda: 0,
        ruta: 0,
        fiadoRuta: 0,
        facturasPendientes: 0,
        sinTelefono: 0,
      }
    );
  }, [ventasFiltradas]);

  return (
    <AdminGuard>
      <AdminShell
        title="Ventas"
        subtitle="Lectura comercial separada por tienda, ruta, cobrado, pendiente y fiado."
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card">
            <p>Ventas visibles</p>
            <h2>{resumen.ventas}</h2>
          </article>
          <article className="admin-card">
            <p>Total bruto</p>
            <h2>{money.format(resumen.bruto)}</h2>
          </article>
          <article className="admin-card">
            <p>Cobrado confirmado</p>
            <h2>{money.format(resumen.cobrado)}</h2>
          </article>
          <article className="admin-card">
            <p>Pendiente / fiado</p>
            <h2>{money.format(resumen.pendiente)}</h2>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card">
            <p>Tienda</p>
            <h2>{money.format(resumen.tienda)}</h2>
          </article>
          <article className="admin-card">
            <p>Ruta</p>
            <h2>{money.format(resumen.ruta)}</h2>
          </article>
          <article className="admin-card">
            <p>Fiado ruta</p>
            <h2>{money.format(resumen.fiadoRuta)}</h2>
          </article>
          <article className="admin-card">
            <p>Efectividad</p>
            <h2>
              {resumen.bruto > 0
                ? `${Math.round((resumen.cobrado / resumen.bruto) * 100)}%`
                : "0%"}
            </h2>
          </article>
          <article className="admin-card admin-stat-red">
            <p>Alertas venta</p>
            <h2>{resumen.facturasPendientes}</h2>
            <span>{resumen.sinTelefono} sin telefono.</span>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <div>
              <h2>Detalle comercial</h2>
              <p>Compara tienda, ruta, cobros, fiados y ventas pendientes.</p>
            </div>
            <div className="admin-toolbar-actions">
              <input
                className="admin-input-inline"
                placeholder="Buscar venta"
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
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="todas">Todo</option>
                <option value="tienda">Tienda</option>
                <option value="ruta">Ruta</option>
              </select>
              <select
                className="admin-select-inline"
                value={periodFilter}
                onChange={(event) => setPeriodFilter(event.target.value)}
              >
                <option value="todas">Todas las fechas</option>
                <option value="hoy">Solo hoy</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p>Cargando ventas...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Origen</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Cobrado</th>
                  <th>Pendiente / fiado</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((factura) => {
                  const total = Number(factura.total) || 0;
                  const cobrado =
                    factura.source === "ruta"
                      ? Number(factura.cobrado) || 0
                      : ["pagado", "enviado", "entregado"].includes(factura.estado)
                        ? total
                        : 0;
                  const pendiente =
                    factura.source === "ruta"
                      ? Number(factura.fiadoHoy) || 0
                      : factura.estado === "pendiente"
                        ? total
                        : 0;

                  return (
                    <tr key={factura.id}>
                      <td>{factura.numero || factura.id}</td>
                      <td>
                        <span className="admin-pill">
                          {factura.source === "ruta" ? "Ruta" : "Tienda"}
                        </span>
                      </td>
                      <td>{factura.fecha || "Sin fecha"}</td>
                      <td>
                        <strong>
                          {factura.cliente?.nombre || factura.clienteNombre || "Cliente"}
                        </strong>
                        <small>
                          {factura.source === "ruta"
                            ? factura.ruta || "Sin ruta"
                            : factura.clienteTelefono || "Sin telefono"}
                        </small>
                      </td>
                      <td>{money.format(total)}</td>
                      <td>{money.format(cobrado)}</td>
                      <td>{money.format(pendiente)}</td>
                      <td>
                        <span className="admin-pill">
                          {factura.estado || "pendiente"}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="admin-button secondary"
                          href={`/admin/facturas/${factura.id}`}
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!ventasFiltradas.length && (
                  <tr>
                    <td colSpan="9">No hay ventas con esos filtros.</td>
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

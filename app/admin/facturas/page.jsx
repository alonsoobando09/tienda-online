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

export default function FacturasPage() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("todas");
  const [stateFilter, setStateFilter] = useState("todos");
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

  const facturasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();

    return facturas.filter((factura) => {
      const fecha = factura.fecha || "";

      if (sourceFilter !== "todas" && factura.source !== sourceFilter) return false;
      if (stateFilter !== "todos" && (factura.estado || "pendiente") !== stateFilter) {
        return false;
      }
      if (dateFrom && fecha && fecha < dateFrom) return false;
      if (dateTo && fecha && fecha > dateTo) return false;
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
  }, [dateFrom, dateTo, facturas, search, sourceFilter, stateFilter]);

  const resumen = useMemo(() => {
    return facturasFiltradas.reduce(
      (acc, factura) => {
        const total = Number(factura.total) || 0;
        const cobrado = Number(factura.cobrado) || 0;
        const fiado = Number(factura.fiadoHoy) || 0;
        const deudaFinal = Number(factura.deudaFinal) || 0;
        const telefono =
          factura.clienteTelefono || factura.cliente?.telefono || factura.telefono || "";

        acc.facturas += 1;
        acc.total += total;
        acc.cobrado += factura.source === "ruta" ? cobrado : total;
        acc.fiado += fiado;
        if (factura.source === "ruta") acc.deudaFinalRuta += deudaFinal;
        if (factura.source === "ruta") acc.ruta += 1;
        if (factura.source === "tienda") acc.tienda += 1;
        if (!telefono) acc.sinTelefono += 1;
        return acc;
      },
      {
        facturas: 0,
        total: 0,
        cobrado: 0,
        fiado: 0,
        deudaFinalRuta: 0,
        ruta: 0,
        tienda: 0,
        sinTelefono: 0,
      }
    );
  }, [facturasFiltradas]);

  return (
    <AdminGuard>
      <AdminShell
        title="Facturas"
        subtitle="Historial de recibos de tienda, ruta, cartera y ventas del dia."
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card">
            <p>Facturas visibles</p>
            <h2>{resumen.facturas}</h2>
            <span>
              {resumen.tienda} tienda / {resumen.ruta} ruta
            </span>
          </article>
          <article className="admin-card">
            <p>Total facturado</p>
            <h2>{money.format(resumen.total)}</h2>
          </article>
          <article className="admin-card">
            <p>Cobrado registrado</p>
            <h2>{money.format(resumen.cobrado)}</h2>
          </article>
          <article className="admin-card">
            <p>Fiado en ruta</p>
            <h2>{money.format(resumen.fiado)}</h2>
          </article>
          <article className="admin-card admin-stat-red">
            <p>Deuda final ruta</p>
            <h2>{money.format(resumen.deudaFinalRuta)}</h2>
            <span>{resumen.sinTelefono} facturas sin telefono.</span>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <div>
              <h2>Control de facturas</h2>
              <p>Busca por cliente, telefono, ruta, carterista o numero.</p>
            </div>
            <div className="admin-toolbar-actions">
              <input
                aria-label="Buscar factura"
                className="admin-input-inline"
                placeholder="Buscar factura"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <input
                aria-label="Fecha inicial"
                className="admin-input-inline"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <input
                aria-label="Fecha final"
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
                <option value="todas">Todos los origenes</option>
                <option value="tienda">Tienda</option>
                <option value="ruta">Ruta</option>
              </select>
              <select
                className="admin-select-inline"
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="guardada">Guardada</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
                <option value="enviado">Enviado</option>
                <option value="entregado">Entregado</option>
                <option value="liquidada">Liquidada</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p>Cargando facturas...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Origen</th>
                  <th>Cliente</th>
                  <th>Ruta</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Cobrado / fiado</th>
                  <th>Deuda final</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.map((factura) => (
                  <tr key={factura.id}>
                    <td>{factura.numero || factura.id}</td>
                    <td>
                      <span className="admin-pill">
                        {factura.source === "ruta" ? "Ruta" : "Tienda"}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {factura.cliente?.nombre || factura.clienteNombre || "Cliente"}
                      </strong>
                      <small>{factura.clienteTelefono || "Sin telefono"}</small>
                    </td>
                    <td>
                      {factura.source === "ruta" ? (
                        <>
                          {factura.ruta || "Sin ruta"}
                          <small>{factura.carteristaNombre || "Sin carterista"}</small>
                        </>
                      ) : (
                        "Tienda"
                      )}
                    </td>
                    <td>{factura.productosCount || factura.productos?.length || 0}</td>
                    <td>{money.format(factura.total || 0)}</td>
                    <td>
                      {factura.source === "ruta" ? (
                        <>
                          {money.format(factura.cobrado || 0)}
                          <small>Fiado {money.format(factura.fiadoHoy || 0)}</small>
                        </>
                      ) : (
                        factura.tipoPago || "Checkout"
                      )}
                    </td>
                    <td>
                      {factura.source === "ruta"
                        ? money.format(factura.deudaFinal || 0)
                        : "-"}
                    </td>
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
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
                {!facturasFiltradas.length && (
                  <tr>
                    <td colSpan="10">No hay facturas con esos filtros.</td>
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

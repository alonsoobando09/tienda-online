"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function ContabilidadPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/contabilidad")
      .then((res) => res.json())
      .then((result) => {
        if (active) setData(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminGuard>
      <AdminShell
        title="Contable"
        subtitle="Resumen de ingresos, cartera, ventas brutas e impuestos estimados."
      >
        {loading && <div className="admin-card">Cargando contabilidad...</div>}

        {data && (
          <div className="admin-grid">
            <section className="admin-grid admin-kpis">
              <article className="admin-card">
                <p>Ingresos confirmados</p>
                <h2>{money.format(data.ingresos || 0)}</h2>
              </article>
              <article className="admin-card">
                <p>Cuentas por cobrar</p>
                <h2>{money.format(data.cuentasPorCobrar || 0)}</h2>
              </article>
              <article className="admin-card">
                <p>Ventas brutas</p>
                <h2>{money.format(data.ventasBrutas || 0)}</h2>
              </article>
              <article className="admin-card">
                <p>IVA estimado</p>
                <h2>{money.format(data.impuestosEstimados || 0)}</h2>
              </article>
            </section>

            <section className="admin-card">
              <h2>Últimos movimientos</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ultimosMovimientos.map((factura) => (
                    <tr key={factura.id}>
                      <td>{factura.numero || factura.id}</td>
                      <td>{factura.cliente?.nombre || "Cliente"}</td>
                      <td>{money.format(factura.total || 0)}</td>
                      <td>
                        <span className="admin-pill">
                          {factura.estado || "pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

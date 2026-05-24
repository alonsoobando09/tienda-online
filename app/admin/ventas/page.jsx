"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function VentasPage() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/facturas")
      .then((res) => res.json())
      .then((data) => {
        if (active) setFacturas(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const resumen = useMemo(() => {
    return facturas.reduce(
      (acc, factura) => {
        const total = Number(factura.total) || 0;
        acc.ventas += 1;
        acc.total += total;
        if (factura.estado === "pendiente") acc.pendiente += total;
        if (["pagado", "entregado"].includes(factura.estado)) {
          acc.confirmado += total;
        }
        return acc;
      },
      { ventas: 0, total: 0, pendiente: 0, confirmado: 0 }
    );
  }, [facturas]);

  return (
    <AdminGuard>
      <AdminShell
        title="Ventas"
        subtitle="Lectura comercial de facturas, pagos confirmados y pendientes."
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card">
            <p>Ventas</p>
            <h2>{resumen.ventas}</h2>
          </article>
          <article className="admin-card">
            <p>Total bruto</p>
            <h2>{money.format(resumen.total)}</h2>
          </article>
          <article className="admin-card">
            <p>Confirmado</p>
            <h2>{money.format(resumen.confirmado)}</h2>
          </article>
          <article className="admin-card">
            <p>Pendiente</p>
            <h2>{money.format(resumen.pendiente)}</h2>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          {loading ? (
            <p>Cargando ventas...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Tipo de pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((factura) => (
                  <tr key={factura.id}>
                    <td>{factura.numero || factura.id}</td>
                    <td>{factura.cliente?.nombre || "Cliente"}</td>
                    <td>{money.format(factura.total || 0)}</td>
                    <td>{factura.tipoPago || "Sin definir"}</td>
                    <td>
                      <span className="admin-pill">
                        {factura.estado || "pendiente"}
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

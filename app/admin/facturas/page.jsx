"use client";

import { useEffect, useState } from "react";
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

  return (
    <AdminGuard>
      <AdminShell
        title="Facturas"
        subtitle="Historial de documentos generados desde checkout y ventas."
      >
        <section className="admin-card">
          {loading ? (
            <p>Cargando facturas...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((factura) => (
                  <tr key={factura.id}>
                    <td>{factura.numero || factura.id}</td>
                    <td>{factura.cliente?.nombre || "Cliente"}</td>
                    <td>{money.format(factura.total || 0)}</td>
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
              </tbody>
            </table>
          )}
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

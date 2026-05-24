"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

const estados = ["pendiente", "pagado", "enviado", "entregado", "cancelado"];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function FacturaDetalle() {
  const { id } = useParams();
  const [factura, setFactura] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!id) return;

    fetch(`/api/admin/facturas/${id}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (active && data) setFactura(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function cambiarEstado(estado) {
    await fetch(`/api/admin/facturas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });

    setFactura((current) => ({ ...current, estado }));
  }

  return (
    <AdminGuard>
      <AdminShell
        title={factura?.numero || "Detalle de factura"}
        subtitle="Detalle del cliente, productos, pago y estado operativo."
      >
        {loading && <div className="admin-card">Cargando factura...</div>}
        {!loading && !factura && (
          <div className="admin-card">Factura no encontrada.</div>
        )}

        {factura && (
          <div className="admin-grid">
            <section className="admin-card">
              <h2>Cliente</h2>
              <p>
                <strong>{factura.cliente?.nombre || "Cliente"}</strong>
              </p>
              <p>Teléfono: {factura.cliente?.telefono || "Sin teléfono"}</p>
              <p>Dirección: {factura.cliente?.direccion || "Sin dirección"}</p>
              <p>Ciudad: {factura.cliente?.ciudad || "Sin ciudad"}</p>
            </section>

            <section className="admin-card">
              <h2>Estado</h2>
              <select
                value={factura.estado || "pendiente"}
                onChange={(e) => cambiarEstado(e.target.value)}
              >
                {estados.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
              <p>Total: {money.format(factura.total || 0)}</p>
              <p>Tipo de pago: {factura.tipoPago || "Sin definir"}</p>
            </section>

            <section className="admin-card">
              <h2>Productos</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(factura.productos || []).map((producto) => (
                    <tr key={`${producto.id}-${producto.nombre}`}>
                      <td>{producto.nombre}</td>
                      <td>{producto.cantidad}</td>
                      <td>{money.format(producto.precio || 0)}</td>
                      <td>{money.format(producto.total || 0)}</td>
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

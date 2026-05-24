"use client";

import { useEffect, useState } from "react";
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

  async function cargarPedidos() {
    setLoading(true);
    const res = await fetch("/api/admin/facturas");
    const data = await res.json();
    setPedidos(data);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    fetch("/api/admin/facturas")
      .then((res) => res.json())
      .then((data) => {
        if (active) setPedidos(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
        subtitle="Seguimiento operativo de pedidos: pago, despacho y entrega."
      >
        <section className="admin-card">
          {loading ? (
            <p>Cargando pedidos...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>{pedido.numero || pedido.id}</td>
                    <td>
                      <strong>{pedido.cliente?.nombre || "Cliente"}</strong>
                      <br />
                      <small>{pedido.cliente?.telefono || "Sin teléfono"}</small>
                    </td>
                    <td>{money.format(pedido.total || 0)}</td>
                    <td>{pedido.tipoPago || "pendiente"}</td>
                    <td>
                      <select
                        value={pedido.estado || "pendiente"}
                        onChange={(e) => cambiarEstado(pedido.id, e.target.value)}
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
              </tbody>
            </table>
          )}
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import {
  AlertTriangle,
  DollarSign,
  FileText,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el dashboard");
        return res.json();
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = data
    ? [
        {
          title: "Ventas hoy",
          value: data.ventasHoy,
          icon: ShoppingCart,
        },
        {
          title: "Ingresos hoy",
          value: money.format(data.ingresosHoy || 0),
          icon: DollarSign,
        },
        {
          title: "Clientes",
          value: data.clientes,
          icon: Users,
        },
        {
          title: "Pendientes",
          value: data.pagosPendientes,
          icon: FileText,
        },
      ]
    : [];

  return (
    <AdminGuard>
      <AdminShell
        title="Dashboard"
        subtitle="Control diario de ventas, pedidos, inventario y caja."
        actions={
          <>
            <Link className="admin-button secondary" href="/admin/productos">
              Gestionar productos
            </Link>
            <Link className="admin-button" href="/admin/pedidos">
              Ver pedidos
            </Link>
          </>
        }
      >
        {loading && <div className="admin-card">Cargando dashboard...</div>}
        {error && <div className="admin-card">{error}</div>}

        {data && (
          <div className="admin-grid">
            <section className="admin-grid admin-kpis">
              {cards.map((card) => {
                const Icon = card.icon;

                return (
                  <article className="admin-card" key={card.title}>
                    <Icon size={22} />
                    <p>{card.title}</p>
                    <h2>{card.value}</h2>
                  </article>
                );
              })}
            </section>

            <section className="admin-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <article className="admin-card">
                <h2>Ventas últimos 7 días</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.grafico}>
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip formatter={(value) => money.format(value)} />
                    <Line
                      type="monotone"
                      dataKey="ventas"
                      stroke="#1b4332"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </article>

              <article className="admin-card">
                <Package size={22} />
                <h2>Inventario</h2>
                <p>Total productos: {data.totalProductos}</p>
                <p>Unidades en stock: {data.totalStock}</p>
                <p>Valor estimado: {money.format(data.valorInventario || 0)}</p>
                <p>Ticket promedio: {money.format(data.ticketPromedio || 0)}</p>
              </article>
            </section>

            <section className="admin-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <article className="admin-card">
                <h2>Pedidos recientes</h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ultimasVentas.map((venta) => (
                      <tr key={venta.id}>
                        <td>{venta.numero || venta.id}</td>
                        <td>{venta.cliente?.nombre || "Cliente"}</td>
                        <td>{money.format(venta.total || 0)}</td>
                        <td>
                          <span className="admin-pill">
                            {venta.estado || "pendiente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="admin-card">
                <h2>
                  <AlertTriangle size={20} /> Bajo stock
                </h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bajoStock.map((producto) => (
                      <tr key={producto.id}>
                        <td>{producto.nombre}</td>
                        <td>{producto.stock || 0}</td>
                      </tr>
                    ))}
                    {data.bajoStock.length === 0 && (
                      <tr>
                        <td colSpan="2">Sin alertas de inventario.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </article>
            </section>
          </div>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

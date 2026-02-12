"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import { Users, DollarSign, ShoppingCart, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminPanel() {
  const [stats, setStats] = useState({
    ventasHoy: 0,
    ingresosHoy: 0,
    clientes: 0,
    pagosPendientes: 0,
  });

  const [ventas, setVentas] = useState([]);

  /* ===============================
     CARGA DATA (SIMULADA)
  =============================== */
  useEffect(() => {
    setStats({
      ventasHoy: 32,
      ingresosHoy: 1850000,
      clientes: 120,
      pagosPendientes: 8,
    });

    setVentas([
      {
        id: 1,
        cliente: "Juan Pérez",
        total: 85000,
        estado: "Pagado",
      },
      {
        id: 2,
        cliente: "María Gómez",
        total: 120000,
        estado: "Pendiente",
      },
    ]);
  }, []);

  /* ===============================
     CARDS INFO
  =============================== */
  const cards = [
    {
      title: "Ventas Hoy",
      value: stats.ventasHoy,
      icon: ShoppingCart,
    },
    {
      title: "Ingresos Hoy",
      value: `$${stats.ingresosHoy.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: "Clientes",
      value: stats.clientes,
      icon: Users,
    },
    {
      title: "Pagos Pendientes",
      value: stats.pagosPendientes,
      icon: FileText,
    },
  ];

  return (
    <AdminGuard>
      <div style={{ padding: 30, fontFamily: "Arial" }}>
        {/* ================= HEADER ================= */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: "bold" }}>
            📊 Panel Admin
          </h1>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnDark}>Generar PDF</button>
            <button style={btnOutline}>Cerrar sesión</button>
          </div>
        </div>

        {/* ================= STATS ================= */}
        <div style={gridCards}>
          {cards.map((card, i) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                style={cardBox}
              >
                <div>
                  <p style={{ fontSize: 13, color: "#666" }}>
                    {card.title}
                  </p>
                  <p style={{ fontSize: 22, fontWeight: "bold" }}>
                    {card.value}
                  </p>
                </div>

                <Icon size={32} opacity={0.7} />
              </motion.div>
            );
          })}
        </div>

        {/* ================= TABLA ================= */}
        <div style={tableCard}>
          <h2 style={{ marginBottom: 20 }}>
            🧾 Ventas recientes
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>{v.cliente}</td>
                    <td>
                      ${v.total.toLocaleString()}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          background:
                            v.estado === "Pagado"
                              ? "#d1fae5"
                              : "#fef3c7",
                        }}
                      >
                        {v.estado}
                      </span>
                    </td>

                    <td>
                      <button style={btnOutline}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

/* ===============================
   ESTILOS
=============================== */

const gridCards = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 20,
  marginBottom: 30,
};

const cardBox = {
  background: "#fff",
  padding: 20,
  borderRadius: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const tableCard = {
  background: "#fff",
  padding: 20,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const btnDark = {
  background: "#111",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
};

const btnOutline = {
  background: "transparent",
  border: "1px solid #ccc",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

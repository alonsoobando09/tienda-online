"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";

export default function VentasPage() {
  const [ventas, setVentas] = useState([]);

  /* =========================
  SIMULAR CARGA VENTAS
  ========================= */
  useEffect(() => {
    // Luego aquí conectamos Firebase / Supabase
    setVentas([
      {
        id: 1,
        cliente: "Juan Pérez",
        total: 85000,
        fecha: "2026-02-09",
      },
      {
        id: 2,
        cliente: "María Gómez",
        total: 120000,
        fecha: "2026-02-10",
      },
    ]);
  }, []);

  /* =========================
  TOTALES
  ========================= */
  const totalHoy = ventas
    .filter((v) => v.fecha === "2026-02-10")
    .reduce((acc, v) => acc + v.total, 0);

  const totalMes = ventas.reduce(
    (acc, v) => acc + v.total,
    0
  );

  /* =========================
  UI
  ========================= */
  return (
    <AdminGuard>
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1>📈 Panel de Ventas</h1>

        {/* RESUMEN */}
        <div
          style={{
            display: "flex",
            gap: 30,
            marginBottom: 30,
          }}
        >
          <div style={card}>
            <h3>Ventas hoy</h3>
            <p>${totalHoy.toLocaleString()}</p>
          </div>

          <div style={card}>
            <h3>Ventas del mes</h3>
            <p>${totalMes.toLocaleString()}</p>
          </div>
        </div>

        {/* TABLA */}
        <h2>🧾 Últimas ventas</h2>

        <table style={table}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Total</th>
              <th>Fecha</th>
            </tr>
          </thead>

          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td>{v.cliente}</td>
                <td>${v.total.toLocaleString()}</td>
                <td>{v.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </AdminGuard>
  );
}

/* ================= ESTILOS ================= */

const card = {
  background: "#fff",
  padding: 20,
  borderRadius: 10,
  minWidth: 200,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 20,
};
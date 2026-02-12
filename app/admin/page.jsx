"use client";

/* ======================================================
   IMPORTS
====================================================== */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  DollarSign,
  ShoppingCart,
  FileText,
  Package,
} from "lucide-react";
import { motion } from "framer-motion";

/* ======================================================
   PRODUCTOS DEMO (Luego BD)
====================================================== */
const productosDemo = [
  {
    id: 1,
    nombre: "Carne de Res",
    precioDetal: 28000,
    precioMayor: 25000,
    categoria: "carnicos",
    stock: 25,
  },
  {
    id: 2,
    nombre: "Queso de Mano",
    precioDetal: 12000,
    precioMayor: 10000,
    categoria: "lacteos",
    stock: 40,
  },
];

/* ======================================================
   COMPONENTE
====================================================== */
export default function AdminPage() {
  /* ===============================
     STATES DASHBOARD
  =============================== */
  const [stats, setStats] = useState({
    ventasHoy: 0,
    ingresosHoy: 0,
    clientes: 0,
    pagosPendientes: 0,
  });

  const [ventas, setVentas] = useState([]);

  /* ===============================
     KPIs PRODUCTOS
  =============================== */
  const totalProductos = productosDemo.length;

  const totalStock = productosDemo.reduce(
    (acc, p) => acc + p.stock,
    0
  );

  /* ===============================
     DATA DEMO DASHBOARD
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
     CARDS DASHBOARD
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

  /* ===============================
     UI
  =============================== */
  return (
    <main style={container}>
      {/* ================= HEADER ================= */}
      <h1 style={title}>
        🧑‍💼 Panel Administrador
      </h1>

      {/* ================= DASHBOARD STATS ================= */}
      <div style={statsGrid}>
        {cards.map((card, i) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={cardStat}>
                <p>{card.title}</p>
                <h2>{card.value}</h2>
                <Icon size={28} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ================= KPIs PRODUCTOS ================= */}
      <div style={gridKPI}>
        <div style={cardKPI}>
          <Package />
          <h3>Productos</h3>
          <p>{totalProductos}</p>
        </div>

        <div style={cardKPI}>
          <h3>Stock total</h3>
          <p>{totalStock}</p>
        </div>

        <div style={cardKPI}>
          <h3>Categorías</h3>
          <p>2</p>
        </div>
      </div>

      {/* ================= BOTÓN ================= */}
      <Link href="/admin/productos/nuevo">
        <button style={btnNuevo}>
          ➕ Crear producto
        </button>
      </Link>

      {/* ================= LISTADO PRODUCTOS ================= */}
      <div style={{ marginTop: 30 }}>
        {productosDemo.map((p) => (
          <div key={p.id} style={cardProducto}>
            {/* INFO */}
            <div>
              <strong style={{ fontSize: 18 }}>
                {p.nombre}
              </strong>

              <p>
                💲 Detal: $
                {p.precioDetal.toLocaleString()}
              </p>

              <p>
                🏷️ Mayor: $
                {p.precioMayor.toLocaleString()}
              </p>

              <p>📦 Stock: {p.stock}</p>

              <small>
                Categoría: {p.categoria}
              </small>
            </div>

            {/* ACCIONES */}
            <div style={acciones}>
              <Link
                href={`/admin/productos/editar/${p.id}`}
              >
                <button style={btnEditar}>
                  ✏️ Editar
                </button>
              </Link>

              <button style={btnEliminar}>
                🗑️ Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ================= TABLA VENTAS ================= */}
      <table style={table}>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Total</th>
            <th>Estado</th>
          </tr>
        </thead>

        <tbody>
          {ventas.map((v) => (
            <tr key={v.id}>
              <td>{v.cliente}</td>
              <td>${v.total.toLocaleString()}</td>
              <td>{v.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

/* ======================================================
   ESTILOS
====================================================== */

const container = {
  padding: 40,
  fontFamily: "Arial",
};

const title = {
  marginBottom: 30,
  fontSize: 28,
  fontWeight: "bold",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(200px,1fr))",
  gap: 20,
  marginBottom: 30,
};

const cardStat = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 20,
  background: "#fff",
};

const gridKPI = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(200px,1fr))",
  gap: 20,
  marginBottom: 30,
};

const cardKPI = {
  background: "#111",
  color: "white",
  padding: 20,
  borderRadius: 12,
};

const btnNuevo = {
  padding: 14,
  background: "#16a34a",
  color: "white",
  borderRadius: 10,
  border: "none",
  fontWeight: "bold",
};

const cardProducto = {
  border: "1px solid #eee",
  padding: 20,
  borderRadius: 12,
  marginBottom: 15,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "white",
};

const acciones = {
  display: "flex",
  gap: 10,
};

const btnEditar = {
  padding: 10,
  background: "#2563eb",
  color: "white",
  borderRadius: 8,
  border: "none",
};

const btnEliminar = {
  padding: 10,
  background: "#dc2626",
  color: "white",
  borderRadius: 8,
  border: "none",
};

const table = {
  width: "100%",
  marginTop: 40,
  borderCollapse: "collapse",
};


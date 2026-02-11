"use client";

import Link from "next/link";

/* ===============================
PRODUCTOS DEMO (luego BD)
=============================== */

const productos = [
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

/* ===============================
COMPONENTE
=============================== */

export default function AdminPage() {
  /* KPIs */
  const totalProductos = productos.length;

  const totalStock = productos.reduce(
    (acc, p) => acc + p.stock,
    0
  );

  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
      
      {/* ================= HEADER ================= */}
      <h1 style={{ marginBottom: 30 }}>
        🧑‍💼 Panel Administrador
      </h1>

      {/* ================= KPIs ================= */}
      <div style={gridKPI}>
        <div style={cardKPI}>
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
      <Link href="/admin/nuevo">
        <button style={btnNuevo}>
          ➕ Crear producto
        </button>
      </Link>

      {/* ================= TABLA ================= */}
      <div style={{ marginTop: 30 }}>
        {productos.map((p) => (
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
                href={`/admin/editar/${p.id}`}
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
    </main>
  );
}

/* ===============================
ESTILOS
=============================== */

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

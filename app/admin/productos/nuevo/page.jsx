"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/app/components/AdminGuard";

export default function NuevoProducto() {
  const router = useRouter();

  const [form, setForm] = useState({
    nombre: "",
    precioDetal: "",
    precioMayor: "",
  });

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function guardar() {
    alert("Producto creado ✅");

    router.push("/admin/productos");
  }

  return (
    <AdminGuard>
      <main style={{ padding: 40 }}>
        <h1>➕ Nuevo Producto</h1>

        <div style={grid}>
          <input
            name="nombre"
            placeholder="Nombre"
            onChange={handleChange}
            style={input}
          />

          <input
            name="precioDetal"
            placeholder="Precio detal"
            onChange={handleChange}
            style={input}
          />

          <input
            name="precioMayor"
            placeholder="Precio mayorista"
            onChange={handleChange}
            style={input}
          />

          <button
            onClick={guardar}
            style={btn}
          >
            Guardar
          </button>
        </div>
      </main>
    </AdminGuard>
  );
}

/* ESTILOS */

const grid = {
  display: "grid",
  gap: 15,
  maxWidth: 400,
};

const input = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid #ccc",
};

const btn = {
  padding: 12,
  background: "#111",
  color: "#fff",
  borderRadius: 8,
};

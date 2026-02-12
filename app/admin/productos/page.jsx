"use client";

/* ======================================================
IMPORTS COMPLETOS
====================================================== */
import { useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import { Package, PlusCircle, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

/* ======================================================
COMPONENTE
====================================================== */
export default function AdminProductosPage() {
/* ===============================
STATE PRODUCTOS
=============================== */
const [productos, setProductos] = useState([
{
id: 1,
nombre: "Queso de Mano",
precioDetal: 12000,
precioMayor: 10000,
activo: true,
},
{
id: 2,
nombre: "Carne de Res",
precioDetal: 28000,
precioMayor: 25000,
activo: true,
},
{
id: 3,
nombre: "Alonso",
precioDetal: 28000,
precioMayor: 25000,
activo: true,
},
]);

/* ===============================
TOGGLE ACTIVO
=============================== */
function toggleActivo(id) {
setProductos((prev) =>
prev.map((p) =>
p.id === id ? { ...p, activo: !p.activo } : p
)
);
}

/* ===============================
ELIMINAR PRODUCTO
=============================== */
function eliminarProducto(id) {
if (!confirm("¿Eliminar producto?")) return;

```
setProductos((prev) =>
  prev.filter((p) => p.id !== id)
);
```

}

/* ===============================
UI
=============================== */
return ( <AdminGuard> <div style={container}>
{/* ================= HEADER ================= */} <div style={header}> <div style={headerTitle}> <Package /> <h1 style={title}>Gestión de Productos</h1> </div>

```
      <Link href="/admin/productos/nuevo">
        <button style={btnDark}>
          <PlusCircle size={18} /> Crear producto
        </button>
      </Link>
    </div>

    {/* ================= LISTADO ================= */}
    <div style={gridCards}>
      {productos.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          style={cardBox}
        >
          {/* INFO */}
          <div>
            <h3 style={{ marginBottom: 5 }}>{p.nombre}</h3>

            <p style={price}>
              Detal: ${p.precioDetal.toLocaleString()}
            </p>

            <p style={price}>
              Mayorista: ${p.precioMayor.toLocaleString()}
            </p>

            <span
              style={{
                ...estado,
                background: p.activo
                  ? "#d1fae5"
                  : "#fee2e2",
                color: p.activo
                  ? "#065f46"
                  : "#7f1d1d",
              }}
            >
              {p.activo ? "🟢 Activo" : "🔴 Inactivo"}
            </span>
          </div>

          {/* ACCIONES */}
          <div style={acciones}>
            <Link href={`/admin/productos/editar/${p.id}`}>
              <button style={btnOutline}>
                <Pencil size={16} />
              </button>
            </Link>

            <button
              onClick={() => toggleActivo(p.id)}
              style={btnOutline}
            >
              {p.activo ? "Desactivar" : "Activar"}
            </button>

            <button
              onClick={() => eliminarProducto(p.id)}
              style={btnDanger}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
</AdminGuard>


);
}

/* ======================================================
ESTILOS
====================================================== */

const container = {
padding: 30,
fontFamily: "Arial",
};

const header = {
display: "flex",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 30,
};

const headerTitle = {
display: "flex",
gap: 10,
alignItems: "center",
};

const title = {
fontSize: 28,
fontWeight: "bold",
};

const gridCards = {
display: "grid",
gridTemplateColumns:
"repeat(auto-fit, minmax(260px, 1fr))",
gap: 20,
};

const cardBox = {
background: "#fff",
padding: 20,
borderRadius: 14,
display: "flex",
justifyContent: "space-between",
alignItems: "center",
boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const acciones = {
display: "flex",
gap: 8,
alignItems: "center",
};

const price = {
fontSize: 14,
marginBottom: 4,
};

const estado = {
padding: "4px 8px",
borderRadius: 6,
fontSize: 12,
fontWeight: "bold",
};

const btnDark = {
background: "#111",
color: "#fff",
padding: "10px 14px",
borderRadius: 8,
border: "none",
cursor: "pointer",
display: "flex",
gap: 6,
alignItems: "center",
};

const btnOutline = {
background: "transparent",
border: "1px solid #ccc",
padding: "8px 10px",
borderRadius: 8,
cursor: "pointer",
display: "flex",
alignItems: "center",
gap: 4,
};

const btnDanger = {
...btnOutline,
border: "1px solid #ef4444",
color: "#ef4444",
};

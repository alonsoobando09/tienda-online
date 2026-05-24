"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

export default function EditarProductoPage() {
  const { id } = useParams();
  const router = useRouter();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function cargarProducto() {
      try {
        const res = await fetch(`/api/productos/${id}`);
        if (!res.ok) throw new Error("Error al cargar producto");
        const data = await res.json();
        if (active) setProducto(data);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) cargarProducto();

    return () => {
      active = false;
    };
  }, [id]);

  function updateField(field, value) {
    setProducto((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch(`/api/productos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(producto),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Error al actualizar");
      return;
    }

    router.push("/admin/productos");
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Editar producto"
        subtitle="Actualiza precios, stock, imagen y datos comerciales."
      >
        {loading && <div className="admin-card">Cargando producto...</div>}
        {!loading && !producto && (
          <div className="admin-card">Producto no encontrado</div>
        )}

        {producto && (
          <section className="admin-card">
            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Nombre
                <input
                  value={producto.nombre || ""}
                  onChange={(e) => updateField("nombre", e.target.value)}
                  required
                />
              </label>

              <label>
                Categoría
                <input
                  value={producto.categoria || ""}
                  onChange={(e) => updateField("categoria", e.target.value)}
                />
              </label>

              <label>
                SKU
                <input
                  value={producto.sku || ""}
                  onChange={(e) => updateField("sku", e.target.value)}
                />
              </label>

              <label>
                Proveedor
                <input
                  value={producto.proveedor || ""}
                  onChange={(e) => updateField("proveedor", e.target.value)}
                />
              </label>

              <label>
                Costo
                <input
                  type="number"
                  value={producto.costo ?? ""}
                  onChange={(e) => updateField("costo", e.target.value)}
                />
              </label>

              <label>
                Precio mayor
                <input
                  type="number"
                  value={producto.precioMayor ?? ""}
                  onChange={(e) => updateField("precioMayor", e.target.value)}
                />
              </label>

              <label>
                Precio detal
                <input
                  type="number"
                  value={producto.precioDetal ?? ""}
                  onChange={(e) => updateField("precioDetal", e.target.value)}
                />
              </label>

              <label>
                Stock
                <input
                  type="number"
                  value={producto.stock ?? ""}
                  onChange={(e) => updateField("stock", e.target.value)}
                />
              </label>

              <label>
                Stock mínimo
                <input
                  type="number"
                  value={producto.stockMinimo ?? ""}
                  onChange={(e) => updateField("stockMinimo", e.target.value)}
                />
              </label>

              <label>
                URL de imagen
                <input
                  value={producto.imagen || ""}
                  onChange={(e) => updateField("imagen", e.target.value)}
                />
              </label>

              <label>
                Activo
                <select
                  value={producto.activo === false ? "no" : "si"}
                  onChange={(e) => updateField("activo", e.target.value === "si")}
                >
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Descripción
                <textarea
                  rows="4"
                  value={producto.descripcion || ""}
                  onChange={(e) => updateField("descripcion", e.target.value)}
                />
              </label>

              <button className="admin-button" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </section>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

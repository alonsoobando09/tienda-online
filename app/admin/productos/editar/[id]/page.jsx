"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { categories } from "@/lib/categories";
import { storage } from "@/lib/firebase";
import { getSafeImageSrc } from "@/lib/images";
import { uploadImageWithFallback } from "@/lib/clientImages";

const imageSlots = [
  { field: "imagen", label: "Imagen principal" },
  { field: "gallery-0", label: "Imagen extra 1" },
  { field: "gallery-1", label: "Imagen extra 2" },
  { field: "gallery-2", label: "Imagen extra 3" },
];

export default function EditarProductoPage() {
  const { id } = useParams();
  const router = useRouter();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function cargarProducto() {
      try {
        const res = await fetch(`/api/productos/${id}`);
        if (!res.ok) throw new Error("Error al cargar producto");
        const data = await res.json();
        if (active) {
          setProducto({
            ...data,
            imagenes: Array.isArray(data.imagenes)
              ? [...data.imagenes, "", "", ""].slice(0, 3)
              : ["", "", ""],
          });
        }
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

  function updateGalleryImage(index, value) {
    setProducto((current) => {
      const imagenes = [...(current.imagenes || ["", "", ""])];
      imagenes[index] = value;
      return { ...current, imagenes };
    });
  }

  async function subirImagen(e, slot = "imagen") {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadMessage("");

      const result = await uploadImageWithFallback(storage, file);

      if (slot === "imagen") {
        updateField("imagen", result.url);
      } else {
        updateGalleryImage(Number(slot.replace("gallery-", "")), result.url);
      }

      setUploadMessage(`${result.message} Guarda los cambios para aplicarla.`);
    } catch (error) {
      setUploadMessage(
        error?.message || "No se pudo procesar la imagen. Intenta con otra imagen."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (uploading) {
      alert("Espera a que termine de subir la imagen antes de guardar.");
      return;
    }

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
                <select
                  value={producto.categoria || "carnicos"}
                  onChange={(e) => updateField("categoria", e.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.nombre}
                    </option>
                  ))}
                </select>
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
                Unidades por paca
                <input
                  type="number"
                  value={producto.unidadesPorPaca ?? ""}
                  onChange={(e) => updateField("unidadesPorPaca", e.target.value)}
                />
              </label>

              <label>
                Precio paca mayor
                <input
                  type="number"
                  value={producto.precioPacaMayor ?? ""}
                  onChange={(e) => updateField("precioPacaMayor", e.target.value)}
                />
              </label>

              <label>
                Precio paca detal
                <input
                  type="number"
                  value={producto.precioPacaDetal ?? ""}
                  onChange={(e) => updateField("precioPacaDetal", e.target.value)}
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

              <div className="admin-image-grid">
                {imageSlots.map((slot) => {
                  const galleryIndex = slot.field.startsWith("gallery-")
                    ? Number(slot.field.replace("gallery-", ""))
                    : -1;
                  const value =
                    slot.field === "imagen"
                      ? producto.imagen || ""
                      : producto.imagenes?.[galleryIndex] || "";

                  return (
                    <div className="admin-image-slot" key={slot.field}>
                      <label>
                        {slot.label}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => subirImagen(e, slot.field)}
                        />
                      </label>
                      <input
                        placeholder="https://..."
                        value={value}
                        onChange={(e) =>
                          slot.field === "imagen"
                            ? updateField("imagen", e.target.value)
                            : updateGalleryImage(galleryIndex, e.target.value)
                        }
                      />
                      {value && (
                        <div
                          aria-label={slot.label}
                          className="admin-thumb"
                          style={{
                            backgroundImage: `url("${getSafeImageSrc(value)}")`,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {uploadMessage && (
                <p className="admin-help" style={{ gridColumn: "1 / -1" }}>
                  {uploadMessage}
                </p>
              )}

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

              <button className="admin-button" disabled={saving || uploading}>
                {uploading
                  ? "Subiendo imagen..."
                  : saving
                    ? "Guardando..."
                    : "Guardar cambios"}
              </button>
            </form>
          </section>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

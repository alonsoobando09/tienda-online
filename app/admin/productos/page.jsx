"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db, storage } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { categories } from "@/lib/categories";
import { getSafeImageSrc } from "@/lib/images";

const emptyForm = {
  nombre: "",
  categoria: "carnicos",
  sku: "",
  proveedor: "",
  unidad: "unidad",
  imagen: "",
  descripcion: "",
  costo: "",
  precioMayor: "",
  precioDetal: "",
  stock: "",
  stockMinimo: "5",
  iva: "0",
  activo: true,
};

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function ProductosAdminPage() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [localPreview, setLocalPreview] = useState("");

  async function cargarProductos() {
    setLoading(true);
    const query = await getDocs(collection(db, "productos"));
    const data = query.docs.map((docu) => ({
      id: docu.id,
      ...docu.data(),
    }));
    setProductos(data);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    getDocs(collection(db, "productos"))
      .then((query) => {
        if (!active) return;
        const data = query.docs.map((docu) => ({
          id: docu.id,
          ...docu.data(),
        }));
        setProductos(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const productosFiltrados = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return productos;

    return productos.filter((producto) =>
      [producto.nombre, producto.categoria, producto.sku, producto.proveedor]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [filter, productos]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function subirImagen(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadMessage("");
      setUploading(true);
      setLocalPreview(URL.createObjectURL(file));

      const safeName = `${Date.now()}-${file.name.replaceAll(" ", "-")}`;
      const storageRef = ref(storage, `productos/${safeName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      updateField("imagen", url);
      setUploadMessage("Imagen subida correctamente. Ya puedes guardar el producto.");
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      setUploadMessage(
        "No se pudo subir la imagen. Puedes guardar el producto sin imagen o pegar una URL."
      );
    } finally {
      setUploading(false);
    }
  }

  async function crearProducto(e) {
    e.preventDefault();

    if (uploading) {
      alert("Espera a que termine de subir la imagen antes de guardar.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo crear el producto");
        return;
      }

      setForm(emptyForm);
      setUploadMessage("");
      setLocalPreview("");
      await cargarProductos();
    } catch (error) {
      console.error("Error guardando producto:", error);
      alert("No se pudo guardar el producto. Revisa la conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarProducto(id) {
    if (!confirm("¿Eliminar este producto?")) return;

    await deleteDoc(doc(db, "productos", id));
    await cargarProductos();
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Productos"
        subtitle="Crea productos con imagen, costos, precios, stock y datos para inventario."
        actions={
          <button className="admin-button secondary" onClick={cargarProductos}>
            Actualizar catálogo
          </button>
        }
      >
        <section className="admin-card admin-accent-card">
          <div className="admin-section-title">
            <div>
              <h2>Nuevo producto</h2>
              <p>Registra el producto con datos comerciales e inventario.</p>
            </div>
          </div>

          <form className="admin-form" onSubmit={crearProducto}>
            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                required
              />
            </label>

            <label>
              Categoría
              <select
                value={form.categoria}
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
                value={form.sku}
                onChange={(e) => updateField("sku", e.target.value)}
              />
            </label>

            <label>
              Proveedor
              <input
                value={form.proveedor}
                onChange={(e) => updateField("proveedor", e.target.value)}
              />
            </label>

            <label>
              Costo
              <input
                type="number"
                value={form.costo}
                onChange={(e) => updateField("costo", e.target.value)}
              />
            </label>

            <label>
              Precio mayor
              <input
                type="number"
                value={form.precioMayor}
                onChange={(e) => updateField("precioMayor", e.target.value)}
              />
            </label>

            <label>
              Precio detal
              <input
                type="number"
                value={form.precioDetal}
                onChange={(e) => updateField("precioDetal", e.target.value)}
              />
            </label>

            <label>
              Stock
              <input
                type="number"
                value={form.stock}
                onChange={(e) => updateField("stock", e.target.value)}
              />
            </label>

            <label>
              Stock mínimo
              <input
                type="number"
                value={form.stockMinimo}
                onChange={(e) => updateField("stockMinimo", e.target.value)}
              />
            </label>

            <label>
              Unidad
              <select
                value={form.unidad}
                onChange={(e) => updateField("unidad", e.target.value)}
              >
                <option value="unidad">Unidad</option>
                <option value="caja">Caja</option>
                <option value="paca">Paca</option>
                <option value="bulto">Bulto</option>
                <option value="kg">Kg</option>
              </select>
            </label>

            <label>
              IVA %
              <input
                type="number"
                value={form.iva}
                onChange={(e) => updateField("iva", e.target.value)}
              />
            </label>

            <label>
              Subir imagen
              <input type="file" accept="image/*" onChange={subirImagen} />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              URL de imagen
              <input
                placeholder="https://..."
                value={form.imagen}
                onChange={(e) => updateField("imagen", e.target.value)}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Descripción
              <textarea
                rows="3"
                value={form.descripcion}
                onChange={(e) => updateField("descripcion", e.target.value)}
              />
            </label>

            {form.imagen && (
              <div className="admin-image-preview">
                <div
                  aria-label={form.nombre || "Producto"}
                  style={{
                    width: 160,
                    height: 110,
                    borderRadius: 8,
                    backgroundImage: `url("${getSafeImageSrc(form.imagen)}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </div>
            )}

            {!form.imagen && localPreview && (
              <div className="admin-image-preview">
                <div
                  aria-label="Vista previa local"
                  style={{
                    width: 160,
                    height: 110,
                    borderRadius: 8,
                    backgroundImage: `url("${localPreview}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </div>
            )}

            {uploadMessage && (
              <p className="admin-help" style={{ gridColumn: "1 / -1" }}>
                {uploadMessage}
              </p>
            )}

            <button className="admin-button" disabled={saving || uploading}>
              {uploading ? <ImagePlus size={18} /> : <Save size={18} />}
              {uploading
                ? "Subiendo imagen..."
                : saving
                  ? "Guardando..."
                  : "Guardar producto"}
            </button>
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Catálogo</h2>
              <p>{productos.length} productos registrados</p>
            </div>
            <input
              placeholder="Buscar producto, categoría, SKU o proveedor"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </div>

          {loading ? (
            <p>Cargando productos...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precios</th>
                  <th>Stock</th>
                  <th>Proveedor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((producto) => (
                  <tr key={producto.id}>
                    <td>
                      <div
                        aria-label={producto.nombre || "Producto"}
                        style={{
                          width: 64,
                          height: 48,
                          borderRadius: 8,
                          backgroundImage: `url("${getSafeImageSrc(
                            producto.imagen
                          )}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    </td>
                    <td>
                      <strong>{producto.nombre}</strong>
                      <br />
                      <small>{producto.sku || "Sin SKU"}</small>
                    </td>
                    <td>
                      {categories.find((cat) => cat.slug === producto.categoria)
                        ?.nombre ||
                        producto.categoria ||
                        "Sin categoría"}
                    </td>
                    <td>
                      Mayor: {money.format(producto.precioMayor || 0)}
                      <br />
                      Detal: {money.format(producto.precioDetal || 0)}
                    </td>
                    <td>
                      <span className="admin-pill">{producto.stock || 0}</span>
                    </td>
                    <td>{producto.proveedor || "Sin proveedor"}</td>
                    <td className="admin-row-actions">
                      <Link
                        className="admin-button secondary"
                        href={`/admin/productos/editar/${producto.id}`}
                      >
                        Editar
                      </Link>
                      <button
                        className="admin-button danger"
                        onClick={() => eliminarProducto(producto.id)}
                      >
                        <Trash2 size={16} />
                      </button>
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

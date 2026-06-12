"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { FileUp, ImagePlus, Save, Trash2 } from "lucide-react";
import { categories } from "@/lib/categories";
import { getSafeImageSrc } from "@/lib/images";
import { uploadImageWithFallback } from "@/lib/clientImages";

const emptyForm = {
  nombre: "",
  categoria: "carnicos",
  sku: "",
  proveedor: "",
  unidad: "unidad",
  imagen: "",
  imagenes: ["", "", ""],
  descripcion: "",
  costo: "",
  precioMayor: "",
  precioDetal: "",
  precioPacaMayor: "",
  precioPacaDetal: "",
  unidadesPorPaca: "",
  stock: "",
  stockMinimo: "5",
  iva: "0",
  activo: true,
};

const imageSlots = [
  { field: "imagen", label: "Imagen principal" },
  { field: "gallery-0", label: "Imagen extra 1" },
  { field: "gallery-1", label: "Imagen extra 2" },
  { field: "gallery-2", label: "Imagen extra 3" },
];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCategorySlug(value) {
  const normalized = normalizeText(value).replace(/[^a-z0-9]/g, "");

  const match = categories.find((category) => {
    const byName = normalizeText(category.nombre).replace(/[^a-z0-9]/g, "");
    const bySlug = normalizeText(category.slug).replace(/[^a-z0-9]/g, "");
    return normalized === byName || normalized === bySlug;
  });

  return match?.slug || "carnicos";
}

function toNumber(value) {
  return Number(value) || 0;
}

function normalizeExcelProduct(row) {
  const nombre = String(row.name || row.nombre || row.producto || "").trim();
  const sku = String(row.sku || row.codigo || "").trim();
  const costo = toNumber(row.cost || row.costo);
  const precioMinimo = toNumber(row.min || row.precioMinimo || row.precio_minimo);
  const precioMaximo = toNumber(row.max || row.precioMaximo || row.precio_maximo);

  return {
    nombre,
    categoria: getCategorySlug(row.category || row.categoria),
    sku,
    proveedor: String(row.proveedor || "").trim(),
    unidad: "unidad",
    imagen: "",
    imagenes: [],
    descripcion: "",
    costo,
    precioMayor: precioMinimo,
    precioDetal: precioMinimo,
    precioMinimo,
    precioMaximo,
    precioPacaMayor: precioMaximo,
    precioPacaDetal: precioMaximo,
    unidadesPorPaca: 0,
    stock: toNumber(row.stock),
    stockMinimo: 5,
    iva: 0,
    activo: true,
  };
}

export default function ProductosAdminPage() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [localPreview, setLocalPreview] = useState("");
  const [localGalleryPreviews, setLocalGalleryPreviews] = useState(["", "", ""]);

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

  function updateGalleryImage(index, value) {
    setForm((current) => {
      const imagenes = [...(current.imagenes || ["", "", ""])];
      imagenes[index] = value;
      return { ...current, imagenes };
    });
  }

  async function subirImagen(e, slot = "imagen") {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadMessage("");
      setUploading(true);
      const preview = URL.createObjectURL(file);

      if (slot === "imagen") {
        setLocalPreview(preview);
      } else {
        const index = Number(slot.replace("gallery-", ""));
        setLocalGalleryPreviews((current) => {
          const next = [...current];
          next[index] = preview;
          return next;
        });
      }

      const result = await uploadImageWithFallback(storage, file);

      if (slot === "imagen") {
        updateField("imagen", result.url);
      } else {
        updateGalleryImage(Number(slot.replace("gallery-", "")), result.url);
      }

      setUploadMessage(result.message);
    } catch (error) {
      setUploadMessage(
        error?.message || "No se pudo procesar la imagen. Intenta con otra imagen."
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
      setLocalGalleryPreviews(["", "", ""]);
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

  async function loadXlsxLibrary() {
    if (window.XLSX) return window.XLSX;

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se pudo cargar el lector de Excel."));
      document.head.appendChild(script);
    });

    return window.XLSX;
  }

  async function importarProductosExcel(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportMessage("");

    try {
      const XLSX = await loadXlsxLibrary();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const productosExcel = rows.map(normalizeExcelProduct).filter((item) => item.nombre);

      if (productosExcel.length === 0) {
        setImportMessage("El archivo no tiene productos validos.");
        return;
      }

      const productosSnap = await getDocs(collection(db, "productos"));
      const existingBySku = new Map();

      productosSnap.docs.forEach((docu) => {
        const sku = String(docu.data().sku || "").trim();
        if (sku) existingBySku.set(sku, docu.id);
      });

      let created = 0;
      let updated = 0;

      for (let index = 0; index < productosExcel.length; index += 450) {
        const batch = writeBatch(db);
        const chunk = productosExcel.slice(index, index + 450);

        chunk.forEach((producto) => {
          const existingId = producto.sku ? existingBySku.get(producto.sku) : null;

          if (existingId) {
            batch.update(doc(db, "productos", existingId), {
              ...producto,
              updatedAt: serverTimestamp(),
            });
            updated += 1;
          } else {
            const productRef = doc(collection(db, "productos"));
            batch.set(productRef, {
              ...producto,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            created += 1;
          }
        });

        await batch.commit();
      }

      setImportMessage(
        `Importacion lista: ${created} creados, ${updated} actualizados. Luego puedes editar cada producto y agregar imagenes.`
      );
      await cargarProductos();
    } catch (error) {
      console.error("Error importando productos:", error);
      setImportMessage(error?.message || "No se pudo importar el archivo.");
    } finally {
      setImporting(false);
    }
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
              Unidades por paca
              <input
                type="number"
                value={form.unidadesPorPaca}
                onChange={(e) => updateField("unidadesPorPaca", e.target.value)}
              />
            </label>

            <label>
              Precio paca mayor
              <input
                type="number"
                value={form.precioPacaMayor}
                onChange={(e) => updateField("precioPacaMayor", e.target.value)}
              />
            </label>

            <label>
              Precio paca detal
              <input
                type="number"
                value={form.precioPacaDetal}
                onChange={(e) => updateField("precioPacaDetal", e.target.value)}
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

            <div className="admin-image-grid">
              {imageSlots.map((slot) => {
                const galleryIndex = slot.field.startsWith("gallery-")
                  ? Number(slot.field.replace("gallery-", ""))
                  : -1;
                const value =
                  slot.field === "imagen"
                    ? form.imagen
                    : form.imagenes?.[galleryIndex] || "";
                const preview =
                  slot.field === "imagen"
                    ? localPreview
                    : localGalleryPreviews[galleryIndex];

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
                    {(value || preview) && (
                      <div
                        aria-label={slot.label}
                        className="admin-thumb"
                        style={{
                          backgroundImage: `url("${
                            value ? getSafeImageSrc(value) : preview
                          }")`,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <label style={{ gridColumn: "1 / -1" }}>
              Descripción
              <textarea
                rows="3"
                value={form.descripcion}
                onChange={(e) => updateField("descripcion", e.target.value)}
              />
            </label>

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
          <div className="admin-section-title">
            <div>
              <h2>Importacion masiva</h2>
              <p>
                Sube un Excel con columnas sku, name, category, cost, min, max y
                stock. Las imagenes se agregan despues desde Editar.
              </p>
            </div>
            <label className={`admin-button ${importing ? "secondary" : ""}`}>
              <FileUp size={18} />
              {importing ? "Importando..." : "Subir Excel"}
              <input
                accept=".xlsx,.xls"
                disabled={importing}
                hidden
                type="file"
                onChange={importarProductosExcel}
              />
            </label>
          </div>
          {importMessage && <p className="admin-help">{importMessage}</p>}
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
                      {producto.unidadesPorPaca > 0 && (
                        <>
                          <br />
                          Paca:{" "}
                          {money.format(
                            producto.precioPacaDetal || producto.precioDetal || 0
                          )}
                        </>
                      )}
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

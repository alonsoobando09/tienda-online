"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { money } from "@/lib/operacion";
import { Save, Search, Trash2, Truck, X } from "lucide-react";

const emptyForm = {
  nombre: "",
  contacto: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "Bogota",
  metodoPago: "contado",
  cupoCredito: "",
  diasCredito: "",
  categorias: "",
  observaciones: "",
  estado: "activo",
};

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function ProveedoresAdminPage() {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [selectedProveedorId, setSelectedProveedorId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarProveedores() {
    setLoading(true);

    try {
      const [proveedoresSnap, productosSnap] = await Promise.all([
        getDocs(collection(db, "proveedores")),
        getDocs(collection(db, "productos")),
      ]);
      setProveedores(
        proveedoresSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
      );
      setProductos(
        productosSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarProveedores();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const proveedoresFiltrados = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return proveedores;

    return proveedores.filter((proveedor) =>
      [
        proveedor.nombre,
        proveedor.contacto,
        proveedor.telefono,
        proveedor.email,
        proveedor.categorias,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [filter, proveedores]);

  const resumen = useMemo(() => {
    return proveedores.reduce(
      (acc, proveedor) => {
        acc.total += 1;
        if (proveedor.estado !== "inactivo") acc.activos += 1;
        if (proveedor.metodoPago === "credito") acc.credito += 1;
        acc.cupo += Number(proveedor.cupoCredito) || 0;
        return acc;
      },
      { total: 0, activos: 0, credito: 0, cupo: 0 }
    );
  }, [proveedores]);

  const productosPorProveedor = useMemo(() => {
    const grouped = new Map();

    proveedores.forEach((proveedor) => {
      const proveedorNombre = normalize(proveedor.nombre);
      grouped.set(
        proveedor.id,
        productos.filter(
          (producto) =>
            producto.proveedorId === proveedor.id ||
            normalize(producto.proveedor) === proveedorNombre
        )
      );
    });

    return grouped;
  }, [productos, proveedores]);

  const proveedorSeleccionado = useMemo(
    () => proveedores.find((proveedor) => proveedor.id === selectedProveedorId),
    [proveedores, selectedProveedorId]
  );

  const productosProveedorSeleccionado = useMemo(
    () => productosPorProveedor.get(selectedProveedorId) || [],
    [productosPorProveedor, selectedProveedorId]
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function limpiarFormulario() {
    setEditingId("");
    setForm(emptyForm);
  }

  function editarProveedor(proveedor) {
    setEditingId(proveedor.id);
    setForm({
      nombre: proveedor.nombre || "",
      contacto: proveedor.contacto || "",
      telefono: proveedor.telefono || "",
      email: proveedor.email || "",
      direccion: proveedor.direccion || "",
      ciudad: proveedor.ciudad || "Bogota",
      metodoPago: proveedor.metodoPago || "contado",
      cupoCredito: proveedor.cupoCredito || "",
      diasCredito: proveedor.diasCredito || "",
      categorias: proveedor.categorias || "",
      observaciones: proveedor.observaciones || "",
      estado: proveedor.estado || "activo",
    });
  }

  async function guardarProveedor(event) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      nombre: form.nombre.trim(),
      contacto: form.contacto.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim().toLowerCase(),
      cupoCredito: Number(form.cupoCredito) || 0,
      diasCredito: Number(form.diasCredito) || 0,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "proveedores", editingId), payload);
      } else {
        await addDoc(collection(db, "proveedores"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      limpiarFormulario();
      await cargarProveedores();
    } catch (error) {
      console.error("Error guardando proveedor:", error);
      alert("No se pudo guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarProveedor(proveedor) {
    if (!confirm(`Eliminar proveedor ${proveedor.nombre}?`)) return;

    await deleteDoc(doc(db, "proveedores", proveedor.id));
    await cargarProveedores();
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Proveedores"
        subtitle="Base de proveedores, contactos, credito y categorias de compra."
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Proveedores</h3>
            <h2>{resumen.total}</h2>
            <p>Registrados.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Activos</h3>
            <h2>{resumen.activos}</h2>
            <p>Disponibles para compras.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Credito</h3>
            <h2>{resumen.credito}</h2>
            <p>Con plazo de pago.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Cupo credito</h3>
            <h2>{money(resumen.cupo)}</h2>
            <p>Cupo registrado.</p>
          </article>
        </section>

        <section className="admin-card admin-accent-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>{editingId ? "Editar proveedor" : "Nuevo proveedor"}</h2>
              <p>Registra proveedores para enlazar compras e inventario.</p>
            </div>
            <Truck size={28} />
          </div>

          <form className="admin-form" onSubmit={guardarProveedor}>
            <label>
              Nombre proveedor
              <input
                value={form.nombre}
                onChange={(event) => updateField("nombre", event.target.value)}
                required
              />
            </label>
            <label>
              Contacto
              <input
                value={form.contacto}
                onChange={(event) => updateField("contacto", event.target.value)}
              />
            </label>
            <label>
              Telefono
              <input
                value={form.telefono}
                onChange={(event) => updateField("telefono", event.target.value)}
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>
            <label>
              Direccion
              <input
                value={form.direccion}
                onChange={(event) => updateField("direccion", event.target.value)}
              />
            </label>
            <label>
              Ciudad
              <input
                value={form.ciudad}
                onChange={(event) => updateField("ciudad", event.target.value)}
              />
            </label>
            <label>
              Metodo de pago
              <select
                value={form.metodoPago}
                onChange={(event) => updateField("metodoPago", event.target.value)}
              >
                <option value="contado">Contado</option>
                <option value="credito">Credito</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label>
              Cupo credito
              <input
                type="number"
                value={form.cupoCredito}
                onChange={(event) => updateField("cupoCredito", event.target.value)}
              />
            </label>
            <label>
              Dias credito
              <input
                type="number"
                value={form.diasCredito}
                onChange={(event) => updateField("diasCredito", event.target.value)}
              />
            </label>
            <label>
              Estado
              <select
                value={form.estado}
                onChange={(event) => updateField("estado", event.target.value)}
              >
                <option value="activo">Activo</option>
                <option value="pausado">Pausado</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Categorias o productos que vende
              <input
                value={form.categorias}
                onChange={(event) => updateField("categorias", event.target.value)}
                placeholder="Carnicos, lacteos, panaderia..."
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea
                rows="2"
                value={form.observaciones}
                onChange={(event) => updateField("observaciones", event.target.value)}
              />
            </label>
            <div className="admin-actions" style={{ gridColumn: "1 / -1" }}>
              <button className="admin-button" disabled={saving} type="submit">
                <Save size={18} />
                {saving ? "Guardando..." : "Guardar proveedor"}
              </button>
              {editingId && (
                <button
                  className="admin-button secondary"
                  onClick={limpiarFormulario}
                  type="button"
                >
                  <X size={18} />
                  Cancelar edicion
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Base de proveedores</h2>
              <p>{proveedoresFiltrados.length} proveedores visibles.</p>
            </div>
            <label className="admin-search">
              <Search size={17} />
              <input
                placeholder="Buscar proveedor"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </label>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th>Telefono</th>
                <th>Metodo</th>
                <th>Productos</th>
                <th>Cupo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8">Cargando proveedores...</td>
                </tr>
              ) : (
                proveedoresFiltrados.map((proveedor) => (
                  <tr key={proveedor.id}>
                    <td>
                      <strong>{proveedor.nombre}</strong>
                      <br />
                      <small>{proveedor.categorias || "Sin categorias"}</small>
                    </td>
                    <td>{proveedor.contacto || "Sin contacto"}</td>
                    <td>{proveedor.telefono || "Sin telefono"}</td>
                    <td>{proveedor.metodoPago || "contado"}</td>
                    <td>{productosPorProveedor.get(proveedor.id)?.length || 0}</td>
                    <td>{money(proveedor.cupoCredito || 0)}</td>
                    <td>
                      <span className="admin-pill">{proveedor.estado || "activo"}</span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="admin-button secondary"
                          onClick={() => setSelectedProveedorId(proveedor.id)}
                          type="button"
                        >
                          Productos
                        </button>
                        <button
                          className="admin-button secondary"
                          onClick={() => editarProveedor(proveedor)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="admin-button danger"
                          onClick={() => eliminarProveedor(proveedor)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && proveedoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan="8">No hay proveedores para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {proveedorSeleccionado && (
          <section className="admin-card" style={{ marginTop: 16 }}>
            <div className="admin-section-title">
              <div>
                <h2>Productos de {proveedorSeleccionado.nombre}</h2>
                <p>
                  {productosProveedorSeleccionado.length} productos asociados a este
                  proveedor.
                </p>
              </div>
              <button
                className="admin-button secondary"
                onClick={() => setSelectedProveedorId("")}
                type="button"
              >
                <X size={18} />
                Cerrar
              </button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>SKU</th>
                  <th>Costo</th>
                  <th>Precio detal</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {productosProveedorSeleccionado.map((producto) => (
                  <tr key={producto.id}>
                    <td>{producto.nombre}</td>
                    <td>{producto.categoria || "general"}</td>
                    <td>{producto.sku || "Sin codigo"}</td>
                    <td>{money(producto.costo || 0)}</td>
                    <td>{money(producto.precioDetal || 0)}</td>
                    <td>{producto.stock || 0}</td>
                  </tr>
                ))}
                {productosProveedorSeleccionado.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      Este proveedor todavia no tiene productos asociados. Al crear o
                      comprar productos desde Compras quedaran enlazados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

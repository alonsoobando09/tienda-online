"use client";

import { useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { useEmpleados } from "@/lib/useEmpleados";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Save, Trash2, UserPlus } from "lucide-react";

const emptyForm = {
  nombre: "",
  cargo: "",
  telefono: "",
  email: "",
  documento: "",
  pagoDiario: "",
  estado: "activo",
};

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function EmpleadosPage() {
  const { empleados, loading } = useEmpleados();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editarEmpleado(empleado) {
    setEditingId(empleado.id);
    setForm({
      nombre: empleado.nombre || "",
      cargo: empleado.cargo || "",
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      documento: empleado.documento || "",
      pagoDiario: empleado.pagoDiario || "",
      estado: empleado.estado || "activo",
    });
  }

  function limpiarFormulario() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function guardarEmpleado(e) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      pagoDiario: Number(form.pagoDiario) || 0,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "empleados", editingId), payload);
      } else {
        await addDoc(collection(db, "empleados"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      limpiarFormulario();
    } catch (error) {
      console.error("Error guardando empleado:", error);
      alert("No se pudo guardar el empleado.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarEmpleado(id) {
    if (!confirm("¿Eliminar este empleado?")) return;
    await deleteDoc(doc(db, "empleados", id));
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Empleados"
        subtitle="Gestiona equipo, cargos, pagos diarios y estado operativo."
      >
        <section className="admin-card admin-accent-card">
          <div className="admin-section-title">
            <div>
              <h2>{editingId ? "Editar empleado" : "Nuevo empleado"}</h2>
              <p>Registra datos básicos para operación y nómina.</p>
            </div>
          </div>

          <form className="admin-form" onSubmit={guardarEmpleado}>
            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                required
              />
            </label>

            <label>
              Cargo
              <input
                value={form.cargo}
                onChange={(e) => updateField("cargo", e.target.value)}
                placeholder="Vendedor, logística, caja..."
              />
            </label>

            <label>
              Teléfono
              <input
                value={form.telefono}
                onChange={(e) => updateField("telefono", e.target.value)}
              />
            </label>

            <label>
              Correo
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </label>

            <label>
              Documento
              <input
                value={form.documento}
                onChange={(e) => updateField("documento", e.target.value)}
              />
            </label>

            <label>
              Pago diario
              <input
                type="number"
                value={form.pagoDiario}
                onChange={(e) => updateField("pagoDiario", e.target.value)}
              />
            </label>

            <label>
              Estado
              <select
                value={form.estado}
                onChange={(e) => updateField("estado", e.target.value)}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>

            <button className="admin-button" disabled={saving}>
              {editingId ? <Save size={18} /> : <UserPlus size={18} />}
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear empleado"}
            </button>

            {editingId && (
              <button
                className="admin-button secondary"
                type="button"
                onClick={limpiarFormulario}
              >
                Cancelar edición
              </button>
            )}
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Equipo</h2>
              <p>{empleados.length} empleados registrados</p>
            </div>
          </div>

          {loading ? (
            <p>Cargando empleados...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th>Contacto</th>
                  <th>Pago diario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((empleado) => (
                  <tr key={empleado.id}>
                    <td>
                      <strong>{empleado.nombre}</strong>
                      <br />
                      <small>{empleado.documento || "Sin documento"}</small>
                    </td>
                    <td>{empleado.cargo || "Sin cargo"}</td>
                    <td>
                      {empleado.telefono || "Sin teléfono"}
                      <br />
                      <small>{empleado.email || "Sin correo"}</small>
                    </td>
                    <td>{money.format(empleado.pagoDiario || 0)}</td>
                    <td>
                      <span className="admin-pill">
                        {empleado.estado || "activo"}
                      </span>
                    </td>
                    <td className="admin-row-actions">
                      <button
                        className="admin-button secondary"
                        onClick={() => editarEmpleado(empleado)}
                      >
                        Editar
                      </button>
                      <button
                        className="admin-button danger"
                        onClick={() => eliminarEmpleado(empleado.id)}
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

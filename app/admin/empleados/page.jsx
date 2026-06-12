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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { diasRuta, getDiaLabel, rutasBase } from "@/lib/operacion";
import { Save, Trash2, UserPlus } from "lucide-react";

const emptyForm = {
  nombre: "",
  cargo: "",
  rol: "carterista",
  uid: "",
  telefono: "",
  email: "",
  documento: "",
  pagoDiario: "",
  diaRuta: "martes",
  ruta: "Ruta 1",
  estado: "activo",
};

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "bodega", label: "Bodega" },
  { value: "carterista", label: "Carterista" },
  { value: "ayudante", label: "Ayudante" },
];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function getRoleLabel(value) {
  return roles.find((role) => role.value === value)?.label || "Sin rol";
}

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
      rol: empleado.rol || "carterista",
      uid: empleado.uid || "",
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      documento: empleado.documento || "",
      pagoDiario: empleado.pagoDiario || "",
      diaRuta: empleado.diaRuta || "martes",
      ruta: empleado.ruta || "Ruta 1",
      estado: empleado.estado || "activo",
    });
  }

  function limpiarFormulario() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function guardarEmpleado(event) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      uid: form.uid.trim(),
      email: form.email.trim().toLowerCase(),
      pagoDiario: Number(form.pagoDiario) || 0,
      updatedAt: serverTimestamp(),
    };

    try {
      let empleadoId = editingId;

      if (editingId) {
        await updateDoc(doc(db, "empleados", editingId), payload);
      } else {
        const empleadoRef = await addDoc(collection(db, "empleados"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        empleadoId = empleadoRef.id;
      }

      if (payload.uid) {
        await setDoc(
          doc(db, "usuarios", payload.uid),
          {
            uid: payload.uid,
            empleadoId,
            nombre: payload.nombre,
            email: payload.email,
            rol: payload.rol,
            cargo: payload.cargo,
            telefono: payload.telefono,
            diaRuta: payload.diaRuta,
            ruta: payload.ruta,
            estado: payload.estado,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      limpiarFormulario();
    } catch (error) {
      console.error("Error guardando empleado:", error);
      alert("No se pudo guardar el empleado.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarEmpleado(empleado) {
    if (!confirm("Eliminar este empleado del panel operativo?")) return;

    await deleteDoc(doc(db, "empleados", empleado.id));

    if (empleado.uid) {
      await deleteDoc(doc(db, "usuarios", empleado.uid));
    }
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Empleados"
        subtitle="Gestiona equipo, roles de acceso, pagos diarios y rutas asignadas."
      >
        <section className="admin-card admin-accent-card">
          <div className="admin-section-title">
            <div>
              <h2>{editingId ? "Editar empleado" : "Nuevo empleado"}</h2>
              <p>
                Registra personal, conecta su usuario de Firebase y define su
                permiso operativo.
              </p>
            </div>
          </div>

          <form className="admin-form" onSubmit={guardarEmpleado}>
            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(event) => updateField("nombre", event.target.value)}
                required
              />
            </label>

            <label>
              Cargo
              <input
                value={form.cargo}
                onChange={(event) => updateField("cargo", event.target.value)}
                placeholder="Carterista, ayudante, bodega..."
              />
            </label>

            <label>
              Rol de acceso
              <select
                value={form.rol}
                onChange={(event) => updateField("rol", event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              UID Firebase
              <input
                value={form.uid}
                onChange={(event) => updateField("uid", event.target.value)}
                placeholder="UID de Authentication"
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
              Documento
              <input
                value={form.documento}
                onChange={(event) => updateField("documento", event.target.value)}
              />
            </label>

            <label>
              Pago diario
              <input
                type="number"
                value={form.pagoDiario}
                onChange={(event) => updateField("pagoDiario", event.target.value)}
              />
            </label>

            <label>
              Dia de ruta
              <select
                value={form.diaRuta}
                onChange={(event) => updateField("diaRuta", event.target.value)}
              >
                {diasRuta.map((dia) => (
                  <option key={dia.value} value={dia.value}>
                    {dia.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ruta asignada
              <select
                value={form.ruta}
                onChange={(event) => updateField("ruta", event.target.value)}
              >
                {rutasBase.map((ruta) => (
                  <option key={ruta} value={ruta}>
                    {ruta}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado
              <select
                value={form.estado}
                onChange={(event) => updateField("estado", event.target.value)}
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
                Cancelar edicion
              </button>
            )}

            <p className="admin-help" style={{ gridColumn: "1 / -1" }}>
              Para activar el acceso: crea el usuario en Firebase Authentication,
              copia su UID y pegalo aqui. Al guardar se actualiza la coleccion
              usuarios con el rol correcto.
            </p>
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Equipo operativo</h2>
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
                  <th>Rol</th>
                  <th>Contacto</th>
                  <th>Ruta</th>
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
                      <br />
                      <small>{empleado.uid ? `UID: ${empleado.uid}` : "Sin UID"}</small>
                    </td>
                    <td>
                      <span className="admin-pill">
                        {getRoleLabel(empleado.rol)}
                      </span>
                      <br />
                      <small>{empleado.cargo || "Sin cargo"}</small>
                    </td>
                    <td>
                      {empleado.telefono || "Sin telefono"}
                      <br />
                      <small>{empleado.email || "Sin correo"}</small>
                    </td>
                    <td>
                      {getDiaLabel(empleado.diaRuta)}
                      <br />
                      <small>{empleado.ruta || "Sin ruta"}</small>
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
                        onClick={() => eliminarEmpleado(empleado)}
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

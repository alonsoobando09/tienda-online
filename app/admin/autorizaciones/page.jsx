"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { useEmpleados } from "@/lib/useEmpleados";
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
import { diasRuta, getDiaLabel, rutasBase } from "@/lib/operacion";
import { Save, ShieldCheck, Trash2 } from "lucide-react";

const emptyForm = {
  empleadoId: "",
  fecha: new Date().toISOString().slice(0, 10),
  diaRuta: "martes",
  ruta: "Ruta 1",
  motivo: "",
  estado: "activa",
};

export default function AutorizacionesPage() {
  const { empleados } = useEmpleados();
  const [autorizaciones, setAutorizaciones] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const empleadosRuta = useMemo(
    () =>
      empleados.filter(
        (empleado) =>
          empleado.estado !== "inactivo" &&
          ["carterista", "ayudante"].includes(empleado.rol)
      ),
    [empleados]
  );

  async function cargarAutorizaciones() {
    setLoading(true);
    const snap = await getDocs(collection(db, "autorizacionesRuta"));
    setAutorizaciones(
      snap.docs
        .map((docu) => ({ id: docu.id, ...docu.data() }))
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))
    );
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarAutorizaciones();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function guardarAutorizacion(event) {
    event.preventDefault();

    const empleado = empleados.find((item) => item.id === form.empleadoId);

    if (!empleado?.uid) {
      alert("Selecciona un empleado con UID Firebase.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "autorizacionesRuta"), {
        empleadoId: empleado.id,
        uid: empleado.uid,
        empleadoNombre: empleado.nombre || "",
        empleadoRol: empleado.rol || "",
        fecha: form.fecha,
        diaRuta: form.diaRuta,
        ruta: form.ruta,
        motivo: form.motivo.trim(),
        estado: form.estado,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm(emptyForm);
      await cargarAutorizaciones();
    } catch (error) {
      console.error("Error guardando autorizacion:", error);
      alert("No se pudo guardar la autorizacion.");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(autorizacion, estado) {
    await updateDoc(doc(db, "autorizacionesRuta", autorizacion.id), {
      estado,
      updatedAt: serverTimestamp(),
    });
    await cargarAutorizaciones();
  }

  async function eliminarAutorizacion(id) {
    if (!confirm("Eliminar esta autorizacion?")) return;
    await deleteDoc(doc(db, "autorizacionesRuta", id));
    await cargarAutorizaciones();
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Autorizaciones de ruta"
        subtitle="Permite trabajar una ruta o dia diferente solo con aprobacion del administrador."
        actions={
          <button className="admin-button secondary" onClick={cargarAutorizaciones}>
            Actualizar
          </button>
        }
      >
        <section className="admin-card admin-accent-card">
          <div className="admin-section-title">
            <div>
              <h2>Nueva autorizacion</h2>
              <p>Asigna una ruta especial para una fecha concreta.</p>
            </div>
            <ShieldCheck size={28} />
          </div>

          <form className="admin-form" onSubmit={guardarAutorizacion}>
            <label>
              Carterista / ayudante
              <select
                value={form.empleadoId}
                onChange={(event) => updateField("empleadoId", event.target.value)}
                required
              >
                <option value="">Seleccionar empleado</option>
                {empleadosRuta.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre} - {empleado.rol}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha autorizada
              <input
                type="date"
                value={form.fecha}
                onChange={(event) => updateField("fecha", event.target.value)}
                required
              />
            </label>

            <label>
              Dia de ruta a trabajar
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
              Ruta
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
                <option value="activa">Activa</option>
                <option value="pausada">Pausada</option>
              </select>
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Motivo
              <textarea
                rows="2"
                value={form.motivo}
                onChange={(event) => updateField("motivo", event.target.value)}
                placeholder="Ej: cubrir ruta por ausencia, apoyo especial, cambio de dia..."
              />
            </label>

            <button className="admin-button" disabled={saving}>
              <Save size={18} />
              {saving ? "Guardando..." : "Guardar autorizacion"}
            </button>
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Autorizaciones registradas</h2>
              <p>{autorizaciones.length} permisos creados</p>
            </div>
          </div>

          {loading ? (
            <p>Cargando autorizaciones...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Empleado</th>
                  <th>Ruta autorizada</th>
                  <th>Estado</th>
                  <th>Motivo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {autorizaciones.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fecha}</td>
                    <td>
                      <strong>{item.empleadoNombre || "Sin empleado"}</strong>
                      <br />
                      <small>{item.empleadoRol || "Sin rol"}</small>
                    </td>
                    <td>
                      {getDiaLabel(item.diaRuta)}
                      <br />
                      <small>{item.ruta}</small>
                    </td>
                    <td>
                      <span className="admin-pill">{item.estado || "activa"}</span>
                    </td>
                    <td>{item.motivo || "Sin motivo"}</td>
                    <td className="admin-row-actions">
                      <button
                        className="admin-button secondary"
                        onClick={() =>
                          cambiarEstado(
                            item,
                            item.estado === "activa" ? "pausada" : "activa"
                          )
                        }
                      >
                        {item.estado === "activa" ? "Pausar" : "Activar"}
                      </button>
                      <button
                        className="admin-button danger"
                        onClick={() => eliminarAutorizacion(item.id)}
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

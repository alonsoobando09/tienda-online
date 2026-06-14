"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { useEmpleados } from "@/lib/useEmpleados";
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { diasRuta, getDiaLabel, rutasBase } from "@/lib/operacion";
import { Save, Search, ShieldCheck, Trash2 } from "lucide-react";

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
  const [filter, setFilter] = useState("vigentes");
  const [search, setSearch] = useState("");
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

  const autorizacionesFiltradas = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const term = search.trim().toLowerCase();

    return autorizaciones
      .filter((item) => {
        if (filter === "todas") return true;
        if (filter === "activas") return item.estado === "activa";
        if (filter === "pausadas") return item.estado !== "activa";
        return item.fecha >= today && item.estado === "activa";
      })
      .filter((item) => {
        if (!term) return true;
        return [
          item.empleadoNombre,
          item.empleadoRol,
          item.uid,
          item.fecha,
          item.diaRuta,
          item.ruta,
          item.motivo,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [autorizaciones, filter, search]);

  const resumen = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return autorizaciones.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.estado === "activa") acc.activas += 1;
        if (item.estado !== "activa") acc.pausadas += 1;
        if (item.fecha === today && item.estado === "activa") acc.hoy += 1;
        if (item.fecha >= today && item.estado === "activa") acc.vigentes += 1;
        return acc;
      },
      { total: 0, activas: 0, pausadas: 0, hoy: 0, vigentes: 0 }
    );
  }, [autorizaciones]);

  const empleadoSeleccionado = useMemo(
    () => empleados.find((item) => item.id === form.empleadoId),
    [empleados, form.empleadoId]
  );

  async function guardarAutorizacion(event) {
    event.preventDefault();

    const empleado = empleados.find((item) => item.id === form.empleadoId);

    if (!empleado?.uid) {
      alert("Selecciona un empleado con UID Firebase.");
      return;
    }

    if (!form.motivo.trim()) {
      alert("Escribe el motivo de la autorizacion.");
      return;
    }

    setSaving(true);

    try {
      const batch = writeBatch(db);
      const autorizacionRef = doc(collection(db, "autorizacionesRuta"));

      autorizaciones
        .filter(
          (item) =>
            item.uid === empleado.uid &&
            item.fecha === form.fecha &&
            item.estado === "activa"
        )
        .forEach((item) => {
          batch.update(doc(db, "autorizacionesRuta", item.id), {
            estado: "reemplazada",
            reemplazadaPor: autorizacionRef.id,
            updatedAt: serverTimestamp(),
          });
        });

      batch.set(autorizacionRef, {
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

      await batch.commit();
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
    const batch = writeBatch(db);

    if (estado === "activa") {
      autorizaciones
        .filter(
          (item) =>
            item.id !== autorizacion.id &&
            item.uid === autorizacion.uid &&
            item.fecha === autorizacion.fecha &&
            item.estado === "activa"
        )
        .forEach((item) => {
          batch.update(doc(db, "autorizacionesRuta", item.id), {
            estado: "reemplazada",
            reemplazadaPor: autorizacion.id,
            updatedAt: serverTimestamp(),
          });
        });
    }

    batch.update(doc(db, "autorizacionesRuta", autorizacion.id), {
      estado,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
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
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Vigentes</h3>
            <h2>{resumen.vigentes}</h2>
            <p>Activas desde hoy en adelante.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Hoy</h3>
            <h2>{resumen.hoy}</h2>
            <p>Excepciones activas del dia.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Activas</h3>
            <h2>{resumen.activas}</h2>
            <p>Total historico activo.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Pausadas</h3>
            <h2>{resumen.pausadas}</h2>
            <p>No aplican a la ruta.</p>
          </article>
        </section>

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

            {empleadoSeleccionado && (
              <div className="route-card route-info" style={{ gridColumn: "1 / -1" }}>
                Ruta normal de {empleadoSeleccionado.nombre}:{" "}
                {getDiaLabel(empleadoSeleccionado.diaRuta)} -{" "}
                {empleadoSeleccionado.ruta || "Sin ruta"}. Esta autorizacion solo
                aplica para la fecha seleccionada.
              </div>
            )}

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
              <p>
                {autorizacionesFiltradas.length} visibles de {autorizaciones.length} permisos
                creados
              </p>
            </div>
            <div className="admin-actions">
              <label className="admin-search">
                <Search size={17} />
                <input
                  placeholder="Buscar empleado, ruta o motivo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                className="admin-select-inline"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="vigentes">Vigentes</option>
                <option value="activas">Activas</option>
                <option value="pausadas">Pausadas/reemplazadas</option>
                <option value="todas">Todas</option>
              </select>
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
                {autorizacionesFiltradas.map((item) => (
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
                {!loading && autorizacionesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan="6">No hay autorizaciones con ese filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

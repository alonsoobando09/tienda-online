"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  diasRuta,
  getDebtColor,
  getDiaLabel,
  money,
  rutasBase,
  sortClientesByRoute,
} from "@/lib/operacion";
import { Save, Trash2, UserPlus } from "lucide-react";

const emptyForm = {
  nombre: "",
  telefono: "",
  direccion: "",
  local: "",
  diaRuta: "martes",
  ruta: "Ruta 1",
  insertarDespuesDe: "",
  deudaActual: "",
  diasDeuda: "0",
  observaciones: "",
};

export default function ClientesAdminPage() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarClientes(showLoading = true) {
    if (showLoading) setLoading(true);
    const snapshot = await getDocs(collection(db, "clientes"));
    const data = snapshot.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    setClientes(sortClientesByRoute(data));
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarClientes(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const clientesMismaRuta = useMemo(
    () =>
      sortClientesByRoute(
        clientes.filter(
          (cliente) =>
            cliente.diaRuta === form.diaRuta && cliente.ruta === form.ruta
        )
      ),
    [clientes, form.diaRuta, form.ruta]
  );

  const clientesFiltrados = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return clientes;

    return clientes.filter((cliente) =>
      [
        cliente.nombre,
        cliente.telefono,
        cliente.direccion,
        cliente.local,
        cliente.ruta,
        cliente.diaRuta,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [clientes, filter]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function limpiarFormulario() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function editarCliente(cliente) {
    setEditingId(cliente.id);
    setForm({
      nombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      direccion: cliente.direccion || "",
      local: cliente.local || "",
      diaRuta: cliente.diaRuta || "martes",
      ruta: cliente.ruta || "Ruta 1",
      insertarDespuesDe: "",
      deudaActual: cliente.deudaActual || "",
      diasDeuda: cliente.diasDeuda || "0",
      observaciones: cliente.observaciones || "",
    });
  }

  async function guardarCliente(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        local: form.local.trim(),
        diaRuta: form.diaRuta,
        ruta: form.ruta.trim() || "Ruta 1",
        deudaActual: Number(form.deudaActual) || 0,
        diasDeuda: Number(form.diasDeuda) || 0,
        semaforoDeuda: getDebtColor(form.diasDeuda),
        observaciones: form.observaciones.trim(),
        solicitudBorrado: false,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "clientes", editingId), payload);
      } else {
        const sameRoute = clientesMismaRuta;
        const selected = sameRoute.find(
          (cliente) => cliente.id === form.insertarDespuesDe
        );
        const ordenVisita = selected
          ? Number(selected.ordenVisita || 0) + 1
          : sameRoute.length + 1;

        const batch = writeBatch(db);
        sameRoute
          .filter((cliente) => Number(cliente.ordenVisita || 0) >= ordenVisita)
          .forEach((cliente) => {
            batch.update(doc(db, "clientes", cliente.id), {
              ordenVisita: Number(cliente.ordenVisita || 0) + 1,
              updatedAt: serverTimestamp(),
            });
          });

        const newRef = doc(collection(db, "clientes"));
        batch.set(newRef, {
          ...payload,
          ordenVisita,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
      }

      limpiarFormulario();
      await cargarClientes();
    } catch (error) {
      console.error("Error guardando cliente:", error);
      alert("No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCliente(id) {
    if (!confirm("Eliminar este cliente definitivamente?")) return;
    await deleteDoc(doc(db, "clientes", id));
    await cargarClientes();
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Clientes"
        subtitle="Base de clientes por ruta, dia de visita, cartera y orden operativo."
        actions={
          <button className="admin-button secondary" onClick={cargarClientes}>
            Actualizar
          </button>
        }
      >
        <section className="admin-card admin-accent-card">
          <div className="admin-section-title">
            <div>
              <h2>{editingId ? "Editar cliente" : "Nuevo cliente"}</h2>
              <p>
                Agrega clientes al final de la ruta o debajo de otro cliente para
                conservar el recorrido real.
              </p>
            </div>
          </div>

          <form className="admin-form" onSubmit={guardarCliente}>
            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                required
              />
            </label>

            <label>
              Telefono
              <input
                value={form.telefono}
                onChange={(e) => updateField("telefono", e.target.value)}
              />
            </label>

            <label>
              Dia de ruta
              <select
                value={form.diaRuta}
                onChange={(e) => updateField("diaRuta", e.target.value)}
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
              <input
                list="rutas-base"
                value={form.ruta}
                onChange={(e) => updateField("ruta", e.target.value)}
              />
              <datalist id="rutas-base">
                {rutasBase.map((ruta) => (
                  <option key={ruta} value={ruta} />
                ))}
              </datalist>
            </label>

            {!editingId && (
              <label>
                Insertar debajo de
                <select
                  value={form.insertarDespuesDe}
                  onChange={(e) =>
                    updateField("insertarDespuesDe", e.target.value)
                  }
                >
                  <option value="">Al final de la ruta</option>
                  {clientesMismaRuta.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      #{cliente.ordenVisita || "-"} {cliente.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Deuda actual
              <input
                type="number"
                value={form.deudaActual}
                onChange={(e) => updateField("deudaActual", e.target.value)}
              />
            </label>

            <label>
              Dias deuda
              <input
                type="number"
                value={form.diasDeuda}
                onChange={(e) => updateField("diasDeuda", e.target.value)}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Direccion
              <input
                value={form.direccion}
                onChange={(e) => updateField("direccion", e.target.value)}
              />
            </label>

            <label>
              Local / referencia
              <input
                value={form.local}
                onChange={(e) => updateField("local", e.target.value)}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea
                rows="3"
                value={form.observaciones}
                onChange={(e) => updateField("observaciones", e.target.value)}
              />
            </label>

            <button className="admin-button" disabled={saving}>
              {editingId ? <Save size={18} /> : <UserPlus size={18} />}
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear cliente"}
            </button>

            {editingId && (
              <button
                className="admin-button secondary"
                onClick={limpiarFormulario}
                type="button"
              >
                Cancelar
              </button>
            )}
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Clientes registrados</h2>
              <p>{clientes.length} clientes en base operativa</p>
            </div>
            <input
              placeholder="Buscar cliente, telefono, ruta o direccion"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 380 }}
            />
          </div>

          {loading ? (
            <p>Cargando clientes...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Ruta</th>
                  <th>Cartera</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>
                      <strong>#{cliente.ordenVisita || "-"}</strong>
                    </td>
                    <td>
                      <strong>{cliente.nombre}</strong>
                      <br />
                      <small>{cliente.telefono || "Sin telefono"}</small>
                      <br />
                      <small>{cliente.direccion || "Sin direccion"}</small>
                    </td>
                    <td>
                      {getDiaLabel(cliente.diaRuta)}
                      <br />
                      <small>{cliente.ruta || "Sin ruta"}</small>
                    </td>
                    <td>
                      {money(cliente.deudaActual || 0)}
                      <br />
                      <small>{cliente.diasDeuda || 0} dias</small>
                    </td>
                    <td>
                      <span className={`debt-pill ${cliente.semaforoDeuda || "verde"}`}>
                        {cliente.solicitudBorrado ? "Revisar borrado" : cliente.semaforoDeuda || "verde"}
                      </span>
                    </td>
                    <td className="admin-row-actions">
                      <button
                        className="admin-button secondary"
                        onClick={() => editarCliente(cliente)}
                      >
                        Editar
                      </button>
                      <button
                        className="admin-button danger"
                        onClick={() => eliminarCliente(cliente.id)}
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

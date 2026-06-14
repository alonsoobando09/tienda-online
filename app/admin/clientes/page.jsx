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
import {
  ArchiveX,
  CheckCheck,
  Edit3,
  FileUp,
  MessageCircle,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";

const emptyForm = {
  nombre: "",
  telefono: "",
  direccion: "",
  local: "",
  diaRuta: "martes",
  ruta: "Ruta 1",
  ordenVisita: "",
  insertarDespuesDe: "",
  deudaActual: "",
  diasDeuda: "0",
  observaciones: "",
};

const assignedDayMap = {
  1: "lunes",
  2: "martes",
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toNumber(value) {
  return Number(value) || 0;
}

function getVisitOrder(row) {
  return toNumber(
    row.ordenVisita ||
      row.orden ||
      row.order ||
      row.visit_order ||
      row["orden de visita"]
  );
}

function normalizePhone(value) {
  const text = String(value || "").replace(/\D/g, "");
  return text ? text.replace(/^57/, "") : "";
}

function buildWhatsappUrl(cliente) {
  const phone = normalizePhone(cliente.telefono);
  if (!phone) return "";

  const lines = [
    "Proveedor Central",
    `Hola ${cliente.nombre || ""}.`,
    `Te recordamos que tienes un saldo pendiente de ${money(cliente.deudaActual || 0)}.`,
    `Ruta: ${getDiaLabel(cliente.diaRuta)} - ${cliente.ruta || "Sin ruta"}.`,
    "",
    "Por favor nos confirmas tu abono o pago. Muchas gracias.",
  ];

  return `https://wa.me/57${phone.slice(-10)}?text=${encodeURIComponent(
    lines.join("\n")
  )}`;
}

function getClientKey(cliente) {
  const phone = normalizePhone(cliente.telefono || cliente.phone);
  if (phone) return `phone:${phone}`;

  return `name:${normalizeText(cliente.nombre || cliente.name)}|address:${normalizeText(
    cliente.direccion || cliente.address
  )}`;
}

function getAssignedDay(value) {
  const numberValue = Number(value);
  if (assignedDayMap[numberValue]) return assignedDayMap[numberValue];

  const normalized = normalizeText(value);
  return diasRuta.find((dia) => dia.value === normalized)?.value || "martes";
}

function normalizeExcelClient(row) {
  const nombre = String(row.name || row.nombre || row.cliente || "").trim();
  const telefono = normalizePhone(row.phone || row.telefono || row.celular);
  const direccion = String(row.address || row.direccion || "").trim();
  const deudaActual = toNumber(row.current_balance || row.deudaActual || row.deuda);

  return {
    nombre,
    telefono,
    direccion,
    local: direccion,
    diaRuta: getAssignedDay(row.assigned_day || row.diaRuta || row.dia),
    ruta: String(row.ruta || row.route || "Ruta 1").trim() || "Ruta 1",
    ordenVisita: getVisitOrder(row),
    limiteCredito: toNumber(row.credit_limit || row.limiteCredito),
    deudaActual,
    diasDeuda: deudaActual > 0 ? 8 : 0,
    semaforoDeuda: getDebtColor(deudaActual > 0 ? 8 : 0),
    observaciones: "",
    solicitudBorrado: false,
  };
}

export default function ClientesAdminPage() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("todos");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

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

    return clientes
      .filter((cliente) => {
        if (reviewFilter === "borrado") return cliente.solicitudBorrado;
        if (reviewFilter === "orden") return cliente.pendienteRevisionOrden;
        if (reviewFilter === "creados") return cliente.creadoPorCarterista;
        if (reviewFilter === "perdidos") return cliente.estadoCliente === "perdido";
        if (reviewFilter === "riesgo") {
          return cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida;
        }
        return true;
      })
      .filter((cliente) => {
        if (!term) return true;
        return [
          cliente.nombre,
          cliente.telefono,
          cliente.direccion,
          cliente.local,
          cliente.ruta,
          cliente.diaRuta,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [clientes, filter, reviewFilter]);

  const resumenRevision = useMemo(
    () => ({
      borrar: clientes.filter((cliente) => cliente.solicitudBorrado).length,
      orden: clientes.filter((cliente) => cliente.pendienteRevisionOrden).length,
      creados: clientes.filter((cliente) => cliente.creadoPorCarterista).length,
      perdidos: clientes.filter((cliente) => cliente.estadoCliente === "perdido").length,
      riesgo: clientes.filter(
        (cliente) => cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida
      ).length,
    }),
    [clientes]
  );

  const carteraPorRecuperar = useMemo(() => {
    const map = new Map();

    clientes
      .filter(
        (cliente) =>
          cliente.estadoCliente === "perdido" ||
          cliente.perdido ||
          cliente.estadoCliente === "riesgo_perdida" ||
          cliente.riesgoPerdida
      )
      .forEach((cliente) => {
        const key = `${cliente.diaRuta || "sin-dia"}__${cliente.ruta || "Sin ruta"}`;
        const current = map.get(key) || {
          key,
          diaRuta: cliente.diaRuta || "sin-dia",
          ruta: cliente.ruta || "Sin ruta",
          riesgo: 0,
          perdidos: 0,
          carteraRiesgo: 0,
          carteraPerdida: 0,
          clientes: [],
        };
        const deuda = Number(cliente.deudaActual) || 0;
        const perdido = cliente.estadoCliente === "perdido" || cliente.perdido;

        if (perdido) {
          current.perdidos += 1;
          current.carteraPerdida += deuda;
        } else {
          current.riesgo += 1;
          current.carteraRiesgo += deuda;
        }

        current.clientes.push(cliente);
        map.set(key, current);
      });

    return [...map.values()].sort((a, b) => {
      const totalB = b.carteraRiesgo + b.carteraPerdida;
      const totalA = a.carteraRiesgo + a.carteraPerdida;
      return totalB - totalA;
    });
  }, [clientes]);

  const clientesPorRecuperar = useMemo(
    () =>
      clientes
        .filter(
          (cliente) =>
            cliente.estadoCliente === "perdido" ||
            cliente.perdido ||
            cliente.estadoCliente === "riesgo_perdida" ||
            cliente.riesgoPerdida
        )
        .sort((a, b) => {
          const deudaDiff =
            Number(b.deudaActual || 0) - Number(a.deudaActual || 0);
          if (deudaDiff !== 0) return deudaDiff;
          const diaDiff = String(a.diaRuta || "").localeCompare(
            String(b.diaRuta || "")
          );
          if (diaDiff !== 0) return diaDiff;
          return Number(a.ordenVisita || 0) - Number(b.ordenVisita || 0);
        }),
    [clientes]
  );

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
      ordenVisita: cliente.ordenVisita || "",
      insertarDespuesDe: "",
      deudaActual: cliente.deudaActual || "",
      diasDeuda: cliente.diasDeuda || "0",
      observaciones: cliente.observaciones || "",
    });
  }

  function getSameRouteClientes(diaRuta, ruta, excludeId = "") {
    return sortClientesByRoute(
      clientes.filter(
        (cliente) =>
          cliente.id !== excludeId &&
          cliente.diaRuta === diaRuta &&
          cliente.ruta === ruta
      )
    );
  }

  async function guardarOrdenCliente(clienteId, payload, desiredOrder) {
    const sameRoute = getSameRouteClientes(
      payload.diaRuta,
      payload.ruta,
      clienteId
    );
    const maxOrder = sameRoute.length + 1;
    const nextOrder = Math.min(Math.max(Number(desiredOrder) || maxOrder, 1), maxOrder);
    const ordered = [
      ...sameRoute.slice(0, nextOrder - 1),
      { id: clienteId, ...payload },
      ...sameRoute.slice(nextOrder - 1),
    ];
    const batch = writeBatch(db);

    ordered.forEach((cliente, index) => {
      const ref = doc(db, "clientes", cliente.id);
      const ordenVisita = index + 1;

      if (cliente.id === clienteId) {
        batch.update(ref, {
          ...payload,
          ordenVisita,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(ref, {
          ordenVisita,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
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
        await guardarOrdenCliente(editingId, payload, form.ordenVisita);
      } else {
        const sameRoute = clientesMismaRuta;
        const selected = sameRoute.find(
          (cliente) => cliente.id === form.insertarDespuesDe
        );
        const ordenManual = Number(form.ordenVisita) || 0;
        let ordenVisita = sameRoute.length + 1;

        if (ordenManual) {
          ordenVisita = Math.min(Math.max(ordenManual, 1), sameRoute.length + 1);
        } else if (selected) {
          ordenVisita = Number(selected.ordenVisita || 0) + 1;
        }

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

  async function aprobarOrdenCliente(cliente) {
    const batch = writeBatch(db);
    batch.update(doc(db, "clientes", cliente.id), {
      pendienteRevisionOrden: false,
      revisionOrdenAprobada: true,
      revisionOrdenFecha: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await cargarClientes(false);
  }

  async function quitarSolicitudBorrado(cliente) {
    const batch = writeBatch(db);
    batch.update(doc(db, "clientes", cliente.id), {
      solicitudBorrado: false,
      solicitudBorradoRevisada: true,
      solicitudBorradoRevisadaFecha: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await cargarClientes(false);
  }

  async function cambiarEstadoCliente(cliente, estadoCliente) {
    const batch = writeBatch(db);
    const riesgoPerdida = estadoCliente === "riesgo_perdida";
    const perdido = estadoCliente === "perdido";
    const recuperado = estadoCliente === "activo";
    const estadoLabel = perdido
      ? "Cliente pasado a archivo perdido"
      : riesgoPerdida
        ? "Cliente marcado en riesgo de perdida"
        : "Cliente recuperado";

    batch.update(doc(db, "clientes", cliente.id), {
      estadoCliente,
      perdido,
      riesgoPerdida,
      fechaEstadoCliente: serverTimestamp(),
      fechaPerdido: perdido ? serverTimestamp() : cliente.fechaPerdido || null,
      fechaRiesgoPerdida: riesgoPerdida
        ? serverTimestamp()
        : cliente.fechaRiesgoPerdida || null,
      fechaRecuperado: recuperado ? serverTimestamp() : cliente.fechaRecuperado || null,
      solicitudBorrado: recuperado ? false : Boolean(cliente.solicitudBorrado),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, "movimientosCartera")), {
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      diaRuta: cliente.diaRuta || "",
      ruta: cliente.ruta || "",
      deudaAnterior: Number(cliente.deudaActual) || 0,
      nuevaDeuda: Number(cliente.deudaActual) || 0,
      diasDeuda: Number(cliente.diasDeuda) || 0,
      tipo: recuperado ? "cliente_recuperado" : perdido ? "cliente_perdido" : "riesgo_perdida",
      nota: estadoLabel,
      estadoCliente,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    await cargarClientes(false);
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

  async function importarClientesExcel(event) {
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
      const clientesExcel = rows.map(normalizeExcelClient).filter((item) => item.nombre);

      if (clientesExcel.length === 0) {
        setImportMessage("El archivo no tiene clientes validos.");
        return;
      }

      const clientesSnap = await getDocs(collection(db, "clientes"));
      const existingByKey = new Map();
      const maxOrdenByRoute = new Map();

      clientesSnap.docs.forEach((docu) => {
        const cliente = { id: docu.id, ...docu.data() };
        const key = getClientKey(cliente);
        existingByKey.set(key, cliente.id);

        const routeKey = `${cliente.diaRuta || "martes"}|${cliente.ruta || "Ruta 1"}`;
        const currentMax = maxOrdenByRoute.get(routeKey) || 0;
        maxOrdenByRoute.set(routeKey, Math.max(currentMax, Number(cliente.ordenVisita) || 0));
      });

      let created = 0;
      let updated = 0;

      for (let index = 0; index < clientesExcel.length; index += 450) {
        const batch = writeBatch(db);
        const chunk = clientesExcel.slice(index, index + 450);

        chunk.forEach((cliente) => {
          const key = getClientKey(cliente);
          const existingId = existingByKey.get(key);

          if (existingId) {
            batch.update(doc(db, "clientes", existingId), {
              ...cliente,
              updatedAt: serverTimestamp(),
            });
            updated += 1;
            return;
          }

          const routeKey = `${cliente.diaRuta}|${cliente.ruta}`;
          const desiredOrder = Number(cliente.ordenVisita) || 0;
          const nextOrden = desiredOrder || (maxOrdenByRoute.get(routeKey) || 0) + 1;
          maxOrdenByRoute.set(routeKey, nextOrden);

          const clienteRef = doc(collection(db, "clientes"));
          batch.set(clienteRef, {
            ...cliente,
            ordenVisita: nextOrden,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          existingByKey.set(key, clienteRef.id);
          created += 1;
        });

        await batch.commit();
      }

      await renumerarRutas();

      setImportMessage(
        `Importacion lista: ${created} clientes creados, ${updated} actualizados. Orden de visita renumerado por ruta.`
      );
      await cargarClientes();
    } catch (error) {
      console.error("Error importando clientes:", error);
      setImportMessage(error?.message || "No se pudo importar el archivo.");
    } finally {
      setImporting(false);
    }
  }

  async function renumerarRutas() {
    const snapshot = await getDocs(collection(db, "clientes"));
    const grouped = new Map();

    snapshot.docs.forEach((docu) => {
      const cliente = { id: docu.id, ...docu.data() };
      const key = `${cliente.diaRuta || "martes"}|${cliente.ruta || "Ruta 1"}`;
      const items = grouped.get(key) || [];
      items.push(cliente);
      grouped.set(key, items);
    });

    for (const items of grouped.values()) {
      const ordered = items.sort((a, b) => {
        const orderDiff = Number(a.ordenVisita || 999999) - Number(b.ordenVisita || 999999);
        if (orderDiff !== 0) return orderDiff;
        return String(a.nombre || "").localeCompare(String(b.nombre || ""));
      });

      for (let index = 0; index < ordered.length; index += 450) {
        const batch = writeBatch(db);
        const chunk = ordered.slice(index, index + 450);

        chunk.forEach((cliente, chunkIndex) => {
          batch.update(doc(db, "clientes", cliente.id), {
            ordenVisita: index + chunkIndex + 1,
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }
    }
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

            <label>
              Orden de visita
              <input
                min="1"
                type="number"
                value={form.ordenVisita}
                onChange={(e) => updateField("ordenVisita", e.target.value)}
                placeholder="Ej: 6"
              />
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
          <div className="admin-section-title">
            <div>
              <h2>Importacion masiva</h2>
              <p>
                Sube un Excel con columnas orden de visita, name, phone,
                address, assigned_day, credit_limit y current_balance. El
                telefono evita duplicados.
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
                onChange={importarClientesExcel}
              />
            </label>
          </div>
          {importMessage && <p className="admin-help">{importMessage}</p>}
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Archivo de cartera por recuperar</h2>
              <p>
                Clientes en gris o perdidos organizados por dia y ruta para
                perseguir cobros delicados.
              </p>
            </div>
            <ShieldAlert size={26} />
          </div>

          {carteraPorRecuperar.length === 0 ? (
            <p className="admin-help">No hay clientes en riesgo o perdidos.</p>
          ) : (
            <div className="recovery-grid">
              {carteraPorRecuperar.slice(0, 8).map((grupo) => (
                <article className="recovery-card" key={grupo.key}>
                  <div>
                    <strong>
                      {getDiaLabel(grupo.diaRuta)} - {grupo.ruta}
                    </strong>
                    <small>
                      {grupo.riesgo} en riesgo · {grupo.perdidos} perdidos
                    </small>
                  </div>
                  <div className="recovery-card-total">
                    {money(grupo.carteraRiesgo + grupo.carteraPerdida)}
                  </div>
                  <div className="recovery-client-list">
                    {grupo.clientes
                      .sort(
                        (a, b) =>
                          Number(a.ordenVisita || 0) - Number(b.ordenVisita || 0)
                      )
                      .slice(0, 5)
                      .map((cliente) => (
                        <span key={cliente.id}>
                          #{cliente.ordenVisita || "-"} {cliente.nombre} ·{" "}
                          {money(cliente.deudaActual || 0)}
                        </span>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Acciones rápidas de recuperación</h2>
              <p>
                Clientes delicados ordenados por deuda para contactar, editar o
                recuperar sin buscarlos en toda la base.
              </p>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ruta</th>
                <th>Deuda</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesPorRecuperar.slice(0, 15).map((cliente) => {
                const whatsappUrl = buildWhatsappUrl(cliente);
                const perdido =
                  cliente.estadoCliente === "perdido" || cliente.perdido;

                return (
                  <tr key={cliente.id}>
                    <td>
                      <strong>{cliente.nombre}</strong>
                      <br />
                      <small>{cliente.telefono || "Sin telefono"}</small>
                    </td>
                    <td>
                      {getDiaLabel(cliente.diaRuta)}
                      <br />
                      <small>
                        {cliente.ruta || "Sin ruta"} #{cliente.ordenVisita || "-"}
                      </small>
                    </td>
                    <td>
                      {money(cliente.deudaActual || 0)}
                      <br />
                      <small>{cliente.diasDeuda || 0} dias</small>
                    </td>
                    <td>
                      <span className={`debt-pill ${perdido ? "negro" : "gris"}`}>
                        {perdido ? "Perdido" : "Riesgo"}
                      </span>
                    </td>
                    <td className="admin-row-actions">
                      {whatsappUrl && (
                        <a
                          aria-label="Enviar cobro por WhatsApp"
                          className="admin-icon-button"
                          href={whatsappUrl}
                          rel="noreferrer"
                          target="_blank"
                          title="WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </a>
                      )}
                      <button
                        aria-label="Editar cliente"
                        className="admin-icon-button"
                        onClick={() => editarCliente(cliente)}
                        title="Editar"
                        type="button"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        aria-label="Marcar cliente recuperado"
                        className="admin-icon-button"
                        onClick={() => cambiarEstadoCliente(cliente, "activo")}
                        title="Recuperado"
                        type="button"
                      >
                        <RotateCcw size={16} />
                      </button>
                      {!perdido && (
                        <button
                          aria-label="Pasar cliente a perdido"
                          className="admin-icon-button danger"
                          onClick={() => cambiarEstadoCliente(cliente, "perdido")}
                          title="Pasar a perdido"
                          type="button"
                        >
                          <ArchiveX size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && clientesPorRecuperar.length === 0 && (
                <tr>
                  <td colSpan="5">No hay clientes delicados por recuperar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Clientes registrados</h2>
              <p>
                {clientes.length} clientes en base operativa · {resumenRevision.borrar} para
                borrar · {resumenRevision.orden} orden pendiente · {resumenRevision.riesgo} riesgo · {resumenRevision.perdidos} perdidos
              </p>
            </div>
            <div className="admin-actions">
              <select
                className="admin-select-inline"
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="borrado">Solicitan borrar</option>
                <option value="orden">Orden por revisar</option>
                <option value="creados">Creados en ruta</option>
                <option value="riesgo">Riesgo de perdida</option>
                <option value="perdidos">Clientes perdidos</option>
              </select>
              <input
                placeholder="Buscar cliente, telefono, ruta o direccion"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ maxWidth: 380 }}
              />
            </div>
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
                      {cliente.limiteCredito > 0 && (
                        <>
                          <br />
                          <small>Limite {money(cliente.limiteCredito)}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <span
                        className={`debt-pill ${
                          cliente.estadoCliente === "perdido"
                            ? "negro"
                            : cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida
                              ? "gris"
                            : cliente.solicitudBorrado
                            ? "rojo"
                            : cliente.pendienteRevisionOrden
                              ? "amarillo"
                              : cliente.semaforoDeuda || "verde"
                        }`}
                      >
                        {cliente.estadoCliente === "perdido"
                          ? "Perdido"
                          : cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida
                            ? "Riesgo perdida"
                          : cliente.solicitudBorrado
                          ? "Revisar borrado"
                          : cliente.pendienteRevisionOrden
                            ? "Revisar orden"
                            : cliente.semaforoDeuda || "verde"}
                      </span>
                      {cliente.estadoCliente === "perdido" && (
                        <>
                          <br />
                          <small>Archivo clientes perdidos</small>
                        </>
                      )}
                      {(cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida) && (
                        <>
                          <br />
                          <small>Riesgo de perder cartera</small>
                        </>
                      )}
                      {cliente.creadoPorCarterista && (
                        <>
                          <br />
                          <small>Creado en ruta</small>
                        </>
                      )}
                    </td>
                    <td className="admin-row-actions">
                      <button
                        aria-label="Editar cliente"
                        className="admin-icon-button"
                        onClick={() => editarCliente(cliente)}
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </button>
                      {cliente.pendienteRevisionOrden && (
                        <button
                          aria-label="Aprobar orden de visita"
                          className="admin-icon-button"
                          onClick={() => aprobarOrdenCliente(cliente)}
                          title="Aprobar orden"
                        >
                          <CheckCheck size={16} />
                        </button>
                      )}
                      {cliente.solicitudBorrado && (
                        <button
                          aria-label="Quitar solicitud de borrado"
                          className="admin-icon-button"
                          onClick={() => quitarSolicitudBorrado(cliente)}
                          title="No borrar"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      {cliente.estadoCliente === "perdido" ? (
                        <button
                          aria-label="Marcar cliente recuperado"
                          className="admin-icon-button"
                          onClick={() => cambiarEstadoCliente(cliente, "activo")}
                          title="Recuperado"
                        >
                          <RotateCcw size={16} />
                        </button>
                      ) : cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida ? (
                        <>
                          <button
                            aria-label="Marcar cliente recuperado"
                            className="admin-icon-button"
                            onClick={() => cambiarEstadoCliente(cliente, "activo")}
                            title="Recuperado"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            aria-label="Pasar cliente a perdido"
                            className="admin-icon-button danger"
                            onClick={() => cambiarEstadoCliente(cliente, "perdido")}
                            title="Pasar a perdido"
                          >
                            <ArchiveX size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          aria-label="Marcar riesgo de perdida"
                          className="admin-icon-button muted"
                          onClick={() => cambiarEstadoCliente(cliente, "riesgo_perdida")}
                          title="Riesgo de perdida"
                        >
                          <ShieldAlert size={16} />
                        </button>
                      )}
                      <button
                        aria-label="Eliminar cliente definitivamente"
                        className="admin-icon-button danger"
                        onClick={() => eliminarCliente(cliente.id)}
                        title="Eliminar definitivamente"
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

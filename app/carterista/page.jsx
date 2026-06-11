"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  getDiaLabel,
  getTodayRouteDay,
  money,
  rutasBase,
  sortClientesByRoute,
} from "@/lib/operacion";
import { Plus, Search, Trash2 } from "lucide-react";

const emptyForm = {
  nombre: "",
  telefono: "",
  direccion: "",
  local: "",
};

export default function CarteristaPage() {
  const todayRouteDay = getTodayRouteDay();
  const [clientes, setClientes] = useState([]);
  const [ruta, setRuta] = useState("Ruta 1");
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
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

  const clientesRuta = useMemo(() => {
    const term = filter.trim().toLowerCase();

    return clientes
      .filter((cliente) => cliente.diaRuta === todayRouteDay && cliente.ruta === ruta)
      .filter((cliente) => {
        if (!term) return true;
        return [cliente.nombre, cliente.telefono, cliente.direccion, cliente.local]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [clientes, filter, ruta, todayRouteDay]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function agregarCliente(e) {
    e.preventDefault();
    if (!todayRouteDay) {
      alert("Hoy no hay ruta activa. Pide autorizacion al administrador.");
      return;
    }

    setSaving(true);

    try {
      const ordenVisita =
        Math.max(...clientesRuta.map((cliente) => Number(cliente.ordenVisita) || 0), 0) +
        1;

      await addDoc(collection(db, "clientes"), {
        ...form,
        diaRuta: todayRouteDay,
        ruta,
        ordenVisita,
        deudaActual: 0,
        diasDeuda: 0,
        semaforoDeuda: "verde",
        creadoPorCarterista: true,
        solicitudBorrado: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm(emptyForm);
      await cargarClientes();
    } catch (error) {
      console.error("Error agregando cliente:", error);
      alert("No se pudo agregar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function solicitarBorrado(cliente) {
    if (!confirm(`Marcar ${cliente.nombre} para revision de borrado?`)) return;

    await updateDoc(doc(db, "clientes", cliente.id), {
      solicitudBorrado: true,
      solicitudBorradoFecha: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await cargarClientes();
  }

  return (
    <main className="route-app">
      <section className="route-hero">
        <div>
          <p className="home-eyebrow">Modo carterista</p>
          <h1>Ruta de {getDiaLabel(todayRouteDay) || "hoy"}</h1>
          <p>
            Trabaja clientes del dia, agrega nuevos clientes y marca revisiones
            sin borrar informacion de cartera.
          </p>
        </div>
        <select value={ruta} onChange={(e) => setRuta(e.target.value)}>
          {rutasBase.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      {!todayRouteDay && (
        <section className="route-card route-alert">
          Hoy no hay ruta asignada automaticamente. El administrador debe
          autorizar trabajo fuera de dia.
        </section>
      )}

      <section className="route-grid">
        <form className="route-card route-form" onSubmit={agregarCliente}>
          <h2>Agregar cliente del dia</h2>
          <input
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => updateField("nombre", e.target.value)}
            required
          />
          <input
            placeholder="Telefono"
            value={form.telefono}
            onChange={(e) => updateField("telefono", e.target.value)}
          />
          <input
            placeholder="Direccion"
            value={form.direccion}
            onChange={(e) => updateField("direccion", e.target.value)}
          />
          <input
            placeholder="Local o referencia"
            value={form.local}
            onChange={(e) => updateField("local", e.target.value)}
          />
          <button disabled={saving || !todayRouteDay} type="submit">
            <Plus size={18} />
            {saving ? "Guardando..." : "Agregar cliente"}
          </button>
        </form>

        <section className="route-card">
          <div className="route-toolbar">
            <div>
              <h2>Clientes de la ruta</h2>
              <p>{clientesRuta.length} clientes para visitar</p>
            </div>
            <label>
              <Search size={17} />
              <input
                placeholder="Buscar"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
          </div>

          {loading ? (
            <p>Cargando clientes...</p>
          ) : (
            <div className="route-client-list">
              {clientesRuta.map((cliente) => (
                <article className="route-client-card" key={cliente.id}>
                  <strong>#{cliente.ordenVisita || "-"} {cliente.nombre}</strong>
                  <span>{cliente.direccion || "Sin direccion"}</span>
                  <span>{cliente.telefono || "Sin telefono"}</span>
                  <span>Debe: {money(cliente.deudaActual || 0)}</span>
                  <button
                    onClick={() => solicitarBorrado(cliente)}
                    type="button"
                  >
                    <Trash2 size={16} />
                    Solicitar borrado
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

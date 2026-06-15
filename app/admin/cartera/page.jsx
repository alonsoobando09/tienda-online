"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getCurrentEmpresaId } from "@/lib/tenant";
import { getDebtColor, getDiaLabel, money, sortClientesByRoute } from "@/lib/operacion";
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  RefreshCcw,
  Save,
  UserX,
} from "lucide-react";

function number(value) {
  return Number(value) || 0;
}

function buildWhatsappUrl(cliente) {
  const phone = String(cliente.telefono || "").replace(/\D/g, "");
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

export default function CarteraAdminPage() {
  const [clientes, setClientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    abono: "",
    ajusteDeuda: "",
    diasDeuda: "",
    nota: "",
  });

  async function cargarCartera() {
    setLoading(true);

    try {
      const empresaId = getCurrentEmpresaId();
      const [clientesSnap, movimientosSnap] = await Promise.all([
        getDocs(query(collection(db, "clientes"), where("empresaId", "==", empresaId))),
        getDocs(
          query(collection(db, "movimientosCartera"), where("empresaId", "==", empresaId))
        ),
      ]);

      setClientes(
        sortClientesByRoute(
          clientesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
        )
      );
      setMovimientos(
        movimientosSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => {
            const dateA = a.createdAt?.toMillis?.() || 0;
            const dateB = b.createdAt?.toMillis?.() || 0;
            return dateB - dateA;
          })
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarCartera();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const clientesConDeuda = useMemo(
    () => clientes.filter((cliente) => number(cliente.deudaActual) > 0),
    [clientes]
  );

  const carteraFiltrada = useMemo(() => {
    const term = search.trim().toLowerCase();

    return clientesConDeuda
      .filter((cliente) => {
        const color = cliente.semaforoDeuda || getDebtColor(cliente.diasDeuda);
        if (filter === "riesgo_perdida") {
          return cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida;
        }
        if (filter === "perdidos") return cliente.estadoCliente === "perdido";
        return filter === "todos" || color === filter;
      })
      .filter((cliente) => {
        if (!term) return true;
        return [
          cliente.nombre,
          cliente.telefono,
          cliente.direccion,
          cliente.ruta,
          cliente.diaRuta,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => number(b.deudaActual) - number(a.deudaActual));
  }, [clientesConDeuda, filter, search]);

  const resumen = useMemo(() => {
    return clientesConDeuda.reduce(
      (acc, cliente) => {
        const deuda = number(cliente.deudaActual);
        const color = cliente.semaforoDeuda || getDebtColor(cliente.diasDeuda);

        acc.total += deuda;
        acc.clientes += 1;
        acc[color] = (acc[color] || 0) + 1;
        if (number(cliente.diasDeuda) >= 30) acc.riesgo += deuda;
        if (cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida) {
          acc.riesgoMarcado += deuda;
          acc.riesgoClientes += 1;
        }
        if (cliente.estadoCliente === "perdido") {
          acc.perdidos += deuda;
          acc.perdidosClientes += 1;
        }
        return acc;
      },
      {
        total: 0,
        clientes: 0,
        verde: 0,
        amarillo: 0,
        rojo: 0,
        negro: 0,
        riesgo: 0,
        riesgoMarcado: 0,
        riesgoClientes: 0,
        perdidos: 0,
        perdidosClientes: 0,
      }
    );
  }, [clientesConDeuda]);

  const carteraPorRuta = useMemo(() => {
    const grouped = new Map();

    clientesConDeuda.forEach((cliente) => {
      const key = `${cliente.diaRuta || "sin-dia"}__${cliente.ruta || "Sin ruta"}`;
      const current =
        grouped.get(key) ||
        {
          key,
          diaRuta: cliente.diaRuta || "sin-dia",
          ruta: cliente.ruta || "Sin ruta",
          clientes: 0,
          deuda: 0,
          rojoNegro: 0,
          deudaRojoNegro: 0,
          riesgo: 0,
          deudaRiesgo: 0,
          perdidos: 0,
          deudaPerdida: 0,
          mayorDias: 0,
        };
      const deuda = number(cliente.deudaActual);
      const color = cliente.semaforoDeuda || getDebtColor(cliente.diasDeuda);
      const enRiesgo =
        cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida;
      const perdido = cliente.estadoCliente === "perdido" || cliente.perdido;

      current.clientes += 1;
      current.deuda += deuda;
      current.mayorDias = Math.max(current.mayorDias, number(cliente.diasDeuda));

      if (color === "rojo" || color === "negro") {
        current.rojoNegro += 1;
        current.deudaRojoNegro += deuda;
      }

      if (enRiesgo) {
        current.riesgo += 1;
        current.deudaRiesgo += deuda;
      }

      if (perdido) {
        current.perdidos += 1;
        current.deudaPerdida += deuda;
      }

      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        prioridad:
          item.deudaPerdida * 4 +
          item.deudaRiesgo * 3 +
          item.deudaRojoNegro * 2 +
          item.deuda,
      }))
      .sort((a, b) => b.prioridad - a.prioridad);
  }, [clientesConDeuda]);

  const selectedClient = useMemo(
    () => clientes.find((cliente) => cliente.id === selectedClientId),
    [clientes, selectedClientId]
  );

  const selectedMovimientos = useMemo(
    () =>
      movimientos
        .filter((movimiento) => movimiento.clienteId === selectedClientId)
        .slice(0, 8),
    [movimientos, selectedClientId]
  );

  function seleccionarCliente(cliente) {
    setSelectedClientId(cliente.id);
    setForm({
      abono: "",
      ajusteDeuda: "",
      diasDeuda: cliente.diasDeuda || "0",
      nota: "",
    });
  }

  async function guardarMovimiento(event) {
    event.preventDefault();
    if (!selectedClient) return;

    const abono = number(form.abono);
    const tieneAjusteManual = form.ajusteDeuda !== "";
    const ajusteDeuda = tieneAjusteManual ? number(form.ajusteDeuda) : null;
    const deudaAnterior = number(selectedClient.deudaActual);
    const nuevaDeuda =
      ajusteDeuda !== null ? Math.max(ajusteDeuda, 0) : Math.max(deudaAnterior - abono, 0);
    const diasDeuda = nuevaDeuda > 0 ? number(form.diasDeuda || selectedClient.diasDeuda) : 0;
    const nota = form.nota.trim();

    if (abono <= 0 && ajusteDeuda === null && !nota) {
      alert("Registra un abono, ajuste o nota para guardar el movimiento.");
      return;
    }

    if (abono > deudaAnterior && !tieneAjusteManual) {
      alert(
        "El abono no puede superar la deuda actual. Si necesitas corregir, usa ajuste de deuda final."
      );
      return;
    }

    setSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesion no disponible. Ingresa nuevamente.");

      const response = await fetch("/api/admin/cartera", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "movimiento",
          clienteId: selectedClient.id,
          abono,
          ajusteDeuda: form.ajusteDeuda,
          diasDeuda,
          nota,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo guardar el movimiento.");
      }

      setForm({
        abono: "",
        ajusteDeuda: nuevaDeuda || "",
        diasDeuda: diasDeuda || "0",
        nota: "",
      });
      await cargarCartera();
      setSelectedClientId(selectedClient.id);
    } catch (error) {
      console.error("Error guardando cartera:", error);
      alert(error.message || "No se pudo guardar el movimiento de cartera.");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstadoCartera(cliente, estadoCliente) {
    const labels = {
      activo: "recuperar/activar",
      riesgo_perdida: "marcar en riesgo de perdida",
      perdido: "marcar como perdido",
    };

    if (!confirm(`Deseas ${labels[estadoCliente]} a ${cliente.nombre}?`)) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesion no disponible. Ingresa nuevamente.");

      const response = await fetch("/api/admin/cartera", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "estado",
          clienteId: cliente.id,
          estadoCliente,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo cambiar el estado.");
      }

      await cargarCartera();
    } catch (error) {
      console.error("Error cambiando estado de cartera:", error);
      alert(error.message || "No se pudo cambiar el estado de cartera.");
    }
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Cartera"
        subtitle="Control de clientes que deben, edad de deuda y mensajes de cobro."
        actions={
          <button className="admin-button" disabled={loading} onClick={cargarCartera}>
            <RefreshCcw size={18} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-red">
            <h3>Cartera total</h3>
            <h2>{money(resumen.total)}</h2>
            <p>{resumen.clientes} clientes con deuda.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Riesgo 30+ dias</h3>
            <h2>{money(resumen.riesgo)}</h2>
            <p>Clientes en rojo o negro.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>15 dias</h3>
            <h2>{resumen.amarillo}</h2>
            <p>Alertas amarillas.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <h3>Al dia / 8 dias</h3>
            <h2>{resumen.verde}</h2>
            <p>Cobro normal.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card">
            <h3>Riesgo marcado</h3>
            <h2>{money(resumen.riesgoMarcado)}</h2>
            <p>{resumen.riesgoClientes} clientes marcados en gris.</p>
          </article>
          <article className="admin-card">
            <h3>Perdidos con deuda</h3>
            <h2>{money(resumen.perdidos)}</h2>
            <p>{resumen.perdidosClientes} clientes en archivo perdido.</p>
          </article>
          <article className="admin-card">
            <h3>Rojo</h3>
            <h2>{resumen.rojo}</h2>
            <p>Clientes con 30 dias o mas.</p>
          </article>
          <article className="admin-card">
            <h3>Negro</h3>
            <h2>{resumen.negro}</h2>
            <p>Clientes de mayor alerta.</p>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Prioridad por ruta</h2>
              <p>
                Ordena la cartera por dia y ruta para saber que cobros perseguir
                primero.
              </p>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Ruta</th>
                <th>Clientes</th>
                <th>Cartera</th>
                <th>Rojo/negro</th>
                <th>Riesgo</th>
                <th>Perdidos</th>
                <th>Mayor dias</th>
              </tr>
            </thead>
            <tbody>
              {carteraPorRuta.slice(0, 12).map((grupo) => (
                <tr key={grupo.key}>
                  <td>
                    <strong>{getDiaLabel(grupo.diaRuta)}</strong>
                    <br />
                    <small>{grupo.ruta}</small>
                  </td>
                  <td>{grupo.clientes}</td>
                  <td>{money(grupo.deuda)}</td>
                  <td>
                    {grupo.rojoNegro}
                    <br />
                    <small>{money(grupo.deudaRojoNegro)}</small>
                  </td>
                  <td>
                    <span className={`debt-pill ${grupo.riesgo ? "gris" : "verde"}`}>
                      {grupo.riesgo}
                    </span>
                    <br />
                    <small>{money(grupo.deudaRiesgo)}</small>
                  </td>
                  <td>
                    <span
                      className={`debt-pill ${grupo.perdidos ? "negro" : "verde"}`}
                    >
                      {grupo.perdidos}
                    </span>
                    <br />
                    <small>{money(grupo.deudaPerdida)}</small>
                  </td>
                  <td>{grupo.mayorDias}</td>
                </tr>
              ))}
              {!loading && carteraPorRuta.length === 0 && (
                <tr>
                  <td colSpan="7">No hay rutas con cartera pendiente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-grid cartera-layout" style={{ marginTop: 16 }}>
          <article className="admin-card">
            <div className="admin-section-title">
              <div>
                <h2>Movimiento de cartera</h2>
                <p>Registra abonos, ajustes y notas sin perder el historial.</p>
              </div>
            </div>

            {selectedClient ? (
              <form className="admin-form cartera-form" onSubmit={guardarMovimiento}>
                <label>
                  Cliente
                  <input readOnly value={selectedClient.nombre || ""} />
                </label>
                <label>
                  Deuda actual
                  <input readOnly value={money(selectedClient.deudaActual || 0)} />
                </label>
                <label>
                  Abono recibido
                  <input
                    min="0"
                    type="number"
                    value={form.abono}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, abono: event.target.value }))
                    }
                    placeholder="Ej: 50000"
                  />
                </label>
                <label>
                  Ajustar deuda final
                  <input
                    min="0"
                    type="number"
                    value={form.ajusteDeuda}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ajusteDeuda: event.target.value,
                      }))
                    }
                    placeholder="Dejar vacio si solo abona"
                  />
                </label>
                <label>
                  Dias de deuda
                  <input
                    min="0"
                    type="number"
                    value={form.diasDeuda}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        diasDeuda: event.target.value,
                      }))
                    }
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Nota de cobro
                  <textarea
                    rows="3"
                    value={form.nota}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, nota: event.target.value }))
                    }
                    placeholder="Ej: Abono por Nequi, prometio pagar el martes..."
                  />
                </label>
                <button className="admin-button" disabled={saving}>
                  <Save size={18} />
                  {saving ? "Guardando..." : "Guardar movimiento"}
                </button>
              </form>
            ) : (
              <p className="admin-help">
                Selecciona un cliente de la tabla para registrar abonos o notas.
              </p>
            )}
          </article>

          <article className="admin-card">
            <h2>Historial reciente</h2>
            {selectedMovimientos.length > 0 ? (
              <div className="cartera-history">
                {selectedMovimientos.map((movimiento) => (
                  <div key={movimiento.id}>
                    <strong>
                      {String(movimiento.tipo || "").replaceAll("_", " ")}{" "}
                      {movimiento.abono > 0
                        ? money(movimiento.abono || 0)
                        : movimiento.ventaDia > 0
                          ? money(movimiento.ventaDia || 0)
                          : ""}
                    </strong>
                    <span>
                      De {money(movimiento.deudaAnterior || 0)} a{" "}
                      {money(movimiento.nuevaDeuda || 0)}
                    </span>
                    {(movimiento.fiadoHoy > 0 || movimiento.pagoProductosHoy > 0) && (
                      <span>
                        Fiado {money(movimiento.fiadoHoy || 0)} / pago productos{" "}
                        {money(movimiento.pagoProductosHoy || 0)}
                      </span>
                    )}
                    {movimiento.nota && <p>{movimiento.nota}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-help">
                Sin movimientos recientes para el cliente seleccionado.
              </p>
            )}
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Clientes por cobrar</h2>
              <p>{carteraFiltrada.length} clientes visibles.</p>
            </div>
            <div className="admin-actions">
              <select
                className="admin-select-inline"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="verde">Verde</option>
                <option value="amarillo">Amarillo</option>
                <option value="rojo">Rojo</option>
                <option value="negro">Negro</option>
                <option value="riesgo_perdida">Riesgo de perdida</option>
                <option value="perdidos">Perdidos</option>
              </select>
              <input
                placeholder="Buscar cliente o ruta"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ruta</th>
                <th>Deuda</th>
                <th>Dias</th>
                <th>Estado</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {carteraFiltrada.map((cliente) => {
                const color =
                  cliente.estadoCliente === "perdido"
                    ? "negro"
                    : cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida
                      ? "gris"
                      : cliente.semaforoDeuda || getDebtColor(cliente.diasDeuda);
                const whatsappUrl = buildWhatsappUrl(cliente);

                return (
                  <tr key={cliente.id}>
                    <td>
                      <strong>{cliente.nombre}</strong>
                      <br />
                      <small>{cliente.direccion || "Sin direccion"}</small>
                    </td>
                    <td>
                      {getDiaLabel(cliente.diaRuta)}
                      <br />
                      <small>{cliente.ruta || "Sin ruta"} #{cliente.ordenVisita || "-"}</small>
                    </td>
                    <td>{money(cliente.deudaActual || 0)}</td>
                    <td>{cliente.diasDeuda || 0}</td>
                    <td>
                      <span className={`debt-pill ${color}`}>{color}</span>
                      {cliente.estadoCliente === "perdido" && (
                        <>
                          <br />
                          <small>Archivo perdido</small>
                        </>
                      )}
                      {(cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida) && (
                        <>
                          <br />
                          <small>Riesgo de perder plata</small>
                        </>
                      )}
                    </td>
                    <td className="admin-row-actions">
                      <button
                        className="admin-button secondary"
                        onClick={() => seleccionarCliente(cliente)}
                      >
                        Gestionar
                      </button>
                      {whatsappUrl ? (
                        <a className="admin-button secondary" href={whatsappUrl} target="_blank">
                          <MessageCircle size={16} />
                          WhatsApp
                        </a>
                      ) : (
                        "Sin telefono"
                      )}
                      <button
                        aria-label="Marcar riesgo de perdida"
                        className="admin-icon-button"
                        onClick={() => cambiarEstadoCartera(cliente, "riesgo_perdida")}
                        title="Riesgo de perder plata"
                        type="button"
                      >
                        <AlertTriangle size={16} />
                      </button>
                      <button
                        aria-label="Marcar cliente perdido"
                        className="admin-icon-button"
                        onClick={() => cambiarEstadoCartera(cliente, "perdido")}
                        title="Cliente perdido"
                        type="button"
                      >
                        <UserX size={16} />
                      </button>
                      <button
                        aria-label="Recuperar cliente"
                        className="admin-icon-button"
                        onClick={() => cambiarEstadoCartera(cliente, "activo")}
                        title="Recuperado / activo"
                        type="button"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && carteraFiltrada.length === 0 && (
                <tr>
                  <td colSpan="6">No hay cartera para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

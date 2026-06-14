"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { money } from "@/lib/operacion";
import { AlertTriangle, RefreshCcw, Save } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

function number(value) {
  return Number(value) || 0;
}

function getCuentaEstado(cuenta) {
  if (cuenta.estado === "pagada" || number(cuenta.saldoPendiente) <= 0) {
    return "pagada";
  }

  if (cuenta.fechaVencimiento && cuenta.fechaVencimiento < today) {
    return "vencida";
  }

  return cuenta.estado || "pendiente";
}

export default function CuentasPagarPage() {
  const [cuentas, setCuentas] = useState([]);
  const [filter, setFilter] = useState("pendientes");
  const [abonos, setAbonos] = useState({});
  const [notas, setNotas] = useState({});
  const [metodos, setMetodos] = useState({});
  const [referencias, setReferencias] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  async function cargarCuentas() {
    setLoading(true);

    try {
      const snap = await getDocs(collection(db, "cuentasPagar"));
      setCuentas(
        snap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) =>
            String(a.fechaVencimiento || "").localeCompare(
              String(b.fechaVencimiento || "")
            )
          )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarCuentas();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const cuentasFiltradas = useMemo(() => {
    return cuentas.filter((cuenta) => {
      const estado = getCuentaEstado(cuenta);
      if (filter === "todas") return true;
      if (filter === "pendientes") return estado !== "pagada";
      return estado === filter;
    });
  }, [cuentas, filter]);

  const resumen = useMemo(() => {
    return cuentas.reduce(
      (acc, cuenta) => {
        const estado = getCuentaEstado(cuenta);
        const saldo = number(cuenta.saldoPendiente);

        acc.total += number(cuenta.total);
        acc.pendiente += estado !== "pagada" ? saldo : 0;
        acc.pagado += number(cuenta.abonado);
        if (estado === "vencida") acc.vencidas += 1;
        if (number(cuenta.diferenciaFactura) !== 0) acc.facturasConDiferencia += 1;

        (cuenta.pagos || []).forEach((pago) => {
          const metodo = pago.metodo || "efectivo";
          acc.pagosPorMetodo[metodo] =
            (acc.pagosPorMetodo[metodo] || 0) + number(pago.valor);
        });
        return acc;
      },
      {
        total: 0,
        pendiente: 0,
        pagado: 0,
        vencidas: 0,
        facturasConDiferencia: 0,
        pagosPorMetodo: {},
      }
    );
  }, [cuentas]);

  const alertasPrioritarias = useMemo(() => {
    return cuentas
      .filter((cuenta) => {
        const estado = getCuentaEstado(cuenta);
        return estado === "vencida" || number(cuenta.diferenciaFactura) !== 0;
      })
      .sort((a, b) => {
        const estadoA = getCuentaEstado(a) === "vencida" ? 0 : 1;
        const estadoB = getCuentaEstado(b) === "vencida" ? 0 : 1;
        if (estadoA !== estadoB) return estadoA - estadoB;
        return number(b.saldoPendiente) - number(a.saldoPendiente);
      })
      .slice(0, 5);
  }, [cuentas]);

  const pagosPorMetodo = useMemo(
    () =>
      Object.entries(resumen.pagosPorMetodo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [resumen.pagosPorMetodo]
  );

  function updateAbono(id, value) {
    setAbonos((current) => ({ ...current, [id]: value }));
  }

  function updateNota(id, value) {
    setNotas((current) => ({ ...current, [id]: value }));
  }

  function updateMetodo(id, value) {
    setMetodos((current) => ({ ...current, [id]: value }));
  }

  function updateReferencia(id, value) {
    setReferencias((current) => ({ ...current, [id]: value }));
  }

  async function registrarAbono(cuenta) {
    const valor = number(abonos[cuenta.id]);

    if (valor <= 0) {
      alert("Escribe un valor de abono mayor a cero.");
      return;
    }

    const saldoActual = number(cuenta.saldoPendiente);
    const abonoAplicado = Math.min(valor, saldoActual);
    const nuevoSaldo = Math.max(saldoActual - abonoAplicado, 0);

    setSavingId(cuenta.id);

    try {
      await updateDoc(doc(db, "cuentasPagar", cuenta.id), {
        abonado: number(cuenta.abonado) + abonoAplicado,
        saldoPendiente: nuevoSaldo,
        estado: nuevoSaldo <= 0 ? "pagada" : "pendiente",
        pagos: arrayUnion({
          fecha: today,
          valor: abonoAplicado,
          metodo: metodos[cuenta.id] || "efectivo",
          referencia: String(referencias[cuenta.id] || "").trim(),
          nota: String(notas[cuenta.id] || "").trim(),
        }),
        updatedAt: serverTimestamp(),
      });

      setAbonos((current) => ({ ...current, [cuenta.id]: "" }));
      setNotas((current) => ({ ...current, [cuenta.id]: "" }));
      setMetodos((current) => ({ ...current, [cuenta.id]: "" }));
      setReferencias((current) => ({ ...current, [cuenta.id]: "" }));
      await cargarCuentas();
    } catch (error) {
      console.error("Error registrando abono:", error);
      alert("No se pudo registrar el abono.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Cuentas por pagar"
        subtitle="Control de deudas y abonos a proveedores por compras a credito."
        actions={
          <button className="admin-button" disabled={loading} onClick={cargarCuentas}>
            <RefreshCcw size={18} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-gold">
            <h3>Compras credito</h3>
            <h2>{money(resumen.total)}</h2>
            <p>Total registrado.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Saldo pendiente</h3>
            <h2>{money(resumen.pendiente)}</h2>
            <p>Por pagar a proveedores.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <h3>Pagado</h3>
            <h2>{money(resumen.pagado)}</h2>
            <p>Abonos registrados.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Vencidas</h3>
            <h2>{resumen.vencidas}</h2>
            <p>Cuentas fuera de fecha.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card admin-stat-red">
            <h3>Facturas con diferencia</h3>
            <h2>{resumen.facturasConDiferencia}</h2>
            <p>Revisar antes de pagar.</p>
          </article>
          <article className="admin-card">
            <h3>Metodo principal</h3>
            <h2>{pagosPorMetodo[0]?.[0] || "Sin pagos"}</h2>
            <p>{money(pagosPorMetodo[0]?.[1] || 0)} abonado.</p>
          </article>
          <article className="admin-card">
            <h3>Cuentas visibles</h3>
            <h2>{cuentasFiltradas.length}</h2>
            <p>Segun filtro actual.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Prioridad</h3>
            <h2>{alertasPrioritarias.length}</h2>
            <p>Vencidas o con diferencias.</p>
          </article>
        </section>

        {alertasPrioritarias.length > 0 && (
          <section className="admin-card" style={{ marginTop: 16 }}>
            <div className="admin-section-title">
              <div>
                <h2>Alertas para revisar antes de pagar</h2>
                <p>Facturas vencidas o con diferencia contra el calculo.</p>
              </div>
              <AlertTriangle size={26} />
            </div>
            <div className="payable-alert-list">
              {alertasPrioritarias.map((cuenta) => (
                <article key={cuenta.id}>
                  <strong>{cuenta.proveedor || "Sin proveedor"}</strong>
                  <span>{cuenta.facturaProveedor || "Sin factura"}</span>
                  <span>{getCuentaEstado(cuenta)}</span>
                  <span>{money(cuenta.saldoPendiente || 0)}</span>
                  <small>
                    Diferencia factura: {money(cuenta.diferenciaFactura || 0)}
                  </small>
                </article>
              ))}
            </div>
          </section>
        )}

        {pagosPorMetodo.length > 0 && (
          <section className="admin-card" style={{ marginTop: 16 }}>
            <h2>Pagos registrados por metodo</h2>
            <div className="payment-method-grid">
              {pagosPorMetodo.map(([metodo, valor]) => (
                <div key={metodo}>
                  <span>{metodo}</span>
                  <strong>{money(valor)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Control de pagos</h2>
              <p>{cuentasFiltradas.length} cuentas visibles.</p>
            </div>
            <select
              className="admin-select-inline"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="pendientes">Pendientes</option>
              <option value="vencida">Vencidas</option>
              <option value="pagada">Pagadas</option>
              <option value="todas">Todas</option>
            </select>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Factura</th>
                <th>Compra</th>
                <th>Vence</th>
                <th>Total</th>
                <th>Diferencia</th>
                <th>Abonado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Abono</th>
              </tr>
            </thead>
            <tbody>
              {cuentasFiltradas.map((cuenta) => {
                const estado = getCuentaEstado(cuenta);
                return (
                  <tr key={cuenta.id}>
                    <td>{cuenta.proveedor || "Sin proveedor"}</td>
                    <td>
                      {cuenta.facturaProveedor || "Sin factura"}
                      {(cuenta.pagos || []).length > 0 && (
                        <>
                          <br />
                          <small>
                            Ultimo abono:{" "}
                            {money((cuenta.pagos || []).at(-1)?.valor || 0)}{" "}
                            por {(cuenta.pagos || []).at(-1)?.metodo || "efectivo"}
                          </small>
                        </>
                      )}
                    </td>
                    <td>{cuenta.fechaCompra || ""}</td>
                    <td>{cuenta.fechaVencimiento || ""}</td>
                    <td>{money(cuenta.total || 0)}</td>
                    <td>
                      <span
                        className={`debt-pill ${
                          number(cuenta.diferenciaFactura) ? "rojo" : "verde"
                        }`}
                      >
                        {money(cuenta.diferenciaFactura || 0)}
                      </span>
                    </td>
                    <td>{money(cuenta.abonado || 0)}</td>
                    <td>{money(cuenta.saldoPendiente || 0)}</td>
                    <td>
                      <span className={`debt-pill ${estado === "vencida" ? "rojo" : estado === "pagada" ? "verde" : "amarillo"}`}>
                        {estado}
                      </span>
                    </td>
                    <td>
                      {estado === "pagada" ? (
                        "Pagada"
                      ) : (
                        <div className="payable-actions">
                          <input
                            min="0"
                            placeholder="Valor"
                            type="number"
                            value={abonos[cuenta.id] || ""}
                            onChange={(event) => updateAbono(cuenta.id, event.target.value)}
                          />
                          <input
                            placeholder="Nota"
                            value={notas[cuenta.id] || ""}
                            onChange={(event) => updateNota(cuenta.id, event.target.value)}
                          />
                          <select
                            value={metodos[cuenta.id] || "efectivo"}
                            onChange={(event) => updateMetodo(cuenta.id, event.target.value)}
                          >
                            <option value="efectivo">Efectivo</option>
                            <option value="nequi">Nequi</option>
                            <option value="daviplata">Daviplata</option>
                            <option value="bancolombia">Bancolombia</option>
                            <option value="otro">Otro</option>
                          </select>
                          <input
                            placeholder="Referencia"
                            value={referencias[cuenta.id] || ""}
                            onChange={(event) =>
                              updateReferencia(cuenta.id, event.target.value)
                            }
                          />
                          <button
                            className="admin-button"
                            disabled={savingId === cuenta.id}
                            onClick={() => registrarAbono(cuenta)}
                            type="button"
                          >
                            <Save size={16} />
                            Abonar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && cuentasFiltradas.length === 0 && (
                <tr>
                  <td colSpan="10">No hay cuentas por pagar para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

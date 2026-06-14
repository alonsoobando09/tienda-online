"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { money } from "@/lib/operacion";
import { Calculator, ReceiptText, Save } from "lucide-react";

const emptyForm = {
  recepcionId: "",
  pagoDiarioAyudante: "55000",
  valorClienteAbierto: "3000",
  clientesAbiertos: "",
  carteristaAlmuerzo: "",
  carteristaPrestamos: "",
  carteristaConsumos: "",
  ayudanteAlmuerzo: "",
  ayudantePrestamos: "",
  ayudanteConsumos: "",
  observaciones: "",
};

function number(value) {
  return Number(value) || 0;
}

export default function LiquidacionesAdminPage() {
  const [recepciones, setRecepciones] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [gastosRuta, setGastosRuta] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function cargarDatos() {
    const [recepcionesSnap, liquidacionesSnap, gastosSnap] = await Promise.all([
      getDocs(collection(db, "recepciones")),
      getDocs(collection(db, "liquidaciones")),
      getDocs(collection(db, "gastosRuta")),
    ]);

    setRecepciones(
      recepcionesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
    );
    setLiquidaciones(
      liquidacionesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
    );
    setGastosRuta(gastosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const recepcionesPendientes = useMemo(
    () =>
      recepciones
        .filter((recepcion) => recepcion.estado !== "liquidado")
        .sort((a, b) =>
          String(b.fechaRecepcion || "").localeCompare(String(a.fechaRecepcion || ""))
        ),
    [recepciones]
  );

  const recepcion = useMemo(
    () => recepciones.find((item) => item.id === form.recepcionId),
    [form.recepcionId, recepciones]
  );

  const gastosRecepcion = useMemo(() => {
    if (!recepcion) return [];

    return gastosRuta
      .filter(
        (gasto) =>
          gasto.fecha === recepcion.fechaRecepcion &&
          gasto.diaRuta === recepcion.diaRuta &&
          gasto.ruta === recepcion.ruta
      )
      .sort((a, b) => String(b.createdAt?.seconds || "").localeCompare(String(a.createdAt?.seconds || "")));
  }, [gastosRuta, recepcion]);

  const resumenGastos = useMemo(() => {
    return gastosRecepcion.reduce(
      (acc, gasto) => {
        const valor = number(gasto.valor);
        const persona = gasto.persona === "ayudante" ? "ayudante" : "carterista";

        acc.total += valor;

        if (gasto.tipo === "almuerzo") acc[persona].almuerzo += valor;
        else if (gasto.tipo === "prestamo") acc[persona].prestamo += valor;
        else if (gasto.tipo === "consumo") acc[persona].consumo += valor;
        else acc.otrosRuta += valor;

        return acc;
      },
      {
        total: 0,
        otrosRuta: 0,
        carterista: { almuerzo: 0, prestamo: 0, consumo: 0 },
        ayudante: { almuerzo: 0, prestamo: 0, consumo: 0 },
      }
    );
  }, [gastosRecepcion]);

  const productosFaltantes = useMemo(() => {
    return (recepcion?.items || []).filter((item) => number(item.faltante) > 0);
  }, [recepcion]);

  const diferenciasProducto = useMemo(() => {
    return recepcion?.diferenciasProducto || [];
  }, [recepcion]);

  const calculo = useMemo(() => {
    const costoProductosDejados = (recepcion?.items || []).reduce(
      (acc, item) =>
        acc + number(item.dejadoFacturado ?? item.dejado) * number(item.costo),
      0
    );
    const valorProductosDejados = number(recepcion?.valorProductosDejados);
    const utilidadBruta = valorProductosDejados - costoProductosDejados;
    const pagoBaseAyudante = number(form.pagoDiarioAyudante);
    const bonoClientes =
      number(form.clientesAbiertos) * number(form.valorClienteAbierto);
    const totalAyudanteBruto = pagoBaseAyudante + bonoClientes;
    const gananciaDespuesAyudante = utilidadBruta - totalAyudanteBruto;
    const mitadAdministrador = gananciaDespuesAyudante / 2;
    const mitadCarterista = gananciaDespuesAyudante / 2;
    const descuentosCarterista =
      number(form.carteristaAlmuerzo) +
      number(form.carteristaPrestamos) +
      number(form.carteristaConsumos) +
      (number(recepcion?.dineroFaltante) ||
        Math.max(number(recepcion?.descuadreDinero) * -1, 0)) +
      number(recepcion?.costoFaltante);
    const descuentosAyudante =
      number(form.ayudanteAlmuerzo) +
      number(form.ayudantePrestamos) +
      number(form.ayudanteConsumos);

    return {
      valorProductosDejados,
      costoProductosDejados,
      utilidadBruta,
      pagoBaseAyudante,
      bonoClientes,
      totalAyudanteBruto,
      gananciaDespuesAyudante,
      mitadAdministrador,
      mitadCarterista,
      descuentosCarterista,
      descuentosAyudante,
      dineroFaltante:
        number(recepcion?.dineroFaltante) ||
        Math.max(number(recepcion?.descuadreDinero) * -1, 0),
      dineroSobrante:
        number(recepcion?.dineroSobrante) ||
        Math.max(number(recepcion?.descuadreDinero), 0),
      netoCarterista: mitadCarterista - descuentosCarterista,
      netoAyudante: totalAyudanteBruto - descuentosAyudante,
      netoAdministrador: mitadAdministrador,
    };
  }, [form, recepcion]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function cargarGastosRegistrados() {
    setForm((current) => ({
      ...current,
      carteristaAlmuerzo: String(resumenGastos.carterista.almuerzo || ""),
      carteristaPrestamos: String(resumenGastos.carterista.prestamo || ""),
      carteristaConsumos: String(resumenGastos.carterista.consumo || ""),
      ayudanteAlmuerzo: String(resumenGastos.ayudante.almuerzo || ""),
      ayudantePrestamos: String(resumenGastos.ayudante.prestamo || ""),
      ayudanteConsumos: String(resumenGastos.ayudante.consumo || ""),
    }));
  }

  async function guardarLiquidacion() {
    if (!recepcion) {
      alert("Selecciona una recepcion.");
      return;
    }

    setSaving(true);

    try {
      const liquidacionRef = await addDoc(collection(db, "liquidaciones"), {
        recepcionId: recepcion.id,
        despachoId: recepcion.despachoId || "",
        fecha: recepcion.fechaRecepcion || "",
        ruta: recepcion.ruta || "",
        diaRuta: recepcion.diaRuta || "",
        carteristaId: recepcion.carteristaId || "",
        carteristaNombre: recepcion.carteristaNombre || "",
        ayudanteId: recepcion.ayudanteId || "",
        ayudanteNombre: recepcion.ayudanteNombre || "",
        totalFacturasRuta: number(recepcion.totalFacturasRuta),
        totalGestionesRuta: number(recepcion.totalGestionesRuta),
        clientesVisitadosRuta: number(recepcion.clientesVisitadosRuta),
        clientesNoDisponiblesRuta: number(recepcion.clientesNoDisponiblesRuta),
        clientesRiesgoRuta: number(recepcion.clientesRiesgoRuta),
        deudaGestionadaRuta: number(recepcion.deudaGestionadaRuta),
        resumenGestionesRuta: recepcion.resumenGestionesRuta || {},
        gestionesRutaIds: recepcion.gestionesRutaIds || [],
        auditoriaEstado: recepcion.auditoriaEstado || "",
        auditoriaAlertas: recepcion.auditoriaAlertas || [],
        diferenciasProducto,
        diferenciaDejadoFacturado: number(recepcion.diferenciaDejadoFacturado),
        totalDejadoFacturado: number(recepcion.totalDejadoFacturado),
        valorProductosDejados: calculo.valorProductosDejados,
        costoProductosDejados: calculo.costoProductosDejados,
        utilidadBruta: calculo.utilidadBruta,
        dineroEntregado: number(recepcion.dineroEntregado),
        pagosRuta: recepcion.pagosRuta || {
          efectivo: number(recepcion.dineroEntregado),
          total: number(recepcion.dineroEntregado),
        },
        gastosRuta: number(recepcion.gastosRuta),
        prestamosRuta: number(recepcion.prestamos),
        descuadreDinero: number(recepcion.descuadreDinero),
        dineroFaltante: calculo.dineroFaltante,
        dineroSobrante: calculo.dineroSobrante,
        costoFaltante: number(recepcion.costoFaltante),
        productosFaltantes: productosFaltantes.map((item) => ({
          productoId: item.productoId,
          nombre: item.nombre,
          sku: item.sku || "",
          cantidad: number(item.cantidad),
          devuelto: number(item.devuelto),
          dejado: number(item.dejado),
          faltante: number(item.faltante),
          costo: number(item.costo),
          costoFaltante: number(item.costoFaltante),
        })),
        pagoBaseAyudante: calculo.pagoBaseAyudante,
        clientesAbiertos: number(form.clientesAbiertos),
        valorClienteAbierto: number(form.valorClienteAbierto),
        bonoClientes: calculo.bonoClientes,
        totalAyudanteBruto: calculo.totalAyudanteBruto,
        gananciaDespuesAyudante: calculo.gananciaDespuesAyudante,
        mitadAdministrador: calculo.mitadAdministrador,
        mitadCarterista: calculo.mitadCarterista,
        descuentosCarterista: calculo.descuentosCarterista,
        descuentosAyudante: calculo.descuentosAyudante,
        netoCarterista: calculo.netoCarterista,
        netoAyudante: calculo.netoAyudante,
        netoAdministrador: calculo.netoAdministrador,
        detalleDescuentos: {
          carteristaAlmuerzo: number(form.carteristaAlmuerzo),
          carteristaPrestamos: number(form.carteristaPrestamos),
          carteristaConsumos: number(form.carteristaConsumos),
          ayudanteAlmuerzo: number(form.ayudanteAlmuerzo),
          ayudantePrestamos: number(form.ayudantePrestamos),
          ayudanteConsumos: number(form.ayudanteConsumos),
        },
        gastosRutaRegistrados: gastosRecepcion.map((gasto) => gasto.id),
        resumenGastosRuta: {
          total: resumenGastos.total,
          otrosRuta: resumenGastos.otrosRuta,
          carterista: resumenGastos.carterista,
          ayudante: resumenGastos.ayudante,
        },
        observaciones: form.observaciones.trim(),
        estado: "liquidado",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "recepciones", recepcion.id), {
        estado: "liquidado",
        liquidacionId: liquidacionRef.id,
        updatedAt: serverTimestamp(),
      });

      setForm(emptyForm);
      await cargarDatos();
    } catch (error) {
      console.error("Error guardando liquidacion:", error);
      alert("No se pudo guardar la liquidacion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Liquidacion diaria"
        subtitle="Calcula ganancias, pagos, descuentos y descuadres por ruta."
        actions={
          <button className="admin-button" disabled={saving} onClick={guardarLiquidacion}>
            <Save size={18} />
            {saving ? "Guardando..." : "Guardar liquidacion"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Utilidad bruta</h3>
            <h2>{money(calculo.utilidadBruta)}</h2>
            <p>Venta dejada menos costo.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Ayudante</h3>
            <h2>{money(calculo.totalAyudanteBruto)}</h2>
            <p>Dia + clientes abiertos.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Carterista neto</h3>
            <h2>{money(calculo.netoCarterista)}</h2>
            <p>50% menos descuentos.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Administrador</h3>
            <h2>{money(calculo.netoAdministrador)}</h2>
            <p>50% despues de ayudante.</p>
          </article>
        </section>

        <section className="admin-card admin-accent-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Base de liquidacion</h2>
              <p>Selecciona una recepcion nocturna pendiente de liquidar.</p>
            </div>
            <Calculator size={28} />
          </div>

          {recepcion && (
            <div className="route-expense-panel">
              <div>
                <h3>Gastos registrados por la ruta</h3>
                <p>
                  {gastosRecepcion.length} movimientos guardados -{" "}
                  {money(resumenGastos.total)}
                </p>
              </div>
              <button
                className="admin-button secondary"
                disabled={!gastosRecepcion.length}
                onClick={cargarGastosRegistrados}
                type="button"
              >
                <ReceiptText size={18} />
                Cargar gastos
              </button>
            </div>
          )}

          <div className="admin-form">
            <label style={{ gridColumn: "1 / -1" }}>
              Recepcion
              <select
                value={form.recepcionId}
                onChange={(e) => updateField("recepcionId", e.target.value)}
              >
                <option value="">Seleccionar recepcion</option>
                {recepcionesPendientes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fechaRecepcion} - {item.ruta} -{" "}
                    {item.carteristaNombre || "Sin carterista"} -{" "}
                    {money(item.valorProductosDejados || 0)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Pago diario ayudante
              <input
                type="number"
                value={form.pagoDiarioAyudante}
                onChange={(e) => updateField("pagoDiarioAyudante", e.target.value)}
              />
            </label>
            <label>
              Valor cliente abierto
              <input
                type="number"
                value={form.valorClienteAbierto}
                onChange={(e) => updateField("valorClienteAbierto", e.target.value)}
              />
            </label>
            <label>
              Clientes abiertos
              <input
                type="number"
                value={form.clientesAbiertos}
                onChange={(e) => updateField("clientesAbiertos", e.target.value)}
              />
            </label>
            <label>
              Almuerzo carterista
              <input
                type="number"
                value={form.carteristaAlmuerzo}
                onChange={(e) => updateField("carteristaAlmuerzo", e.target.value)}
              />
            </label>
            <label>
              Prestamos carterista
              <input
                type="number"
                value={form.carteristaPrestamos}
                onChange={(e) => updateField("carteristaPrestamos", e.target.value)}
              />
            </label>
            <label>
              Consumos carterista
              <input
                type="number"
                value={form.carteristaConsumos}
                onChange={(e) => updateField("carteristaConsumos", e.target.value)}
              />
            </label>
            <label>
              Almuerzo ayudante
              <input
                type="number"
                value={form.ayudanteAlmuerzo}
                onChange={(e) => updateField("ayudanteAlmuerzo", e.target.value)}
              />
            </label>
            <label>
              Prestamos ayudante
              <input
                type="number"
                value={form.ayudantePrestamos}
                onChange={(e) => updateField("ayudantePrestamos", e.target.value)}
              />
            </label>
            <label>
              Consumos ayudante
              <input
                type="number"
                value={form.ayudanteConsumos}
                onChange={(e) => updateField("ayudanteConsumos", e.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea
                rows="2"
                value={form.observaciones}
                onChange={(e) => updateField("observaciones", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="liquidation-grid">
          <article className="admin-card">
            <h2>Resumen de ruta</h2>
            <div className="liquidation-lines">
              <span>Productos dejados</span>
              <strong>{money(calculo.valorProductosDejados)}</strong>
              <span>Costo productos dejados</span>
              <strong>{money(calculo.costoProductosDejados)}</strong>
              <span>Descuadre dinero</span>
              <strong>{money(recepcion?.descuadreDinero || 0)}</strong>
              <span>Plata faltante</span>
              <strong>{money(calculo.dineroFaltante)}</strong>
              <span>Plata sobrante</span>
              <strong>{money(calculo.dineroSobrante)}</strong>
              <span>Costo faltante productos</span>
              <strong>{money(recepcion?.costoFaltante || 0)}</strong>
              <span>Facturas ruta</span>
              <strong>{recepcion?.totalFacturasRuta || 0}</strong>
              <span>Gestiones ruta</span>
              <strong>{recepcion?.totalGestionesRuta || 0}</strong>
              <span>Visitados / no disponibles</span>
              <strong>
                {recepcion?.clientesVisitadosRuta || 0} /{" "}
                {recepcion?.clientesNoDisponiblesRuta || 0}
              </strong>
              <span>Riesgo ruta</span>
              <strong>{recepcion?.clientesRiesgoRuta || 0}</strong>
              <span>Estado auditoria</span>
              <strong>{recepcion?.auditoriaEstado || "Sin auditoria"}</strong>
              <span>Diferencia surtido</span>
              <strong>{recepcion?.diferenciaDejadoFacturado || 0}</strong>
            </div>
            {recepcion?.auditoriaAlertas?.length > 0 && (
              <div className="audit-alerts" style={{ marginTop: 12 }}>
                {recepcion.auditoriaAlertas.map((alerta) => (
                  <span key={alerta}>{alerta}</span>
                ))}
              </div>
            )}
          </article>

          <article className="admin-card">
            <h2>Pagos recibidos</h2>
            <div className="liquidation-lines">
              <span>Efectivo</span>
              <strong>{money(recepcion?.pagosRuta?.efectivo || 0)}</strong>
              <span>Nequi</span>
              <strong>{money(recepcion?.pagosRuta?.nequi || 0)}</strong>
              <span>Daviplata</span>
              <strong>{money(recepcion?.pagosRuta?.daviplata || 0)}</strong>
              <span>Bancolombia</span>
              <strong>{money(recepcion?.pagosRuta?.bancolombia || 0)}</strong>
              <span>Otros</span>
              <strong>{money(recepcion?.pagosRuta?.otros || 0)}</strong>
              <span>Total recibido</span>
              <strong>{money(recepcion?.pagosRuta?.total || recepcion?.dineroEntregado || 0)}</strong>
              <span>Referencia</span>
              <strong>{recepcion?.pagosRuta?.referencia || "Sin referencia"}</strong>
            </div>
          </article>

          <article className="admin-card">
            <h2>Gastos registrados</h2>
            <div className="liquidation-lines">
              <span>Carterista almuerzo</span>
              <strong>{money(resumenGastos.carterista.almuerzo)}</strong>
              <span>Carterista prestamos</span>
              <strong>{money(resumenGastos.carterista.prestamo)}</strong>
              <span>Carterista consumos</span>
              <strong>{money(resumenGastos.carterista.consumo)}</strong>
              <span>Ayudante almuerzo</span>
              <strong>{money(resumenGastos.ayudante.almuerzo)}</strong>
              <span>Ayudante prestamos</span>
              <strong>{money(resumenGastos.ayudante.prestamo)}</strong>
              <span>Ayudante consumos</span>
              <strong>{money(resumenGastos.ayudante.consumo)}</strong>
              <span>Otros ruta</span>
              <strong>{money(resumenGastos.otrosRuta)}</strong>
            </div>
          </article>

          <article className="admin-card">
            <h2>Resultado</h2>
            <div className="liquidation-lines">
              <span>Ganancia despues de ayudante</span>
              <strong>{money(calculo.gananciaDespuesAyudante)}</strong>
              <span>Mitad carterista</span>
              <strong>{money(calculo.mitadCarterista)}</strong>
              <span>Plata faltante</span>
              <strong>{money(calculo.dineroFaltante)}</strong>
              <span>Plata sobrante</span>
              <strong>{money(calculo.dineroSobrante)}</strong>
              <span>Descuentos carterista</span>
              <strong>{money(calculo.descuentosCarterista)}</strong>
              <span>Neto carterista</span>
              <strong>{money(calculo.netoCarterista)}</strong>
              <span>Neto ayudante</span>
              <strong>{money(calculo.netoAyudante)}</strong>
            </div>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Productos faltantes al carterista</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Salio</th>
                <th>Dejado</th>
                <th>Devuelto</th>
                <th>Faltante</th>
                <th>Costo faltante</th>
              </tr>
            </thead>
            <tbody>
              {productosFaltantes.map((item) => (
                <tr key={item.productoId}>
                  <td>
                    <strong>{item.nombre}</strong>
                    <br />
                    <small>{item.sku || "Sin codigo"}</small>
                  </td>
                  <td>{number(item.cantidad)}</td>
                  <td>{number(item.dejado)}</td>
                  <td>{number(item.devuelto)}</td>
                  <td>
                    <span className="debt-pill rojo">{number(item.faltante)}</span>
                  </td>
                  <td>{money(item.costoFaltante || 0)}</td>
                </tr>
              ))}
              {productosFaltantes.length === 0 && (
                <tr>
                  <td colSpan="6">No hay productos faltantes en esta recepcion.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Auditoria completa de surtido</h2>
          <p className="admin-help">
            Compara lo dejado fisicamente contra lo facturado por clientes.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Salio</th>
                <th>Devuelto</th>
                <th>Fisico</th>
                <th>Facturado</th>
                <th>Diferencia</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {diferenciasProducto.map((item) => (
                <tr key={item.productoId}>
                  <td>
                    <strong>{item.nombre}</strong>
                    <br />
                    <small>{item.sku || "Sin codigo"}</small>
                  </td>
                  <td>{number(item.salio)}</td>
                  <td>{number(item.devuelto)}</td>
                  <td>{number(item.dejadoFisico)}</td>
                  <td>{number(item.facturado)}</td>
                  <td>
                    <span className="debt-pill rojo">{number(item.diferencia)}</span>
                  </td>
                  <td>{item.tipo || "Diferencia"}</td>
                </tr>
              ))}
              {diferenciasProducto.length === 0 && (
                <tr>
                  <td colSpan="7">La auditoria de surtido esta cuadrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Liquidaciones recientes</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ruta</th>
                <th>Carterista</th>
                <th>Utilidad</th>
                <th>Gestiones</th>
                <th>Riesgo</th>
                <th>Falta plata</th>
                <th>Carterista</th>
                <th>Ayudante</th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.slice(-10).reverse().map((item) => (
                <tr key={item.id}>
                  <td>{item.fecha}</td>
                  <td>{item.ruta}</td>
                  <td>{item.carteristaNombre || "Sin carterista"}</td>
                  <td>{money(item.utilidadBruta || 0)}</td>
                  <td>
                    {(item.clientesVisitadosRuta || 0)} /{" "}
                    {(item.totalGestionesRuta || 0)}
                  </td>
                  <td>
                    <span
                      className={`debt-pill ${
                        item.clientesRiesgoRuta ? "gris" : "verde"
                      }`}
                    >
                      {item.clientesRiesgoRuta || 0}
                    </span>
                  </td>
                  <td>{money(item.dineroFaltante || Math.max((Number(item.descuadreDinero) || 0) * -1, 0))}</td>
                  <td>{money(item.netoCarterista || 0)}</td>
                  <td>{money(item.netoAyudante || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

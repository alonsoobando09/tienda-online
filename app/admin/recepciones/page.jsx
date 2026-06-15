"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { money } from "@/lib/operacion";
import { ReceiptText, Save } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

const emptyCash = {
  efectivo: "",
  nequi: "",
  daviplata: "",
  bancolombia: "",
  otrosPagos: "",
  referenciaPagos: "",
  gastosRuta: "",
  prestamos: "",
  observaciones: "",
};

function number(value) {
  return Number(value) || 0;
}

export default function RecepcionesAdminPage() {
  const [despachos, setDespachos] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [facturasRuta, setFacturasRuta] = useState([]);
  const [gastosRuta, setGastosRuta] = useState([]);
  const [gestionesRuta, setGestionesRuta] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [items, setItems] = useState([]);
  const [cash, setCash] = useState(emptyCash);
  const [saving, setSaving] = useState(false);

  async function cargarDatos() {
    const [
      despachosSnap,
      recepcionesSnap,
      facturasSnap,
      gastosSnap,
      gestionesSnap,
    ] = await Promise.all([
      getDocs(collection(db, "despachos")),
      getDocs(collection(db, "recepciones")),
      getDocs(collection(db, "facturasRuta")),
      getDocs(collection(db, "gastosRuta")),
      getDocs(collection(db, "gestionesRuta")),
    ]);

    const data = despachosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    setDespachos(data);
    setRecepciones(
      recepcionesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
    );
    setFacturasRuta(
      facturasSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
    );
    setGastosRuta(gastosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    setGestionesRuta(
      gestionesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
    );
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const despacho = useMemo(
    () => despachos.find((item) => item.id === selectedId),
    [despachos, selectedId]
  );

  const despachosAbiertos = useMemo(
    () =>
      despachos
        .filter((item) => item.estado !== "recibido")
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || ""))),
    [despachos]
  );

  const facturasDelDespacho = useMemo(() => {
    if (!despacho) return [];

    return facturasRuta.filter(
      (factura) =>
        factura.fecha === despacho.fecha &&
        factura.ruta === despacho.ruta &&
        factura.diaRuta === despacho.diaRuta
    );
  }, [despacho, facturasRuta]);

  const resumenFacturado = useMemo(() => {
    return facturasDelDespacho.reduce(
      (acc, factura) => {
        acc.facturas += 1;
        acc.valor += Number(factura.totalProductos) || 0;
        acc.abonos += Number(factura.abonoDeudaAnterior) || 0;
        acc.pagosHoy += Number(factura.pagoProductosHoy) || 0;
        acc.fiado += Number(factura.fiadoHoy) || 0;
        return acc;
      },
      { facturas: 0, valor: 0, abonos: 0, pagosHoy: 0, fiado: 0 }
    );
  }, [facturasDelDespacho]);

  const gastosDelDespacho = useMemo(() => {
    if (!despacho) return [];

    return gastosRuta
      .filter(
        (gasto) =>
          gasto.fecha === despacho.fecha &&
          gasto.ruta === despacho.ruta &&
          gasto.diaRuta === despacho.diaRuta
      )
      .sort((a, b) => String(b.createdAt?.seconds || "").localeCompare(String(a.createdAt?.seconds || "")));
  }, [despacho, gastosRuta]);

  const resumenGastosRegistrados = useMemo(() => {
    return gastosDelDespacho.reduce(
      (acc, gasto) => {
        const valor = number(gasto.valor);
        const persona = gasto.persona === "ayudante" ? "ayudante" : "carterista";

        acc.total += valor;
        acc[persona].total += valor;

        if (gasto.tipo === "prestamo") {
          acc.prestamos += valor;
          acc[persona].prestamos += valor;
        } else if (gasto.tipo === "consumo") {
          acc.consumos += valor;
          acc[persona].consumos += valor;
        } else {
          acc.gastosCaja += valor;
          acc[persona].gastosCaja += valor;
        }

        return acc;
      },
      {
        total: 0,
        gastosCaja: 0,
        prestamos: 0,
        consumos: 0,
        carterista: { total: 0, gastosCaja: 0, prestamos: 0, consumos: 0 },
        ayudante: { total: 0, gastosCaja: 0, prestamos: 0, consumos: 0 },
      }
    );
  }, [gastosDelDespacho]);

  const gestionesDelDespacho = useMemo(() => {
    if (!despacho) return [];

    return gestionesRuta
      .filter(
        (gestion) =>
          gestion.fecha === despacho.fecha &&
          gestion.ruta === despacho.ruta &&
          gestion.diaRuta === despacho.diaRuta
      )
      .sort((a, b) =>
        String(b.createdAt?.seconds || "").localeCompare(
          String(a.createdAt?.seconds || "")
        )
      );
  }, [despacho, gestionesRuta]);

  const resumenGestiones = useMemo(() => {
    return gestionesDelDespacho.reduce(
      (acc, gestion) => {
        const estado = gestion.estadoVisita || "pendiente";
        acc.total += 1;
        acc[estado] = (acc[estado] || 0) + 1;
        acc.deuda += number(gestion.deudaActual);
        if (gestion.carteristaNombre) acc.carteristas.add(gestion.carteristaNombre);
        return acc;
      },
      {
        total: 0,
        pendiente: 0,
        visitado: 0,
        no_encontrado: 0,
        riesgo_perdida: 0,
        deuda: 0,
        carteristas: new Set(),
      }
    );
  }, [gestionesDelDespacho]);

  const facturadoPorProducto = useMemo(() => {
    const totals = new Map();

    facturasDelDespacho.forEach((factura) => {
      (factura.items || []).forEach((item) => {
        const current = totals.get(item.productoId) || {
          cantidad: 0,
          valor: 0,
        };
        const cantidad = number(item.cantidad);
        const valor = number(item.subtotal) || cantidad * number(item.precio);

        totals.set(item.productoId, {
          cantidad: current.cantidad + cantidad,
          valor: current.valor + valor,
        });
      });
    });

    return totals;
  }, [facturasDelDespacho]);

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const cantidad = number(item.cantidad);
        const devuelto = number(item.devuelto);
        const dejadoFisico = cantidad - devuelto;
        const facturado = facturadoPorProducto.get(item.productoId) || {
          cantidad: 0,
          valor: 0,
        };
        const diferencia = dejadoFisico - facturado.cantidad;
        const faltante = Math.max(diferencia, 0);
        const precio = number(item.precioDetal);
        const costo = number(item.costo);

        acc.despachado += cantidad;
        acc.devuelto += devuelto;
        acc.dejadoFisico += dejadoFisico;
        acc.dejadoFacturado += facturado.cantidad;
        acc.diferencia += diferencia;
        acc.faltante += faltante;
        acc.valorFisicoEstimado += dejadoFisico * precio;
        acc.valorFacturado += facturado.valor;
        acc.costoFaltante += faltante * costo;
        return acc;
      },
      {
        despachado: 0,
        devuelto: 0,
        dejadoFisico: 0,
        dejadoFacturado: 0,
        diferencia: 0,
        faltante: 0,
        valorFisicoEstimado: 0,
        valorFacturado: 0,
        costoFaltante: 0,
      }
    );
  }, [facturadoPorProducto, items]);

  const totalPagosRecibidos =
    number(cash.efectivo) +
    number(cash.nequi) +
    number(cash.daviplata) +
    number(cash.bancolombia) +
    number(cash.otrosPagos);

  const dineroEsperado =
    resumenFacturado.abonos + resumenFacturado.pagosHoy;

  const descuadreDinero =
    totalPagosRecibidos +
    number(cash.gastosRuta) +
    number(cash.prestamos) -
    dineroEsperado;
  const dineroFaltante = Math.max(descuadreDinero * -1, 0);
  const dineroSobrante = Math.max(descuadreDinero, 0);

  const auditoria = useMemo(() => {
    const diferenciasProducto = items
      .map((item) => {
        const cantidad = number(item.cantidad);
        const devuelto = number(item.devuelto);
        const dejadoFisico = cantidad - devuelto;
        const facturado = facturadoPorProducto.get(item.productoId) || {
          cantidad: 0,
          valor: 0,
        };
        const diferencia = dejadoFisico - facturado.cantidad;

        return {
          productoId: item.productoId,
          nombre: item.nombre,
          sku: item.sku || "",
          salio: cantidad,
          devuelto,
          dejadoFisico,
          facturado: facturado.cantidad,
          diferencia,
          tipo:
            diferencia > 0
              ? "Surtido sin facturar"
              : diferencia < 0
                ? "Facturado mayor al conteo"
                : "Cuadrado",
        };
      })
      .filter((item) => item.diferencia !== 0);

    const devolucionesInvalidas = items.filter(
      (item) => number(item.devuelto) > number(item.cantidad)
    );
    const alertas = [];

    if (!despacho) alertas.push("Selecciona un despacho abierto.");
    if (devolucionesInvalidas.length > 0) {
      alertas.push("Hay devoluciones mayores a la cantidad despachada.");
    }
    if (diferenciasProducto.length > 0) {
      alertas.push("Hay descuadres de surtido entre conteo fisico y facturas.");
    }
    if (descuadreDinero !== 0) {
      alertas.push("Hay descuadre de dinero frente al cobro esperado.");
    }
    if (despacho && facturasDelDespacho.length === 0) {
      alertas.push("No hay facturas de ruta asociadas a este despacho.");
    }
    if (despacho && gestionesDelDespacho.length === 0) {
      alertas.push("No hay gestiones de clientes asociadas a este despacho.");
    }
    if (resumenGestiones.riesgo_perdida > 0) {
      alertas.push("Hay clientes marcados en riesgo de perdida durante la ruta.");
    }

    return {
      diferenciasProducto,
      devolucionesInvalidas,
      alertas,
      estado:
        alertas.length === 0
          ? "cuadrado"
          : devolucionesInvalidas.length > 0
            ? "bloqueado"
            : "con_alertas",
    };
  }, [
    descuadreDinero,
    despacho,
    facturadoPorProducto,
    facturasDelDespacho.length,
    gestionesDelDespacho.length,
    items,
    resumenGestiones.riesgo_perdida,
  ]);

  function seleccionarDespacho(id) {
    setSelectedId(id);
    const current = despachos.find((item) => item.id === id);
    setItems(
      (current?.items || []).map((item) => ({
        ...item,
        devuelto: "",
      }))
    );
    setCash(emptyCash);
  }

  function updateItem(productoId, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.productoId === productoId ? { ...item, [field]: value } : item
      )
    );
  }

  function updateCash(field, value) {
    setCash((current) => ({ ...current, [field]: value }));
  }

  function cargarGastosRegistrados() {
    setCash((current) => ({
      ...current,
      gastosRuta: String(resumenGastosRegistrados.gastosCaja || ""),
      prestamos: String(resumenGastosRegistrados.prestamos || ""),
    }));
  }

  async function guardarRecepcion() {
    if (!despacho) {
      alert("Selecciona un despacho.");
      return;
    }

    if (auditoria.devolucionesInvalidas.length > 0) {
      alert("Hay productos devueltos mayores a lo que salio. Revisa el conteo.");
      return;
    }

    if (
      auditoria.alertas.length > 0 &&
      !confirm(
        "La recepcion tiene alertas de auditoria. Deseas guardarla asi para liquidarla con esos descuadres?"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const recepcionRef = doc(collection(db, "recepciones"));
      const batch = writeBatch(db);
      const cleanItems = items.map((item) => {
        const cantidad = number(item.cantidad);
        const devuelto = number(item.devuelto);
        const dejado = cantidad - devuelto;
        const facturado = facturadoPorProducto.get(item.productoId) || {
          cantidad: 0,
          valor: 0,
        };
        const diferenciaFacturado = dejado - facturado.cantidad;
        const faltante = Math.max(diferenciaFacturado, 0);

        return {
          ...item,
          cantidad,
          devuelto,
          dejado,
          dejadoFacturado: facturado.cantidad,
          valorFacturado: facturado.valor,
          diferenciaFacturado,
          faltante,
          valorDejado: dejado * number(item.precioDetal),
          costoFaltante: faltante * number(item.costo),
        };
      });

      batch.set(recepcionRef, {
        despachoId: despacho.id,
        fechaRecepcion: today,
        fechaDespacho: despacho.fecha || "",
        diaRuta: despacho.diaRuta || "",
        ruta: despacho.ruta || "",
        carteristaId: despacho.carteristaId || "",
        carteristaNombre: despacho.carteristaNombre || "",
        ayudanteId: despacho.ayudanteId || "",
        ayudanteNombre: despacho.ayudanteNombre || "",
        items: cleanItems,
        totalDespachado: resumen.despachado,
        totalDevuelto: resumen.devuelto,
        totalDejado: resumen.dejadoFisico,
        totalDejadoFacturado: resumen.dejadoFacturado,
        diferenciaDejadoFacturado: resumen.diferencia,
        totalFaltante: resumen.faltante,
        valorProductosDejados: resumenFacturado.valor,
        valorProductosDejadosFisico: resumen.valorFisicoEstimado,
        costoFaltante: resumen.costoFaltante,
        dineroEntregado: totalPagosRecibidos,
        pagosRuta: {
          efectivo: number(cash.efectivo),
          nequi: number(cash.nequi),
          daviplata: number(cash.daviplata),
          bancolombia: number(cash.bancolombia),
          otros: number(cash.otrosPagos),
          referencia: cash.referenciaPagos.trim(),
          total: totalPagosRecibidos,
        },
        dineroEsperado,
        gastosRuta: number(cash.gastosRuta),
        prestamos: number(cash.prestamos),
        gastosRutaRegistrados: gastosDelDespacho.map((gasto) => gasto.id),
        resumenGastosRuta: resumenGastosRegistrados,
        gestionesRutaIds: gestionesDelDespacho.map((gestion) => gestion.id),
        totalGestionesRuta: resumenGestiones.total,
        clientesVisitadosRuta: resumenGestiones.visitado,
        clientesNoDisponiblesRuta: resumenGestiones.no_encontrado,
        clientesRiesgoRuta: resumenGestiones.riesgo_perdida,
        deudaGestionadaRuta: resumenGestiones.deuda,
        carteristasConGestionRuta: resumenGestiones.carteristas.size,
        resumenGestionesRuta: {
          total: resumenGestiones.total,
          pendiente: resumenGestiones.pendiente,
          visitado: resumenGestiones.visitado,
          no_encontrado: resumenGestiones.no_encontrado,
          riesgo_perdida: resumenGestiones.riesgo_perdida,
          deuda: resumenGestiones.deuda,
          carteristas: resumenGestiones.carteristas.size,
        },
        descuadreDinero,
        dineroFaltante,
        dineroSobrante,
        facturasRutaIds: facturasDelDespacho.map((factura) => factura.id),
        totalFacturasRuta: resumenFacturado.facturas,
        valorFacturadoRuta: resumenFacturado.valor,
        abonosDeudaAnterior: resumenFacturado.abonos,
        pagosProductosHoy: resumenFacturado.pagosHoy,
        fiadoRuta: resumenFacturado.fiado,
        auditoriaEstado: auditoria.estado,
        auditoriaAlertas: auditoria.alertas,
        diferenciasProducto: auditoria.diferenciasProducto,
        observaciones: cash.observaciones.trim(),
        estado: "recibido",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      cleanItems.forEach((item) => {
        if (item.devuelto > 0) {
          batch.update(doc(db, "productos", item.productoId), {
            stock: increment(item.devuelto),
            updatedAt: serverTimestamp(),
          });

          batch.set(doc(collection(db, "kardex")), {
            productoId: item.productoId,
            productoNombre: item.nombre,
            tipo: "entrada_devolucion_ruta",
            cantidad: item.devuelto,
            costo: Number(item.costo) || 0,
            referenciaId: recepcionRef.id,
            despachoId: despacho.id,
            ruta: despacho.ruta || "",
            diaRuta: despacho.diaRuta || "",
            fecha: today,
            createdAt: serverTimestamp(),
          });
        }

        if (item.faltante > 0) {
          batch.set(doc(collection(db, "kardex")), {
            productoId: item.productoId,
            productoNombre: item.nombre,
            tipo: "alerta_faltante_ruta",
            cantidad: item.faltante,
            costo: Number(item.costo) || 0,
            subtotal: item.costoFaltante,
            afectaStock: false,
            referenciaId: recepcionRef.id,
            despachoId: despacho.id,
            ruta: despacho.ruta || "",
            diaRuta: despacho.diaRuta || "",
            fecha: today,
            observacion: "Faltante detectado en recepcion. No descuenta stock de nuevo.",
            createdAt: serverTimestamp(),
          });
        }
      });

      batch.update(doc(db, "despachos", despacho.id), {
        estado: "recibido",
        recepcionId: recepcionRef.id,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setSelectedId("");
      setItems([]);
      setCash(emptyCash);
      await cargarDatos();
    } catch (error) {
      console.error("Error guardando recepcion:", error);
      alert("No se pudo guardar la recepcion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard allowedRoles={["admin", "bodega"]}>
      <AdminShell
        title="Recepcion nocturna"
        subtitle="Recibe devoluciones, revisa productos dejados y detecta descuadres."
        actions={
          <button
            className="admin-button"
            disabled={saving || auditoria.estado === "bloqueado"}
            onClick={guardarRecepcion}
          >
            <Save size={18} />
            {saving
              ? "Guardando..."
              : auditoria.estado === "bloqueado"
                ? "Recepcion bloqueada"
                : "Guardar recepcion"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-blue">
            <h3>Despachado</h3>
            <h2>{resumen.despachado}</h2>
            <p>Unidades que salieron.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <h3>Devuelto</h3>
            <h2>{resumen.devuelto}</h2>
            <p>Regresa al inventario.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Dejado fisico</h3>
            <h2>{resumen.dejadoFisico}</h2>
            <p>Salio menos devuelto.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Falta plata</h3>
            <h2>{money(dineroFaltante)}</h2>
            <p>Solo esto se descuenta si falta.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card">
            <h3>Facturas ruta</h3>
            <h2>{resumenFacturado.facturas}</h2>
            <p>Facturas guardadas por el carterista.</p>
          </article>
          <article className="admin-card">
            <h3>Facturado clientes</h3>
            <h2>{money(resumenFacturado.valor)}</h2>
            <p>Productos dejados segun facturas.</p>
          </article>
          <article className="admin-card">
            <h3>Pagos hoy</h3>
            <h2>{money(resumenFacturado.pagosHoy)}</h2>
            <p>Dinero recibido por productos del dia.</p>
          </article>
          <article className="admin-card">
            <h3>Diferencia productos</h3>
            <h2>{resumen.diferencia}</h2>
            <p>Dejado fisico menos facturado.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card admin-stat-blue">
            <h3>Gestiones ruta</h3>
            <h2>{resumenGestiones.total}</h2>
            <p>{resumenGestiones.carteristas.size} carteristas reportando.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <h3>Visitados</h3>
            <h2>{resumenGestiones.visitado}</h2>
            <p>Clientes encontrados y atendidos.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>No disponibles</h3>
            <h2>{resumenGestiones.no_encontrado}</h2>
            <p>No abrieron, descanso, casa o vacaciones.</p>
          </article>
          <article className="admin-card">
            <h3>Riesgo cartera</h3>
            <h2>{resumenGestiones.riesgo_perdida}</h2>
            <p>{money(resumenGestiones.deuda)} en clientes gestionados.</p>
          </article>
        </section>

        <section className="admin-card admin-accent-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Seleccionar despacho</h2>
              <p>Solo aparecen despachos que aun no han sido recibidos.</p>
            </div>
          </div>

          <div className="admin-form">
            <label>
              Despacho abierto
              <select
                value={selectedId}
                onChange={(e) => seleccionarDespacho(e.target.value)}
              >
                <option value="">Seleccionar despacho</option>
                {despachosAbiertos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fecha} - {item.ruta} - {item.carteristaNombre || "Sin carterista"}
                  </option>
                ))}
              </select>
            </label>
            {despacho && (
              <div className="route-expense-panel" style={{ gridColumn: "1 / -1" }}>
                <div>
                  <h3>Gastos registrados en ruta</h3>
                  <p>
                    {gastosDelDespacho.length} movimientos -{" "}
                    {money(resumenGastosRegistrados.total)}
                  </p>
                  <small>
                    Caja: {money(resumenGastosRegistrados.gastosCaja)} · Prestamos:{" "}
                    {money(resumenGastosRegistrados.prestamos)} · Consumos:{" "}
                    {money(resumenGastosRegistrados.consumos)}
                  </small>
                </div>
                <button
                  className="admin-button secondary"
                  disabled={!gastosDelDespacho.length}
                  onClick={cargarGastosRegistrados}
                  type="button"
                >
                  <ReceiptText size={18} />
                  Cargar gastos
                </button>
              </div>
            )}
            <label>
              Efectivo entregado
              <input
                type="number"
                value={cash.efectivo}
                onChange={(e) => updateCash("efectivo", e.target.value)}
              />
            </label>
            <label>
              Nequi
              <input
                type="number"
                value={cash.nequi}
                onChange={(e) => updateCash("nequi", e.target.value)}
              />
            </label>
            <label>
              Daviplata
              <input
                type="number"
                value={cash.daviplata}
                onChange={(e) => updateCash("daviplata", e.target.value)}
              />
            </label>
            <label>
              Bancolombia
              <input
                type="number"
                value={cash.bancolombia}
                onChange={(e) => updateCash("bancolombia", e.target.value)}
              />
            </label>
            <label>
              Otros pagos
              <input
                type="number"
                value={cash.otrosPagos}
                onChange={(e) => updateCash("otrosPagos", e.target.value)}
              />
            </label>
            <label>
              Referencia pagos
              <input
                value={cash.referenciaPagos}
                onChange={(e) => updateCash("referenciaPagos", e.target.value)}
                placeholder="Comprobante, banco o nota"
              />
            </label>
            <label>
              Gastos ruta
              <input
                type="number"
                value={cash.gastosRuta}
                onChange={(e) => updateCash("gastosRuta", e.target.value)}
              />
              <small>Almuerzos, gasolina y gastos pagados desde la caja.</small>
            </label>
            <label>
              Prestamos
              <input
                type="number"
                value={cash.prestamos}
                onChange={(e) => updateCash("prestamos", e.target.value)}
              />
              <small>Dinero prestado desde la ruta.</small>
            </label>
            <div className="sale-summary" style={{ gridColumn: "1 / -1" }}>
              <span>Total pagos recibidos</span>
              <strong>{money(totalPagosRecibidos)}</strong>
              <span>Cobro esperado</span>
              <strong>{money(dineroEsperado)}</strong>
              <span>Valor facturado a clientes</span>
              <strong>{money(resumenFacturado.valor)}</strong>
              <span>Clientes gestionados</span>
              <strong>{resumenGestiones.total}</strong>
              <span>Visitados / riesgo</span>
              <strong>
                {resumenGestiones.visitado} / {resumenGestiones.riesgo_perdida}
              </strong>
              <span>Gastos + prestamos</span>
              <strong>
                {money(
                  number(cash.gastosRuta) + number(cash.prestamos)
                )}
              </strong>
              <span>Descuadre dinero</span>
              <strong>{money(descuadreDinero)}</strong>
              <span>Plata faltante</span>
              <strong>{money(dineroFaltante)}</strong>
              <span>Plata sobrante</span>
              <strong>{money(dineroSobrante)}</strong>
            </div>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea
                rows="2"
                value={cash.observaciones}
                onChange={(e) => updateCash("observaciones", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="admin-card audit-panel" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Auditoria de recepcion</h2>
              <p>
                Control automatico de surtido, facturas y dinero antes de guardar.
              </p>
            </div>
            <span className={`audit-status ${auditoria.estado}`}>
              {auditoria.estado === "cuadrado"
                ? "Cuadrado"
                : auditoria.estado === "bloqueado"
                  ? "Bloqueado"
                  : "Con alertas"}
            </span>
          </div>

          <div className="audit-grid">
            <div>
              <span>Surtido fisico</span>
              <strong>{resumen.dejadoFisico}</strong>
              <small>Salio menos devuelto</small>
            </div>
            <div>
              <span>Surtido facturado</span>
              <strong>{resumen.dejadoFacturado}</strong>
              <small>Productos anotados a clientes</small>
            </div>
            <div>
              <span>Diferencia surtido</span>
              <strong>{resumen.diferencia}</strong>
              <small>Fisico menos facturado</small>
            </div>
            <div>
              <span>Dinero esperado</span>
              <strong>{money(dineroEsperado)}</strong>
              <small>Abonos + pagos del dia</small>
            </div>
            <div>
              <span>Dinero recibido</span>
              <strong>{money(totalPagosRecibidos)}</strong>
              <small>Efectivo y consignaciones</small>
            </div>
            <div>
              <span>Descuadre plata</span>
              <strong>{money(descuadreDinero)}</strong>
              <small>Incluye gastos y prestamos</small>
            </div>
            <div>
              <span>Plata faltante</span>
              <strong>{money(dineroFaltante)}</strong>
              <small>Se descuenta al carterista</small>
            </div>
            <div>
              <span>Plata sobrante</span>
              <strong>{money(dineroSobrante)}</strong>
              <small>Queda como sobra reportada</small>
            </div>
          </div>

          {auditoria.alertas.length > 0 ? (
            <div className="audit-alerts">
              {auditoria.alertas.map((alerta) => (
                <span key={alerta}>{alerta}</span>
              ))}
            </div>
          ) : (
            <p className="admin-help">Recepcion cuadrada: surtido y dinero sin alertas.</p>
          )}

          {auditoria.diferenciasProducto.length > 0 && (
            <table className="admin-table audit-diff-table">
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
                {auditoria.diferenciasProducto.map((item) => (
                  <tr key={item.productoId}>
                    <td>
                      <strong>{item.nombre}</strong>
                      <br />
                      <small>{item.sku || "Sin codigo"}</small>
                    </td>
                    <td>{item.salio}</td>
                    <td>{item.devuelto}</td>
                    <td>{item.dejadoFisico}</td>
                    <td>{item.facturado}</td>
                    <td>
                      <span className="debt-pill rojo">{item.diferencia}</span>
                    </td>
                    <td>{item.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Conteo de regreso</h2>
              <p>
                Digita solo lo devuelto. Lo dejado se calcula solo:
                salio menos devuelto. Luego se compara contra lo facturado.
              </p>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Salio</th>
                <th>Devuelto</th>
                <th>Dejado automatico</th>
                <th>Facturado clientes</th>
                <th>Diferencia</th>
                <th>Valor facturado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cantidad = number(item.cantidad);
                const devuelto = number(item.devuelto);
                const dejado = cantidad - devuelto;
                const facturado = facturadoPorProducto.get(item.productoId) || {
                  cantidad: 0,
                  valor: 0,
                };
                const diferencia = dejado - facturado.cantidad;

                return (
                  <tr key={item.productoId}>
                    <td>
                      <strong>{item.nombre}</strong>
                      <br />
                      <small>{item.sku || "Sin codigo"}</small>
                    </td>
                    <td>{cantidad}</td>
                    <td>
                      <input
                        min="0"
                        max={cantidad}
                        type="number"
                        value={item.devuelto}
                        onChange={(e) =>
                          updateItem(item.productoId, "devuelto", e.target.value)
                        }
                        style={{
                          borderColor: devueltoInvalido ? "#b91c1c" : undefined,
                          width: 88,
                        }}
                      />
                      {devueltoInvalido && (
                        <small style={{ color: "#b91c1c", display: "block" }}>
                          No puede superar {cantidad}
                        </small>
                      )}
                    </td>
                    <td>{dejado}</td>
                    <td>{facturado.cantidad}</td>
                    <td>
                      <span className={`debt-pill ${diferencia ? "rojo" : "verde"}`}>
                        {diferencia}
                      </span>
                    </td>
                    <td>{money(facturado.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Recepciones recientes</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ruta</th>
                <th>Carterista</th>
                <th>Devuelto</th>
                <th>Dejado</th>
                <th>Gestiones</th>
                <th>Riesgo</th>
                <th>Falta</th>
                <th>Sobra</th>
              </tr>
            </thead>
            <tbody>
              {recepciones.slice(-10).reverse().map((item) => (
                <tr key={item.id}>
                  <td>{item.fechaRecepcion}</td>
                  <td>{item.ruta}</td>
                  <td>{item.carteristaNombre || "Sin asignar"}</td>
                  <td>{item.totalDevuelto || 0}</td>
                  <td>{money(item.valorProductosDejados || 0)}</td>
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
                  <td>{money(item.dineroSobrante || Math.max(Number(item.descuadreDinero) || 0, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

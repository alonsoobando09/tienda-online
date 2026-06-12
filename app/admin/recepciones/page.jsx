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
import { ClipboardCheck, Save } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

const emptyCash = {
  dineroEntregado: "",
  gastosRuta: "",
  prestamos: "",
  observaciones: "",
};

export default function RecepcionesAdminPage() {
  const [despachos, setDespachos] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [facturasRuta, setFacturasRuta] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [items, setItems] = useState([]);
  const [cash, setCash] = useState(emptyCash);
  const [saving, setSaving] = useState(false);

  async function cargarDatos() {
    const [despachosSnap, recepcionesSnap, facturasSnap] = await Promise.all([
      getDocs(collection(db, "despachos")),
      getDocs(collection(db, "recepciones")),
      getDocs(collection(db, "facturasRuta")),
    ]);

    const data = despachosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    setDespachos(data);
    setRecepciones(
      recepcionesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
    );
    setFacturasRuta(
      facturasSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
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

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const cantidad = Number(item.cantidad) || 0;
        const devuelto = Number(item.devuelto) || 0;
        const dejado = Number(item.dejado) || 0;
        const faltante = cantidad - devuelto - dejado;
        const precio = Number(item.precioDetal) || 0;
        const costo = Number(item.costo) || 0;

        acc.despachado += cantidad;
        acc.devuelto += devuelto;
        acc.dejado += dejado;
        acc.faltante += faltante;
        acc.valorDejado += dejado * precio;
        acc.costoFaltante += Math.max(faltante, 0) * costo;
        return acc;
      },
      {
        despachado: 0,
        devuelto: 0,
        dejado: 0,
        faltante: 0,
        valorDejado: 0,
        costoFaltante: 0,
      }
    );
  }, [items]);

  const descuadreDinero =
    Number(cash.dineroEntregado || 0) +
    Number(cash.gastosRuta || 0) +
    Number(cash.prestamos || 0) -
    resumen.valorDejado;

  function seleccionarDespacho(id) {
    setSelectedId(id);
    const current = despachos.find((item) => item.id === id);
    setItems(
      (current?.items || []).map((item) => ({
        ...item,
        devuelto: "",
        dejado: "",
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

  function cargarDejadoDesdeFacturas() {
    if (!despacho) {
      alert("Selecciona un despacho.");
      return;
    }

    if (!facturasDelDespacho.length) {
      alert("No hay facturas de ruta para este despacho.");
      return;
    }

    const totalsByProduct = new Map();

    facturasDelDespacho.forEach((factura) => {
      (factura.items || []).forEach((item) => {
        const current = totalsByProduct.get(item.productoId) || 0;
        totalsByProduct.set(
          item.productoId,
          current + (Number(item.cantidad) || 0)
        );
      });
    });

    setItems((current) =>
      current.map((item) => ({
        ...item,
        dejado: totalsByProduct.get(item.productoId) || "",
      }))
    );
  }

  async function guardarRecepcion() {
    if (!despacho) {
      alert("Selecciona un despacho.");
      return;
    }

    setSaving(true);

    try {
      const recepcionRef = doc(collection(db, "recepciones"));
      const batch = writeBatch(db);
      const cleanItems = items.map((item) => {
        const cantidad = Number(item.cantidad) || 0;
        const devuelto = Number(item.devuelto) || 0;
        const dejado = Number(item.dejado) || 0;
        const faltante = cantidad - devuelto - dejado;

        return {
          ...item,
          cantidad,
          devuelto,
          dejado,
          faltante,
          valorDejado: dejado * (Number(item.precioDetal) || 0),
          costoFaltante: Math.max(faltante, 0) * (Number(item.costo) || 0),
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
        totalDejado: resumen.dejado,
        totalFaltante: resumen.faltante,
        valorProductosDejados: resumen.valorDejado,
        costoFaltante: resumen.costoFaltante,
        dineroEntregado: Number(cash.dineroEntregado) || 0,
        gastosRuta: Number(cash.gastosRuta) || 0,
        prestamos: Number(cash.prestamos) || 0,
        descuadreDinero,
        facturasRutaIds: facturasDelDespacho.map((factura) => factura.id),
        totalFacturasRuta: resumenFacturado.facturas,
        valorFacturadoRuta: resumenFacturado.valor,
        abonosDeudaAnterior: resumenFacturado.abonos,
        pagosProductosHoy: resumenFacturado.pagosHoy,
        fiadoRuta: resumenFacturado.fiado,
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
          <button className="admin-button" disabled={saving} onClick={guardarRecepcion}>
            <Save size={18} />
            {saving ? "Guardando..." : "Guardar recepcion"}
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
            <h3>Dejado</h3>
            <h2>{money(resumen.valorDejado)}</h2>
            <p>Valor facturado/base del dia.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Descuadre</h3>
            <h2>{money(descuadreDinero)}</h2>
            <p>Plata entregada + gastos - dejado.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card">
            <h3>Facturas ruta</h3>
            <h2>{resumenFacturado.facturas}</h2>
            <p>Facturas guardadas por el carterista.</p>
          </article>
          <article className="admin-card">
            <h3>Valor facturado</h3>
            <h2>{money(resumenFacturado.valor)}</h2>
            <p>Productos dejados segun facturas.</p>
          </article>
          <article className="admin-card">
            <h3>Pagos hoy</h3>
            <h2>{money(resumenFacturado.pagosHoy)}</h2>
            <p>Dinero recibido por productos del dia.</p>
          </article>
          <article className="admin-card">
            <h3>Fiado ruta</h3>
            <h2>{money(resumenFacturado.fiado)}</h2>
            <p>Quedo pendiente de productos del dia.</p>
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
            <label>
              Dinero entregado
              <input
                type="number"
                value={cash.dineroEntregado}
                onChange={(e) => updateCash("dineroEntregado", e.target.value)}
              />
            </label>
            <label>
              Gastos ruta
              <input
                type="number"
                value={cash.gastosRuta}
                onChange={(e) => updateCash("gastosRuta", e.target.value)}
              />
            </label>
            <label>
              Prestamos
              <input
                type="number"
                value={cash.prestamos}
                onChange={(e) => updateCash("prestamos", e.target.value)}
              />
            </label>
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

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Conteo de regreso</h2>
              <p>
                Digita lo devuelto y lo dejado. El faltante se calcula
                automaticamente.
              </p>
            </div>
            <div className="admin-actions">
              <button
                className="admin-button secondary"
                onClick={cargarDejadoDesdeFacturas}
                type="button"
              >
                <ClipboardCheck size={18} />
                Cargar dejado desde facturas
              </button>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Salio</th>
                <th>Devuelto</th>
                <th>Dejado</th>
                <th>Faltante</th>
                <th>Valor dejado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cantidad = Number(item.cantidad) || 0;
                const devuelto = Number(item.devuelto) || 0;
                const dejado = Number(item.dejado) || 0;
                const faltante = cantidad - devuelto - dejado;

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
                        type="number"
                        value={item.devuelto}
                        onChange={(e) =>
                          updateItem(item.productoId, "devuelto", e.target.value)
                        }
                        style={{ width: 88 }}
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        type="number"
                        value={item.dejado}
                        onChange={(e) =>
                          updateItem(item.productoId, "dejado", e.target.value)
                        }
                        style={{ width: 88 }}
                      />
                    </td>
                    <td>
                      <span className={`debt-pill ${faltante ? "rojo" : "verde"}`}>
                        {faltante}
                      </span>
                    </td>
                    <td>{money(dejado * (Number(item.precioDetal) || 0))}</td>
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
                <th>Descuadre</th>
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
                  <td>{money(item.descuadreDinero || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

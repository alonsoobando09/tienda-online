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
  getDebtColor,
  getDiaLabel,
  getTodayRouteDay,
  money,
  rutasBase,
  sortClientesByRoute,
} from "@/lib/operacion";
import { MessageCircle, Plus, Search, Trash2, X } from "lucide-react";

const emptyForm = {
  nombre: "",
  telefono: "",
  direccion: "",
  local: "",
};

const emptyPago = {
  abonoDeudaAnterior: "",
  pagoProductosHoy: "",
  observaciones: "",
};

function getProductPrices(producto) {
  const sugerido = Number(producto.precioDetal || producto.precio || 0);
  const minimo = Number(producto.precioMinimo || producto.precioMayor || sugerido);
  const maximo = Number(producto.precioMaximo || producto.precioPacaDetal || sugerido);

  return {
    minimo: Math.min(minimo, sugerido || minimo),
    sugerido,
    maximo: Math.max(maximo, sugerido || maximo),
  };
}

export default function CarteristaPage() {
  const todayRouteDay = getTodayRouteDay();
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ruta, setRuta] = useState("Ruta 1");
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [pago, setPago] = useState(emptyPago);
  const [ultimaFactura, setUltimaFactura] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarDatos(showLoading = true) {
    if (showLoading) setLoading(true);
    const [clientesSnap, productosSnap] = await Promise.all([
      getDocs(collection(db, "clientes")),
      getDocs(collection(db, "productos")),
    ]);
    setClientes(
      sortClientesByRoute(
        clientesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
      )
    );
    setProductos(productosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos(false);
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

  const productosFiltrados = useMemo(() => {
    const term = productFilter.trim().toLowerCase();
    if (!term) return productos.slice(0, 8);

    return productos
      .filter((producto) =>
        [producto.nombre, producto.sku, producto.categoria]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      )
      .slice(0, 14);
  }, [productFilter, productos]);

  const resumenVenta = useMemo(() => {
    const totalProductos = saleItems.reduce(
      (acc, item) => acc + (Number(item.precio) || 0) * (Number(item.cantidad) || 0),
      0
    );
    const deudaAnterior = Number(selectedCliente?.deudaActual) || 0;
    const abonoAnterior = Number(pago.abonoDeudaAnterior) || 0;
    const pagoHoy = Number(pago.pagoProductosHoy) || 0;
    const deudaViejaRestante = Math.max(deudaAnterior - abonoAnterior, 0);
    const fiadoHoy = Math.max(totalProductos - pagoHoy, 0);
    const deudaFinal = deudaViejaRestante + fiadoHoy;

    return {
      totalProductos,
      deudaAnterior,
      abonoAnterior,
      pagoHoy,
      deudaViejaRestante,
      fiadoHoy,
      deudaFinal,
    };
  }, [pago.abonoDeudaAnterior, pago.pagoProductosHoy, saleItems, selectedCliente]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePago(field, value) {
    setPago((current) => ({ ...current, [field]: value }));
  }

  function seleccionarCliente(cliente) {
    setSelectedCliente(cliente);
    setSaleItems([]);
    setPago(emptyPago);
    setUltimaFactura(null);
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
      await cargarDatos();
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

    await cargarDatos();
  }

  function agregarProducto(producto, precioTipo = "sugerido") {
    const prices = getProductPrices(producto);
    const precio = prices[precioTipo] || prices.sugerido;

    setSaleItems((current) => {
      const exists = current.find((item) => item.productoId === producto.id);

      if (exists) {
        return current.map((item) =>
          item.productoId === producto.id
            ? { ...item, cantidad: Number(item.cantidad || 0) + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          sku: producto.sku || "",
          cantidad: 1,
          precio,
          precioTipo,
          minimo: prices.minimo,
          sugerido: prices.sugerido,
          maximo: prices.maximo,
        },
      ];
    });
  }

  function updateSaleItem(productoId, field, value) {
    setSaleItems((current) =>
      current.map((item) =>
        item.productoId === productoId ? { ...item, [field]: value } : item
      )
    );
  }

  function cambiarPrecio(item, precioTipo) {
    const precio = Number(item[precioTipo]) || Number(item.precio) || 0;
    updateSaleItem(item.productoId, "precioTipo", precioTipo);
    updateSaleItem(item.productoId, "precio", precio);
  }

  function eliminarProducto(productoId) {
    setSaleItems((current) => current.filter((item) => item.productoId !== productoId));
  }

  async function guardarFactura() {
    if (!selectedCliente) {
      alert("Selecciona un cliente.");
      return;
    }
    if (!saleItems.length && resumenVenta.abonoAnterior <= 0) {
      alert("Agrega productos o registra un abono.");
      return;
    }

    setSaving(true);

    try {
      const facturaPayload = {
        tipo: "ruta",
        fecha: new Date().toISOString().slice(0, 10),
        diaRuta: todayRouteDay,
        ruta,
        clienteId: selectedCliente.id,
        clienteNombre: selectedCliente.nombre || "",
        telefono: selectedCliente.telefono || "",
        direccion: selectedCliente.direccion || "",
        items: saleItems.map((item) => ({
          ...item,
          cantidad: Number(item.cantidad) || 0,
          precio: Number(item.precio) || 0,
          subtotal: (Number(item.cantidad) || 0) * (Number(item.precio) || 0),
        })),
        deudaAnterior: resumenVenta.deudaAnterior,
        abonoDeudaAnterior: resumenVenta.abonoAnterior,
        totalProductos: resumenVenta.totalProductos,
        pagoProductosHoy: resumenVenta.pagoHoy,
        fiadoHoy: resumenVenta.fiadoHoy,
        deudaFinal: resumenVenta.deudaFinal,
        observaciones: pago.observaciones.trim(),
        estado: "guardada",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const facturaRef = await addDoc(collection(db, "facturasRuta"), facturaPayload);

      const diasDeuda = resumenVenta.deudaFinal > 0 ? 1 : 0;
      await updateDoc(doc(db, "clientes", selectedCliente.id), {
        deudaActual: resumenVenta.deudaFinal,
        diasDeuda,
        semaforoDeuda: getDebtColor(diasDeuda),
        ultimaVisita: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const facturaGuardada = { id: facturaRef.id, ...facturaPayload };
      setUltimaFactura(facturaGuardada);
      setSelectedCliente((current) => ({
        ...current,
        deudaActual: resumenVenta.deudaFinal,
        diasDeuda,
        semaforoDeuda: getDebtColor(diasDeuda),
      }));
      setSaleItems([]);
      setPago(emptyPago);
      await cargarDatos(false);
    } catch (error) {
      console.error("Error guardando factura:", error);
      alert("No se pudo guardar la factura.");
    } finally {
      setSaving(false);
    }
  }

  const whatsappUrl = useMemo(() => {
    if (!ultimaFactura?.telefono) return "";

    const lines = [
      `Proveedor Central`,
      `Factura ruta ${ultimaFactura.fecha}`,
      `Cliente: ${ultimaFactura.clienteNombre}`,
      `Ruta: ${ultimaFactura.ruta}`,
      "",
      ...ultimaFactura.items.map(
        (item) =>
          `${item.nombre} x${item.cantidad} - ${money(item.subtotal)}`
      ),
      "",
      `Deuda anterior: ${money(ultimaFactura.deudaAnterior)}`,
      `Abono anterior: ${money(ultimaFactura.abonoDeudaAnterior)}`,
      `Productos de hoy: ${money(ultimaFactura.totalProductos)}`,
      `Pago hoy: ${money(ultimaFactura.pagoProductosHoy)}`,
      `Total queda debiendo: ${money(ultimaFactura.deudaFinal)}`,
      "",
      "Muchas gracias por su compra.",
    ];

    const phone = String(ultimaFactura.telefono).replace(/\D/g, "");
    return `https://wa.me/57${phone.slice(-10)}?text=${encodeURIComponent(
      lines.join("\n")
    )}`;
  }, [ultimaFactura]);

  return (
    <main className="route-app">
      <section className="route-hero">
        <div>
          <p className="home-eyebrow">Modo carterista</p>
          <h1>Ruta de {getDiaLabel(todayRouteDay) || "hoy"}</h1>
          <p>
            Visita clientes del dia, registra productos dejados, abonos, pagos
            y deuda final sin tocar deudas cerradas manualmente.
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
                <article
                  className={`route-client-card ${
                    selectedCliente?.id === cliente.id ? "active" : ""
                  }`}
                  key={cliente.id}
                >
                  <button
                    className="route-client-main"
                    onClick={() => seleccionarCliente(cliente)}
                    type="button"
                  >
                    <strong>#{cliente.ordenVisita || "-"} {cliente.nombre}</strong>
                    <span>{cliente.direccion || "Sin direccion"}</span>
                  </button>
                  <span>{cliente.telefono || "Sin telefono"}</span>
                  <span>Debe: {money(cliente.deudaActual || 0)}</span>
                  <button onClick={() => solicitarBorrado(cliente)} type="button">
                    <Trash2 size={16} />
                    Solicitar borrado
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="sale-workspace">
        <article className="route-card">
          <div className="route-toolbar">
            <div>
              <h2>Visita y factura</h2>
              <p>
                {selectedCliente
                  ? `${selectedCliente.nombre} - deuda actual ${money(
                      selectedCliente.deudaActual || 0
                    )}`
                  : "Selecciona un cliente de la ruta"}
              </p>
            </div>
            {ultimaFactura && whatsappUrl && (
              <a className="admin-button" href={whatsappUrl} target="_blank">
                <MessageCircle size={18} />
                Enviar factura
              </a>
            )}
          </div>

          <div className="sale-grid">
            <div className="sale-products">
              <label className="sale-search">
                <Search size={17} />
                <input
                  placeholder="Buscar producto"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                />
              </label>

              <div className="sale-product-list">
                {productosFiltrados.map((producto) => {
                  const prices = getProductPrices(producto);

                  return (
                    <div className="sale-product-row" key={producto.id}>
                      <div>
                        <strong>{producto.nombre}</strong>
                        <small>{producto.sku || producto.categoria || "Producto"}</small>
                      </div>
                      <div className="price-dots">
                        <button
                          className="green"
                          onClick={() => agregarProducto(producto, "minimo")}
                          type="button"
                        >
                          {money(prices.minimo)}
                        </button>
                        <button
                          className="yellow"
                          onClick={() => agregarProducto(producto, "sugerido")}
                          type="button"
                        >
                          {money(prices.sugerido)}
                        </button>
                        <button
                          className="red"
                          onClick={() => agregarProducto(producto, "maximo")}
                          type="button"
                        >
                          {money(prices.maximo)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sale-ticket">
              <h3>Productos dejados</h3>
              {saleItems.map((item) => (
                <div className="sale-ticket-row" key={item.productoId}>
                  <div>
                    <strong>{item.nombre}</strong>
                    <div className="price-dots compact">
                      {["minimo", "sugerido", "maximo"].map((tipo) => (
                        <button
                          className={
                            tipo === "minimo"
                              ? "green"
                              : tipo === "sugerido"
                                ? "yellow"
                                : "red"
                          }
                          key={tipo}
                          onClick={() => cambiarPrecio(item, tipo)}
                          type="button"
                        />
                      ))}
                    </div>
                  </div>
                  <input
                    min="1"
                    type="number"
                    value={item.cantidad}
                    onChange={(e) =>
                      updateSaleItem(item.productoId, "cantidad", e.target.value)
                    }
                  />
                  <input
                    min={item.minimo}
                    max={item.maximo}
                    type="number"
                    value={item.precio}
                    onChange={(e) =>
                      updateSaleItem(item.productoId, "precio", e.target.value)
                    }
                  />
                  <strong>{money((Number(item.precio) || 0) * (Number(item.cantidad) || 0))}</strong>
                  <button onClick={() => eliminarProducto(item.productoId)} type="button">
                    <X size={16} />
                  </button>
                </div>
              ))}

              <div className="sale-payment-grid">
                <label>
                  Abono deuda anterior
                  <input
                    type="number"
                    value={pago.abonoDeudaAnterior}
                    onChange={(e) => updatePago("abonoDeudaAnterior", e.target.value)}
                  />
                </label>
                <label>
                  Pago productos hoy
                  <input
                    type="number"
                    value={pago.pagoProductosHoy}
                    onChange={(e) => updatePago("pagoProductosHoy", e.target.value)}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Observaciones
                  <textarea
                    rows="2"
                    value={pago.observaciones}
                    onChange={(e) => updatePago("observaciones", e.target.value)}
                  />
                </label>
              </div>

              <div className="sale-summary">
                <span>Deuda anterior</span>
                <strong>{money(resumenVenta.deudaAnterior)}</strong>
                <span>Total productos hoy</span>
                <strong>{money(resumenVenta.totalProductos)}</strong>
                <span>Fiado hoy</span>
                <strong>{money(resumenVenta.fiadoHoy)}</strong>
                <span>Total queda debiendo</span>
                <strong>{money(resumenVenta.deudaFinal)}</strong>
              </div>

              <button
                className="admin-button"
                disabled={saving || !selectedCliente}
                onClick={guardarFactura}
                type="button"
              >
                {saving ? "Guardando..." : "Guardar factura"}
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

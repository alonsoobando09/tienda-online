"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { getCurrentEmpresaId } from "@/lib/tenant";
import { filterByEmpresaId } from "@/lib/firestoreTenant";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function number(value) {
  return Number(value) || 0;
}

function movementTime(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

function getStockState(producto) {
  const stock = number(producto.stock);
  const minimo = number(producto.stockMinimo) || 5;
  if (stock <= 0) return "agotado";
  if (stock <= minimo) return "bajo";
  return "ok";
}

function movementLabel(tipo) {
  const labels = {
    entrada_compra: "Compra",
    salida_despacho: "Despacho",
    entrada_devolucion_ruta: "Devolucion ruta",
    alerta_faltante_ruta: "Faltante ruta",
    ajuste_manual_entrada: "Ajuste entrada",
    ajuste_manual_salida: "Ajuste salida",
  };

  return labels[tipo] || tipo || "Movimiento";
}

export default function InventarioPage() {
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [stockFilter, setStockFilter] = useState("todos");
  const [movementFilter, setMovementFilter] = useState("todos");
  const [adjustment, setAdjustment] = useState({
    productoId: "",
    tipo: "ajuste_manual_entrada",
    cantidad: "",
    motivo: "",
  });
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  async function cargarInventario() {
    setLoading(true);

    try {
      const empresaId = getCurrentEmpresaId();
      const [productosData, kardexSnap] = await Promise.all([
        fetch("/api/productos").then((res) => res.json()),
        getDocs(collection(db, "kardex")),
      ]);

      setProductos(
        filterByEmpresaId(Array.isArray(productosData) ? productosData : [], empresaId)
      );
      setMovimientos(
        filterByEmpresaId(
          kardexSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })),
          empresaId
        )
          .sort((a, b) => movementTime(b.createdAt) - movementTime(a.createdAt))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarInventario();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const categories = useMemo(() => {
    return [...new Set(productos.map((producto) => producto.categoria || "general"))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [productos]);

  const latestMovementByProduct = useMemo(() => {
    const map = new Map();
    movimientos.forEach((movimiento) => {
      if (!movimiento.productoId || map.has(movimiento.productoId)) return;
      map.set(movimiento.productoId, movimiento);
    });
    return map;
  }, [movimientos]);

  const productosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();

    return productos
      .filter((producto) => {
        if (categoryFilter !== "todas" && producto.categoria !== categoryFilter) {
          return false;
        }

        const estado = getStockState(producto);
        if (stockFilter !== "todos" && estado !== stockFilter) return false;

        if (!term) return true;
        return [
          producto.nombre,
          producto.sku,
          producto.codigoBarras,
          producto.categoria,
          producto.proveedor,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const stateOrder = { agotado: 0, bajo: 1, ok: 2 };
        return (
          stateOrder[getStockState(a)] - stateOrder[getStockState(b)] ||
          String(a.nombre || "").localeCompare(String(b.nombre || ""))
        );
      });
  }, [categoryFilter, productos, search, stockFilter]);

  const movimientosFiltrados = useMemo(() => {
    if (movementFilter === "todos") return movimientos;
    return movimientos.filter((movimiento) => movimiento.tipo === movementFilter);
  }, [movementFilter, movimientos]);

  const resumen = useMemo(() => {
    return productos.reduce(
      (acc, producto) => {
        const stock = number(producto.stock);
        const minimo = number(producto.stockMinimo) || 5;
        const costo = number(producto.costo || producto.precioMayor);

        acc.unidades += stock;
        acc.valor += stock * costo;
        if (stock <= 0) acc.agotados += 1;
        if (stock > 0 && stock <= minimo) acc.bajo += 1;
        if (stock <= minimo) acc.alertas += 1;
        return acc;
      },
      { unidades: 0, valor: 0, alertas: 0, agotados: 0, bajo: 0 }
    );
  }, [productos]);

  const resumenKardex = useMemo(() => {
    return movimientos.reduce(
      (acc, movimiento) => {
        const cantidad = number(movimiento.cantidad);
        const subtotal =
          number(movimiento.subtotal) ||
          Math.abs(cantidad) * number(movimiento.costo);

        if (movimiento.tipo === "entrada_compra") {
          acc.entradas += cantidad;
          acc.valorEntradas += subtotal;
        }
        if (movimiento.tipo === "salida_despacho") {
          acc.salidas += Math.abs(cantidad);
          acc.valorSalidas += subtotal;
        }
        if (movimiento.tipo === "entrada_devolucion_ruta") {
          acc.devoluciones += cantidad;
        }
        if (movimiento.tipo === "alerta_faltante_ruta") {
          acc.faltantes += Math.abs(cantidad);
          acc.valorFaltantes += subtotal;
        }
        if (movimiento.tipo === "ajuste_manual_entrada") {
          acc.ajustesEntrada += cantidad;
        }
        if (movimiento.tipo === "ajuste_manual_salida") {
          acc.ajustesSalida += Math.abs(cantidad);
        }
        return acc;
      },
      {
        entradas: 0,
        salidas: 0,
        devoluciones: 0,
        faltantes: 0,
        ajustesEntrada: 0,
        ajustesSalida: 0,
        valorEntradas: 0,
        valorSalidas: 0,
        valorFaltantes: 0,
      }
    );
  }, [movimientos]);

  function updateAdjustment(field, value) {
    setAdjustment((current) => ({ ...current, [field]: value }));
  }

  async function guardarAjusteInventario(event) {
    event.preventDefault();

    const producto = productos.find((item) => item.id === adjustment.productoId);
    const cantidad = Number(adjustment.cantidad) || 0;

    if (!producto) {
      alert("Selecciona un producto para ajustar.");
      return;
    }

    if (cantidad <= 0) {
      alert("La cantidad del ajuste debe ser mayor a cero.");
      return;
    }

    if (!adjustment.motivo.trim()) {
      alert("Escribe el motivo del ajuste.");
      return;
    }

    const isSalida = adjustment.tipo === "ajuste_manual_salida";
    const delta = isSalida ? cantidad * -1 : cantidad;
    const stockActual = number(producto.stock);

    if (isSalida && cantidad > stockActual) {
      alert("No puedes sacar mas unidades que el stock actual.");
      return;
    }

    setSavingAdjustment(true);

    try {
      const batch = writeBatch(db);
      const costo = number(producto.costo || producto.precioMayor);
      const fecha = new Date().toISOString().slice(0, 10);
      const empresaId = getCurrentEmpresaId();

      batch.update(doc(db, "productos", producto.id), {
        stock: increment(delta),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(collection(db, "kardex")), {
        empresaId,
        productoId: producto.id,
        productoNombre: producto.nombre || "Producto",
        tipo: adjustment.tipo,
        cantidad: delta,
        costo,
        subtotal: Math.abs(delta) * costo,
        referenciaId: "ajuste-manual",
        observacion: adjustment.motivo.trim(),
        afectaStock: true,
        fecha,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setAdjustment({
        productoId: "",
        tipo: "ajuste_manual_entrada",
        cantidad: "",
        motivo: "",
      });
      await cargarInventario();
    } catch (error) {
      console.error("Error guardando ajuste de inventario:", error);
      alert("No se pudo guardar el ajuste.");
    } finally {
      setSavingAdjustment(false);
    }
  }

  return (
    <AdminGuard allowedRoles={["admin", "bodega"]}>
      <AdminShell
        title="Inventario"
        subtitle="Control de existencias, kardex, faltantes, devoluciones y valor de bodega."
        actions={
          <>
            <Link className="admin-button secondary" href="/admin/compras">
              Registrar compra
            </Link>
            <Link className="admin-button secondary" href="/admin/despachos">
              Despachar
            </Link>
            <button className="admin-button" disabled={loading} onClick={cargarInventario}>
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card">
            <p>Productos</p>
            <h2>{productos.length}</h2>
            <span>{categories.length} categorias.</span>
          </article>
          <article className="admin-card">
            <p>Unidades</p>
            <h2>{resumen.unidades}</h2>
          </article>
          <article className="admin-card admin-stat-green">
            <p>Valor estimado</p>
            <h2>{money.format(resumen.valor)}</h2>
          </article>
          <article className="admin-card admin-stat-red">
            <p>Alertas stock</p>
            <h2>{resumen.alertas}</h2>
            <span>{resumen.agotados} agotados / {resumen.bajo} bajos.</span>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card admin-stat-blue">
            <p>Entradas compra</p>
            <h2>{resumenKardex.entradas}</h2>
            <span>{money.format(resumenKardex.valorEntradas)}</span>
          </article>
          <article className="admin-card admin-stat-gold">
            <p>Salidas despacho</p>
            <h2>{resumenKardex.salidas}</h2>
            <span>{money.format(resumenKardex.valorSalidas)}</span>
          </article>
          <article className="admin-card">
            <p>Devoluciones ruta</p>
            <h2>{resumenKardex.devoluciones}</h2>
          </article>
          <article className="admin-card admin-stat-red">
            <p>Faltantes auditados</p>
            <h2>{resumenKardex.faltantes}</h2>
            <span>{money.format(resumenKardex.valorFaltantes)}</span>
          </article>
        </section>

        <section className="admin-card admin-accent-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Ajuste controlado de inventario</h2>
              <p>Corrige conteos fisicos dejando soporte en kardex.</p>
            </div>
          </div>

          <form className="admin-form" onSubmit={guardarAjusteInventario}>
            <label>
              Producto
              <select
                value={adjustment.productoId}
                onChange={(event) => updateAdjustment("productoId", event.target.value)}
              >
                <option value="">Seleccionar producto</option>
                {productos
                  .slice()
                  .sort((a, b) =>
                    String(a.nombre || "").localeCompare(String(b.nombre || ""))
                  )
                  .map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre} - stock {producto.stock || 0}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Tipo de ajuste
              <select
                value={adjustment.tipo}
                onChange={(event) => updateAdjustment("tipo", event.target.value)}
              >
                <option value="ajuste_manual_entrada">Entrada por conteo/sobrante</option>
                <option value="ajuste_manual_salida">Salida por perdida/dano</option>
              </select>
            </label>
            <label>
              Cantidad
              <input
                min="1"
                type="number"
                value={adjustment.cantidad}
                onChange={(event) => updateAdjustment("cantidad", event.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Motivo
              <textarea
                rows="2"
                value={adjustment.motivo}
                onChange={(event) => updateAdjustment("motivo", event.target.value)}
                placeholder="Ejemplo: conteo fisico, producto danado, sobrante encontrado..."
              />
            </label>
            <button className="admin-button" disabled={savingAdjustment} type="submit">
              {savingAdjustment ? "Guardando..." : "Guardar ajuste"}
            </button>
          </form>

          <div className="payment-method-grid" style={{ marginTop: 14 }}>
            <div>
              <span>Ajustes entrada</span>
              <strong>{resumenKardex.ajustesEntrada}</strong>
            </div>
            <div>
              <span>Ajustes salida</span>
              <strong>{resumenKardex.ajustesSalida}</strong>
            </div>
          </div>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <div>
              <h2>Existencias por producto</h2>
              <p>{productosFiltrados.length} productos visibles.</p>
            </div>
            <div className="admin-toolbar-actions">
              <input
                className="admin-input-inline"
                placeholder="Buscar producto"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="admin-select-inline"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="todas">Todas las categorias</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                className="admin-select-inline"
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
              >
                <option value="todos">Todos los stocks</option>
                <option value="agotado">Agotados</option>
                <option value="bajo">Bajo stock</option>
                <option value="ok">Stock sano</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p>Cargando inventario...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Stock</th>
                  <th>Minimo</th>
                  <th>Costo</th>
                  <th>Valor</th>
                  <th>Ultimo movimiento</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((producto) => {
                  const stock = number(producto.stock);
                  const minimo = number(producto.stockMinimo) || 5;
                  const costo = number(producto.costo || producto.precioMayor);
                  const estado = getStockState(producto);
                  const lastMovement = latestMovementByProduct.get(producto.id);

                  return (
                    <tr key={producto.id}>
                      <td>
                        <strong>{producto.nombre}</strong>
                        <small>{producto.sku || producto.codigoBarras || "Sin codigo"}</small>
                      </td>
                      <td>{producto.categoria || "general"}</td>
                      <td>
                        <span
                          className={`debt-pill ${
                            estado === "agotado"
                              ? "rojo"
                              : estado === "bajo"
                                ? "amarillo"
                                : "verde"
                          }`}
                        >
                          {stock}
                        </span>
                      </td>
                      <td>{minimo}</td>
                      <td>{money.format(costo)}</td>
                      <td>{money.format(stock * costo)}</td>
                      <td>
                        {lastMovement ? (
                          <>
                            {movementLabel(lastMovement.tipo)}
                            <small>
                              {lastMovement.fecha || ""} {lastMovement.ruta || ""}
                            </small>
                          </>
                        ) : (
                          "Sin movimiento"
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!productosFiltrados.length && (
                  <tr>
                    <td colSpan="7">No hay productos con esos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <div>
              <h2>Kardex operativo</h2>
              <p>Entradas, salidas, devoluciones y faltantes auditados.</p>
            </div>
            <select
              className="admin-select-inline"
              value={movementFilter}
              onChange={(event) => setMovementFilter(event.target.value)}
            >
              <option value="todos">Todos los movimientos</option>
              <option value="entrada_compra">Compras</option>
              <option value="salida_despacho">Despachos</option>
              <option value="entrada_devolucion_ruta">Devoluciones</option>
              <option value="alerta_faltante_ruta">Faltantes</option>
              <option value="ajuste_manual_entrada">Ajustes entrada</option>
              <option value="ajuste_manual_salida">Ajustes salida</option>
            </select>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Costo</th>
                <th>Referencia</th>
                <th>Revision</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.slice(0, 40).map((movimiento) => (
                <tr key={movimiento.id}>
                  <td>{movimiento.fecha || ""}</td>
                  <td>{movimiento.productoNombre || "Producto"}</td>
                  <td>
                    <span
                      className={`debt-pill ${
                        movimiento.tipo === "alerta_faltante_ruta"
                          ? "rojo"
                          : movimiento.tipo === "salida_despacho"
                            ? "amarillo"
                            : "verde"
                      }`}
                    >
                      {movementLabel(movimiento.tipo)}
                    </span>
                  </td>
                  <td>{movimiento.cantidad || 0}</td>
                  <td>{money.format(number(movimiento.costo))}</td>
                  <td>
                    {movimiento.proveedor ||
                      movimiento.ruta ||
                      movimiento.referenciaId ||
                      "Sin referencia"}
                    {movimiento.facturaProveedor && (
                      <small>{movimiento.facturaProveedor}</small>
                    )}
                    {movimiento.observacion && <small>{movimiento.observacion}</small>}
                  </td>
                  <td>
                    <span className="admin-pill">
                      {movimiento.estadoRevisionFactura ||
                        (movimiento.afectaStock === false ? "auditoria" : "normal")}
                    </span>
                  </td>
                </tr>
              ))}
              {!movimientosFiltrados.length && (
                <tr>
                  <td colSpan="7">Aun no hay movimientos de inventario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

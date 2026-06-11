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
import { useEmpleados } from "@/lib/useEmpleados";
import { diasRuta, money, rutasBase } from "@/lib/operacion";
import { Barcode, PackagePlus, Save, Trash2 } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

const emptyHeader = {
  fecha: today,
  diaRuta: "martes",
  ruta: "Ruta 1",
  carteristaId: "",
  ayudanteId: "",
  observaciones: "",
};

export default function DespachosAdminPage() {
  const { empleados } = useEmpleados();
  const [productos, setProductos] = useState([]);
  const [despachos, setDespachos] = useState([]);
  const [header, setHeader] = useState(emptyHeader);
  const [items, setItems] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      getDocs(collection(db, "productos")),
      getDocs(collection(db, "despachos")),
    ])
      .then(([productosSnap, despachosSnap]) => {
        if (!active) return;
        setProductos(
          productosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
        );
        setDespachos(
          despachosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const empleadosActivos = useMemo(
    () => empleados.filter((empleado) => empleado.estado !== "inactivo"),
    [empleados]
  );

  const productosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return productos.slice(0, 10);

    return productos
      .filter((producto) =>
        [producto.nombre, producto.sku, producto.categoria, producto.proveedor]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      )
      .slice(0, 20);
  }, [productos, search]);

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.cantidad += Number(item.cantidad) || 0;
        acc.costo += (Number(item.costo) || 0) * (Number(item.cantidad) || 0);
        acc.venta +=
          (Number(item.precioDetal) || 0) * (Number(item.cantidad) || 0);
        return acc;
      },
      { cantidad: 0, costo: 0, venta: 0 }
    );
  }, [items]);

  function updateHeader(field, value) {
    setHeader((current) => ({ ...current, [field]: value }));
  }

  function agregarProducto(producto) {
    setItems((current) => {
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
          categoria: producto.categoria || "",
          cantidad: 1,
          costo: Number(producto.costo || producto.precioMayor) || 0,
          precioDetal: Number(producto.precioDetal) || 0,
          stockActual: Number(producto.stock) || 0,
        },
      ];
    });
  }

  function agregarPorCodigo(e) {
    e.preventDefault();
    const code = barcode.trim().toLowerCase();
    if (!code) return;

    const producto = productos.find(
      (item) =>
        String(item.sku || "").trim().toLowerCase() === code ||
        String(item.codigoBarras || "").trim().toLowerCase() === code
    );

    if (!producto) {
      alert("No encontre producto con ese codigo.");
      return;
    }

    agregarProducto(producto);
    setBarcode("");
  }

  function updateItem(productoId, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.productoId === productoId ? { ...item, [field]: value } : item
      )
    );
  }

  function eliminarItem(productoId) {
    setItems((current) => current.filter((item) => item.productoId !== productoId));
  }

  async function guardarDespacho() {
    if (!items.length) {
      alert("Agrega productos al despacho.");
      return;
    }

    setSaving(true);

    try {
      const carterista = empleados.find(
        (empleado) => empleado.id === header.carteristaId
      );
      const ayudante = empleados.find((empleado) => empleado.id === header.ayudanteId);
      const despachoRef = doc(collection(db, "despachos"));
      const batch = writeBatch(db);

      const cleanItems = items.map((item) => ({
        ...item,
        cantidad: Number(item.cantidad) || 0,
        costo: Number(item.costo) || 0,
        precioDetal: Number(item.precioDetal) || 0,
      }));

      batch.set(despachoRef, {
        ...header,
        carteristaNombre: carterista?.nombre || "",
        ayudanteNombre: ayudante?.nombre || "",
        items: cleanItems,
        totalCantidad: resumen.cantidad,
        totalCosto: resumen.costo,
        totalVentaEstimada: resumen.venta,
        estado: "despachado",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      cleanItems.forEach((item) => {
        batch.update(doc(db, "productos", item.productoId), {
          stock: increment(-item.cantidad),
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(collection(db, "kardex")), {
          productoId: item.productoId,
          productoNombre: item.nombre,
          tipo: "salida_despacho",
          cantidad: -item.cantidad,
          costo: item.costo,
          referenciaId: despachoRef.id,
          ruta: header.ruta,
          diaRuta: header.diaRuta,
          fecha: header.fecha,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setHeader(emptyHeader);
      setItems([]);
      setSearch("");

      const despachosSnap = await getDocs(collection(db, "despachos"));
      setDespachos(despachosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    } catch (error) {
      console.error("Error guardando despacho:", error);
      alert("No se pudo guardar el despacho.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Despachos"
        subtitle="Salida de surtido desde bodega por ruta, carterista y ayudante."
        actions={
          <button className="admin-button" disabled={saving} onClick={guardarDespacho}>
            <Save size={18} />
            {saving ? "Guardando..." : "Guardar despacho"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Productos</h3>
            <h2>{items.length}</h2>
            <p>Lineas en despacho.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Cantidad</h3>
            <h2>{resumen.cantidad}</h2>
            <p>Unidades saliendo de bodega.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Costo</h3>
            <h2>{money(resumen.costo)}</h2>
            <p>Base invertida en surtido.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Venta estimada</h3>
            <h2>{money(resumen.venta)}</h2>
            <p>Valor si se deja todo.</p>
          </article>
        </section>

        <section className="admin-card admin-accent-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Datos del despacho</h2>
              <p>Define quien sale, en que ruta y que dia se esta cargando.</p>
            </div>
          </div>

          <div className="admin-form">
            <label>
              Fecha
              <input
                type="date"
                value={header.fecha}
                onChange={(e) => updateHeader("fecha", e.target.value)}
              />
            </label>
            <label>
              Dia ruta
              <select
                value={header.diaRuta}
                onChange={(e) => updateHeader("diaRuta", e.target.value)}
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
                list="rutas-despacho"
                value={header.ruta}
                onChange={(e) => updateHeader("ruta", e.target.value)}
              />
              <datalist id="rutas-despacho">
                {rutasBase.map((ruta) => (
                  <option key={ruta} value={ruta} />
                ))}
              </datalist>
            </label>
            <label>
              Carterista
              <select
                value={header.carteristaId}
                onChange={(e) => updateHeader("carteristaId", e.target.value)}
              >
                <option value="">Seleccionar</option>
                {empleadosActivos.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ayudante
              <select
                value={header.ayudanteId}
                onChange={(e) => updateHeader("ayudanteId", e.target.value)}
              >
                <option value="">Seleccionar</option>
                {empleadosActivos.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea
                rows="2"
                value={header.observaciones}
                onChange={(e) => updateHeader("observaciones", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="dispatch-grid">
          <article className="admin-card">
            <div className="admin-section-title">
              <div>
                <h2>Agregar productos</h2>
                <p>Usa lector de codigo, SKU o busqueda manual.</p>
              </div>
            </div>

            <form className="dispatch-barcode" onSubmit={agregarPorCodigo}>
              <Barcode size={18} />
              <input
                autoComplete="off"
                autoFocus
                placeholder="Escanear codigo o SKU"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
              <button className="admin-button" type="submit">
                Agregar
              </button>
            </form>

            <input
              placeholder="Buscar por nombre, categoria o proveedor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginTop: 12 }}
            />

            <div className="dispatch-product-list">
              {loading ? (
                <p>Cargando productos...</p>
              ) : (
                productosFiltrados.map((producto) => (
                  <button
                    className="dispatch-product-button"
                    key={producto.id}
                    onClick={() => agregarProducto(producto)}
                    type="button"
                  >
                    <span>
                      <strong>{producto.nombre}</strong>
                      <small>{producto.sku || "Sin codigo"}</small>
                    </span>
                    <span>Stock {producto.stock || 0}</span>
                    <PackagePlus size={17} />
                  </button>
                ))
              )}
            </div>
          </article>

          <article className="admin-card">
            <div className="admin-section-title">
              <div>
                <h2>Surtido despachado</h2>
                <p>Estos productos descuentan inventario al guardar.</p>
              </div>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Costo</th>
                  <th>Venta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productoId}>
                    <td>
                      <strong>{item.nombre}</strong>
                      <br />
                      <small>{item.sku || "Sin codigo"}</small>
                    </td>
                    <td>
                      <input
                        min="1"
                        type="number"
                        value={item.cantidad}
                        onChange={(e) =>
                          updateItem(item.productoId, "cantidad", e.target.value)
                        }
                        style={{ width: 82 }}
                      />
                    </td>
                    <td>{money((Number(item.costo) || 0) * (Number(item.cantidad) || 0))}</td>
                    <td>
                      {money(
                        (Number(item.precioDetal) || 0) *
                          (Number(item.cantidad) || 0)
                      )}
                    </td>
                    <td>
                      <button
                        className="admin-button danger"
                        onClick={() => eliminarItem(item.productoId)}
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Despachos recientes</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ruta</th>
                <th>Carterista</th>
                <th>Cantidad</th>
                <th>Base</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {despachos.slice(-10).reverse().map((despacho) => (
                <tr key={despacho.id}>
                  <td>{despacho.fecha}</td>
                  <td>{despacho.ruta}</td>
                  <td>{despacho.carteristaNombre || "Sin asignar"}</td>
                  <td>{despacho.totalCantidad || 0}</td>
                  <td>{money(despacho.totalCosto || 0)}</td>
                  <td>
                    <span className="admin-pill">{despacho.estado || "despachado"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

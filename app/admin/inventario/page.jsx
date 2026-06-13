"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function InventarioPage() {
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/productos").then((res) => res.json()),
      getDocs(collection(db, "kardex")),
    ])
      .then(([productosData, kardexSnap]) => {
        if (!active) return;
        setProductos(productosData);
        setMovimientos(
          kardexSnap.docs
            .map((docu) => ({ id: docu.id, ...docu.data() }))
            .sort((a, b) =>
              String(b.createdAt?.seconds || "").localeCompare(
                String(a.createdAt?.seconds || "")
              )
            )
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const resumen = useMemo(() => {
    return productos.reduce(
      (acc, producto) => {
        const stock = Number(producto.stock) || 0;
        const costo = Number(producto.costo || producto.precioMayor) || 0;
        acc.unidades += stock;
        acc.valor += stock * costo;
        if (stock <= (Number(producto.stockMinimo) || 5)) acc.alertas += 1;
        return acc;
      },
      { unidades: 0, valor: 0, alertas: 0 }
    );
  }, [productos]);

  return (
    <AdminGuard allowedRoles={["admin", "bodega"]}>
      <AdminShell
        title="Inventario"
        subtitle="Control de existencias, stock mínimo y valor del almacén."
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card">
            <p>Productos</p>
            <h2>{productos.length}</h2>
          </article>
          <article className="admin-card">
            <p>Unidades</p>
            <h2>{resumen.unidades}</h2>
          </article>
          <article className="admin-card">
            <p>Valor estimado</p>
            <h2>{money.format(resumen.valor)}</h2>
          </article>
          <article className="admin-card">
            <p>Alertas</p>
            <h2>{resumen.alertas}</h2>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          {loading ? (
            <p>Cargando inventario...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Costo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => {
                  const stock = Number(producto.stock) || 0;
                  const minimo = Number(producto.stockMinimo) || 5;
                  const costo = Number(producto.costo || producto.precioMayor) || 0;

                  return (
                    <tr key={producto.id}>
                      <td>{producto.nombre}</td>
                      <td>{producto.categoria || "general"}</td>
                      <td>
                        <span className="admin-pill">{stock}</span>
                      </td>
                      <td>{minimo}</td>
                      <td>{money.format(costo)}</td>
                      <td>{money.format(stock * costo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Ultimos movimientos de kardex</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Costo</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.slice(0, 12).map((movimiento) => (
                <tr key={movimiento.id}>
                  <td>{movimiento.fecha || ""}</td>
                  <td>{movimiento.productoNombre || "Producto"}</td>
                  <td>
                    <span className="admin-pill">{movimiento.tipo || "movimiento"}</span>
                  </td>
                  <td>{movimiento.cantidad || 0}</td>
                  <td>{money.format(Number(movimiento.costo) || 0)}</td>
                  <td>{movimiento.proveedor || movimiento.ruta || movimiento.referenciaId}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan="6">Aun no hay movimientos de inventario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

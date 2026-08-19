"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import BarcodeCameraScanner from "@/app/components/BarcodeCameraScanner";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { money } from "@/lib/operacion";
import { getCurrentEmpresaId } from "@/lib/tenant";
import { filterByEmpresaId } from "@/lib/firestoreTenant";
import { Barcode, PackagePlus, Save, Trash2 } from "lucide-react";
import { categories } from "@/lib/categories";

const today = new Date().toISOString().slice(0, 10);

const emptyHeader = {
  fecha: today,
  proveedorId: "",
  proveedor: "",
  facturaProveedor: "",
  totalFacturaProveedor: "",
  metodoPago: "contado",
  observaciones: "",
};

const emptyNewProduct = {
  nombre: "",
  sku: "",
  categoria: "carnicos",
  unidad: "unidad",
  costoUnitario: "",
  precioMinimo: "",
  precioDetal: "",
  precioMaximo: "",
};

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function ComprasAdminPage() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [header, setHeader] = useState(emptyHeader);
  const [items, setItems] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [search, setSearch] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [newProduct, setNewProduct] = useState(emptyNewProduct);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarDatos() {
    setLoading(true);

    try {
      const empresaId = getCurrentEmpresaId();
      const [productosSnap, proveedoresSnap, comprasSnap] = await Promise.all([
        getDocs(collection(db, "productos")),
        getDocs(collection(db, "proveedores")),
        getDocs(collection(db, "compras")),
      ]);

      setProductos(
        filterByEmpresaId(
          productosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })),
          empresaId
        )
      );
      setProveedores(
        filterByEmpresaId(
          proveedoresSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })),
          empresaId
        )
          .filter((proveedor) => proveedor.estado !== "inactivo")
          .sort((a, b) =>
            String(a.nombre || "").localeCompare(String(b.nombre || ""))
          )
      );
      setCompras(
        filterByEmpresaId(
          comprasSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })),
          empresaId
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const productosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const proveedorNombre = normalize(header.proveedor);
    const productosOrdenados = [...productos].sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""))
    );
    const productosProveedor =
      proveedorNombre && !showAllProducts
        ? productosOrdenados.filter(
            (producto) =>
              producto.proveedorId === header.proveedorId ||
              normalize(producto.proveedor) === proveedorNombre
          )
        : productosOrdenados;

    if (!term) return productosProveedor;

    return productosProveedor
      .filter((producto) =>
        [producto.nombre, producto.sku, producto.categoria, producto.proveedor]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
  }, [header.proveedor, header.proveedorId, productos, search, showAllProducts]);

  const resumen = useMemo(() => {
    const calculado = items.reduce(
      (acc, item) => {
        const cantidad = Number(item.cantidad) || 0;
        const costo = Number(item.costoUnitario) || 0;
        acc.lineas += 1;
        acc.cantidad += cantidad;
        acc.total += cantidad * costo;
        return acc;
      },
      { lineas: 0, cantidad: 0, total: 0 }
    );

    const totalFactura = Number(header.totalFacturaProveedor) || 0;
    const diferenciaFactura = totalFactura ? totalFactura - calculado.total : 0;
    const diferenciaAbsoluta = Math.abs(diferenciaFactura);
    const tolerancia = 100;
    const estadoRevision =
      !totalFactura || diferenciaAbsoluta === 0
        ? "cuadrada"
        : diferenciaAbsoluta <= tolerancia
          ? "diferencia_menor"
          : "diferencia_fuerte";

    return {
      ...calculado,
      totalFactura,
      diferenciaFactura,
      diferenciaAbsoluta,
      estadoRevision,
    };
  }, [header.totalFacturaProveedor, items]);

  const alertasCompra = useMemo(() => {
    const alertas = [];

    items.forEach((item) => {
      const cantidad = Number(item.cantidad) || 0;
      const costo = Number(item.costoUnitario) || 0;
      const minimo = Number(item.precioMinimo) || 0;
      const detal = Number(item.precioDetal) || 0;
      const maximo = Number(item.precioMaximo) || 0;
      const nombre = item.nombre || "Producto";

      if (cantidad <= 0) alertas.push(`${nombre}: cantidad debe ser mayor a cero.`);
      if (costo <= 0) alertas.push(`${nombre}: costo unitario debe ser mayor a cero.`);
      if (minimo <= 0) alertas.push(`${nombre}: precio minimo debe ser mayor a cero.`);
      if (detal <= 0) alertas.push(`${nombre}: precio detal debe ser mayor a cero.`);
      if (maximo <= 0) alertas.push(`${nombre}: precio maximo debe ser mayor a cero.`);
      if (minimo > detal) {
        alertas.push(`${nombre}: precio minimo no puede ser mayor que precio detal.`);
      }
      if (detal > maximo) {
        alertas.push(`${nombre}: precio detal no puede ser mayor que precio maximo.`);
      }
      if (costo > maximo) {
        alertas.push(`${nombre}: costo supera el precio maximo de venta.`);
      }
    });

    return alertas;
  }, [items]);

  function updateHeader(field, value) {
    setHeader((current) => ({ ...current, [field]: value }));
  }

  function updateNewProduct(field, value) {
    setNewProduct((current) => ({ ...current, [field]: value }));
  }

  function seleccionarProveedor(proveedorId) {
    const proveedor = proveedores.find((item) => item.id === proveedorId);

    setHeader((current) => ({
      ...current,
      proveedorId,
      proveedor: proveedor?.nombre || "",
      metodoPago: proveedor?.metodoPago || current.metodoPago,
    }));
    setShowAllProducts(false);
    setSearch("");
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
          costoUnitario: Number(producto.costo || producto.precioMayor) || 0,
          precioMinimo: Number(producto.precioMinimo || producto.precioMayor) || 0,
          precioDetal: Number(producto.precioDetal || producto.precioMayor) || 0,
          precioMaximo:
            Number(producto.precioMaximo || producto.precioPacaDetal || producto.precioDetal) ||
            0,
          stockActual: Number(producto.stock) || 0,
        },
      ];
    });
  }

  function agregarPorCodigoTexto(rawCode) {
    const code = String(rawCode || "").trim().toLowerCase();
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

  function agregarPorCodigo(event) {
    event.preventDefault();
    agregarPorCodigoTexto(barcode);
  }

  function updateItem(productoId, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.productoId === productoId
          ? {
              ...item,
              [field]: [
                "cantidad",
                "costoUnitario",
                "precioMinimo",
                "precioDetal",
                "precioMaximo",
              ].includes(field)
                ? Math.max(Number(value) || 0, 0)
                : value,
            }
          : item
      )
    );
  }

  function eliminarItem(productoId) {
    setItems((current) => current.filter((item) => item.productoId !== productoId));
  }

  async function crearProductoRapido(event) {
    event.preventDefault();

    if (!newProduct.nombre.trim()) {
      alert("Escribe el nombre del producto nuevo.");
      return;
    }

    setSaving(true);

    try {
      const productoRef = doc(collection(db, "productos"));
      const empresaId = getCurrentEmpresaId();
      const costo = Number(newProduct.costoUnitario) || 0;
      const precioMinimo = Number(newProduct.precioMinimo) || costo;
      const precioDetal = Number(newProduct.precioDetal) || precioMinimo;
      const precioMaximo = Number(newProduct.precioMaximo) || precioDetal;
      const producto = {
        id: productoRef.id,
        nombre: newProduct.nombre.trim(),
        sku: newProduct.sku.trim(),
        categoria: newProduct.categoria,
        unidad: newProduct.unidad,
        proveedorId: header.proveedorId,
        proveedor: header.proveedor.trim(),
        costo,
        precioMayor: precioMinimo,
        precioDetal,
        precioMinimo,
        precioMaximo,
        precioPacaMayor: precioMaximo,
        precioPacaDetal: precioMaximo,
        stock: 0,
        stockMinimo: 5,
        empresaId,
        imagen: "",
        imagenes: [],
        descripcion: "",
        activo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(productoRef, producto);
      await batch.commit();

      setProductos((current) => [...current, producto]);
      setItems((current) => [
        ...current,
        {
          productoId: productoRef.id,
          nombre: producto.nombre,
          sku: producto.sku,
          categoria: producto.categoria,
          proveedorId: header.proveedorId,
          proveedor: header.proveedor.trim(),
          cantidad: 1,
          costoUnitario: costo,
          precioMinimo,
          precioDetal,
          precioMaximo,
          stockActual: 0,
        },
      ]);
      setNewProduct(emptyNewProduct);
    } catch (error) {
      console.error("Error creando producto rapido:", error);
      alert("No se pudo crear el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function guardarCompra() {
    if (!header.proveedor.trim()) {
      alert("Escribe el proveedor.");
      return;
    }

    if (!items.length) {
      alert("Agrega productos a la compra.");
      return;
    }

    if (alertasCompra.length > 0) {
      alert(`Corrige la compra antes de guardar:\n${alertasCompra.join("\n")}`);
      return;
    }

    if (
      resumen.estadoRevision === "diferencia_fuerte" &&
      !confirm(
        "La factura del proveedor tiene una diferencia fuerte frente al calculo. Deseas guardarla con alerta?"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(
        `/api/admin/compras?empresaId=${encodeURIComponent(getCurrentEmpresaId())}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            header,
            items,
          }),
        }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detalles = Array.isArray(result.detalles)
          ? `\n${result.detalles.join("\n")}`
          : "";
        throw new Error(`${result.error || "No se pudo guardar la compra."}${detalles}`);
      }

      setHeader(emptyHeader);
      setItems([]);
      setBarcode("");
      setSearch("");
      await cargarDatos();
    } catch (error) {
      console.error("Error guardando compra:", error);
      alert(error.message || "No se pudo guardar la compra.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <AdminGuard allowedRoles={["admin", "bodega"]}>
      <AdminShell
        title="Compras"
        subtitle="Entrada de mercancia a bodega por proveedor, factura y costo."
        actions={
          <button className="admin-button" disabled={saving} onClick={guardarCompra}>
            <Save size={18} />
            {saving ? "Guardando..." : "Guardar compra"}
          </button>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Lineas</h3>
            <h2>{resumen.lineas}</h2>
            <p>Productos en la compra.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Cantidad</h3>
            <h2>{resumen.cantidad}</h2>
            <p>Unidades entrando a bodega.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Total compra</h3>
            <h2>{money(resumen.total)}</h2>
            <p>Base invertida.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Diferencia factura</h3>
            <h2>{money(resumen.diferenciaFactura)}</h2>
            <p>
              {resumen.estadoRevision === "cuadrada"
                ? "Factura cuadrada."
                : resumen.estadoRevision === "diferencia_menor"
                  ? "Diferencia menor."
                  : "Revisar antes de pagar."}
            </p>
          </article>
        </section>

        <section className="admin-card admin-accent-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Datos de compra</h2>
              <p>Proveedor, factura y condiciones de la entrada a inventario.</p>
            </div>
          </div>

          <div className="admin-form">
            <label>
              Fecha
              <input
                type="date"
                value={header.fecha}
                onChange={(event) => updateHeader("fecha", event.target.value)}
              />
            </label>
            <label>
              Proveedor registrado
              <select
                value={header.proveedorId}
                onChange={(event) => seleccionarProveedor(event.target.value)}
              >
                <option value="">Seleccionar proveedor</option>
                {proveedores.map((proveedor) => (
                  <option key={proveedor.id} value={proveedor.id}>
                    {proveedor.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proveedor manual
              <input
                value={header.proveedor}
                onChange={(event) => updateHeader("proveedor", event.target.value)}
                placeholder="Nombre si no esta registrado"
              />
            </label>
            <label>
              Factura o remision
              <input
                value={header.facturaProveedor}
                onChange={(event) =>
                  updateHeader("facturaProveedor", event.target.value)
                }
                placeholder="Numero de soporte"
              />
            </label>
            <label>
              Total factura proveedor
              <input
                type="number"
                value={header.totalFacturaProveedor}
                onChange={(event) =>
                  updateHeader("totalFacturaProveedor", event.target.value)
                }
                placeholder="Total que trae la factura"
              />
            </label>
            <label>
              Metodo
              <select
                value={header.metodoPago}
                onChange={(event) => updateHeader("metodoPago", event.target.value)}
              >
                <option value="contado">Contado</option>
                <option value="credito">Credito</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea
                rows="2"
                value={header.observaciones}
                onChange={(event) => updateHeader("observaciones", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="dispatch-grid">
          <article className="admin-card">
            <div className="admin-section-title">
              <div>
                <h2>Catalogo del proveedor</h2>
                <p>
                  {header.proveedor
                    ? `${productosFiltrados.length} productos visibles para ${header.proveedor}.`
                    : "Selecciona proveedor o busca productos manualmente."}
                </p>
              </div>
            </div>

            {header.proveedor && (
              <div className="supplier-catalog-tools">
                <span>
                  {showAllProducts
                    ? "Viendo todos los productos"
                    : "Viendo solo lo que vende este proveedor"}
                </span>
                <button
                  className="admin-button secondary"
                  onClick={() => setShowAllProducts((current) => !current)}
                  type="button"
                >
                  {showAllProducts ? "Ver solo proveedor" : "Ver todos"}
                </button>
              </div>
            )}

            <form className="dispatch-barcode" onSubmit={agregarPorCodigo}>
              <Barcode size={18} />
              <input
                autoComplete="off"
                autoFocus
                placeholder="Escanear codigo o SKU"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
              />
              <button className="admin-button" type="submit">
                Agregar
              </button>
            </form>

            <BarcodeCameraScanner
              onDetected={(code) => {
                setBarcode(code);
                agregarPorCodigoTexto(code);
              }}
            />

            <input
              placeholder="Buscar por nombre, categoria o proveedor"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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

            <div className="quick-product-box">
              <div className="admin-section-title">
                <div>
                  <h3>Producto nuevo rapido</h3>
                  <p>Crealo aqui y se agrega a esta compra.</p>
                </div>
              </div>
              <form className="quick-product-form" onSubmit={crearProductoRapido}>
                <input
                  placeholder="Nombre producto"
                  value={newProduct.nombre}
                  onChange={(event) => updateNewProduct("nombre", event.target.value)}
                />
                <input
                  placeholder="SKU o codigo"
                  value={newProduct.sku}
                  onChange={(event) => updateNewProduct("sku", event.target.value)}
                />
                <select
                  value={newProduct.categoria}
                  onChange={(event) =>
                    updateNewProduct("categoria", event.target.value)
                  }
                >
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={newProduct.unidad}
                  onChange={(event) => updateNewProduct("unidad", event.target.value)}
                >
                  <option value="unidad">Unidad</option>
                  <option value="docena">Docena</option>
                  <option value="pacas">Pacas</option>
                  <option value="cantidad">Cantidad</option>
                </select>
                <input
                  placeholder="Costo"
                  type="number"
                  value={newProduct.costoUnitario}
                  onChange={(event) =>
                    updateNewProduct("costoUnitario", event.target.value)
                  }
                />
                <input
                  placeholder="Precio minimo"
                  type="number"
                  value={newProduct.precioMinimo}
                  onChange={(event) =>
                    updateNewProduct("precioMinimo", event.target.value)
                  }
                />
                <input
                  placeholder="Precio detal"
                  type="number"
                  value={newProduct.precioDetal}
                  onChange={(event) =>
                    updateNewProduct("precioDetal", event.target.value)
                  }
                />
                <input
                  placeholder="Precio maximo"
                  type="number"
                  value={newProduct.precioMaximo}
                  onChange={(event) =>
                    updateNewProduct("precioMaximo", event.target.value)
                  }
                />
                <button className="admin-button secondary" disabled={saving} type="submit">
                  <PackagePlus size={17} />
                  Crear y agregar
                </button>
              </form>
            </div>
          </article>

          <article className="admin-card">
            <div className="admin-section-title">
              <div>
                <h2>Mercancia recibida</h2>
                <p>Estos productos aumentan inventario al guardar.</p>
              </div>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Costo unitario</th>
                  <th>P. minimo</th>
                  <th>P. detal</th>
                  <th>P. maximo</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    className={
                      alertasCompra.some((alerta) =>
                        alerta.startsWith(`${item.nombre || "Producto"}:`)
                      )
                        ? "table-row-warning"
                        : ""
                    }
                    key={item.productoId}
                  >
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
                        onChange={(event) =>
                          updateItem(item.productoId, "cantidad", event.target.value)
                        }
                        style={{ width: 82 }}
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        type="number"
                        value={item.costoUnitario}
                        onChange={(event) =>
                          updateItem(
                            item.productoId,
                            "costoUnitario",
                            event.target.value
                          )
                        }
                        style={{ width: 120 }}
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        type="number"
                        value={item.precioMinimo}
                        onChange={(event) =>
                          updateItem(
                            item.productoId,
                            "precioMinimo",
                            event.target.value
                          )
                        }
                        style={{ width: 108 }}
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        type="number"
                        value={item.precioDetal}
                        onChange={(event) =>
                          updateItem(item.productoId, "precioDetal", event.target.value)
                        }
                        style={{ width: 108 }}
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        type="number"
                        value={item.precioMaximo}
                        onChange={(event) =>
                          updateItem(
                            item.productoId,
                            "precioMaximo",
                            event.target.value
                          )
                        }
                        style={{ width: 108 }}
                      />
                    </td>
                    <td>
                      {money(
                        (Number(item.cantidad) || 0) *
                          (Number(item.costoUnitario) || 0)
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
                {items.length === 0 && (
                  <tr>
                    <td colSpan="8">Agrega productos para registrar la compra.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="invoice-check-panel">
              <div>
                <span>Total calculado</span>
                <strong>{money(resumen.total)}</strong>
              </div>
              <div>
                <span>Total factura proveedor</span>
                <strong>{money(resumen.totalFactura)}</strong>
              </div>
              <div
                className={
                  resumen.diferenciaFactura === 0
                    ? "invoice-ok"
                    : "invoice-warning"
                }
              >
                <span>Diferencia</span>
                <strong>{money(resumen.diferenciaFactura)}</strong>
              </div>
              <div
                className={
                  resumen.estadoRevision === "cuadrada"
                    ? "invoice-ok"
                    : "invoice-warning"
                }
              >
                <span>Revision</span>
                <strong>
                  {resumen.estadoRevision === "cuadrada"
                    ? "Cuadrada"
                    : resumen.estadoRevision === "diferencia_menor"
                      ? "Diferencia menor"
                      : "Diferencia fuerte"}
                </strong>
              </div>
            </div>
            {resumen.estadoRevision === "diferencia_fuerte" && (
              <div className="route-card route-alert" style={{ marginTop: 12 }}>
                La factura del proveedor no coincide con el calculo. Revisa
                cantidades, costos o total antes de pagar.
              </div>
            )}
            {alertasCompra.length > 0 && (
              <div className="route-card route-alert" style={{ marginTop: 12 }}>
                <strong>Corrige la compra antes de guardar</strong>
                <ul className="route-alert-list">
                  {alertasCompra.map((alerta) => (
                    <li key={alerta}>{alerta}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Compras recientes</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Factura</th>
                <th>Cantidad</th>
                <th>Total</th>
                <th>Diferencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {compras.slice(-10).reverse().map((compra) => (
                <tr key={compra.id}>
                  <td>{compra.fecha}</td>
                  <td>{compra.proveedor || "Sin proveedor"}</td>
                  <td>{compra.facturaProveedor || "Sin soporte"}</td>
                  <td>{compra.totalCantidad || 0}</td>
                  <td>{money(compra.totalCompra || 0)}</td>
                  <td>{money(compra.diferenciaFactura || 0)}</td>
                  <td>
                    <span className="admin-pill">
                      {compra.estadoRevisionFactura || compra.estado || "registrada"}
                    </span>
                  </td>
                </tr>
              ))}
              {compras.length === 0 && (
                <tr>
                  <td colSpan="7">Aun no hay compras registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  Package,
  Route,
  ShoppingCart,
  Truck,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    const empresaId = localStorage.getItem("empresaId") || "proveedor-central";
    const params = new URLSearchParams({ empresaId });

    fetch(`/api/admin/dashboard?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el dashboard");
        return res.json();
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = data
    ? [
        {
          title: "Caja confirmada hoy",
          value: money.format(data.cajaConfirmadaHoy || 0),
          detail: "Tienda pagada + cobros de ruta.",
          icon: Wallet,
          className: "admin-stat-green",
        },
        {
          title: "Pendiente / fiado hoy",
          value: money.format(data.totalPendienteHoy || 0),
          detail: "Pedidos pendientes + fiado ruta.",
          icon: CreditCard,
          className: "admin-stat-gold",
        },
        {
          title: "Cartera total",
          value: money.format(data.carteraTotal || 0),
          detail: `${data.clientesConDeuda || 0} clientes con deuda.`,
          icon: Users,
          className: "admin-stat-blue",
        },
        {
          title: "Por pagar",
          value: money.format(data.cuentasPorPagar || 0),
          detail: `${data.cuentasPagarVencidas || 0} vencidas.`,
          icon: DollarSign,
          className: "admin-stat-red",
        },
      ]
    : [];

  return (
    <AdminGuard>
      <AdminShell
        title="Dashboard"
        subtitle="Centro de mando diario: caja, rutas, cartera, bodega y alertas."
        actions={
          <>
            <Link className="admin-button secondary" href="/admin/compras">
              Registrar compra
            </Link>
            <Link className="admin-button secondary" href="/admin/cartera">
              Ver cartera
            </Link>
            <Link className="admin-button" href="/admin/despachos">
              Despachar ruta
            </Link>
          </>
        }
      >
        {loading && <div className="admin-card">Cargando dashboard...</div>}
        {error && <div className="admin-card">{error}</div>}

        {data && (
          <div className="admin-grid">
            <section className="admin-grid admin-kpis">
              {cards.map((card) => {
                const Icon = card.icon;

                return (
                  <article className={`admin-card ${card.className}`} key={card.title}>
                    <Icon size={22} />
                    <p>{card.title}</p>
                    <h2>{card.value}</h2>
                    <span>{card.detail}</span>
                  </article>
                );
              })}
            </section>

            <section className="admin-grid admin-kpis">
              <article className="admin-card">
                <ShoppingCart size={22} />
                <p>Ventas hoy</p>
                <h2>{data.ventasHoy || 0}</h2>
                <span>{money.format((data.ingresosHoy || 0) + (data.valorRutaHoy || 0))}</span>
              </article>
              <article className="admin-card">
                <Route size={22} />
                <p>Ruta hoy</p>
                <h2>{money.format(data.valorRutaHoy || 0)}</h2>
                <span>{data.ventasRutaHoy || 0} facturas de ruta.</span>
              </article>
              <article className="admin-card">
                <Truck size={22} />
                <p>Compras hoy</p>
                <h2>{money.format(data.valorComprasHoy || 0)}</h2>
                <span>{data.comprasHoy || 0} compras registradas.</span>
              </article>
              <article className="admin-card">
                <DollarSign size={22} />
                <p>Neto admin hoy</p>
                <h2>{money.format(data.netoAdministradorHoy || 0)}</h2>
                <span>{data.rutasLiquidadasHoy || 0} rutas liquidadas.</span>
              </article>
            </section>

            <section className="admin-grid admin-kpis">
              <article className="admin-card admin-stat-blue">
                <ClipboardCheck size={22} />
                <p>Gestiones ruta hoy</p>
                <h2>{data.gestionesHoy || 0}</h2>
                <span>{data.carteristasConGestionHoy || 0} carteristas reportando.</span>
              </article>
              <article className="admin-card admin-stat-green">
                <CheckCircle2 size={22} />
                <p>Visitados</p>
                <h2>{data.clientesVisitadosHoy || 0}</h2>
                <span>Clientes encontrados y atendidos.</span>
              </article>
              <article className="admin-card admin-stat-red">
                <UserX size={22} />
                <p>No disponibles</p>
                <h2>{data.clientesNoDisponiblesHoy || 0}</h2>
                <span>Casa, descanso, vacaciones o no abrio.</span>
              </article>
              <article className="admin-card">
                <AlertTriangle size={22} />
                <p>Riesgo hoy</p>
                <h2>{data.clientesRiesgoGestionHoy || 0}</h2>
                <span>{money.format(data.deudaGestionadaHoy || 0)} revisado en ruta.</span>
              </article>
            </section>

            <section className="admin-grid dashboard-main-grid">
              <article className="admin-card">
                <div className="admin-section-title">
                  <div>
                    <h2>Rutas con cartera critica</h2>
                    <p>Prioridad por plata perdida, riesgo y deuda vencida.</p>
                  </div>
                  <Link className="admin-button secondary" href="/admin/cartera">
                    Abrir cartera
                  </Link>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ruta</th>
                      <th>Cartera</th>
                      <th>Riesgo</th>
                      <th>Perdidos</th>
                      <th>Dias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.carteraCriticaPorRuta || []).map((grupo) => (
                      <tr key={grupo.key}>
                        <td>
                          {grupo.diaRuta}
                          <br />
                          <small>{grupo.ruta}</small>
                        </td>
                        <td>{money.format(grupo.deuda || 0)}</td>
                        <td>
                          <span className={`debt-pill ${grupo.riesgo ? "gris" : "verde"}`}>
                            {grupo.riesgo || 0}
                          </span>
                          <br />
                          <small>{money.format(grupo.deudaRiesgo || 0)}</small>
                        </td>
                        <td>
                          <span
                            className={`debt-pill ${
                              grupo.perdidos ? "negro" : "verde"
                            }`}
                          >
                            {grupo.perdidos || 0}
                          </span>
                          <br />
                          <small>{money.format(grupo.deudaPerdida || 0)}</small>
                        </td>
                        <td>{grupo.mayorDias || 0}</td>
                      </tr>
                    ))}
                    {!data.carteraCriticaPorRuta?.length && (
                      <tr>
                        <td colSpan="5">Sin cartera critica por ruta.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </article>

              <article className="admin-card">
                <h2>Control de cartera</h2>
                <div className="liquidation-lines">
                  <span>Cartera total</span>
                  <strong>{money.format(data.carteraTotal || 0)}</strong>
                  <span>Cartera vencida</span>
                  <strong>{money.format(data.carteraVencida || 0)}</strong>
                  <span>Clientes con deuda</span>
                  <strong>{data.clientesConDeuda || 0}</strong>
                  <span>Riesgo gris</span>
                  <strong>{data.clientesRiesgoMarcado || 0}</strong>
                  <span>Perdidos con deuda</span>
                  <strong>{data.clientesPerdidosConDeuda || 0}</strong>
                  <span>Orden pendiente</span>
                  <strong>{data.clientesOrdenPendiente || 0}</strong>
                </div>
                <div className="admin-toolbar-actions" style={{ marginTop: 14 }}>
                  <Link className="admin-button secondary" href="/admin/clientes">
                    Clientes
                  </Link>
                  <Link className="admin-button secondary" href="/admin/cartera">
                    Cobrar
                  </Link>
                </div>
              </article>
            </section>

            <section className="admin-grid dashboard-main-grid">
              <article className="admin-card">
                <div className="admin-section-title">
                  <div>
                    <h2>Ventas ultimos 7 dias</h2>
                    <p>Tienda y ruta sumadas para ver movimiento real.</p>
                  </div>
                  <Link className="admin-button secondary" href="/admin/ventas">
                    Ver ventas
                  </Link>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.grafico}>
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip formatter={(value) => money.format(value)} />
                    <Line
                      type="monotone"
                      dataKey="ventas"
                      stroke="#1b4332"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </article>

              <article className="admin-card">
                <Package size={22} />
                <h2>Inventario y bodega</h2>
                <div className="liquidation-lines">
                  <span>Productos</span>
                  <strong>{data.totalProductos}</strong>
                  <span>Unidades stock</span>
                  <strong>{data.totalStock}</strong>
                  <span>Valor inventario</span>
                  <strong>{money.format(data.valorInventario || 0)}</strong>
                  <span>Bajo stock</span>
                  <strong>{data.bajoStock.length}</strong>
                  <span>Despachos pendientes</span>
                  <strong>{data.despachosPendientes || 0}</strong>
                </div>
                <Link className="admin-button secondary" href="/admin/inventario">
                  Revisar inventario
                </Link>
              </article>
            </section>

            <section className="admin-grid dashboard-main-grid">
              <article className="admin-card audit-panel">
                <div className="admin-section-title">
                  <div>
                    <h2>Prioridades de hoy</h2>
                    <p>Alertas que requieren revision operativa.</p>
                  </div>
                  <span className="audit-status con_alertas">
                    {data.saludOperativa?.length || 0} alertas
                  </span>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Detalle</th>
                      <th>Prioridad</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.saludOperativa || []).map((alerta) => (
                      <tr key={`${alerta.tipo}-${alerta.detalle}`}>
                        <td>{alerta.tipo}</td>
                        <td>{alerta.detalle}</td>
                        <td>
                          <span
                            className={`debt-pill ${
                              alerta.prioridad === "alta" ? "rojo" : "amarillo"
                            }`}
                          >
                            {alerta.prioridad}
                          </span>
                        </td>
                        <td>
                          <Link className="admin-button secondary" href={alerta.href}>
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {!data.saludOperativa?.length && (
                      <tr>
                        <td colSpan="4">Sin alertas criticas por ahora.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </article>

              <article className="admin-card">
                <h2>Resumen operativo</h2>
                <div className="liquidation-lines">
                  <span>Cobrado ruta hoy</span>
                  <strong>{money.format(data.cobrosRutaHoy || 0)}</strong>
                  <span>Fiado ruta hoy</span>
                  <strong>{money.format(data.fiadoRutaHoy || 0)}</strong>
                  <span>Cartera riesgo marcada</span>
                  <strong>{money.format(data.carteraRiesgoMarcado || 0)}</strong>
                  <span>Cartera perdida</span>
                  <strong>{money.format(data.carteraPerdida || 0)}</strong>
                  <span>Recepciones con alerta</span>
                  <strong>{data.recepcionesConAlertas || 0}</strong>
                  <span>Liquidaciones con alerta</span>
                  <strong>{data.liquidacionesConAlertas || 0}</strong>
                  <span>Descuadre dinero</span>
                  <strong>{money.format(data.descuadreDineroRecepcion || 0)}</strong>
                  <span>Plata faltante</span>
                  <strong>{money.format(data.dineroFaltanteRecepcion || 0)}</strong>
                  <span>Plata sobrante</span>
                  <strong>{money.format(data.dineroSobranteRecepcion || 0)}</strong>
                  <span>Facturas proveedor alerta</span>
                  <strong>{data.cuentasPagarFacturasConDiferencia || 0}</strong>
                  <span>Gestiones ruta hoy</span>
                  <strong>{data.gestionesHoy || 0}</strong>
                  <span>Riesgo marcado hoy</span>
                  <strong>{data.clientesRiesgoGestionHoy || 0}</strong>
                </div>
                <div className="admin-toolbar-actions" style={{ marginTop: 14 }}>
                  <Link className="admin-button secondary" href="/admin/gestiones">
                    Gestiones
                  </Link>
                  <Link className="admin-button secondary" href="/admin/recepciones">
                    Recepcion
                  </Link>
                  <Link className="admin-button secondary" href="/admin/reportes">
                    Reportes
                  </Link>
                  <Link className="admin-button secondary" href="/admin/contabilidad">
                    Contable
                  </Link>
                </div>
              </article>
            </section>

            <section className="admin-grid dashboard-main-grid">
              <article className="admin-card">
                <div className="admin-section-title">
                  <div>
                    <h2>Proveedores delicados</h2>
                    <p>Cuentas vencidas o facturas con diferencia antes de pagar.</p>
                  </div>
                  <Link className="admin-button secondary" href="/admin/cuentas-pagar">
                    Ver pagos
                  </Link>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Factura</th>
                      <th>Saldo</th>
                      <th>Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.cuentasPagarCriticas || []).map((cuenta) => (
                      <tr key={cuenta.id}>
                        <td>{cuenta.proveedor}</td>
                        <td>{cuenta.facturaProveedor}</td>
                        <td>{money.format(cuenta.saldoPendiente || 0)}</td>
                        <td>
                          <span className={`debt-pill ${cuenta.vencida ? "rojo" : "amarillo"}`}>
                            {cuenta.vencida ? "vencida" : "diferencia"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!data.cuentasPagarCriticas?.length && (
                      <tr>
                        <td colSpan="4">Sin cuentas criticas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </article>

              <article className="admin-card">
                <h2>Pagos a proveedores</h2>
                <div className="liquidation-lines">
                  <span>Total credito</span>
                  <strong>{money.format(data.cuentasPagarTotal || 0)}</strong>
                  <span>Abonado</span>
                  <strong>{money.format(data.cuentasPagarAbonado || 0)}</strong>
                  <span>Saldo pendiente</span>
                  <strong>{money.format(data.cuentasPorPagar || 0)}</strong>
                  <span>Cuentas vencidas</span>
                  <strong>{data.cuentasPagarVencidas || 0}</strong>
                </div>
                {data.pagosProveedorPorMetodo?.length > 0 && (
                  <div className="payment-method-grid" style={{ marginTop: 12 }}>
                    {data.pagosProveedorPorMetodo.map((item) => (
                      <div key={item.metodo}>
                        <span>{item.metodo}</span>
                        <strong>{money.format(item.valor || 0)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>

            <section className="admin-grid dashboard-main-grid">
              <article className="admin-card">
                <h2>Pedidos recientes</h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ultimasVentas.map((venta) => (
                      <tr key={venta.id}>
                        <td>{venta.numero || venta.id}</td>
                        <td>{venta.cliente?.nombre || "Cliente"}</td>
                        <td>{money.format(venta.total || 0)}</td>
                        <td>
                          <span className="admin-pill">
                            {venta.estado || "pendiente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="admin-card">
                <div className="admin-section-title">
                  <div>
                    <h2>Productos bajo stock</h2>
                    <p>Reposicion sugerida para compras.</p>
                  </div>
                  <Link className="admin-button secondary" href="/admin/compras">
                    Comprar
                  </Link>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bajoStock.map((producto) => (
                      <tr key={producto.id}>
                        <td>{producto.nombre}</td>
                        <td>{producto.stock || 0}</td>
                      </tr>
                    ))}
                    {data.bajoStock.length === 0 && (
                      <tr>
                        <td colSpan="2">Sin alertas de inventario.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </article>
            </section>
          </div>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

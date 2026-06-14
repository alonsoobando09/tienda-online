"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function percent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

export default function ContabilidadPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/contabilidad")
      .then((res) => res.json())
      .then((result) => {
        if (active) setData(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminGuard>
      <AdminShell
        title="Contable"
        subtitle="Cierre financiero sin IVA: ingresos, cartera, proveedores, rutas y alertas."
      >
        {loading && <div className="admin-card">Cargando contabilidad...</div>}

        {data && (
          <div className="admin-grid">
            <section className="admin-grid admin-kpis">
              <article className="admin-card admin-stat-green">
                <p>Caja confirmada</p>
                <h2>{money.format(data.ingresos || 0)}</h2>
                <span>Tienda + cobros de ruta.</span>
              </article>
              <article className="admin-card admin-stat-gold">
                <p>Por cobrar</p>
                <h2>{money.format(data.cuentasPorCobrar || 0)}</h2>
                <span>Cartera + pedidos pendientes.</span>
              </article>
              <article className="admin-card admin-stat-red">
                <p>Por pagar</p>
                <h2>{money.format(data.cuentasPorPagar || 0)}</h2>
                <span>Saldo a proveedores.</span>
              </article>
              <article className="admin-card admin-stat-blue">
                <p>Posicion neta</p>
                <h2>{money.format(data.posicionNeta || 0)}</h2>
                <span>Caja + cobros - proveedores.</span>
              </article>
            </section>

            <section className="admin-grid admin-kpis">
              <article className="admin-card">
                <p>Ventas hoy</p>
                <h2>{money.format(data.hoy?.ventas || 0)}</h2>
                <span>{data.hoy?.facturas || 0} facturas.</span>
              </article>
              <article className="admin-card">
                <p>Cobrado hoy</p>
                <h2>{money.format(data.hoy?.cobrado || 0)}</h2>
              </article>
              <article className="admin-card">
                <p>Pendiente hoy</p>
                <h2>{money.format(data.hoy?.pendiente || 0)}</h2>
              </article>
              <article className="admin-card">
                <p>Neto admin hoy</p>
                <h2>{money.format(data.hoy?.netoAdministrador || 0)}</h2>
                <span>{data.hoy?.rutasLiquidadas || 0} rutas liquidadas.</span>
              </article>
            </section>

            <section className="admin-grid admin-kpis">
              <article className="admin-card">
                <p>Ventas brutas</p>
                <h2>{money.format(data.ventasBrutas || 0)}</h2>
                <span>
                  Tienda {money.format(data.ventasBrutasTienda || 0)} / Ruta{" "}
                  {money.format(data.ventasBrutasRuta || 0)}
                </span>
              </article>
              <article className="admin-card">
                <p>Efectividad cobro</p>
                <h2>{percent(data.efectividadCobro)}</h2>
                <span>Cobrado sobre ventas brutas.</span>
              </article>
              <article className="admin-card">
                <p>Margen rutas</p>
                <h2>{percent(data.margenRuta)}</h2>
                <span>Utilidad bruta sobre ventas ruta.</span>
              </article>
              <article className="admin-card">
                <p>Caja despues de proveedores</p>
                <h2>{money.format(data.cajaOperativa || 0)}</h2>
              </article>
            </section>

            {data.alertasFinancieras?.length > 0 && (
              <section className="admin-card audit-panel">
                <div className="admin-section-title">
                  <div>
                    <h2>Alertas financieras</h2>
                    <p>Prioridades que conviene revisar antes de cerrar caja.</p>
                  </div>
                  <span className="audit-status con_alertas">
                    {data.alertasFinancieras.length} alertas
                  </span>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Alerta</th>
                      <th>Detalle</th>
                      <th>Valor</th>
                      <th>Prioridad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alertasFinancieras.map((alerta) => (
                      <tr key={alerta.tipo}>
                        <td>{alerta.tipo}</td>
                        <td>{alerta.detalle}</td>
                        <td>
                          {typeof alerta.valor === "number"
                            ? money.format(alerta.valor)
                            : alerta.valor}
                        </td>
                        <td>
                          <span
                            className={`debt-pill ${
                              alerta.prioridad === "alta" ? "rojo" : "amarillo"
                            }`}
                          >
                            {alerta.prioridad}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="admin-grid contable-grid">
              <article className="admin-card">
                <h2>Cartera</h2>
                <div className="liquidation-lines">
                  <span>Clientes con deuda</span>
                  <strong>{data.clientesConDeuda || 0}</strong>
                  <span>Cartera clientes</span>
                  <strong>{money.format(data.carteraClientes || 0)}</strong>
                  <span>Cartera vencida</span>
                  <strong>{money.format(data.carteraVencida || 0)}</strong>
                  <span>Riesgo marcado</span>
                  <strong>{money.format(data.carteraRiesgo || 0)}</strong>
                  <span>Cartera perdida</span>
                  <strong>{money.format(data.carteraPerdida || 0)}</strong>
                </div>
                <Link className="admin-button secondary" href="/admin/cartera">
                  Revisar cartera
                </Link>
              </article>

              <article className="admin-card">
                <h2>Proveedores y compras</h2>
                <div className="liquidation-lines">
                  <span>Compras registradas</span>
                  <strong>{money.format(data.comprasTotal || 0)}</strong>
                  <span>Facturas de compra</span>
                  <strong>{data.comprasFacturas || 0}</strong>
                  <span>Compras con alerta</span>
                  <strong>{data.comprasConAlerta || 0}</strong>
                  <span>Cuentas vencidas</span>
                  <strong>{data.cuentasPagarVencidas || 0}</strong>
                  <span>Saldo proveedores</span>
                  <strong>{money.format(data.cuentasPorPagar || 0)}</strong>
                </div>
                <Link className="admin-button secondary" href="/admin/cuentas-pagar">
                  Ver por pagar
                </Link>
              </article>
            </section>

            <section className="admin-grid contable-grid">
              <article className="admin-card">
                <h2>Resultado rutas</h2>
                <div className="liquidation-lines">
                  <span>Utilidad bruta rutas</span>
                  <strong>{money.format(data.utilidadBrutaRutas || 0)}</strong>
                  <span>Neto administrador</span>
                  <strong>{money.format(data.netoAdministrador || 0)}</strong>
                  <span>Neto carteristas</span>
                  <strong>{money.format(data.netoCarteristas || 0)}</strong>
                  <span>Neto ayudantes</span>
                  <strong>{money.format(data.netoAyudantes || 0)}</strong>
                  <span>Faltantes</span>
                  <strong>{money.format(data.costoFaltante || 0)}</strong>
                  <span>Descuadre dinero</span>
                  <strong>{money.format(data.descuadreDinero || 0)}</strong>
                  <span>Plata faltante</span>
                  <strong>{money.format(data.dineroFaltante || 0)}</strong>
                  <span>Plata sobrante</span>
                  <strong>{money.format(data.dineroSobrante || 0)}</strong>
                </div>
              </article>

              <article className="admin-card">
                <h2>Cuentas por pagar</h2>
                <div className="liquidation-lines">
                  <span>Total credito proveedores</span>
                  <strong>{money.format(data.cuentasPagarTotal || 0)}</strong>
                  <span>Abonado</span>
                  <strong>{money.format(data.cuentasPagarAbonado || 0)}</strong>
                  <span>Saldo pendiente</span>
                  <strong>{money.format(data.cuentasPorPagar || 0)}</strong>
                  <span>Cuentas pendientes</span>
                  <strong>{data.cuentasPagarPendientes || 0}</strong>
                  <span>Vencidas</span>
                  <strong>{data.cuentasPagarVencidas || 0}</strong>
                  <span>Facturas con diferencia</span>
                  <strong>{data.cuentasPagarFacturasConDiferencia || 0}</strong>
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

            <section className="admin-grid contable-grid">
              <article className="admin-card">
                <h2>Cartera critica</h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Ruta</th>
                      <th>Dias</th>
                      <th>Deuda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.carteraCritica?.map((cliente) => (
                      <tr key={cliente.id}>
                        <td>{cliente.nombre}</td>
                        <td>{cliente.ruta}</td>
                        <td>{cliente.diasDeuda}</td>
                        <td>{money.format(cliente.deudaActual || 0)}</td>
                      </tr>
                    ))}
                    {!data.carteraCritica?.length && (
                      <tr>
                        <td colSpan="4">No hay cartera critica.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </article>

              <article className="admin-card">
                <h2>Pagos a proveedores proximos</h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Factura</th>
                      <th>Vence</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cuentasPagarCriticas?.map((cuenta) => (
                      <tr key={cuenta.id}>
                        <td>{cuenta.proveedor}</td>
                        <td>{cuenta.facturaProveedor}</td>
                        <td>
                          <span className={`debt-pill ${cuenta.vencida ? "rojo" : "amarillo"}`}>
                            {cuenta.fechaVencimiento || "Sin fecha"}
                          </span>
                        </td>
                        <td>{money.format(cuenta.saldoPendiente || 0)}</td>
                      </tr>
                    ))}
                    {!data.cuentasPagarCriticas?.length && (
                      <tr>
                        <td colSpan="4">No hay cuentas pendientes.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </article>
            </section>

            <section className="admin-card">
              <h2>Ultimos movimientos</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.ultimosMovimientos || []).map((factura) => (
                    <tr key={factura.id}>
                      <td>{factura.origen || "Tienda"}</td>
                      <td>{factura.numero || factura.id}</td>
                      <td>{factura.nombre || "Cliente"}</td>
                      <td>{money.format(factura.total || 0)}</td>
                      <td>
                        <span className="admin-pill">
                          {factura.estado || "pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

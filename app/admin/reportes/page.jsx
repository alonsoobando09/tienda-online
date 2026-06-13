"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getDiaLabel, money } from "@/lib/operacion";
import { BarChart3, CalendarDays, RefreshCcw } from "lucide-react";

function number(value) {
  return Number(value) || 0;
}

function dateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);

  const end = new Date(start);
  end.setDate(start.getDate() + 5);

  return {
    desde: dateInputValue(start),
    hasta: dateInputValue(end),
  };
}

function sumBy(items, field) {
  return items.reduce((acc, item) => acc + number(item[field]), 0);
}

function getLiquidacionDate(item) {
  return item.fecha || item.fechaRecepcion || "";
}

export default function ReportesAdminPage() {
  const week = useMemo(() => getWeekRange(), []);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    desde: week.desde,
    hasta: week.hasta,
    carterista: "todos",
  });

  async function cargarReportes() {
    setLoading(true);

    try {
      const snap = await getDocs(collection(db, "liquidaciones"));
      setLiquidaciones(
        snap.docs.map((docu) => ({
          id: docu.id,
          ...docu.data(),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarReportes();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const carteristas = useMemo(() => {
    const names = new Set();
    liquidaciones.forEach((item) => {
      if (item.carteristaNombre) names.add(item.carteristaNombre);
    });

    return [...names].sort((a, b) => a.localeCompare(b));
  }, [liquidaciones]);

  const liquidacionesFiltradas = useMemo(() => {
    return liquidaciones
      .filter((item) => {
        const fecha = getLiquidacionDate(item);
        const inRange =
          (!filters.desde || fecha >= filters.desde) &&
          (!filters.hasta || fecha <= filters.hasta);
        const byCarterista =
          filters.carterista === "todos" ||
          item.carteristaNombre === filters.carterista;

        return inRange && byCarterista;
      })
      .sort((a, b) => getLiquidacionDate(a).localeCompare(getLiquidacionDate(b)));
  }, [filters, liquidaciones]);

  const resumen = useMemo(
    () => ({
      diasTrabajados: new Set(
        liquidacionesFiltradas.map((item) => getLiquidacionDate(item))
      ).size,
      rutasLiquidadas: liquidacionesFiltradas.length,
      productosDejados: sumBy(liquidacionesFiltradas, "valorProductosDejados"),
      utilidadBruta: sumBy(liquidacionesFiltradas, "utilidadBruta"),
      descuadres: sumBy(liquidacionesFiltradas, "descuadreDinero"),
      faltantes: sumBy(liquidacionesFiltradas, "costoFaltante"),
      netoCarteristas: sumBy(liquidacionesFiltradas, "netoCarterista"),
      netoAyudantes: sumBy(liquidacionesFiltradas, "netoAyudante"),
      netoAdministrador: sumBy(liquidacionesFiltradas, "netoAdministrador"),
      descuentosCarteristas: sumBy(liquidacionesFiltradas, "descuentosCarterista"),
      descuentosAyudantes: sumBy(liquidacionesFiltradas, "descuentosAyudante"),
      gastosRegistrados: liquidacionesFiltradas.reduce(
        (acc, item) => acc + number(item.resumenGastosRuta?.total),
        0
      ),
      facturas: sumBy(liquidacionesFiltradas, "totalFacturasRuta"),
    }),
    [liquidacionesFiltradas]
  );

  const porCarterista = useMemo(() => {
    const grouped = new Map();

    liquidacionesFiltradas.forEach((item) => {
      const key = item.carteristaNombre || "Sin carterista";
      const current =
        grouped.get(key) ||
        {
          nombre: key,
          dias: new Set(),
          rutas: 0,
          productosDejados: 0,
          utilidadBruta: 0,
          netoCarterista: 0,
          descuentosCarterista: 0,
          netoAyudante: 0,
          descuadreDinero: 0,
          costoFaltante: 0,
          alertas: 0,
        };

      current.dias.add(getLiquidacionDate(item));
      current.rutas += 1;
      current.productosDejados += number(item.valorProductosDejados);
      current.utilidadBruta += number(item.utilidadBruta);
      current.netoCarterista += number(item.netoCarterista);
      current.descuentosCarterista += number(item.descuentosCarterista);
      current.netoAyudante += number(item.netoAyudante);
      current.descuadreDinero += number(item.descuadreDinero);
      current.costoFaltante += number(item.costoFaltante);
      if (number(item.descuadreDinero) !== 0 || number(item.costoFaltante) > 0) {
        current.alertas += 1;
      }

      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map((item) => ({ ...item, diasTrabajados: item.dias.size }))
      .sort((a, b) => b.utilidadBruta - a.utilidadBruta);
  }, [liquidacionesFiltradas]);

  const porAyudante = useMemo(() => {
    const grouped = new Map();

    liquidacionesFiltradas.forEach((item) => {
      const key = item.ayudanteNombre || "Sin ayudante";
      const current =
        grouped.get(key) ||
        {
          nombre: key,
          dias: new Set(),
          rutas: 0,
          pagoBase: 0,
          bonoClientes: 0,
          bruto: 0,
          descuentos: 0,
          neto: 0,
        };

      current.dias.add(getLiquidacionDate(item));
      current.rutas += 1;
      current.pagoBase += number(item.pagoBaseAyudante);
      current.bonoClientes += number(item.bonoClientes);
      current.bruto += number(item.totalAyudanteBruto);
      current.descuentos += number(item.descuentosAyudante);
      current.neto += number(item.netoAyudante);

      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map((item) => ({ ...item, diasTrabajados: item.dias.size }))
      .sort((a, b) => b.neto - a.neto);
  }, [liquidacionesFiltradas]);

  const alertas = useMemo(
    () =>
      liquidacionesFiltradas.filter(
        (item) => number(item.descuadreDinero) !== 0 || number(item.costoFaltante) > 0
      ),
    [liquidacionesFiltradas]
  );

  const cierreSemanal = useMemo(() => {
    const totalPagosEquipo = resumen.netoCarteristas + resumen.netoAyudantes;
    const totalAlertas = alertas.length;

    return {
      totalPagosEquipo,
      utilidadDespuesEquipo: resumen.utilidadBruta - totalPagosEquipo,
      totalDescuentos:
        resumen.descuentosCarteristas + resumen.descuentosAyudantes,
      estado:
        totalAlertas > 0
          ? `${totalAlertas} alerta${totalAlertas === 1 ? "" : "s"} por revisar`
          : "Semana sin alertas",
    };
  }, [alertas.length, resumen]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Reportes semanales"
        subtitle="Controla rutas, ganancias, descuadres, faltantes y pagos por carterista."
        actions={
          <button className="admin-button" disabled={loading} onClick={cargarReportes}>
            <RefreshCcw size={18} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        }
      >
        <section className="admin-card admin-accent-card">
          <div className="admin-section-title">
            <div>
              <h2>Periodo de revision</h2>
              <p>Filtra una semana, un rango de fechas o un carterista especifico.</p>
            </div>
            <CalendarDays size={28} />
          </div>

          <div className="admin-form">
            <label>
              Desde
              <input
                type="date"
                value={filters.desde}
                onChange={(event) => updateFilter("desde", event.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={filters.hasta}
                onChange={(event) => updateFilter("hasta", event.target.value)}
              />
            </label>
            <label>
              Carterista
              <select
                value={filters.carterista}
                onChange={(event) => updateFilter("carterista", event.target.value)}
              >
                <option value="todos">Todos los carteristas</option>
                {carteristas.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="admin-grid admin-kpis report-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Productos dejados</h3>
            <h2>{money(resumen.productosDejados)}</h2>
            <p>{resumen.rutasLiquidadas} rutas liquidadas.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Utilidad bruta</h3>
            <h2>{money(resumen.utilidadBruta)}</h2>
            <p>{resumen.diasTrabajados} dias trabajados.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Neto carteristas</h3>
            <h2>{money(resumen.netoCarteristas)}</h2>
            <p>Despues de descuentos.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Alertas</h3>
            <h2>{alertas.length}</h2>
            <p>Descuadres o faltantes.</p>
          </article>
        </section>

        <section className="admin-card weekly-close-card">
          <div className="admin-section-title">
            <div>
              <h2>Cierre semanal operativo</h2>
              <p>Resumen para pagar equipo, revisar alertas y cerrar caja.</p>
            </div>
          </div>
          <div className="weekly-close-grid">
            <div>
              <span>Total a pagar equipo</span>
              <strong>{money(cierreSemanal.totalPagosEquipo)}</strong>
            </div>
            <div>
              <span>Neto administrador</span>
              <strong>{money(resumen.netoAdministrador)}</strong>
            </div>
            <div>
              <span>Utilidad despues de equipo</span>
              <strong>{money(cierreSemanal.utilidadDespuesEquipo)}</strong>
            </div>
            <div>
              <span>Descuentos acumulados</span>
              <strong>{money(cierreSemanal.totalDescuentos)}</strong>
            </div>
            <div>
              <span>Gastos registrados</span>
              <strong>{money(resumen.gastosRegistrados)}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{cierreSemanal.estado}</strong>
            </div>
          </div>
        </section>

        <section className="report-grid">
          <article className="admin-card">
            <div className="admin-section-title">
              <div>
                <h2>Resumen por carterista</h2>
                <p>Vista para cerrar semana y revisar rendimiento.</p>
              </div>
              <BarChart3 size={28} />
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Carterista</th>
                  <th>Dias</th>
                  <th>Rutas</th>
                  <th>Productos</th>
                  <th>Utilidad</th>
                  <th>Neto</th>
                  <th>Descuentos</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {porCarterista.map((item) => (
                  <tr key={item.nombre}>
                    <td>{item.nombre}</td>
                    <td>{item.diasTrabajados}</td>
                    <td>{item.rutas}</td>
                    <td>{money(item.productosDejados)}</td>
                    <td>{money(item.utilidadBruta)}</td>
                    <td>{money(item.netoCarterista)}</td>
                    <td>{money(item.descuentosCarterista)}</td>
                    <td>{item.alertas}</td>
                  </tr>
                ))}
                {porCarterista.length === 0 && (
                  <tr>
                    <td colSpan="8">No hay liquidaciones en este periodo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </article>

          <article className="admin-card">
            <h2>Control general</h2>
            <div className="liquidation-lines">
              <span>Facturas de ruta</span>
              <strong>{resumen.facturas}</strong>
              <span>Pago neto ayudantes</span>
              <strong>{money(resumen.netoAyudantes)}</strong>
              <span>Descuentos ayudantes</span>
              <strong>{money(resumen.descuentosAyudantes)}</strong>
              <span>Neto administrador</span>
              <strong>{money(resumen.netoAdministrador)}</strong>
              <span>Descuadre dinero</span>
              <strong>{money(resumen.descuadres)}</strong>
              <span>Costo faltantes</span>
              <strong>{money(resumen.faltantes)}</strong>
            </div>
          </article>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Cierre por ayudante</h2>
              <p>Pago base, clientes abiertos, descuentos y neto semanal.</p>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Ayudante</th>
                <th>Dias</th>
                <th>Rutas</th>
                <th>Pago base</th>
                <th>Clientes abiertos</th>
                <th>Bruto</th>
                <th>Descuentos</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody>
              {porAyudante.map((item) => (
                <tr key={item.nombre}>
                  <td>{item.nombre}</td>
                  <td>{item.diasTrabajados}</td>
                  <td>{item.rutas}</td>
                  <td>{money(item.pagoBase)}</td>
                  <td>{money(item.bonoClientes)}</td>
                  <td>{money(item.bruto)}</td>
                  <td>{money(item.descuentos)}</td>
                  <td>{money(item.neto)}</td>
                </tr>
              ))}
              {porAyudante.length === 0 && (
                <tr>
                  <td colSpan="8">No hay ayudantes para este periodo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <h2>Detalle diario</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Dia</th>
                <th>Ruta</th>
                <th>Carterista</th>
                <th>Ayudante</th>
                <th>Productos</th>
                <th>Utilidad</th>
                <th>Descuadre</th>
                <th>Faltante</th>
                <th>Gastos ruta</th>
                <th>Neto carterista</th>
              </tr>
            </thead>
            <tbody>
              {liquidacionesFiltradas.map((item) => (
                <tr key={item.id}>
                  <td>{getLiquidacionDate(item)}</td>
                  <td>{getDiaLabel(item.diaRuta)}</td>
                  <td>{item.ruta || "Sin ruta"}</td>
                  <td>{item.carteristaNombre || "Sin carterista"}</td>
                  <td>{item.ayudanteNombre || "Sin ayudante"}</td>
                  <td>{money(item.valorProductosDejados)}</td>
                  <td>{money(item.utilidadBruta)}</td>
                  <td>{money(item.descuadreDinero)}</td>
                  <td>{money(item.costoFaltante)}</td>
                  <td>{money(item.resumenGastosRuta?.total || 0)}</td>
                  <td>{money(item.netoCarterista)}</td>
                </tr>
              ))}
              {liquidacionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan="11">No hay datos para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

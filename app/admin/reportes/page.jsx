"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getDiaLabel, money } from "@/lib/operacion";
import { BarChart3, CalendarDays, Download, RefreshCcw } from "lucide-react";

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

function getDineroFaltante(item) {
  return number(item.dineroFaltante) || Math.max(number(item.descuadreDinero) * -1, 0);
}

function getDineroSobrante(item) {
  return number(item.dineroSobrante) || Math.max(number(item.descuadreDinero), 0);
}

function csvValue(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

export default function ReportesAdminPage() {
  const week = useMemo(() => getWeekRange(), []);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    desde: week.desde,
    hasta: week.hasta,
    carterista: "todos",
  });

  async function cargarReportes() {
    setLoading(true);

    try {
      const [snap, clientesSnap] = await Promise.all([
        getDocs(collection(db, "liquidaciones")),
        getDocs(collection(db, "clientes")),
      ]);
      setLiquidaciones(
        snap.docs.map((docu) => ({
          id: docu.id,
          ...docu.data(),
        }))
      );
      setClientes(clientesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
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
      dineroFaltante: liquidacionesFiltradas.reduce(
        (acc, item) => acc + getDineroFaltante(item),
        0
      ),
      dineroSobrante: liquidacionesFiltradas.reduce(
        (acc, item) => acc + getDineroSobrante(item),
        0
      ),
      faltantes: sumBy(liquidacionesFiltradas, "costoFaltante"),
      netoCarteristas: sumBy(liquidacionesFiltradas, "netoCarterista"),
      netoAyudantes: sumBy(liquidacionesFiltradas, "netoAyudante"),
      netoAdministrador: sumBy(liquidacionesFiltradas, "netoAdministrador"),
      descuentosCarteristas: sumBy(liquidacionesFiltradas, "descuentosCarterista"),
      descuentosAyudantes: sumBy(liquidacionesFiltradas, "descuentosAyudante"),
      diferenciaSurtido: sumBy(liquidacionesFiltradas, "diferenciaDejadoFacturado"),
      auditoriasConAlertas: liquidacionesFiltradas.filter(
        (item) => item.auditoriaEstado && item.auditoriaEstado !== "cuadrado"
      ).length,
      gastosRegistrados: liquidacionesFiltradas.reduce(
        (acc, item) => acc + number(item.resumenGastosRuta?.total),
        0
      ),
      facturas: sumBy(liquidacionesFiltradas, "totalFacturasRuta"),
      gestionesRuta: sumBy(liquidacionesFiltradas, "totalGestionesRuta"),
      clientesVisitados: sumBy(liquidacionesFiltradas, "clientesVisitadosRuta"),
      clientesNoDisponibles: sumBy(
        liquidacionesFiltradas,
        "clientesNoDisponiblesRuta"
      ),
      clientesRiesgo: sumBy(liquidacionesFiltradas, "clientesRiesgoRuta"),
      deudaGestionada: sumBy(liquidacionesFiltradas, "deudaGestionadaRuta"),
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
          dineroFaltante: 0,
          dineroSobrante: 0,
          costoFaltante: 0,
          diferenciaSurtido: 0,
          alertas: 0,
          alertasAuditoria: 0,
          gestionesRuta: 0,
          clientesVisitados: 0,
          clientesNoDisponibles: 0,
          clientesRiesgo: 0,
          deudaGestionada: 0,
        };

      current.dias.add(getLiquidacionDate(item));
      current.rutas += 1;
      current.productosDejados += number(item.valorProductosDejados);
      current.utilidadBruta += number(item.utilidadBruta);
      current.netoCarterista += number(item.netoCarterista);
      current.descuentosCarterista += number(item.descuentosCarterista);
      current.netoAyudante += number(item.netoAyudante);
      current.descuadreDinero += number(item.descuadreDinero);
      current.dineroFaltante += getDineroFaltante(item);
      current.dineroSobrante += getDineroSobrante(item);
      current.costoFaltante += number(item.costoFaltante);
      current.diferenciaSurtido += number(item.diferenciaDejadoFacturado);
      current.gestionesRuta += number(item.totalGestionesRuta);
      current.clientesVisitados += number(item.clientesVisitadosRuta);
      current.clientesNoDisponibles += number(item.clientesNoDisponiblesRuta);
      current.clientesRiesgo += number(item.clientesRiesgoRuta);
      current.deudaGestionada += number(item.deudaGestionadaRuta);
      if (
        number(item.descuadreDinero) !== 0 ||
        number(item.costoFaltante) > 0 ||
        number(item.diferenciaDejadoFacturado) !== 0 ||
        number(item.clientesRiesgoRuta) > 0
      ) {
        current.alertas += 1;
      }
      if (item.auditoriaEstado && item.auditoriaEstado !== "cuadrado") {
        current.alertasAuditoria += 1;
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
        (item) =>
          number(item.descuadreDinero) !== 0 ||
          number(item.costoFaltante) > 0 ||
          number(item.diferenciaDejadoFacturado) !== 0 ||
          number(item.clientesRiesgoRuta) > 0 ||
          (item.auditoriaEstado && item.auditoriaEstado !== "cuadrado")
      ),
    [liquidacionesFiltradas]
  );

  const cierreSemanal = useMemo(() => {
    const totalPagosEquipo = resumen.netoCarteristas + resumen.netoAyudantes;
    const totalAlertas = alertas.length;
    const rentabilidad =
      resumen.productosDejados > 0
        ? (resumen.utilidadBruta / resumen.productosDejados) * 100
        : 0;
    const participacionAdmin =
      resumen.utilidadBruta > 0
        ? (resumen.netoAdministrador / resumen.utilidadBruta) * 100
        : 0;

    return {
      totalPagosEquipo,
      utilidadDespuesEquipo: resumen.utilidadBruta - totalPagosEquipo,
      totalDescuentos:
        resumen.descuentosCarteristas + resumen.descuentosAyudantes,
      rentabilidad,
      participacionAdmin,
      estado:
        totalAlertas > 0
          ? `${totalAlertas} alerta${totalAlertas === 1 ? "" : "s"} por revisar`
          : "Semana sin alertas",
    };
  }, [alertas.length, resumen]);

  const resumenCartera = useMemo(() => {
    return clientes.reduce(
      (acc, cliente) => {
        const deuda = number(cliente.deudaActual);
        if (deuda <= 0) return acc;

        acc.total += deuda;
        acc.clientes += 1;

        if (number(cliente.diasDeuda) >= 30) {
          acc.vencida += deuda;
          acc.vencidos += 1;
        }

        if (cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida) {
          acc.riesgo += deuda;
          acc.riesgoClientes += 1;
        }

        if (cliente.estadoCliente === "perdido" || cliente.perdido) {
          acc.perdida += deuda;
          acc.perdidos += 1;
        }

        return acc;
      },
      {
        total: 0,
        clientes: 0,
        vencida: 0,
        vencidos: 0,
        riesgo: 0,
        riesgoClientes: 0,
        perdida: 0,
        perdidos: 0,
      }
    );
  }, [clientes]);

  const rankingProblemas = useMemo(() => {
    return [...porCarterista]
      .map((item) => ({
        ...item,
        impacto:
          number(item.dineroFaltante) +
          number(item.costoFaltante) +
          number(item.deudaGestionada) +
          Math.abs(number(item.diferenciaSurtido)) * 1000,
      }))
      .filter((item) => item.impacto > 0 || item.alertas > 0)
      .sort((a, b) => b.impacto - a.impacto)
      .slice(0, 5);
  }, [porCarterista]);

  const alertasPriorizadas = useMemo(() => {
    return alertas
      .map((item) => {
        const problemas = [];
        if (number(item.descuadreDinero) !== 0) problemas.push("dinero");
        if (number(item.costoFaltante) > 0) problemas.push("faltante");
        if (number(item.diferenciaDejadoFacturado) !== 0) problemas.push("surtido");
        if (number(item.clientesRiesgoRuta) > 0) problemas.push("riesgo");
        if (item.auditoriaEstado && item.auditoriaEstado !== "cuadrado") {
          problemas.push("auditoria");
        }

        return {
          id: item.id,
          fecha: getLiquidacionDate(item),
          ruta: item.ruta || "Sin ruta",
          carterista: item.carteristaNombre || "Sin carterista",
          impacto:
            getDineroFaltante(item) +
            number(item.costoFaltante) +
            number(item.deudaGestionadaRuta),
          problemas: problemas.join(", "),
        };
      })
      .sort((a, b) => b.impacto - a.impacto)
      .slice(0, 8);
  }, [alertas]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function exportarDetalleCsv() {
    const headers = [
      "Fecha",
      "Dia",
      "Ruta",
      "Carterista",
      "Ayudante",
      "Productos",
      "Utilidad",
      "Descuadre",
      "Plata faltante",
      "Plata sobrante",
      "Diferencia surtido",
      "Auditoria",
      "Faltante",
      "Gastos ruta",
      "Gestiones ruta",
      "Visitados",
      "No disponibles",
      "Riesgo cartera",
      "Deuda gestionada",
      "Neto carterista",
      "Neto ayudante",
      "Neto administrador",
    ];

    const rows = liquidacionesFiltradas.map((item) => [
      getLiquidacionDate(item),
      getDiaLabel(item.diaRuta),
      item.ruta || "",
      item.carteristaNombre || "",
      item.ayudanteNombre || "",
      number(item.valorProductosDejados),
      number(item.utilidadBruta),
      number(item.descuadreDinero),
      getDineroFaltante(item),
      getDineroSobrante(item),
      number(item.diferenciaDejadoFacturado),
      item.auditoriaEstado || "",
      number(item.costoFaltante),
      number(item.resumenGastosRuta?.total),
      number(item.totalGestionesRuta),
      number(item.clientesVisitadosRuta),
      number(item.clientesNoDisponiblesRuta),
      number(item.clientesRiesgoRuta),
      number(item.deudaGestionadaRuta),
      number(item.netoCarterista),
      number(item.netoAyudante),
      number(item.netoAdministrador),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-rutas-${filters.desde || "inicio"}-${filters.hasta || "fin"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminGuard>
      <AdminShell
        title="Reportes semanales"
        subtitle="Controla rutas, ganancias, descuadres, faltantes y pagos por carterista."
        actions={
          <>
            <button
              className="admin-button secondary"
              disabled={loading || liquidacionesFiltradas.length === 0}
              onClick={exportarDetalleCsv}
            >
              <Download size={18} />
              Exportar CSV
            </button>
            <button className="admin-button" disabled={loading} onClick={cargarReportes}>
              <RefreshCcw size={18} />
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </>
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
            <p>Dinero, surtido o auditoria.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis report-kpis">
          <article className="admin-card">
            <h3>Gestiones ruta</h3>
            <h2>{resumen.gestionesRuta}</h2>
            <p>{resumen.clientesVisitados} clientes visitados.</p>
          </article>
          <article className="admin-card">
            <h3>No disponibles</h3>
            <h2>{resumen.clientesNoDisponibles}</h2>
            <p>Clientes cerrados, ausentes o sin atender.</p>
          </article>
          <article className="admin-card">
            <h3>Riesgo cartera</h3>
            <h2>{resumen.clientesRiesgo}</h2>
            <p>Clientes en gris por riesgo de perdida.</p>
          </article>
          <article className="admin-card">
            <h3>Deuda gestionada</h3>
            <h2>{money(resumen.deudaGestionada)}</h2>
            <p>Cartera tocada durante las rutas.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis report-kpis">
          <article className="admin-card">
            <h3>Cartera actual</h3>
            <h2>{money(resumenCartera.total)}</h2>
            <p>{resumenCartera.clientes} clientes con deuda.</p>
          </article>
          <article className="admin-card">
            <h3>Cartera vencida</h3>
            <h2>{money(resumenCartera.vencida)}</h2>
            <p>{resumenCartera.vencidos} clientes 30+ dias.</p>
          </article>
          <article className="admin-card">
            <h3>Riesgo marcado</h3>
            <h2>{money(resumenCartera.riesgo)}</h2>
            <p>{resumenCartera.riesgoClientes} clientes en gris.</p>
          </article>
          <article className="admin-card">
            <h3>Perdidos</h3>
            <h2>{money(resumenCartera.perdida)}</h2>
            <p>{resumenCartera.perdidos} clientes por recuperar.</p>
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
              <span>Plata faltante</span>
              <strong>{money(resumen.dineroFaltante)}</strong>
            </div>
            <div>
              <span>Plata sobrante</span>
              <strong>{money(resumen.dineroSobrante)}</strong>
            </div>
            <div>
              <span>Gastos registrados</span>
              <strong>{money(resumen.gastosRegistrados)}</strong>
            </div>
            <div>
              <span>Clientes gestionados</span>
              <strong>{resumen.gestionesRuta}</strong>
            </div>
            <div>
              <span>Visitados / riesgo</span>
              <strong>
                {resumen.clientesVisitados} / {resumen.clientesRiesgo}
              </strong>
            </div>
            <div>
              <span>Rentabilidad rutas</span>
              <strong>{Math.round(cierreSemanal.rentabilidad)}%</strong>
            </div>
            <div>
              <span>Participacion admin</span>
              <strong>{Math.round(cierreSemanal.participacionAdmin)}%</strong>
            </div>
            <div>
              <span>Diferencia surtido</span>
              <strong>{resumen.diferenciaSurtido}</strong>
            </div>
            <div>
              <span>Auditorias con alerta</span>
              <strong>{resumen.auditoriasConAlertas}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{cierreSemanal.estado}</strong>
            </div>
          </div>
        </section>

        <section className="report-grid">
          <article className="admin-card audit-panel">
            <div className="admin-section-title">
              <div>
                <h2>Alertas priorizadas</h2>
                <p>Rutas que conviene revisar primero antes de cerrar semana.</p>
              </div>
              <span className="audit-status con_alertas">
                {alertasPriorizadas.length} alertas
              </span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ruta</th>
                  <th>Carterista</th>
                  <th>Problema</th>
                  <th>Impacto</th>
                </tr>
              </thead>
              <tbody>
                {alertasPriorizadas.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fecha}</td>
                    <td>{item.ruta}</td>
                    <td>{item.carterista}</td>
                    <td>{item.problemas}</td>
                    <td>{money(item.impacto)}</td>
                  </tr>
                ))}
                {alertasPriorizadas.length === 0 && (
                  <tr>
                    <td colSpan="5">Sin alertas en este periodo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </article>

          <article className="admin-card">
            <h2>Ranking de problemas</h2>
            <div className="liquidation-lines">
              {rankingProblemas.map((item) => (
                <div className="report-ranking-line" key={item.nombre}>
                  <span>{item.nombre}</span>
                  <strong>{money(item.impacto)}</strong>
                  <small>
                    {item.alertas} alertas · surtido {item.diferenciaSurtido}
                  </small>
                </div>
              ))}
              {rankingProblemas.length === 0 && (
                <>
                  <span>Estado</span>
                  <strong>Sin problemas acumulados</strong>
                </>
              )}
            </div>
          </article>
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
                  <th>Visitados</th>
                  <th>Riesgo</th>
                  <th>Falta plata</th>
                  <th>Sobra plata</th>
                  <th>Surtido</th>
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
                    <td>
                      {item.clientesVisitados} / {item.gestionesRuta}
                    </td>
                    <td>
                      <span
                        className={`debt-pill ${
                          item.clientesRiesgo ? "gris" : "verde"
                        }`}
                      >
                        {item.clientesRiesgo}
                      </span>
                    </td>
                    <td>{money(item.dineroFaltante)}</td>
                    <td>{money(item.dineroSobrante)}</td>
                    <td>{item.diferenciaSurtido}</td>
                    <td>{item.alertas}</td>
                  </tr>
                ))}
                {porCarterista.length === 0 && (
                  <tr>
                    <td colSpan="13">No hay liquidaciones en este periodo.</td>
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
              <span>Gestiones ruta</span>
              <strong>{resumen.gestionesRuta}</strong>
              <span>No disponibles</span>
              <strong>{resumen.clientesNoDisponibles}</strong>
              <span>Riesgo cartera</span>
              <strong>{resumen.clientesRiesgo}</strong>
              <span>Deuda gestionada</span>
              <strong>{money(resumen.deudaGestionada)}</strong>
              <span>Pago neto ayudantes</span>
              <strong>{money(resumen.netoAyudantes)}</strong>
              <span>Descuentos ayudantes</span>
              <strong>{money(resumen.descuentosAyudantes)}</strong>
              <span>Neto administrador</span>
              <strong>{money(resumen.netoAdministrador)}</strong>
              <span>Descuadre dinero</span>
              <strong>{money(resumen.descuadres)}</strong>
              <span>Plata faltante</span>
              <strong>{money(resumen.dineroFaltante)}</strong>
              <span>Plata sobrante</span>
              <strong>{money(resumen.dineroSobrante)}</strong>
              <span>Costo faltantes</span>
              <strong>{money(resumen.faltantes)}</strong>
              <span>Diferencia surtido</span>
              <strong>{resumen.diferenciaSurtido}</strong>
              <span>Auditorias con alerta</span>
              <strong>{resumen.auditoriasConAlertas}</strong>
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
                <th>Falta plata</th>
                <th>Sobra plata</th>
                <th>Surtido</th>
                <th>Auditoria</th>
                <th>Faltante</th>
                <th>Gastos ruta</th>
                <th>Gestiones</th>
                <th>Riesgo</th>
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
                  <td>{money(getDineroFaltante(item))}</td>
                  <td>{money(getDineroSobrante(item))}</td>
                  <td>{number(item.diferenciaDejadoFacturado)}</td>
                  <td>{item.auditoriaEstado || "Sin auditoria"}</td>
                  <td>{money(item.costoFaltante)}</td>
                  <td>{money(item.resumenGastosRuta?.total || 0)}</td>
                  <td>
                    {(item.clientesVisitadosRuta || 0)} /{" "}
                    {(item.totalGestionesRuta || 0)}
                  </td>
                  <td>{item.clientesRiesgoRuta || 0}</td>
                  <td>{money(item.netoCarterista)}</td>
                </tr>
              ))}
              {liquidacionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan="17">No hay datos para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

function number(value) {
  return Number(value) || 0;
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

function isSameDay(value, today) {
  if (!value) return false;
  if (typeof value === "string") return value.slice(0, 10) === today;
  const time = timestampValue(value);
  if (!time) return false;
  return new Date(time).toISOString().slice(0, 10) === today;
}

export async function GET() {
  try {
    const [
      facturasSnap,
      facturasRutaSnap,
      clientesSnap,
      comprasSnap,
      cuentasPagarSnap,
      liquidacionesSnap,
    ] = await Promise.all([
      getDocs(query(collection(db, "facturas"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "facturasRuta")),
      getDocs(collection(db, "clientes")),
      getDocs(collection(db, "compras")),
      getDocs(collection(db, "cuentasPagar")),
      getDocs(collection(db, "liquidaciones")),
    ]);

    const facturas = facturasSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    const facturasRuta = facturasRutaSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    const clientes = clientesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    const compras = comprasSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    const cuentasPagar = cuentasPagarSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    const liquidaciones = liquidacionesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }));
    const today = new Date().toISOString().slice(0, 10);

    const ingresosTienda = facturas
      .filter((factura) => ["pagado", "enviado", "entregado"].includes(factura.estado))
      .reduce((acc, factura) => acc + number(factura.total), 0);

    const cuentasPorCobrarTienda = facturas
      .filter((factura) => factura.estado === "pendiente")
      .reduce((acc, factura) => acc + number(factura.total), 0);

    const ventasBrutasTienda = facturas.reduce(
      (acc, factura) => acc + number(factura.total),
      0
    );

    const ruta = facturasRuta.reduce(
      (acc, factura) => {
        acc.ventas += number(factura.totalProductos);
        acc.cobrado += number(factura.abonoDeudaAnterior) + number(factura.pagoProductosHoy);
        acc.fiado += number(factura.fiadoHoy);
        if (isSameDay(factura.fecha, today)) {
          acc.hoyVentas += number(factura.totalProductos);
          acc.hoyCobrado +=
            number(factura.abonoDeudaAnterior) + number(factura.pagoProductosHoy);
          acc.hoyFiado += number(factura.fiadoHoy);
          acc.hoyFacturas += 1;
        }
        return acc;
      },
      {
        ventas: 0,
        cobrado: 0,
        fiado: 0,
        hoyVentas: 0,
        hoyCobrado: 0,
        hoyFiado: 0,
        hoyFacturas: 0,
      }
    );

    const tiendaHoy = facturas.reduce(
      (acc, factura) => {
        if (!isSameDay(factura.createdAt || factura.fecha, today)) return acc;

        acc.ventas += number(factura.total);
        acc.facturas += 1;
        if (["pagado", "enviado", "entregado"].includes(factura.estado)) {
          acc.cobrado += number(factura.total);
        }
        if (factura.estado === "pendiente") {
          acc.pendiente += number(factura.total);
        }
        return acc;
      },
      { ventas: 0, cobrado: 0, pendiente: 0, facturas: 0 }
    );

    const cartera = clientes.reduce(
      (acc, cliente) => {
        const deuda = number(cliente.deudaActual);
        if (deuda <= 0) return acc;

        acc.total += deuda;
        acc.clientes += 1;
        if (number(cliente.diasDeuda) >= 30) acc.vencida += deuda;
        if (cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida) {
          acc.riesgo += deuda;
        }
        if (cliente.estadoCliente === "perdido" || cliente.perdido) {
          acc.perdida += deuda;
        }
        return acc;
      },
      { total: 0, clientes: 0, vencida: 0, riesgo: 0, perdida: 0 }
    );

    const comprasResumen = compras.reduce(
      (acc, compra) => {
        acc.total += number(compra.totalCompra);
        acc.facturas += 1;
        if (
          compra.alertaFactura ||
          compra.estadoRevisionFactura === "diferencia_fuerte"
        ) {
          acc.alertas += 1;
        }
        return acc;
      },
      { total: 0, facturas: 0, alertas: 0 }
    );

    const cuentasPagarResumen = cuentasPagar.reduce(
      (acc, cuenta) => {
        const saldo = number(cuenta.saldoPendiente);
        acc.total += number(cuenta.total);
        acc.saldo += saldo;
        acc.abonado += number(cuenta.abonado);
        if (saldo > 0) acc.pendientes += 1;
        if (saldo > 0 && cuenta.fechaVencimiento && cuenta.fechaVencimiento < today) {
          acc.vencidas += 1;
        }
        if (number(cuenta.diferenciaFactura) !== 0) {
          acc.facturasConDiferencia += 1;
        }
        (cuenta.pagos || []).forEach((pago) => {
          const metodo = pago.metodo || "efectivo";
          acc.pagosPorMetodo[metodo] =
            (acc.pagosPorMetodo[metodo] || 0) + number(pago.valor);
        });
        return acc;
      },
      {
        total: 0,
        saldo: 0,
        abonado: 0,
        pendientes: 0,
        vencidas: 0,
        facturasConDiferencia: 0,
        pagosPorMetodo: {},
      }
    );

    const pagosProveedorPorMetodo = Object.entries(cuentasPagarResumen.pagosPorMetodo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([metodo, valor]) => ({ metodo, valor }));

    const liquidacionesResumen = liquidaciones.reduce(
      (acc, liquidacion) => {
        acc.utilidadBruta += number(liquidacion.utilidadBruta);
        acc.netoAdministrador += number(liquidacion.netoAdministrador);
        acc.netoCarteristas += number(liquidacion.netoCarterista);
        acc.netoAyudantes += number(liquidacion.netoAyudante);
        acc.descuadreDinero += number(liquidacion.descuadreDinero);
        acc.dineroFaltante +=
          number(liquidacion.dineroFaltante) ||
          Math.max(number(liquidacion.descuadreDinero) * -1, 0);
        acc.dineroSobrante +=
          number(liquidacion.dineroSobrante) ||
          Math.max(number(liquidacion.descuadreDinero), 0);
        acc.costoFaltante += number(liquidacion.costoFaltante);
        if (liquidacion.auditoriaEstado && liquidacion.auditoriaEstado !== "cuadrado") {
          acc.alertas += 1;
        }
        if (isSameDay(liquidacion.fecha, today)) {
          acc.hoyUtilidadBruta += number(liquidacion.utilidadBruta);
          acc.hoyNetoAdministrador += number(liquidacion.netoAdministrador);
          acc.hoyRutas += 1;
        }
        return acc;
      },
      {
        utilidadBruta: 0,
        netoAdministrador: 0,
        netoCarteristas: 0,
        netoAyudantes: 0,
        descuadreDinero: 0,
        dineroFaltante: 0,
        dineroSobrante: 0,
        costoFaltante: 0,
        alertas: 0,
        hoyUtilidadBruta: 0,
        hoyNetoAdministrador: 0,
        hoyRutas: 0,
      }
    );

    const ingresos = ingresosTienda + ruta.cobrado;
    const cuentasPorCobrar = cuentasPorCobrarTienda + cartera.total;
    const ventasBrutas = ventasBrutasTienda + ruta.ventas;
    const posicionNeta = ingresos + cuentasPorCobrar - cuentasPagarResumen.saldo;
    const cajaOperativa = ingresos - cuentasPagarResumen.saldo;
    const margenRuta =
      ruta.ventas > 0 ? (liquidacionesResumen.utilidadBruta / ruta.ventas) * 100 : 0;
    const efectividadCobro =
      ventasBrutas > 0 ? (ingresos / ventasBrutas) * 100 : 0;

    const alertasFinancieras = [
      cartera.perdida > 0 && {
        tipo: "Cartera perdida",
        detalle: `${cartera.clientes} clientes con deuda activa. Revisar archivo gris/negro.`,
        valor: cartera.perdida,
        prioridad: "alta",
      },
      cartera.riesgo > 0 && {
        tipo: "Cartera en riesgo",
        detalle: "Clientes marcados en riesgo de perder plata.",
        valor: cartera.riesgo,
        prioridad: "media",
      },
      cuentasPagarResumen.vencidas > 0 && {
        tipo: "Proveedores vencidos",
        detalle: `${cuentasPagarResumen.vencidas} cuentas por pagar vencidas.`,
        valor: cuentasPagarResumen.saldo,
        prioridad: "alta",
      },
      cuentasPagarResumen.facturasConDiferencia > 0 && {
        tipo: "Facturas proveedor",
        detalle: "Cuentas por pagar con diferencia entre factura y calculo.",
        valor: cuentasPagarResumen.facturasConDiferencia,
        prioridad: "alta",
      },
      comprasResumen.alertas > 0 && {
        tipo: "Compras con alerta",
        detalle: "Facturas de proveedor con diferencia frente al calculo.",
        valor: comprasResumen.alertas,
        prioridad: "media",
      },
      liquidacionesResumen.alertas > 0 && {
        tipo: "Liquidaciones con alerta",
        detalle: "Rutas con descuadres de dinero o surtido.",
        valor: liquidacionesResumen.alertas,
        prioridad: "alta",
      },
    ].filter(Boolean);

    const ultimosMovimientos = [
      ...facturas.slice(0, 6).map((factura) => ({
        id: `tienda_${factura.id}`,
        origen: "Tienda",
        numero: factura.numero || factura.id,
        nombre: factura.cliente?.nombre || "Cliente",
        total: number(factura.total),
        estado: factura.estado || "pendiente",
      })),
      ...facturasRuta.slice(-6).reverse().map((factura) => ({
        id: `ruta_${factura.id}`,
        origen: "Ruta",
        numero: factura.id,
        nombre: factura.clienteNombre || "Cliente",
        total: number(factura.totalProductos),
        estado: number(factura.fiadoHoy) > 0 ? "fiado" : "cobrado",
      })),
    ].slice(0, 12);

    const cuentasPagarCriticas = cuentasPagar
      .filter((cuenta) => number(cuenta.saldoPendiente) > 0)
      .sort((a, b) => String(a.fechaVencimiento || "").localeCompare(String(b.fechaVencimiento || "")))
      .slice(0, 6)
      .map((cuenta) => ({
        id: cuenta.id,
        proveedor: cuenta.proveedor || "Sin proveedor",
        facturaProveedor: cuenta.facturaProveedor || "Sin factura",
        fechaVencimiento: cuenta.fechaVencimiento || "",
        saldoPendiente: number(cuenta.saldoPendiente),
        vencida: Boolean(cuenta.fechaVencimiento && cuenta.fechaVencimiento < today),
      }));

    const carteraCritica = clientes
      .filter((cliente) => number(cliente.deudaActual) > 0)
      .sort((a, b) => number(b.diasDeuda) - number(a.diasDeuda))
      .slice(0, 6)
      .map((cliente) => ({
        id: cliente.id,
        nombre: cliente.nombre || "Cliente",
        ruta: cliente.ruta || "Sin ruta",
        diaRuta: cliente.diaRuta || "",
        deudaActual: number(cliente.deudaActual),
        diasDeuda: number(cliente.diasDeuda),
        estadoCliente: cliente.estadoCliente || "activo",
      }));

    return NextResponse.json({
      ingresos,
      ingresosTienda,
      ingresosRuta: ruta.cobrado,
      cuentasPorCobrar,
      cuentasPorCobrarTienda,
      carteraClientes: cartera.total,
      carteraVencida: cartera.vencida,
      carteraRiesgo: cartera.riesgo,
      carteraPerdida: cartera.perdida,
      clientesConDeuda: cartera.clientes,
      ventasBrutas,
      ventasBrutasTienda,
      ventasBrutasRuta: ruta.ventas,
      fiadoRuta: ruta.fiado,
      cajaOperativa,
      posicionNeta,
      margenRuta,
      efectividadCobro,
      hoy: {
        ventas: tiendaHoy.ventas + ruta.hoyVentas,
        cobrado: tiendaHoy.cobrado + ruta.hoyCobrado,
        pendiente: tiendaHoy.pendiente + ruta.hoyFiado,
        facturas: tiendaHoy.facturas + ruta.hoyFacturas,
        utilidadBruta: liquidacionesResumen.hoyUtilidadBruta,
        netoAdministrador: liquidacionesResumen.hoyNetoAdministrador,
        rutasLiquidadas: liquidacionesResumen.hoyRutas,
      },
      comprasTotal: comprasResumen.total,
      comprasFacturas: comprasResumen.facturas,
      comprasConAlerta: comprasResumen.alertas,
      cuentasPorPagar: cuentasPagarResumen.saldo,
      cuentasPagarTotal: cuentasPagarResumen.total,
      cuentasPagarAbonado: cuentasPagarResumen.abonado,
      cuentasPagarPendientes: cuentasPagarResumen.pendientes,
      cuentasPagarVencidas: cuentasPagarResumen.vencidas,
      cuentasPagarFacturasConDiferencia: cuentasPagarResumen.facturasConDiferencia,
      pagosProveedorPorMetodo,
      utilidadBrutaRutas: liquidacionesResumen.utilidadBruta,
      netoAdministrador: liquidacionesResumen.netoAdministrador,
      netoCarteristas: liquidacionesResumen.netoCarteristas,
      netoAyudantes: liquidacionesResumen.netoAyudantes,
      descuadreDinero: liquidacionesResumen.descuadreDinero,
      dineroFaltante: liquidacionesResumen.dineroFaltante,
      dineroSobrante: liquidacionesResumen.dineroSobrante,
      costoFaltante: liquidacionesResumen.costoFaltante,
      liquidacionesConAlertas: liquidacionesResumen.alertas,
      alertasFinancieras,
      cuentasPagarCriticas,
      carteraCritica,
      impuestosEstimados: 0,
      facturasPendientes: facturas.filter((factura) => factura.estado === "pendiente"),
      ultimosMovimientos,
    });
  } catch (error) {
    console.error("Error contabilidad:", error);

    return NextResponse.json(
      { error: "Error cargando contabilidad" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  authErrorResponse,
  getRequestEmpresaId,
  requirePermission,
} from "@/lib/serverAuth";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  return new Date(value);
}

function serializeValue(value) {
  if (!value) return value ?? null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeValue(entry)])
    );
  }
  return value;
}

function sameDay(a, b) {
  return (
    a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date) {
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getDebtColor(dias) {
  const value = Number(dias) || 0;
  if (value >= 60) return "negro";
  if (value >= 30) return "rojo";
  if (value >= 15) return "amarillo";
  return "verde";
}

async function getEmpresaDocs(db, collectionName, empresaId) {
  const snapshot = await db
    .collection(collectionName)
    .where("empresaId", "==", empresaId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function GET(request) {
  try {
    const actor = await requirePermission(request, "dashboard.read");
    const empresaId = getRequestEmpresaId(request, actor);
    const adminDb = getAdminDb();

    const [
      facturasRaw,
      productos,
      clientesLista,
      recepciones,
      liquidaciones,
      despachos,
      facturasRuta,
      compras,
      cuentasPagar,
      gestionesRuta,
    ] = await Promise.all([
      getEmpresaDocs(adminDb, "facturas", empresaId),
      getEmpresaDocs(adminDb, "productos", empresaId),
      getEmpresaDocs(adminDb, "clientes", empresaId),
      getEmpresaDocs(adminDb, "recepciones", empresaId),
      getEmpresaDocs(adminDb, "liquidaciones", empresaId),
      getEmpresaDocs(adminDb, "despachos", empresaId),
      getEmpresaDocs(adminDb, "facturasRuta", empresaId),
      getEmpresaDocs(adminDb, "compras", empresaId),
      getEmpresaDocs(adminDb, "cuentasPagar", empresaId),
      getEmpresaDocs(adminDb, "gestionesRuta", empresaId),
    ]);

    const hoy = new Date();

    const facturasEmpresa = facturasRaw
      .map((factura) => ({
        ...factura,
        fecha: toDate(factura.createdAt),
      }))
      .sort((a, b) => {
        const fechaA = a.fecha?.getTime?.() || 0;
        const fechaB = b.fecha?.getTime?.() || 0;
        return fechaB - fechaA;
      });

    const fechaHoy = hoy.toISOString().slice(0, 10);
    const ventasHoyLista = facturasEmpresa.filter((factura) =>
      sameDay(factura.fecha, hoy)
    );

    const facturasRutaHoy = facturasRuta.filter(
      (factura) => factura.fecha === fechaHoy
    );

    const gestionesHoy = gestionesRuta.filter(
      (gestion) => gestion.fecha === fechaHoy
    );

    const gestionesResumenHoy = gestionesHoy.reduce(
      (acc, gestion) => {
        const estado = gestion.estadoVisita || "pendiente";
        acc.total += 1;
        acc[estado] = (acc[estado] || 0) + 1;
        if (gestion.carteristaNombre) acc.carteristas.add(gestion.carteristaNombre);
        acc.deuda += Number(gestion.deudaActual) || 0;
        return acc;
      },
      {
        total: 0,
        pendiente: 0,
        visitado: 0,
        no_encontrado: 0,
        riesgo_perdida: 0,
        deuda: 0,
        carteristas: new Set(),
      }
    );

    const ingresosHoy = ventasHoyLista.reduce(
      (acc, factura) => acc + (Number(factura.total) || 0),
      0
    );

    const ingresosTiendaConfirmadosHoy = ventasHoyLista
      .filter((factura) =>
        ["pagado", "enviado", "entregado"].includes(factura.estado)
      )
      .reduce((acc, factura) => acc + (Number(factura.total) || 0), 0);

    const pendienteTiendaHoy = ventasHoyLista
      .filter((factura) => factura.estado === "pendiente")
      .reduce((acc, factura) => acc + (Number(factura.total) || 0), 0);

    const rutaHoy = facturasRutaHoy.reduce(
      (acc, factura) => {
        acc.ventas += 1;
        acc.valor += Number(factura.totalProductos) || 0;
        acc.cobrado +=
          (Number(factura.abonoDeudaAnterior) || 0) +
          (Number(factura.pagoProductosHoy) || 0);
        acc.fiado += Number(factura.fiadoHoy) || 0;
        return acc;
      },
      { ventas: 0, valor: 0, cobrado: 0, fiado: 0 }
    );

    const totalInventario = productos.reduce(
      (acc, producto) => acc + (Number(producto.stock) || 0),
      0
    );

    const valorInventario = productos.reduce((acc, producto) => {
      const stock = Number(producto.stock) || 0;
      const costo = Number(producto.costo || producto.precioMayor) || 0;
      return acc + stock * costo;
    }, 0);

    const pagosPendientes = facturasEmpresa.filter(
      (factura) => factura.estado === "pendiente"
    ).length;

    const clientesFacturados = new Set(
      facturasEmpresa
        .map((factura) => factura.cliente?.telefono || factura.cliente?.email)
        .filter(Boolean)
    ).size;

    const cartera = clientesLista.reduce(
      (acc, cliente) => {
        const deuda = Number(cliente.deudaActual) || 0;
        const dias = Number(cliente.diasDeuda) || 0;

        if (deuda <= 0) return acc;
        acc.total += deuda;
        acc.clientes += 1;
        if (dias >= 30) {
          acc.vencida += deuda;
          acc.riesgo += 1;
        }
        if (cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida) {
          acc.riesgoMarcado += deuda;
          acc.riesgoMarcadoClientes += 1;
        }
        if (cliente.estadoCliente === "perdido" || cliente.perdido) {
          acc.perdidos += deuda;
          acc.perdidosClientes += 1;
        }
        return acc;
      },
      {
        total: 0,
        vencida: 0,
        clientes: 0,
        riesgo: 0,
        riesgoMarcado: 0,
        riesgoMarcadoClientes: 0,
        perdidos: 0,
        perdidosClientes: 0,
      }
    );

    const solicitudesBorrar = clientesLista.filter(
      (cliente) => cliente.solicitudBorrado || cliente.solicitudBorrar
    ).length;

    const clientesOrdenPendiente = clientesLista.filter(
      (cliente) => cliente.pendienteRevisionOrden
    ).length;

    const clientesPerdidos = clientesLista.filter(
      (cliente) => cliente.estadoCliente === "perdido" || cliente.perdido
    ).length;

    const clientesRiesgoPerdida = clientesLista.filter(
      (cliente) => cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida
    ).length;

    const carteraPorRutaMap = new Map();
    clientesLista.forEach((cliente) => {
      const deuda = Number(cliente.deudaActual) || 0;
      if (deuda <= 0) return;

      const diaRuta = cliente.diaRuta || "sin-dia";
      const ruta = cliente.ruta || "Sin ruta";
      const key = `${diaRuta}__${ruta}`;
      const current =
        carteraPorRutaMap.get(key) ||
        {
          key,
          diaRuta,
          ruta,
          clientes: 0,
          deuda: 0,
          rojoNegro: 0,
          deudaRojoNegro: 0,
          riesgo: 0,
          deudaRiesgo: 0,
          perdidos: 0,
          deudaPerdida: 0,
          mayorDias: 0,
        };
      const dias = Number(cliente.diasDeuda) || 0;
      const color = cliente.semaforoDeuda || getDebtColor(dias);
      const enRiesgo =
        cliente.estadoCliente === "riesgo_perdida" || cliente.riesgoPerdida;
      const perdido = cliente.estadoCliente === "perdido" || cliente.perdido;

      current.clientes += 1;
      current.deuda += deuda;
      current.mayorDias = Math.max(current.mayorDias, dias);

      if (color === "rojo" || color === "negro") {
        current.rojoNegro += 1;
        current.deudaRojoNegro += deuda;
      }

      if (enRiesgo) {
        current.riesgo += 1;
        current.deudaRiesgo += deuda;
      }

      if (perdido) {
        current.perdidos += 1;
        current.deudaPerdida += deuda;
      }

      carteraPorRutaMap.set(key, current);
    });

    const carteraCriticaPorRuta = [...carteraPorRutaMap.values()]
      .map((item) => ({
        ...item,
        prioridad:
          item.deudaPerdida * 4 +
          item.deudaRiesgo * 3 +
          item.deudaRojoNegro * 2 +
          item.deuda,
      }))
      .sort((a, b) => b.prioridad - a.prioridad)
      .slice(0, 6);

    const graficoMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(hoy);
      date.setDate(hoy.getDate() - i);
      graficoMap.set(dayKey(date), 0);
    }

    facturasEmpresa.forEach((factura) => {
      if (!factura.fecha) return;
      const key = dayKey(factura.fecha);
      if (graficoMap.has(key)) {
        graficoMap.set(key, graficoMap.get(key) + (Number(factura.total) || 0));
      }
    });

    facturasRuta.forEach((factura) => {
      if (!factura.fecha) return;
      const date = new Date(`${factura.fecha}T12:00:00`);
      const key = dayKey(date);
      if (graficoMap.has(key)) {
        graficoMap.set(
          key,
          graficoMap.get(key) + (Number(factura.totalProductos) || 0)
        );
      }
    });

    const bajoStock = productos
      .filter((producto) => (Number(producto.stock) || 0) <= 5)
      .slice(0, 8);

    const recepcionesConAlertas = recepciones.filter(
      (recepcion) =>
        recepcion.auditoriaEstado && recepcion.auditoriaEstado !== "cuadrado"
    );

    const diferenciaSurtido = recepciones.reduce(
      (acc, recepcion) => acc + (Number(recepcion.diferenciaDejadoFacturado) || 0),
      0
    );

    const descuadreDineroRecepcion = recepciones.reduce(
      (acc, recepcion) => acc + (Number(recepcion.descuadreDinero) || 0),
      0
    );
    const dineroFaltanteRecepcion = recepciones.reduce(
      (acc, recepcion) =>
        acc +
        (Number(recepcion.dineroFaltante) ||
          Math.max((Number(recepcion.descuadreDinero) || 0) * -1, 0)),
      0
    );
    const dineroSobranteRecepcion = recepciones.reduce(
      (acc, recepcion) =>
        acc +
        (Number(recepcion.dineroSobrante) ||
          Math.max(Number(recepcion.descuadreDinero) || 0, 0)),
      0
    );

    const liquidacionesConAlertas = liquidaciones.filter(
      (liquidacion) =>
        liquidacion.auditoriaEstado &&
        liquidacion.auditoriaEstado !== "cuadrado"
    );

    const despachosPendientes = despachos.filter(
      (despacho) => despacho.estado !== "recibido"
    ).length;

    const comprasConAlerta = compras.filter(
      (compra) => compra.alertaFactura || compra.estadoRevisionFactura === "diferencia_fuerte"
    ).length;

    const comprasHoy = compras.filter((compra) => compra.fecha === fechaHoy);
    const valorComprasHoy = comprasHoy.reduce(
      (acc, compra) => acc + (Number(compra.totalCompra) || 0),
      0
    );

    const cuentasPagarResumen = cuentasPagar.reduce(
      (acc, cuenta) => {
        const saldo = Number(cuenta.saldoPendiente) || 0;
        acc.saldo += saldo;
        acc.total += Number(cuenta.total) || 0;
        acc.abonado += Number(cuenta.abonado) || 0;
        if (saldo > 0) acc.pendientes += 1;
        if (saldo > 0 && cuenta.fechaVencimiento && cuenta.fechaVencimiento < fechaHoy) {
          acc.vencidas += 1;
        }
        if (Number(cuenta.diferenciaFactura) !== 0) {
          acc.facturasConDiferencia += 1;
        }
        (cuenta.pagos || []).forEach((pago) => {
          const metodo = pago.metodo || "efectivo";
          acc.pagosPorMetodo[metodo] =
            (acc.pagosPorMetodo[metodo] || 0) + (Number(pago.valor) || 0);
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

    const pagosProveedorPorMetodo = Object.entries(
      cuentasPagarResumen.pagosPorMetodo
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([metodo, valor]) => ({ metodo, valor }));

    const cuentasPagarCriticas = cuentasPagar
      .filter(
        (cuenta) =>
          (Number(cuenta.saldoPendiente) || 0) > 0 &&
          (cuenta.fechaVencimiento < fechaHoy ||
            Number(cuenta.diferenciaFactura) !== 0)
      )
      .sort((a, b) => {
        const vencidaA = a.fechaVencimiento && a.fechaVencimiento < fechaHoy ? 0 : 1;
        const vencidaB = b.fechaVencimiento && b.fechaVencimiento < fechaHoy ? 0 : 1;
        if (vencidaA !== vencidaB) return vencidaA - vencidaB;
        return (Number(b.saldoPendiente) || 0) - (Number(a.saldoPendiente) || 0);
      })
      .slice(0, 6)
      .map((cuenta) => ({
        id: cuenta.id,
        proveedor: cuenta.proveedor || "Sin proveedor",
        facturaProveedor: cuenta.facturaProveedor || "Sin factura",
        fechaVencimiento: cuenta.fechaVencimiento || "",
        saldoPendiente: Number(cuenta.saldoPendiente) || 0,
        diferenciaFactura: Number(cuenta.diferenciaFactura) || 0,
        vencida: Boolean(cuenta.fechaVencimiento && cuenta.fechaVencimiento < fechaHoy),
      }));

    const utilidadHoy = liquidaciones
      .filter((liquidacion) => liquidacion.fecha === fechaHoy)
      .reduce(
        (acc, liquidacion) => {
          acc.utilidad += Number(liquidacion.utilidadBruta) || 0;
          acc.admin += Number(liquidacion.netoAdministrador) || 0;
          acc.rutas += 1;
          return acc;
        },
        { utilidad: 0, admin: 0, rutas: 0 }
      );

    const cajaConfirmadaHoy = ingresosTiendaConfirmadosHoy + rutaHoy.cobrado;
    const totalPendienteHoy = pendienteTiendaHoy + rutaHoy.fiado;
    const saludOperativa = [
      bajoStock.length > 0 && {
        tipo: "Inventario",
        detalle: `${bajoStock.length} productos con bajo stock.`,
        href: "/admin/inventario",
        prioridad: "media",
      },
      despachosPendientes > 0 && {
        tipo: "Bodega",
        detalle: `${despachosPendientes} despachos pendientes de recibir.`,
        href: "/admin/recepciones",
        prioridad: "alta",
      },
      recepcionesConAlertas.length > 0 && {
        tipo: "Recepcion",
        detalle: `${recepcionesConAlertas.length} recepciones con alerta.`,
        href: "/admin/recepciones",
        prioridad: "alta",
      },
      liquidacionesConAlertas.length > 0 && {
        tipo: "Liquidacion",
        detalle: `${liquidacionesConAlertas.length} liquidaciones con alerta.`,
        href: "/admin/liquidaciones",
        prioridad: "alta",
      },
      cartera.riesgoMarcadoClientes > 0 && {
        tipo: "Cartera",
        detalle: `${cartera.riesgoMarcadoClientes} clientes en riesgo de perder plata.`,
        href: "/admin/cartera",
        prioridad: "media",
      },
      cartera.perdidosClientes > 0 && {
        tipo: "Perdidos",
        detalle: `${cartera.perdidosClientes} clientes perdidos con deuda.`,
        href: "/admin/cartera",
        prioridad: "alta",
      },
      cuentasPagarResumen.vencidas > 0 && {
        tipo: "Proveedores",
        detalle: `${cuentasPagarResumen.vencidas} cuentas por pagar vencidas.`,
        href: "/admin/cuentas-pagar",
        prioridad: "alta",
      },
      cuentasPagarResumen.facturasConDiferencia > 0 && {
        tipo: "Facturas proveedor",
        detalle: `${cuentasPagarResumen.facturasConDiferencia} cuentas con diferencia antes de pagar.`,
        href: "/admin/cuentas-pagar",
        prioridad: "alta",
      },
      comprasConAlerta > 0 && {
        tipo: "Compras",
        detalle: `${comprasConAlerta} compras con diferencia en factura.`,
        href: "/admin/compras",
        prioridad: "media",
      },
      gestionesResumenHoy.riesgo_perdida > 0 && {
        tipo: "Ruta",
        detalle: `${gestionesResumenHoy.riesgo_perdida} clientes marcados en riesgo hoy.`,
        href: "/admin/gestiones",
        prioridad: "alta",
      },
      gestionesResumenHoy.no_encontrado > 0 && {
        tipo: "Ruta",
        detalle: `${gestionesResumenHoy.no_encontrado} clientes no disponibles hoy.`,
        href: "/admin/gestiones",
        prioridad: "media",
      },
    ].filter(Boolean);

    return NextResponse.json({
      ventasHoy: ventasHoyLista.length + rutaHoy.ventas,
      ingresosHoy,
      cajaConfirmadaHoy,
      pendienteTiendaHoy,
      totalPendienteHoy,
      ventasTiendaHoy: ventasHoyLista.length,
      ventasRutaHoy: rutaHoy.ventas,
      valorRutaHoy: rutaHoy.valor,
      cobrosRutaHoy: rutaHoy.cobrado,
      fiadoRutaHoy: rutaHoy.fiado,
      clientes: clientesLista.length || clientesFacturados,
      pagosPendientes,
      carteraTotal: cartera.total,
      carteraVencida: cartera.vencida,
      clientesConDeuda: cartera.clientes,
      clientesRiesgo: cartera.riesgo,
      carteraRiesgoMarcado: cartera.riesgoMarcado,
      clientesRiesgoMarcado: cartera.riesgoMarcadoClientes,
      carteraPerdida: cartera.perdidos,
      clientesPerdidosConDeuda: cartera.perdidosClientes,
      cuentasPorPagar: cuentasPagarResumen.saldo,
      cuentasPagarTotal: cuentasPagarResumen.total,
      cuentasPagarAbonado: cuentasPagarResumen.abonado,
      cuentasPagarPendientes: cuentasPagarResumen.pendientes,
      cuentasPagarVencidas: cuentasPagarResumen.vencidas,
      cuentasPagarFacturasConDiferencia: cuentasPagarResumen.facturasConDiferencia,
      pagosProveedorPorMetodo,
      cuentasPagarCriticas,
      comprasConAlerta,
      comprasHoy: comprasHoy.length,
      valorComprasHoy,
      utilidadBrutaHoy: utilidadHoy.utilidad,
      netoAdministradorHoy: utilidadHoy.admin,
      rutasLiquidadasHoy: utilidadHoy.rutas,
      gestionesHoy: gestionesResumenHoy.total,
      clientesVisitadosHoy: gestionesResumenHoy.visitado,
      clientesNoDisponiblesHoy: gestionesResumenHoy.no_encontrado,
      clientesRiesgoGestionHoy: gestionesResumenHoy.riesgo_perdida,
      deudaGestionadaHoy: gestionesResumenHoy.deuda,
      carteristasConGestionHoy: gestionesResumenHoy.carteristas.size,
      saludOperativa,
      solicitudesBorrar,
      clientesOrdenPendiente,
      clientesPerdidos,
      clientesRiesgoPerdida,
      carteraCriticaPorRuta,
      recepcionesConAlertas: recepcionesConAlertas.length,
      liquidacionesConAlertas: liquidacionesConAlertas.length,
      diferenciaSurtido,
      descuadreDineroRecepcion,
      dineroFaltanteRecepcion,
      dineroSobranteRecepcion,
      despachosPendientes,
      totalProductos: productos.length,
      totalStock: totalInventario,
      valorInventario,
      ticketPromedio:
        facturasEmpresa.length > 0
          ? facturasEmpresa.reduce(
              (acc, factura) => acc + (Number(factura.total) || 0),
              0
            ) / facturasEmpresa.length
          : 0,
      grafico: Array.from(graficoMap.entries()).map(([dia, ventas]) => ({
        dia,
        ventas,
      })),
      ultimasVentas: serializeValue(facturasEmpresa.slice(0, 8)),
      productos: serializeValue(productos.slice(0, 12)),
      bajoStock: serializeValue(bajoStock),
    });
  } catch (error) {
    console.error("Error dashboard:", error);

    return authErrorResponse(error);
  }
}

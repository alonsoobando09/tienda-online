import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { logAuditEvent } from "@/lib/audit";
import { belongsToEmpresaId } from "@/lib/firestoreTenant";
import {
  authErrorResponse,
  getRequestEmpresaId,
  requirePermission,
} from "@/lib/serverAuth";

const today = new Date().toISOString().slice(0, 10);

function number(value) {
  return Number(value) || 0;
}

function text(value) {
  return String(value || "").trim();
}

function getItemKey(item) {
  return text(item.productoId || item.id);
}

function byProductTotals(facturas = []) {
  const totals = new Map();

  facturas.forEach((factura) => {
    (factura.items || []).forEach((item) => {
      const productoId = getItemKey(item);
      if (!productoId) return;

      const current = totals.get(productoId) || { cantidad: 0, valor: 0 };
      const cantidad = number(item.cantidad);
      const valor = number(item.subtotal) || cantidad * number(item.precio);

      totals.set(productoId, {
        cantidad: current.cantidad + cantidad,
        valor: current.valor + valor,
      });
    });
  });

  return totals;
}

function summarizeFacturas(facturas = []) {
  return facturas.reduce(
    (acc, factura) => {
      acc.facturas += 1;
      acc.valor += number(factura.totalProductos);
      acc.abonos += number(factura.abonoDeudaAnterior);
      acc.pagosHoy += number(factura.pagoProductosHoy);
      acc.fiado += number(factura.fiadoHoy);
      return acc;
    },
    { facturas: 0, valor: 0, abonos: 0, pagosHoy: 0, fiado: 0 }
  );
}

function summarizeGastos(gastos = []) {
  return gastos.reduce(
    (acc, gasto) => {
      const valor = number(gasto.valor);
      const persona = gasto.persona === "ayudante" ? "ayudante" : "carterista";

      acc.total += valor;
      acc[persona].total += valor;

      if (gasto.tipo === "prestamo") {
        acc.prestamos += valor;
        acc[persona].prestamos += valor;
      } else if (gasto.tipo === "consumo") {
        acc.consumos += valor;
        acc[persona].consumos += valor;
      } else {
        acc.gastosCaja += valor;
        acc[persona].gastosCaja += valor;
      }

      return acc;
    },
    {
      total: 0,
      gastosCaja: 0,
      prestamos: 0,
      consumos: 0,
      carterista: { total: 0, gastosCaja: 0, prestamos: 0, consumos: 0 },
      ayudante: { total: 0, gastosCaja: 0, prestamos: 0, consumos: 0 },
    }
  );
}

function summarizeGestiones(gestiones = []) {
  return gestiones.reduce(
    (acc, gestion) => {
      const estado = gestion.estadoVisita || "pendiente";
      acc.total += 1;
      acc[estado] = (acc[estado] || 0) + 1;
      acc.deuda += number(gestion.deudaActual);
      if (gestion.carteristaNombre) acc.carteristas.add(gestion.carteristaNombre);
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
}

async function loadRouteDocs(db, collectionName, empresaId, despacho) {
  const snapshot = await db
    .collection(collectionName)
    .where("empresaId", "==", empresaId)
    .where("fecha", "==", despacho.fecha || "")
    .where("ruta", "==", despacho.ruta || "")
    .where("diaRuta", "==", despacho.diaRuta || "")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "recepciones.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const despachoId = text(body.despachoId);

    if (!despachoId) {
      return NextResponse.json({ error: "Despacho requerido" }, { status: 400 });
    }

    const db = getAdminDb();
    const despachoRef = db.collection("despachos").doc(despachoId);
    const despachoSnap = await despachoRef.get();

    if (!despachoSnap.exists) {
      return NextResponse.json({ error: "Despacho no existe" }, { status: 404 });
    }

    const despacho = despachoSnap.data() || {};
    if (!belongsToEmpresaId(despacho, empresaId)) {
      return NextResponse.json({ error: "Despacho de otra empresa" }, { status: 403 });
    }

    if (despacho.estado === "recibido") {
      return NextResponse.json({ error: "Este despacho ya fue recibido" }, { status: 409 });
    }

    const devueltos = new Map(
      (body.items || []).map((item) => [getItemKey(item), number(item.devuelto)])
    );
    const invalidos = [];

    const facturas = await loadRouteDocs(db, "facturasRuta", empresaId, despacho);
    const gastos = await loadRouteDocs(db, "gastosRuta", empresaId, despacho);
    const gestiones = await loadRouteDocs(db, "gestionesRuta", empresaId, despacho);
    const facturadoPorProducto = byProductTotals(facturas);
    const resumenFacturado = summarizeFacturas(facturas);
    const resumenGastosRegistrados = summarizeGastos(gastos);
    const resumenGestiones = summarizeGestiones(gestiones);

    const cleanItems = (despacho.items || []).map((item) => {
      const productoId = getItemKey(item);
      const cantidad = number(item.cantidad);
      const devuelto = devueltos.has(productoId) ? number(devueltos.get(productoId)) : 0;

      if (devuelto < 0 || devuelto > cantidad) {
        invalidos.push({
          productoId,
          nombre: item.nombre || "",
          salio: cantidad,
          devuelto,
        });
      }

      const dejado = cantidad - devuelto;
      const facturado = facturadoPorProducto.get(productoId) || { cantidad: 0, valor: 0 };
      const diferenciaFacturado = dejado - facturado.cantidad;
      const faltante = Math.max(diferenciaFacturado, 0);

      return {
        ...item,
        productoId,
        cantidad,
        devuelto,
        dejado,
        dejadoFacturado: facturado.cantidad,
        valorFacturado: facturado.valor,
        diferenciaFacturado,
        faltante,
        valorDejado: dejado * number(item.precioDetal),
        costoFaltante: faltante * number(item.costo),
      };
    });

    if (invalidos.length > 0) {
      return NextResponse.json(
        {
          error: "No puedes recibir mas unidades de las despachadas.",
          detalles: invalidos.map(
            (item) =>
              `${item.nombre || item.productoId}: salio ${item.salio}, devuelto ${item.devuelto}`
          ),
          invalidos,
        },
        { status: 400 }
      );
    }

    const resumen = cleanItems.reduce(
      (acc, item) => {
        acc.despachado += item.cantidad;
        acc.devuelto += item.devuelto;
        acc.dejadoFisico += item.dejado;
        acc.dejadoFacturado += item.dejadoFacturado;
        acc.diferencia += item.diferenciaFacturado;
        acc.faltante += item.faltante;
        acc.valorFisicoEstimado += item.valorDejado;
        acc.valorFacturado += item.valorFacturado;
        acc.costoFaltante += item.costoFaltante;
        return acc;
      },
      {
        despachado: 0,
        devuelto: 0,
        dejadoFisico: 0,
        dejadoFacturado: 0,
        diferencia: 0,
        faltante: 0,
        valorFisicoEstimado: 0,
        valorFacturado: 0,
        costoFaltante: 0,
      }
    );

    const cash = body.cash || {};
    const totalPagosRecibidos =
      number(cash.efectivo) +
      number(cash.nequi) +
      number(cash.daviplata) +
      number(cash.bancolombia) +
      number(cash.otrosPagos);
    const dineroEsperado = resumenFacturado.abonos + resumenFacturado.pagosHoy;
    const descuadreDinero =
      totalPagosRecibidos + number(cash.gastosRuta) + number(cash.prestamos) - dineroEsperado;
    const dineroFaltante = Math.max(descuadreDinero * -1, 0);
    const dineroSobrante = Math.max(descuadreDinero, 0);

    const diferenciasProducto = cleanItems
      .map((item) => ({
        productoId: item.productoId,
        nombre: item.nombre || "",
        sku: item.sku || "",
        salio: item.cantidad,
        devuelto: item.devuelto,
        dejadoFisico: item.dejado,
        facturado: item.dejadoFacturado,
        diferencia: item.diferenciaFacturado,
        tipo:
          item.diferenciaFacturado > 0
            ? "Surtido sin facturar"
            : item.diferenciaFacturado < 0
              ? "Facturado mayor al conteo"
              : "Cuadrado",
      }))
      .filter((item) => item.diferencia !== 0);
    const alertas = [];

    if (diferenciasProducto.length > 0) {
      alertas.push("Hay descuadres de surtido entre conteo fisico y facturas.");
    }
    if (descuadreDinero !== 0) {
      alertas.push("Hay descuadre de dinero frente al cobro esperado.");
    }
    if (facturas.length === 0) {
      alertas.push("No hay facturas de ruta asociadas a este despacho.");
    }
    if (gestiones.length === 0) {
      alertas.push("No hay gestiones de clientes asociadas a este despacho.");
    }
    if (resumenGestiones.riesgo_perdida > 0) {
      alertas.push("Hay clientes marcados en riesgo de perdida durante la ruta.");
    }

    if (alertas.length > 0 && body.confirmarAlertas !== true) {
      return NextResponse.json(
        {
          error: "La recepcion tiene alertas. Confirma para guardar con descuadres.",
          alertas,
        },
        { status: 409 }
      );
    }

    const recepcionRef = db.collection("recepciones").doc();
    const batch = db.batch();
    const recepcionPayload = {
      empresaId,
      despachoId,
      fechaRecepcion: today,
      fechaDespacho: despacho.fecha || "",
      diaRuta: despacho.diaRuta || "",
      ruta: despacho.ruta || "",
      carteristaId: despacho.carteristaId || "",
      carteristaNombre: despacho.carteristaNombre || "",
      ayudanteId: despacho.ayudanteId || "",
      ayudanteNombre: despacho.ayudanteNombre || "",
      items: cleanItems,
      totalDespachado: resumen.despachado,
      totalDevuelto: resumen.devuelto,
      totalDejado: resumen.dejadoFisico,
      totalDejadoFacturado: resumen.dejadoFacturado,
      diferenciaDejadoFacturado: resumen.diferencia,
      totalFaltante: resumen.faltante,
      valorProductosDejados: resumenFacturado.valor,
      valorProductosDejadosFisico: resumen.valorFisicoEstimado,
      costoFaltante: resumen.costoFaltante,
      dineroEntregado: totalPagosRecibidos,
      pagosRuta: {
        efectivo: number(cash.efectivo),
        nequi: number(cash.nequi),
        daviplata: number(cash.daviplata),
        bancolombia: number(cash.bancolombia),
        otros: number(cash.otrosPagos),
        referencia: text(cash.referenciaPagos),
        total: totalPagosRecibidos,
      },
      dineroEsperado,
      gastosRuta: number(cash.gastosRuta),
      prestamos: number(cash.prestamos),
      gastosRutaRegistrados: gastos.map((gasto) => gasto.id),
      resumenGastosRuta: resumenGastosRegistrados,
      gestionesRutaIds: gestiones.map((gestion) => gestion.id),
      totalGestionesRuta: resumenGestiones.total,
      clientesVisitadosRuta: resumenGestiones.visitado,
      clientesNoDisponiblesRuta: resumenGestiones.no_encontrado,
      clientesRiesgoRuta: resumenGestiones.riesgo_perdida,
      deudaGestionadaRuta: resumenGestiones.deuda,
      carteristasConGestionRuta: resumenGestiones.carteristas.size,
      resumenGestionesRuta: {
        total: resumenGestiones.total,
        pendiente: resumenGestiones.pendiente,
        visitado: resumenGestiones.visitado,
        no_encontrado: resumenGestiones.no_encontrado,
        riesgo_perdida: resumenGestiones.riesgo_perdida,
        deuda: resumenGestiones.deuda,
        carteristas: resumenGestiones.carteristas.size,
      },
      descuadreDinero,
      dineroFaltante,
      dineroSobrante,
      facturasRutaIds: facturas.map((factura) => factura.id),
      totalFacturasRuta: resumenFacturado.facturas,
      valorFacturadoRuta: resumenFacturado.valor,
      abonosDeudaAnterior: resumenFacturado.abonos,
      pagosProductosHoy: resumenFacturado.pagosHoy,
      fiadoRuta: resumenFacturado.fiado,
      auditoriaEstado: alertas.length === 0 ? "cuadrado" : "con_alertas",
      auditoriaAlertas: alertas,
      diferenciasProducto,
      observaciones: text(cash.observaciones),
      estado: "recibido",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    };

    batch.set(recepcionRef, recepcionPayload);

    for (const item of cleanItems) {
      if (item.devuelto > 0) {
        const productoRef = db.collection("productos").doc(item.productoId);
        const productoSnap = await productoRef.get();

        if (!productoSnap.exists || !belongsToEmpresaId(productoSnap.data(), empresaId)) {
          return NextResponse.json(
            { error: `Producto invalido para esta empresa: ${item.nombre || item.productoId}` },
            { status: 403 }
          );
        }

        batch.update(productoRef, {
          stock: FieldValue.increment(item.devuelto),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.uid,
          updatedByEmail: actor.email,
        });

        batch.set(db.collection("kardex").doc(), {
          empresaId,
          productoId: item.productoId,
          productoNombre: item.nombre || "",
          tipo: "entrada_devolucion_ruta",
          cantidad: item.devuelto,
          costo: number(item.costo),
          referenciaId: recepcionRef.id,
          despachoId,
          ruta: despacho.ruta || "",
          diaRuta: despacho.diaRuta || "",
          fecha: today,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: actor.uid,
          createdByEmail: actor.email,
        });
      }

      if (item.faltante > 0) {
        batch.set(db.collection("kardex").doc(), {
          empresaId,
          productoId: item.productoId,
          productoNombre: item.nombre || "",
          tipo: "alerta_faltante_ruta",
          cantidad: item.faltante,
          costo: number(item.costo),
          subtotal: item.costoFaltante,
          afectaStock: false,
          referenciaId: recepcionRef.id,
          despachoId,
          ruta: despacho.ruta || "",
          diaRuta: despacho.diaRuta || "",
          fecha: today,
          observacion: "Faltante detectado en recepcion. No descuenta stock de nuevo.",
          createdAt: FieldValue.serverTimestamp(),
          createdBy: actor.uid,
          createdByEmail: actor.email,
        });
      }
    }

    batch.update(despachoRef, {
      estado: "recibido",
      recepcionId: recepcionRef.id,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    await batch.commit();

    await logAuditEvent({
      empresaId,
      actor,
      action: "recepcion.create",
      resource: "recepciones",
      resourceId: recepcionRef.id,
      before: despacho,
      after: {
        despachoId,
        totalDevuelto: resumen.devuelto,
        totalFaltante: resumen.faltante,
        descuadreDinero,
        alertas,
      },
    });

    return NextResponse.json({ id: recepcionRef.id, alertas });
  } catch (error) {
    return authErrorResponse(error);
  }
}

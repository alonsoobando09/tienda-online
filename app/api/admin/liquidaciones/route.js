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

function number(value) {
  return Number(value) || 0;
}

function text(value) {
  return String(value || "").trim();
}

async function loadRouteDocs(db, collectionName, empresaId, recepcion) {
  const snapshot = await db
    .collection(collectionName)
    .where("empresaId", "==", empresaId)
    .where("fecha", "==", recepcion.fechaRecepcion || "")
    .where("ruta", "==", recepcion.ruta || "")
    .where("diaRuta", "==", recepcion.diaRuta || "")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function summarizeGastos(gastos = []) {
  return gastos.reduce(
    (acc, gasto) => {
      const valor = number(gasto.valor);
      const persona = gasto.persona === "ayudante" ? "ayudante" : "carterista";

      acc.total += valor;

      if (gasto.tipo === "almuerzo") acc[persona].almuerzo += valor;
      else if (gasto.tipo === "prestamo") acc[persona].prestamo += valor;
      else if (gasto.tipo === "consumo") acc[persona].consumo += valor;
      else acc.otrosRuta += valor;

      return acc;
    },
    {
      total: 0,
      otrosRuta: 0,
      carterista: { almuerzo: 0, prestamo: 0, consumo: 0 },
      ayudante: { almuerzo: 0, prestamo: 0, consumo: 0 },
    }
  );
}

function buildCalculation(recepcion, form) {
  const costoProductosDejados = (recepcion.items || []).reduce(
    (acc, item) =>
      acc + number(item.dejadoFacturado ?? item.dejado) * number(item.costo),
    0
  );
  const valorProductosDejados = number(recepcion.valorProductosDejados);
  const utilidadBruta = valorProductosDejados - costoProductosDejados;
  const pagoBaseAyudante = number(form.pagoDiarioAyudante);
  const bonoClientes = number(form.clientesAbiertos) * number(form.valorClienteAbierto);
  const totalAyudanteBruto = pagoBaseAyudante + bonoClientes;
  const gananciaDespuesAyudante = utilidadBruta - totalAyudanteBruto;
  const mitadAdministrador = gananciaDespuesAyudante / 2;
  const mitadCarterista = gananciaDespuesAyudante / 2;
  const dineroFaltante =
    number(recepcion.dineroFaltante) ||
    Math.max(number(recepcion.descuadreDinero) * -1, 0);
  const dineroSobrante =
    number(recepcion.dineroSobrante) || Math.max(number(recepcion.descuadreDinero), 0);
  const descuentosCarterista =
    number(form.carteristaAlmuerzo) +
    number(form.carteristaPrestamos) +
    number(form.carteristaConsumos) +
    dineroFaltante +
    number(recepcion.costoFaltante);
  const descuentosAyudante =
    number(form.ayudanteAlmuerzo) +
    number(form.ayudantePrestamos) +
    number(form.ayudanteConsumos);

  return {
    valorProductosDejados,
    costoProductosDejados,
    utilidadBruta,
    pagoBaseAyudante,
    bonoClientes,
    totalAyudanteBruto,
    gananciaDespuesAyudante,
    mitadAdministrador,
    mitadCarterista,
    descuentosCarterista,
    descuentosAyudante,
    dineroFaltante,
    dineroSobrante,
    netoCarterista: mitadCarterista - descuentosCarterista,
    netoAyudante: totalAyudanteBruto - descuentosAyudante,
    netoAdministrador: mitadAdministrador,
  };
}

export async function POST(request) {
  try {
    const actor = await requirePermission(request, "liquidaciones.manage");
    const empresaId = getRequestEmpresaId(request, actor);
    const body = await request.json();
    const form = body.form || {};
    const recepcionId = text(body.recepcionId || form.recepcionId);

    if (!recepcionId) {
      return NextResponse.json({ error: "Recepcion requerida" }, { status: 400 });
    }

    const db = getAdminDb();
    const recepcionRef = db.collection("recepciones").doc(recepcionId);
    const recepcionSnap = await recepcionRef.get();

    if (!recepcionSnap.exists) {
      return NextResponse.json({ error: "Recepcion no existe" }, { status: 404 });
    }

    const recepcion = { id: recepcionSnap.id, ...recepcionSnap.data() };
    if (!belongsToEmpresaId(recepcion, empresaId)) {
      return NextResponse.json({ error: "Recepcion de otra empresa" }, { status: 403 });
    }

    if (recepcion.estado === "liquidado") {
      return NextResponse.json({ error: "Esta recepcion ya fue liquidada" }, { status: 409 });
    }

    const gastosRuta = await loadRouteDocs(db, "gastosRuta", empresaId, recepcion);
    const resumenGastos = summarizeGastos(gastosRuta);
    const productosFaltantes = (recepcion.items || []).filter(
      (item) => number(item.faltante) > 0
    );
    const diferenciasProducto = recepcion.diferenciasProducto || [];
    const calculo = buildCalculation(recepcion, form);
    const liquidacionRef = db.collection("liquidaciones").doc();
    const batch = db.batch();

    const payload = {
      empresaId,
      recepcionId: recepcion.id,
      despachoId: recepcion.despachoId || "",
      fecha: recepcion.fechaRecepcion || "",
      ruta: recepcion.ruta || "",
      diaRuta: recepcion.diaRuta || "",
      carteristaId: recepcion.carteristaId || "",
      carteristaNombre: recepcion.carteristaNombre || "",
      ayudanteId: recepcion.ayudanteId || "",
      ayudanteNombre: recepcion.ayudanteNombre || "",
      totalFacturasRuta: number(recepcion.totalFacturasRuta),
      totalGestionesRuta: number(recepcion.totalGestionesRuta),
      clientesVisitadosRuta: number(recepcion.clientesVisitadosRuta),
      clientesNoDisponiblesRuta: number(recepcion.clientesNoDisponiblesRuta),
      clientesRiesgoRuta: number(recepcion.clientesRiesgoRuta),
      deudaGestionadaRuta: number(recepcion.deudaGestionadaRuta),
      resumenGestionesRuta: recepcion.resumenGestionesRuta || {},
      gestionesRutaIds: recepcion.gestionesRutaIds || [],
      auditoriaEstado: recepcion.auditoriaEstado || "",
      auditoriaAlertas: recepcion.auditoriaAlertas || [],
      diferenciasProducto,
      diferenciaDejadoFacturado: number(recepcion.diferenciaDejadoFacturado),
      totalDejadoFacturado: number(recepcion.totalDejadoFacturado),
      valorProductosDejados: calculo.valorProductosDejados,
      costoProductosDejados: calculo.costoProductosDejados,
      utilidadBruta: calculo.utilidadBruta,
      dineroEntregado: number(recepcion.dineroEntregado),
      pagosRuta: recepcion.pagosRuta || {
        efectivo: number(recepcion.dineroEntregado),
        total: number(recepcion.dineroEntregado),
      },
      gastosRuta: number(recepcion.gastosRuta),
      prestamosRuta: number(recepcion.prestamos),
      descuadreDinero: number(recepcion.descuadreDinero),
      dineroFaltante: calculo.dineroFaltante,
      dineroSobrante: calculo.dineroSobrante,
      costoFaltante: number(recepcion.costoFaltante),
      productosFaltantes: productosFaltantes.map((item) => ({
        productoId: item.productoId,
        nombre: item.nombre,
        sku: item.sku || "",
        cantidad: number(item.cantidad),
        devuelto: number(item.devuelto),
        dejado: number(item.dejado),
        faltante: number(item.faltante),
        costo: number(item.costo),
        costoFaltante: number(item.costoFaltante),
      })),
      pagoBaseAyudante: calculo.pagoBaseAyudante,
      clientesAbiertos: number(form.clientesAbiertos),
      valorClienteAbierto: number(form.valorClienteAbierto),
      bonoClientes: calculo.bonoClientes,
      totalAyudanteBruto: calculo.totalAyudanteBruto,
      gananciaDespuesAyudante: calculo.gananciaDespuesAyudante,
      mitadAdministrador: calculo.mitadAdministrador,
      mitadCarterista: calculo.mitadCarterista,
      descuentosCarterista: calculo.descuentosCarterista,
      descuentosAyudante: calculo.descuentosAyudante,
      netoCarterista: calculo.netoCarterista,
      netoAyudante: calculo.netoAyudante,
      netoAdministrador: calculo.netoAdministrador,
      detalleDescuentos: {
        carteristaAlmuerzo: number(form.carteristaAlmuerzo),
        carteristaPrestamos: number(form.carteristaPrestamos),
        carteristaConsumos: number(form.carteristaConsumos),
        ayudanteAlmuerzo: number(form.ayudanteAlmuerzo),
        ayudantePrestamos: number(form.ayudantePrestamos),
        ayudanteConsumos: number(form.ayudanteConsumos),
      },
      gastosRutaRegistrados: gastosRuta.map((gasto) => gasto.id),
      resumenGastosRuta: {
        total: resumenGastos.total,
        otrosRuta: resumenGastos.otrosRuta,
        carterista: resumenGastos.carterista,
        ayudante: resumenGastos.ayudante,
      },
      observaciones: text(form.observaciones),
      estado: "liquidado",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    };

    batch.set(liquidacionRef, payload);
    batch.update(recepcionRef, {
      estado: "liquidado",
      liquidacionId: liquidacionRef.id,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
    });

    await batch.commit();

    await logAuditEvent({
      empresaId,
      actor,
      action: "liquidacion.create",
      resource: "liquidaciones",
      resourceId: liquidacionRef.id,
      before: recepcion,
      after: {
        recepcionId: recepcion.id,
        ruta: payload.ruta,
        utilidadBruta: payload.utilidadBruta,
        netoCarterista: payload.netoCarterista,
        netoAyudante: payload.netoAyudante,
      },
    });

    return NextResponse.json({ id: liquidacionRef.id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

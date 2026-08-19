import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { logAuditEvent } from "@/lib/audit";
import { belongsToEmpresaId } from "@/lib/firestoreTenant";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getDebtColor, getTodayRouteDay } from "@/lib/operacion";
import { buildRouteClosureId } from "@/lib/routeClosure";
import {
  authErrorResponse,
  getRequestEmpresaId,
  requireServerProfile,
} from "@/lib/serverAuth";
import { ROLES } from "@/lib/permissions";

function text(value) {
  return String(value || "").trim();
}

function number(value) {
  return Number(value) || 0;
}

function forbidden(message) {
  const error = new Error(message);
  error.status = 403;
  throw error;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function canOperateRoute(actor) {
  return [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.CARTERISTA, ROLES.AYUDANTE].includes(
    actor.role
  );
}

async function getActiveAuthorization(db, empresaId, uid, fecha) {
  const snap = await db
    .collection("autorizacionesRuta")
    .where("empresaId", "==", empresaId)
    .where("uid", "==", uid)
    .where("fecha", "==", fecha)
    .where("estado", "==", "activa")
    .get();

  return snap.docs[0]?.data() || null;
}

async function assertRouteAccess(db, request, actor, body) {
  if (!canOperateRoute(actor)) {
    forbidden("No tienes permiso para operar ruta.");
  }

  const empresaId = getRequestEmpresaId(request, actor);
  const fecha = text(body.fecha) || new Date().toISOString().slice(0, 10);
  const diaRuta = text(body.diaRuta);
  const ruta = text(body.ruta);

  if (!fecha || !diaRuta || !ruta) {
    badRequest("Fecha, dia de ruta y ruta son requeridos.");
  }

  if (![ROLES.SUPERADMIN, ROLES.ADMIN].includes(actor.role)) {
    const autorizacion = await getActiveAuthorization(db, empresaId, actor.uid, fecha);
    const todayRouteDay = getTodayRouteDay(new Date(`${fecha}T12:00:00`));
    const allowedByProfile =
      actor.diaRuta === todayRouteDay &&
      actor.diaRuta === diaRuta &&
      actor.ruta === ruta;
    const allowedByAuthorization =
      autorizacion?.diaRuta === diaRuta && autorizacion?.ruta === ruta;

    if (!allowedByProfile && !allowedByAuthorization) {
      forbidden("No tienes autorizacion para trabajar esta ruta.");
    }
  }

  const cierreRutaId = buildRouteClosureId({ empresaId, fecha, diaRuta, ruta });
  const cierreSnap = await db.collection("cierresRuta").doc(cierreRutaId).get();

  if (cierreSnap.exists && cierreSnap.data()?.estado === "cerrado") {
    const error = new Error("Esta ruta ya fue liquidada y cerrada.");
    error.status = 409;
    throw error;
  }

  return { empresaId, fecha, diaRuta, ruta };
}

async function assertCliente(db, empresaId, clienteId) {
  const ref = db.collection("clientes").doc(clienteId);
  const snap = await ref.get();

  if (!snap.exists) {
    badRequest("Cliente no existe.");
  }

  const data = snap.data() || {};
  if (!belongsToEmpresaId(data, empresaId)) {
    forbidden("Cliente de otra empresa.");
  }

  return { ref, data: { id: snap.id, ...data } };
}

function getProductPrices(producto) {
  const sugerido = number(producto.precioDetal || producto.precio);
  const minimo = number(producto.precioMinimo || producto.precioMayor || sugerido);
  const maximo = number(producto.precioMaximo || producto.precioPacaDetal || sugerido);

  return {
    minimo: Math.min(minimo, sugerido || minimo),
    sugerido,
    maximo: Math.max(maximo, sugerido || maximo),
  };
}

async function createRouteExpense({ db, actor, route, body }) {
  const valor = number(body.valor);

  if (valor <= 0) {
    badRequest("El gasto debe ser mayor a cero.");
  }

  const payload = {
    empresaId: route.empresaId,
    uid: actor.uid,
    empleadoNombre: actor.nombre || "",
    empleadoRol: actor.role || "",
    fecha: route.fecha,
    diaRuta: route.diaRuta,
    ruta: route.ruta,
    persona: text(body.persona) === "ayudante" ? "ayudante" : "carterista",
    tipo: text(body.tipo) || "otro",
    valor,
    descripcion: text(body.descripcion),
    estado: "registrado",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
  };
  const ref = db.collection("gastosRuta").doc();

  await ref.set(payload);

  await logAuditEvent({
    empresaId: route.empresaId,
    actor,
    action: "ruta.gasto.create",
    resource: "gastosRuta",
    resourceId: ref.id,
    after: payload,
  });

  return { id: ref.id };
}

async function writeRouteLocation({ db, actor, route, body }) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const accuracy = number(body.accuracy);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    badRequest("Ubicacion invalida.");
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    badRequest("Coordenadas fuera de rango.");
  }

  const payload = {
    empresaId: route.empresaId,
    uid: actor.uid,
    empleadoNombre: actor.nombre || "",
    empleadoRol: actor.role || "",
    fecha: route.fecha,
    diaRuta: route.diaRuta,
    ruta: route.ruta,
    lat,
    lng,
    accuracy,
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
  };
  const ref = db.collection("ubicacionesRuta").doc();

  await ref.set(payload);

  return { id: ref.id };
}

async function createRouteClient({ db, actor, route, body }) {
  const nombre = text(body.nombre);

  if (!nombre) badRequest("Nombre del cliente requerido.");

  const clientesSnap = await db
    .collection("clientes")
    .where("empresaId", "==", route.empresaId)
    .where("diaRuta", "==", route.diaRuta)
    .where("ruta", "==", route.ruta)
    .get();
  const clientesRuta = clientesSnap.docs
    .map((docu) => ({ id: docu.id, ref: docu.ref, ...docu.data() }))
    .sort((a, b) => number(a.ordenVisita) - number(b.ordenVisita));
  const selected = clientesRuta.find((cliente) => cliente.id === text(body.insertarDespuesDe));
  const ordenManual = number(body.ordenVisita);
  let ordenVisita = clientesRuta.length + 1;

  if (ordenManual) {
    ordenVisita = Math.min(Math.max(ordenManual, 1), clientesRuta.length + 1);
  } else if (selected) {
    ordenVisita = number(selected.ordenVisita) + 1;
  }

  const deudaActual = number(body.deudaActual);
  const diasDeuda = deudaActual > 0 ? number(body.diasDeuda) || 1 : 0;
  const clienteRef = db.collection("clientes").doc();
  const batch = db.batch();

  clientesRuta
    .filter((cliente) => number(cliente.ordenVisita) >= ordenVisita)
    .forEach((cliente) => {
      batch.update(cliente.ref, {
        ordenVisita: number(cliente.ordenVisita) + 1,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        updatedByEmail: actor.email,
      });
    });

  const payload = {
    empresaId: route.empresaId,
    nombre,
    telefono: text(body.telefono),
    direccion: text(body.direccion),
    local: text(body.local),
    deudaActual,
    diasDeuda,
    diaRuta: route.diaRuta,
    ruta: route.ruta,
    ordenVisita,
    semaforoDeuda: getDebtColor(diasDeuda),
    creadoPorCarterista: true,
    pendienteRevisionOrden: Boolean(body.ordenVisita || body.insertarDespuesDe),
    carteristaId: actor.uid,
    carteristaNombre: actor.nombre || "",
    solicitudBorrado: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
  };

  batch.set(clienteRef, payload);
  await batch.commit();

  await logAuditEvent({
    empresaId: route.empresaId,
    actor,
    action: "ruta.cliente.create",
    resource: "clientes",
    resourceId: clienteRef.id,
    after: { ...payload, ordenVisita },
  });

  return { id: clienteRef.id, ordenVisita };
}

async function markRouteVisit({ db, actor, route, body }) {
  const estadoVisita = text(body.estadoVisita);

  if (!["visitado", "no_encontrado", "riesgo_perdida"].includes(estadoVisita)) {
    badRequest("Estado de visita invalido.");
  }

  const { ref: clienteRef, data: cliente } = await assertCliente(
    db,
    route.empresaId,
    text(body.clienteId)
  );
  const riesgoPerdida = estadoVisita === "riesgo_perdida";
  const clienteAtendido = estadoVisita === "visitado";
  const clienteEnRiesgoAntes =
    cliente.estadoCliente === "riesgo_perdida" ||
    cliente.estadoCliente === "perdido" ||
    Boolean(cliente.riesgoPerdida) ||
    Boolean(cliente.perdido);
  const nextEstadoCliente = riesgoPerdida
    ? "riesgo_perdida"
    : clienteAtendido
      ? "activo"
      : cliente.estadoCliente || "activo";
  const nextRiesgoPerdida = riesgoPerdida
    ? true
    : clienteAtendido
      ? false
      : Boolean(cliente.riesgoPerdida);
  const nextPerdido = clienteAtendido || riesgoPerdida ? false : Boolean(cliente.perdido);
  const batch = db.batch();

  batch.update(clienteRef, {
    estadoVisita,
    estadoVisitaFecha: route.fecha,
    estadoCliente: nextEstadoCliente,
    riesgoPerdida: nextRiesgoPerdida,
    perdido: nextPerdido,
    riesgoPerdidaFecha: riesgoPerdida
      ? FieldValue.serverTimestamp()
      : cliente.riesgoPerdidaFecha || null,
    recuperadoFecha:
      clienteAtendido && clienteEnRiesgoAntes
        ? FieldValue.serverTimestamp()
        : cliente.recuperadoFecha || null,
    ultimaGestionRuta: FieldValue.serverTimestamp(),
    ultimoCarteristaGestion: actor.nombre || "",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
  });

  const gestionRef = db.collection("gestionesRuta").doc();
  batch.set(gestionRef, {
    empresaId: route.empresaId,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre || "",
    telefono: cliente.telefono || "",
    fecha: route.fecha,
    diaRuta: route.diaRuta,
    ruta: route.ruta,
    estadoAnterior: cliente.estadoVisita || "pendiente",
    estadoVisita,
    estadoClienteAnterior: cliente.estadoCliente || "activo",
    estadoCliente: nextEstadoCliente,
    carteristaId: actor.uid,
    carteristaNombre: actor.nombre || "",
    deudaActual: number(cliente.deudaActual),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
  });

  if (riesgoPerdida || (clienteAtendido && clienteEnRiesgoAntes)) {
    batch.set(db.collection("movimientosCartera").doc(), {
      empresaId: route.empresaId,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      fecha: route.fecha,
      diaRuta: route.diaRuta,
      ruta: route.ruta,
      carteristaId: actor.uid,
      carteristaNombre: actor.nombre || "",
      deudaAnterior: number(cliente.deudaActual),
      nuevaDeuda: number(cliente.deudaActual),
      diasDeuda: number(cliente.diasDeuda),
      tipo: riesgoPerdida ? "riesgo_perdida_ruta" : "cliente_recuperado_ruta",
      nota: riesgoPerdida
        ? "Carterista marco riesgo de perder la plata"
        : "Carterista encontro y atendio cliente en riesgo",
      estadoCliente: nextEstadoCliente,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
    });
  }

  await batch.commit();

  return {
    cliente: {
      estadoVisita,
      estadoVisitaFecha: route.fecha,
      estadoCliente: nextEstadoCliente,
      riesgoPerdida: nextRiesgoPerdida,
      perdido: nextPerdido,
    },
  };
}

async function requestClientDelete({ db, actor, route, body }) {
  const { ref: clienteRef, data: cliente } = await assertCliente(
    db,
    route.empresaId,
    text(body.clienteId)
  );

  if (cliente.diaRuta !== route.diaRuta || cliente.ruta !== route.ruta) {
    forbidden("Cliente fuera de la ruta actual.");
  }

  await clienteRef.update({
    solicitudBorrado: true,
    solicitudBorradoFecha: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
  });

  return { id: cliente.id };
}

async function createRouteInvoice({ db, actor, route, body }) {
  const { ref: clienteRef, data: cliente } = await assertCliente(
    db,
    route.empresaId,
    text(body.clienteId)
  );
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const abonoAnterior = number(body.abonoDeudaAnterior);
  const pagoHoy = number(body.pagoProductosHoy);

  if (!rawItems.length && abonoAnterior <= 0) {
    badRequest("Agrega productos o registra un abono.");
  }

  const cleanItems = [];
  const errors = [];

  for (const item of rawItems) {
    const productoId = text(item.productoId);
    const cantidad = number(item.cantidad);
    const precio = number(item.precio);
    const productoSnap = await db.collection("productos").doc(productoId).get();

    if (!productoSnap.exists || !belongsToEmpresaId(productoSnap.data(), route.empresaId)) {
      errors.push(`${text(item.nombre) || productoId}: producto invalido.`);
      continue;
    }

    const producto = { id: productoSnap.id, ...productoSnap.data() };
    const prices = getProductPrices(producto);

    if (cantidad <= 0) errors.push(`${producto.nombre}: cantidad invalida.`);
    if (precio < prices.minimo || precio > prices.maximo) {
      errors.push(
        `${producto.nombre}: precio fuera del rango permitido ${prices.minimo} - ${prices.maximo}.`
      );
    }

    cleanItems.push({
      productoId,
      nombre: text(producto.nombre || item.nombre),
      sku: text(producto.sku || item.sku),
      cantidad,
      precio,
      precioTipo: text(item.precioTipo || "manual"),
      minimo: prices.minimo,
      sugerido: prices.sugerido,
      maximo: prices.maximo,
      subtotal: cantidad * precio,
    });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Factura invalida", detalles: errors },
      { status: 400 }
    );
  }

  const totalProductos = cleanItems.reduce((acc, item) => acc + item.subtotal, 0);
  const deudaAnterior = number(cliente.deudaActual);

  if (abonoAnterior < 0 || pagoHoy < 0) badRequest("Pagos negativos no permitidos.");
  if (abonoAnterior > deudaAnterior) {
    badRequest("El abono no puede superar la deuda anterior.");
  }
  if (pagoHoy > totalProductos) {
    badRequest("El pago de hoy no puede superar el total vendido hoy.");
  }

  const deudaViejaRestante = Math.max(deudaAnterior - abonoAnterior, 0);
  const fiadoHoy = Math.max(totalProductos - pagoHoy, 0);
  const deudaFinal = deudaViejaRestante + fiadoHoy;
  const diasDeuda = deudaFinal > 0 ? 1 : 0;
  const facturaRef = db.collection("facturasRuta").doc();
  const batch = db.batch();
  const facturaPayload = {
    empresaId: route.empresaId,
    tipo: "ruta",
    fecha: route.fecha,
    diaRuta: route.diaRuta,
    ruta: route.ruta,
    carteristaId: actor.uid,
    carteristaNombre: actor.nombre || "",
    clienteId: cliente.id,
    clienteNombre: cliente.nombre || "",
    telefono: cliente.telefono || "",
    direccion: cliente.direccion || "",
    items: cleanItems,
    deudaAnterior,
    abonoDeudaAnterior: abonoAnterior,
    totalProductos,
    pagoProductosHoy: pagoHoy,
    fiadoHoy,
    deudaFinal,
    observaciones: text(body.observaciones),
    estado: "guardada",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
  };

  batch.set(facturaRef, facturaPayload);

  if (abonoAnterior > 0 || fiadoHoy > 0 || facturaPayload.observaciones) {
    batch.set(db.collection("movimientosCartera").doc(), {
      empresaId: route.empresaId,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      fecha: route.fecha,
      diaRuta: route.diaRuta,
      ruta: route.ruta,
      facturaRutaId: facturaRef.id,
      carteristaId: actor.uid,
      carteristaNombre: actor.nombre || "",
      abono: abonoAnterior,
      ventaDia: totalProductos,
      pagoProductosHoy: pagoHoy,
      fiadoHoy,
      deudaAnterior,
      nuevaDeuda: deudaFinal,
      diasDeuda,
      nota: facturaPayload.observaciones,
      tipo: abonoAnterior > 0 ? "abono_ruta" : "visita_ruta",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      createdByEmail: actor.email,
    });
  }

  batch.update(clienteRef, {
    deudaActual: deudaFinal,
    diasDeuda,
    semaforoDeuda: getDebtColor(diasDeuda),
    estadoVisita: "visitado",
    estadoVisitaFecha: route.fecha,
    estadoCliente: "activo",
    riesgoPerdida: false,
    perdido: false,
    ultimaNotaCartera: facturaPayload.observaciones,
    ultimoAbono: abonoAnterior,
    ultimoMovimientoCartera: FieldValue.serverTimestamp(),
    ultimaVisita: FieldValue.serverTimestamp(),
    ultimaGestionRuta: FieldValue.serverTimestamp(),
    ultimoCarteristaGestion: actor.nombre || "",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
  });

  await batch.commit();

  await logAuditEvent({
    empresaId: route.empresaId,
    actor,
    action: "ruta.factura.create",
    resource: "facturasRuta",
    resourceId: facturaRef.id,
    after: {
      clienteId: cliente.id,
      totalProductos,
      deudaFinal,
      ruta: route.ruta,
      fecha: route.fecha,
    },
  });

  return NextResponse.json({
    id: facturaRef.id,
    factura: {
      id: facturaRef.id,
      empresaId: route.empresaId,
      tipo: "ruta",
      fecha: route.fecha,
      diaRuta: route.diaRuta,
      ruta: route.ruta,
      carteristaId: actor.uid,
      carteristaNombre: actor.nombre || "",
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      direccion: cliente.direccion || "",
      items: cleanItems,
      deudaAnterior,
      abonoDeudaAnterior: abonoAnterior,
      totalProductos,
      pagoProductosHoy: pagoHoy,
      fiadoHoy,
      deudaFinal,
      observaciones: facturaPayload.observaciones,
      estado: "guardada",
    },
  });
}

export async function POST(request) {
  try {
    const actor = await requireServerProfile(request);
    const body = await request.json();
    const db = getAdminDb();
    const route = await assertRouteAccess(db, request, actor, body);
    const action = text(body.action);

    if (action === "gasto.create") {
      return NextResponse.json(
        await createRouteExpense({ db, actor, route, body: body.gasto || body })
      );
    }

    if (action === "ubicacion.write") {
      return NextResponse.json(
        await writeRouteLocation({ db, actor, route, body: body.ubicacion || body })
      );
    }

    if (action === "cliente.create") {
      return NextResponse.json(
        await createRouteClient({ db, actor, route, body: body.cliente || body })
      );
    }

    if (action === "visita.mark") {
      return NextResponse.json(
        await markRouteVisit({ db, actor, route, body: body.visita || body })
      );
    }

    if (action === "cliente.delete.request") {
      return NextResponse.json(
        await requestClientDelete({ db, actor, route, body: body.cliente || body })
      );
    }

    if (action === "factura.create") {
      return await createRouteInvoice({ db, actor, route, body: body.factura || body });
    }

    return NextResponse.json({ error: "Accion no soportada." }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

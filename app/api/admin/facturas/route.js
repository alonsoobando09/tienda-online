import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  return new Date(value).getTime() || 0;
}

function dateValue(value) {
  const millis = timestampValue(value);
  if (!millis) return "";
  return new Date(millis).toISOString().slice(0, 10);
}

function normalizeStoreFactura(docu) {
  const data = docu.data();
  const productos = Array.isArray(data.productos)
    ? data.productos
    : Array.isArray(data.cart)
      ? data.cart
      : [];

  return {
    id: docu.id,
    source: "tienda",
    ...data,
    total: Number(data.total) || 0,
    clienteNombre: data.cliente?.nombre || "Cliente",
    clienteTelefono: data.cliente?.telefono || data.telefono || "",
    fecha: data.fecha || dateValue(data.createdAt),
    productosCount: productos.length,
    createdAtMs: timestampValue(data.createdAt),
  };
}

function normalizeRouteFactura(docu) {
  const data = docu.data();

  return {
    id: `ruta_${docu.id}`,
    realId: docu.id,
    source: "ruta",
    numero: `Ruta ${data.fecha || ""} ${data.ruta || ""}`,
    cliente: {
      nombre: data.clienteNombre || "Cliente",
      telefono: data.telefono || "",
      direccion: data.direccion || "",
    },
    clienteNombre: data.clienteNombre || "Cliente",
    clienteTelefono: data.telefono || "",
    total: Number(data.totalProductos) || 0,
    cobrado:
      (Number(data.abonoDeudaAnterior) || 0) +
      (Number(data.pagoProductosHoy) || 0),
    estado: data.estado || "guardada",
    tipoPago: "Ruta / cartera",
    fecha: data.fecha || "",
    diaRuta: data.diaRuta || "",
    ruta: data.ruta || "",
    carteristaNombre: data.carteristaNombre || "",
    deudaAnterior: Number(data.deudaAnterior) || 0,
    abonoDeudaAnterior: Number(data.abonoDeudaAnterior) || 0,
    pagoProductosHoy: Number(data.pagoProductosHoy) || 0,
    fiadoHoy: Number(data.fiadoHoy) || 0,
    deudaFinal: Number(data.deudaFinal) || 0,
    productos: (data.items || []).map((item) => ({
      id: item.productoId || item.sku || item.nombre,
      nombre: item.nombre,
      cantidad: Number(item.cantidad) || 0,
      precio: Number(item.precio) || 0,
      total: Number(item.subtotal) || 0,
    })),
    productosCount: (data.items || []).length,
    createdAt: data.createdAt,
    createdAtMs: timestampValue(data.createdAt),
  };
}

export async function GET() {
  try {
    const [facturasSnapshot, facturasRutaSnapshot] = await Promise.all([
      getDocs(query(collection(db, "facturas"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "facturasRuta"), orderBy("createdAt", "desc"))),
    ]);

    const facturas = [
      ...facturasSnapshot.docs.map(normalizeStoreFactura),
      ...facturasRutaSnapshot.docs.map(normalizeRouteFactura),
    ].sort((a, b) => b.createdAtMs - a.createdAtMs);

    return NextResponse.json(facturas);

  } catch (error) {
    console.error("Error obteniendo facturas:", error);
    return NextResponse.json(
      { error: "Error obteniendo facturas" },
      { status: 500 }
    );
  }
}

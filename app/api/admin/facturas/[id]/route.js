import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

function getFacturaRef(id) {
  if (id.startsWith("ruta_")) {
    return {
      ref: doc(db, "facturasRuta", id.replace(/^ruta_/, "")),
      source: "ruta",
    };
  }

  return {
    ref: doc(db, "facturas", id),
    source: "tienda",
  };
}

function normalizeFactura(id, source, data) {
  if (source === "ruta") {
    return {
      id,
      source,
      numero: `Ruta ${data.fecha || ""} ${data.ruta || ""}`,
      cliente: {
        nombre: data.clienteNombre || "Cliente",
        telefono: data.telefono || "",
        direccion: data.direccion || "",
      },
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
      observaciones: data.observaciones || "",
    };
  }

  const productos = Array.isArray(data.productos)
    ? data.productos
    : Array.isArray(data.cart)
      ? data.cart
      : [];
  const cliente = data.cliente || {};

  return {
    id,
    source,
    ...data,
    cliente: {
      nombre: cliente.nombre || data.clienteNombre || "Cliente",
      telefono: cliente.telefono || data.telefono || "",
      direccion: cliente.direccion || data.direccion || "",
      ciudad: cliente.ciudad || data.ciudad || "",
    },
    total: Number(data.total) || 0,
    subtotal: Number(data.subtotal) || 0,
    descuento: Number(data.descuento) || 0,
    envio: Number(data.envio) || 0,
    productos: productos.map((item) => ({
      id: item.id || item.productoId || item.sku || item.nombre,
      nombre: item.nombre || "Producto",
      cantidad: Number(item.cantidad) || 0,
      precio: Number(item.precio || item.precioDetal || item.precioMayor) || 0,
      total:
        Number(item.total || item.subtotal) ||
        (Number(item.cantidad) || 0) *
          (Number(item.precio || item.precioDetal || item.precioMayor) || 0),
    })),
  };
}

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { ref, source } = getFacturaRef(id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(normalizeFactura(id, source, snap.data()));
  } catch (error) {
    console.error("Error obteniendo factura:", error);
    return NextResponse.json(
      { error: "Error obteniendo factura" },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { estado } = await req.json();

    const { ref: facturaRef } = getFacturaRef(id);

    await updateDoc(facturaRef, {
      estado,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error actualizando factura:", error);

    return NextResponse.json(
      { error: "Error actualizando estado" },
      { status: 500 }
    );
  }
}

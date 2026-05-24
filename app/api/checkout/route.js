import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

function normalizeCartItem(item) {
  const cantidad = Number(item.cantidad) || 1;
  const precio = Number(item.precioDetal || item.precio || item.precioMayor) || 0;

  return {
    id: item.id ? String(item.id) : "",
    nombre: String(item.nombre || "Producto"),
    cantidad,
    precio,
    total: precio * cantidad,
    imagen: item.imagen || "",
    iva: Number(item.iva) || 0,
  };
}

export async function POST(req) {
  try {
    const { cliente, cart, descuento = 0, tipoPago } = await req.json();

    if (!cart || cart.length === 0) {
      return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
    }

    const items = cart.map(normalizeCartItem);

    if (items.some((item) => item.precio <= 0)) {
      return NextResponse.json(
        { error: "Hay productos sin precio válido en el carrito" },
        { status: 400 }
      );
    }

    const contadorRef = doc(db, "configuracion", "contadorfacturas");
    const facturasRef = collection(db, "facturas");

    let nuevaFactura = null;
    let nuevoNumero = 0;

    await runTransaction(db, async (transaction) => {
      const contadorSnap = await transaction.get(contadorRef);
      const productosLeidos = [];

      for (const item of items) {
        let productoData = null;
        let productoRef = null;

        if (item.id) {
          productoRef = doc(db, "productos", item.id);
          const productoSnap = await transaction.get(productoRef);

          if (productoSnap.exists()) {
            productoData = productoSnap.data();
          }
        }

        productosLeidos.push({
          item,
          productoData,
          productoRef,
        });
      }

      if (!contadorSnap.exists()) {
        transaction.set(contadorRef, { ultimoNumeroFactura: 1 });
        nuevoNumero = 1;
      } else {
        const actual = contadorSnap.data().ultimoNumeroFactura || 0;
        nuevoNumero = actual + 1;
        transaction.update(contadorRef, {
          ultimoNumeroFactura: nuevoNumero,
        });
      }

      const productosFinales = [];
      let subtotal = 0;

      for (const { item, productoData, productoRef } of productosLeidos) {
        const nombre = productoData?.nombre || item.nombre;
        const precio = Number(productoData?.precioDetal || item.precio) || 0;
        const stock = Number(productoData?.stock) || 0;
        const totalProducto = precio * item.cantidad;

        if (productoData) {
          if (stock < item.cantidad) {
            throw new Error(`Stock insuficiente para ${nombre}`);
          }

          transaction.update(productoRef, {
            stock: stock - item.cantidad,
          });
        }

        productosFinales.push({
          id: item.id || nombre.toLowerCase().replaceAll(" ", "-"),
          nombre,
          precio,
          cantidad: item.cantidad,
          total: totalProducto,
          iva: Number(productoData?.iva || item.iva) || 0,
          origen: productoData ? "inventario" : "catalogo",
        });

        subtotal += totalProducto;
      }

      const envio = items.length >= 8 ? 0 : 8000;
      const totalFinal = subtotal - Number(descuento || 0) + envio;
      const facturaRef = doc(facturasRef);

      nuevaFactura = {
        id: facturaRef.id,
        numero: `FAC-${nuevoNumero}`,
        cliente,
        productos: productosFinales,
        subtotal,
        descuento: Number(descuento) || 0,
        envio,
        total: totalFinal,
        tipoPago,
        estado: "pendiente",
        createdAt: serverTimestamp(),
      };

      transaction.set(facturaRef, nuevaFactura);
    });

    return NextResponse.json({
      id: nuevaFactura.id,
      numero: nuevaFactura.numero,
      factura: nuevaFactura,
    });
  } catch (error) {
    console.error("Error checkout:", error);

    return NextResponse.json(
      { error: error.message || "Error procesando pedido" },
      { status: 500 }
    );
  }
}

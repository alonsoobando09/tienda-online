import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

export async function POST(request) {
  try {
    const data = await request.json();

    const {
      numero,
      cliente,
      telefono,
      direccion,
      ciudad,
      tipoPago,
      cart,
      subtotal,
      descuento,
      total,
    } = data;

    const facturaRef = doc(collection(db, "facturas"));

    await runTransaction(db, async (transaction) => {

      // 🔹 1. Descontar stock
      for (const item of cart) {
        const productoRef = doc(db, "productos", item.id);
        const productoSnap = await transaction.get(productoRef);

        if (!productoSnap.exists()) {
          throw new Error(`Producto no existe: ${item.nombre}`);
        }

        const stockActual = productoSnap.data().stock;

        if (stockActual < item.cantidad) {
          throw new Error(`Stock insuficiente para ${item.nombre}`);
        }

        transaction.update(productoRef, {
          stock: stockActual - item.cantidad,
        });
      }

      // 🔹 2. Crear factura
      transaction.set(facturaRef, {
        numero,
        cliente,
        telefono,
        direccion,
        ciudad,
        tipoPago,
        cart,
        subtotal,
        descuento,
        total,
        estado: "completada",
        createdAt: serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      id: facturaRef.id,
    });

  } catch (error) {
    console.error("Error creando factura:", error);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
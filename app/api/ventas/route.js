import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDocs,
  runTransaction,
} from "firebase/firestore";

/* ===============================
   📦 GET - TODAS LAS VENTAS
================================= */
export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "ventas"));

    const ventas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(ventas);
  } catch (error) {
    console.error("Error GET ventas:", error);

    return NextResponse.json(
      { error: "Error al obtener ventas" },
      { status: 500 }
    );
  }
}

/* ===============================
   💰 POST - REGISTRAR VENTA
================================= */
export async function POST(request) {
  try {
    const body = await request.json();

    const { productoId, cantidad, precioVenta, tipoPago, cliente } = body;

    const productoRef = doc(db, "productos", productoId);

    await runTransaction(db, async (transaction) => {
      const productoSnap = await transaction.get(productoRef);

      if (!productoSnap.exists()) {
        throw new Error("Producto no existe");
      }

      const productoData = productoSnap.data();

      if (productoData.stock < cantidad) {
        throw new Error("Stock insuficiente");
      }

      // 🔻 Descontar stock     
      const nuevoStock = productoData.stock - cantidad;

      transaction.update(productoRef, {
        stock: nuevoStock,
      });

      // 💰 Calcular total y ganancia
      const totalVenta = precioVenta * cantidad;
      const costoBase = productoData.precioMayor * cantidad; // suponiendo precioMayor es tu costo
      const ganancia = totalVenta - costoBase;

      // 🧾 Registrar venta
          await addDoc(collection(db, "ventas"), {
        productoId,
        nombreProducto: productoData.nombre,
        cantidad,
        precioVenta,
        totalVenta,
        ganancia,
        tipoPago, // "contado" o "fiado"
        cliente: tipoPago === "fiado" ? cliente : null,
        pagado: tipoPago === "contado",
        fecha: new Date(),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error POST venta:", error.message);

    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

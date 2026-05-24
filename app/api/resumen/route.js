import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "ventas"));

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let totalVentas = 0;
    let totalGanancia = 0;

    snapshot.docs.forEach((doc) => {
      const venta = doc.data();
      const fechaVenta = venta.fecha.toDate();

      if (fechaVenta >= hoy) {
        totalVentas += venta.totalVenta;
        totalGanancia += venta.ganancia;
      }
    });

    return NextResponse.json({
      totalVentas,
      totalGanancia,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Error al generar resumen" },
      { status: 500 }
    );
  }
}
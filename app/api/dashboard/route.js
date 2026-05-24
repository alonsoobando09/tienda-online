import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "ventas"));

    let totalVentas = 0;
    let totalGanancia = 0;
    let totalFiado = 0;

    snapshot.docs.forEach((doc) => {
      const venta = doc.data();

      totalVentas += venta.totalVenta;
      totalGanancia += venta.ganancia;

      if (!venta.pagado) {
        totalFiado += venta.totalVenta;
      }
    });

    return NextResponse.json({
      totalVentas,
      totalGanancia,
      totalFiado,
    });

  } catch {
    return NextResponse.json(
      { error: "Error dashboard" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "facturas"));

    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    let total = 0;
    let contado = 0;
    let fiado = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const fecha = data.fecha.toDate();

      if (fecha >= hoy) {
        total += data.total;

        if (data.tipoPago === "contado") {
          contado += data.total;
        } else {
          fiado += data.total;
        }
      }
    });

    return NextResponse.json({
      total,
      contado,
      fiado
    });

  } catch {
    return NextResponse.json({ error: "Error corte" }, { status: 500 });
  }
}

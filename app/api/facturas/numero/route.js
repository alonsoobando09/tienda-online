import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

export async function GET() {
  const configRef = doc(db, "configuracion", "contadorFacturas");

  try {
    let nuevoNumero = 0;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(configRef);

      // 🔹 Si el contador no existe, lo creamos en 1
      if (!snap.exists()) {
        nuevoNumero = 1;

        transaction.set(configRef, {
          ultimoNumeroFactura: nuevoNumero,
          updatedAt: new Date(),
        });

      } else {
        const actual = snap.data()?.ultimoNumeroFactura ?? 0;
        nuevoNumero = actual + 1;

        transaction.update(configRef, {
          ultimoNumeroFactura: nuevoNumero,
          updatedAt: new Date(),
        });
      }
    });

    return NextResponse.json(
      { 
        success: true,
        numero: nuevoNumero 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ Error generando número de factura:", error);

    return NextResponse.json(
      { 
        success: false,
        error: "No se pudo generar el número de factura" 
      },
      { status: 500 }
    );
  }
}
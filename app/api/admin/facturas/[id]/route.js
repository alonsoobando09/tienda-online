import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const facturaRef = doc(db, "facturas", id);
    const snap = await getDoc(facturaRef);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: snap.id,
      ...snap.data(),
    });
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

    const facturaRef = doc(db, "facturas", id);

    await updateDoc(facturaRef, {
      estado,
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

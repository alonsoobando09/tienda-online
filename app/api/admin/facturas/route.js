import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function GET() {
  try {
    const q = query(
      collection(db, "facturas"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    const facturas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(facturas);

  } catch {
    return NextResponse.json(
      { error: "Error obteniendo facturas" },
      { status: 500 }
    );
  }
}

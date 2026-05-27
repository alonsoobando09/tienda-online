import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

function normalizeProduct(body) {
  return {
    nombre: String(body.nombre || "").trim(),
    categoria: String(body.categoria || "general").trim(),
    sku: String(body.sku || "").trim(),
    proveedor: String(body.proveedor || "").trim(),
    unidad: String(body.unidad || "unidad").trim(),
    imagen: String(body.imagen || "").trim(),
    descripcion: String(body.descripcion || "").trim(),
    costo: Number(body.costo) || 0,
    precioMayor: Number(body.precioMayor) || 0,
    precioDetal: Number(body.precioDetal) || 0,
    stock: Number(body.stock) || 0,
    stockMinimo: Number(body.stockMinimo) || 5,
    iva: Number(body.iva) || 0,
    activo: body.activo !== false,
  };
}

export async function GET() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "productos"), orderBy("nombre", "asc"))
    );

    const productos = snapshot.docs.map((docu) => ({
      id: docu.id,
      ...docu.data(),
    }));

    return NextResponse.json(productos);
  } catch (error) {
    console.error("Error GET productos:", error);

    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const product = normalizeProduct(await request.json());

    if (!product.nombre) {
      return NextResponse.json(
        { error: "El nombre del producto es obligatorio" },
        { status: 400 }
      );
    }

    const docRef = await addDoc(collection(db, "productos"), {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error) {
    console.error("Error POST producto:", error);

    return NextResponse.json(
      { error: "Error al crear producto" },
      { status: 500 }
    );
  }
}

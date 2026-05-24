import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
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
    updatedAt: serverTimestamp(),
  };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const docRef = doc(db, "productos", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: docSnap.id,
      ...docSnap.data(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const product = normalizeProduct(await request.json());

    if (!product.nombre) {
      return NextResponse.json(
        { error: "El nombre del producto es obligatorio" },
        { status: 400 }
      );
    }

    await updateDoc(doc(db, "productos", id), product);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al actualizar" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    await deleteDoc(doc(db, "productos", id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 }
    );
  }
}

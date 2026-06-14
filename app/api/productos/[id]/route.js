import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  getProductPriceRange,
  getProductValidationErrors,
  normalizeProductUnit,
} from "@/lib/productValidation";

function normalizeProduct(body) {
  const imagenes = Array.isArray(body.imagenes)
    ? body.imagenes
        .map((image) => String(image || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const priceRange = getProductPriceRange(body);

  return {
    nombre: String(body.nombre || "").trim(),
    categoria: String(body.categoria || "general").trim(),
    sku: String(body.sku || "").trim(),
    proveedor: String(body.proveedor || "").trim(),
    unidad: normalizeProductUnit(body.unidad),
    imagen: String(body.imagen || "").trim(),
    imagenes,
    descripcion: String(body.descripcion || "").trim(),
    costo: Number(body.costo) || 0,
    precioMayor: priceRange.precioMayor,
    precioDetal: priceRange.precioDetal,
    precioMinimo: priceRange.precioMinimo,
    precioMaximo: priceRange.precioMaximo,
    precioPacaMayor: priceRange.precioPacaMayor,
    precioPacaDetal: priceRange.precioPacaDetal,
    unidadesPorPaca: Number(body.unidadesPorPaca) || 0,
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
    const errors = getProductValidationErrors(product);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join(" ") },
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

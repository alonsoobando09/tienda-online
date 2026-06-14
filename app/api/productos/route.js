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
    const errors = getProductValidationErrors(product);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join(" ") },
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

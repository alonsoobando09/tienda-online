"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { productos } from "@/app/data/productos";
import { getSafeImageSrc, isRemoteImage } from "@/lib/images";

export default function ProductoDetalle() {
  const { id } = useParams();

  const all = Object.values(productos).flat();
  const prod = all.find((p) => p.id === id);

  if (!prod) return <p>Producto no encontrado</p>;

  return (
    <main className="p-10">
      <Image
        src={getSafeImageSrc(prod.imagen)}
        alt={prod.nombre || "Producto"}
        width={420}
        height={320}
        className="w-80 rounded-2xl"
        unoptimized={isRemoteImage(prod.imagen)}
      />

      <h1 className="text-3xl font-bold mt-4">{prod.nombre}</h1>

      <p className="text-xl text-green-600">${prod.precio}</p>

      <button className="mt-4 bg-black text-white px-6 py-2 rounded-xl">
        Agregar al carrito
      </button>
    </main>
  );
}

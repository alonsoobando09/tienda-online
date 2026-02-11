"use client";

import { useParams } from "next/navigation";
import { productos } from "@/app/data/productos";

export default function ProductoDetalle() {
  const { id } = useParams();

  const all = Object.values(productos).flat();
  const prod = all.find((p) => p.id === id);

  if (!prod) return <p>Producto no encontrado</p>;

  return (
    <main className="p-10">

      <img
        src={prod.imagen}
        className="w-80 rounded-2xl"
      />

      <h1 className="text-3xl font-bold mt-4">
        {prod.nombre}
      </h1>

      <p className="text-xl text-green-600">
        ${prod.precio}
      </p>

      <button className="mt-4 bg-black text-white px-6 py-2 rounded-xl">
        Agregar al carrito
      </button>

    </main>
  );
}

"use client";

import Link from "next/link";

export default function ProductCard({ prod }) {
  return (
    <Link href={`/producto/${prod.id}`}>
      <div className="border rounded-2xl p-4 shadow hover:shadow-xl transition bg-white">

        <img
          src={prod.imagen}
          alt={prod.nombre}
          className="w-full h-40 object-cover rounded-xl"
        />

        <h3 className="font-bold mt-3">{prod.nombre}</h3>

        <p className="text-green-600 font-semibold">
          ${prod.precio}
        </p>

      </div>
    </Link>
  );
}

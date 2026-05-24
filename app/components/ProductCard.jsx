"use client";

import Image from "next/image";
import Link from "next/link";

export default function ProductCard({ prod }) {
  return (
    <Link href={`/productos/${prod.id}`}>
      <div className="border rounded-2xl p-4 shadow hover:shadow-xl transition bg-white">
        <Image
          src={prod.imagen || "/categorias/carnicos.jpg"}
          alt={prod.nombre || "Producto"}
          width={400}
          height={260}
          className="w-full h-40 object-cover rounded-xl"
        />

        <h3 className="font-bold mt-3">{prod.nombre}</h3>

        <p className="text-green-600 font-semibold">${prod.precio}</p>
      </div>
    </Link>
  );
}

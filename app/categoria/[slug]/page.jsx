"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import AddToCart from "@/app/components/AddToCart";


const productos = {
  carnicos: [
    {
      nombre: "chuleta Ahumada de Cerdo",
      precioDetal: 28000,
      precioMayor: 25000,
      tipo: "Perecedero",
      imagen: "/categorias/ZENÚ.jpg",
    },
    {
      nombre: "Chorizo santarrosano",
      precioDetal: 22000,
      precioMayor: 20000,
      tipo: "Perecedero",
      imagen: "/categorias/carnicos.jpg",
    },
  ],

  cereales: [
    {
      nombre: "granola",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "no Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  
   confiteria: [
    {
      nombre: "dulces",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "no Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
   electronicos: [
    {
      nombre: "camaras",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
   lacteos: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
   jugueteria: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  venezolanos: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  frutossecos: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
   galleteria: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  licores: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  reposteria: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  servicios: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  usados: [
    {
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
};

export default function CategoriaPage() {
  const { slug } = useParams();
  const data = productos[slug] || [];

  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
      
      {/* 🖼️ BANNER */}
      <div
        style={{
          position: "relative",
          height: 220,
          borderRadius: 15,
          overflow: "hidden",
          marginBottom: 40,
        }}
      >
        <Image
          src={`/categorias/${slug}.jpg`}
          alt={slug}
          fill
          style={{ objectFit: "cover" }}
          onError={(e) => {
    e.currentTarget.src = "/categorias/default.jpg";
  }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 32,
            fontWeight: "bold",
            textTransform: "capitalize",
          }}
        >
          {slug}
        </div>
      </div>

      {/* 🛒 GRID PRODUCTOS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 25,
        }}
      >
        {data.map((p, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #eee",
              borderRadius: 14,
              padding: 15,
              background: "white",
              boxShadow: "0 5px 15px rgba(0,0,0,.08)",
            }}
          >
            <div style={{ position: "relative", height: 150 }}>
              <Image
                src={p.imagen}
                alt={p.nombre}
                fill
                style={{ objectFit: "cover", borderRadius: 10 }}
              />
            </div>

            <h3 style={{ marginTop: 10 }}>{p.nombre}</h3>

            <p>💲 Detal: ${p.precioDetal.toLocaleString()}</p>
            <p>🏷️ Mayor: ${p.precioMayor.toLocaleString()}</p>
            <p>📦 {p.tipo}</p>
            <AddToCart product={p} />


            <a
              href={`https://wa.me/573249111150?text=Hola quiero comprar ${p.nombre}`}
              target="_blank"
              style={{
                display: "block",
                marginTop: 10,
                background: "#25D366",
                color: "white",
                padding: 10,
                borderRadius: 8,
                textAlign: "center",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Comprar
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}

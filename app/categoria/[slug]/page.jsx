"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import AddToCart from "@/app/components/AddToCart";

const productos = {
  carnicos: [
    {
      id: "chuleta-ahumada-cerdo",
      nombre: "Chuleta Ahumada de Cerdo",
      precioDetal: 28000,
      precioMayor: 25000,
      tipo: "Perecedero",
      imagen: "/categorias/chuleta.jpeg.jpeg",
    },
    {
      id: "chorizo-santarrosano",
      nombre: "Chorizo santarrosano",
      precioDetal: 22000,
      precioMayor: 20000,
      tipo: "Perecedero",
      imagen: "/categorias/carnicos.jpg",
    },
    {
      id: "costillas-cerdo-ahumadas",
      nombre: "Costillas de Cerdo Ahumadas",
      precioDetal: 22000,
      precioMayor: 20000,
      tipo: "Perecedero",
      imagen: "/categorias/carnicos.jpg",
    },
  ],
  cereales: [
    {
      id: "granola",
      nombre: "Granola",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "No perecedero",
      imagen: "/categorias/cereales.jpg",
    },
  ],
  confiteria: [
    {
      id: "dulces",
      nombre: "Dulces",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "No perecedero",
      imagen: "/categorias/confiteria.jpg",
    },
  ],
  electronicos: [
    {
      id: "camaras",
      nombre: "Cámaras",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Tecnología",
      imagen: "/categorias/electronicos.jpg",
    },
  ],
  lacteos: [
    {
      id: "queso-mano-lacteos",
      nombre: "Queso de Mano",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Perecedero",
      imagen: "/categorias/lacteos.jpg",
    },
  ],
  jugueteria: [
    {
      id: "juguete-surtido",
      nombre: "Juguete surtido",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "No perecedero",
      imagen: "/categorias/jugueteria.jpg",
    },
  ],
  venezolanos: [
    {
      id: "producto-venezolano-surtido",
      nombre: "Producto venezolano surtido",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Importado",
      imagen: "/categorias/venezolanos.jpg",
    },
  ],
  frutossecos: [
    {
      id: "pistachos",
      nombre: "Pistachos",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "No perecedero",
      imagen: "/categorias/frutos-secos.jpg",
    },
  ],
  galleteria: [
    {
      id: "galletas-surtidas",
      nombre: "Galletas surtidas",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "No perecedero",
      imagen: "/categorias/galleteria.jpg",
    },
  ],
  licores: [
    {
      id: "licor-surtido",
      nombre: "Licor surtido",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Bebida",
      imagen: "/categorias/licores.jpg",
    },
  ],
  reposteria: [
    {
      id: "insumo-reposteria",
      nombre: "Insumo de repostería",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "No perecedero",
      imagen: "/categorias/reposteria.jpg",
    },
  ],
  servicios: [
    {
      id: "servicio-comercial",
      nombre: "Servicio comercial",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Servicio",
      imagen: "/categorias/servicios.jpg",
    },
  ],
  usados: [
    {
      id: "producto-segunda",
      nombre: "Producto de segunda",
      precioDetal: 12000,
      precioMayor: 10000,
      tipo: "Usado",
      imagen: "/categorias/usados.jpg",
    },
  ],
};

export default function CategoriaPage() {
  const { slug } = useParams();
  const data = productos[slug] || [];

  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 25,
        }}
      >
        {data.map((p) => (
          <div
            key={p.id}
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

            <p>Detal: ${p.precioDetal.toLocaleString()}</p>
            <p>Mayor: ${p.precioMayor.toLocaleString()}</p>
            <p>{p.tipo}</p>
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

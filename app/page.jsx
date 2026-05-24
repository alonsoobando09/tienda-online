"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const categorias = [
{ slug: "carnicos", nombre: "Cárnicos", imagen: "/categorias/carnicos.jpg" },
{ slug: "lacteos", nombre: "Lácteos", imagen: "/categorias/lacteos.jpg" },
{ slug: "reposteria", nombre: "Repostería", imagen: "/categorias/reposteria.jpg" },
{ slug: "galleteria", nombre: "Galletería", imagen: "/categorias/galleteria.jpg" },
{ slug: "venezolanos", nombre: "Importados Venezolanos", imagen: "/categorias/venezolanos.jpg" },
{ slug: "licores", nombre: "Licores", imagen: "/categorias/licores.jpg" },
{ slug: "frutossecos", nombre: "Frutos Secos", imagen: "/categorias/frutos-secos.jpg" },
{ slug: "confiteria", nombre: "Confitería", imagen: "/categorias/confiteria.jpg" },
{ slug: "cereales", nombre: "Cereales", imagen: "/categorias/cereales.jpg" },
{ slug: "electronicos", nombre: "Electrónicos", imagen: "/categorias/electronicos.jpg" },
{ slug: "jugueteria", nombre: "Juguetería", imagen: "/categorias/jugueteria.jpg" },
{ slug: "usados", nombre: "Usados / Segunda", imagen: "/categorias/usados.jpg" },
{ slug: "servicios", nombre: "Servicios", imagen: "/categorias/servicios.jpg" },
];

export default function HomePage() {
return (
<main
style={{
minHeight: "100vh",
background: "linear-gradient(180deg, #FDF8F1, #FDF8F1)",
fontFamily: "Arial",
}}
>
  {/* BOTÓN ADMIN */}
<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    padding: "20px 40px",
  }}
>
  <Link
    href="/login"
    style={{
      background: "#111",
      color: "white",
      padding: "10px 18px",
      borderRadius: "8px",
      textDecoration: "none",
      fontWeight: "bold",
      fontSize: "14px",
    }}
  >
    🔐 Admin
  </Link>
</div>
{/* HERO */}
<section style={{ padding: "80px 40px", textAlign: "center" }}>
<h1 style={{ fontSize: "42px", color: "#2D2926", marginBottom: "20px" }}>
MI PROVEEDOR CENTRAL </h1>

```
    <p
      style={{
        fontSize: "18px",
        color: "#2D2926",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      Ventas al detal y al por mayor. Descuentos automáticos desde $1.000.000.
      Ideal para tiendas, restaurantes y distribuidores.
    </p>

    <div style={{ marginTop: "40px" }}>
      <Link
        href="#categorias"
        style={{
          padding: "14px 30px",
          background: "#1B4332",
          color: "#F2F2F2",
          borderRadius: "8px",
          fontWeight: "bold",
          textDecoration: "none",
          marginRight: "50px",
          fontFamily:"Arial, Helvetica, sans-serif",
        }}
      >
        Ver productos
      </Link>

      <Link
        href="https://wa.me/573249111150"
        style={{
          padding: "14px 30px",
          border: "2px solid #1B4332",
          color: "#2D2926",
          borderRadius: "8px",
          fontWeight: "bold",
          textDecoration: "none",
          background: "#25d366",
          textAlign:"Arial, Helvetica, sans-serif",
        }}
      >
        Comprar al por mayor
      </Link>
    </div>
  </section>

  {/* BENEFICIOS */}
  <section
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "20px",
      padding: "40px",
      background: "#ecf2e9",
    }}
  >
    {[
      "🚚 Envíos Bogotá $8.000",
      "🎁 Envío GRATIS desde 6 productos",
      "💸 Descuentos mayoristas automáticos",
      "📦 Unidad, caja, paca o bulto",
      "🤝 Pago contra entrega",
    ].map((txt) => (
      <div
        key={txt}
        style={{
          background: "#1B4332",
          padding: "20px",
          borderRadius: "15px",
          textAlign: "center",
          fontWeight: "bold",
          color: "#C5A059",
          marginRight: "40px",
          
        }}
      >
        {txt}
      </div>
    ))}
  </section>

  {/* CATEGORÍAS PRO */}
  <section id="categorias" style={{ padding: "60px 40px" }}>
    <h2
      style={{
        textAlign: "center",
        color: "#2D2926",
        marginBottom: "45px",
      }}
    >
      🛒 Categorías
    </h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "25px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {categorias.map((cat, index) => (
        <Link
          key={index}
          href={`/categoria/${cat.slug}`}
          style={{ textDecoration: "none" }}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            style={{
              position: "relative",
              height: "220px",
              borderRadius: "14px",
              overflow: "hidden",
              cursor: "pointer",
              boxShadow: "0 10px 30px rgba(230, 13, 13, 0.3)",
            }}
          >
            <Image
              src={cat.imagen}
              alt={cat.nombre}
              fill
              style={{
                objectFit: "cover",
                transition: "transform .5s",
              }}
            />

            {/* Texto */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: "100%",
                padding: "12px",
                background:
                  "linear-gradient(to top, rgba(0,0,0,.8), transparent)",
                color: "white",
                fontWeight: "bold",
              }}
            >
              {cat.nombre}
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  </section>

  {/* FOOTER */}
  <footer
    style={{
      padding: "30px",
      textAlign: "center",
      background: "#1A1A1A",
      color: "#C5A059",
    }}
  >
    © {new Date().getFullYear()} TU PROVEEDOR CENTRAL · Ventas al detal y al por mayor
  </footer>
</main>
);
}

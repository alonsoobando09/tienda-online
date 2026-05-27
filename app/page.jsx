"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { categories } from "@/lib/categories";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f3ea",
        fontFamily: "Arial",
      }}
    >
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
          Admin
        </Link>
      </div>

      <section style={{ padding: "74px 40px", textAlign: "center" }}>
        <h1 style={{ fontSize: "42px", color: "#2D2926", marginBottom: 20 }}>
          Mi Proveedor Central
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "#2D2926",
            maxWidth: 820,
            margin: "0 auto",
          }}
        >
          Ventas al detal y al por mayor. Productos organizados por categoría,
          pedidos por WhatsApp, checkout online y panel administrativo.
        </p>

        <div style={{ marginTop: 36 }}>
          <Link
            href="#categorias"
            style={{
              padding: "14px 30px",
              background: "#1B4332",
              color: "#F2F2F2",
              borderRadius: "8px",
              fontWeight: "bold",
              textDecoration: "none",
              marginRight: 14,
            }}
          >
            Ver productos
          </Link>

          <Link
            href="https://wa.me/573132752493"
            style={{
              padding: "14px 30px",
              border: "2px solid #1B4332",
              color: "#2D2926",
              borderRadius: "8px",
              fontWeight: "bold",
              textDecoration: "none",
              background: "#25d366",
            }}
          >
            Comprar al por mayor
          </Link>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 18,
          padding: 40,
          background: "#ecf2e9",
        }}
      >
        {[
          "Envíos en Bogotá",
          "Descuentos mayoristas",
          "Unidad, caja, paca o bulto",
          "Pago contra entrega",
        ].map((txt) => (
          <div
            key={txt}
            style={{
              background: "#1B4332",
              padding: 20,
              borderRadius: 8,
              textAlign: "center",
              fontWeight: "bold",
              color: "#C5A059",
            }}
          >
            {txt}
          </div>
        ))}
      </section>

      <section id="categorias" style={{ padding: "60px 40px" }}>
        <h2
          style={{
            textAlign: "center",
            color: "#2D2926",
            marginBottom: 38,
          }}
        >
          Categorías
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 25,
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categoria/${cat.slug}`}
              style={{ textDecoration: "none" }}
            >
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  position: "relative",
                  height: 220,
                  borderRadius: 10,
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: "0 10px 28px rgba(27,67,50,.18)",
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

                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    width: "100%",
                    padding: 14,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,.82), transparent)",
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

      <footer
        style={{
          padding: 30,
          textAlign: "center",
          background: "#1A1A1A",
          color: "#C5A059",
        }}
      >
        © {new Date().getFullYear()} Mi Proveedor Central · Ventas al detal y al
        por mayor
      </footer>
    </main>
  );
}

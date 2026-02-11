"use client";

import Link from "next/link";
import Image from "next/image";

export default function CategoryCard({ slug, nombre }) {
  return (
    <Link
      href={`/categoria/${slug}`}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
          transition: "transform .25s",
          cursor: "pointer",
        }}
      >
        {/* IMAGEN */}
        <Image
          src={`/categorias/${slug}.jpg`}
          alt={nombre}
          width={400}
          height={250}
          style={{
            width: "100%",
            height: "180px",
            objectFit: "cover",
          }}
        />

        {/* NOMBRE */}
        <div style={{ padding: "14px", textAlign: "center" }}>
          <h3>{nombre}</h3>
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import AddToCart from "@/app/components/AddToCart";
import { db } from "@/lib/firebase";
import { getCategoryBySlug } from "@/lib/categories";
import { getSafeImageSrc } from "@/lib/images";
import { collection, getDocs, query, where } from "firebase/firestore";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function CategoriaPage() {
  const { slug } = useParams();
  const category = getCategoryBySlug(slug);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function cargarProductos() {
      try {
        const productosQuery = query(
          collection(db, "productos"),
          where("categoria", "==", slug),
          where("activo", "==", true)
        );
        const snapshot = await getDocs(productosQuery);
        const data = snapshot.docs.map((docu) => ({
          id: docu.id,
          ...docu.data(),
        }));

        if (active) setProductos(data);
      } catch (error) {
        console.error("Error cargando productos por categoría:", error);
        if (active) setProductos([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (slug) cargarProductos();

    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
      <div
        style={{
          position: "relative",
          height: 240,
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 34,
        }}
      >
        <Image
          src={category?.imagen || "/categorias/carnicos.jpg"}
          alt={category?.nombre || "Categoría"}
          fill
          style={{ objectFit: "cover" }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,.48)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 34,
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          {category?.nombre || slug}
        </div>
      </div>

      {loading && <p>Cargando productos...</p>}

      {!loading && productos.length === 0 && (
        <section
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 24,
            border: "1px solid #e5e7eb",
          }}
        >
          <h2>No hay productos publicados en esta categoría</h2>
          <p>
            Agrega productos desde el panel administrador y selecciona esta
            categoría para que aparezcan aquí.
          </p>
        </section>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
          gap: 25,
        }}
      >
        {productos.map((p) => (
          <article
            key={p.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 15,
              background: "white",
              boxShadow: "0 8px 22px rgba(0,0,0,.06)",
            }}
          >
            <div
              aria-label={p.nombre || "Producto"}
              style={{
                height: 170,
                borderRadius: 8,
                backgroundImage: `url("${getSafeImageSrc(
                  p.imagen,
                  category?.imagen
                )}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: "#f3f4f6",
              }}
            />

            <h3 style={{ marginTop: 12 }}>{p.nombre}</h3>
            <p>Detal: {money.format(p.precioDetal || 0)}</p>
            <p>Mayor: {money.format(p.precioMayor || 0)}</p>
            <p>Stock: {p.stock || 0}</p>

            <AddToCart product={p} />

            <a
              href={`https://wa.me/573132752493?text=Hola quiero comprar ${encodeURIComponent(
                p.nombre
              )}`}
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
              Comprar por WhatsApp
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}

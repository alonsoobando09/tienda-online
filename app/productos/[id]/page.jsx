"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AddToCart from "@/app/components/AddToCart";
import { getSafeImageSrc } from "@/lib/images";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function ProductoDetalle() {
  const { id } = useParams();
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState("");
  const [presentacion, setPresentacion] = useState("unidad");

  useEffect(() => {
    let active = true;

    async function cargarProducto() {
      try {
        const res = await fetch(`/api/productos/${id}`);
        if (!res.ok) throw new Error("Producto no encontrado");
        const data = await res.json();
        if (!active) return;

        setProducto(data);
        setSelectedImage(getSafeImageSrc(data.imagen));
      } catch (error) {
        console.error("Error cargando producto:", error);
        if (active) setProducto(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) cargarProducto();

    return () => {
      active = false;
    };
  }, [id]);

  const gallery = useMemo(() => {
    if (!producto) return [];

    const uniqueImages = new Set();

    return [producto.imagen, ...(producto.imagenes || [])]
      .map((image) => getSafeImageSrc(image, ""))
      .filter(Boolean)
      .filter((image) => {
        if (uniqueImages.has(image)) return false;
        uniqueImages.add(image);
        return true;
      })
      .slice(0, 4);
  }, [producto]);

  if (loading) return <main className="product-detail">Cargando producto...</main>;
  if (!producto) return <main className="product-detail">Producto no encontrado</main>;

  const hasPaca = Number(producto.unidadesPorPaca || 0) > 0;
  const precioUnidad = Number(producto.precioDetal || producto.precio || 0);
  const precioPaca = Number(producto.precioPacaDetal || 0);
  const precioSeleccionado =
    presentacion === "paca" && precioPaca > 0 ? precioPaca : precioUnidad;

  return (
    <main className="product-detail">
      <section className="product-gallery">
        <button
          className="product-main-image"
          type="button"
          style={{
            backgroundImage: `url("${selectedImage || gallery[0]}")`,
          }}
        >
          <span>Ver galeria</span>
        </button>

        <div className="product-thumbs">
          {gallery.map((image, index) => (
            <button
              aria-label="Cambiar imagen del producto"
              className={`product-thumb ${selectedImage === image ? "active" : ""}`}
              key={`${producto.id}-image-${index}`}
              onClick={() => setSelectedImage(image)}
              style={{ backgroundImage: `url("${image}")` }}
              type="button"
            />
          ))}
        </div>
      </section>

      <section className="product-info-panel">
        <p className="product-kicker">Producto mayorista</p>
        <h1>{producto.nombre}</h1>
        {producto.descripcion && <p>{producto.descripcion}</p>}

        <div className="product-price-box">
          <span>{presentacion === "paca" ? "Precio por paca" : "Precio por unidad"}</span>
          <strong>{money.format(precioSeleccionado)}</strong>
          {presentacion === "paca" && hasPaca && (
            <small>{producto.unidadesPorPaca} unidades por paca</small>
          )}
        </div>

        <div className="product-option-grid">
          <button
            className={presentacion === "unidad" ? "active" : ""}
            onClick={() => setPresentacion("unidad")}
            type="button"
          >
            Unidad
            <strong>{money.format(precioUnidad)}</strong>
          </button>

          {hasPaca && (
            <button
              className={presentacion === "paca" ? "active" : ""}
              onClick={() => setPresentacion("paca")}
              type="button"
            >
              Paca
              <strong>{money.format(precioPaca || precioUnidad)}</strong>
            </button>
          )}
        </div>

        <AddToCart
          product={producto}
          presentacion={presentacion}
          precio={precioSeleccionado}
        />
      </section>
    </main>
  );
}

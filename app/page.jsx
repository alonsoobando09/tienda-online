"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BadgePercent, MapPin, PackageCheck, Truck } from "lucide-react";
import { categories } from "@/lib/categories";

const benefits = [
  { label: "Envios en Bogota", icon: Truck },
  { label: "Descuentos mayoristas", icon: BadgePercent },
  { label: "Unidad, caja, paca o bulto", icon: PackageCheck },
  { label: "Pedidos rapidos por zona", icon: MapPin },
];

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-media" />
        <div className="home-hero-overlay" />

        <Link className="home-admin-link" href="/login">
          Admin
        </Link>

        <div className="home-hero-content">
          <p className="home-eyebrow">Central mayorista online</p>
          <h1>Mi Proveedor Central</h1>
          <p>
            Compra facil al detal y al por mayor. Categorias organizadas,
            pedidos por WhatsApp, checkout online y panel administrativo.
          </p>

          <div className="home-actions">
            <Link className="home-button primary" href="#categorias">
              Ver productos
              <ArrowRight size={18} />
            </Link>

            <Link className="home-button whatsapp" href="https://wa.me/573132752493">
              Comprar al por mayor
            </Link>
          </div>
        </div>
      </section>

      <section className="home-benefits" aria-label="Beneficios">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <div className="home-benefit-card" key={benefit.label}>
              <Icon size={21} />
              <span>{benefit.label}</span>
            </div>
          );
        })}
      </section>

      <section className="home-categories" id="categorias">
        <div className="home-section-heading">
          <p className="home-eyebrow">Catalogo</p>
          <h2>Categorias principales</h2>
        </div>

        <div className="home-category-grid">
          {categories.map((cat) => (
            <Link className="home-category-link" href={`/categoria/${cat.slug}`} key={cat.slug}>
              <motion.div
                className="home-category-card"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Image
                  src={cat.imagen}
                  alt={cat.nombre}
                  fill
                  sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
                  style={{ objectFit: "cover" }}
                />
                <div>
                  <strong>{cat.nombre}</strong>
                  <span>Ver productos</span>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        {new Date().getFullYear()} Mi Proveedor Central. Ventas al detal y al por
        mayor.
      </footer>
    </main>
  );
}

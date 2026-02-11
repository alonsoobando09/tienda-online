"use client";

import Link from "next/link";
import { useCart } from "@/app/context/CartContext";

export default function Header() {
  const { cart } = useCart();

  // Contar cantidades
  const totalItems = cart.reduce(
    (acc, p) => acc + (p.cantidad || 1),
    0
  );

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 40px",
        background: "#1B4332",
        color: "white",
      }}
    >
      {/* LOGO */}
      <Link
        href="/"
        style={{
          fontSize: 20,
          fontWeight: "bold",
          textDecoration: "none",
          color: "white",
        }}
      >
        🛒 Mi Proveedor Central
      </Link>

      {/* CARRITO */}
      <Link
        href="/carrito"
        style={{
          position: "relative",
          textDecoration: "none",
          color: "white",
          fontSize: 18,
        }}
      >
        🛒 Carrito

        {/* BURBUJA CONTADOR */}
        {totalItems > 0 && (
          <span
            style={{
              position: "absolute",
              top: -8,
              right: -12,
              background: "#C5A059",
              color: "#1B4332",
              borderRadius: "50%",
              padding: "2px 7px",
              fontSize: 12,
              fontWeight: "bold",
            }}
          >
            {totalItems}
          </span>
        )}
      </Link>
    </header>
  );
}

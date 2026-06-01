"use client";

import Link from "next/link";
import { Menu, ShoppingCart, Store } from "lucide-react";
import { useCart } from "@/app/context/CartContext";

export default function Header() {
  const { cart } = useCart();
  const totalItems = cart.reduce((acc, p) => acc + (p.cantidad || 1), 0);

  return (
    <header className="store-header">
      <Link href="/" className="store-brand">
        <Store size={22} />
        <span>Proveedor Central</span>
      </Link>

      <nav className="store-nav" aria-label="Menu principal">
        <Link href="/">Inicio</Link>
        <Link href="/carrito" className="store-cart-link">
          <ShoppingCart size={19} />
          <span>Carrito</span>
          {totalItems > 0 && <strong>{totalItems}</strong>}
        </Link>
      </nav>

      <Link href="/carrito" className="store-mobile-cart" aria-label="Carrito">
        <ShoppingCart size={21} />
        {totalItems > 0 && <strong>{totalItems}</strong>}
      </Link>

      <Menu className="store-mobile-menu-icon" size={22} aria-hidden="true" />
    </header>
  );
}

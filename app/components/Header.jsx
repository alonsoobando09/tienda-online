"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingCart, Store, X } from "lucide-react";
import { useCart } from "@/app/context/CartContext";
import { isOperationalPath } from "@/lib/routeZones";

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { cart } = useCart();
  const totalItems = cart.reduce((acc, p) => acc + (p.cantidad || 1), 0);

  if (isOperationalPath(pathname)) return null;

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header className="store-header">
      <Link href="/" className="store-brand" onClick={closeMenu}>
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

      <button
        aria-label={open ? "Cerrar menu" : "Abrir menu"}
        className="store-mobile-menu-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <nav className="store-mobile-menu" aria-label="Menu movil">
          <Link href="/" onClick={closeMenu}>
            Inicio
          </Link>
          <Link href="/#categorias" onClick={closeMenu}>
            Categorias
          </Link>
        <Link href="/carrito" onClick={closeMenu}>
          Carrito
        </Link>
        <Link href="/app" onClick={closeMenu}>
          App operativa
        </Link>
        </nav>
      )}
    </header>
  );
}

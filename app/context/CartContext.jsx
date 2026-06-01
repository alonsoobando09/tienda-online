"use client";
import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  /* =========================
  AGREGAR
  ========================= */
  function addToCart(product, options = {}) {
    setCart((prev) => {
      const presentacion = options.presentacion || product.presentacion || "unidad";
      const precioBase =
        options.precio ??
        (presentacion === "paca"
          ? product.precioPacaDetal || product.precioDetal || product.precio || 0
          : product.precioDetal || product.precio || 0);
      const cartId = `${product.id}-${presentacion}`;
      const normalized = {
        ...product,
        id: cartId,
        productoId: product.id,
        presentacion,
        unidadesPorPaca: Number(product.unidadesPorPaca || 0),
        precioDetal: Number(precioBase || 0),
        precioMayor: Number(product.precioMayor || product.precioDetal || 0),
      };
      const existe = prev.find((p) => p.id === cartId);

      if (existe) {
        return prev.map((p) =>
          p.id === cartId
            ? { ...p, cantidad: (p.cantidad || 1) + 1 }
            : p
        );
      }

      return [...prev, { ...normalized, cantidad: 1 }];
    });
  }

  function increaseQuantity(id) {
    setCart((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, cantidad: (p.cantidad || 1) + 1 } : p
      )
    );
  }

  function decreaseQuantity(id) {
    setCart((prev) =>
      prev
        .map((p) =>
          p.id === id
            ? { ...p, cantidad: Math.max((p.cantidad || 1) - 1, 0) }
            : p
        )
        .filter((p) => (p.cantidad || 0) > 0)
    );
  }

  function updateQuantity(id, cantidad) {
    const nextQuantity = Math.max(Number(cantidad) || 0, 0);

    setCart((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, cantidad: nextQuantity } : p))
        .filter((p) => (p.cantidad || 0) > 0)
    );
  }

  /* =========================
  ELIMINAR
  ========================= */
  function removeFromCart(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function removeFromCartById(id) {
    setCart((prev) => prev.filter((p) => p.id !== id));
  }

  /* =========================
  VACIAR
  ========================= */
  function clearCart() {
    setCart([]);
  }

  /* =========================
  CÁLCULOS
  ========================= */
  const total = cart.reduce(
    (acc, p) => acc + p.precioDetal * p.cantidad,
    0
  );

  const isMayorista = total >= 200000;

  const descuento =
    total >= 1000000 ? total * 0.05 : 0;

  /* =========================
  PROVIDER
  ========================= */
  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        updateQuantity,
        removeFromCart,
        removeFromCartById,
        clearCart,
        total,
        descuento,
        isMayorista,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

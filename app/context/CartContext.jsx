"use client";
import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  /* =========================
  AGREGAR
  ========================= */
  function addToCart(product) {
    setCart((prev) => {
      const existe = prev.find((p) => p.nombre === product.nombre);

      if (existe) {
        return prev.map((p) =>
          p.nombre === product.nombre
            ? { ...p, cantidad: (p.cantidad || 1) + 1 }
            : p
        );
      }

      return [...prev, { ...product, cantidad: 1 }];
    });
  }

  /* =========================
  ELIMINAR
  ========================= */
  function removeFromCart(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
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
        removeFromCart,
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

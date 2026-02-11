"use client";
import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

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


  function removeFromCart(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function clearCart() {
    setCart([]);
  }

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

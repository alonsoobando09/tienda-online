"use client";

import { useCart } from "../context/CartContext";

export default function AddToCart({ product }) {
  const { addToCart } = useCart();

  return (
    <button
      onClick={() => addToCart(product)}
      className="bg-green-600 text-white px-4 py-2 rounded"
    >
      Agregar al carrito
    </button>
  );
}

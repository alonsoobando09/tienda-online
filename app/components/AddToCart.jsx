"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext";

export default function AddToCart({ product }) {
  const { cart, addToCart, decreaseQuantity, increaseQuantity } = useCart();
  const item = cart.find((p) => p.id === product.id);

  if (item) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr 40px",
          alignItems: "center",
          gap: 8,
          marginTop: 10,
        }}
      >
        <button
          aria-label="Disminuir cantidad"
          onClick={() => decreaseQuantity(product.id)}
          style={qtyButton}
        >
          <Minus size={16} />
        </button>

        <strong style={{ textAlign: "center" }}>{item.cantidad || 1}</strong>

        <button
          aria-label="Aumentar cantidad"
          onClick={() => increaseQuantity(product.id)}
          style={qtyButton}
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => addToCart(product)} style={addButton}>
      <ShoppingCart size={17} />
      Agregar
    </button>
  );
}

const addButton = {
  width: "100%",
  marginTop: 10,
  background: "#1B4332",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "10px 12px",
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const qtyButton = {
  width: 40,
  height: 38,
  display: "grid",
  placeItems: "center",
  background: "#e9efe9",
  color: "#1B4332",
  border: "1px solid #cbd8d0",
  borderRadius: 8,
  cursor: "pointer",
};

"use client";

import { CartProvider } from "./components/CartContext";

export default function Providers({ children }) {
  return <CartProvider>{children}</CartProvider>;
}

"use client";

import { AuthProvider } from "@/lib/authContext";
import { CartProvider } from "./context/CartContext";
import ErrorReporter from "./components/ErrorReporter";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <ErrorReporter />
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

"use client";

import { AuthProvider } from "@/lib/authContext";
import { CartProvider } from "./context/CartContext";
import ErrorReporter from "./components/ErrorReporter";
import PwaRuntime from "./components/PwaRuntime";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <ErrorReporter />
      <PwaRuntime />
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

"use client";

import { AuthProvider } from "@/lib/authContext";
import { CartProvider } from "./context/CartContext";
import ErrorReporter from "./components/ErrorReporter";
import OperationalHistoryGuard from "./components/OperationalHistoryGuard";
import PwaRuntime from "./components/PwaRuntime";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <ErrorReporter />
      <OperationalHistoryGuard />
      <PwaRuntime />
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

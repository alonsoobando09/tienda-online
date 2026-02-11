"use client";
import { useAuth } from "@/app/context/AuthContext";

export default function AdminGuard({ children }) {
  const { user } = useAuth();

  if (user.role !== "admin") {
    return <p>⛔ Acceso restringido</p>;
  }

  return children;
}

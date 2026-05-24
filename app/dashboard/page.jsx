"use client";

import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push("/login");
  }, [router, user]);

  if (!user) return <p>Cargando...</p>;

  return <h1>Bienvenido al Dashboard</h1>;
}

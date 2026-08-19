"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getRoleHome, getUserProfile, normalizeRole } from "@/lib/authRoles";
import { canAccessRole } from "@/lib/permissions";

export default function AdminGuard({ allowedRoles = ["admin"], children }) {
  const router = useRouter();
  const allowedKey = allowedRoles.join("|");

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const allowed = allowedKey.split("|").map(normalizeRole);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const profile = await getUserProfile(user);

        if (!user || !profile.allowed || !canAccessRole(profile.role, allowed)) {
          localStorage.removeItem("admin");
          router.replace(user ? getRoleHome(profile.role) : "/login");
          return;
        }

        if (profile.isAdmin) {
          localStorage.setItem("admin", "true");
          localStorage.setItem("adminEmail", user.email || "");
        }

        localStorage.setItem("userRole", profile.role);
        localStorage.setItem("userEmail", user.email || "");
        localStorage.setItem("empresaId", profile.empresaId || "proveedor-central");
        setAuthorized(true);
      } catch (error) {
        console.error(error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [allowedKey, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 22,
          fontWeight: "bold",
        }}
      >
        Verificando acceso...
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return children;
}

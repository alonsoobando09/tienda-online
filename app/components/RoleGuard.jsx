"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { getRoleHome, getUserProfile, normalizeRole } from "@/lib/authRoles";

export default function RoleGuard({ allowedRoles = [], children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const allowed = allowedRoles.map(normalizeRole);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const profile = await getUserProfile(user);

        if (!user) {
          router.push("/login");
          return;
        }

        if (!profile.allowed || !allowed.includes(profile.role)) {
          router.push(getRoleHome(profile.role));
          return;
        }

        localStorage.setItem("userRole", profile.role);
        localStorage.setItem("userEmail", profile.email || "");
        setAuthorized(true);
      } catch (error) {
        console.error("Error verificando rol:", error);
        router.push("/login");
      } finally {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [allowedRoles, router]);

  if (checking) {
    return (
      <div className="access-screen">
        <strong>Verificando acceso...</strong>
        <span>Estamos preparando tu panel de trabajo.</span>
      </div>
    );
  }

  if (!authorized) return null;

  return children;
}

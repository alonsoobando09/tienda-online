"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/authRoles";
import { usePathname, useRouter } from "next/navigation";

const bodegaRoutes = ["/admin/despachos", "/admin/recepciones", "/admin/inventario"];

function canOpenAdminRoute(profile, pathname) {
  if (profile.isAdmin) return true;

  if (profile.role === "bodega") {
    return bodegaRoutes.some((route) => pathname.startsWith(route));
  }

  return false;
}

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoginPage) {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    setAuthorized(false);
    setChecking(true);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const profile = await getUserProfile(user);

        if (!user || !profile.allowed || !canOpenAdminRoute(profile, pathname)) {
          setAuthorized(false);
          router.push(user ? "/" : "/login");
          return;
        }

        setAuthorized(true);
      } finally {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [isLoginPage, pathname, router]);

  if (checking) return <p>Verificando acceso...</p>;

  if (!authorized) return null;

  return children;
}

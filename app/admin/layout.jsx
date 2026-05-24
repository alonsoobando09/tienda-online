"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminUser } from "@/lib/isAdminUser";
import { usePathname, useRouter } from "next/navigation";

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
        const isAdmin = await isAdminUser(user);

        if (!isAdmin) {
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
  }, [isLoginPage, router]);

  if (checking) return <p>Verificando acceso...</p>;

  if (!authorized) return null;

  return children;
}

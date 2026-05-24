"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminUser } from "@/lib/isAdminUser";

export default function AdminGuard({ children }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const isAdmin = await isAdminUser(user);

        if (!isAdmin) {
          localStorage.removeItem("admin");
          router.push(user ? "/" : "/login");
          return;
        }

        localStorage.setItem("admin", "true");
        localStorage.setItem("adminEmail", user.email || "");
        setAuthorized(true);
      } catch (error) {
        console.error(error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

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

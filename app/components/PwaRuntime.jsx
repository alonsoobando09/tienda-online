"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOperationalPath } from "@/lib/routeZones";

export default function PwaRuntime() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (standalone && !isOperationalPath(window.location.pathname)) {
      router.replace("/app");
    }
  }, [pathname, router]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("No se pudo registrar el service worker:", error);
    });
  }, []);

  return null;
}

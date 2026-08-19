"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOperationalPath } from "@/lib/routeZones";

export default function OperationalHistoryGuard() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  useEffect(() => {
    if (!isOperationalPath(pathname)) return;

    window.history.replaceState(
      { ...(window.history.state || {}), proveedorCentralZone: "operational" },
      "",
      window.location.href
    );

    const keepInsideOperationalApp = () => {
      if (!isOperationalPath(window.location.pathname)) {
        router.replace("/app");
      }
    };

    window.addEventListener("popstate", keepInsideOperationalApp);
    return () => window.removeEventListener("popstate", keepInsideOperationalApp);
  }, [pathname, router]);

  return null;
}

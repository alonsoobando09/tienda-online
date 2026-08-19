"use client";

import { usePathname } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { isOperationalPath } from "@/lib/routeZones";

export default function PosButton() {
  const pathname = usePathname();

  if (isOperationalPath(pathname)) return null;

  function activarPOS() {
    document.documentElement.requestFullscreen();
  }

  return (
    <button className="floating-pos" onClick={activarPOS} type="button">
      <ReceiptText size={18} />
      <span>Modo POS</span>
    </button>
  );
}

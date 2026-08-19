"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { isOperationalPath } from "@/lib/routeZones";

export default function WhatsappButton() {
  const pathname = usePathname();

  if (isOperationalPath(pathname)) return null;

  return (
    <a
      aria-label="Comprar por WhatsApp"
      className="floating-whatsapp"
      href="https://wa.me/573132752493"
      target="_blank"
    >
      <MessageCircle size={24} />
    </a>
  );
}

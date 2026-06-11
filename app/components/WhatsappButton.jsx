"use client";

import { MessageCircle } from "lucide-react";

export default function WhatsappButton() {
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

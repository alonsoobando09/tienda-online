"use client";

import { ReceiptText } from "lucide-react";

export default function PosButton() {
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

"use client";

export default function PosButton() {

  const activarPOS = () => {
    document.documentElement.requestFullscreen();
  };

  return (
    <button
      onClick={activarPOS}
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 999,
        background: "#111",
        color: "#fff",
        border: "none",
        padding: "12px 18px",
        borderRadius: 10,
        cursor: "pointer",
      }}
    >
      🧾 Modo POS
    </button>
  );
}
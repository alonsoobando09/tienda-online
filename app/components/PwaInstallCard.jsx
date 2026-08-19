"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

function isStandaloneApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function PwaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setMessage("");
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("App instalada correctamente.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      setMessage("En Chrome toca los 3 puntos y elige Instalar app o Agregar a pantalla principal.");
      return;
    }

    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const alreadyStandalone =
    typeof window !== "undefined" && isStandaloneApp();

  if (installed || alreadyStandalone) {
    return (
      <div className="pc-install-card installed">
        <Smartphone size={20} />
        <span>Proveedor Central ya esta instalado en este dispositivo.</span>
      </div>
    );
  }

  return (
    <div className="pc-install-card">
      <div>
        <strong>Descargar app</strong>
        <span>Instalala en Android, tablet o computador desde este boton.</span>
        {message && <small>{message}</small>}
      </div>
      <button type="button" onClick={installApp}>
        <Download size={18} />
        Instalar
      </button>
    </div>
  );
}

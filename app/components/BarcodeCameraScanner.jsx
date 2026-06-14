"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

export default function BarcodeCameraScanner({ onDetected }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const detectorRef = useRef(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [streamReady, setStreamReady] = useState(false);

  function stopScanner() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setStreamReady(false);
    setActive(false);
  }

  const scanFrame = useCallback(async function scanFrame() {
    const video = videoRef.current;
    const detector = detectorRef.current;

    if (!video || !detector || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const codes = await detector.detect(video);
      const code = codes?.[0]?.rawValue;

      if (code) {
        onDetected(code);
        setMessage(`Codigo detectado: ${code}`);
        stopScanner();
        return;
      }
    } catch {
      setMessage("No se pudo leer el codigo. Acerca mejor la camara.");
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  }, [onDetected]);

  async function startScanner() {
    setMessage("");

    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setMessage("Este navegador no permite leer codigos con camara. Usa el lector fisico o escribe el codigo.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Este dispositivo no permite abrir la camara desde el navegador.");
      return;
    }

    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: [
          "ean_13",
          "ean_8",
          "code_128",
          "code_39",
          "code_93",
          "upc_a",
          "upc_e",
          "itf",
        ],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;
      setStreamReady(true);
      setActive(true);
    } catch {
      setMessage("No se pudo abrir la camara. Revisa permisos del navegador.");
      stopScanner();
    }
  }

  useEffect(() => {
    if (!active || !streamReady || !streamRef.current || !videoRef.current) return;

    let mounted = true;
    const video = videoRef.current;
    video.srcObject = streamRef.current;

    video
      .play()
      .then(() => {
        if (mounted) frameRef.current = requestAnimationFrame(scanFrame);
      })
      .catch(() => {
        setMessage("La camara abrio, pero el video no pudo iniciar. Toca cerrar y abrir de nuevo.");
      });

    return () => {
      mounted = false;
    };
  }, [active, scanFrame, streamReady]);

  useEffect(() => stopScanner, []);

  return (
    <div className="camera-scanner">
      <button
        className="admin-button secondary"
        onClick={active ? stopScanner : startScanner}
        type="button"
      >
        {active ? <X size={18} /> : <Camera size={18} />}
        {active ? "Cerrar camara" : "Leer con camara"}
      </button>

      {active && (
        <div className="camera-scanner-preview">
          <video muted playsInline ref={videoRef} />
          <span>Apunta al codigo de barras</span>
        </div>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}

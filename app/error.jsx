"use client";

import { useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { logClientError } from "@/lib/errorLogger";

export default function AppError({ error, reset }) {
  useEffect(() => {
    logClientError(error, {
      area: "next-error-boundary",
    });
  }, [error]);

  return (
    <main className="access-screen">
      <strong>Algo no cargo bien</strong>
      <span>El error quedo registrado para revision.</span>
      <button className="admin-button" onClick={reset} type="button">
        <RefreshCcw size={18} />
        Intentar de nuevo
      </button>
    </main>
  );
}

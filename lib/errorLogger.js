"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_EMPRESA_ID } from "@/lib/tenant";

function normalizeError(error) {
  if (!error) {
    return {
      message: "Error desconocido",
      stack: "",
      name: "Error",
    };
  }

  return {
    message: String(error.message || error.reason || error),
    stack: String(error.stack || ""),
    name: String(error.name || "Error"),
  };
}

export async function logClientError(error, context = {}) {
  try {
    const normalized = normalizeError(error);

    await addDoc(collection(db, "erroresSistema"), {
      ...normalized,
      area: context.area || "cliente",
      modulo: context.modulo || "",
      empresaId:
        context.empresaId ||
        localStorage.getItem("empresaId") ||
        DEFAULT_EMPRESA_ID,
      userRole: localStorage.getItem("userRole") || "",
      userEmail: localStorage.getItem("userEmail") || "",
      path:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "",
      createdAt: serverTimestamp(),
    });
  } catch (loggingError) {
    console.error("No se pudo registrar el error:", loggingError);
  }
}

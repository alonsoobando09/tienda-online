"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_EMPRESA_ID } from "@/lib/tenant";

function safeStorage(key) {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) || "";
}

function getPath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

function getModulo(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  if (!parts.length) return "inicio";
  if (parts[0] === "admin") return parts[1] ? `admin/${parts[1]}` : "admin";
  return parts[0];
}

function getFingerprint(error, context, path) {
  const base = [
    context.area || "cliente",
    context.modulo || getModulo(path),
    error.name,
    error.message,
    path,
  ].join("|");

  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = (hash << 5) - hash + base.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

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
    stack: String(error.stack || "").slice(0, 6000),
    name: String(error.name || "Error"),
  };
}

export async function logClientError(error, context = {}) {
  try {
    const normalized = normalizeError(error);
    const path = getPath();
    const modulo = context.modulo || getModulo(path);
    const empresaId = context.empresaId || safeStorage("empresaId") || DEFAULT_EMPRESA_ID;

    await addDoc(collection(db, "erroresSistema"), {
      ...normalized,
      area: context.area || "cliente",
      modulo,
      empresaId,
      fingerprint: getFingerprint(normalized, context, path),
      severity:
        context.severity ||
        (context.area === "next-error-boundary" ? "critical" : "error"),
      estado: "abierto",
      appEnv: process.env.NEXT_PUBLIC_APP_ENV || "production",
      userRole: safeStorage("userRole"),
      userEmail: safeStorage("userEmail"),
      path,
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : "",
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      language: typeof navigator !== "undefined" ? navigator.language : "",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "",
      context,
      createdAt: serverTimestamp(),
    });
  } catch (loggingError) {
    console.error("No se pudo registrar el error:", loggingError);
  }
}

"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/errorLogger";

export default function ErrorReporter() {
  useEffect(() => {
    function onError(event) {
      logClientError(event.error || event.message, {
        area: "window.onerror",
      });
    }

    function onUnhandledRejection(event) {
      logClientError(event.reason, {
        area: "unhandledrejection",
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

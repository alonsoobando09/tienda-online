"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useState } from "react";
import { getCurrentEmpresaId } from "./tenant";

export function useEmpleados(empresaIdOverride = "") {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const empresaId = empresaIdOverride || getCurrentEmpresaId();
    const q = query(collection(db, "empleados"), where("empresaId", "==", empresaId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

        setEmpleados(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error cargando empleados:", error);
        setEmpleados([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [empresaIdOverride]);

  return { empleados, loading };
}

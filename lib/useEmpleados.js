"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useState } from "react";

export function useEmpleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "empleados"), orderBy("nombre", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setEmpleados(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { empleados, loading };
}

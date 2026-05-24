"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useState } from "react";
import { useVentas } from "@/lib/useVentas";

export function useVentas() {
  const [ventas, setVentas] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ventas"), (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setVentas(data);
    });

    return () => unsub();
  }, []);

  return ventas;
}

export default function Dashboard() {
  const ventas = useVentas();

  const total = ventas.reduce((acc, v) => acc + v.total, 0);
  const fiado = ventas
    .filter((v) => v.pago === "fiado")
    .reduce((acc, v) => acc + v.total, 0);

  return (
    <div>
      <h1>Dashboard</h1>

      <p>Total Ventas: ${total}</p>
      <p>Total Fiado: ${fiado}</p>
      <p>Cantidad Ventas: {ventas.length}</p>
    </div>
  );
}

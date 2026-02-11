"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Profile() {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, "pedidos"));
      const snap = await getDocs(q);
      setPedidos(snap.docs.map(d => d.data()));
    };
    load();
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>👤 Mi cuenta</h1>

      <h3>🧾 Historial de compras</h3>
      {pedidos.map((p, i) => (
        <div key={i}>
          Pedido #{i + 1} – ${p.total}
        </div>
      ))}
    </main>
  );
}

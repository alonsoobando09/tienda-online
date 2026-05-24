"use client";

import { useSearchParams } from "next/navigation";

export default function GraciasPage() {
  const params = useSearchParams();
  const id = params.get("id");

  return (
    <main style={{ padding: 40 }}>
      <h1>Compra exitosa</h1>
      <p>Tu factura fue generada correctamente.</p>
      <p>ID de factura: {id}</p>
    </main>
  );
}

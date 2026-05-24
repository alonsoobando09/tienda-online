"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function PagoPage() {
  const { id } = useParams();
  const [factura, setFactura] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function prepararPago() {
      try {
        const facturaRes = await fetch(`/api/admin/facturas/${id}`);
        if (!facturaRes.ok) throw new Error("No se encontró la factura");
        const facturaData = await facturaRes.json();

        if (!active) return;
        setFactura(facturaData);

        const pagoRes = await fetch("/api/mercadopago/preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factura: facturaData }),
        });
        const pagoData = await pagoRes.json();

        if (!pagoRes.ok) {
          throw new Error(pagoData.error || "No se pudo crear el pago");
        }

        if (active) setPayment(pagoData);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) prepararPago();

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>
      <h1>Pago online</h1>

      {loading && <p>Preparando pago seguro...</p>}
      {error && (
        <div style={{ background: "#fee2e2", padding: 16, borderRadius: 8 }}>
          {error}
        </div>
      )}

      {factura && (
        <section style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h2>{factura.numero}</h2>
          <p>Cliente: {factura.cliente?.nombre}</p>
          <p>Total: {money.format(factura.total || 0)}</p>
        </section>
      )}

      {payment?.init_point && (
        <a
          href={payment.init_point}
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "14px 18px",
            borderRadius: 8,
            background: "#009ee3",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          Pagar con Mercado Pago
        </a>
      )}
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/context/CartContext";
import { generarFacturaTermica } from "@/lib/generarFacturaTermica";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, descuento, clearCart } = useCart();

  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
    ciudad: "Bogotá",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validar = () => {
    if (!form.nombre.trim()) return "El nombre es obligatorio";
    if (!form.telefono.trim()) return "El teléfono es obligatorio";
    if (!form.direccion.trim()) return "La dirección es obligatoria";
    if (cart.length === 0) return "El carrito está vacío";
    return "";
  };

  /* =====================================================
     CHECKOUT CENTRAL PROFESIONAL
  ===================================================== */

  const procesarCheckout = async (tipoPago = "contado") => {
    const errorValidacion = validar();
    if (errorValidacion) {
      setError(errorValidacion);
      return null;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: form,
          cart,
          descuento,
          tipoPago,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error procesando pedido");
      }

      const data = await res.json();

      clearCart();

      return data;

    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /* ================= WHATSAPP ================= */

  const finalizarWhatsApp = async () => {
    const data = await procesarCheckout("whatsapp");
    if (!data) return;

    const productosTexto = data.factura.productos
      .map(
        (p) =>
          `• ${p.nombre} x${p.cantidad} — $${p.total.toLocaleString()}`
      )
      .join("\n");

    const mensaje = encodeURIComponent(
`🧾 Pedido ${data.numero}

👤 ${data.factura.cliente.nombre}
📞 ${data.factura.cliente.telefono}
📍 ${data.factura.cliente.direccion}
🏙️ ${data.factura.cliente.ciudad}

${productosTexto}

💵 TOTAL: $${data.factura.total.toLocaleString()}`
    );

    window.open(`https://wa.me/573249111150?text=${mensaje}`, "_blank");
  };

  /* ================= PAGO ONLINE ================= */

  const pagarOnline = async () => {
    const data = await procesarCheckout("online");
    if (!data) return;

    router.push(`/pago/${data.id}`);
  };

  /* ================= IMPRIMIR ================= */

  const imprimirFactura = async () => {
    const data = await procesarCheckout("contado");
    if (!data) return;

    generarFacturaTermica(data.factura);
  };

  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>🧾 Checkout Profesional</h1>

      <div style={grid}>
        <input name="nombre" placeholder="Nombre completo" onChange={handleChange} style={input} />
        <input name="telefono" placeholder="Teléfono" onChange={handleChange} style={input} />
        <input name="direccion" placeholder="Dirección" onChange={handleChange} style={input} />
        <select name="ciudad" onChange={handleChange} style={input}>
          <option>Bogotá</option>
          <option>Soacha</option>
          <option>Chía</option>
          <option>Cajicá</option>
        </select>
      </div>

      {error && <p style={{ color: "red" }}>⚠ {error}</p>}

      <button onClick={finalizarWhatsApp} style={btnWhatsapp}>WhatsApp</button>
      <button onClick={pagarOnline} style={btnPago}>💳 Pagar online</button>
      <button onClick={imprimirFactura} style={btnPdf}>🖨 Imprimir</button>

      {loading && <p>Procesando pedido...</p>}
    </main>
  );
}

/* ESTILOS */
const grid = { display: "grid", gap: 15, maxWidth: 400 };
const input = { padding: 12, borderRadius: 8, border: "1px solid #ccc" };

const btnWhatsapp = { marginTop: 20, background: "#25D366", color: "white", padding: 15, borderRadius: 10, border: "none" };
const btnPago = { marginTop: 10, background: "#111", color: "#fff", padding: 15, borderRadius: 10, border: "none" };
const btnPdf = { marginTop: 10, background: "#6366f1", color: "#fff", padding: 15, borderRadius: 10, border: "none" };
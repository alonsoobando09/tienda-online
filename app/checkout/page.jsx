"use client";

import { useState } from "react";
import { useCart } from "@/app/context/CartContext";
import { generarPDFPedido } from "@/app/lib/generarPDF";

export default function CheckoutPage() {
  const { cart, total, descuento } = useCart();

  /* =========================
     STATE FORM
  ========================= */
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
    ciudad: "Bogotá",
  });

  const [error, setError] = useState("");

  /* =========================
     ENVÍO
  ========================= */
  const envio = cart.length >= 8 ? 0 : 8000;
  const totalFinal = total - descuento + envio;

  /* =========================
     HANDLE INPUT
  ========================= */
  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  /* =========================
     VALIDAR
  ========================= */
  function validar() {
    if (!form.nombre) return "El nombre es obligatorio";
    if (!form.telefono) return "El teléfono es obligatorio";
    if (!form.direccion) return "La dirección es obligatoria";
    if (cart.length === 0) return "El carrito está vacío";
    return "";
  }

  /* =========================
     WHATSAPP
  ========================= */
  function finalizarWhatsApp() {
    const errorValidacion = validar();

    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setError("");

    const productosTexto = cart
      .map(
        (p) =>
          `• ${p.nombre} x${p.cantidad} — $${(
            p.precioDetal * p.cantidad
          ).toLocaleString()}`
      )
      .join("\n");

    const mensaje = encodeURIComponent(
      `🧾 *NUEVO PEDIDO*

👤 Cliente: ${form.nombre}
📞 Teléfono: ${form.telefono}
📍 Dirección: ${form.direccion}
🏙️ Ciudad: ${form.ciudad}

🛒 PRODUCTOS:
${productosTexto}

💰 Subtotal: $${total.toLocaleString()}
🏷️ Descuento: -$${descuento.toLocaleString()}
🚚 Envío: $${envio.toLocaleString()}

💵 *TOTAL: $${totalFinal.toLocaleString()}*`
    );

    const link = `https://wa.me/573249111150?text=${mensaje}`;
    window.open(link, "_blank");
  }

  /* =========================
     PAGO ONLINE (API)
  ========================= */
  async function pagarOnline() {
    const errorValidacion = validar();

    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setError("");

    try {
      const res = await fetch("/api/pago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          total: totalFinal,
          cliente: form.nombre,
        }),
      });

      const data = await res.json();

      alert("Pago creado: " + data.id);
    } catch (err) {
      console.error(err);
      alert("Error creando el pago");
    }
  }

  /* =========================
     UI
  ========================= */
  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>🧾 Checkout</h1>

      {/* ================= FORM ================= */}
      <div style={grid}>
        <input
          name="nombre"
          placeholder="Nombre completo"
          onChange={handleChange}
          style={input}
        />

        <input
          name="telefono"
          placeholder="Teléfono"
          onChange={handleChange}
          style={input}
        />

        <input
          name="direccion"
          placeholder="Dirección"
          onChange={handleChange}
          style={input}
        />

        <select name="ciudad" onChange={handleChange} style={input}>
          <option>Bogotá</option>
          <option>Soacha</option>
          <option>Chía</option>
          <option>Cajicá</option>
        </select>
      </div>

      {/* ERROR */}
      {error && (
        <p style={{ color: "red", marginTop: 10 }}>⚠ {error}</p>
      )}

      {/* ================= RESUMEN ================= */}
      <h2 style={{ marginTop: 40 }}>🛒 Resumen</h2>

      {cart.map((p, i) => (
        <div key={i} style={card}>
          {p.nombre} x{p.cantidad} — $
          {(p.precioDetal * p.cantidad).toLocaleString()}
        </div>
      ))}

      <hr />

      <p>Subtotal: ${total.toLocaleString()}</p>
      <p>Descuento: -${descuento.toLocaleString()}</p>
      <p>Envío: ${envio.toLocaleString()}</p>

      <h2>Total final: ${totalFinal.toLocaleString()}</h2>

      {/* ================= BOTONES ================= */}

      <button onClick={finalizarWhatsApp} style={btnWhatsapp}>
        Finalizar por WhatsApp
      </button>

      <button onClick={pagarOnline} style={btnPago}>
        💳 Pagar online
      </button>

      <button
        onClick={() =>
          generarPDFPedido({
            cliente: form.nombre,
            telefono: form.telefono,
            direccion: form.direccion,
            ciudad: form.ciudad,
            cart,
            total,
            descuento,
            envio,
            totalFinal,
          })
        }
        style={btnPdf}
      >
        Descargar PDF
      </button>
    </main>
  );
}

/* ================= ESTILOS ================= */

const grid = {
  display: "grid",
  gap: 15,
  maxWidth: 400,
};

const input = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid #ccc",
};

const card = {
  background: "#fff",
  padding: 10,
  marginBottom: 8,
  borderRadius: 8,
};

const btnWhatsapp = {
  marginTop: 20,
  background: "#25D366",
  color: "white",
  padding: 15,
  borderRadius: 10,
  border: "none",
  fontWeight: "bold",
  cursor: "pointer",
};

const btnPago = {
  marginTop: 10,
  marginLeft: 10,
  background: "#111",
  color: "#fff",
  padding: 15,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
};

const btnPdf = {
  marginTop: 10,
  marginLeft: 10,
  background: "#6366f1",
  color: "#fff",
  padding: 15,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
};
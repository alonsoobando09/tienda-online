"use client";

import { useCart } from "@/app/context/CartContext";
import Link from "next/link";

export default function CarritoPage() {
  const {
    cart,
    removeFromCart,
    clearCart,
    isMayorista,
    descuento,
  } = useCart();

  /* ================= SUBTOTAL ================= */
  const total = cart.reduce(
    (acc, p) => acc + p.precioDetal * p.cantidad,
    0
  );

  /* ================= ENVÍO ================= */
  const envioBogota = cart.length >= 8 ? 0 : 8000;

  /* ================= TOTAL FINAL ================= */
  const totalFinal = total - descuento + envioBogota;

  /* ================= WHATSAPP ================= */
  const mensaje = encodeURIComponent(
    cart
      .map(
        (p) =>
          `• ${p.nombre} x${p.cantidad} — $${(
            p.precioDetal * p.cantidad
          ).toLocaleString()}`
      )
      .join("\n") +
      `\n\nSubtotal: $${total.toLocaleString()}` +
      `\nDescuento: -$${descuento.toLocaleString()}` +
      `\nEnvío: $${envioBogota.toLocaleString()}` +
      `\nTOTAL: $${totalFinal.toLocaleString()}`
  );

  return (
    <main style={{ padding: 40 }}>
      <h1>🛒 Tu carrito</h1>

      {cart.length === 0 ? (
        <p>Tu carrito está vacío</p>
      ) : (
        <>
          {/* MENSAJES */}
          {total < 200000 && (
            <p style={{ color: "#f97316" }}>
              👉 Te faltan $
              {(200000 - total).toLocaleString()} para activar
              precio mayorista
            </p>
          )}

          {isMayorista && total < 1000000 && (
            <p style={{ color: "#22c55e" }}>
              🎉 Precio MAYORISTA activo
            </p>
          )}

          {total >= 1000000 && (
            <p style={{ color: "#6366f1" }}>
              💎 Descuento empresarial aplicado
            </p>
          )}

          {/* PRODUCTOS */}
          {cart.map((p, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                padding: 15,
                marginBottom: 10,
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{p.nombre}</strong>
                <p>
                  {p.cantidad} x $
                  {p.precioDetal.toLocaleString()}
                </p>
              </div>

              <button onClick={() => removeFromCart(i)}>
                ❌
              </button>
            </div>
          ))}

          <hr />

          <p>Subtotal: ${total.toLocaleString()}</p>
          <p>
            Descuento: -$
            {descuento.toLocaleString()}
          </p>
          <p>
            Envío Bogotá: $
            {envioBogota.toLocaleString()}
          </p>

          <h2>
            Total final: $
            {totalFinal.toLocaleString()}
          </h2>

          <Link href="/checkout">
            <button style={{ padding: 14, marginTop: 20 }}>
              Continuar al pago
            </button>
          </Link>
        </>
      )}

      {/* WHATSAPP */}
      {cart.length > 0 && (
        <a
          href={`https://wa.me/573249111150?text=${mensaje}`}
          target="_blank"
          style={{
            display: "inline-block",
            marginTop: 20,
            background: "#25D366",
            color: "white",
            padding: 12,
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Finalizar pedido por WhatsApp
        </a>
      )}

      <br />

      {cart.length > 0 && (
        <button
          onClick={clearCart}
          style={{ marginTop: 15 }}
        >
          Vaciar carrito
        </button>
      )}
    </main>
  );
}

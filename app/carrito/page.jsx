"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function CarritoPage() {
  const {
    cart,
    clearCart,
    decreaseQuantity,
    descuento,
    increaseQuantity,
    isMayorista,
    removeFromCartById,
    updateQuantity,
  } = useCart();

  const total = cart.reduce(
    (acc, p) => acc + (Number(p.precioDetal) || 0) * (p.cantidad || 1),
    0
  );
  const totalItems = cart.reduce((acc, p) => acc + (p.cantidad || 1), 0);
  const envioBogota = totalItems >= 8 ? 0 : 8000;
  const totalFinal = total - descuento + envioBogota;

  const mensaje = encodeURIComponent(
    cart
      .map(
        (p) =>
          `- ${p.nombre} x${p.cantidad} - ${money.format(
            (Number(p.precioDetal) || 0) * (p.cantidad || 1)
          )} (${p.presentacion || "unidad"})`
      )
      .join("\n") +
      `\n\nSubtotal: ${money.format(total)}` +
      `\nDescuento: -${money.format(descuento)}` +
      `\nEnvio: ${money.format(envioBogota)}` +
      `\nTOTAL: ${money.format(totalFinal)}`
  );

  return (
    <main style={{ padding: 40 }}>
      <h1>Tu carrito</h1>

      {cart.length === 0 ? (
        <section style={emptyBox}>
          <p>Tu carrito está vacío.</p>
          <Link href="/">Volver a la tienda</Link>
        </section>
      ) : (
        <>
          {total < 200000 && (
            <p style={{ color: "#b45309" }}>
              Te faltan {money.format(200000 - total)} para activar precio
              mayorista.
            </p>
          )}

          {isMayorista && total < 1000000 && (
            <p style={{ color: "#15803d" }}>Precio mayorista activo.</p>
          )}

          {total >= 1000000 && (
            <p style={{ color: "#4338ca" }}>Descuento empresarial aplicado.</p>
          )}

          <section style={{ display: "grid", gap: 12 }}>
            {cart.map((p) => (
              <article key={p.id} style={itemBox}>
                <div>
                  <strong>{p.nombre}</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    {money.format(p.precioDetal || 0)}{" "}
                    {p.presentacion === "paca" ? "por paca" : "por unidad"}
                  </p>
                  {p.presentacion === "paca" && p.unidadesPorPaca > 0 && (
                    <small>{p.unidadesPorPaca} unidades por paca</small>
                  )}
                </div>

                <div style={quantityBox}>
                  <button onClick={() => decreaseQuantity(p.id)} style={qtyBtn}>
                    <Minus size={16} />
                  </button>
                  <input
                    min="1"
                    type="number"
                    value={p.cantidad || 1}
                    onChange={(e) => updateQuantity(p.id, e.target.value)}
                    style={qtyInput}
                  />
                  <button onClick={() => increaseQuantity(p.id)} style={qtyBtn}>
                    <Plus size={16} />
                  </button>
                </div>

                <strong>{money.format((p.precioDetal || 0) * (p.cantidad || 1))}</strong>

                <button
                  aria-label="Eliminar producto"
                  onClick={() => removeFromCartById(p.id)}
                  style={deleteBtn}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </section>

          <section style={summaryBox}>
            <p>Subtotal: {money.format(total)}</p>
            <p>Descuento: -{money.format(descuento)}</p>
            <p>Envío Bogotá: {money.format(envioBogota)}</p>
            <h2>Total final: {money.format(totalFinal)}</h2>

            <Link href="/checkout">
              <button style={checkoutBtn}>Continuar al pago</button>
            </Link>

            <a
              href={`https://wa.me/573132752493?text=${mensaje}`}
              target="_blank"
              style={whatsappBtn}
            >
              Finalizar pedido por WhatsApp
            </a>

            <button onClick={clearCart} style={clearBtn}>
              Vaciar carrito
            </button>
          </section>
        </>
      )}
    </main>
  );
}

const emptyBox = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
};

const itemBox = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto auto",
  alignItems: "center",
  gap: 14,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 14,
};

const quantityBox = {
  display: "grid",
  gridTemplateColumns: "38px 64px 38px",
  gap: 6,
  alignItems: "center",
};

const qtyBtn = {
  height: 38,
  border: "1px solid #cbd8d0",
  borderRadius: 8,
  background: "#e9efe9",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const qtyInput = {
  height: 38,
  border: "1px solid #cbd8d0",
  borderRadius: 8,
  textAlign: "center",
};

const deleteBtn = {
  height: 38,
  width: 38,
  border: "none",
  borderRadius: 8,
  background: "#fee2e2",
  color: "#991b1b",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const summaryBox = {
  marginTop: 20,
  background: "#fff",
  borderRadius: 8,
  padding: 18,
  border: "1px solid #e5e7eb",
};

const checkoutBtn = {
  display: "block",
  width: "100%",
  padding: 14,
  marginTop: 14,
  border: "none",
  borderRadius: 8,
  background: "#111827",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const whatsappBtn = {
  display: "block",
  marginTop: 10,
  background: "#25D366",
  color: "white",
  padding: 12,
  borderRadius: 8,
  textAlign: "center",
  textDecoration: "none",
  fontWeight: "bold",
};

const clearBtn = {
  marginTop: 12,
  background: "transparent",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 12px",
  cursor: "pointer",
};

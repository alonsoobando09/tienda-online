"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";

const estados = [
  "guardada",
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "liquidada",
  "cancelado",
];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  return money.format(Number(value) || 0);
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  return `57${digits.slice(-10)}`;
}

function buildReceiptLines(factura) {
  const productos = factura.productos || [];
  const cliente = factura.cliente || {};
  const lines = [
    "Proveedor Central",
    factura.source === "ruta"
      ? `Factura ruta ${factura.fecha || ""}`
      : `Factura ${factura.numero || factura.id}`,
    `Cliente: ${cliente.nombre || "Cliente"}`,
  ];

  if (factura.source === "ruta") {
    lines.push(`Ruta: ${factura.ruta || "Sin ruta"}`);
    lines.push(`Carterista: ${factura.carteristaNombre || "Sin carterista"}`);
  }

  lines.push("");

  productos.forEach((producto) => {
    lines.push(
      `${producto.nombre} x${producto.cantidad} - ${formatMoney(producto.total)}`
    );
  });

  lines.push("");

  if (factura.source === "ruta") {
    lines.push(`Deuda anterior: ${formatMoney(factura.deudaAnterior)}`);
    lines.push(`Abono anterior: ${formatMoney(factura.abonoDeudaAnterior)}`);
    lines.push(`Productos de hoy: ${formatMoney(factura.total)}`);
    lines.push(`Pago hoy: ${formatMoney(factura.pagoProductosHoy)}`);
    lines.push(`Fiado hoy: ${formatMoney(factura.fiadoHoy)}`);
    lines.push(`Total queda debiendo: ${formatMoney(factura.deudaFinal)}`);
  } else {
    lines.push(`Subtotal: ${formatMoney(factura.subtotal || factura.total)}`);
    if (Number(factura.descuento) > 0) {
      lines.push(`Descuento: ${formatMoney(factura.descuento)}`);
    }
    if (Number(factura.envio) > 0) {
      lines.push(`Envio: ${formatMoney(factura.envio)}`);
    }
    lines.push(`Total: ${formatMoney(factura.total)}`);
    lines.push(`Pago: ${factura.tipoPago || "Sin definir"}`);
  }

  if (factura.observaciones) {
    lines.push("");
    lines.push(`Nota: ${factura.observaciones}`);
  }

  lines.push("");
  lines.push("Muchas gracias por su compra.");
  return lines;
}

export default function FacturaDetalle() {
  const { id } = useParams();
  const [factura, setFactura] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    let active = true;

    if (!id) return;

    fetch(`/api/admin/facturas/${id}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (active && data) setFactura(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const receiptText = useMemo(
    () => (factura ? buildReceiptLines(factura).join("\n") : ""),
    [factura]
  );

  const whatsappUrl = useMemo(() => {
    const phone = normalizePhone(factura?.cliente?.telefono);
    if (!phone || !receiptText) return "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(receiptText)}`;
  }, [factura, receiptText]);

  async function cambiarEstado(estado) {
    await fetch(`/api/admin/facturas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });

    setFactura((current) => ({ ...current, estado }));
  }

  async function copiarRecibo() {
    if (!receiptText || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(receiptText);
    setCopyMessage("Recibo copiado.");
    setTimeout(() => setCopyMessage(""), 2000);
  }

  return (
    <AdminGuard>
      <AdminShell
        title={factura?.numero || "Detalle de factura"}
        subtitle="Recibo, cartera, productos, WhatsApp y estado operativo."
      >
        {loading && <div className="admin-card">Cargando factura...</div>}
        {!loading && !factura && (
          <div className="admin-card">Factura no encontrada.</div>
        )}

        {factura && (
          <>
            <section className="admin-card invoice-actions-card">
              <div>
                <span className="admin-pill">
                  {factura.source === "ruta" ? "Ruta" : "Tienda"}
                </span>
                <h2>{factura.cliente?.nombre || "Cliente"}</h2>
                <p>
                  {factura.source === "ruta"
                    ? `${factura.ruta || "Sin ruta"} - ${
                        factura.carteristaNombre || "Sin carterista"
                      }`
                    : factura.tipoPago || "Checkout"}
                </p>
              </div>
              <div className="admin-toolbar-actions">
                <Link className="admin-button secondary" href="/admin/facturas">
                  Volver
                </Link>
                <button className="admin-button secondary" onClick={copiarRecibo}>
                  Copiar recibo
                </button>
                <button className="admin-button secondary" onClick={() => window.print()}>
                  Imprimir
                </button>
                {whatsappUrl ? (
                  <a className="admin-button" href={whatsappUrl} target="_blank">
                    Enviar WhatsApp
                  </a>
                ) : (
                  <button className="admin-button" disabled>
                    Sin telefono
                  </button>
                )}
              </div>
              {copyMessage && <small>{copyMessage}</small>}
            </section>

            <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
              <article className="admin-card">
                <p>Total productos</p>
                <h2>{formatMoney(factura.total)}</h2>
              </article>
              <article className="admin-card">
                <p>Cobrado</p>
                <h2>
                  {formatMoney(
                    factura.source === "ruta" ? factura.cobrado : factura.total
                  )}
                </h2>
              </article>
              <article className="admin-card">
                <p>Fiado / pendiente</p>
                <h2>
                  {formatMoney(
                    factura.source === "ruta" ? factura.fiadoHoy : 0
                  )}
                </h2>
              </article>
              <article className="admin-card">
                <p>Deuda final</p>
                <h2>
                  {formatMoney(
                    factura.source === "ruta" ? factura.deudaFinal : 0
                  )}
                </h2>
              </article>
            </section>

            <div className="admin-grid invoice-detail-grid" style={{ marginTop: 16 }}>
              <section className="admin-card">
                <h2>Cliente</h2>
                <p>
                  <strong>{factura.cliente?.nombre || "Cliente"}</strong>
                </p>
                <p>Telefono: {factura.cliente?.telefono || "Sin telefono"}</p>
                <p>Direccion: {factura.cliente?.direccion || "Sin direccion"}</p>
                <p>Ciudad: {factura.cliente?.ciudad || "Sin ciudad"}</p>
              </section>

              <section className="admin-card">
                <h2>Estado</h2>
                <select
                  value={factura.estado || "pendiente"}
                  onChange={(event) => cambiarEstado(event.target.value)}
                >
                  {estados.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
                <p>Total: {formatMoney(factura.total)}</p>
                <p>Tipo de pago: {factura.tipoPago || "Sin definir"}</p>
                {factura.source === "ruta" && (
                  <>
                    <p>Fecha: {factura.fecha || "Sin fecha"}</p>
                    <p>Dia: {factura.diaRuta || "Sin dia"}</p>
                  </>
                )}
              </section>

              {factura.source === "ruta" && (
                <section className="admin-card">
                  <h2>Cartera</h2>
                  <p>Deuda anterior: {formatMoney(factura.deudaAnterior)}</p>
                  <p>Abono deuda anterior: {formatMoney(factura.abonoDeudaAnterior)}</p>
                  <p>Pago productos hoy: {formatMoney(factura.pagoProductosHoy)}</p>
                  <p>Fiado hoy: {formatMoney(factura.fiadoHoy)}</p>
                  <p>
                    <strong>Deuda final: {formatMoney(factura.deudaFinal)}</strong>
                  </p>
                  {factura.observaciones && <p>Nota: {factura.observaciones}</p>}
                </section>
              )}
            </div>

            <section className="admin-card invoice-print-card" style={{ marginTop: 16 }}>
              <div className="receipt-header">
                <div>
                  <p className="home-eyebrow">Proveedor Central</p>
                  <h2>{factura.numero || factura.id}</h2>
                  <span>{factura.source === "ruta" ? "Recibo de ruta" : "Recibo de tienda"}</span>
                </div>
                <strong>{formatMoney(factura.total)}</strong>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(factura.productos || []).map((producto, index) => (
                    <tr key={`${producto.id || producto.nombre}-${index}`}>
                      <td>{producto.nombre}</td>
                      <td>{producto.cantidad}</td>
                      <td>{formatMoney(producto.precio)}</td>
                      <td>{formatMoney(producto.total)}</td>
                    </tr>
                  ))}
                  {!factura.productos?.length && (
                    <tr>
                      <td colSpan="4">Sin productos registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="receipt-totals">
                {factura.source !== "ruta" && (
                  <>
                    <span>Subtotal</span>
                    <strong>{formatMoney(factura.subtotal || factura.total)}</strong>
                    <span>Descuento</span>
                    <strong>{formatMoney(factura.descuento)}</strong>
                    <span>Envio</span>
                    <strong>{formatMoney(factura.envio)}</strong>
                  </>
                )}
                {factura.source === "ruta" && (
                  <>
                    <span>Deuda anterior</span>
                    <strong>{formatMoney(factura.deudaAnterior)}</strong>
                    <span>Abono anterior</span>
                    <strong>{formatMoney(factura.abonoDeudaAnterior)}</strong>
                    <span>Pago hoy</span>
                    <strong>{formatMoney(factura.pagoProductosHoy)}</strong>
                    <span>Fiado hoy</span>
                    <strong>{formatMoney(factura.fiadoHoy)}</strong>
                  </>
                )}
                <span>Total</span>
                <strong>{formatMoney(factura.total)}</strong>
                {factura.source === "ruta" && (
                  <>
                    <span>Total queda debiendo</span>
                    <strong>{formatMoney(factura.deudaFinal)}</strong>
                  </>
                )}
              </div>

              <p className="receipt-thanks">Muchas gracias por su compra.</p>
            </section>
          </>
        )}
      </AdminShell>
    </AdminGuard>
  );
}

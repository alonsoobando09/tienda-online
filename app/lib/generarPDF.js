"use client";

import jsPDF from "jspdf";

export function generarPDFPedido({
  cliente,
  telefono,
  direccion,
  cart,
  total,
  descuento,
  envio,
  totalFinal,
}) {
  const doc = new jsPDF();

  /* ================= HEADER ================= */
  doc.setFontSize(18);
  doc.text("MI PROVEEDOR CENTRAL", 20, 20);

  doc.setFontSize(12);
  doc.text(`Cliente: ${cliente}`, 20, 40);
  doc.text(`Teléfono: ${telefono}`, 20, 50);
  doc.text(`Dirección: ${direccion}`, 20, 60);

  /* ================= PRODUCTOS ================= */
  let y = 80;

  doc.text("Productos:", 20, y);
  y += 10;

  cart.forEach((p) => {
    doc.text(
      `${p.nombre} x${p.cantidad} — $${(
        p.precioDetal * p.cantidad
      ).toLocaleString()}`,
      20,
      y
    );
    y += 10;
  });

  /* ================= TOTALES ================= */
  y += 10;

  doc.text(`Subtotal: $${total.toLocaleString()}`, 20, y);
  y += 10;

  doc.text(`Descuento: -$${descuento.toLocaleString()}`, 20, y);
  y += 10;

  doc.text(`Envío: $${envio.toLocaleString()}`, 20, y);
  y += 10;

  doc.setFontSize(14);
  doc.text(
    `TOTAL: $${totalFinal.toLocaleString()}`,
    20,
    y
  );

  /* ================= SAVE ================= */
  doc.save("pedido.pdf");
}

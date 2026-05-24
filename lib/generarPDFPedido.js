import jsPDF from "jspdf";
import QRCode from "qrcode";

export async function generarPDFPedido({
  facturaId,
  cart,
  subtotal,
  descuento,
  total,
  nombreNegocio = "CENTRAL MAYORISTA",
  logoBase64 = null,
}) {
  const doc = new jsPDF();

  /* ==============================
     🎨 CONFIGURACIÓN GENERAL
  ============================== */

  const primaryColor = [40, 40, 40];
  const accentColor = [0, 0, 0];

  const fecha = new Date().toLocaleString();

  // 🔹 URL REAL DE FACTURA
  const urlFactura = `http://localhost:3000/factura/${facturaId}`;
  const qrImage = await QRCode.toDataURL(urlFactura);

  /* ==============================
     🏪 HEADER
  ============================== */

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 15, 10, 25, 25);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...primaryColor);
  doc.text(nombreNegocio, 50, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${fecha}`, 50, 28);
  doc.text(`Factura ID: ${facturaId}`, 50, 34);

  doc.setDrawColor(...accentColor);
  doc.line(15, 45, 195, 45);

  /* ==============================
     📦 TABLA PRODUCTOS
  ============================== */

  let y = 55;

  doc.setFont("helvetica", "bold");
  doc.text("Producto", 20, y);
  doc.text("Cant.", 120, y);
  doc.text("Precio", 140, y);
  doc.text("Total", 170, y);

  y += 8;
  doc.setFont("helvetica", "normal");

  cart.forEach((item) => {
    const totalItem = item.precio * item.cantidad;

    doc.text(item.nombre, 20, y);
    doc.text(String(item.cantidad), 120, y);
    doc.text(`$${item.precio.toLocaleString()}`, 140, y);
    doc.text(`$${totalItem.toLocaleString()}`, 170, y);

    y += 8;
  });

  /* ==============================
     💰 TOTALES
  ============================== */

  y += 5;
  doc.line(120, y, 195, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", 120, y);
  doc.text(`$${subtotal.toLocaleString()}`, 170, y);
  y += 8;

  doc.text("Descuento:", 120, y);
  doc.text(`-$${descuento.toLocaleString()}`, 170, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", 120, y);
  doc.text(`$${total.toLocaleString()}`, 170, y);

  /* ==============================
     📱 QR DE VERIFICACIÓN
  ============================== */

  y += 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Escanea para ver la factura online:", 20, y);

  doc.addImage(qrImage, "PNG", 20, y + 5, 40, 40);

  /* ==============================
     🙌 MENSAJE FINAL
  ============================== */

  doc.text("Gracias por su compra 🙌", 120, y + 20);

  /* ==============================
     💾 GUARDAR
  ============================== */

  doc.save(`Factura-${facturaId}.pdf`);
}
import jsPDF from "jspdf";
import QRCode from "qrcode";

export async function generarFacturaTermica({
  cart,
  subtotal,
  descuento,
  total,
  tipoPago,
  cliente,
  nombreNegocio = "Quesos Mathías",
  direccion = "Bogotá, Colombia",
  telefono = "3132752493",
}) {
  // Tamaño 80mm → 80mm x 200mm aprox
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 200],
  });

  let y = 10;

  // ===============================
  // 🏪 ENCABEZADO
  // ===============================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(nombreNegocio, 40, y, { align: "center" });
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(direccion, 40, y, { align: "center" });
  y += 4;
  doc.text(`Tel: ${telefono}`, 40, y, { align: "center" });
  y += 6;

  doc.line(5, y, 75, y);
  y += 6;

  // ===============================
  // 🧾 INFO FACTURA
  // ===============================
  const numeroFactura = `FAC-${Date.now()}`;
  const fecha = new Date().toLocaleString();

  doc.text(`Factura: ${numeroFactura}`, 5, y);
  y += 4;
  doc.text(`Fecha: ${fecha}`, 5, y);
  y += 4;
  doc.text(`Pago: ${tipoPago.toUpperCase()}`, 5, y);
  y += 4;

  if (tipoPago === "fiado" && cliente) {
    doc.text(`Cliente: ${cliente}`, 5, y);
    y += 4;
  }

  y += 4;
  doc.line(5, y, 75, y);
  y += 6;

  // ===============================
  // 📦 PRODUCTOS
  // ===============================
  cart.forEach((item) => {
    const totalItem = item.precio * item.cantidad;

    doc.text(item.nombre, 5, y);
    y += 4;
    doc.text(
      `${item.cantidad} x $${item.precio.toLocaleString()}`,
      5,
      y
    );
    doc.text(`$${totalItem.toLocaleString()}`, 75, y, {
      align: "right",
    });

    y += 6;
  });

  doc.line(5, y, 75, y);
  y += 6;

  // ===============================
  // 💰 TOTALES
  // ===============================
  doc.setFont("helvetica", "bold");

  doc.text("Subtotal:", 5, y);
  doc.text(`$${subtotal.toLocaleString()}`, 75, y, {
    align: "right",
  });
  y += 5;

  doc.text("Descuento:", 5, y);
  doc.text(`$${descuento.toLocaleString()}`, 75, y, {
    align: "right",
  });
  y += 5;

  doc.setFontSize(10);
  doc.text("TOTAL:", 5, y);
  doc.text(`$${total.toLocaleString()}`, 75, y, {
    align: "right",
  });

  y += 10;

  // ===============================
  // 📊 QR DEL PEDIDO
  // ===============================
  const qrData = `
Factura: ${numeroFactura}
Total: ${total}
Pago: ${tipoPago}
Fecha: ${fecha}
  `;

  const qrImage = await QRCode.toDataURL(qrData);

  doc.addImage(qrImage, "PNG", 20, y, 40, 40);

  y += 45;

  // ===============================
  // 🙌 MENSAJE FINAL
  // ===============================
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Gracias por su compra 🙌", 40, y, {
    align: "center",
  });

  doc.save(`${numeroFactura}.pdf`);
}
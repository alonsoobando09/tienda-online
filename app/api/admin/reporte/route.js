import PDFDocument from "pdfkit";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  const snapshot = await getDocs(collection(db, "facturas"));

  const doc = new PDFDocument();
  const buffers = [];

  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {});

  doc.text("Reporte Diario");

  snapshot.forEach((f) => {
    doc.text(`Factura: ${f.data().numero} - $${f.data().total}`);
  });

  doc.end();

  return new Response(Buffer.concat(buffers), {
    headers: {
      "Content-Type": "application/pdf",
    },
  });
}
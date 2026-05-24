import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(value);
}

function sameDay(a, b) {
  return (
    a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date) {
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
  });
}

export async function GET() {
  try {
    const [facturasSnapshot, productosSnapshot] = await Promise.all([
      getDocs(query(collection(db, "facturas"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "productos")),
    ]);

    const hoy = new Date();

    const facturas = facturasSnapshot.docs.map((docu) => ({
      id: docu.id,
      ...docu.data(),
      fecha: toDate(docu.data().createdAt),
    }));

    const productos = productosSnapshot.docs.map((docu) => ({
      id: docu.id,
      ...docu.data(),
    }));

    const ventasHoyLista = facturas.filter((factura) =>
      sameDay(factura.fecha, hoy)
    );

    const ingresosHoy = ventasHoyLista.reduce(
      (acc, factura) => acc + (Number(factura.total) || 0),
      0
    );

    const totalInventario = productos.reduce(
      (acc, producto) => acc + (Number(producto.stock) || 0),
      0
    );

    const valorInventario = productos.reduce((acc, producto) => {
      const stock = Number(producto.stock) || 0;
      const costo = Number(producto.costo || producto.precioMayor) || 0;
      return acc + stock * costo;
    }, 0);

    const pagosPendientes = facturas.filter(
      (factura) => factura.estado === "pendiente"
    ).length;

    const clientes = new Set(
      facturas
        .map((factura) => factura.cliente?.telefono || factura.cliente?.email)
        .filter(Boolean)
    ).size;

    const graficoMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(hoy);
      date.setDate(hoy.getDate() - i);
      graficoMap.set(dayKey(date), 0);
    }

    facturas.forEach((factura) => {
      if (!factura.fecha) return;
      const key = dayKey(factura.fecha);
      if (graficoMap.has(key)) {
        graficoMap.set(key, graficoMap.get(key) + (Number(factura.total) || 0));
      }
    });

    const bajoStock = productos
      .filter((producto) => (Number(producto.stock) || 0) <= 5)
      .slice(0, 8);

    return NextResponse.json({
      ventasHoy: ventasHoyLista.length,
      ingresosHoy,
      clientes,
      pagosPendientes,
      totalProductos: productos.length,
      totalStock: totalInventario,
      valorInventario,
      ticketPromedio:
        facturas.length > 0
          ? facturas.reduce((acc, factura) => acc + (Number(factura.total) || 0), 0) /
            facturas.length
          : 0,
      grafico: Array.from(graficoMap.entries()).map(([dia, ventas]) => ({
        dia,
        ventas,
      })),
      ultimasVentas: facturas.slice(0, 8),
      productos: productos.slice(0, 12),
      bajoStock,
    });
  } catch (error) {
    console.error("Error dashboard:", error);

    return NextResponse.json(
      { error: "Error cargando dashboard" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function GET() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "facturas"), orderBy("createdAt", "desc"))
    );

    const facturas = snapshot.docs.map((docu) => ({
      id: docu.id,
      ...docu.data(),
    }));

    const ingresos = facturas
      .filter((factura) => ["pagado", "entregado"].includes(factura.estado))
      .reduce((acc, factura) => acc + (Number(factura.total) || 0), 0);

    const cuentasPorCobrar = facturas
      .filter((factura) => factura.estado === "pendiente")
      .reduce((acc, factura) => acc + (Number(factura.total) || 0), 0);

    const ventasBrutas = facturas.reduce(
      (acc, factura) => acc + (Number(factura.total) || 0),
      0
    );

    const impuestosEstimados = facturas.reduce((acc, factura) => {
      const productos = factura.productos || [];
      const iva = productos.reduce((subtotal, item) => {
        const rate = Number(item.iva) || 0;
        return subtotal + (Number(item.total) || 0) * (rate / 100);
      }, 0);
      return acc + iva;
    }, 0);

    return NextResponse.json({
      ingresos,
      cuentasPorCobrar,
      ventasBrutas,
      impuestosEstimados,
      facturasPendientes: facturas.filter(
        (factura) => factura.estado === "pendiente"
      ),
      ultimosMovimientos: facturas.slice(0, 12),
    });
  } catch (error) {
    console.error("Error contabilidad:", error);

    return NextResponse.json(
      { error: "Error cargando contabilidad" },
      { status: 500 }
    );
  }
}

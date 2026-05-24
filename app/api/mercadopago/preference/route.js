import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { factura } = await req.json();
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/$/, "");
    const isPublicHttpsUrl = appUrl.startsWith("https://");

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Falta configurar MERCADOPAGO_ACCESS_TOKEN en .env.local",
        },
        { status: 500 }
      );
    }

    if (!factura?.id || !factura?.productos?.length) {
      return NextResponse.json(
        { error: "Factura inválida para Mercado Pago" },
        { status: 400 }
      );
    }

    const backUrls = {
      success: `${appUrl}/pago-exitoso?id=${encodeURIComponent(factura.id)}`,
      failure: `${appUrl}/checkout`,
      pending: `${appUrl}/gracias?id=${encodeURIComponent(factura.id)}`,
    };

    const preference = {
      items: factura.productos.map((producto) => ({
        id: producto.id,
        title: producto.nombre,
        quantity: Number(producto.cantidad) || 1,
        unit_price: Number(producto.precio) || 0,
        currency_id: "COP",
      })),
      payer: {
        name: factura.cliente?.nombre || "",
        email: factura.cliente?.email || "",
        phone: {
          number: factura.cliente?.telefono || "",
        },
      },
      external_reference: factura.id,
      back_urls: backUrls,
    };

    if (isPublicHttpsUrl) {
      preference.notification_url = `${appUrl}/api/mercadopago/webhook`;
      preference.auto_return = "approved";
    }

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Error creando preferencia", detail: data },
        { status: res.status }
      );
    }

    return NextResponse.json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (error) {
    console.error("Error Mercado Pago:", error);

    return NextResponse.json(
      { error: "Error preparando pago" },
      { status: 500 }
    );
  }
}

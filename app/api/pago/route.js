import { NextResponse } from "next/server";

export async function POST(req) {
  const body = await req.json();

  const { total } = body;

  try {
    const response = await fetch(
      "https://sandbox.wompi.co/v1/transactions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount_in_cents: total * 100,
          currency: "COP",
          customer_email: "cliente@email.com",
          payment_method: {
            type: "CARD",
          },
          reference: "pedido-" + Date.now(),
        }),
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Error creando pago" },
      { status: 500 }
    );
  }
}

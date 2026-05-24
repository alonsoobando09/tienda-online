import { NextResponse } from "next/server";

export async function POST(req) {
  const { total, referencia } = await req.json();

  const res = await fetch("https://sandbox.wompi.co/v1/transactions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount_in_cents: total * 100,
      currency: "COP",
      reference: referencia,
      customer_email: "cliente@email.com",
      payment_method: {
        type: "CARD",
        token: "TOKEN_GENERADO_FRONTEND",
      },
    }),
  });

  const data = await res.json();

  return NextResponse.json(data);
}
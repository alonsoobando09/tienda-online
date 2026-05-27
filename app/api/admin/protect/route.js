import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { token } = await req.json();
    const decoded = await getAdminAuth().verifyIdToken(token);

    if (!decoded.admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.message?.includes("Firebase Admin no está configurado")) {
      return NextResponse.json(
        {
          error:
            "Firebase Admin no está configurado en el servidor. Revisa las variables FB_* en Vercel.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}

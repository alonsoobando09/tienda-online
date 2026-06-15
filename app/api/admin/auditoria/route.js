import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  authErrorResponse,
  getRequestEmpresaId,
  requirePermission,
} from "@/lib/serverAuth";
import { filterByEmpresaId } from "@/lib/firestoreTenant";

function serializeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return new Date(value).toISOString();
}

export async function GET(request) {
  try {
    const profile = await requirePermission(request, "auditoria.read");
    const empresaId = getRequestEmpresaId(request, profile);
    const snapshot = await getAdminDb()
      .collection("auditoria")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const items = filterByEmpresaId(
      snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: serializeDate(data.createdAt),
        };
      }),
      empresaId
    );

    return NextResponse.json({ items, empresaId });
  } catch (error) {
    return authErrorResponse(error);
  }
}

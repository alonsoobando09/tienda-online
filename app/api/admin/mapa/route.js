import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  authErrorResponse,
  getRequestEmpresaId,
  requirePermission,
} from "@/lib/serverAuth";

function serializeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request) {
  try {
    const actor = await requirePermission(request, "dashboard.read");
    const empresaId = getRequestEmpresaId(request, actor);
    const snapshot = await getAdminDb()
      .collection("ubicacionesRuta")
      .where("empresaId", "==", empresaId)
      .get();
    const items = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};

        return {
          id: doc.id,
          empresaId: data.empresaId || empresaId,
          uid: data.uid || "",
          empleadoNombre: data.empleadoNombre || "",
          empleadoRol: data.empleadoRol || "",
          fecha: data.fecha || "",
          diaRuta: data.diaRuta || "",
          ruta: data.ruta || "",
          lat: Number(data.lat) || 0,
          lng: Number(data.lng) || 0,
          accuracy: Number(data.accuracy) || 0,
          timestamp: serializeDate(data.timestamp),
        };
      })
      .sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp))
      .slice(0, 1000);

    return NextResponse.json({ empresaId, items });
  } catch (error) {
    return authErrorResponse(error);
  }
}

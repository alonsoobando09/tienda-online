import { db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";

export async function POST(req) {
  const data = await req.json();

  await addDoc(collection(db, "pedidos"), {
    ...data,
    createdAt: new Date(),
  });

  return Response.json({ ok: true });
}

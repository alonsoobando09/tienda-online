import { readFile } from "node:fs/promises";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("../serviceAccountKey.json", import.meta.url), "utf8")
);

const emailAdmin =
  process.argv[2] ||
  process.env.ADMIN_EMAIL ||
  "alriver1995zit@gmail.com";

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

async function hacerAdmin() {
  const auth = getAuth();
  const db = getFirestore();
  const user = await auth.getUserByEmail(emailAdmin);

  await auth.setCustomUserClaims(user.uid, {
    admin: true,
  });

  await db.collection("usuarios").doc(user.uid).set(
    {
      email: user.email,
      rol: "admin",
      actualizadoEn: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log(`Usuario administrador actualizado: ${emailAdmin}`);
}

hacerAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});

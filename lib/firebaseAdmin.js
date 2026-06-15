import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccount() {
  const envServiceAccount = {
    projectId: process.env.FB_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    privateKey: process.env.FB_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  if (
    envServiceAccount.projectId &&
    envServiceAccount.clientEmail &&
    envServiceAccount.privateKey
  ) {
    return envServiceAccount;
  }

  const localKeyPath = path.join(process.cwd(), "serviceAccountKey.json");

  if (existsSync(localKeyPath)) {
    return JSON.parse(readFileSync(localKeyPath, "utf8"));
  }

  return null;
}

export function getAdminAuth() {
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();

    if (!serviceAccount) {
      throw new Error(
        "Firebase Admin no está configurado. Define FB_PROJECT_ID, FB_CLIENT_EMAIL y FB_PRIVATE_KEY."
      );
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getAuth();
}

export function getAdminDb() {
  getAdminAuth();
  return getFirestore();
}

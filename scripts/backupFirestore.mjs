import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminDb } from "../lib/firebaseAdmin.js";

const DEFAULT_COLLECTIONS = [
  "usuarios",
  "empresas",
  "productos",
  "clientes",
  "empleados",
  "proveedores",
  "compras",
  "cuentasPagar",
  "despachos",
  "recepciones",
  "liquidaciones",
  "facturas",
  "facturasRuta",
  "gastosRuta",
  "gestionesRuta",
  "movimientosCartera",
  "ubicacionesRuta",
  "kardex",
  "autorizacionesRuta",
  "erroresSistema",
];

function serialize(value) {
  if (!value) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serialize(entry)])
    );
  }
  return value;
}

function getTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replace(/\..+$/, "");
}

const empresaId = process.argv
  .find((arg) => arg.startsWith("--empresa="))
  ?.split("=")[1];
const collectionsArg = process.argv
  .find((arg) => arg.startsWith("--collections="))
  ?.split("=")[1];
const collections = collectionsArg
  ? collectionsArg.split(",").map((item) => item.trim()).filter(Boolean)
  : DEFAULT_COLLECTIONS;

const db = getAdminDb();
const timestamp = getTimestamp();
const backupDir = path.join(process.cwd(), "backups", timestamp);

await mkdir(backupDir, { recursive: true });

const manifest = {
  createdAt: new Date().toISOString(),
  empresaId: empresaId || "todas",
  collections: [],
};

for (const collectionName of collections) {
  let ref = db.collection(collectionName);
  if (empresaId && collectionName !== "empresas") {
    ref = ref.where("empresaId", "==", empresaId);
  }

  const snapshot = await ref.get();
  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: serialize(doc.data()),
  }));

  await writeFile(
    path.join(backupDir, `${collectionName}.json`),
    JSON.stringify(docs, null, 2),
    "utf8"
  );

  manifest.collections.push({
    name: collectionName,
    count: docs.length,
  });
}

await writeFile(
  path.join(backupDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8"
);

console.log(`Backup listo: ${backupDir}`);

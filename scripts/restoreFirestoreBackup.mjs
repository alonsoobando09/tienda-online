import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { getAdminDb } from "../lib/firebaseAdmin.js";

function getArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const backupArg = getArg("backup");
const collectionsArg = getArg("collections");
const empresaId = getArg("empresa");
const confirm = hasFlag("confirm");

if (!backupArg) {
  console.error("Uso: npm run restore -- --backup=backups/FECHA --empresa=proveedor-central --confirm");
  process.exit(1);
}

const backupDir = path.resolve(process.cwd(), backupArg);
const manifestPath = path.join(backupDir, "manifest.json");

if (!existsSync(backupDir) || !existsSync(manifestPath)) {
  console.error(`Backup invalido o sin manifest: ${backupDir}`);
  process.exit(1);
}

const manifest = parseJson(manifestPath);
const availableFiles = (await readdir(backupDir)).filter(
  (file) => file.endsWith(".json") && file !== "manifest.json"
);
const collections = collectionsArg
  ? collectionsArg.split(",").map((item) => item.trim()).filter(Boolean)
  : availableFiles.map((file) => file.replace(/\.json$/, ""));
const db = getAdminDb();

console.log(`Backup: ${backupDir}`);
console.log(`Creado: ${manifest.createdAt || "sin fecha"}`);
console.log(`Empresa manifest: ${manifest.empresaId || "todas"}`);
console.log(`Modo: ${confirm ? "RESTAURAR" : "DRY RUN"}`);

let totalDocs = 0;

for (const collectionName of collections) {
  const filePath = path.join(backupDir, `${collectionName}.json`);
  if (!existsSync(filePath)) {
    console.warn(`Saltando ${collectionName}: no existe archivo.`);
    continue;
  }

  const docs = parseJson(filePath).filter((doc) => {
    if (!empresaId || collectionName === "empresas") return true;
    return doc.data?.empresaId === empresaId;
  });

  totalDocs += docs.length;
  console.log(`${collectionName}: ${docs.length} documentos`);

  if (!confirm || docs.length === 0) continue;

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of docs) {
    batch.set(db.collection(collectionName).doc(doc.id), doc.data, { merge: true });
    batchCount += 1;

    if (batchCount === 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
}

if (!confirm) {
  console.log(
    `\nSimulacion completa: ${totalDocs} documentos. Agrega --confirm para restaurar.`
  );
} else {
  console.log(`\nRestauracion completa: ${totalDocs} documentos.`);
}

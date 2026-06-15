import { getAdminDb } from "../lib/firebaseAdmin.js";

const DEFAULT_EMPRESA_ID = "proveedor-central";
const COLLECTIONS = [
  "usuarios",
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

const empresaId =
  process.argv.find((arg) => arg.startsWith("--empresa="))?.split("=")[1] ||
  DEFAULT_EMPRESA_ID;
const dryRun = process.argv.includes("--dry-run");
const db = getAdminDb();

const summary = [];

for (const collectionName of COLLECTIONS) {
  const snapshot = await db.collection(collectionName).get();
  const pending = snapshot.docs.filter((doc) => !doc.data().empresaId);

  summary.push({
    collection: collectionName,
    scanned: snapshot.size,
    pending: pending.length,
  });

  if (dryRun || pending.length === 0) continue;

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of pending) {
    batch.update(doc.ref, {
      empresaId,
      empresaMigradaAt: new Date().toISOString(),
    });
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

console.table(summary);
console.log(
  dryRun
    ? "Revision lista. No se escribio nada porque usaste --dry-run."
    : `Migracion lista. Documentos sin empresaId quedaron en ${empresaId}.`
);

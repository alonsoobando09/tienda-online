import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "package.json",
  "next.config.ts",
  "vercel.json",
  "firestore.rules",
  ".env.example",
  ".env.test.example",
  "app/Providers.jsx",
  "app/components/ErrorReporter.jsx",
  "lib/tenant.js",
  "scripts/backupFirestore.mjs",
  "scripts/migrateEmpresaId.mjs",
];

const requiredEnv = [
  "NEXT_PUBLIC_APP_URL",
  "MERCADOPAGO_ACCESS_TOKEN",
  "FB_PROJECT_ID",
  "FB_CLIENT_EMAIL",
  "FB_PRIVATE_KEY",
];

function readEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!existsSync(filePath)) return {};

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

function isPlaceholder(value) {
  return /tu_|xxxx|xxxxxxxx|test-|localhost|TU_LLAVE/i.test(String(value || ""));
}

const envLocal = readEnvFile(".env.local");
const envExample = readEnvFile(".env.example");
const results = [];

for (const file of requiredFiles) {
  results.push({
    area: "archivo",
    item: file,
    ok: existsSync(path.join(root, file)),
    detail: existsSync(path.join(root, file)) ? "existe" : "falta",
  });
}

for (const key of requiredEnv) {
  const value = process.env[key] || envLocal[key];
  results.push({
    area: "variable",
    item: key,
    ok: Boolean(value) && !isPlaceholder(value),
    detail: value
      ? isPlaceholder(value)
        ? "parece valor de ejemplo"
        : "configurada"
      : "falta",
  });
}

results.push({
  area: "seguridad",
  item: "serviceAccountKey.json",
  ok: !existsSync(path.join(root, "serviceAccountKey.json")),
  detail: existsSync(path.join(root, "serviceAccountKey.json"))
    ? "existe localmente; no debe subirse"
    : "no existe en raiz",
});

results.push({
  area: "plantilla",
  item: ".env.example completo",
  ok: requiredEnv.every((key) => Boolean(envExample[key])),
  detail: "variables documentadas para Vercel",
});

const failed = results.filter((result) => !result.ok);

console.table(
  results.map((result) => ({
    area: result.area,
    item: result.item,
    estado: result.ok ? "OK" : "REVISAR",
    detalle: result.detail,
  }))
);

if (failed.length > 0) {
  console.log("\nRevisa estos puntos antes de produccion:");
  failed.forEach((item) => {
    console.log(`- ${item.area}: ${item.item} (${item.detail})`);
  });
  process.exitCode = 1;
} else {
  console.log("\nProyecto listo en chequeos basicos.");
}

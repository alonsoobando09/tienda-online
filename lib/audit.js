import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { DEFAULT_EMPRESA_ID, normalizeEmpresaId } from "@/lib/tenant";

export const AUDIT_COLLECTION = "auditoria";

function sanitize(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitize);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["password", "token", "privateKey", "accessToken"].includes(key))
      .map(([key, entry]) => [key, sanitize(entry)])
  );
}

export async function logAuditEvent({
  empresaId = DEFAULT_EMPRESA_ID,
  actor = {},
  action,
  resource,
  resourceId,
  before = null,
  after = null,
  metadata = {},
}) {
  if (!action || !resource) return null;

  const db = getAdminDb();
  const payload = {
    empresaId: normalizeEmpresaId(empresaId),
    action,
    resource,
    resourceId: resourceId || "",
    actorUid: actor.uid || "",
    actorEmail: actor.email || "",
    actorRole: actor.role || actor.rol || "",
    before: sanitize(before),
    after: sanitize(after),
    metadata: sanitize(metadata),
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection(AUDIT_COLLECTION).add(payload);
  return ref.id;
}

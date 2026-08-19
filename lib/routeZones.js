export const operationalPrefixes = ["/admin", "/carterista", "/app", "/login"];

export function isOperationalPath(pathname = "") {
  return operationalPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

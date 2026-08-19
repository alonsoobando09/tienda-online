export const operationalPrefixes = ["/admin", "/carterista", "/app"];

export function isOperationalPath(pathname = "") {
  return operationalPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

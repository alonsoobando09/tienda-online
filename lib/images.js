export function getSafeImageSrc(value, fallback = "/categorias/carnicos.jpg") {
  if (typeof value !== "string") return fallback;

  const src = value.trim();

  if (!src || src === "undefined" || src === "null") return fallback;

  if (src.startsWith("/")) return src;

  try {
    const url = new URL(src);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return src;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function isRemoteImage(value) {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

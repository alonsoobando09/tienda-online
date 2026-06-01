const DEFAULT_IMAGE = "/categorias/carnicos.jpg";

function normalizeFallback(fallback) {
  if (fallback === "") return "";
  if (typeof fallback !== "string") return DEFAULT_IMAGE;

  const src = fallback.trim();
  if (!src || src === "undefined" || src === "null") return DEFAULT_IMAGE;
  if (src.startsWith("/")) return src;

  try {
    const url = new URL(src);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return src;
    }
  } catch {
    return DEFAULT_IMAGE;
  }

  return DEFAULT_IMAGE;
}

export function getSafeImageSrc(value, fallback = DEFAULT_IMAGE) {
  const safeFallback = normalizeFallback(fallback);

  if (typeof value !== "string") return safeFallback;

  const src = value.trim();

  if (!src || src === "undefined" || src === "null") return safeFallback;

  if (src.startsWith("/")) return src;
  if (src.startsWith("data:image/")) return src;

  try {
    const url = new URL(src);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return src;
    }
  } catch {
    return safeFallback;
  }

  return safeFallback;
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

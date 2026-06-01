import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const IMAGE_TIMEOUT_MS = 20000;

function imageToCanvas(file, maxSize = 900) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.max(Math.round(image.width * scale), 1);
      const height = Math.max(Math.round(image.height * scale), 1);
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };

    image.src = objectUrl;
  });
}

export async function compressImageToDataUrl(file) {
  const canvas = await imageToCanvas(file);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function uploadImageWithFallback(storage, file) {
  const safeName = `${Date.now()}-${file.name.replaceAll(" ", "-")}`;
  const storageRef = ref(storage, `productos/${safeName}`);
  const uploadPromise = uploadBytes(storageRef, file);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("storage-timeout")), IMAGE_TIMEOUT_MS);
  });

  try {
    const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
    return {
      message: "Imagen subida a Firebase Storage. Ya puedes guardar.",
      url: await getDownloadURL(snapshot.ref),
    };
  } catch {
    return {
      message:
        "Firebase Storage no respondió. Guardé una versión comprimida en el producto.",
      url: await compressImageToDataUrl(file),
    };
  }
}

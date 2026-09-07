/** Charge une image via createImageBitmap, avec repli sur <img> si non supporté. */
async function loadImage(file: File): Promise<{ width: number; height: number; source: CanvasImageSource; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close?.() };
    } catch {
      // repli ci-dessous
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image illisible"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Compresse une photo côté navigateur en JPEG (max 1600 px) avant envoi. */
export async function compressImage(file: File, maxSize = 1600, quality = 0.72): Promise<string> {
  const img = await loadImage(file);
  try {
    if (!img.width || !img.height) throw new Error("dimensions invalides");
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Compression impossible");
    ctx.drawImage(img.source, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (!dataUrl.startsWith("data:image/jpeg;base64,") || dataUrl.length < 100) {
      throw new Error("Compression impossible");
    }
    return dataUrl;
  } finally {
    img.close();
  }
}

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

function draw(source: CanvasImageSource, w: number, h: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Compression impossible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Compresse une photo côté navigateur en JPEG léger avant envoi.
 * Réduit progressivement taille et qualité pour rester sous ~900 Ko,
 * indispensable en 4G sur chantier.
 */
export async function compressImage(file: File, maxSize = 1280, quality = 0.66): Promise<string> {
  const img = await loadImage(file);
  try {
    if (!img.width || !img.height) throw new Error("dimensions invasides");
    const LIMIT = 900_000; // longueur de la data URL
    let size = maxSize;
    let q = quality;
    let dataUrl = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      dataUrl = draw(img.source, width, height, q);
      if (dataUrl.length <= LIMIT) break;
      size = Math.round(size * 0.75);
      q = Math.max(0.4, q - 0.08);
    }
    if (!dataUrl.startsWith("data:image/jpeg;base64,") || dataUrl.length < 100) {
      throw new Error("Compression impossible");
    }
    return dataUrl;
  } finally {
    img.close();
  }
}

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_RAW_BYTES = 10 * 1024 * 1024; // 10 MB hard cap
const SKIP_RESIZE_BYTES = 350 * 1024; // small files kept verbatim
const MAX_DATA_URL_LENGTH = 2.5 * 1024 * 1024; // ~1.8 MB binary ceiling for draft persistence
const MAX_DIMENSION = 1400;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

function optimizeViaCanvas(rawDataUrl, mimeType) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) {
        reject(new Error('The selected file is not a valid image.'));
        return;
      }
      const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
      const targetW = Math.max(1, Math.round(w * scale));
      const targetH = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: rawDataUrl, width: w, height: h });
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Keep PNG transparency when uploaded as PNG if reasonably sized; otherwise encode WebP/JPEG.
      const preferred = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      let out = canvas.toDataURL(preferred, 0.85);
      if (out.length > MAX_DATA_URL_LENGTH && preferred === 'image/png') {
        out = canvas.toDataURL('image/webp', 0.85);
      }
      resolve({
        dataUrl: out.length < rawDataUrl.length ? out : rawDataUrl,
        width: targetW,
        height: targetH,
      });
    };
    img.onerror = () => reject(new Error('Could not decode this image file.'));
    img.src = rawDataUrl;
  });
}

/**
 * Validates and prepares a device-selected image file as a persistable raster data URL.
 */
export async function readImageFile(file) {
  if (!file) throw new Error('Select an image file first.');
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Choose a PNG, JPEG, WebP, or GIF image.');
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new Error('Image must be 10 MB or smaller.');
  }

  const rawDataUrl = await readAsDataUrl(file);
  let dataUrl = rawDataUrl;

  if (file.type !== 'image/gif' && file.size > SKIP_RESIZE_BYTES) {
    try {
      const optimized = await optimizeViaCanvas(rawDataUrl, file.type);
      dataUrl = optimized.dataUrl;
    } catch {
      // Fall back to the original data URL if canvas processing isn't available
      dataUrl = rawDataUrl;
    }
  }

  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error('This image is too large to embed after optimization. Try a smaller image or an external URL.');
  }

  return dataUrl;
}


import { UPLOAD_MAX_BYTES, UPLOAD_MAX_SIDE, type PhotoKind } from "./photo";

/**
 * Shrinks a photo in the browser before it's uploaded: phone photos are often
 * larger than a Server Action may receive. Drawing to a canvas applies the
 * EXIF rotation and drops all metadata, EXIF GPS included. The result is a
 * JPEG the server turns into WebP at the stored widths.
 */
export async function prepareUpload(file: File, kind: PhotoKind) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser can't open that file. Try a JPEG or PNG (on iPhone, export HEIC photos as JPEG).");
  }
  const scale = Math.min(1, UPLOAD_MAX_SIDE[kind] / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't resize photos.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.9, 0.82, 0.72, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= UPLOAD_MAX_BYTES) return { blob, width, height };
  }
  throw new Error("The photo is still too large after resizing.");
}

/** Upload validation. Owner: Snikdho. Used by the demo route now, by /api/diagnose later. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export type UploadCheck =
  | { ok: true; mime: AllowedMime }
  | {
      ok: false;
      code: "invalid_request" | "unsupported_media_type" | "payload_too_large";
      message: string;
    };

/** Cheap check before reading the body. */
export function checkUploadMeta(args: { size: number; declaredType: string }): UploadCheck {
  if (args.size <= 0) return { ok: false, code: "invalid_request", message: "Empty file." };
  if (args.size > MAX_UPLOAD_BYTES)
    return { ok: false, code: "payload_too_large", message: "Image must be 5 MB or smaller." };
  if (!(ALLOWED_MIME as readonly string[]).includes(args.declaredType))
    return { ok: false, code: "unsupported_media_type", message: "Use a JPEG, PNG or WebP image." };
  return { ok: true, mime: args.declaredType as AllowedMime };
}

/** Do not trust the declared MIME type: check the file signature. */
export function sniffMime(b: Uint8Array): AllowedMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  return null;
}

export function checkUploadBytes(bytes: Uint8Array): UploadCheck {
  const mime = sniffMime(bytes);
  if (!mime)
    return { ok: false, code: "unsupported_media_type", message: "File content is not a supported image." };
  return { ok: true, mime };
}

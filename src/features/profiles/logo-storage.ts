import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGO_BUCKET } from "./queries";
import { LOGO_WRONG_TYPE, type LogoType, logoSizeProblem } from "./schema";

export type LogoUpload = { bytes: Uint8Array; type: LogoType };

const EXTENSIONS: Record<LogoType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** The image type from a file's first bytes. Browsers go by the file name, which can be wrong. */
function sniffType(bytes: Uint8Array): LogoType | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === "\x89PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** A chosen logo, ready to upload, or why it can't be used. */
export async function readLogoFile(file: File): Promise<LogoUpload | { error: string }> {
  const tooBig = logoSizeProblem(file.size);
  if (tooBig) return { error: tooBig };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  return type ? { bytes, type } : { error: LOGO_WRONG_TYPE };
}

/**
 * Uploads a logo as the logged-in admin (storage policies allow admins only) and returns
 * its path. Every upload gets a new random name: Supabase's CDN keeps serving a replaced
 * file for a while, so a name is never reused.
 */
export async function uploadLogo(logo: LogoUpload): Promise<string> {
  const db = await createSupabaseServerClient();
  const path = `${crypto.randomUUID()}.${EXTENSIONS[logo.type]}`;
  const { error } = await db.storage
    .from(LOGO_BUCKET)
    .upload(path, logo.bytes, { contentType: logo.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Couldn't upload logo: ${error.message}`);
  return path;
}

/** Removes a logo file nothing uses any more. A file left behind does no harm, so a failure is only logged. */
export async function removeLogoFile(path: string): Promise<void> {
  const db = await createSupabaseServerClient();
  const { error } = await db.storage.from(LOGO_BUCKET).remove([path]);
  if (error) console.error(`[profiles] couldn't remove logo ${path}`, error);
}

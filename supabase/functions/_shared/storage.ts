import { supabase } from "./supabase.ts";

// Public buckets — matches the exposure level of the old Cloudinary URLs
// (never truly access-controlled — the token-gated serve endpoints add a JWT
// check on top, same as before, but the object itself is fetchable by URL).
export const BUCKETS = {
  photo: "photos",
  cv: "cvs",
  deck: "decks",
  video: "videos",
} as const;

export async function uploadBuffer(
  bucket: string,
  path: string,
  buffer: Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

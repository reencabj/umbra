import { db } from "./supabase";
import { createPhotoCache } from "./photo-cache";

let storage: Storage | undefined;
try {
  storage = window.sessionStorage;
} catch {
  /* Memory cache remains available. */
}
export const productPhotos = createPhotoCache(async (paths, expiresIn) => {
  const { data, error } = await db.storage
    .from("product-photos")
    .createSignedUrls(paths, expiresIn);
  if (error) throw error;
  return data || [];
}, storage);

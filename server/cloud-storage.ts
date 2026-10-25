import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const cloudStorageEnabled = () => Boolean(env.supabaseUrl && env.supabaseSecretKey);
let client: ReturnType<typeof createClient> | undefined;
function bucket() {
  if (!cloudStorageEnabled()) throw new Error("Supabase Storage no está configurado");
  client ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client.storage.from(env.supabaseBucket);
}

export async function uploadObject(name: string, data: Buffer, contentType: string) {
  const { error } = await bucket().upload(name, data, { contentType, upsert: false });
  if (error) throw new Error(`No se pudo guardar en Supabase Storage (${error.name})`);
}

export async function signedObjectUrl(name: string) {
  const { data, error } = await bucket().createSignedUrl(name, 60);
  if (error || !data) throw new Error("No se pudo recuperar el archivo de Supabase Storage");
  return data.signedUrl;
}

export async function removeObject(name: string) {
  const { error } = await bucket().remove([name]);
  if (error) throw new Error("No se pudo eliminar el archivo de Supabase Storage");
}

export async function ensureCloudBucket() {
  if (!cloudStorageEnabled()) return;
  const { error } = await bucket().list("", { limit: 1 });
  if (!error) return;
  // Creation is idempotent across startup retries; never make the bucket public.
  const api = client!.storage;
  const { error: creationError } = await api.createBucket(env.supabaseBucket, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "audio/mpeg", "audio/wav", "video/mp4"],
  });
  if (creationError) {
    const { error: retryError } = await bucket().list("", { limit: 1 });
    if (retryError) throw new Error("No se pudo preparar el bucket privado de Supabase");
  }
}

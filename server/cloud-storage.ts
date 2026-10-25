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

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./config";
import { HttpError } from "./http";

export function agentDb() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL"), key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(503, "Supabase is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function checkDb(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (["42P01", "42703", "PGRST204", "PGRST205", "PGRST202"].includes(error.code ?? "")) throw new HttpError(503, "Apply the agent onboarding migration in Supabase to enable registration");
  // Database details can include submitted credentials or internal structure.
  throw new HttpError(500, "The registry could not save this change");
}

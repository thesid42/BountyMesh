import type { Session, User } from "@supabase/supabase-js";
import { agentDb } from "./agent-db";
import { HttpError } from "./http";

const ACCESS = "bountymesh_owner_access", REFRESH = "bountymesh_owner_refresh";
function cookie(request: Request, name: string): string {
  const value = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
  try { return decodeURIComponent(value); } catch { return ""; }
}
export function setOwnerCookies(response: Response, request: Request, session: Session | null): Response {
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const suffix = `; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  response.headers.append("set-cookie", `${ACCESS}=${encodeURIComponent(session?.access_token ?? "")}; Max-Age=${session ? session.expires_in : 0}${suffix}`);
  response.headers.append("set-cookie", `${REFRESH}=${encodeURIComponent(session?.refresh_token ?? "")}; Max-Age=${session ? 30 * 86400 : 0}${suffix}`);
  return response;
}
export async function resolveOwner(request: Request): Promise<{ user: User | null; session: Session | null }> {
  const access = cookie(request, ACCESS), refresh = cookie(request, REFRESH);
  if (!access && !refresh) return { user: null, session: null };
  const db = agentDb();
  if (access) {
    const { data, error } = await db.auth.getUser(access);
    if (!error && data.user) return { user: data.user, session: null };
  }
  if (refresh) {
    const { data, error } = await db.auth.refreshSession({ refresh_token: refresh });
    if (!error && data.user && data.session) return { user: data.user, session: data.session };
  }
  return { user: null, session: null };
}
export async function requireOwner(request: Request) {
  const owner = await resolveOwner(request);
  if (!owner.user) throw new HttpError(401, "Sign in to manage your agents");
  return owner as { user: User; session: Session | null };
}

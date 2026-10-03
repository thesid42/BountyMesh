import { agentDb } from "@/lib/agent-db";
import { readJsonBody, requireSameOrigin, safeError, HttpError } from "@/lib/http";
import { resolveOwner, setOwnerCookies } from "@/lib/owner-auth";

export const runtime = "nodejs";
const headers = { "cache-control": "no-store" };
export async function GET(request: Request) {
  try {
    const { user, session } = await resolveOwner(request);
    const response = Response.json({ owner: user ? { id: user.id, email: user.email, name: user.user_metadata?.display_name ?? "Agent owner" } : null }, { headers });
    return session ? setOwnerCookies(response, request, session) : response;
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers }); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJsonBody(request);
    if (body.action === "logout") return setOwnerCookies(Response.json({ owner: null }, { headers }), request, null);
    if (body.action !== "login" && body.action !== "signup") throw new HttpError(400, "Choose login or signup");
    if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new HttpError(400, "Enter a valid email address");
    if (typeof body.password !== "string" || body.password.length < (body.action === "signup" ? 10 : 1) || body.password.length > 128) throw new HttpError(400, "Enter a valid password (at least 10 characters for signup)");
    const db = agentDb();
    const credentials = { email: body.email.trim(), password: body.password };
    const result = body.action === "signup"
      ? await db.auth.signUp({ ...credentials, options: { data: { display_name: typeof body.name === "string" ? body.name.trim().slice(0, 60) : "Agent owner" } } })
      : await db.auth.signInWithPassword(credentials);
    if (result.error) throw new HttpError(result.error.status === 429 ? 429 : 400, body.action === "login" ? "Sign-in failed. Check your credentials and confirm your email." : "Signup could not complete. Check your details or try signing in.");
    const { user, session } = result.data;
    const response = Response.json({ owner: user && session ? { id: user.id, email: user.email, name: user.user_metadata?.display_name ?? "Agent owner" } : null, message: session ? "Signed in" : "Check your email to confirm your account, then sign in." }, { headers });
    return session ? setOwnerCookies(response, request, session) : response;
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers }); }
}

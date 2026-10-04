import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getConfig, getEnv } from "./config";
import type { RunInput } from "./contracts";

export class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function bearer(request: Request): boolean {
  const expected = getEnv("OPERATOR_TOKEN"); if (!expected) return false;
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function requestOrigin(request: Request): string {
  const targetUrl = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? targetUrl.host).split(",")[0].trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? targetUrl.protocol.slice(0, -1);
  return new URL(`${protocol}://${host}`).origin;
}
export function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === requestOrigin(request);
    } catch { return false; }
  }
  return true;
}
const SESSION_COOKIE = "bountymesh_session";
const SESSION_SECONDS = 8 * 60 * 60;
function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`bountymesh-session-v1:${payload}`).digest("base64url");
}
function session(request: Request): boolean {
  const secret = getEnv("OPERATOR_TOKEN");
  if (!secret || !sameOrigin(request)) return false;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!cookie || cookie.length > 1024) return false;
  const parts = cookie.split(".");
  if (parts.length !== 2) return false;
  const expected = Buffer.from(signature(parts[0], secret)); const supplied = Buffer.from(parts[1]);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { version?: number; expires?: number; origin?: string };
    const now = Math.floor(Date.now() / 1000);
    return value.version === 1 && Number.isInteger(value.expires) && value.expires! > now
      && value.expires! <= now + SESSION_SECONDS && value.origin === requestOrigin(request);
  } catch { return false; }
}
function loopback(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]", "::ffff:127.0.0.1"].includes(host.toLowerCase());
}
function localSessionAllowed(request: Request): boolean {
  if (getEnv("__BOUNTYMESH_LOOPBACK_BOUND") === "0" || !request.headers.get("origin")) return false;
  try {
    const origin = new URL(requestOrigin(request));
    if (!loopback(origin.hostname) || !loopback(new URL(request.url).hostname)) return false;
    const host = request.headers.get("host");
    if (host && new URL(`${origin.protocol}//${host}`).origin !== origin.origin) return false;
    const forwarded = request.headers.get("x-forwarded-for");
    return !forwarded || forwarded.split(",").every((address) => loopback(address.trim()));
  } catch { return false; }
}
export function createOperatorSession(request: Request): string | null {
  if (!sameOrigin(request)) throw new HttpError(403, "Cross-origin request rejected");
  const protectedRequest = getConfig().mode === "live" || process.env.NODE_ENV === "production";
  if (!protectedRequest) return null;
  const secret = getEnv("OPERATOR_TOKEN");
  if (!secret || (!bearer(request) && !session(request) && !localSessionAllowed(request))) {
    throw new HttpError(401, "Operator authorization required");
  }
  const origin = requestOrigin(request);
  const payload = Buffer.from(JSON.stringify({ version: 1, expires: Math.floor(Date.now() / 1000) + SESSION_SECONDS, origin, nonce: randomBytes(24).toString("base64url") })).toString("base64url");
  return `${SESSION_COOKIE}=${payload}.${signature(payload, secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${origin.startsWith("https:") ? "; Secure" : ""}`;
}
export function authorize(request: Request, mutation = false): void {
  const cfg = getConfig(); const protectedRequest = cfg.mode === "live" || process.env.NODE_ENV === "production";
  if (protectedRequest && !bearer(request) && !session(request)) throw new HttpError(401, "Operator authorization required");
  if (mutation && !sameOrigin(request)) throw new HttpError(403, "Cross-origin request rejected");
}
export function requireSameOrigin(request: Request): void {
  if (!sameOrigin(request)) throw new HttpError(403, "Cross-origin request rejected");
}
export async function readJsonBody(request: Request, limit = 16_384): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(415, "Send a JSON request body");
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new HttpError(413, "Request body is too large");
  if (!request.body) throw new HttpError(400, "Request body is required");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new HttpError(413, "Request body is too large"); }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed as Record<string, unknown>;
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Invalid JSON request body"); }
}
export async function readRunInput(request: Request): Promise<RunInput> {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "Send a JSON request body");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16_384) throw new HttpError(413, "Request body is too large");
  let raw: string;
  try {
    if (!request.body) throw new Error("body is empty");
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > 16_384) { await reader.cancel(); throw new HttpError(413, "Request body is too large"); }
      chunks.push(value);
    }
    raw = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Invalid request body"); }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new HttpError(400, "Request body must be valid JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "Request body must be an object");
  const value = parsed as Record<string, unknown>;
  if (typeof value.goal !== "string" || value.goal.trim().length < 10 || value.goal.trim().length > 2000) throw new HttpError(400, "goal must contain 10 to 2000 characters");
  if (!Number.isInteger(value.rewardCents) || (value.rewardCents as number) < 50 || (value.rewardCents as number) > 500) throw new HttpError(400, "rewardCents must be an integer from 50 to 500");
  if (typeof value.idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.idempotencyKey)) throw new HttpError(400, "idempotencyKey must be a UUID");
  return {
    goal: value.goal.trim(),
    rewardCents: value.rewardCents as number,
    idempotencyKey: value.idempotencyKey,
    shouldFail: typeof value.shouldFail === "boolean" ? value.shouldFail : undefined,
  };
}
export function safeError(error: unknown): { status: number; message: string } {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  console.error("BountyMesh API operation failed", error);
  return { status: 500, message: "BountyMesh could not complete this request" };
}

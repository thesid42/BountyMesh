import { timingSafeEqual } from "node:crypto";
import { getConfig, getEnv } from "./config";
import type { RunInput } from "./contracts";

export class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function bearer(request: Request): boolean {
  const expected = getEnv("OPERATOR_TOKEN"); if (!expected) return false;
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const targetUrl = new URL(request.url);
      const targetHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? targetUrl.host).split(",")[0].trim().toLowerCase();
      const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
      const targetProtocol = forwardedProtocol ? `${forwardedProtocol}:` : targetUrl.protocol;
      return originUrl.host.toLowerCase() === targetHost && originUrl.protocol === targetProtocol;
    } catch { return false; }
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  return true;
}
export function authorize(request: Request, mutation = false): void {
  const cfg = getConfig(); const protectedRequest = cfg.mode === "live" || process.env.NODE_ENV === "production";
  if (protectedRequest && !bearer(request)) throw new HttpError(401, "Operator authorization required");
  if (mutation && !sameOrigin(request)) throw new HttpError(403, "Cross-origin request rejected");
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
  return { goal: value.goal.trim(), rewardCents: value.rewardCents as number, idempotencyKey: value.idempotencyKey };
}
export function safeError(error: unknown): { status: number; message: string } {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  console.error("BountyMesh API operation failed", error);
  return { status: 500, message: "BountyMesh could not complete this request" };
}

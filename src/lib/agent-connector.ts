import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import type { Deliverable } from "./contracts";
import { getEnv } from "./config";
import { HttpError } from "./http";

const blocked = new BlockList();
for (const [ip, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) blocked.addSubnet(ip, prefix, "ipv4");
const ipv6Global = new BlockList(); ipv6Global.addSubnet("2000::", 3, "ipv6");
for (const [ip, prefix] of [["2001::",23],["2001:db8::",32],["2002::",16]] as const) blocked.addSubnet(ip, prefix, "ipv6");
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && ipv6Global.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
export function endpointUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 2048) throw new HttpError(400, "Enter a public HTTPS agent endpoint");
  let url: URL; try { url = new URL(value); } catch { throw new HttpError(400, "Enter a valid HTTPS endpoint"); }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || url.hash || url.search || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || (isIP(host) && !isPublicAddress(host))) throw new HttpError(400, "Agent endpoints must use public HTTPS on port 443, without URL credentials or query parameters");
  return url;
}
function encryptionKey(): Buffer {
  const key = getEnv("AGENT_SECRET_KEY");
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new HttpError(503, "Configure AGENT_SECRET_KEY to store agent connections securely");
  return Buffer.from(key, "hex");
}
export function encryptCredential(credential: string, agentId: string): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(agentId));
  const data = Buffer.concat([cipher.update(credential, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
export function decryptCredential(value: string, agentId: string): string {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new HttpError(503, "Agent connection credentials need to be updated");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(agentId)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
export function parseAgentDeliverable(value: unknown): Deliverable {
  if (!value || typeof value !== "object") throw new HttpError(502, "Agent returned an invalid deliverable");
  const d = value as Record<string, unknown>;
  if (typeof d.summary !== "string" || d.summary.trim().length < 12 || d.summary.length > 280 || typeof d.content !== "string" || d.content.trim().length < 80 || d.content.length > 6000 || !["markdown", "json"].includes(String(d.kind))) throw new HttpError(502, "Agent deliverables need a summary, bounded content, and markdown or json format");
  return { summary: d.summary.trim(), content: d.content.trim(), kind: d.kind as Deliverable["kind"] };
}
// Resolve once, validate every returned address, then pin the socket to that address.
// TLS still verifies the endpoint hostname. Redirects and private network access are rejected.
export async function callAgent(endpoint: string, token: string, payload: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> {
  const url = endpointUrl(endpoint);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(x => !isPublicAddress(x.address))) throw new HttpError(400, "The endpoint resolves to a private or reserved network");
  const address = addresses[0], body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: "POST", family: address.family, lookup: (_hostname, _options, cb) => cb(null, address.address, address.family), headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": requestId, "content-length": Buffer.byteLength(body) } }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new HttpError(502, `Agent endpoint returned HTTP ${res.statusCode ?? "unknown"}`)); return; }
      let size = 0; const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 32_768) req.destroy(new HttpError(502, "Agent response is too large")); else chunks.push(chunk); });
      res.on("error", reject);
      res.on("end", () => {
        try {
          const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("object required");
          resolve(data as Record<string, unknown>);
        } catch { reject(new HttpError(502, "Agent endpoint returned invalid JSON")); }
      });
    });
    const timeout = setTimeout(() => req.destroy(new HttpError(504, "Agent did not respond within 30 seconds")), 30_000);
    req.on("close", () => clearTimeout(timeout)); req.on("error", reject); req.end(body);
  });
}

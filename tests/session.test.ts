import test from "node:test";
import assert from "node:assert/strict";
import { authorize, createOperatorSession, HttpError } from "../src/lib/http";

function withLiveSession(fn: () => void) {
  const keys = ["BOUNTYMESH_MODE", "OPERATOR_TOKEN", "__BOUNTYMESH_LOOPBACK_BOUND"];
  const previous = keys.map((key) => process.env[key]);
  process.env.BOUNTYMESH_MODE = "live";
  process.env.OPERATOR_TOKEN = "test-private-operator-token";
  process.env.__BOUNTYMESH_LOOPBACK_BOUND = "1";
  try { fn(); } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
}
function localRequest(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://127.0.0.1:3000${path}`, { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", ...headers } });
}
const unauthorized = (error: unknown) => error instanceof HttpError && error.status === 401;

test("localhost session authenticates browser reads and writes without exposing the operator token", () => withLiveSession(() => {
  const cookie = createOperatorSession(localRequest("/api/session", { "x-forwarded-for": "127.0.0.1" }))!;
  assert.ok(cookie.includes("HttpOnly; SameSite=Strict"));
  assert.ok(!cookie.includes(process.env.OPERATOR_TOKEN!));
  const payload = cookie.split(";")[0].split("=")[1].split(".")[0];
  assert.ok(!Buffer.from(payload, "base64url").toString("utf8").includes(process.env.OPERATOR_TOKEN!));
  const browserCookie = cookie.split(";")[0];
  assert.doesNotThrow(() => authorize(localRequest("/api/state", { cookie: browserCookie })));
  assert.doesNotThrow(() => authorize(localRequest("/api/runs", { cookie: browserCookie }), true));
  assert.throws(() => authorize(localRequest("/api/state")), unauthorized);
}));

test("session rejects tampering, expiration, token rotation, and use on another host", () => withLiveSession(() => {
  const cookie = createOperatorSession(localRequest("/api/session"))!.split(";")[0];
  const separator = cookie.indexOf(".");
  const tampered = `${cookie.slice(0, separator + 1)}${cookie[separator + 1] === "a" ? "b" : "a"}${cookie.slice(separator + 2)}`;
  assert.throws(() => authorize(localRequest("/api/state", { cookie: tampered })), unauthorized);
  assert.throws(() => authorize(new Request("https://service.example/api/state", { headers: { cookie } })), unauthorized);
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + (8 * 60 * 60 + 1) * 1000;
    assert.throws(() => authorize(localRequest("/api/state", { cookie })), unauthorized);
  } finally { Date.now = originalNow; }
  process.env.OPERATOR_TOKEN = "rotated-private-operator-token";
  assert.throws(() => authorize(localRequest("/api/state", { cookie })), unauthorized);
}));

test("automatic sessions reject remote, cross-origin, proxy, and network listener requests", () => withLiveSession(() => {
  assert.throws(() => createOperatorSession(new Request("https://service.example/api/session", { headers: { origin: "https://service.example" } })), unauthorized);
  assert.throws(() => createOperatorSession(localRequest("/api/session", { origin: "https://attacker.example" })), (error) => error instanceof HttpError && error.status === 403);
  assert.throws(() => createOperatorSession(localRequest("/api/session", { "x-forwarded-for": "203.0.113.4, 127.0.0.1" })), unauthorized);
  assert.throws(() => createOperatorSession(new Request("http://127.0.0.1:3000/api/session")), unauthorized);
  process.env.__BOUNTYMESH_LOOPBACK_BOUND = "0";
  assert.throws(() => createOperatorSession(localRequest("/api/session", { "x-forwarded-for": "127.0.0.1" })), unauthorized);
}));

test("remote operator credentials create a secure cookie while cookie CSRF remains rejected", () => withLiveSession(() => {
  process.env.__BOUNTYMESH_LOOPBACK_BOUND = "0";
  const cookie = createOperatorSession(new Request("https://service.example/api/session", { headers: {
    origin: "https://service.example", authorization: `Bearer ${process.env.OPERATOR_TOKEN}`,
  } }))!;
  assert.ok(cookie.endsWith("; Secure"));
  assert.doesNotThrow(() => authorize(new Request("https://service.example/api/state", { headers: { cookie: cookie.split(";")[0] } })));
  assert.throws(() => authorize(new Request("https://service.example/api/runs", { headers: {
    cookie: cookie.split(";")[0], origin: "https://attacker.example", "sec-fetch-site": "cross-site",
  } }), true), unauthorized);
}));

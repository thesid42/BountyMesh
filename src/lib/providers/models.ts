import { getConfig, getEnv } from "../config";
import type { Deliverable } from "../contracts";

async function fetchJson(url: string, init: RequestInit, label: string): Promise<any> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${label} provider returned HTTP ${response.status}`);
  return body;
}
function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); } catch { throw new Error("AI provider returned invalid structured output"); }
}
function bounded(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new Error(`AI provider returned an invalid ${label}`);
  return value.trim();
}

export interface Plan { title: string; description: string }
export async function planBounty(goal: string): Promise<Plan> {
  const apiKey = getEnv("ANTHROPIC_API_KEY"); if (!apiKey) throw new Error("Anthropic API key is not configured");
  const model = getConfig().orchestratorModel;
  const data = await fetchJson("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 700, thinking: { type: "disabled" }, system: "You are a task planner for an agent bounty marketplace. Create exactly one concise research or data visualization task that advances the user's goal. Never request code execution, access to credentials, or external side effects. Return JSON only with title and description strings.", messages: [{ role: "user", content: `Goal: ${goal}` }] }) }, "Anthropic");
  const text = (data.content ?? []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n");
  const parsed = extractJson(text) as Record<string, unknown>;
  return { title: bounded(parsed.title, 8, 120, "title"), description: bounded(parsed.description, 20, 900, "task description") };
}
async function gemini(prompt: string, json = true): Promise<string> {
  const apiKey = getEnv("GEMINI_API_KEY"); if (!apiKey) throw new Error("Gemini API key is not configured");
  const model = getConfig().workerModel;
  const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "low" }, ...(json ? { responseMimeType: "application/json" } : {}) } }) }, "Gemini");
  const text = data.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("");
  if (typeof text !== "string" || !text.trim()) throw new Error("Gemini provider returned no content");
  return text;
}
export async function produceDeliverable(goal: string, task: string): Promise<Deliverable> {
  const parsed = extractJson(await gemini(`Complete this research and data-visualization specification task using your existing knowledge. Do not execute code or claim to have browsed sources. Be explicit about assumptions and uncertainty. Return JSON with summary (one sentence), content (a concise Markdown report with a visualization specification), and kind exactly "markdown".\nUser goal: ${goal}\nAssigned task: ${task}`)) as Record<string, unknown>;
  const summary = bounded(parsed.summary, 12, 280, "deliverable summary");
  const content = bounded(parsed.content, 80, 6000, "deliverable content");
  if (parsed.kind !== "markdown") throw new Error("Gemini provider returned an unsupported deliverable format");
  return { summary, content, kind: "markdown" };
}
export async function reviewDeliverable(goal: string, task: string, deliverable: Deliverable): Promise<string> {
  const data = await fetchJson("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": getEnv("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: getConfig().orchestratorModel, max_tokens: 500, thinking: { type: "disabled" }, system: "Review the worker's text-only deliverable against the requested task. Never assume it executed code or browsed the web. Return JSON only: {\"approved\": boolean, \"review\": string}. Approve a useful, internally consistent response that states limits.", messages: [{ role: "user", content: JSON.stringify({ goal, task, deliverable }) }] }) }, "Anthropic");
  const parsed = extractJson((data.content ?? []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n")) as Record<string, unknown>;
  const review = bounded(parsed.review, 10, 500, "review");
  if (parsed.approved !== true) throw new Error(`Quality review failed: ${review}`);
  return review;
}
export async function embedText(text: string): Promise<number[]> {
  const key = getEnv("GEMINI_API_KEY"); if (!key) throw new Error("Gemini API key is not configured");
  const model = "gemini-embedding-001";
  const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ content: { parts: [{ text }] }, output_dimensionality: 768 }) }, "Gemini embedding");
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768 || values.some((v: unknown) => typeof v !== "number" || !Number.isFinite(v))) throw new Error("Gemini embedding provider returned an invalid vector");
  return values;
}

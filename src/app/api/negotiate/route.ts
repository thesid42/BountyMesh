import { getConfig, getEnv } from "@/lib/config";
import { HttpError, authorize } from "@/lib/http";
import { getSnapshot } from "@/lib/engine";
import type { Run, Snapshot } from "@/lib/contracts";
import { synthesizeNegotiationVoice } from "@/lib/negotiation-audio";

export const runtime = "nodejs";
export const maxDuration = 45;

export interface NegotiationTurn {
  id: string;
  speaker: "traveler" | "claude" | "gemini" | "specialist";
  speakerName: string;
  voice: "Kore" | "Charon" | "Puck" | "Fenrir";
  text: string;
  dialogueBadge: string;
  color: string;
  audioBase64?: string;
  audioMimeType?: string;
}

interface NegotiationInput {
  runId?: string;
  idempotencyKey?: string;
  synthesizeAudio: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8_192;

async function readInput(request: Request): Promise<NegotiationInput> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpError(415, "Send a JSON request body");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");

  let raw: string;
  try {
    if (!request.body) throw new Error("empty");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Request body is too large");
      }
      chunks.push(result.value);
    }
    raw = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid request body");
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new HttpError(400, "Request body must be valid JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "Request body must be an object");
  const body = parsed as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["runId", "idempotencyKey", "synthesizeAudio"].includes(key))) {
    throw new HttpError(400, "Only persisted run identifiers and synthesizeAudio are accepted");
  }
  if (body.runId !== undefined && (typeof body.runId !== "string" || !UUID.test(body.runId))) throw new HttpError(400, "runId must be a UUID");
  if (body.idempotencyKey !== undefined && (typeof body.idempotencyKey !== "string" || !UUID.test(body.idempotencyKey))) throw new HttpError(400, "idempotencyKey must be a UUID");
  if (typeof body.runId !== "string" && typeof body.idempotencyKey !== "string") throw new HttpError(400, "A persisted runId or idempotencyKey is required");
  if (body.synthesizeAudio !== undefined && typeof body.synthesizeAudio !== "boolean") throw new HttpError(400, "synthesizeAudio must be a boolean");
  return {
    runId: body.runId as string | undefined,
    idempotencyKey: body.idempotencyKey as string | undefined,
    synthesizeAudio: body.synthesizeAudio === true,
  };
}

function cleanText(value: string, max = 500): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function makeTurn(
  id: number,
  speaker: NegotiationTurn["speaker"],
  speakerName: string,
  voice: NegotiationTurn["voice"],
  text: string,
  dialogueBadge: string,
  color: string,
): NegotiationTurn {
  return { id: "turn-" + id, speaker, speakerName, voice, text: cleanText(text), dialogueBadge: cleanText(dialogueBadge, 64), color };
}

function buildPersistedTurns(snapshot: Snapshot, run: Run): NegotiationTurn[] {
  const bounty = snapshot.bounties.find((item) => item.runId === run.id) ?? null;
  const worker = bounty?.workerId ? snapshot.agents.find((item) => item.id === bounty.workerId) ?? null : null;
  const hold = bounty ? snapshot.ledger.find((entry) => entry.bountyId === bounty.id && entry.kind === "hold") ?? null : null;
  const refund = bounty ? snapshot.ledger.some((entry) => entry.bountyId === bounty.id && entry.kind === "refund") : false;
  const payout = bounty ? snapshot.ledger.find((entry) => entry.bountyId === bounty.id && entry.kind === "payout") ?? null : null;
  const holdIsActive = Boolean(hold && !refund && bounty?.escrowStatus === "held" && bounty.status !== "failed");
  const payoutIsRecorded = Boolean(payout && payout.provider === "stripe" && bounty?.status === "paid" && bounty.escrowStatus === "settled" && bounty.transferId);
  const reward = bounty?.rewardCents ?? run.rewardCents ?? null;
  const amount = reward === null ? null : "$" + (reward / 100).toFixed(2);
  const runState = run.status;
  const bountyState = bounty?.status ?? "not created";
  const match = bounty?.similarity;
  const goal = cleanText(run.goal, 320);

  return [
    makeTurn(1, "traveler", "Traveler", "Kore", "The recorded request is: " + goal + ".", "Persisted request selected", "#d4b86a"),
    makeTurn(2, "claude", "Claude Orchestrator", "Charon", "The persisted run status is " + runState + ". The bounty status is " + bountyState + ".", "Run state from database", "#8f79a6"),
    makeTurn(3, worker?.id === "22222222-2222-4222-8222-222222222222" ? "gemini" : "specialist", worker?.name ?? "Claude Orchestrator", worker ? "Puck" : "Charon",
      worker
        ? "The persisted bounty assigns this work to " + cleanText(worker.name, 80) + (typeof match === "number" ? " with " + (match * 100).toFixed(1) + "% recorded similarity." : ".")
        : "No worker assignment is recorded for this bounty.",
      worker && typeof match === "number" ? "Recorded skill match" : "Worker assignment state",
      worker?.id === "22222222-2222-4222-8222-222222222222" ? "#6d8e9c" : "#84a96e"),
    makeTurn(4, "claude", "Claude Orchestrator", "Charon",
      bounty?.deliverable
        ? "A deliverable is persisted for review status " + (bounty.review ? "reviewed" : "awaiting review") + "."
        : "No deliverable is persisted yet. Current bounty status: " + bountyState + ".",
      bounty?.deliverable ? "Persisted deliverable state" : "No deliverable recorded", "#8f79a6"),
    makeTurn(5, "traveler", "Traveler", "Kore",
      payoutIsRecorded && amount
        ? "A " + amount + " payout is recorded in the ledger" + (bounty?.transferId ? " with a transfer receipt." : ".")
        : holdIsActive && amount
          ? "A " + amount + " hold is recorded. No completed payout is recorded."
          : "No active hold or completed payout is recorded.",
      payoutIsRecorded ? "Payout recorded" : holdIsActive ? "Hold recorded, unpaid" : "No hold or payout recorded",
      payoutIsRecorded ? "#84a96e" : "#d4b86a"),
  ];
}

const trustedSpeechLine = (index: number, run: Run, snapshot: Snapshot): string => {
  const bounty = snapshot.bounties.find((item) => item.runId === run.id) ?? null;
  const runState = run.status;
  const bountyState = bounty?.status ?? "not created";
  const hold = bounty ? snapshot.ledger.some((entry) => entry.bountyId === bounty.id && entry.kind === "hold") : false;
  const refund = bounty ? snapshot.ledger.some((entry) => entry.bountyId === bounty.id && entry.kind === "refund") : false;
  const payout = bounty ? snapshot.ledger.some((entry) => entry.bountyId === bounty.id && entry.kind === "payout"
    && entry.provider === "stripe" && Boolean(bounty.transferId) && bounty.status === "paid" && bounty.escrowStatus === "settled") : false;
  const activeHold = hold && !refund && bounty?.escrowStatus === "held" && bounty.status !== "failed";
  if (index === 0) return "A persisted BountyMesh request is selected.";
  if (index === 1) return "Run status " + runState + ". Bounty status " + bountyState + ".";
  if (index === 2) return "Worker assignment status " + (bounty?.workerId ? "recorded" : "not recorded") + ".";
  if (index === 3) return "Deliverable status " + (bounty?.deliverable ? "recorded" : "not recorded") + ".";
  if (payout && bounty?.status === "paid") return "Payout recorded.";
  if (activeHold) return "Escrow hold recorded. Payout not recorded.";
  return "No active hold or completed payout is recorded.";
};

function responseError(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "Negotiation data is temporarily unavailable" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    authorize(request, true);
    const input = await readInput(request);
    const config = getConfig();
    const localTestFixture = process.env.NODE_ENV === "test"
      && getEnv("BOUNTYMESH_TEST_FIXTURES") === "local"
      && getEnv("BOUNTYMESH_MODE") === "demo";
    if (config.mode !== "live" && !localTestFixture) throw new HttpError(503, "Negotiation requires the connected online workspace");
    if (config.mode === "live" && (!config.ready || config.storage !== "supabase" || config.payments !== "stripe")) {
      throw new HttpError(503, "The connected online workspace is not fully configured");
    }

    const snapshot = await getSnapshot();
    const byId = input.runId ? snapshot.runs.find((item) => item.id === input.runId) ?? null : null;
    const byKey = input.idempotencyKey ? snapshot.runs.find((item) => item.idempotencyKey === input.idempotencyKey) ?? null : null;
    if (byId && byKey && byId.id !== byKey.id) throw new HttpError(400, "The supplied identifiers refer to different runs");
    if ((input.runId && !byId) || (input.idempotencyKey && !byKey)) throw new HttpError(404, "The selected persisted run was not found");
    const run = byId ?? byKey;
    if (!run) throw new HttpError(404, "The selected persisted run was not found");

    const turns = buildPersistedTurns(snapshot, run);
    const apiKey = input.synthesizeAudio && config.mode === "live" ? getEnv("GEMINI_API_KEY") : "";
    let hasAudio = false;
    if (apiKey) {
      const voices: NegotiationTurn["voice"][] = ["Kore", "Charon", "Puck", "Charon", "Kore"];
      const audio = await Promise.all(turns.map((_, index) => synthesizeNegotiationVoice(trustedSpeechLine(index, run, snapshot), voices[index], apiKey)));
      audio.forEach((result, index) => {
        if (!result) return;
        turns[index].audioBase64 = result.data;
        turns[index].audioMimeType = result.mimeType;
        hasAudio = true;
      });
    }

    const audioStatus = !input.synthesizeAudio ? "not-requested" : hasAudio ? "available" : "unavailable";
    return Response.json({
      success: true,
      mode: config.mode,
      provider: "persisted-state",
      hasAudio,
      audioStatus,
      turns,
    });
  } catch (error) {
    return responseError(error);
  }
}

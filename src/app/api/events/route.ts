import { getSnapshot } from "@/lib/engine";
import { authorize, safeError } from "@/lib/http";
import { subscribeChanges } from "@/lib/repository";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try { authorize(request); } catch (error) { const result = safeError(error); return Response.json({ error: result.message }, { status: result.status }); }
  const encoder = new TextEncoder(); let timer: ReturnType<typeof setInterval> | undefined; let heartbeat: ReturnType<typeof setInterval> | undefined; let unsubscribe: () => void = () => {}; let closed = false; let sending = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = async () => {
        if (closed || sending) return;
        sending = true;
        try {
          const snapshot = await getSnapshot();
          controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          try { controller.enqueue(encoder.encode(`event: error\ndata: {"error":"Snapshot is temporarily unavailable"}\n\n`)); } catch { /* stream closed */ }
        } finally { sending = false; }
      };
      void send();
      let pollingInterval = getConfig().storage === "local" ? 750 : 15_000;
      try {
        unsubscribe = subscribeChanges(() => { void send(); });
      } catch {
        // Keep SSE usable during a realtime outage by polling snapshots more often.
        pollingInterval = 1_500;
      }
      timer = setInterval(() => { void send(); }, pollingInterval);
      heartbeat = setInterval(() => { try { controller.enqueue(encoder.encode(": keep-alive\n\n")); } catch { /* stream closed */ } }, 10_000);
      request.signal.addEventListener("abort", () => { closed = true; if (timer) clearInterval(timer); if (heartbeat) clearInterval(heartbeat); unsubscribe(); try { controller.close(); } catch { /* response already closed */ } }, { once: true });
    },
    cancel() { closed = true; if (timer) clearInterval(timer); if (heartbeat) clearInterval(heartbeat); unsubscribe(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}

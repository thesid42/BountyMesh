import { getEnv } from "@/lib/config";
import { authorize, HttpError, safeError } from "@/lib/http";
import { synthesizeNegotiationVoice, type NegotiationVoice } from "@/lib/negotiation-audio";

export const runtime = "nodejs";

const VOICE_MAP: Record<string, NegotiationVoice> = {
  traveler: "Kore",
  claude: "Charon",
  gemini: "Puck",
  specialist: "Fenrir",
  sentinel: "Charon",
};

// In-memory cache for audio clips to avoid re-synthesizing repeated lines
const audioCache = new Map<string, { data: string; mimeType: string }>();

export async function POST(request: Request) {
  try {
    authorize(request, false);
    const body = await request.json().catch(() => ({}));
    const rawText = typeof body.text === "string" ? body.text.trim() : "";
    if (!rawText) throw new HttpError(400, "text is required");

    const speaker = typeof body.speaker === "string" ? body.speaker.toLowerCase() : "claude";
    const voice: NegotiationVoice =
      typeof body.voice === "string" && ["Kore", "Charon", "Puck", "Fenrir"].includes(body.voice)
        ? (body.voice as NegotiationVoice)
        : VOICE_MAP[speaker] || "Charon";

    const text = rawText.slice(0, 240);
    const cacheKey = `${voice}:${text}`;

    if (audioCache.has(cacheKey)) {
      const cached = audioCache.get(cacheKey)!;
      return Response.json({ success: true, audioBase64: cached.data, mimeType: cached.mimeType });
    }

    const apiKey = getEnv("GEMINI_API_KEY");
    if (!apiKey) throw new HttpError(503, "Gemini API key is not configured");

    const clip = await synthesizeNegotiationVoice(text, voice, apiKey);
    if (!clip?.data) throw new HttpError(502, "Failed to synthesize voice with Gemini API");

    if (audioCache.size > 150) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, clip);

    return Response.json({
      success: true,
      audioBase64: clip.data,
      mimeType: clip.mimeType || "audio/wav",
    });
  } catch (error) {
    const err = safeError(error);
    return Response.json({ error: err.message }, { status: err.status });
  }
}

export type NegotiationVoice = "Kore" | "Charon" | "Puck" | "Fenrir";

const MAX_AUDIO_B64_LENGTH = 1_500_000;

export async function synthesizeNegotiationVoice(
  text: string,
  voice: NegotiationVoice,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{ data: string; mimeType: string } | null> {
  if (!apiKey || text.length > 240) return null;
  try {
    const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice } } },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const audio = parts.find((part: any) => part?.inlineData?.data)?.inlineData;
    if (typeof audio?.data !== "string" || audio.data.length > MAX_AUDIO_B64_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio.data)) return null;
    if (typeof audio.mimeType !== "string" || audio.mimeType.toLowerCase() !== "audio/wav") return null;
    return { data: audio.data, mimeType: "audio/wav" };
  } catch {
    return null;
  }
}

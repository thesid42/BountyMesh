import { getConfig, getEnv } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function cleanJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Synthesize spoken voice using Google Gemini TTS model
async function synthesizeVoiceWithGemini(
  text: string,
  voiceName: string,
  apiKey: string
): Promise<{ data: string; mimeType: string } | null> {
  const models = ["gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) {
        return {
          data: inlineData.data,
          mimeType: inlineData.mimeType || "audio/wav",
        };
      }
    } catch {
      // Try next model if any
    }
  }

  return null;
}

// Generate live multi-agent dialogue text via Google Gemini
async function generateDialogueWithGemini(
  goal: string,
  rewardFormatted: string,
  apiKey: string
): Promise<Omit<NegotiationTurn, "audioBase64" | "audioMimeType">[] | null> {
  const models = ["gemini-3.8-flash", "gemini-flash-latest"];

  const prompt = `You are orchestrating a live multi-agent conversation in the BountyMesh guild between autonomous AI agents.
Client Quest Objective: "${goal}"
Escrow Reward: ${rewardFormatted}

The participating agents talking to each other are:
1. "traveler" (Traveler / Client who specifies requirements and locks escrow)
2. "claude" (Claude Orchestrator who evaluates vector similarity, decomposes deliverables, and awards subcontracts)
3. "gemini" (Gemini Scholar specialist worker who analyzes the task domain, pitches data synthesis & visualization spec, and submits a bid)
4. "specialist" (Specialist Ranger worker who pitches competitive benchmarking and rubric verification)

Create an authentic, intelligent 5-turn conversation where they directly discuss and negotiate this specific task:
- Turn 1 (speaker: "traveler", speakerName: "Traveler", voice: "Kore"): Traveler specifies the exact goal and the ${rewardFormatted} escrow stake.
- Turn 2 (speaker: "claude", speakerName: "Claude Orchestrator", voice: "Charon"): Claude breaks down the objective requirements and invites capability bids from registered specialist agents.
- Turn 3 (speaker: "gemini", speakerName: "Gemini Scholar", voice: "Puck"): Gemini Scholar pitches an exact methodology addressing the task, citing ~94% pgvector capability alignment, and bids for the contract.
- Turn 4 (speaker: "specialist", speakerName: "Specialist Ranger", voice: "Fenrir"): Specialist Ranger provides a competitive angle or rubric check, acknowledging Gemini's alignment on this task.
- Turn 5 (speaker: "claude", speakerName: "Claude Orchestrator", voice: "Charon"): Claude evaluates vector similarity, awards the contract to Gemini Scholar for ${rewardFormatted}, and confirms the escrow lock.

Return ONLY a valid JSON array of 5 objects (no markdown, no emojis). Each object must have:
- "id": string ("turn-1", "turn-2", ...)
- "speaker": exactly "traveler", "claude", "gemini", or "specialist"
- "speakerName": string
- "voice": "Kore" | "Charon" | "Puck" | "Fenrir"
- "text": string (the in-character dialogue line speaking to the others)
- "dialogueBadge": string (short 4-6 word summary for speech bubble)
- "color": hex color code`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            thinkingConfig: { thinkingLevel: "low" },
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = cleanJson(rawText);
      if (Array.isArray(parsed) && parsed.length >= 4) {
        return parsed.map((item: any, idx: number) => {
          let speaker: NegotiationTurn["speaker"] = "traveler";
          let voice: NegotiationTurn["voice"] = "Kore";
          const s = String(item.speaker || "").toLowerCase();

          if (s.includes("claude")) {
            speaker = "claude";
            voice = "Charon";
          } else if (s.includes("gemini")) {
            speaker = "gemini";
            voice = "Puck";
          } else if (s.includes("specialist") || s.includes("ranger")) {
            speaker = "specialist";
            voice = "Fenrir";
          } else {
            const defaults: NegotiationTurn["speaker"][] = ["traveler", "claude", "gemini", "specialist", "claude"];
            const voiceDefaults: NegotiationTurn["voice"][] = ["Kore", "Charon", "Puck", "Fenrir", "Charon"];
            speaker = defaults[idx] || "claude";
            voice = voiceDefaults[idx] || "Charon";
          }

          const defaultColors: Record<NegotiationTurn["speaker"], string> = {
            traveler: "#d4b86a",
            claude: "#8f79a6",
            gemini: "#6d8e9c",
            specialist: "#84a96e",
          };

          return {
            id: item.id || `turn-${idx + 1}`,
            speaker,
            speakerName: item.speakerName || (speaker === "claude" ? "Claude Orchestrator" : speaker === "gemini" ? "Gemini Scholar" : speaker === "specialist" ? "Specialist Ranger" : "Traveler"),
            voice,
            text: String(item.text || "").replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim(),
            dialogueBadge: String(item.dialogueBadge || "").replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim(),
            color: item.color || defaultColors[speaker],
          };
        });
      }
    } catch {
      // Try next model
    }
  }

  return null;
}

// Default fallback turns
function getDefaultTurns(goal: string, rewardFormatted: string): NegotiationTurn[] {
  return [
    {
      id: "turn-1",
      speaker: "traveler",
      speakerName: "Traveler",
      voice: "Kore",
      text: `Traveler seeking guild assistance for this quest: ${goal}. I am locking ${rewardFormatted} in verified escrow.`,
      dialogueBadge: `QUEST: ${goal.slice(0, 24)}... [${rewardFormatted}]`,
      color: "#d4b86a",
    },
    {
      id: "turn-2",
      speaker: "claude",
      speakerName: "Claude Orchestrator",
      voice: "Charon",
      text: `Quest directive logged. Generating 768-dimensional capability embeddings and requesting specialist bids.`,
      dialogueBadge: "Matching capability vectors...",
      color: "#8f79a6",
    },
    {
      id: "turn-3",
      speaker: "gemini",
      speakerName: "Gemini Scholar",
      voice: "Puck",
      text: `Gemini Scholar bidding. Capability fit 94.2% on market synthesis and visualization planning.`,
      dialogueBadge: "BID: 94.2% Fit · Ready to execute",
      color: "#6d8e9c",
    },
    {
      id: "turn-4",
      speaker: "specialist",
      speakerName: "Specialist Ranger",
      voice: "Fenrir",
      text: `Specialist Ranger bidding. Prepared for competitive rubric verification with 88.5% vector similarity.`,
      dialogueBadge: "BID: 88.5% Fit · Standby",
      color: "#84a96e",
    },
    {
      id: "turn-5",
      speaker: "claude",
      speakerName: "Claude Orchestrator",
      voice: "Charon",
      text: `Evaluation complete. Gemini Scholar demonstrates optimal semantic alignment at 94.2%. Contract awarded at ${rewardFormatted}. Escrow secured in Vault. Proceed with delivery.`,
      dialogueBadge: `Awarded to Gemini for ${rewardFormatted}`,
      color: "#84a96e",
    },
  ];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const goal = typeof body.goal === "string" && body.goal.trim() ? body.goal.trim() : "Market analysis and visualization brief";
    const rewardCents = typeof body.rewardCents === "number" && body.rewardCents >= 50 ? body.rewardCents : 50;
    const rewardFormatted = `$${(rewardCents / 100).toFixed(2)}`;

    const clientApiKey = request.headers.get("x-gemini-key")?.trim() || "";
    const geminiKey = clientApiKey || getEnv("GEMINI_API_KEY");

    let turns: NegotiationTurn[] = [];
    let provider = "guild-engine";

    // 1. Generate in-character dialogue lines with Gemini
    if (geminiKey) {
      const generated = await generateDialogueWithGemini(goal, rewardFormatted, geminiKey);
      if (generated && generated.length >= 4) {
        turns = generated as NegotiationTurn[];
        provider = "gemini-live";
      }
    }

    if (turns.length === 0) {
      turns = getDefaultTurns(goal, rewardFormatted);
    }

    // 2. Synthesize audio for each character turn using Google Gemini TTS!
    if (geminiKey) {
      const voiceMap: Record<NegotiationTurn["speaker"], "Kore" | "Charon" | "Puck" | "Fenrir"> = {
        traveler: "Kore",
        claude: "Charon",
        gemini: "Puck",
        specialist: "Fenrir",
      };

      await Promise.all(
        turns.map(async (turn) => {
          const voice = turn.voice || voiceMap[turn.speaker] || "Kore";
          const audio = await synthesizeVoiceWithGemini(turn.text, voice, geminiKey);
          if (audio?.data) {
            turn.audioBase64 = audio.data;
            turn.audioMimeType = audio.mimeType || "audio/wav";
          }
        })
      );
    }

    const hasAudio = turns.some((t) => Boolean(t.audioBase64));

    return Response.json({
      success: true,
      provider: hasAudio ? "gemini-audio" : provider,
      hasAudio,
      turns,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate negotiation" },
      { status: 500 }
    );
  }
}

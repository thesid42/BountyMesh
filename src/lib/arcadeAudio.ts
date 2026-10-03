// Pure Web Audio API Sound Synthesizer, Live Model Voice Player & Audio Engine
// Supports Google Gemini 24kHz Audio & WAV Streams, 100% reliable, zero emojis

export type ArcadeSpeaker = "traveler" | "claude" | "gemini" | "specialist" | "sentinel";

class ArcadeAudioEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public voiceEnabled = true;
  public playbackRate = 1.0;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentPlaybackResolve: (() => void) | null = null;
  private pendingSpeechResolve: (() => void) | null = null;
  private speechEpoch = 0;

  private speechIsActive(epoch: number): boolean {
    return epoch === this.speechEpoch && this.enabled && this.voiceEnabled;
  }

  private cancelCurrentPlayback() {
    const resolvePlayback = this.currentPlaybackResolve;
    this.currentPlaybackResolve = null;
    resolvePlayback?.();
    const source = this.currentSource;
    this.currentSource = null;
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // It may already have ended.
      }
    }
    this.pendingSpeechResolve?.();
    this.pendingSpeechResolve = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public initCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // Soft retro character voice chatter (Zelda / Undertale / RPG style)
  playTalkChirp(speaker: ArcadeSpeaker) {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    let baseFreq = 300;
    let waveType: OscillatorType = "sine";

    switch (speaker) {
      case "claude":
        baseFreq = 210;
        waveType = "sine";
        break;
      case "gemini":
        baseFreq = 480;
        waveType = "triangle";
        break;
      case "specialist":
        baseFreq = 340;
        waveType = "triangle";
        break;
      case "sentinel":
        baseFreq = 230;
        waveType = "triangle";
        break;
      case "traveler":
      default:
        baseFreq = 270;
        waveType = "sine";
        break;
    }

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.05;
      const jitter = (Math.random() - 0.5) * 16;

      osc.type = waveType;
      osc.frequency.setValueAtTime(baseFreq + jitter, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, t + 0.035);

      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.04);
    }
  }

  // Stop any active spoken audio immediately
  stopSpeech() {
    this.speechEpoch += 1;
    this.cancelCurrentPlayback();
  }

  // Skip current spoken line immediately
  skipSpeech() {
    this.stopSpeech();
  }

  // Play provider audio. Raw PCM fallback is accepted only when its MIME type
  // explicitly identifies mono 16-bit PCM and supplies a sample rate.
  async playBase64Audio(base64: string, mimeType = "audio/wav", expectedEpoch?: number): Promise<boolean> {
    const epoch = expectedEpoch ?? ++this.speechEpoch;
    if (expectedEpoch === undefined) this.cancelCurrentPlayback();
    if (!this.speechIsActive(epoch)) return false;
    const ctx = this.initCtx();
    if (!ctx) return false;

    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      return false;
    }
    if (!this.speechIsActive(epoch)) return false;

    let bytes: Uint8Array;
    try {
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      return false;
    }

    let audioBuffer: AudioBuffer | null = null;
    try {
      audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        let settled = false;
        try {
          const promise = ctx.decodeAudioData(
            (bytes.buffer as ArrayBuffer).slice(0),
            (buf) => {
              if (!settled) {
                settled = true;
                resolve(buf);
              }
            },
            (err) => {
              if (!settled) {
                settled = true;
                reject(err);
              }
            }
          );
          if (promise && typeof (promise as unknown as Promise<AudioBuffer>).then === "function") {
            (promise as unknown as Promise<AudioBuffer>)
              .then((buf) => {
                if (!settled) {
                  settled = true;
                  resolve(buf);
                }
              })
              .catch((err) => {
                if (!settled) {
                  settled = true;
                  reject(err);
                }
              });
          }
        } catch (e) {
          reject(e);
        }
      });
    } catch {
      const normalizedMime = mimeType.toLowerCase();
      const pcmMatch = normalizedMime.match(/(?:audio\/l16|codec=pcm)[^;]*rate=(\d+)/i);
      if (pcmMatch) {
        try {
          const sampleRate = Number.parseInt(pcmMatch[1] ?? "24000", 10) || 24000;
          const int16Array = new Int16Array(bytes.buffer.slice(0, bytes.byteLength - (bytes.byteLength % 2)));
          if (int16Array.length > 0) {
            audioBuffer = ctx.createBuffer(1, int16Array.length, sampleRate);
            const channel = audioBuffer.getChannelData(0);
            for (let i = 0; i < int16Array.length; i++) channel[i] = (int16Array[i] ?? 0) / 32768;
          }
        } catch {
          audioBuffer = null;
        }
      }
    }

    if (!audioBuffer) return false;

    return new Promise<boolean>((resolve) => {
      if (!this.speechIsActive(epoch)) { resolve(false); return; }
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer!;
      if (this.playbackRate && this.playbackRate !== 1) source.playbackRate.value = this.playbackRate;
      source.connect(ctx.destination);
      this.currentSource = source;

      let resolved = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const finish = (played: boolean) => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (this.currentSource === source) this.currentSource = null;
        if (this.currentPlaybackResolve === cancel) this.currentPlaybackResolve = null;
        resolve(played);
      };
      const cancel = () => finish(false);
      this.currentPlaybackResolve = cancel;
      source.onended = () => finish(this.speechIsActive(epoch));
      timeoutId = setTimeout(() => finish(this.speechIsActive(epoch)), (audioBuffer!.duration / (this.playbackRate || 1)) * 1000 + 400);
      try {
        if (!this.speechIsActive(epoch)) { finish(false); return; }
        source.start(0);
      } catch {
        finish(false);
      }
    });
  }

  // Fallback to browser speech synthesis if model audio is unavailable
  speakFallback(
    speaker: ArcadeSpeaker,
    text: string,
    expectedEpoch?: number
  ): Promise<void> {
    const epoch = expectedEpoch ?? ++this.speechEpoch;
    if (expectedEpoch === undefined) this.cancelCurrentPlayback();
    if (!this.speechIsActive(epoch) || typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();

    // Ensure speech synthesis is not stuck in paused state in Chromium/WebKit
    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      let settled = false;
      let watchdog: ReturnType<typeof setTimeout> | undefined;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (watchdog) clearTimeout(watchdog);
        if (this.pendingSpeechResolve === finish) this.pendingSpeechResolve = null;
        resolve();
      };
      this.pendingSpeechResolve = finish;
      watchdog = setTimeout(finish, Math.max(2500, Math.min(text.length * 85, 8000)));

      switch (speaker) {
        case "claude":
          utterance.pitch = 0.8;
          utterance.rate = 0.95;
          break;
        case "gemini":
          utterance.pitch = 1.15;
          utterance.rate = 1.05;
          break;
        case "specialist":
          utterance.pitch = 0.92;
          utterance.rate = 1.02;
          break;
        case "sentinel":
          utterance.pitch = 0.75;
          utterance.rate = 0.95;
          break;
        case "traveler":
        default:
          utterance.pitch = 1.0;
          utterance.rate = 1.0;
          break;
      }

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const english = voices.filter((v) => v.lang.startsWith("en"));
        if (english.length > 0) {
          if (speaker === "claude") {
            utterance.voice =
              english.find((v) => v.name.toLowerCase().includes("male") || v.name.includes("David")) ||
              english[0];
          } else if (speaker === "gemini") {
            utterance.voice =
              english.find((v) => v.name.toLowerCase().includes("natural") || v.name.includes("Alex")) ||
              english[0];
          }
        }
      }

      utterance.onend = finish;
      utterance.onerror = finish;

      if (!this.speechIsActive(epoch)) { finish(); return; }
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });
  }

  // Play a full turn of character audio: Plays real Gemini audio if returned, or fallback
  async playNegotiationTurn(turn: {
    speaker: ArcadeSpeaker;
    text: string;
    audioBase64?: string;
    audioMimeType?: string;
  }): Promise<void> {
    if (!this.enabled || !this.voiceEnabled) return;
    const epoch = ++this.speechEpoch;
    this.cancelCurrentPlayback();

    // 1. If Gemini provided actual voice audio, play the live model speech!
    if (turn.audioBase64) {
      try {
        const played = await this.playBase64Audio(turn.audioBase64, turn.audioMimeType, epoch);
        if (played || !this.speechIsActive(epoch)) return;
      } catch {
        // Fall back if decode fails
      }
    }

    // 2. Synthesize human-like speech via Gemini API endpoint
    if (typeof window !== "undefined" && typeof fetch === "function") {
      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            text: turn.text.slice(0, 240),
            speaker: turn.speaker,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as { audioBase64?: string; mimeType?: string };
          if (data.audioBase64 && this.speechIsActive(epoch)) {
            const played = await this.playBase64Audio(data.audioBase64, data.mimeType || "audio/wav", epoch);
            if (played || !this.speechIsActive(epoch)) return;
          }
        }
      } catch {
        // Fall back if network request fails
      }
    }

    if (!this.speechIsActive(epoch)) return;

    // Fallback to speech synthesis only if Gemini audio was unreachable
    await this.speakFallback(turn.speaker, turn.text, epoch);
  }

  // 8-bit coin pickup arpeggio (B5 -> E6)
  playCoin() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.08);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Warp in / character enters room
  playWarp() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Bidding alert ding / blip
  playBid() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Fanfare on quest award
  playFanfare() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  // Rapid gold payout shower
  playPayout() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playCoin();
      }, i * 70);
    }
  }

  // Parchment / Quest Notice Board rustle sound
  playPaper() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.1);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Heavy Gold Chest / Vault opening chime
  playChest() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  // Warm hearth fire stoke whoosh
  playHearth() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  // Alchemical potion vial bubbling / clink
  playPotion() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [784, 987, 1174];
    notes.forEach((freq, i) => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.05;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  // Ancient library spellbook flutter
  playBook() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Standard tactile UI button click
  playClick() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Rejection sound effect / warning buzzer on rubric failure
  playReject() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "square";

    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.exponentialRampToValueAtTime(75, now + 0.35);

    osc2.frequency.setValueAtTime(185, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.35);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.38);
    osc2.stop(now + 0.38);
  }

  // Escrow refund sound effect (gentle double coin chime)
  playRefund() {
    if (!this.enabled) return;
    this.playCoin();
    setTimeout(() => {
      this.playCoin();
    }, 120);
  }
}

export const arcadeAudio = new ArcadeAudioEngine();

// Auto-unlock AudioContext on first user interaction to satisfy browser autoplay policies
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    arcadeAudio.initCtx();
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("click", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("click", unlockAudio, { passive: true });
}

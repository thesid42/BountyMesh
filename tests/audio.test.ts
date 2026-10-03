import assert from "node:assert/strict";
import test from "node:test";

test("arcade audio rejects malformed encoded media and cancels a pending decode", async () => {
  let decoder: ((value: AudioBuffer) => void) | undefined;
  let rejectDecode = true;
  let createBufferCalls = 0;
  let sourceStarts = 0;
  let speechCancels = 0;

  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: async () => undefined,
    decodeAudioData: () => new Promise<AudioBuffer>((resolve, reject) => {
      if (rejectDecode) {
        reject(new Error("unsupported or malformed encoded audio"));
      } else {
        decoder = resolve;
      }
    }),
    createBuffer: () => {
      createBufferCalls++;
      throw new Error("unexpected raw PCM fallback");
    },
    createBufferSource: () => {
      const source: {
        playbackRate: { value: number };
        connect(): void;
        disconnect(): void;
        stop(): void;
        start(): void;
        onended: (() => void) | null;
        buffer: AudioBuffer | null;
      } = {
        playbackRate: { value: 1 },
        connect() {},
        disconnect() {},
        stop() {},
        start() {
          sourceStarts++;
          queueMicrotask(() => source.onended?.());
        },
        onended: null as (() => void) | null,
        buffer: null as AudioBuffer | null,
      };
      return source;
    },
  };
  const fakeWindow = {
    AudioContext: class { constructor() { return context as unknown as AudioContext; } },
    speechSynthesis: {
      cancel() { speechCancels++; },
      getVoices: () => [],
      speak() {},
    },
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Window;
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });

  try {
    const { arcadeAudio } = await import("../src/lib/arcadeAudio");

    // Valid base64 carrying invalid file contents must never be reinterpreted as PCM.
    await arcadeAudio.playBase64Audio("AAAAAA==", "audio/wav");
    await arcadeAudio.playBase64Audio("AAAAAA==", "audio/mpeg");
    assert.equal(createBufferCalls, 0, "encoded WAV/MP3 decode failures must not use raw PCM fallback");
    assert.equal(sourceStarts, 0, "malformed encoded media must not start a noisy buffer source");

    rejectDecode = false;
    const pendingPlayback = arcadeAudio.playBase64Audio("AAAAAA==", "audio/wav");
    // Let the async playback reach decodeAudioData before stopping it.
    await Promise.resolve();
    arcadeAudio.stopSpeech();

    const decoded = {
      duration: 0.01,
      getChannelData: () => new Float32Array(1),
    } as unknown as AudioBuffer;
    assert.ok(decoder, "the fake decoder should be awaiting a result");
    decoder(decoded);

    const settled = await Promise.race([
      pendingPlayback.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 200)),
    ]);
    assert.equal(settled, true, "stopping during decode should settle the pending playback promise");
    assert.equal(sourceStarts, 0, "a decode result arriving after stopSpeech must not start playback");
    assert.ok(speechCancels >= 3, "stopSpeech should continue cancelling browser speech synthesis");
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});

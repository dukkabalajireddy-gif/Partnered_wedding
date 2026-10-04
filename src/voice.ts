import { API_BASE } from "./shared";

// Voice helpers: record the couple's voice, turn it into text, and read text aloud. English and Hindi only.
// Everything goes through our backend, which holds the Gnani key.

export type VoiceLang = "en-IN" | "hi-IN";
const LANG_KEY = "partnered.voiceLang";
export const getVoiceLang = (): VoiceLang => { try { return localStorage.getItem(LANG_KEY) === "hi-IN" ? "hi-IN" : "en-IN"; } catch { return "en-IN"; } };
export const setVoiceLang = (l: VoiceLang) => { try { localStorage.setItem(LANG_KEY, l); } catch { /* storage unavailable */ } window.dispatchEvent(new Event("partnered-voice-lang")); };

let ready: Promise<boolean> | null = null;
// Is Gnani connected on this server? Asked once per visit.
export function voiceConfigured(): Promise<boolean> {
  ready ??= fetch(`${API_BASE}/api/voice/config`).then((r) => (r.ok ? r.json() : { configured: false })).then((d) => !!d.configured).catch(() => false);
  return ready;
}

async function detail(res: Response, fallback: string) {
  try { const d = await res.json(); return typeof d.detail === "string" ? d.detail : fallback; } catch { return fallback; }
}

// ── Recording ──
export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], { type: "audio/wav" });
}

// Browsers record webm or mp4; Gnani wants a plain clip, so decode and rewrite it as 16 kHz mono WAV.
async function toWav(recorded: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await recorded.arrayBuffer());
  await ctx.close();
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start();
  return encodeWav((await off.startRendering()).getChannelData(0), 16000);
}

export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

export async function startRecording(): Promise<{ stop: () => Promise<Blob>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise<Blob>((resolve, reject) => {
      rec.onstop = async () => { release(); try { resolve(await toWav(new Blob(chunks, { type: rec.mimeType }))); } catch (e) { reject(e); } };
      rec.stop();
    }),
    cancel: () => { try { rec.stop(); } catch { /* already stopped */ } release(); },
  };
}

// ── Speech to text ──
export async function transcribe(wav: Blob, lang: VoiceLang): Promise<string> {
  const res = await fetch(`${API_BASE}/api/voice/transcribe?language=${lang}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
  if (!res.ok) throw new Error(await detail(res, "Could not turn that into text."));
  return ((await res.json()).transcript as string) ?? "";
}

// ── Text to speech ──
let current: HTMLAudioElement | null = null;
export function stopSpeaking() { if (current) { current.pause(); current = null; } }
export async function speak(text: string, lang: VoiceLang): Promise<void> {
  stopSpeaking();
  const res = await fetch(`${API_BASE}/api/voice/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language: lang }) });
  if (!res.ok) throw new Error(await detail(res, "Could not read that out."));
  const url = URL.createObjectURL(await res.blob());
  const audio = new Audio(url);
  current = audio;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onpause = () => resolve();
    audio.onerror = () => reject(new Error("Your browser could not play the audio."));
    audio.play().catch(reject);
  });
}

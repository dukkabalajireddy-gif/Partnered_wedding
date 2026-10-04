import { useEffect, useRef, useState } from "react";
import { canRecord, getVoiceLang, setVoiceLang, speak, startRecording, stopSpeaking, transcribe, voiceConfigured, type VoiceLang } from "./voice";

// The voice buttons. They only appear once Gnani is connected on the server.

export function useVoiceReady() {
  const [ok, setOk] = useState(false);
  useEffect(() => { let live = true; voiceConfigured().then((v) => { if (live) setOk(v); }); return () => { live = false; }; }, []);
  return ok;
}

export function useVoiceLang(): [VoiceLang, (l: VoiceLang) => void] {
  const [lang, setLang] = useState<VoiceLang>(getVoiceLang);
  useEffect(() => {
    const on = () => setLang(getVoiceLang());
    window.addEventListener("partnered-voice-lang", on);
    return () => window.removeEventListener("partnered-voice-lang", on);
  }, []);
  return [lang, setVoiceLang];
}

export function VoiceLangToggle() {
  const ready = useVoiceReady();
  const [lang, set] = useVoiceLang();
  if (!ready) return null;
  return (
    <div role="radiogroup" aria-label="Voice language" className="inline-flex rounded-full overflow-hidden" style={{ border: "1px solid #f5c6d0" }}>
      {([["en-IN", "English"], ["hi-IN", "हिन्दी"]] as const).map(([k, label]) => (
        <button key={k} role="radio" aria-checked={lang === k} onClick={() => set(k)} className="px-3.5 py-2 text-sm font-medium min-h-10"
          style={lang === k ? { background: "#a8213b", color: "#fff" } : { background: "#fff", color: "#a8213b" }}>{label}</button>
      ))}
    </div>
  );
}

// Tap to start speaking, tap again to stop; the words land in the message box.
export function MicButton({ onText, onStatus }: { onText: (t: string) => void; onStatus: (s: string) => void }) {
  const ready = useVoiceReady();
  const [lang] = useVoiceLang();
  const [phase, setPhase] = useState<"idle" | "recording" | "working">("idle");
  const rec = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(0);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); rec.current?.cancel(); }, []);
  if (!ready || !canRecord()) return null;

  const finish = async () => {
    if (!rec.current) return;
    if (timer.current) window.clearInterval(timer.current);
    const r = rec.current; rec.current = null;
    setPhase("working"); onStatus("Turning your voice into text…");
    try {
      const text = await transcribe(await r.stop(), lang);
      if (text) { onText(text); onStatus(""); } else onStatus("I couldn't hear anything. Try again, a little closer to the microphone.");
    } catch (e) { onStatus((e as Error).message); }
    setPhase("idle");
  };

  const begin = async () => {
    try {
      rec.current = await startRecording();
      started.current = Date.now(); setPhase("recording");
      onStatus(lang === "hi-IN" ? "सुन रहे हैं… बोलिए, फिर दोबारा दबाइए" : "Listening… speak, then tap again");
      timer.current = window.setInterval(() => { if (Date.now() - started.current > 40000) void finish(); }, 1000); // clips are limited to about a minute
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      onStatus(denied ? "Microphone access is blocked. Allow it in your browser's address bar, then try again." : "Could not start the microphone.");
    }
  };

  return (
    <button onClick={phase === "recording" ? finish : begin} disabled={phase === "working"} aria-label={phase === "recording" ? "Stop and use my voice" : "Speak your message"} aria-pressed={phase === "recording"}
      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg disabled:opacity-50 ${phase === "recording" ? "animate-pulse" : ""}`}
      style={phase === "recording" ? { background: "#c93a52", color: "#fff" } : { background: "#fdf2f4", color: "#a8213b", border: "1px solid #f5c6d0" }}>
      {phase === "recording" ? "⏹" : phase === "working" ? "…" : "🎤"}
    </button>
  );
}

// Reads a piece of text aloud in the chosen language.
export function ListenButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const ready = useVoiceReady();
  const [lang] = useVoiceLang();
  const [phase, setPhase] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState("");
  if (!ready) return null;

  const go = async () => {
    if (phase === "playing") { stopSpeaking(); setPhase("idle"); return; }
    setError(""); setPhase("loading");
    try { setPhase("playing"); await speak(text, lang); } catch (e) { setError((e as Error).message); }
    setPhase("idle");
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={go} disabled={phase === "loading"} className="text-xs font-medium underline min-h-9 disabled:opacity-60" style={{ color: "#a8213b" }}>
        {phase === "loading" ? "Getting audio…" : phase === "playing" ? "⏹ Stop" : `🔊 ${label}`}
      </button>
      {error && <span className="text-xs" style={{ color: "#a8213b" }}>{error}</span>}
    </span>
  );
}

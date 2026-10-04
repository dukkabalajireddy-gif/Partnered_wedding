import { useEffect, useRef, useState } from "react";
import { API_BASE } from "./shared";
import { canRecord, speak, startRecording, stopSpeaking, transcribe, type VoiceLang } from "./voice";
import { useVoiceLang, useVoiceReady } from "./VoiceUI";

// Saathi AI: a voice-only chat. The couple taps the mic and talks; Saathi answers out loud and in writing.
// No typing. English or Hindi. The app works out the facts from the couple's own plan, our backend turns them into a
// short, simple answer, and Gnani speaks it.

type Msg = { id: number; from: "me" | "saathi"; text: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";

const HINTS: Record<VoiceLang, string[]> = {
  "en-IN": ["How is my budget?", "Did we find vendors?", "What payments are due?", "Any late parcels?", "What should I do next?"],
  "hi-IN": ["मेरा बजट कैसा है?", "क्या वेंडर मिले?", "कौन से भुगतान बाकी हैं?", "कोई पार्सल लेट है?", "अब क्या करना है?"],
};
const HELLO: Record<VoiceLang, string> = {
  "en-IN": "Hi! I'm Saathi. Tap the mic and ask me anything about your wedding.",
  "hi-IN": "नमस्ते! मैं साथी हूँ। माइक दबाइए और अपनी शादी के बारे में कुछ भी पूछिए।",
};
const STATUS: Record<VoiceLang, Record<Phase, string>> = {
  "en-IN": { idle: "Tap the mic and talk", listening: "Listening… tap again when done", thinking: "Thinking…", speaking: "Talking… tap to stop" },
  "hi-IN": { idle: "माइक दबाइए और बोलिए", listening: "सुन रही हूँ… बोलकर फिर दबाइए", thinking: "सोच रही हूँ…", speaking: "बोल रही हूँ… रोकने के लिए दबाइए" },
};

function LanguageSlider({ lang, onChange }: { lang: VoiceLang; onChange: (l: VoiceLang) => void }) {
  return (
    <div role="radiogroup" aria-label="Language" className="relative inline-grid grid-cols-2 rounded-full p-1" style={{ background: "#fff", border: "1px solid #f5c6d0", width: 220 }}>
      <span aria-hidden="true" className="absolute top-1 bottom-1 rounded-full transition-all duration-300" style={{ width: "calc(50% - 4px)", left: lang === "en-IN" ? 4 : "calc(50%)", background: "linear-gradient(135deg, #a8213b, #881a30)" }} />
      {([["en-IN", "English"], ["hi-IN", "हिन्दी"]] as const).map(([k, label]) => (
        <button key={k} role="radio" aria-checked={lang === k} onClick={() => onChange(k)} className="relative z-10 py-2.5 text-sm font-medium min-h-11 rounded-full" style={{ color: lang === k ? "#fff" : "#a8213b" }}>{label}</button>
      ))}
    </div>
  );
}

export default function SaathiPage({ facts }: { facts: Record<string, unknown> }) {
  const voiceReady = useVoiceReady();
  const [lang, setLang] = useVoiceLang();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState("");
  const rec = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const alive = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) window.clearInterval(timer.current); rec.current?.cancel(); stopSpeaking(); }; }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, phase]);

  const add = (from: Msg["from"], text: string) => setMsgs((m) => [...m, { id: nextId.current++, from, text }]);

  // Ask the backend, then say the answer out loud
  const reply = async (question: string) => {
    const l = langRef.current;
    add("me", question); setPhase("thinking"); setNote("");
    try {
      const res = await fetch(`${API_BASE}/api/assistant/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, language: l, facts: factsRef.current }) });
      if (!res.ok) { let m = "I couldn't answer that. Try again."; try { const d = await res.json(); if (typeof d.detail === "string") m = d.detail; } catch { /* keep default */ } throw new Error(m); }
      const answer: string = (await res.json()).answer;
      if (!alive.current) return;
      add("saathi", answer);
      if (voiceReady) {
        setPhase("speaking");
        try { await speak(answer, l); } catch (e) { if (alive.current) setNote((e as Error).message); }
      }
    } catch (e) { if (alive.current) setNote((e as Error).message); }
    if (alive.current) setPhase("idle");
  };

  const finishListening = async () => {
    if (!rec.current) return;
    if (timer.current) window.clearInterval(timer.current);
    const r = rec.current; rec.current = null;
    setPhase("thinking");
    try {
      const text = await transcribe(await r.stop(), langRef.current);
      if (text.trim()) await reply(text.trim());
      else { setNote(langRef.current === "hi-IN" ? "कुछ सुनाई नहीं दिया। माइक के पास बोलकर दोबारा कोशिश कीजिए।" : "I didn't hear anything. Try again, closer to the mic."); setPhase("idle"); }
    } catch (e) { setNote((e as Error).message); setPhase("idle"); }
  };

  const tapMic = async () => {
    if (phase === "listening") { void finishListening(); return; }
    if (phase === "speaking") { stopSpeaking(); setPhase("idle"); return; }
    if (phase !== "idle") return;
    setNote("");
    try {
      rec.current = await startRecording();
      started.current = Date.now(); setPhase("listening");
      timer.current = window.setInterval(() => { if (Date.now() - started.current > 40000) void finishListening(); }, 1000);
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setNote(denied ? "Microphone is blocked. Allow it in your browser's address bar, then try again." : "Could not start the microphone.");
    }
  };

  const micOk = voiceReady && canRecord();
  const listening = phase === "listening";
  const hello = HELLO[lang];

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-4rem)] max-w-2xl mx-auto w-full px-4 sm:px-6">
      <header className="pt-5 pb-3 text-center">
        <div className="text-xs uppercase tracking-wider" style={{ color: "#c08a0c" }}>Saathi AI</div>
        <h1 className="text-2xl sm:text-3xl font-medium text-gray-800 mt-0.5">{lang === "hi-IN" ? "बोलकर पूछिए" : "Just talk to me"}</h1>
        <div className="mt-3 flex justify-center"><LanguageSlider lang={lang} onChange={(l) => { stopSpeaking(); setLang(l); if (phase === "speaking") setPhase("idle"); }} /></div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-3 py-3" aria-live="polite">
        <div className="flex"><div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-base text-gray-800 bg-white" style={{ border: "1px solid #fbe8ec" }}>{hello}</div></div>
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${m.from === "me" ? "rounded-br-md text-white" : "rounded-bl-md text-gray-800 bg-white"}`}
              style={m.from === "me" ? { background: "linear-gradient(135deg, #a8213b, #881a30)" } : { border: "1px solid #fbe8ec" }}>{m.text}</div>
          </div>
        ))}
        {phase === "thinking" && <div className="flex"><div className="rounded-2xl rounded-bl-md px-4 py-3 text-base text-gray-500 bg-white animate-pulse" style={{ border: "1px solid #fbe8ec" }}>…</div></div>}
        <div ref={bottom} />
      </div>

      <div className="pt-2 pb-6 text-center sticky bottom-0" style={{ background: "linear-gradient(to top, #fdf8f0 70%, transparent)" }}>
        {note && <p className="text-sm mb-2" style={{ color: "#a8213b" }}>{note}</p>}
        {!micOk && <p className="text-sm mb-2 text-gray-700">{!voiceReady ? "Voice isn't connected on this server yet." : "This browser can't record audio. Try Chrome or Safari."}</p>}
        <button onClick={tapMic} disabled={!micOk || phase === "thinking"} aria-label={listening ? "Stop and send" : phase === "speaking" ? "Stop talking" : "Start talking"} aria-pressed={listening}
          className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center text-4xl text-white shadow-lg transition-transform disabled:opacity-50 ${listening ? "animate-pulse scale-110" : "active:scale-95"}`}
          style={{ background: listening ? "linear-gradient(135deg, #c93a52, #a8213b)" : "linear-gradient(135deg, #a8213b, #881a30)", boxShadow: listening ? "0 0 0 10px rgba(201,58,82,0.2)" : "0 6px 18px rgba(136,26,48,0.35)" }}>
          {listening ? "⏹" : phase === "speaking" ? "🔊" : phase === "thinking" ? "…" : "🎤"}
        </button>
        <div className="text-sm text-gray-700 mt-2 min-h-5">{STATUS[lang][phase]}</div>
        {phase === "idle" && !msgs.length && (
          <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Things you can ask">
            {HINTS[lang].map((h) => <button key={h} onClick={() => void reply(h)} className="rounded-full px-3 py-1.5 text-xs text-gray-700 min-h-9" style={{ background: "#fff", border: "1px solid #fbe8ec" }}>{h}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

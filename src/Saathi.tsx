import { useEffect, useRef, useState } from "react";
import { API_BASE, INPUT_STYLE, PRIMARY_BTN } from "./shared";
import { speak, stopSpeaking } from "./voice";
import { MicButton, VoiceLangToggle, useVoiceLang, useVoiceReady } from "./VoiceUI";

// Saathi: the couple's voice assistant. Ask out loud (or type) how the budget is, whether vendors have replied, what is due.
// The app works out the facts from the couple's own plan, our backend turns them into a short answer, and Gnani reads it out.

const CHIPS: Record<"en-IN" | "hi-IN", string[]> = {
  "en-IN": ["How is my budget?", "Have we found vendors?", "What payments are due?", "Any delivery problems?", "What should I do next?"],
  "hi-IN": ["मेरा बजट कैसा है?", "क्या वेंडर मिले?", "कौन से भुगतान बाकी हैं?", "कोई डिलीवरी में देरी?", "अब मुझे क्या करना चाहिए?"],
};

type Turn = { q: string; a: string; usedLlm: boolean };

export default function SaathiCard({ facts }: { facts: Record<string, unknown> }) {
  const voiceReady = useVoiceReady();
  const [lang] = useVoiceLang();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [aloud, setAloud] = useState(true);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopSpeaking(); }; }, []);

  const say = async (answer: string) => {
    setSpeaking(true);
    try { await speak(answer, lang); } catch (e) { if (alive.current) setStatus((e as Error).message); }
    if (alive.current) setSpeaking(false);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    stopSpeaking(); setSpeaking(false);
    setBusy(true); setStatus(""); setText("");
    try {
      const res = await fetch(`${API_BASE}/api/assistant/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, language: lang, facts }) });
      if (!res.ok) { let m = "I couldn't answer that just now. Try again."; try { const d = await res.json(); if (typeof d.detail === "string") m = d.detail; } catch { /* keep default */ } throw new Error(m); }
      const d = await res.json();
      setTurn({ q, a: d.answer, usedLlm: !!d.usedLlm });
      if (voiceReady && aloud) void say(d.answer);
    } catch (e) { setStatus((e as Error).message); }
    setBusy(false);
  };

  return (
    <section aria-label="Saathi, your voice assistant" className="rounded-2xl p-4 sm:p-5" style={{ background: "linear-gradient(135deg, #fdf2f4, #fffdf0)", border: "1px solid #f5c6d0" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider" style={{ color: "#c08a0c" }}>Saathi · your voice assistant</div>
          <h2 className="text-xl sm:text-2xl font-medium text-gray-800 mt-0.5">Ask me anything about your wedding</h2>
          <p className="text-sm text-gray-700 mt-0.5">Speak or type. I'll tell you where your budget, vendors, payments and deliveries stand.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <VoiceLangToggle />
          {voiceReady && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 min-h-10 cursor-pointer">
              <input type="checkbox" checked={aloud} onChange={(e) => { setAloud(e.target.checked); if (!e.target.checked) { stopSpeaking(); setSpeaking(false); } }} />
              Read answers aloud
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <MicButton onText={(t) => { setText(t); void ask(t); }} onStatus={setStatus} />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void ask(text); }}
          placeholder={lang === "hi-IN" ? "अपना सवाल बोलिए या लिखिए…" : "Say or type your question…"} aria-label="Your question" className="flex-1 min-w-0 rounded-xl px-4 py-3 text-base" style={INPUT_STYLE} />
        <button onClick={() => ask(text)} disabled={busy || !text.trim()} className="text-white rounded-xl px-5 font-medium text-sm disabled:opacity-50 min-h-12" style={PRIMARY_BTN}>{busy ? "…" : "Ask"}</button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {CHIPS[lang].map((c) => (
          <button key={c} onClick={() => ask(c)} disabled={busy} className="rounded-full px-3.5 py-2 text-sm min-h-10 disabled:opacity-60" style={{ background: "#fff", border: "1px solid #f5c6d0", color: "#a8213b" }}>{c}</button>
        ))}
      </div>

      <div aria-live="polite">
        {status && <p className="text-sm mt-3" style={{ color: "#a8213b" }}>{status}</p>}
        {busy && <p className="text-sm mt-3 text-gray-700">Looking at your plan…</p>}
        {turn && !busy && (
          <div className="mt-3 rounded-xl p-4 bg-white" style={{ border: "1px solid #fbe8ec" }}>
            <div className="text-xs text-gray-600">You asked: {turn.q}</div>
            <p className="text-base text-gray-800 leading-relaxed mt-1.5">{turn.a}</p>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {voiceReady && (
                <button onClick={() => { if (speaking) { stopSpeaking(); setSpeaking(false); } else void say(turn.a); }} className="text-sm font-medium underline min-h-10" style={{ color: "#a8213b" }}>
                  {speaking ? "⏹ Stop" : "🔊 Listen again"}
                </button>
              )}
              <span className="text-xs text-gray-500">{turn.usedLlm ? "Answered from your plan" : "Answered from your plan (basic mode)"}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

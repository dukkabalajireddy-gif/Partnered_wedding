import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, INBOX_KEY, INPUT_STYLE, PRIMARY_BTN, appendMessage, formatDay, inr, prettyPhone, readInbox, type Conversation, type Session } from "./shared";

// The vendor's side of the chat, for demonstrating the platform. Whoever signs in here sees every enquiry couples
// have sent from the couple app on this device, and replies as the vendor that was contacted.

const stamp = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export default function VendorDesk({ session, onLogout, onSwitchRole }: { session: Session; onLogout: () => void; onSwitchRole: () => void }) {
  const [inbox, setInbox] = useState(readInbox);
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<"list" | "chat">("list");
  const [draft, setDraft] = useState("");
  const [seen, setSeen] = useState<Record<string, number>>({}); // when each conversation was last opened here
  const bottomRef = useRef<HTMLDivElement>(null);

  // New enquiries arrive from the other tab through storage; polling is a safety net for browsers that skip the event.
  useEffect(() => {
    const refresh = () => setInbox(readInbox());
    const onStorage = (e: StorageEvent) => { if (e.key === INBOX_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(refresh, 2000);
    return () => { window.removeEventListener("storage", onStorage); window.clearInterval(timer); };
  }, []);

  const convs = useMemo(() => Object.values(inbox).sort((a, b) => b.updatedAt - a.updatedAt), [inbox]);
  const active: Conversation | undefined = convs.find((c) => c.id === activeId);
  const awaiting = (c: Conversation) => c.messages[c.messages.length - 1]?.from === "me" && (seen[c.id] ?? 0) < c.updatedAt;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeId, active?.messages.length]);

  const open = (c: Conversation) => { setActiveId(c.id); setView("chat"); setDraft(""); setSeen((s) => ({ ...s, [c.id]: c.updatedAt })); };
  const send = () => {
    if (!active || !draft.trim()) return;
    const ts = Date.now();
    appendMessage(active.id, { id: `v-${ts}`, from: "vendor", text: draft.trim(), time: stamp(), ts });
    setDraft(""); setInbox(readInbox());
  };

  const quote = active?.vendor.estCost ? Math.round(active.vendor.estCost / 5000) * 5000 : 0;
  const quick = active ? [
    quote ? `Hello! Yes, we're available on those dates. Our quote is ${inr(quote)} for your requirements. A 30% advance (${inr(Math.round(quote * 0.3))}) confirms the booking.` : "Hello! Yes, we're available on those dates. Let us send you a quote shortly.",
    "Thank you for reaching out. Unfortunately we're already booked on those dates.",
    "Could you share your exact guest count and venue so we can finalise the quote?",
    "Payment received, thank you! Your booking is confirmed.",
  ] : [];

  return (
    <div className="flex flex-col h-dvh" style={{ background: "#fdf8f0" }}>
      <header className="shrink-0 bg-white flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: "1px solid #fbe8ec", paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#a8213b" }}><span className="text-white text-sm font-bold">P</span></div>
        <div className="min-w-0">
          <div className="text-lg font-medium leading-tight" style={{ color: "#a8213b" }}>Partnered Vendor Desk</div>
          <div className="text-xs text-gray-700">Demo · signed in as {prettyPhone(session.phone)}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onSwitchRole} className="text-sm px-3 py-2 rounded-lg min-h-10" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Couple app</button>
          <button onClick={onLogout} className="text-sm px-3 py-2 rounded-lg min-h-10 text-gray-800" style={{ border: "1px solid #ddd" }}>Log out</button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className={`${view === "list" ? "flex" : "hidden"} md:flex flex-col w-full md:w-80 md:shrink-0 overflow-y-auto bg-white`} style={{ borderRight: "1px solid #fbe8ec" }}>
          <div className="p-4 text-sm font-medium text-gray-800" style={{ borderBottom: "1px solid #fdf2f4" }}>Enquiries ({convs.length})</div>
          {convs.length === 0 && (
            <div className="p-5 text-sm text-gray-700 leading-relaxed">
              No enquiries yet. In the couple app (another tab or window), open a vendor and press Message, then send the enquiry. It appears here.
            </div>
          )}
          {convs.map((c) => (
            <button key={c.id} onClick={() => open(c)} className="w-full text-left p-4" style={{ background: activeId === c.id ? "#fdf2f4" : "transparent", borderBottom: "1px solid #fdf8f0" }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-medium shrink-0" style={awaiting(c) ? { background: "#a8213b", color: "#fff" } : { background: "#fdf2f4", color: "#a8213b" }}>{c.vendor.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800 truncate">{c.couple.names}</span>
                    {awaiting(c) && <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: "#a8213b" }}>New</span>}
                  </div>
                  <div className="text-xs text-gray-700 truncate">for {c.vendor.name}</div>
                  <div className="text-sm text-gray-700 truncate mt-0.5">{c.messages[c.messages.length - 1]?.text}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className={`${view === "chat" ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-gray-700">Pick an enquiry on the left to read it and reply.</div>
          ) : (
            <>
              <div className="px-3 sm:px-6 py-3 bg-white shrink-0 space-y-1" style={{ borderBottom: "1px solid #fbe8ec" }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setView("list")} aria-label="Back to enquiries" className="md:hidden text-2xl leading-none px-2" style={{ color: "#a8213b" }}>‹</button>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 truncate">Replying as {active.vendor.name}</div>
                    <div className="text-xs text-gray-700 truncate">{CATEGORY_META[active.vendor.category].icon} {CATEGORY_META[active.vendor.category].label} · {active.vendor.area ? `${active.vendor.area}, ` : ""}{active.vendor.city}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-700 rounded-lg px-3 py-1.5" style={{ background: "#fdf8f0" }}>
                  {active.couple.names} · wedding {formatDay(active.couple.date)} in {active.couple.city} · about {active.couple.guests} guests
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 min-h-0">
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "vendor" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%] sm:max-w-md">
                      <div className={`text-sm rounded-2xl px-4 py-3 leading-relaxed ${m.from === "vendor" ? "rounded-tr-sm text-white" : "rounded-tl-sm text-gray-800 bg-white"}`}
                        style={m.from === "vendor" ? PRIMARY_BTN : { border: "1px solid #fbe8ec" }}>{m.text}</div>
                      <div className={`text-xs text-gray-600 mt-1 ${m.from === "vendor" ? "text-right" : ""}`}>{m.from === "vendor" ? "You (vendor)" : active.couple.names} · {m.time}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="px-3 sm:px-6 pt-2 flex gap-2 overflow-x-auto bg-white [&>button]:shrink-0" style={{ borderTop: "1px solid #fbe8ec" }}>
                {quick.map((q, i) => (
                  <button key={i} onClick={() => setDraft(q)} className="text-sm px-3 py-2 rounded-full whitespace-nowrap max-w-[16rem] truncate" style={{ color: "#a8213b", background: "#fdf2f4", border: "1px solid #f5c6d0" }}>{q}</button>
                ))}
              </div>
              <div className="px-3 sm:px-6 py-3 bg-white flex items-end gap-2 shrink-0" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
                <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a reply as the vendor" aria-label="Reply"
                  className="flex-1 min-w-0 rounded-xl px-4 py-3 text-base resize-none focus:outline-none max-h-40" style={INPUT_STYLE}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button onClick={send} disabled={!draft.trim()} className="text-white rounded-xl px-5 py-3 font-medium text-sm disabled:opacity-50 min-h-12" style={PRIMARY_BTN}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

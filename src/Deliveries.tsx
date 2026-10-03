import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE, DELIVERY_KIND, DELIVERY_STEPS, INPUT_STYLE, PRIMARY_BTN, addDays, daysBetween, formatDay, isoDate, shortDay, uid,
  type Booking, type Category, type Delivery, type DeliveryKind, type Tracking, type WeddingPlan,
} from "./shared";

// Everything the couple is waiting to receive: gifts, invitations, outfits, decor. A waybill number turns on tracking
// through the backend, which asks Delhivery (or, for DEMO1 to DEMO5, makes up a journey). Without a waybill, or while
// Delhivery is not connected, the status is entered by hand.

const KIND_FOR_CATEGORY: Partial<Record<Category, DeliveryKind>> = { gifts: "gift", attire: "attire", decoration: "decor" };
const REFRESH_EVERY = 5 * 60 * 1000;

function risk(d: Delivery, today: string): { label: string; fg: string; bg: string; note: string } {
  if (d.tracking?.returning && d.step < DELIVERY_STEPS.length - 1) return { label: "Returning to sender", fg: "#a8213b", bg: "#fdf2f4", note: "Delhivery is sending this parcel back. Contact the sender." };
  if (d.step >= DELIVERY_STEPS.length - 1) return { label: "Delivered", fg: "#2f6b1f", bg: "#f3faf0", note: "Received." };
  const buffer = daysBetween(d.expected, d.neededBy);
  if (d.expected < today) return { label: "Delayed", fg: "#a8213b", bg: "#fdf2f4", note: `Expected ${shortDay(d.expected)} and not delivered yet.` };
  if (buffer < 0) return { label: "Will be late", fg: "#a8213b", bg: "#fdf2f4", note: `Arrives ${-buffer} day${buffer === -1 ? "" : "s"} after you need it (${shortDay(d.neededBy)}).` };
  if (buffer <= 3) return { label: "Tight", fg: "#7a5206", bg: "#fffdf0", note: `Only ${buffer} day${buffer === 1 ? "" : "s"} to spare before ${shortDay(d.neededBy)}.` };
  return { label: "On track", fg: "#2f6b1f", bg: "#f3faf0", note: `${buffer} days to spare before ${shortDay(d.neededBy)}.` };
}

const SOURCE_LABEL: Record<Tracking["source"], string> = { demo: "Demo tracking", staging: "Delhivery (test)", production: "Live from Delhivery" };
const when = (t: string) => { const d = new Date(t); return isNaN(d.getTime()) ? t : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };

export default function DeliveriesTab({ plan, bookings, deliveries, setDeliveries }: {
  plan: WeddingPlan; bookings: Booking[]; deliveries: Delivery[]; setDeliveries: (fn: (d: Delivery[]) => Delivery[]) => void;
}) {
  const today = isoDate(new Date());
  const needed = addDays(plan.date, -7);
  const blank = { item: "", kind: "gift" as DeliveryKind, from: "", to: plan.location, waybill: "", expected: addDays(today, 7), neededBy: needed < today ? plan.date : needed };
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<Record<string, { text: string; notConnected: boolean }>>({}); // by waybill
  const [netError, setNetError] = useState("");
  const [waybillDraft, setWaybillDraft] = useState<Record<string, string>>({});
  const latest = useRef(deliveries);
  latest.current = deliveries;

  // Ask the backend about these waybills (one request, up to 50) and fold the answers into the deliveries.
  const refresh = useCallback(async (waybills: string[]) => {
    const ids = [...new Set(waybills.filter(Boolean))].slice(0, 50);
    if (!ids.length) return;
    setBusy(true); setNetError("");
    try {
      const res = await fetch(`${API_BASE}/api/tracking?waybill=${encodeURIComponent(ids.join(","))}`);
      if (!res.ok) throw new Error("bad status");
      const data: { source: Tracking["source"] | "not_connected"; shipments: Record<string, { found: boolean; error?: string; notConnected?: boolean; step: number; returning: boolean; status: string; location: string; updatedAt: string; note: string; expectedDelivery: string; scans: Tracking["scans"] }> } = await res.json();
      const issues: Record<string, { text: string; notConnected: boolean }> = {};
      Object.entries(data.shipments).forEach(([w, s]) => { if (!s.found) issues[w] = { text: s.error ?? "No tracking found.", notConnected: !!s.notConnected }; });
      setProblems((p) => { const n = { ...p }; ids.forEach((w) => delete n[w]); return { ...n, ...issues }; });
      setDeliveries((ds) => ds.map((d) => {
        const s = data.shipments[d.waybill];
        if (!s?.found || data.source === "not_connected") return d;
        return {
          ...d, step: s.step, expected: s.expectedDelivery || d.expected,
          tracking: { source: data.source as Tracking["source"], status: s.status, returning: s.returning, location: s.location, updatedAt: s.updatedAt, note: s.note, scans: s.scans, checkedAt: Date.now() },
        };
      }));
    } catch {
      setNetError("Could not reach the tracking service. Check that the backend is running.");
    } finally { setBusy(false); }
  }, [setDeliveries]);

  const openWaybills = () => latest.current.filter((d) => d.waybill && d.step < DELIVERY_STEPS.length - 1).map((d) => d.waybill);
  // Check once when the page opens, then every few minutes while it stays open.
  useEffect(() => {
    refresh(openWaybills());
    const timer = window.setInterval(() => refresh(openWaybills()), REFRESH_EVERY);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stats = useMemo(() => ({
    transit: deliveries.filter((d) => d.step > 0 && d.step < DELIVERY_STEPS.length - 1).length,
    done: deliveries.filter((d) => d.step >= DELIVERY_STEPS.length - 1).length,
    atRisk: deliveries.filter((d) => ["Delayed", "Will be late", "Tight", "Returning to sender"].includes(risk(d, today).label)).length,
  }), [deliveries, today]);

  const suggestions = bookings.filter((b) => KIND_FOR_CATEGORY[b.category] && !deliveries.some((d) => d.from === b.vendorName));

  const add = (d: Omit<Delivery, "id" | "step">) => { setDeliveries((ds) => [{ id: uid("del"), step: 0, ...d }, ...ds]); if (d.waybill) refresh([d.waybill]); };
  const submit = () => {
    if (!form.item.trim()) return;
    add({ ...form, item: form.item.trim(), from: form.from.trim() || "Not specified", waybill: form.waybill.trim() });
    setForm(blank); setShowForm(false);
  };
  const advance = (id: string) => setDeliveries((ds) => ds.map((d) => (d.id === id ? { ...d, step: Math.min(DELIVERY_STEPS.length - 1, d.step + 1) } : d)));
  const setStep = (id: string, step: number) => setDeliveries((ds) => ds.map((d) => (d.id === id ? { ...d, step } : d)));
  const attachWaybill = (id: string) => {
    const w = (waybillDraft[id] ?? "").trim();
    if (!w) return;
    setDeliveries((ds) => ds.map((d) => (d.id === id ? { ...d, waybill: w, tracking: undefined } : d)));
    setWaybillDraft((x) => ({ ...x, [id]: "" }));
    refresh([w]);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-medium text-gray-800">Deliveries</h1>
          <p className="text-sm text-gray-600 mt-1">Track the gifts, invitations, outfits and decor on their way to you, and catch delays before the wedding.</p>
        </div>
        <button onClick={() => refresh(openWaybills())} disabled={busy || openWaybills().length === 0} className="rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50 min-h-11" style={{ color: "#a8213b", border: "1px solid #a8213b", background: "#fff" }}>
          {busy ? "Checking…" : "🚚 Refresh tracking"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Parcels tracked", value: String(deliveries.length), color: "#a8213b" },
          { label: "On the way", value: String(stats.transit), color: "#7a5206" },
          { label: "Delivered", value: String(stats.done), color: "#2f6b1f" },
          { label: "Need attention", value: String(stats.atRisk), color: stats.atRisk ? "#c93a52" : "#881a30" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 sm:p-5 min-w-0" style={{ border: "1px solid #fbe8ec" }}>
            <div className="text-xs text-gray-600 mb-1">{s.label}</div>
            <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {netError && <div className="rounded-xl p-3 text-sm font-medium" style={{ background: "#fdf2f4", color: "#a8213b", border: "1px solid #f5c6d0" }}>{netError}</div>}

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowForm(!showForm)} className="text-white rounded-xl px-6 py-3 font-medium text-sm" style={PRIMARY_BTN}>{showForm ? "Close" : "+ Add a delivery"}</button>
        {suggestions.map((b) => (
          <button key={b.vendorId} onClick={() => add({ item: `Order from ${b.vendorName}`, kind: KIND_FOR_CATEGORY[b.category]!, from: b.vendorName, to: plan.location, waybill: "", expected: addDays(today, 10), neededBy: needed < today ? plan.date : needed })}
            className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ color: "#a8213b", border: "1px solid #f5c6d0", background: "#fff" }}>+ Track {b.vendorName}</button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 space-y-3" style={{ border: "2px solid #f5c6d0" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>What is it?
              <input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. 250 return-gift boxes" className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} /></label>
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Type
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DeliveryKind })} className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal bg-white" style={{ border: "1px solid #f5c6d0" }}>
                {(Object.keys(DELIVERY_KIND) as DeliveryKind[]).map((k) => <option key={k} value={k}>{DELIVERY_KIND[k].icon} {DELIVERY_KIND[k].label}</option>)}</select></label>
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Coming from (shop or vendor)
              <input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="e.g. Shagun Gifts, Jaipur" className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} /></label>
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Delivering to
              <input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} /></label>
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Expected delivery date
              <input type="date" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} /></label>
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Needed by
              <input type="date" value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} /></label>
            <label className="block text-xs font-medium uppercase tracking-wider md:col-span-2" style={{ color: "#a8213b" }}>Delhivery waybill number (optional)
              <input value={form.waybill} onChange={(e) => setForm({ ...form, waybill: e.target.value })} placeholder="From the vendor, or try a demo one: DEMO1 to DEMO5" className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} /></label>
          </div>
          <button onClick={submit} disabled={!form.item.trim()} className="text-white rounded-xl px-8 py-3 font-medium text-sm disabled:opacity-50 w-full sm:w-auto" style={PRIMARY_BTN}>Start tracking</button>
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 sm:p-12 text-center" style={{ border: "1px solid #fbe8ec" }}>
          <div className="text-4xl mb-3" aria-hidden="true">📦</div>
          <div className="text-xl font-medium text-gray-800">Nothing on its way yet</div>
          <p className="text-sm text-gray-700 mt-1 max-w-md mx-auto">Add return gifts, wedding cards, outfits or decor you're waiting for. With the Delhivery waybill number we show where each parcel is, and warn you if it won't arrive in time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
          {deliveries.map((d) => {
            const r = risk(d, today);
            const k = DELIVERY_KIND[d.kind];
            const tr = d.tracking;
            const problem = d.waybill ? problems[d.waybill] : undefined;
            return (
              <div key={d.id} className="bg-white rounded-2xl p-4 sm:p-6 space-y-4 min-w-0" style={{ border: "1px solid #fbe8ec" }}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0" style={{ background: "#fdf2f4" }} aria-hidden="true">{k.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-800" style={{ overflowWrap: "anywhere" }}>{d.item}</div>
                    <div className="text-sm text-gray-700">{k.label} · from {d.from} to {d.to}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{d.waybill ? `Waybill ${d.waybill}` : "No waybill yet"} · expected {formatDay(d.expected)}</div>
                  </div>
                  <button onClick={() => setDeliveries((ds) => ds.filter((x) => x.id !== d.id))} aria-label={`Remove ${d.item}`} className="text-lg px-2 py-1 text-gray-600">✕</button>
                </div>

                <ol className="grid grid-cols-5 gap-1" aria-label="Delivery progress">
                  {DELIVERY_STEPS.map((s, i) => (
                    <li key={s} className="text-center">
                      <div className="h-1.5 rounded-full" style={{ background: i <= d.step ? "linear-gradient(to right, #a8213b, #c08a0c)" : "#fdf2f4" }} />
                      <div className="text-[0.7rem] leading-tight mt-1.5" style={{ color: i <= d.step ? "#1a1a1a" : "#666", fontWeight: i === d.step ? 700 : 400 }}>{s}</div>
                    </li>
                  ))}
                </ol>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: r.bg, color: r.fg, border: `1px solid ${r.fg}` }}>{r.label}</span>
                  <span className="text-sm text-gray-700">{r.note}</span>
                </div>

                {tr ? (
                  <div className="rounded-xl p-3 space-y-2" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: tr.source === "demo" ? "#fffdf0" : "#eaf3ff", color: tr.source === "demo" ? "#7a5206" : "#27457a", border: `1px solid ${tr.source === "demo" ? "#fbf0a1" : "#cfd8e3"}` }}>🚚 {SOURCE_LABEL[tr.source]}</span>
                      <span className="text-xs text-gray-700">Checked {new Date(tr.checkedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="text-sm text-gray-800"><span className="font-semibold">{tr.status || "Status unknown"}</span>{tr.location ? ` · ${tr.location}` : ""}{tr.updatedAt ? ` · ${when(tr.updatedAt)}` : ""}</div>
                    {tr.note && <div className="text-sm text-gray-700">{tr.note}</div>}
                    {tr.scans.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium min-h-9 flex items-center" style={{ color: "#a8213b" }}>Scan history ({tr.scans.length})</summary>
                        <ul className="mt-2 space-y-2 border-l-2 pl-3" style={{ borderColor: "#f5c6d0" }}>
                          {tr.scans.map((s, i) => (
                            <li key={i}><div className="font-medium text-gray-800">{s.status}{s.location ? ` · ${s.location}` : ""}</div><div className="text-xs text-gray-700">{when(s.time)}{s.note ? ` · ${s.note}` : ""}</div></li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ) : d.waybill ? (
                  <div className="rounded-xl p-3 text-sm text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
                    {problem?.notConnected ? "Live tracking isn't connected yet. Use a demo waybill (DEMO1 to DEMO5), or update the status by hand below." : problem ? problem.text : busy ? "Checking with Delhivery…" : "No tracking yet. Press Refresh tracking."}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input value={waybillDraft[d.id] ?? ""} onChange={(e) => setWaybillDraft((x) => ({ ...x, [d.id]: e.target.value }))} placeholder="Add the waybill number to track" aria-label={`Waybill for ${d.item}`}
                      className="flex-1 min-w-[10rem] rounded-xl px-4 py-2.5 text-base focus:outline-none" style={INPUT_STYLE} onKeyDown={(e) => e.key === "Enter" && attachWaybill(d.id)} />
                    <button onClick={() => attachWaybill(d.id)} disabled={!(waybillDraft[d.id] ?? "").trim()} className="rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Track</button>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {tr ? (
                    <button onClick={() => refresh([d.waybill])} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Refresh this parcel</button>
                  ) : (
                    <>
                      <select value={d.step} onChange={(e) => setStep(d.id, Number(e.target.value))} aria-label={`Status of ${d.item}`} className="rounded-xl px-3 py-2.5 text-sm bg-white" style={{ border: "1px solid #f5c6d0" }}>
                        {DELIVERY_STEPS.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
                      <button onClick={() => advance(d.id)} disabled={d.step >= DELIVERY_STEPS.length - 1} className="rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Move to next step (demo)</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-600">Tracking comes from Delhivery's Track API through our backend, so no keys are ever stored in your browser. Parcels needed for the wedding on {formatDay(plan.date)} are checked against the date you say you need them by.</p>
    </div>
  );
}

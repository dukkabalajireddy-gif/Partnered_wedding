import { useMemo, useState } from "react";
import {
  DELIVERY_KIND, DELIVERY_STEPS, INPUT_STYLE, PRIMARY_BTN, addDays, daysBetween, formatDay, isoDate, shortDay, uid,
  type Booking, type Category, type Delivery, type DeliveryKind, type WeddingPlan,
} from "./shared";

// Everything the couple is waiting to receive: gifts, invitations, outfits, decor. In this prototype the status
// is entered by hand (or stepped forward with the demo button). With Delhivery connected, the waybill number
// will pull live tracking, and the platform will warn when a parcel is going to miss the date it is needed.

const KIND_FOR_CATEGORY: Partial<Record<Category, DeliveryKind>> = { gifts: "gift", attire: "attire", decoration: "decor" };

function risk(d: Delivery, today: string): { label: string; fg: string; bg: string; note: string } {
  if (d.step >= DELIVERY_STEPS.length - 1) return { label: "Delivered", fg: "#2f6b1f", bg: "#f3faf0", note: "Received." };
  const buffer = daysBetween(d.expected, d.neededBy);
  if (d.expected < today) return { label: "Delayed", fg: "#a8213b", bg: "#fdf2f4", note: `Expected ${shortDay(d.expected)} and not delivered yet.` };
  if (buffer < 0) return { label: "Will be late", fg: "#a8213b", bg: "#fdf2f4", note: `Arrives ${-buffer} day${buffer === -1 ? "" : "s"} after you need it (${shortDay(d.neededBy)}).` };
  if (buffer <= 3) return { label: "Tight", fg: "#7a5206", bg: "#fffdf0", note: `Only ${buffer} day${buffer === 1 ? "" : "s"} to spare before ${shortDay(d.neededBy)}.` };
  return { label: "On track", fg: "#2f6b1f", bg: "#f3faf0", note: `${buffer} days to spare before ${shortDay(d.neededBy)}.` };
}

export default function DeliveriesTab({ plan, bookings, deliveries, setDeliveries }: {
  plan: WeddingPlan; bookings: Booking[]; deliveries: Delivery[]; setDeliveries: (fn: (d: Delivery[]) => Delivery[]) => void;
}) {
  const today = isoDate(new Date());
  const needed = addDays(plan.date, -7);
  const blank = { item: "", kind: "gift" as DeliveryKind, from: "", to: plan.location, waybill: "", expected: addDays(today, 7), neededBy: needed < today ? plan.date : needed };
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);

  const stats = useMemo(() => ({
    transit: deliveries.filter((d) => d.step > 0 && d.step < DELIVERY_STEPS.length - 1).length,
    done: deliveries.filter((d) => d.step >= DELIVERY_STEPS.length - 1).length,
    atRisk: deliveries.filter((d) => ["Delayed", "Will be late", "Tight"].includes(risk(d, today).label)).length,
  }), [deliveries, today]);

  const suggestions = bookings.filter((b) => KIND_FOR_CATEGORY[b.category] && !deliveries.some((d) => d.from === b.vendorName));

  const add = (d: Omit<Delivery, "id" | "step">) => setDeliveries((ds) => [{ id: uid("del"), step: 0, ...d }, ...ds]);
  const submit = () => {
    if (!form.item.trim()) return;
    add({ ...form, item: form.item.trim(), from: form.from.trim() || "Not specified", waybill: form.waybill.trim() });
    setForm(blank); setShowForm(false);
  };
  const advance = (id: string) => setDeliveries((ds) => ds.map((d) => (d.id === id ? { ...d, step: Math.min(DELIVERY_STEPS.length - 1, d.step + 1) } : d)));
  const setStep = (id: string, step: number) => setDeliveries((ds) => ds.map((d) => (d.id === id ? { ...d, step } : d)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-medium text-gray-800">Deliveries</h1>
          <p className="text-sm text-gray-600 mt-1">Track the gifts, invitations, outfits and decor on their way to you, and catch delays before the wedding.</p>
        </div>
        <span className="text-sm px-3 py-1.5 rounded-full font-medium" style={{ background: "#fffdf0", color: "#7a5206", border: "1px solid #fbf0a1" }}>🚚 Delhivery tracking · test mode</span>
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
              <input value={form.waybill} onChange={(e) => setForm({ ...form, waybill: e.target.value })} placeholder="Add it when the vendor shares it" className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} /></label>
          </div>
          <button onClick={submit} disabled={!form.item.trim()} className="text-white rounded-xl px-8 py-3 font-medium text-sm disabled:opacity-50 w-full sm:w-auto" style={PRIMARY_BTN}>Start tracking</button>
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 sm:p-12 text-center" style={{ border: "1px solid #fbe8ec" }}>
          <div className="text-4xl mb-3" aria-hidden="true">📦</div>
          <div className="text-xl font-medium text-gray-800">Nothing on its way yet</div>
          <p className="text-sm text-gray-700 mt-1 max-w-md mx-auto">Add return gifts, wedding cards, outfits or decor you're waiting for. We'll show where each one is and warn you if it won't arrive in time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
          {deliveries.map((d) => {
            const r = risk(d, today);
            const k = DELIVERY_KIND[d.kind];
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

                <div className="flex items-center gap-2 flex-wrap">
                  <select value={d.step} onChange={(e) => setStep(d.id, Number(e.target.value))} aria-label={`Status of ${d.item}`} className="rounded-xl px-3 py-2.5 text-sm bg-white" style={{ border: "1px solid #f5c6d0" }}>
                    {DELIVERY_STEPS.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
                  <button onClick={() => advance(d.id)} disabled={d.step >= DELIVERY_STEPS.length - 1} className="rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Refresh status (demo)</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-600">Prototype: statuses are entered by hand. With Delhivery connected, a waybill number will pull live tracking and delay alerts automatically. Parcels needed for the wedding on {formatDay(plan.date)} are checked against the date you say you need them by.</p>
    </div>
  );
}

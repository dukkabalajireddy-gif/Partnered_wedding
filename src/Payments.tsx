import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_META, PAY_SPLITS, PRIMARY_BTN, addDays, buildPayments, daysBetween, formatDay, inr, isoDate, shortDay,
  type BudgetAllocation, type Booking, type Category, type Payment, type PaySplit, type WeddingPlan,
} from "./shared";

// Payments to the vendors the couple has booked. In this prototype the checkout runs in TEST MODE:
// no card or bank details are collected and no money moves. Real payments will go through Pine Labs.

const METHODS = [
  { id: "UPI", label: "UPI", hint: "Pay from any UPI app" },
  { id: "Card", label: "Debit or credit card", hint: "Visa, Mastercard, RuPay" },
  { id: "Net banking", label: "Net banking", hint: "Pay from your bank account" },
];

function splitOf(rows: Payment[]): PaySplit {
  if (rows.length === 1) return "100";
  return rows.length === 2 ? "50-50" : "30-40-30";
}

function Checkout({ payment, onClose, onPaid }: { payment: Payment; onClose: () => void; onPaid: (method: string, ref: string) => void }) {
  const [method, setMethod] = useState(METHODS[0].id);
  const [phase, setPhase] = useState<"choose" | "processing" | "done">("choose");
  const [ref, setRef] = useState("");

  const pay = () => {
    setPhase("processing");
    window.setTimeout(() => {
      const r = `PLTEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      setRef(r); setPhase("done"); onPaid(method, r);
    }, 1300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={phase === "processing" ? undefined : onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-7 space-y-5 max-h-[92dvh] overflow-y-auto" style={{ borderTop: "3px solid #c08a0c", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">Secure checkout · Pine Labs</div>
            <h3 className="text-2xl font-medium text-gray-800 mt-1">{inr(payment.amount)}</h3>
            <div className="text-sm text-gray-700">{payment.label} to {payment.vendorName}</div>
          </div>
          {phase !== "processing" && <button onClick={onClose} aria-label="Close" className="text-xl px-3 py-2 -mr-3 -mt-2" style={{ color: "#444" }}>✕</button>}
        </div>

        <div className="rounded-xl p-3 text-sm text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
          <span className="font-semibold">Test mode.</span> No money moves and no card or bank details are asked for. This shows how the payment step will work once Pine Labs is connected.
        </div>

        {phase === "choose" && (
          <>
            <div className="space-y-2" role="radiogroup" aria-label="Payment method">
              {METHODS.map((m) => (
                <button key={m.id} role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left min-h-12"
                  style={method === m.id ? { border: "2px solid #a8213b", background: "#fdf2f4" } : { border: "1px solid #e5d3d7", background: "#fff" }}>
                  <span className="w-5 h-5 rounded-full shrink-0" style={method === m.id ? { border: "6px solid #a8213b", background: "#fff" } : { border: "2px solid #c98a98" }} />
                  <span className="flex-1"><span className="block text-sm font-medium text-gray-800">{m.label}</span><span className="block text-xs text-gray-600">{m.hint}</span></span>
                </button>
              ))}
            </div>
            <button onClick={pay} className="w-full text-white rounded-xl py-3.5 font-medium text-sm sparkle-btn" style={PRIMARY_BTN}>Pay {inr(payment.amount)} (test)</button>
          </>
        )}
        {phase === "processing" && <div className="text-center py-6 text-gray-800 text-sm">Processing your test payment…</div>}
        {phase === "done" && (
          <div className="text-center space-y-3 py-2">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl text-white" style={{ background: "#2f6b1f" }}>✓</div>
            <div className="text-lg font-medium text-gray-800">Test payment recorded</div>
            <div className="text-sm text-gray-700">Reference {ref} · {method}</div>
            <button onClick={onClose} className="w-full rounded-xl py-3 font-medium text-sm" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentsTab({ plan, bookings, allocation, payments, setPayments, onBrowse }: {
  plan: WeddingPlan; bookings: Booking[]; allocation: BudgetAllocation;
  payments: Payment[]; setPayments: (fn: (p: Payment[]) => Payment[]) => void; onBrowse: () => void;
}) {
  const [paying, setPaying] = useState<Payment | null>(null);
  const today = isoDate(new Date());

  // Every booking gets a payment schedule. Unpaid instalments for a booking that was undone are dropped.
  useEffect(() => {
    setPayments((ps) => {
      const kept = ps.filter((p) => p.status === "paid" || bookings.some((b) => b.vendorId === p.vendorId));
      const fresh = bookings.filter((b) => !kept.some((p) => p.vendorId === b.vendorId)).flatMap((b) => buildPayments(b, plan.date, "30-40-30"));
      return fresh.length || kept.length !== ps.length ? [...kept, ...fresh] : ps;
    });
  }, [bookings, plan.date, setPayments]);

  const changeSplit = (b: Booking, split: PaySplit) =>
    setPayments((ps) => [...ps.filter((p) => p.vendorId !== b.vendorId), ...buildPayments(b, plan.date, split)]);

  const paid = payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const committed = payments.reduce((a, p) => a + p.amount, 0);
  const soon = payments.filter((p) => p.status === "due" && daysBetween(today, p.dueDate) <= 30).reduce((a, p) => a + p.amount, 0);
  const nextDue = [...payments].filter((p) => p.status === "due").sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const byCategory = useMemo(() => {
    const m = new Map<Category, number>();
    bookings.forEach((b) => m.set(b.category, (m.get(b.category) ?? 0) + b.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [bookings]);

  const markPaid = (id: string, method: string, ref: string) =>
    setPayments((ps) => ps.map((p) => (p.id === id ? { ...p, status: "paid", paidOn: today, method, ref } : p)));

  const history = payments.filter((p) => p.status === "paid").sort((a, b) => (b.paidOn ?? "").localeCompare(a.paidOn ?? ""));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-medium text-gray-800">Payments</h1>
          <p className="text-sm text-gray-600 mt-1">Advances and balances for every vendor you've booked, in one place.</p>
        </div>
        <span className="text-sm px-3 py-1.5 rounded-full font-medium" style={{ background: "#fffdf0", color: "#7a5206", border: "1px solid #fbf0a1" }}>Test mode · Pine Labs not connected yet</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Committed to vendors", value: inr(committed), sub: `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`, color: "#a8213b" },
          { label: "Paid so far", value: inr(paid), sub: committed ? `${Math.round((paid / committed) * 100)}% of commitments` : "nothing yet", color: "#2f6b1f" },
          { label: "Due in 30 days", value: inr(soon), sub: nextDue ? `next: ${shortDay(nextDue.dueDate)}` : "nothing due", color: "#c08a0c" },
          { label: "Budget left", value: inr(plan.budget - committed), sub: "after commitments", color: plan.budget - committed < 0 ? "#c93a52" : "#881a30" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 sm:p-5 min-w-0" style={{ border: "1px solid #fbe8ec" }}>
            <div className="text-xs text-gray-600 mb-1">{s.label}</div>
            <div className="text-lg sm:text-xl font-semibold break-words" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-600 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 sm:p-12 text-center" style={{ border: "1px solid #fbe8ec" }}>
          <div className="text-4xl mb-3" aria-hidden="true">💳</div>
          <div className="text-xl font-medium text-gray-800">No bookings to pay yet</div>
          <p className="text-sm text-gray-700 mt-1 max-w-md mx-auto">Open a vendor and press "Mark as booked". A payment schedule with an advance and balance instalments appears here automatically.</p>
          <button onClick={onBrowse} className="mt-5 text-white rounded-xl px-6 py-3 font-medium text-sm" style={PRIMARY_BTN}>Browse vendors</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
          <div className="xl:col-span-8 space-y-4 min-w-0">
            {bookings.map((b) => {
              const rows = payments.filter((p) => p.vendorId === b.vendorId).sort((x, y) => x.dueDate.localeCompare(y.dueDate));
              if (rows.length === 0) return null;
              const done = rows.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
              const anyPaid = rows.some((p) => p.status === "paid");
              const meta = CATEGORY_META[b.category];
              return (
                <div key={b.vendorId} className="bg-white rounded-2xl p-4 sm:p-6 space-y-4" style={{ border: "1px solid #fbe8ec" }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-lg font-medium text-gray-800">{b.vendorName}</div>
                      <div className="text-sm text-gray-700">{meta.icon} {meta.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold" style={{ color: "#a8213b" }}>{inr(b.amount)}</div>
                      <div className="text-xs text-gray-600">typical estimate, not a quote</div>
                    </div>
                  </div>
                  <div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#fdf2f4" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.round((done / b.amount) * 100)}%`, background: "linear-gradient(to right, #2f6b1f, #6bb04f)" }} />
                    </div>
                    <div className="text-xs text-gray-700 mt-1">{inr(done)} paid of {inr(b.amount)}</div>
                  </div>

                  <label className="flex items-center gap-2 flex-wrap text-sm text-gray-700">
                    Payment plan
                    <select value={splitOf(rows)} disabled={anyPaid} onChange={(e) => changeSplit(b, e.target.value as PaySplit)}
                      className="rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none disabled:opacity-60 max-w-full" style={{ border: "1px solid #fbe8ec" }}>
                      {(Object.keys(PAY_SPLITS) as PaySplit[]).map((k) => <option key={k} value={k}>{PAY_SPLITS[k].label}</option>)}
                    </select>
                    {anyPaid && <span className="text-xs text-gray-600">Locked once a payment is made.</span>}
                  </label>

                  <div className="space-y-2">
                    {rows.map((p) => {
                      const overdue = p.status === "due" && p.dueDate < today;
                      return (
                        <div key={p.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl p-3" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
                          <div className="flex-1 min-w-[9rem]">
                            <div className="text-sm font-semibold text-gray-800">{p.label}</div>
                            <div className="text-xs text-gray-700">
                              {p.status === "paid" ? `Paid ${shortDay(p.paidOn!)} · ${p.method} · ${p.ref}` : `Due ${p.dueDate === today ? "today" : formatDay(p.dueDate)}`}
                            </div>
                          </div>
                          <div className="text-base font-semibold text-gray-800">{inr(p.amount)}</div>
                          {p.status === "paid"
                            ? <span className="text-sm font-medium px-3 py-1.5 rounded-full" style={{ background: "#f3faf0", color: "#2f6b1f", border: "1px solid #9bd08a" }}>✓ Paid</span>
                            : <button onClick={() => setPaying(p)} className="w-full sm:w-auto text-white rounded-xl px-5 py-2.5 text-sm font-medium" style={PRIMARY_BTN}>
                                {overdue ? "Pay now (overdue)" : "Pay now"}
                              </button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="xl:col-span-4 space-y-5 sm:space-y-6 min-w-0">
            <div className="bg-white rounded-2xl p-4 sm:p-6" style={{ border: "1px solid #fbe8ec" }}>
              <h3 className="font-medium text-gray-700 text-sm mb-1">Budget check</h3>
              <p className="text-xs text-gray-600 mb-4">What you've committed in each category, against its budget.</p>
              <div className="space-y-3">
                {byCategory.map(([k, amt]) => {
                  const cap = allocation[k] ?? 0;
                  const over = amt > cap;
                  return (
                    <div key={k}>
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-sm text-gray-800">{CATEGORY_META[k].icon} {CATEGORY_META[k].label}</span>
                        <span className="text-xs text-gray-700">{inr(amt)} / {inr(cap)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#fdf2f4" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, cap ? Math.round((amt / cap) * 100) : 100)}%`, background: over ? "#c93a52" : "linear-gradient(to right, #a8213b, #c08a0c)" }} />
                      </div>
                      {over && <div className="text-xs mt-1 font-medium" style={{ color: "#a8213b" }}>⚠ {inr(amt - cap)} over this category's budget</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6" style={{ border: "1px solid #fbe8ec" }}>
              <h3 className="font-medium text-gray-700 text-sm mb-3">Payment history</h3>
              {history.length === 0
                ? <p className="text-sm text-gray-700">Payments you make will be listed here with a reference number.</p>
                : <ul className="space-y-2.5">{history.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0"><span className="block text-gray-800 font-medium">{p.vendorName}</span><span className="block text-xs text-gray-600">{p.label} · {p.ref}</span></span>
                      <span className="font-semibold text-gray-800 shrink-0">{inr(p.amount)}</span>
                    </li>))}</ul>}
            </div>

            <div className="rounded-2xl p-4 sm:p-5 text-sm text-gray-800 leading-relaxed" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
              <div className="font-semibold" style={{ color: "#a8213b" }}>🌲 How payments will work</div>
              <p className="mt-1">With Pine Labs connected, each instalment becomes a secure payment link sent to the vendor, and receipts and confirmations arrive here automatically. Right now it's a test-mode walkthrough. Due dates run back from your wedding on {formatDay(addDays(plan.date, 0))}.</p>
            </div>
          </div>
        </div>
      )}

      {paying && <Checkout payment={paying} onClose={() => setPaying(null)} onPaid={(method, ref) => markPaid(paying.id, method, ref)} />}
    </div>
  );
}

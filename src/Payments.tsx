import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE, CD_GST, CATEGORY_META, PAY_SPLITS, PRIMARY_BTN, addDays, buildPayments, daysBetween, formatDay, inr, isoDate, shortDay,
  type BudgetAllocation, type Booking, type Category, type Payment, type PaySplit, type WeddingPlan,
} from "./shared";

// Payments to the vendors the couple has booked. In this prototype the checkout runs in TEST MODE:
// no card or bank details are collected and no money moves. Real payments will go through Pine Labs.

const METHODS = [
  { id: "UPI", label: "UPI", hint: "Pay from any UPI app" },
  { id: "Card", label: "Debit or credit card", hint: "Visa, Mastercard, RuPay" },
  { id: "Net banking", label: "Net banking", hint: "Pay from your bank account" },
];

// Pine Labs link ids are long: show the tail
const shortRef = (r?: string) => (r && r.length > 16 ? `…${r.slice(-8)}` : r ?? "");

function splitOf(rows: Payment[]): PaySplit {
  if (rows.length === 1) return "100";
  return rows.length === 2 ? "50-50" : "30-40-30";
}

type Customer = { name: string; phone: string; email?: string };

// The pay screen. With Pine Labs connected it makes a payment link, sends the couple to Pine Labs' page to pay, and watches
// the link until Pine Labs says it is paid. Without keys it falls back to the built-in test checkout (nothing real happens).
function Checkout({ payment, customer, onClose, onPaid, onLink }: {
  payment: Payment; customer: Customer; onClose: () => void; onPaid: (method: string, ref: string) => void; onLink: (linkId: string, url: string) => void;
}) {
  const [phase, setPhase] = useState<"loading" | "choose" | "processing" | "live" | "done" | "error">("loading");
  const [method, setMethod] = useState(METHODS[0].id);
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState<{ id: string; url: string; env: string } | null>(null);
  const [status, setStatus] = useState("CREATED");
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  const finished = useRef(false);

  const finish = (m: string, r: string) => { if (finished.current) return; finished.current = true; setRef(r); setPhase("done"); onPaid(m, r); };

  const start = async () => {
    setPhase("loading"); setMsg("");
    try {
      // an instalment keeps one open link: come back to it instead of making another
      if (payment.linkId && payment.linkUrl) {
        const r = await fetch(`${API_BASE}/api/payments/status?linkId=${encodeURIComponent(payment.linkId)}`);
        if (r.ok) {
          const s = await r.json();
          if (s.mode === "live") {
            if (s.paid) return finish("Pine Labs", payment.linkId);
            if (["CREATED", "CLICKED", "PAYMENT_INITIATED"].includes(s.status)) { setLink({ id: payment.linkId, url: payment.linkUrl, env: s.env ?? "uat" }); setStatus(s.status); return setPhase("live"); }
          }
        }
      }
      const res = await fetch(`${API_BASE}/api/payments/link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id, amount: payment.amount, description: `${payment.label} to ${payment.vendorName}`,
          customer: { name: customer.name, phone: customer.phone, email: customer.email ?? "" },
          tags: { vendor: payment.vendorName.slice(0, 60), instalment: payment.label, category: payment.category },
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { detail?: string }).detail ?? "Could not start the payment.");
      const data = await res.json();
      if (data.mode === "demo") return setPhase("choose");
      onLink(data.linkId, data.url);
      setLink({ id: data.linkId, url: data.url, env: data.env }); setStatus(data.status || "CREATED"); setPhase("live");
    } catch (e) {
      setMsg(e instanceof TypeError ? "Could not reach the payment service. Check that the backend is running." : (e as Error).message);
      setPhase("error");
    }
  };
  useEffect(() => { start(); return () => { alive.current = false; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const check = async () => {
    if (!link) return;
    setChecking(true);
    try {
      const r = await fetch(`${API_BASE}/api/payments/status?linkId=${encodeURIComponent(link.id)}`);
      if (!r.ok || !alive.current) return;
      const s = await r.json();
      setStatus(s.status);
      if (s.paid) finish("Pine Labs", link.id);
      else if (s.status === "EXPIRED" || s.status === "CANCELLED") { setMsg(`This payment link was ${s.status === "EXPIRED" ? "not used in time" : "cancelled"}.`); setPhase("error"); }
    } finally { if (alive.current) setChecking(false); }
  };
  // while the couple pays on Pine Labs' page, look every few seconds
  useEffect(() => {
    if (phase !== "live" || !link) return;
    const t = window.setInterval(check, 4000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, link]);

  const cancelLink = async () => {
    if (link) { try { await fetch(`${API_BASE}/api/payments/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkId: link.id }) }); } catch { /* the link expires by itself */ } }
    onClose();
  };

  const payDemo = () => {
    setPhase("processing");
    window.setTimeout(() => finish(method, `PLTEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`), 1300);
  };

  const testEnv = !link || link.env !== "production";
  const busy = phase === "processing";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-7 space-y-5 max-h-[92dvh] overflow-y-auto" style={{ borderTop: "3px solid #c08a0c", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">Secure checkout · Pine Labs</div>
            <h3 className="text-2xl font-medium text-gray-800 mt-1">{inr(payment.amount)}</h3>
            <div className="text-sm text-gray-700">{payment.label} to {payment.vendorName}</div>
          </div>
          {!busy && <button onClick={onClose} aria-label="Close" className="text-xl px-3 py-2 -mr-3 -mt-2" style={{ color: "#444" }}>✕</button>}
        </div>

        {phase === "loading" && <div className="text-center py-6 text-gray-800 text-sm animate-pulse">Setting up your payment…</div>}

        {phase === "live" && link && (
          <>
            {testEnv && (
              <div className="rounded-xl p-3 text-sm text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
                <span className="font-semibold">Pine Labs test environment.</span> Use Pine Labs' test payment details on their page. No real money moves.
              </div>
            )}
            <button onClick={() => window.open(link.url, "_blank", "noopener")} className="w-full text-white rounded-xl py-3.5 font-medium text-sm sparkle-btn" style={PRIMARY_BTN}>Open Pine Labs checkout ↗</button>
            <div className="rounded-xl p-3 text-sm text-gray-800 space-y-1" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
              <div className="animate-pulse">Waiting for your payment… this page updates by itself.</div>
              <div className="text-xs text-gray-700">Link status: {status === "CREATED" ? "ready" : status === "CLICKED" ? "opened" : status === "PAYMENT_INITIATED" ? "payment started" : status}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={check} disabled={checking} className="flex-1 rounded-xl py-2.5 text-sm font-medium disabled:opacity-60" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>{checking ? "Checking…" : "I've paid: check now"}</button>
              <button onClick={cancelLink} className="rounded-xl px-4 py-2.5 text-sm text-gray-800" style={{ border: "1px solid #ddd" }}>Cancel link</button>
            </div>
          </>
        )}

        {phase === "choose" && (
          <>
            <div className="rounded-xl p-3 text-sm text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
              <span className="font-semibold">Test mode.</span> Pine Labs isn't connected on this server, so this is a walkthrough. No money moves and no card or bank details are asked for.
            </div>
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
            <button onClick={payDemo} className="w-full text-white rounded-xl py-3.5 font-medium text-sm sparkle-btn" style={PRIMARY_BTN}>Pay {inr(payment.amount)} (test)</button>
          </>
        )}
        {phase === "processing" && <div className="text-center py-6 text-gray-800 text-sm">Processing your test payment…</div>}

        {phase === "error" && (
          <div className="space-y-3">
            <div className="rounded-xl p-3 text-sm font-medium" style={{ background: "#fdf2f4", color: "#a8213b", border: "1px solid #f5c6d0" }}>{msg}</div>
            <div className="flex gap-2">
              <button onClick={start} className="flex-1 text-white rounded-xl py-3 font-medium text-sm" style={PRIMARY_BTN}>Try again</button>
              <button onClick={onClose} className="rounded-xl px-5 py-3 text-sm text-gray-800" style={{ border: "1px solid #ddd" }}>Close</button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center space-y-3 py-2">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl text-white" style={{ background: "#2f6b1f" }}>✓</div>
            <div className="text-lg font-medium text-gray-800">{link ? "Payment received" : "Test payment recorded"}</div>
            <div className="text-sm text-gray-700" style={{ overflowWrap: "anywhere" }}>Reference {ref} · {link ? "Pine Labs" : method}</div>
            <button onClick={onClose} className="w-full rounded-xl py-3 font-medium text-sm" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentsTab({ plan, bookings, allocation, payments, setPayments, onBrowse, customer }: {
  plan: WeddingPlan; bookings: Booking[]; allocation: BudgetAllocation; customer: Customer;
  payments: Payment[]; setPayments: (fn: (p: Payment[]) => Payment[]) => void; onBrowse: () => void;
}) {
  const [paying, setPaying] = useState<Payment | null>(null);
  const [pine, setPine] = useState<{ configured: boolean; env: string | null } | null>(null); // is Pine Labs connected on this server?
  useEffect(() => { fetch(`${API_BASE}/api/payments/config`).then((r) => (r.ok ? r.json() : null)).then(setPine).catch(() => setPine(null)); }, []);
  const today = isoDate(new Date());

  // Every booking gets a payment schedule. Unpaid instalments for a booking that was undone are dropped.
  useEffect(() => {
    setPayments((ps) => {
      const kept = ps.filter((p) => p.status === "paid" || p.kind === "service" || bookings.some((b) => b.vendorId === p.vendorId));
      const fresh = bookings.filter((b) => !kept.some((p) => p.vendorId === b.vendorId)).flatMap((b) => buildPayments(b, plan.date, "30-40-30"));
      return fresh.length || kept.length !== ps.length ? [...kept, ...fresh] : ps;
    });
  }, [bookings, plan.date, setPayments]);

  const changeSplit = (b: Booking, split: PaySplit) =>
    setPayments((ps) => [...ps.filter((p) => p.vendorId !== b.vendorId), ...buildPayments(b, plan.date, split)]);

  // Payments to Partnered itself (the creative director), kept apart from vendor bookings
  const svc = payments.filter((p) => p.kind === "service").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const svcTotal = svc.reduce((a, p) => a + p.amount, 0);
  const svcPaid = svc.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const svcBase = Math.round(svcTotal / (1 + CD_GST));

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
        <span className="text-sm px-3 py-1.5 rounded-full font-medium" style={pine?.configured ? { background: "#eaf3ff", color: "#27457a", border: "1px solid #cfd8e3" } : { background: "#fffdf0", color: "#7a5206", border: "1px solid #fbf0a1" }}>{pine?.configured ? (pine.env === "production" ? "Live payments · Pine Labs" : "Pine Labs test environment") : "Test mode · Pine Labs not connected yet"}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Committed", value: inr(committed), sub: `${bookings.length} vendor booking${bookings.length === 1 ? "" : "s"}${svc.length ? " + creative director" : ""}`, color: "#a8213b" },
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

      {bookings.length === 0 && svc.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 sm:p-12 text-center" style={{ border: "1px solid #fbe8ec" }}>
          <div className="text-4xl mb-3" aria-hidden="true">💳</div>
          <div className="text-xl font-medium text-gray-800">No bookings to pay yet</div>
          <p className="text-sm text-gray-700 mt-1 max-w-md mx-auto">Open a vendor and press "Mark as booked". A payment schedule with an advance and balance instalments appears here automatically.</p>
          <button onClick={onBrowse} className="mt-5 text-white rounded-xl px-6 py-3 font-medium text-sm" style={PRIMARY_BTN}>Browse vendors</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
          <div className="xl:col-span-8 space-y-4 min-w-0">
            {svc.length > 0 && (
              <div className="rounded-2xl p-4 sm:p-6 space-y-4" style={{ background: "linear-gradient(135deg, #fffdf0, #fdf2f4)", border: "2px solid #c08a0c" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a8213b" }}>Paid to Partnered</div>
                    <div className="text-lg font-medium text-gray-800">🎨 Partnered Creative Director</div>
                    <div className="text-sm text-gray-700">One person from our team, with you on the ground from day one.</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold" style={{ color: "#a8213b" }}>{inr(svcTotal)}</div>
                    <div className="text-xs text-gray-700">{inr(svcBase)} fee + {inr(svcTotal - svcBase)} GST</div>
                  </div>
                </div>
                <div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#fdf2f4" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((svcPaid / svcTotal) * 100)}%`, background: "linear-gradient(to right, #2f6b1f, #6bb04f)" }} />
                  </div>
                  <div className="text-xs text-gray-700 mt-1">{inr(svcPaid)} paid of {inr(svcTotal)}</div>
                </div>
                <div className="space-y-2">
                  {svc.map((p) => {
                    const overdue = p.status === "due" && p.dueDate < today;
                    return (
                      <div key={p.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl p-3 bg-white" style={{ border: "1px solid #fbe8ec" }}>
                        <div className="flex-1 min-w-[9rem]">
                          <div className="text-sm font-semibold text-gray-800">{p.label}</div>
                          <div className="text-xs text-gray-700">{p.status === "paid" ? `Paid ${shortDay(p.paidOn!)} · ${p.method} · ${shortRef(p.ref)}` : `Due ${p.dueDate === today ? "now" : formatDay(p.dueDate)}`}</div>
                        </div>
                        <div className="text-base font-semibold text-gray-800">{inr(p.amount)}</div>
                        {p.status === "paid"
                          ? <span className="text-sm font-medium px-3 py-1.5 rounded-full" style={{ background: "#f3faf0", color: "#2f6b1f", border: "1px solid #9bd08a" }}>✓ Paid</span>
                          : <button onClick={() => setPaying(p)} className="w-full sm:w-auto text-white rounded-xl px-5 py-2.5 text-sm font-medium" style={PRIMARY_BTN}>{overdue ? "Pay now (overdue)" : "Pay now"}</button>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-700">{svc.some((p) => p.status === "paid") ? "Advance received. Your fee is now locked, and your creative director will be introduced to you shortly." : "Pay the advance to lock your fee and start. The balance is due on day one, when your director reaches you."}</p>
              </div>
            )}
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
                              {p.status === "paid" ? `Paid ${shortDay(p.paidOn!)} · ${p.method} · ${shortRef(p.ref)}` : `Due ${p.dueDate === today ? "today" : formatDay(p.dueDate)}`}
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
                      <span className="min-w-0"><span className="block text-gray-800 font-medium">{p.vendorName}</span><span className="block text-xs text-gray-600">{p.label} · {shortRef(p.ref)}</span></span>
                      <span className="font-semibold text-gray-800 shrink-0">{inr(p.amount)}</span>
                    </li>))}</ul>}
            </div>

            <div className="rounded-2xl p-4 sm:p-5 text-sm text-gray-800 leading-relaxed" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
              <div className="font-semibold" style={{ color: "#a8213b" }}>🌲 How payments will work</div>
              <p className="mt-1">{pine?.configured ? "Each instalment becomes a secure Pine Labs payment link. You pay on their page, and this page notices by itself and marks it paid." : "With Pine Labs connected, each instalment becomes a secure payment link, and receipts and confirmations arrive here automatically. Right now it's a test-mode walkthrough."} Due dates run back from your wedding on {formatDay(addDays(plan.date, 0))}.</p>
            </div>
          </div>
        </div>
      )}

      {paying && <Checkout payment={payments.find((x) => x.id === paying.id) ?? paying} customer={customer} onClose={() => setPaying(null)} onPaid={(method, ref) => markPaid(paying.id, method, ref)}
        onLink={(linkId, url) => setPayments((ps) => ps.map((x) => (x.id === paying.id ? { ...x, linkId, linkUrl: url } : x)))} />}
    </div>
  );
}

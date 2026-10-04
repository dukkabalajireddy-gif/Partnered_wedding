import { CD_GST } from "./shared";

// Refund and cancellation rules for the Partnered creative director service.
// Draft policy for the prototype: have it reviewed before real money is taken.

const RULES: { when: string; you: string; why: string }[] = [
  { when: "Within 48 hours of paying the advance (and more than 30 days before your first event)", you: "100% of the advance back", why: "A cooling-off window. Change your mind, no questions asked." },
  { when: "More than 30 days before your first event", you: "Advance back, less 20% of the total fee", why: "Covers the planning and briefing work already done for you." },
  { when: "8 to 30 days before your first event", you: "Advance is kept, the balance is not charged", why: "Your director has already been reserved and the dates blocked." },
  { when: "7 days or less before your first event", you: "Full fee is due", why: "The dates can no longer be given to another couple." },
  { when: "We cannot assign a director, or your director does not reach you on day one", you: "Everything you paid, back in full", why: "This is our promise. If we don't show up, you don't pay." },
];

export default function RefundPolicy({ onPayments }: { onPayments: () => void }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
      <header className="space-y-2">
        <div className="text-sm uppercase tracking-wider" style={{ color: "#c08a0c" }}>Refund and cancellation</div>
        <h1 className="text-3xl sm:text-4xl font-medium" style={{ color: "#a8213b" }}>Simple, fair, written down.</h1>
        <p className="text-base sm:text-lg text-gray-800 leading-relaxed">This is how refunds work for the Partnered creative director service. It applies to the fee you pay to Partnered. We keep it short so you can read it in a minute.</p>
      </header>

      <section className="bg-white rounded-3xl overflow-hidden" style={{ border: "1px solid #fbe8ec" }}>
        {RULES.map((r, i) => (
          <div key={r.when} className="p-4 sm:p-5" style={i ? { borderTop: "1px solid #fbe8ec" } : undefined}>
            <div className="text-sm font-semibold text-gray-800">{r.when}</div>
            <div className="mt-1 text-base font-semibold" style={{ color: "#a8213b" }}>{r.you}</div>
            <div className="text-sm text-gray-700 mt-0.5">{r.why}</div>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-3xl p-5 sm:p-6 space-y-3" style={{ border: "1px solid #fbe8ec" }}>
        <h2 className="text-xl sm:text-2xl font-medium" style={{ color: "#a8213b" }}>Good to know</h2>
        <ul className="space-y-2 text-base text-gray-800 leading-relaxed list-disc pl-5">
          <li><span className="font-semibold">Changing your date</span> is free once, if you tell us at least 14 days before your first event. Your director stays with you.</li>
          <li><span className="font-semibold">GST</span> ({Math.round(CD_GST * 100)}%) is refunded in the same proportion as the fee.</li>
          <li><span className="font-semibold">How you get it back:</span> to the same payment method, within 5 to 7 working days of us confirming the cancellation.</li>
          <li><span className="font-semibold">Vendor payments</span> are made directly to your vendors and follow their own terms. Partnered does not hold that money. Your director will help you ask for a fair settlement.</li>
          <li><span className="font-semibold">Changing your budget</span> after paying the advance does not change your fee. It is locked.</li>
        </ul>
      </section>

      <p className="text-xs text-gray-600">This is a prototype. Payments run in the Pine Labs test environment and no real money moves. This policy is a draft and will be reviewed before launch.</p>
      <button onClick={onPayments} className="rounded-xl px-6 py-3 font-medium text-sm" style={{ color: "#a8213b", border: "1px solid #a8213b", background: "#fff" }}>Go to my payments</button>
    </div>
  );
}

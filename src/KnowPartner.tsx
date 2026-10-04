import { BLOG_IMAGES } from "./blogImages";
import { CD_GST, CD_MAX_FEE, CD_MIN_BUDGET, PRIMARY_BTN, cdAvailable, cdFee, inr, type WeddingPlan } from "./shared";

// Know your Partner: who we are, what a creative director is, how the fee works, and the community we are building.
// Written as the company's own voice. Keep the claims here in step with what the company actually does.

const EXAMPLES = [300_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000];

export default function KnowPartner({ plan, onHire, onPayments, onVendors }: {
  plan: WeddingPlan; onHire: () => void; onPayments: () => void; onVendors: () => void;
}) {
  const hero = BLOG_IMAGES.udaipur;
  const mine = cdAvailable(plan.budget) ? cdFee(plan.budget) : null;
  const hired = plan.creativeDirector && !!mine;

  const pillars: [string, string, string][] = [
    ["🧠", "Smart planning", "Set your budget, tell our agent what you want, and get a shortlist of vendors that fit your budget, style and menu in about a minute."],
    ["🤝", "The human touch", "A Partnered creative director, one real person, who is with you on the ground and keeps the whole wedding moving."],
    ["✅", "Vendors you can trust", "Real listings in your city, scored and compared, with quotes, payment links and delivery tracking in one place."],
  ];
  const does = [
    "Shapes the look and story of your wedding across every event: theme, decor, styling, and how the vendors work together.",
    "Briefs your vendors, checks their plans and keeps every function on schedule.",
    "Arrives on day one, walks each venue with you, and is on the ground when things happen.",
    "Solves problems quietly, so your family can enjoy the day.",
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
      <header className="rounded-3xl overflow-hidden relative text-white" style={{ background: "#3a0f1a" }}>
        {hero && <img src={hero.src} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(58,15,26,0.4) 0%, rgba(58,15,26,0.93) 100%)" }} />
        <div className="relative p-6 sm:p-10 pt-24 sm:pt-40">
          <div className="text-sm uppercase tracking-wider" style={{ color: "#f5d98a" }}>Know your Partner</div>
          <h1 className="text-3xl sm:text-5xl font-medium mt-2 leading-tight">Your dream wedding, even when you're short on time.</h1>
          <p className="mt-3 text-base sm:text-lg opacity-95 leading-relaxed max-w-2xl">Partnered brings smart planning, trusted vendors and a real person on the ground together, so you can start today and still get the wedding you imagined.</p>
          {hero && <a href={hero.page} target="_blank" rel="noreferrer" className="inline-block mt-3 text-xs underline" style={{ color: "rgba(255,255,255,0.85)" }}>Photo: {hero.credit} · Wikimedia Commons</a>}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl sm:text-3xl font-medium" style={{ color: "#a8213b" }}>Why we built Partnered</h2>
        <p className="text-base sm:text-lg text-gray-800 leading-relaxed">An Indian wedding is dozens of decisions across several days, and most couples are also juggling jobs, families in different cities and a deadline that won't move. Many have a clear dream and very little time. Partnered exists for them. We take the legwork, the comparing and the chasing off your plate, and we give you a human guide so you never plan alone.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pillars.map(([icon, title, text]) => (
          <div key={title} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #fbe8ec" }}>
            <div className="text-3xl" aria-hidden="true">{icon}</div>
            <h3 className="text-lg font-semibold text-gray-800 mt-2">{title}</h3>
            <p className="text-sm text-gray-700 leading-relaxed mt-1">{text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl p-5 sm:p-8 space-y-4" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "2px solid #c08a0c" }}>
        <h2 className="text-2xl sm:text-3xl font-medium" style={{ color: "#a8213b" }}>What is a Partnered creative director?</h2>
        <p className="text-base text-gray-800 leading-relaxed">A creative director is the person who holds your whole wedding together. Every Partnered creative director is recruited and hired by us for their experience, and works for Partnered, so they work for you, not for any one vendor.</p>
        <ul className="space-y-2.5">
          {does.map((d) => <li key={d} className="flex gap-3 text-base text-gray-800 leading-relaxed"><span style={{ color: "#c08a0c" }} aria-hidden="true">✦</span><span>{d}</span></li>)}
        </ul>
      </section>

      <section className="bg-white rounded-3xl p-5 sm:p-8 space-y-4" style={{ border: "1px solid #fbe8ec" }}>
        <h2 className="text-2xl sm:text-3xl font-medium" style={{ color: "#a8213b" }}>How the fee works</h2>
        <p className="text-base text-gray-800 leading-relaxed">The creative director fee is a share of your wedding budget: <span className="font-semibold">5% for smaller budgets, rising to 10% from ₹30 lakh</span>. It is never less than ₹25,000 or more than {inr(CD_MAX_FEE)} (before GST), and the service is open to budgets of {inr(CD_MIN_BUDGET)} and above. GST at {Math.round(CD_GST * 100)}% is added. The fee comes out of your total budget, so you always see what is left for vendors.</p>
        <p className="text-base text-gray-800 leading-relaxed">You pay in two halves: <span className="font-semibold">50% when you add your creative director</span>, and <span className="font-semibold">50% on day one, when they reach you</span>. Both are secure payment links that go to Partnered. Once you've paid the advance, your fee is locked.</p>
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid #fbe8ec" }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#fdf8f0" }}>{["Your budget", "Share", "Fee", "With GST"].map((h) => <th key={h} className="text-left px-4 py-3 font-semibold text-gray-800">{h}</th>)}</tr></thead>
            <tbody>
              {EXAMPLES.map((b) => { const f = cdFee(b); return (
                <tr key={b} style={{ borderTop: "1px solid #fbe8ec" }}>
                  <td className="px-4 py-2.5 text-gray-800">{inr(b)}</td><td className="px-4 py-2.5 text-gray-800">{f.percent}%</td>
                  <td className="px-4 py-2.5 text-gray-800">{inr(f.base)}</td><td className="px-4 py-2.5 font-semibold" style={{ color: "#a8213b" }}>{inr(f.total)}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
        {mine
          ? <p className="text-base text-gray-800 rounded-xl p-3.5" style={{ background: "#fff7d6", border: "1px solid #e8c75a" }}>For your budget of {inr(plan.budget)}: <span className="font-semibold">{inr(mine.total)}</span> including GST ({mine.percent}% before GST), paid as {inr(mine.advance)} now and {inr(mine.balance)} on day one.</p>
          : <p className="text-sm text-gray-700">The creative director service starts at a budget of {inr(CD_MIN_BUDGET)}.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl sm:text-3xl font-medium" style={{ color: "#a8213b" }}>A community for couples who are short on time</h2>
        <p className="text-base sm:text-lg text-gray-800 leading-relaxed">We're building more than a tool. We're building a community of couples, vendors and creative directors who help each other get great weddings done, fast and with care. Couples share what worked, vendors earn their reputation through real bookings, and our creative directors bring the experience of many weddings to yours.</p>
        <p className="text-base sm:text-lg text-gray-800 leading-relaxed">If you have a dream wedding and a tight calendar, you can get the service, the human touch and the right vendors from the very first day. That's the promise of Partnered.</p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        {hired
          ? <button onClick={onPayments} className="text-white rounded-xl px-7 py-3.5 font-medium text-sm sparkle-btn" style={PRIMARY_BTN}>See my creative director payments →</button>
          : <button onClick={onHire} disabled={!mine} className="text-white rounded-xl px-7 py-3.5 font-medium text-sm sparkle-btn disabled:opacity-50" style={PRIMARY_BTN}>{mine ? `Add a creative director · ${inr(mine.total)}` : "Available from a budget of ₹2,50,000"}</button>}
        <button onClick={onVendors} className="rounded-xl px-7 py-3.5 font-medium text-sm" style={{ color: "#a8213b", border: "1px solid #a8213b", background: "#fff" }}>Browse vendors</button>
      </div>
    </div>
  );
}

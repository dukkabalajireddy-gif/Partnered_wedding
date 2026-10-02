import { useState, useMemo, useRef, useEffect } from "react";

type Category = "attire" | "catering" | "decoration" | "gifts" | "logistics" | "transport" | "hotels" | "photography" | "music";
type BudgetAllocation = Record<Category, number>;

// In development the backend runs on :8000; in production it is served under the same site at /api.
const API_BASE = import.meta.env.DEV ? "http://localhost:8000" : "";

// A vendor as the marketplace backend describes it (GET /api/vendors).
// "osm" = a real listing from OpenStreetMap (no ratings or prices exist for it, so those are null);
// "sample" = a fictional vendor used to fill gaps in the prototype.
interface MarketVendor {
  id: string; name: string; category: Category; city: string; area: string;
  tier: number; priceBand: string; rating: number | null; reliability: number | null; responseHours: number | null;
  premiumLook: number | null; distanceKm: number; capacity: number | null; partnerScore: number | null;
  estCost: number; estCostTypical: boolean; tag: string; image: string | null; description: string;
  phone: string | null; email: string | null; hours: string | null; website: string | null;
  source: "osm" | "sample"; osmUrl: string | null;
}
// The few fields needed to open a chat or record a booking with a vendor.
type VendorRef = Pick<MarketVendor, "id" | "name" | "category" | "area" | "city">;
interface CityInfo { name: string; state: string; kind: "metro" | "city" | "destination"; vendorCount: number; realCount?: number; }

// A vendor the couple has booked. Spend is computed from these.
interface Booking { vendorId: string; vendorName: string; category: Category; amount: number; }

interface ChatMessage {
  id: string; from: "me" | "vendor"; text: string; time: string;
}

interface Thread {
  id: string; sender: string; role: string; avatar: string;
  unread: boolean; lastTime: string; messages: ChatMessage[];
  draft?: string; // a message prepared for the couple to review and send
}

interface WeddingPlan {
  name: string; partnerName: string; date: string;
  location: string; budget: number; guestCount: number;
  rituals: string[];
  schedule: ScheduleDay[];
  creativeDirector: boolean;
}

// One day of the celebrations and the events held on it.
interface ScheduleDay { date: string; rituals: string[]; }

// ─── Rituals (grouped by tradition; the same ritual can appear in more than one group) ───

const RITUAL_GROUPS: { title: string; items: string[] }[] = [
  { title: "Popular across India", items: ["Roka", "Engagement / Sagai", "Haldi", "Mehndi", "Sangeet", "Baraat", "Wedding Ceremony", "Reception", "Vidaai"] },
  { title: "North Indian & Punjabi", items: ["Chunni Chadai", "Chooda Ceremony", "Kalire", "Jaggo", "Ghodi Chadhna", "Milni", "Jaimala / Varmala", "Pheras", "Kanyadaan", "Sindoor Daan", "Griha Pravesh", "Pag Phere"] },
  { title: "Rajasthani, Marwari & Gujarati", items: ["Mayra / Bhaat", "Gol Dhana", "Pithi Dastoor", "Grah Shanti Puja", "Mandap Muhurat", "Madhuparka", "Antarpat", "Garba / Dandiya Night"] },
  { title: "Bengali", items: ["Aiburobhat", "Gaye Holud", "Dodhi Mangal", "Bor Boron", "Subho Drishti", "Saat Paak", "Sindoor Khela", "Bou Bhaat"] },
  { title: "South Indian", items: ["Nischayathartham", "Pandhal Kaal", "Kasi Yatra", "Oonjal", "Mangalyadharanam / Muhurtham", "Saptapadi", "Pellikuthuru", "Nalugu", "Thali Kettu", "Maalai Maatral", "Snatakam"] },
  { title: "Maharashtrian", items: ["Sakhar Puda", "Kelvan", "Halad Chadavne", "Simant Pujan", "Lagna", "Satyanarayan Puja"] },
  { title: "Muslim", items: ["Mangni", "Manjha", "Dholki", "Sanchaq", "Nikah", "Rukhsati", "Walima", "Chauthi"] },
  { title: "Sikh", items: ["Kurmai", "Maiyan", "Anand Karaj", "Doli"] },
  { title: "Christian", items: ["Betrothal / Banns", "Bridal Shower", "Roce", "Church Wedding", "Cake Cutting"] },
  { title: "Parsi", items: ["Adravu / Adarni", "Achumichu", "Madavsaro", "Lagan", "Jashan"] },
  { title: "Modern add-ons", items: ["Cocktail Night", "Bachelor / Bachelorette", "Pre-wedding Shoot", "Kirtan / Jagrata", "Welcome Dinner"] },
];

function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

function now() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ─── ML ──────────────────────────────────────────────────────────────────────

const ML_WEIGHTS: Record<Category, number> = {
  catering: 0.30, attire: 0.15, decoration: 0.12, photography: 0.10,
  hotels: 0.10, transport: 0.08, music: 0.06, gifts: 0.05, logistics: 0.04,
};

const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  catering:    { label: "Catering & Food",   icon: "🍽️", color: "#a8213b" },
  attire:      { label: "Attire & Lehenga",  icon: "👗", color: "#881a30" },
  decoration:  { label: "Decoration",        icon: "💐", color: "#c08a0c" },
  photography: { label: "Photography",       icon: "📸", color: "#c93a52" },
  hotels:      { label: "Hotels & Venue",    icon: "🏨", color: "#7c5210" },
  transport:   { label: "Transport",         icon: "🚗", color: "#9a6a0a" },
  music:       { label: "Music & Sangeet",   icon: "🎵", color: "#e0b015" },
  gifts:       { label: "Gifts & Shagun",    icon: "🎁", color: "#6e1828" },
  logistics:   { label: "Logistics",         icon: "📋", color: "#c93a52" },
};

function mlAllocate(total: number, guestCount: number): BudgetAllocation {
  const w = { ...ML_WEIGHTS };
  if (guestCount > 400) { w.catering = 0.35; w.attire = 0.12; w.hotels = 0.08; }
  else if (guestCount < 100) { w.catering = 0.22; w.attire = 0.18; w.photography = 0.14; }
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  const r = {} as BudgetAllocation;
  (Object.keys(w) as Category[]).forEach((k) => { r[k] = Math.round((w[k] / sum) * total); });
  return r;
}

// ─── Background art ───────────────────────────────────────────────────────────

// Fixed, low-opacity art that sits behind the page content.
function Backdrop() {
  const sparks = [[8, 18], [22, 72], [38, 9], [55, 84], [71, 22], [88, 60], [93, 12], [14, 46], [64, 52], [47, 33]];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden="true">
      <div className="absolute inset-0 rangoli-bg" />
      {sparks.map(([x, y], i) => (
        <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, fontSize: 14 + (i % 3) * 5, color: "#e0b015", WebkitTextFillColor: "#e0b015", background: "none", animation: `twinkle 2.8s ease-in-out ${i * 0.37}s infinite` }}>✦</span>
      ))}
    </div>
  );
}

// ─── Events: picker, day-by-day schedule, creative director, editor ───────────

const CHIP_ON = { background: "linear-gradient(135deg, #a8213b, #881a30)", color: "#fff", border: "1px solid #881a30" };
const CHIP_OFF = { background: "#fff", color: "#1a1a1a", border: "1px solid #f5c6d0" };
const CHIP_ELSEWHERE = { background: "#fdf2f4", color: "#444", border: "1px dashed #c98a98" };
const INPUT_STYLE = { border: "1px solid #f5c6d0", background: "#fdf2f4" };
const PRIMARY_BTN = { background: "linear-gradient(135deg, #a8213b, #881a30)" };

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextDay(s: string) {
  if (!s) return "";
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}
function formatDay(s: string) {
  return new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function pruneSchedule(days: ScheduleDay[], rituals: string[]): ScheduleDay[] {
  return days.map((d) => ({ ...d, rituals: d.rituals.filter((r) => rituals.includes(r)) }));
}
// Returns a message while the schedule is incomplete, or null when it is ready to save.
// Pass hideUnassigned to skip the "assign every event" message (ScheduleBuilder already lists them),
// while the plain call still returns it so Continue/Save stay disabled.
function scheduleError(rituals: string[], days: ScheduleDay[], hideUnassigned = false): string | null {
  if (rituals.length === 0) return "Pick at least one event.";
  if (days.length === 0) return "Add at least one day.";
  if (days.some((d) => !d.date)) return "Pick a date for every day.";
  if (new Set(days.map((d) => d.date)).size !== days.length) return "Two days have the same date.";
  if (rituals.some((r) => !days.some((d) => d.rituals.includes(r)))) return hideUnassigned ? null : "Assign every event to a day.";
  return null;
}
function finalizeSchedule(days: ScheduleDay[]): ScheduleDay[] {
  return days.filter((d) => d.rituals.length > 0).sort((a, b) => a.date.localeCompare(b.date));
}

function RitualPicker({ selected, onToggle, onClear, maxHeight = "30vh" }: {
  selected: string[]; onToggle: (r: string) => void; onClear: () => void; maxHeight?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Events planned</label>
        <span className="text-sm font-medium" style={{ color: "#a8213b" }}>
          {selected.length} selected
          {selected.length > 0 && <button className="ml-3 underline" onClick={onClear}>Clear</button>}
        </span>
      </div>
      <div className="mt-2 space-y-4 overflow-y-auto pr-2" style={{ maxHeight }}>
        {RITUAL_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#1a1a1a" }}>{g.title}</div>
            <div className="flex flex-wrap gap-2">
              {g.items.map((r) => {
                const on = selected.includes(r);
                return (
                  <button key={r} onClick={() => onToggle(r)} aria-pressed={on} className="text-sm px-3 py-1.5 rounded-full transition-all" style={on ? CHIP_ON : CHIP_OFF}>
                    {on ? "✓ " : ""}{r}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Day by day: pick a date, then tap the events that happen on it.
function ScheduleBuilder({ rituals, days, onChange }: { rituals: string[]; days: ScheduleDay[]; onChange: (d: ScheduleDay[]) => void }) {
  const today = isoDate(new Date());
  const dayOf = (r: string) => days.findIndex((d) => d.rituals.includes(r));
  const unassigned = rituals.filter((r) => dayOf(r) === -1);

  const toggleOnDay = (idx: number, r: string) =>
    onChange(days.map((d, i) =>
      i === idx
        ? { ...d, rituals: d.rituals.includes(r) ? d.rituals.filter((x) => x !== r) : [...d.rituals, r] }
        : { ...d, rituals: d.rituals.filter((x) => x !== r) }, // an event can only be on one day
    ));
  const setDate = (idx: number, date: string) => onChange(days.map((d, i) => (i === idx ? { ...d, date } : d)));
  const addDay = () => onChange([...days, { date: days.length ? nextDay(days[days.length - 1].date) : "", rituals: [] }]);
  const removeDay = (idx: number) => onChange(days.filter((_, i) => i !== idx));
  const addRemaining = (idx: number) => onChange(days.map((d, i) => (i === idx ? { ...d, rituals: [...d.rituals, ...unassigned] } : d)));

  return (
    <div className="space-y-4">
      {days.map((d, idx) => (
        <div key={idx} className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid #f5c6d0", background: "#fffafb" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold shrink-0" style={{ color: "#a8213b" }}>Day {idx + 1}</span>
            <input type="date" min={today} value={d.date} onChange={(e) => setDate(idx, e.target.value)}
              className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={INPUT_STYLE} />
            {days.length > 1 && (
              <button onClick={() => removeDay(idx)} aria-label={`Remove day ${idx + 1}`} className="text-base px-2" style={{ color: "#444" }}>✕</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {rituals.map((r) => {
              const at = dayOf(r);
              return (
                <button key={r} onClick={() => toggleOnDay(idx, r)} aria-pressed={at === idx}
                  className="text-sm px-3 py-1.5 rounded-full transition-all"
                  style={at === idx ? CHIP_ON : at === -1 ? CHIP_OFF : CHIP_ELSEWHERE}>
                  {at === idx ? "✓ " : ""}{r}{at > -1 && at !== idx ? ` · Day ${at + 1}` : ""}
                </button>
              );
            })}
          </div>
          {unassigned.length > 0 && (
            <button onClick={() => addRemaining(idx)} className="text-sm underline" style={{ color: "#a8213b" }}>Put all remaining events on this day</button>
          )}
        </div>
      ))}
      <button onClick={addDay} className="w-full rounded-xl py-2.5 text-sm font-medium" style={{ border: "1px dashed #a8213b", color: "#a8213b" }}>+ Add another day</button>
      <div className="text-sm font-medium" style={{ color: unassigned.length ? "#a8213b" : "#2f6b1f" }}>
        {unassigned.length ? `${unassigned.length} still need a day: ${unassigned.join(", ")}` : "✓ Every event has a day"}
      </div>
    </div>
  );
}

function CreativeDirectorChoice({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
      <div>
        <div className="text-lg font-semibold text-gray-800">Would you like a creative director for your wedding?</div>
        <p className="text-sm text-gray-600 mt-1">
          A creative director shapes the overall look and feel across all your events (theme, décor, styling and how the vendors work together) so everything feels like one story.
        </p>
      </div>
      <div className="flex gap-3">
        {([[true, "Yes, I'd like one"], [false, "No, I'll manage"]] as const).map(([v, label]) => (
          <button key={label} onClick={() => onChange(v)} aria-pressed={value === v}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all" style={value === v ? CHIP_ON : CHIP_OFF}>
            {value === v ? "✓ " : ""}{label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Edit your events, the day-by-day schedule and the creative director choice after onboarding.
function EditEventsModal({ plan, onSave, onClose }: { plan: WeddingPlan; onSave: (p: WeddingPlan) => void; onClose: () => void }) {
  const [rituals, setRituals] = useState<string[]>(plan.rituals);
  const [days, setDays] = useState<ScheduleDay[]>(plan.schedule.length ? plan.schedule : [{ date: plan.date, rituals: [] }]);
  const [director, setDirector] = useState<boolean>(plan.creativeDirector);

  const toggleRitual = (r: string) => {
    const next = rituals.includes(r) ? rituals.filter((x) => x !== r) : [...rituals, r];
    setRituals(next);
    setDays((d) => pruneSchedule(d, next));
  };
  const error = scheduleError(rituals, days);
  const message = scheduleError(rituals, days, true);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-8 space-y-6" style={{ borderTop: "3px solid #c08a0c" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-medium text-gray-800">Edit your events</h3>
            <p className="text-sm text-gray-600 mt-0.5">Add or remove events, and move them between days.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl px-3 py-2 -mr-3 -mt-2" style={{ color: "#444" }}>✕</button>
        </div>

        <RitualPicker selected={rituals} onToggle={toggleRitual} onClear={() => { setRituals([]); setDays((d) => pruneSchedule(d, [])); }} maxHeight="26vh" />

        <div>
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "#a8213b" }}>Schedule</div>
          <ScheduleBuilder rituals={rituals} days={days} onChange={setDays} />
        </div>

        <CreativeDirectorChoice value={director} onChange={setDirector} />

        {message && <div className="text-sm font-medium" style={{ color: "#a8213b" }}>{message}</div>}
        <div className="flex gap-3">
          <button className="flex-1 rounded-xl py-3 font-medium text-sm" style={{ border: "1px solid #f5c6d0", color: "#a8213b" }} onClick={onClose}>Cancel</button>
          <button className="flex-[2] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40" style={PRIMARY_BTN} disabled={!!error}
            onClick={() => onSave({ ...plan, rituals, schedule: finalizeSchedule(days), creativeDirector: director })}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── City dropdown ────────────────────────────────────────────────────────────

// Used only if the backend's city list has not loaded yet, so onboarding never blocks on it.
const FALLBACK_CITIES: CityInfo[] = [
  ...[["Mumbai", "Maharashtra"], ["Delhi", "Delhi NCR"], ["Bengaluru", "Karnataka"], ["Hyderabad", "Telangana"], ["Chennai", "Tamil Nadu"], ["Kolkata", "West Bengal"], ["Pune", "Maharashtra"], ["Ahmedabad", "Gujarat"]]
    .map(([name, state]) => ({ name, state, kind: "metro" as const, vendorCount: 0 })),
  ...[["Jaipur", "Rajasthan"], ["Lucknow", "Uttar Pradesh"], ["Chandigarh", "Chandigarh"], ["Kochi", "Kerala"], ["Indore", "Madhya Pradesh"], ["Surat", "Gujarat"]]
    .map(([name, state]) => ({ name, state, kind: "city" as const, vendorCount: 0 })),
  ...[["Udaipur", "Rajasthan"], ["Goa", "Goa"], ["Jodhpur", "Rajasthan"], ["Jaisalmer", "Rajasthan"], ["Rishikesh", "Uttarakhand"], ["Mussoorie", "Uttarakhand"], ["Alleppey", "Kerala"]]
    .map(([name, state]) => ({ name, state, kind: "destination" as const, vendorCount: 0 })),
];

// A clean pick-a-city list: no typing, opens directly under the field at the same width.
function CityDropdown({ cities, value, onChange }: { cities: CityInfo[]; value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const list = cities.length ? cities : FALLBACK_CITIES;
  const groups: [string, CityInfo["kind"]][] = [["Metros", "metro"], ["Other major cities", "city"], ["Destination wedding cities", "destination"]];

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={boxRef} className="relative mt-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 text-left" style={INPUT_STYLE}>
        <span style={{ color: value ? "#1a1a1a" : "#4a4a4a" }}>{value || "Select your city"}</span>
        <span aria-hidden="true" className="text-xs transition-transform" style={{ color: "#a8213b", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Cities" className="absolute left-0 right-0 z-30 mt-2 rounded-2xl bg-white overflow-y-auto"
          style={{ border: "1px solid #f5c6d0", maxHeight: 300, boxShadow: "0 12px 32px rgba(120, 30, 50, 0.18)" }}>
          {groups.map(([title, kind]) => {
            const rows = list.filter((c) => c.kind === kind);
            return rows.length === 0 ? null : (
              <div key={kind}>
                <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "#a8213b" }}>{title}</div>
                {rows.map((c) => {
                  const on = c.name === value;
                  return (
                    <button key={c.name} type="button" role="option" aria-selected={on} onClick={() => { onChange(c.name); setOpen(false); }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[#fdf2f4]"
                      style={on ? { background: "#fdf2f4", color: "#a8213b", fontWeight: 600 } : { color: "#1a1a1a" }}>
                      <span>{on ? "✓ " : ""}{c.name}</span>
                      <span className="text-xs" style={{ color: "#555" }}>{c.state}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function OnboardingScreen({ cities, onComplete }: { cities: CityInfo[]; onComplete: (p: WeddingPlan) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<WeddingPlan>>({ rituals: [], schedule: [] });
  const set = (k: keyof WeddingPlan, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const rituals = form.rituals ?? [];
  const days = form.schedule ?? [];
  const toggleRitual = (r: string) =>
    setForm((f) => {
      const cur = f.rituals ?? [];
      const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
      return { ...f, rituals: next, schedule: pruneSchedule(f.schedule ?? [], next) };
    });
  const clearRituals = () => setForm((f) => ({ ...f, rituals: [], schedule: pruneSchedule(f.schedule ?? [], []) }));

  // Moving from "events" to "schedule": start with one day on the wedding date.
  const goToSchedule = () => {
    setForm((f) => ({ ...f, schedule: f.schedule?.length ? f.schedule : [{ date: f.date ?? "", rituals: [] }] }));
    setStep(2);
  };
  const dayError = scheduleError(rituals, days);
  const dayMessage = scheduleError(rituals, days, true);

  return (
    <div className="min-h-dvh flex items-center justify-center relative" style={{ background: "linear-gradient(135deg, #fdf2f4 0%, #fefdf0 50%, #fdf8f0 100%)" }}>
      <Backdrop />
      <div className="w-full max-w-lg px-4 sm:px-6 py-6 sm:py-10 relative" style={{ zIndex: 10 }}>
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#a8213b" }}>
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="text-2xl font-medium tracking-tight" style={{ color: "#a8213b" }}>Partnered</span>
          </div>
          <p className="text-sm font-light" style={{ color: "#c08a0c" }}>Plan your shaadi, your way</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-1 rounded-full transition-all duration-300"
              style={{ width: i <= step ? 48 : 24, background: i <= step ? "#a8213b" : "#f5c6d0" }} />
          ))}
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 sm:p-8" style={{ border: "1px solid #f5c6d0" }}>
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-medium text-gray-800 mb-1">Welcome! Who's getting married?</h2>
                <p className="text-sm text-gray-400">No account needed — we'll remember you here.</p>
              </div>
              <div className="space-y-3">
                {(["name", "partnerName"] as const).map((k, i) => (
                  <div key={k}>
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>{i === 0 ? "Bride's name" : "Groom's name"}</label>
                    <input className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={INPUT_STYLE}
                      placeholder={i === 0 ? "e.g. Priya" : "e.g. Arjun"} value={(form[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <button className="w-full text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40" style={PRIMARY_BTN}
                disabled={!form.name || !form.partnerName} onClick={() => setStep(1)}>Continue →</button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-medium text-gray-800 mb-1">When, what and where?</h2>
                <p className="text-sm text-gray-400">Your wedding date, the events you're planning, and the city. We'll find vendors near you.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Wedding Date</label>
                  <input type="date" min={isoDate(new Date())} className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={INPUT_STYLE}
                    value={form.date ?? ""} onChange={(e) => set("date", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>City</label>
                  <CityDropdown cities={cities} value={form.location ?? ""} onChange={(c) => set("location", c)} />
                </div>
                <RitualPicker selected={rituals} onToggle={toggleRitual} onClear={clearRituals} />
              </div>
              <div className="flex gap-3">
                <button className="flex-1 rounded-xl py-3 font-medium text-sm" style={{ border: "1px solid #f5c6d0", color: "#a8213b" }} onClick={() => setStep(0)}>Back</button>
                <button className="flex-[2] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40" style={PRIMARY_BTN}
                  disabled={!form.date || !form.location || rituals.length === 0} onClick={goToSchedule}>Continue →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-medium text-gray-800 mb-1">Which event on which day?</h2>
                <p className="text-sm text-gray-400">Pick the dates first, then tap the events that happen on each day. Your wedding date is {form.date ? formatDay(form.date) : "not set"}.</p>
              </div>
              <ScheduleBuilder rituals={rituals} days={days} onChange={(d) => setForm((f) => ({ ...f, schedule: d }))} />
              {dayMessage && <div className="text-sm font-medium" style={{ color: "#a8213b" }}>{dayMessage}</div>}
              <div className="flex gap-3">
                <button className="flex-1 rounded-xl py-3 font-medium text-sm" style={{ border: "1px solid #f5c6d0", color: "#a8213b" }} onClick={() => setStep(1)}>Back</button>
                <button className="flex-[2] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40" style={PRIMARY_BTN}
                  disabled={!!dayError} onClick={() => setStep(3)}>Continue →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-medium text-gray-800 mb-1">Budget and guests</h2>
                <p className="text-sm text-gray-400">Our AI will split your budget across your events and categories.</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Expected Guests</label>
                <input type="number" className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={INPUT_STYLE}
                  placeholder="e.g. 300" value={form.guestCount ?? ""} onChange={(e) => set("guestCount", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Total Budget (INR ₹)</label>
                <input type="number" className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={INPUT_STYLE}
                  placeholder="e.g. 2500000" value={form.budget ?? ""} onChange={(e) => set("budget", Number(e.target.value))} />
                <div className="flex flex-wrap gap-2 mt-3">
                  {[["₹5,00,000", 500000], ["₹10,00,000", 1000000], ["₹25,00,000", 2500000], ["₹50,00,000", 5000000]].map(([label, val]) => (
                    <button key={String(label)} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "#fdf2f4", color: "#a8213b", border: "1px solid #f5c6d0" }}
                      onClick={() => set("budget", val as number)}>{label}</button>
                  ))}
                </div>
              </div>
              <CreativeDirectorChoice value={form.creativeDirector} onChange={(v) => setForm((f) => ({ ...f, creativeDirector: v }))} />
              <div className="flex gap-3">
                <button className="flex-1 rounded-xl py-3 font-medium text-sm" style={{ border: "1px solid #f5c6d0", color: "#a8213b" }} onClick={() => setStep(2)}>Back</button>
                <button className="flex-[2] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40 sparkle-btn" style={PRIMARY_BTN}
                  disabled={!form.budget || !form.guestCount || form.creativeDirector === undefined}
                  onClick={() => onComplete({ ...form, schedule: finalizeSchedule(days) } as WeddingPlan)}>Shubh Aarambh ✨</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "budget" | "vendors" | "messages" | "stories" | "blogs";
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overview",  icon: "◈" },
  { id: "budget",    label: "Budget",    icon: "◎" },
  { id: "vendors",   label: "Vendors",   icon: "◉" },
  { id: "messages",  label: "Messages",  icon: "◐" },
];
const INSPIRATION_NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "stories", label: "Success Stories", icon: "❀" },
  { id: "blogs",   label: "Blogs",           icon: "✐" },
];

function Sidebar({ tab, setTab, plan, unreadCount }: { tab: Tab; setTab: (t: Tab) => void; plan: WeddingPlan; unreadCount: number }) {
  const daysLeft = useMemo(() => Math.max(0, Math.ceil((new Date(plan.date).getTime() - Date.now()) / 86400000)), [plan.date]);
  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen sticky top-0" style={{ background: "#fff", borderRight: "1px solid #fbe8ec" }}>
      <div className="px-6 py-5" style={{ borderBottom: "1px solid #fdf2f4" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#a8213b" }}>
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="text-lg font-medium" style={{ color: "#a8213b" }}>Partnered</span>
        </div>
        <div className="text-xs mt-1" style={{ color: "#c08a0c" }}>Indian Wedding Planner</div>
      </div>

      <div className="mx-4 mt-4 rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: "#f5c6d0", color: "#a8213b" }}>{plan.name[0]}</div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: "#fbf0a1", color: "#9a6a0a" }}>{plan.partnerName[0]}</div>
          <span className="text-xs ml-1" style={{ color: "#c08a0c" }}>forever ✦</span>
        </div>
        <div className="text-sm font-medium text-gray-700">{plan.name} & {plan.partnerName}</div>
        <div className="text-xs mt-0.5" style={{ color: "#c08a0c" }}>{plan.location}</div>
        <div className="mt-2 flex items-center gap-1">
          <span className="text-lg font-medium" style={{ color: "#a8213b" }}>{daysLeft}</span>
          <span className="text-xs text-gray-400">days to go</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={tab === n.id ? { background: "linear-gradient(135deg, #a8213b, #881a30)", color: "#fff" } : { color: "#1a1a1a" }}>
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
            {n.id === "messages" && unreadCount > 0 && (
              <span className="ml-auto text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold"
                style={tab === "messages" ? { background: "rgba(255,255,255,0.25)", color: "#fff" } : { background: "#fdf2f4", color: "#a8213b" }}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}

        <div className="pt-4 mt-3 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#a8213b", borderTop: "1px solid #fdf2f4" }}>Inspiration</div>
        {INSPIRATION_NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={tab === n.id ? { background: "linear-gradient(135deg, #a8213b, #881a30)", color: "#fff" } : { color: "#1a1a1a" }}>
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4" style={{ borderTop: "1px solid #fdf2f4" }}>
        <div className="text-xs text-gray-400">{new Date(plan.date).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</div>
        <div className="text-xs mt-0.5" style={{ color: "#c08a0c" }}>{plan.guestCount} guests · {inr(plan.budget)}</div>
      </div>
    </aside>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

// The couple ticks these off themselves. Items tied to a vendor category are handed to the
// Wedding Agent only while they are still open: anything marked done is left alone.
interface CheckItem { id: string; text: string; category?: Category; }
const VENDOR_CHECKS: CheckItem[] = [
  { id: "venue",       text: "Venue booked",                    category: "hotels" },
  { id: "catering",    text: "Catering booked",                 category: "catering" },
  { id: "photography", text: "Photographer booked",             category: "photography" },
  { id: "decoration",  text: "Decor & florals booked",          category: "decoration" },
  { id: "attire",      text: "Bridal & groom attire sorted",    category: "attire" },
  { id: "music",       text: "Music & sangeet booked",          category: "music" },
  { id: "transport",   text: "Baraat transport arranged",       category: "transport" },
  { id: "gifts",       text: "Gifts & shagun planned",          category: "gifts" },
  { id: "logistics",   text: "Wedding-day logistics arranged",  category: "logistics" },
];
const OTHER_CHECKS: CheckItem[] = [
  { id: "invites",   text: "Wedding invitations (shaadi cards) sent" },
  { id: "honeymoon", text: "Honeymoon booked" },
];

function checklistFor(plan: WeddingPlan): CheckItem[] {
  return [
    ...VENDOR_CHECKS,
    ...(plan.creativeDirector ? [{ id: "director", text: "Creative director finalised" }] : []),
    ...OTHER_CHECKS,
  ];
}
// Vendor categories the couple has marked as done: the agent skips these.
function doneCategories(done: Set<string>): Category[] {
  return VENDOR_CHECKS.filter((c) => done.has(c.id)).map((c) => c.category as Category);
}

function DashboardTab({ plan, allocation, bookings, checklistDone, onToggleCheck, agent, setAgent, setAllocation, setTab, onEditPlan, onMessage }: {
  plan: WeddingPlan; allocation: BudgetAllocation; bookings: Booking[]; checklistDone: Set<string>; onToggleCheck: (id: string) => void;
  agent: AgentState; setAgent: (fn: (a: AgentState) => AgentState) => void; setAllocation: (a: BudgetAllocation) => void;
  setTab: (t: Tab) => void; onEditPlan: (p: WeddingPlan) => void; onMessage: (v: VendorRef) => void;
}) {
  const [editing, setEditing] = useState(false);

  const spent = useMemo(() => {
    const r = {} as BudgetAllocation;
    (Object.keys(allocation) as Category[]).forEach((k) => { r[k] = 0; });
    bookings.forEach((b) => { r[b.category] = (r[b.category] ?? 0) + b.amount; });
    return r;
  }, [allocation, bookings]);
  const totalSpent = bookings.reduce((a, b) => a + b.amount, 0);

  const checklist = checklistFor(plan);
  const doneCount = checklist.filter((c) => checklistDone.has(c.id)).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-gray-800">Namaste, {plan.name} <span role="img" aria-label="Namaste">🙏</span></h1>
        <p className="text-sm text-gray-600 mt-1">Here's where your shaadi stands today. Tick off what you've finished, and the agent works on the rest.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Budget",  value: inr(plan.budget),              sub: "set by you",                color: "#a8213b" },
          { label: "Spent So Far",  value: inr(totalSpent),               sub: `${Math.round((totalSpent/plan.budget)*100)}% of budget`, color: "#881a30" },
          { label: "Remaining",     value: inr(plan.budget - totalSpent), sub: "to allocate",               color: "#c08a0c" },
          { label: "Days Left",     value: String(Math.max(0, Math.ceil((new Date(plan.date).getTime() - Date.now()) / 86400000))), sub: "until the big day", color: "#c93a52" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 sm:p-5 min-w-0" style={{ border: "1px solid #fbe8ec" }}>
            <div className="text-xs text-gray-600 mb-1">{s.label}</div>
            <div className="text-lg sm:text-xl font-semibold break-words" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-600 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left: what the couple controls */}
        <div className="xl:col-span-5 space-y-5 sm:space-y-6 min-w-0">
          <div className="bg-white rounded-2xl p-4 sm:p-6" style={{ border: "1px solid #fbe8ec" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium text-gray-700 text-sm">Shaadi Checklist</h3>
              <span className="text-xs text-gray-600">{doneCount} of {checklist.length} done</span>
            </div>
            <p className="text-xs text-gray-600 mb-4">Tick an item when you've finished it. The agent only works on what's still open.</p>
            <div className="space-y-1">
              {checklist.map((c) => {
                const done = checklistDone.has(c.id);
                return (
                  <button key={c.id} onClick={() => onToggleCheck(c.id)} aria-pressed={done}
                    className="flex items-center gap-3 text-left w-full rounded-lg px-2 py-2.5 min-h-11 transition-colors hover:bg-[#fdf2f4]">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={done ? { background: "#a8213b" } : { border: "2px solid #c98a98" }}>
                      {done && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className={`text-sm flex-1 ${done ? "line-through text-gray-500" : "text-gray-800"}`}>{c.text}</span>
                    {c.category && !done && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#fdf2f4", color: "#a8213b" }}>agent</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6" style={{ border: "1px solid #fbe8ec" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-700 text-sm">Budget by Category</h3>
              <button onClick={() => setTab("budget")} className="text-sm px-4 py-2.5 rounded-full" style={{ background: "#fdf2f4", color: "#a8213b" }}>View all →</button>
            </div>
            <div className="space-y-3">
              {(Object.keys(allocation) as Category[]).slice(0, 6).map((k) => (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700">{CATEGORY_META[k].icon} {CATEGORY_META[k].label}</span>
                    <span className="text-xs text-gray-600">{inr(spent[k])} / {inr(allocation[k])}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#fdf2f4" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((spent[k]/allocation[k])*100))}%`, background: `linear-gradient(to right, ${CATEGORY_META[k].color}, #c08a0c)` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6" style={{ border: "1px solid #fbe8ec" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-700 text-sm">Your Events ({plan.rituals.length}) by day</h3>
              <button onClick={() => setEditing(true)} className="text-sm px-4 py-2.5 sm:py-1.5 rounded-full font-medium" style={{ background: "#fdf2f4", color: "#a8213b", border: "1px solid #f5c6d0" }}>
                ✎ Edit events
              </button>
            </div>
            <div className="space-y-4">
              {plan.schedule.map((d, i) => (
                <div key={d.date}>
                  <div className="text-sm font-semibold" style={{ color: "#a8213b" }}>Day {i + 1} · <span className="font-normal text-gray-700">{formatDay(d.date)}</span></div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {d.rituals.map((r) => (
                      <span key={r} className="text-sm px-3 py-1 rounded-full" style={{ background: "#fdf2f4", color: "#a8213b", border: "1px solid #f5c6d0" }}>{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 text-sm text-gray-700" style={{ borderTop: "1px solid #fbe8ec" }}>
              🎨 Creative director: <span className="font-medium">{plan.creativeDirector ? "Yes, we'll help you find one" : "Not needed, you'll manage the look yourself"}</span>
            </div>
          </div>
        </div>

        {/* Right: the agent gets the wide area */}
        <div className="xl:col-span-7 min-w-0">
          <AgentPanel plan={plan} agent={agent} setAgent={setAgent} setAllocation={setAllocation} completed={doneCategories(checklistDone)} onMessage={onMessage} />
        </div>
      </div>

      {editing && (
        <EditEventsModal plan={plan} onClose={() => setEditing(false)} onSave={(p) => { onEditPlan(p); setEditing(false); }} />
      )}
    </div>
  );
}

// ─── Budget Tab ───────────────────────────────────────────────────────────────

const OVER_TIPS: Record<Category, string> = {
  catering:    "Consider a set thali menu instead of live counters — saves 20–30% easily.",
  attire:      "Opt for one designer outfit for the main ceremony; rent for other functions.",
  decoration:  "Use marigold and jasmine in bulk — cheaper and more fragrant than exotic blooms.",
  photography: "Book a local photographer with a strong portfolio over celebrity names.",
  hotels:      "Block fewer rooms and arrange a shuttle from a nearby 3-star property.",
  transport:   "Limit vintage cars to the main baraat; use hired cabs for other transfers.",
  music:       "A live dhol + DJ combo costs far less than a full band.",
  gifts:       "Opt for group gifting sets — bulk orders from Fabindia reduce cost by 40%.",
  logistics:   "Combine multiple vendor deliveries into a single day to cut coordination fees.",
};

const UNDER_TIPS: Record<Category, string> = {
  catering:    "With headroom here, consider adding a live chaat or kebab counter — guests love it.",
  attire:      "You can upgrade to full zardosi embroidery or add a custom blouse design.",
  decoration:  "Add a floral ceiling installation — makes for stunning wedding photos.",
  photography: "Invest in a second shooter for the mehendi or sangeet event.",
  hotels:      "Upgrade to a poolside suite for the couple — a memorable touch.",
  transport:   "Add a vintage horse-drawn buggy for the vidaai moment.",
  music:       "A small classical quartet for the wedding ceremony adds real elegance.",
  gifts:       "Personalised silver coin return gifts create a lasting impression.",
  logistics:   "Hire a dedicated wedding coordinator to manage day-of timelines.",
};

function BudgetTab({ plan, allocation, setAllocation }: {
  plan: WeddingPlan; allocation: BudgetAllocation; setAllocation: (a: BudgetAllocation) => void;
}) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [editVal, setEditVal] = useState("");
  const [certOpen, setCertOpen] = useState(false);
  const [certDone, setCertDone] = useState(false);

  const totalAllocated = Object.values(allocation).reduce((a, b) => a + b, 0);
  const remaining = plan.budget - totalAllocated;
  const overBudget = remaining < 0;
  const underBudget = remaining > plan.budget * 0.05;

  const [lockTotal, setLockTotal] = useState(true);

  // Set one category; with "lock total" on, spread the difference across the others
  // in proportion to their current size so the total stays equal to the budget.
  const updateCategory = (k: Category, raw: number) => {
    const value = Math.min(plan.budget, Math.max(0, Math.round(raw)));
    const next = { ...allocation, [k]: value };
    if (lockTotal) {
      const others = (Object.keys(allocation) as Category[]).filter((c) => c !== k);
      const target = plan.budget - value;
      const othersSum = others.reduce((a, c) => a + allocation[c], 0);
      others.forEach((c) => {
        next[c] = othersSum > 0 ? Math.round((allocation[c] / othersSum) * target) : Math.round(target / others.length);
      });
      // put any rounding leftover on the largest other category
      const drift = target - others.reduce((a, c) => a + next[c], 0);
      const largest = others.reduce((a, c) => (next[c] > next[a] ? c : a), others[0]);
      next[largest] = Math.max(0, next[largest] + drift);
    }
    setAllocation(next);
  };

  const saveEdit = (k: Category) => {
    updateCategory(k, parseInt(editVal) || 0);
    setEditing(null);
  };

  // Categories that are over their ML suggestion
  const mlSuggestion = mlAllocate(plan.budget, plan.guestCount);
  const flags = (Object.keys(allocation) as Category[]).filter((k) => {
    const diff = allocation[k] - mlSuggestion[k];
    return Math.abs(diff) > mlSuggestion[k] * 0.25;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium text-gray-800">Budget Planner</h1>
          <p className="text-sm text-gray-600 mt-1">AI-suggested allocations for {plan.guestCount} guests.</p>
        </div>
        <div className="flex gap-2 flex-wrap [&>button]:py-2.5 [&>button]:text-sm">
          <button onClick={() => setLockTotal(!lockTotal)}
            className="text-xs px-4 py-2 rounded-xl transition-colors"
            style={lockTotal ? { background: "#fdf2f4", color: "#a8213b", border: "1px solid #a8213b" } : { color: "#1a1a1a", border: "1px solid #e5e5e5" }}>
            {lockTotal ? "🔒 Total locked" : "🔓 Total free"}
          </button>
          <button onClick={() => setAllocation(mlAllocate(plan.budget, plan.guestCount))}
            className="text-xs px-4 py-2 rounded-xl transition-colors"
            style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>✦ Reset to AI</button>
          <button onClick={() => setCertOpen(true)}
            className="text-xs px-4 py-2 rounded-xl text-white transition-colors sparkle-btn"
            style={{ background: "linear-gradient(135deg, #c08a0c, #9a6a0a)" }}>
            🏅 Budget Certificate
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-6" style={{ border: "1px solid #fbe8ec" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Total Allocated</span>
          <span className="text-sm font-semibold" style={{ color: overBudget ? "#c93a52" : "#a8213b" }}>
            {inr(totalAllocated)} / {inr(plan.budget)}
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "#fdf2f4" }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${Math.min(110, (totalAllocated / plan.budget) * 100)}%`,
            background: overBudget ? "linear-gradient(to right, #c93a52, #a8213b)" : "linear-gradient(to right, #a8213b, #c08a0c)"
          }} />
        </div>
        <div className={`mt-2 text-xs font-medium ${overBudget ? "text-red-500" : underBudget ? "text-amber-600" : "text-gray-400"}`}>
          {overBudget ? `⚠ ${inr(Math.abs(remaining))} over budget` : underBudget ? `✦ ${inr(remaining)} still unallocated` : `✓ Budget fully allocated`}
        </div>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          {(Object.keys(allocation) as Category[]).map((k) => (
            <div key={k} className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_META[k].color }} />
              <span className="text-xs text-gray-700 truncate">{CATEGORY_META[k].label}</span>
              <span className="text-xs text-gray-600 ml-auto">{Math.round((allocation[k] / plan.budget) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Smart recommendations banner */}
      {(overBudget || underBudget || flags.length > 0) && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: overBudget ? "#fff5f5" : "#fffdf0", border: `1px solid ${overBudget ? "#f5c6d0" : "#fbf0a1"}` }}>
          <div className="flex items-center gap-2">
            <span className="text-base">{overBudget ? "⚠️" : "💡"}</span>
            <span className="text-sm font-semibold" style={{ color: overBudget ? "#a8213b" : "#9a6a0a" }}>
              {overBudget ? "Over-budget recommendations" : "Smart savings & upgrade ideas"}
            </span>
          </div>
          <div className="space-y-2">
            {flags.slice(0, 3).map((k) => {
              const isOver = allocation[k] > mlSuggestion[k];
              const tip = isOver ? OVER_TIPS[k] : UNDER_TIPS[k];
              return (
                <div key={k} className="flex items-start gap-2">
                  <span className="text-xs mt-0.5" style={{ color: isOver ? "#c93a52" : "#9a6a0a" }}>{isOver ? "↑" : "↓"}</span>
                  <div>
                    <span className="text-xs font-medium text-gray-700">{CATEGORY_META[k].icon} {CATEGORY_META[k].label}: </span>
                    <span className="text-xs text-gray-500">{tip}</span>
                  </div>
                </div>
              );
            })}
            {overBudget && (
              <div className="flex items-start gap-2 pt-1">
                <span className="text-xs mt-0.5 text-gray-400">→</span>
                <span className="text-xs text-gray-500">Overall tip: Consider splitting functions — Mehendi + Haldi at home reduces venue costs by up to ₹2–3 lakhs.</span>
              </div>
            )}
            {underBudget && !overBudget && (
              <div className="flex items-start gap-2 pt-1">
                <span className="text-xs mt-0.5 text-gray-400">→</span>
                <span className="text-xs text-gray-500">You have room to add a professional wedding MC/anchor — they elevate the entire reception experience.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Object.keys(allocation) as Category[]).map((k) => {
          const isOver = allocation[k] > mlSuggestion[k] * 1.3;
          const isUnder = allocation[k] < mlSuggestion[k] * 0.7;
          return (
            <div key={k} className="bg-white rounded-2xl p-4 group transition-all hover:shadow-sm relative"
              style={{ border: `1px solid ${isOver ? "#f5c6d0" : isUnder ? "#fbf0a1" : "#fbe8ec"}` }}>
              {isOver && <div className="absolute top-3 right-3 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#fdf2f4", color: "#c93a52" }}>↑ High</div>}
              {isUnder && <div className="absolute top-3 right-3 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#fffdf0", color: "#9a6a0a" }}>↓ Low</div>}
              <div className="flex items-center gap-2 mb-3 pr-10">
                <span className="text-xl">{CATEGORY_META[k].icon}</span>
                <span className="text-xs font-medium text-gray-600">{CATEGORY_META[k].label}</span>
              </div>
              {editing === k ? (
                <div className="flex gap-2">
                  <input autoFocus type="number" value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(k)}
                    className="flex-1 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                    style={{ border: "1px solid #f5c6d0" }} />
                  <button onClick={() => saveEdit(k)} className="text-xs text-white px-3 rounded-lg" style={{ background: "#a8213b" }}>✓</button>
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-400 px-2">✕</button>
                </div>
              ) : (
                <div className="flex items-end justify-between">
                  <div className="text-xl font-semibold" style={{ color: "#a8213b" }}>{inr(allocation[k])}</div>
                  <button onClick={() => { setEditing(k); setEditVal(String(allocation[k])); }}
                    className="text-sm underline px-3 py-3 -mr-3 -my-2"
                    style={{ color: "#a8213b" }}>edit</button>
                </div>
              )}
              <input type="range" min={0} max={plan.budget} step={5000} value={allocation[k]}
                onChange={(e) => updateCategory(k, Number(e.target.value))}
                aria-label={`${CATEGORY_META[k].label} budget`}
                className="budget-slider mt-3 w-full cursor-pointer"
                style={{ "--c": CATEGORY_META[k].color, "--p": `${(allocation[k] / plan.budget) * 100}%` } as React.CSSProperties} />
              <div className="text-xs text-gray-600 mt-1">
                {Math.round((allocation[k] / plan.budget) * 100)}% · AI suggests {inr(mlSuggestion[k])}
              </div>
            </div>
          );
        })}
      </div>

      {/* ML explanation */}
      <div className="rounded-2xl p-5 flex gap-4 items-start" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: "#f5c6d0" }}>✦</div>
        <div>
          <div className="text-sm font-medium mb-1" style={{ color: "#a8213b" }}>How our AI allocates your budget</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            We analysed thousands of Indian weddings with {plan.guestCount} guests. Catering takes {Math.round((allocation.catering / plan.budget) * 100)}% — hospitality is the heart of an Indian wedding. Allocations shift automatically for destination weddings, large baraats, and intimate gatherings. Edit any category; the indicator flags when you deviate significantly from our recommendation.
          </p>
        </div>
      </div>

      {/* Certificate slide-up panel */}
      {certOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setCertOpen(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-5 sm:p-8 space-y-5 max-h-[92dvh] overflow-y-auto" style={{ background: "#fff", borderTop: "3px solid #c08a0c", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-medium text-gray-800">Budget Certificate</h3>
                <p className="text-xs text-gray-400 mt-0.5">Your shaadi financial snapshot</p>
              </div>
              <button onClick={() => setCertOpen(false)} className="text-gray-300 hover:text-gray-500 text-xl">✕</button>
            </div>

            {/* Certificate body */}
            <div className="rounded-2xl p-6 text-center" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "2px solid #c08a0c" }}>
              <div className="text-3xl mb-2">🏅</div>
              <div className="text-lg font-medium mb-1" style={{ color: "#a8213b" }}>Shaadi Budget Plan</div>
              <div className="text-sm text-gray-500 mb-4">{plan.name} & {plan.partnerName} · {new Date(plan.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
              <div className="grid grid-cols-2 gap-3 text-left mb-4">
                <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #f5c6d0" }}>
                  <div className="text-xs text-gray-400">Total Budget</div>
                  <div className="font-semibold text-sm" style={{ color: "#a8213b" }}>{inr(plan.budget)}</div>
                </div>
                <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #f5c6d0" }}>
                  <div className="text-xs text-gray-400">Guests</div>
                  <div className="font-semibold text-sm" style={{ color: "#a8213b" }}>{plan.guestCount} people</div>
                </div>
                <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #f5c6d0" }}>
                  <div className="text-xs text-gray-400">Per-Guest Budget</div>
                  <div className="font-semibold text-sm" style={{ color: "#a8213b" }}>{inr(Math.round(plan.budget / plan.guestCount))}</div>
                </div>
                <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #f5c6d0" }}>
                  <div className="text-xs text-gray-400">Largest Category</div>
                  <div className="font-semibold text-sm" style={{ color: "#a8213b" }}>Catering ({Math.round((allocation.catering / plan.budget) * 100)}%)</div>
                </div>
              </div>
              <div className="text-xs text-gray-400">{overBudget ? "⚠ Allocation exceeds total budget — review categories." : "✓ Budget is balanced and AI-optimised."}</div>
            </div>

            <button
              onClick={() => { setCertDone(true); setTimeout(() => { setCertOpen(false); setCertDone(false); }, 1500); }}
              className="w-full text-white rounded-xl py-3 font-medium text-sm transition-all"
              style={{ background: certDone ? "#c08a0c" : "linear-gradient(135deg, #a8213b, #881a30)" }}>
              {certDone ? "✓ Certificate Saved!" : "Download Certificate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vendors Tab ──────────────────────────────────────────────────────────────

// Five stars, filled in proportion to the rating (e.g. 4.6 shows four and a bit).
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: "1.05em", color: "#d9cfae", WebkitTextFillColor: "#d9cfae", background: "none" }}>
            ★
            <span className="absolute left-0 top-0 overflow-hidden whitespace-nowrap" style={{ width: `${fill * 100}%`, color: "#d9a60f", WebkitTextFillColor: "#d9a60f", background: "none", animation: "none" }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

function ScoreBar({ label, value, shown }: { label: string; value: number; shown: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-800">{shown}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f3e4e8" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: "linear-gradient(to right, #a8213b, #d9a60f)" }} />
      </div>
    </div>
  );
}

function CitySelect({ cities, value, onChange }: { cities: CityInfo[]; value: string; onChange: (c: string) => void }) {
  const groups: [string, CityInfo["kind"]][] = [["Metros", "metro"], ["Other major cities", "city"], ["Destination wedding cities", "destination"]];
  return (
    <label className="flex w-full sm:w-auto items-center gap-2 rounded-xl px-4 py-3 sm:py-2.5 bg-white" style={{ border: "1px solid #f5c6d0" }}>
      <span className="text-sm font-semibold shrink-0" style={{ color: "#a8213b" }}>📍 City</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Choose a city"
        className="flex-1 min-w-0 text-sm font-medium bg-transparent focus:outline-none cursor-pointer py-3 -my-3" style={{ color: "#1a1a1a" }}>
        {groups.map(([title, kind]) => (
          <optgroup key={kind} label={title}>
            {cities.filter((c) => c.kind === kind).map((c) => <option key={c.name} value={c.name}>{c.name} · {c.state}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

// Shown instead of a photo for real listings: we have no picture of their business, so we don't use a stock one.
function RealListingTile({ category, className = "" }: { category: Category; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`} style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)" }}>
      <div className="text-4xl" aria-hidden="true">{CATEGORY_META[category].icon}</div>
      <div className="text-xs mt-1 text-gray-700">Real listing · no photo yet</div>
    </div>
  );
}

const OSM_CREDIT = "Real listings © OpenStreetMap contributors (ODbL)";

function VendorDetail({ vendor, plan, saved, booked, onToggleSave, onToggleBook, onBack, onMessage }: {
  vendor: MarketVendor; plan: WeddingPlan; saved: boolean; booked: boolean; onToggleSave: () => void;
  onToggleBook: (v: VendorRef, amount: number) => void; onBack: () => void; onMessage: (v: VendorRef) => void;
}) {
  const real = vendor.source === "osm";
  const days = Math.max(1, plan.schedule.length);
  const round = (n: number) => Math.round(n / 5000) * 5000;
  const low = round(vendor.estCost * 0.9), high = round(vendor.estCost * 1.1);
  const meta = CATEGORY_META[vendor.category];
  const notListed = <span className="text-gray-600 font-normal">Not listed</span>;
  const rows: [string, React.ReactNode][] = [
    ["📍 Location", `${vendor.area ? vendor.area + ", " : ""}${vendor.city} · about ${vendor.distanceKm} km from the centre`],
    ["📞 Phone", vendor.phone ?? notListed],
    ["✉️ Email", vendor.email ?? notListed],
    ["🌐 Website", vendor.website ? <a href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noreferrer" className="underline" style={{ color: "#a8213b" }}>{vendor.website}</a> : notListed],
    ["🕒 Hours", vendor.hours ?? notListed],
    ...(vendor.capacity ? [["👥 Capacity", `Up to ${vendor.capacity} guests`] as [string, React.ReactNode]] : []),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl space-y-5 sm:space-y-6 relative" style={{ zIndex: 10 }}>
      <button onClick={onBack} className="text-base font-medium py-2" style={{ color: "#a8213b" }}>← Back to vendors</button>

      <div className="bg-white rounded-3xl overflow-hidden" style={{ border: "1px solid #fbe8ec" }}>
        <div className="relative">
          {vendor.image
            ? <img src={`https://images.unsplash.com/${vendor.image}?w=1000&h=320&fit=crop&auto=format`} alt={vendor.name} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                className="w-full h-44 sm:h-60 object-cover" style={{ background: "#fdf2f4" }} />
            : <RealListingTile category={vendor.category} className="w-full h-44 sm:h-60" />}
          <div className="absolute top-4 left-4 text-sm font-medium px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.93)", color: "#a8213b" }}>{real ? "📍 Real listing" : vendor.tag}</div>
          <button onClick={onToggleSave} aria-label={saved ? "Remove from saved" : "Save vendor"}
            className="absolute top-4 right-4 w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-lg"
            style={saved ? { background: "#a8213b", color: "#fff" } : { background: "rgba(255,255,255,0.9)", color: "#333" }}>
            {saved ? "♥" : "♡"}
          </button>
        </div>

        <div className="p-5 sm:p-8 space-y-6 sm:space-y-7">
          <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-medium text-gray-800">{vendor.name}</h1>
              <div className="text-sm text-gray-600 mt-1">{meta.icon} {meta.label} · {vendor.area ? `${vendor.area}, ` : ""}{vendor.city}</div>
              {vendor.rating !== null
                ? <div className="flex items-center gap-2 mt-2 text-lg"><Stars rating={vendor.rating} /><span className="text-sm font-semibold text-gray-800">{vendor.rating.toFixed(1)}</span></div>
                : <div className="mt-2 text-sm font-medium text-gray-700">Not rated yet</div>}
            </div>
            <div className="sm:text-right shrink-0">
              {vendor.partnerScore !== null ? (
                <>
                  <div className="text-xs uppercase tracking-wider text-gray-600">Partner score</div>
                  <div className="text-3xl sm:text-4xl font-semibold" style={{ color: "#a8213b" }}>{vendor.partnerScore}<span className="text-lg text-gray-600">/100</span></div>
                  <div className="text-sm font-semibold" style={{ color: "#c08a0c" }}>{vendor.priceBand}</div>
                </>
              ) : <div className="text-sm text-gray-700">No Partner score yet</div>}
            </div>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed">{vendor.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            <div className="rounded-2xl p-4 sm:p-5 space-y-4" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#a8213b" }}>Scorecard</h3>
              {vendor.rating !== null && vendor.reliability !== null && vendor.responseHours !== null && vendor.premiumLook !== null ? (
                <>
                  <ScoreBar label="Customer rating" value={(vendor.rating / 5) * 100} shown={`${vendor.rating.toFixed(1)} / 5`} />
                  <ScoreBar label="Reliability" value={vendor.reliability} shown={`${vendor.reliability}%`} />
                  <ScoreBar label="Replies within" value={100 - Math.min(24, vendor.responseHours) / 24 * 100} shown={`~${vendor.responseHours} h`} />
                  <ScoreBar label="Premium look" value={vendor.premiumLook} shown={`${vendor.premiumLook}%`} />
                  <p className="text-xs text-gray-600">Partner score combines rating, reliability, response time and premium look.</p>
                </>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">
                  No ratings yet. This is a real business from OpenStreetMap, so we hold no reviews, reliability or response-time data for it. Its scorecard will build up as couples message and book through Partnered.
                </p>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl p-4 sm:p-5 space-y-3" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#a8213b" }}>Contact & location</h3>
                {rows.map(([label, value]) => (
                  <div key={label} className="flex flex-col min-[420px]:flex-row gap-0.5 min-[420px]:gap-3">
                    <span className="text-sm text-gray-600 min-[420px]:w-28 shrink-0">{label}</span>
                    <span className="text-sm text-gray-800 font-medium" style={{ overflowWrap: "anywhere" }}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl p-4 sm:p-5" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "2px solid #c08a0c" }}>
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#a8213b" }}>{real ? "Typical price range" : `${days}-day event ballpark`}</h3>
                <div className="text-2xl font-semibold mt-2" style={{ color: "#a8213b" }}>{inr(low)} – {inr(high)}</div>
                <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                  {real ? "This vendor hasn't published prices. This is a typical range for the category, not a quote: message them to ask. " : ""}
                  {vendor.category === "catering" ? `Based on ${plan.guestCount} guests over ${days} day${days > 1 ? "s" : ""}. ` : ""}
                  {real ? "" : "An estimate; the final quote depends on your guest list and requirements."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-wrap [&>button]:w-full sm:[&>button]:w-auto">
            <button onClick={() => onMessage(vendor)}
              className="text-white rounded-xl px-8 py-3.5 sm:py-3 font-medium text-sm sparkle-btn"
              style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}>
              💬 Message vendor
            </button>
            <button onClick={() => onToggleBook(vendor, vendor.estCost)} className="rounded-xl px-6 py-3.5 sm:py-3 font-medium text-sm"
              style={booked ? { background: "#f3faf0", color: "#2f6b1f", border: "1px solid #9bd08a" } : { color: "#a8213b", border: "1px solid #a8213b" }}>
              {booked ? `✓ Booked · ${inr(vendor.estCost)} (undo)` : "Mark as booked"}
            </button>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            {real ? (
              <p>
                {OSM_CREDIT}.{vendor.osmUrl && <> <a href={vendor.osmUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: "#a8213b" }}>View on OpenStreetMap</a>.</>}
                {" "}"Mark as booked" records the typical estimate, not a quote; real payment will go through Pine Labs.
              </p>
            ) : (
              <p>Sample vendor: fictional, with placeholder contact details. "Mark as booked" records the estimate; real payment will go through Pine Labs.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type VendorSort = "score" | "rating" | "price" | "distance";

function VendorsTab({ plan, cities, city, setCity, bookings, onToggleBook, onMessage }: {
  plan: WeddingPlan; cities: CityInfo[]; city: string; setCity: (c: string) => void;
  bookings: Booking[]; onToggleBook: (v: VendorRef, amount: number) => void; onMessage: (v: VendorRef) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<VendorSort>("score");
  const [source, setSource] = useState<"all" | "osm" | "sample">("all");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<MarketVendor | null>(null);
  const [vendors, setVendors] = useState<MarketVendor[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const days = Math.max(1, plan.schedule.length);

  // Vendors come from the backend, one city at a time.
  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    setStatus("loading"); setSelected(null);
    fetch(`${API_BASE}/api/vendors?city=${encodeURIComponent(city)}&guests=${plan.guestCount}&days=${days}`)
      .then(async (r) => { if (!r.ok) throw new Error(`The vendor service returned an error (${r.status}).`); return r.json(); })
      .then((d) => { if (!cancelled) { setVendors(d.vendors); setStatus("ready"); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof TypeError ? "Could not reach the vendor service. Check that the backend is running." : (e as Error).message); setStatus("error"); } });
    return () => { cancelled = true; };
  }, [city, plan.guestCount, days]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = vendors.filter((v) =>
      (activeCategory === "all" || v.category === activeCategory) &&
      (source === "all" || v.source === source) &&
      (!q || v.name.toLowerCase().includes(q) || v.area.toLowerCase().includes(q)));
    // Real listings have no rating or score, so they sort first and in the backend order; sample vendors follow by score.
    const by: Record<VendorSort, (a: MarketVendor, b: MarketVendor) => number> = {
      score: (a, b) => (a.source === b.source ? (b.partnerScore ?? 0) - (a.partnerScore ?? 0) : a.source === "osm" ? -1 : 1),
      rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
      price: (a, b) => a.estCost - b.estCost,
      distance: (a, b) => a.distanceKm - b.distanceKm,
    };
    return [...rows].sort(by[sort]);
  }, [vendors, activeCategory, source, search, sort]);
  const realCount = vendors.filter((v) => v.source === "osm").length;

  const toggle = (id: string) => setSaved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (selected) {
    return <VendorDetail vendor={selected} plan={plan} saved={saved.has(selected.id)} booked={bookings.some((b) => b.vendorId === selected.id)}
      onToggleSave={() => toggle(selected.id)} onToggleBook={onToggleBook} onBack={() => setSelected(null)} onMessage={onMessage} />;
  }

  const cityKnown = cities.some((c) => c.name.toLowerCase() === plan.location.trim().toLowerCase());

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl space-y-5 sm:space-y-6">
      <div className="flex items-end justify-between gap-3 sm:gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-medium text-gray-800">Vendor Marketplace</h1>
          <p className="text-sm text-gray-600 mt-1">Browse wedding vendors city by city, compare scorecards, and message them directly.</p>
        </div>
        {cities.length > 0 && <CitySelect cities={cities} value={city} onChange={setCity} />}
      </div>

      {cities.length > 0 && !cityKnown && (
        <div className="rounded-xl p-3 text-sm text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
          We don't have vendors for "{plan.location}" yet, so you're seeing {city}. Pick any city above.
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[14rem]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">⌕</span>
          <input className="w-full pl-8 pr-4 py-3 sm:py-2.5 bg-white rounded-xl text-sm focus:outline-none" style={{ border: "1px solid #fbe8ec" }}
            placeholder={`Search vendors or areas in ${city || "your city"}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as VendorSort)} className="rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none" style={{ border: "1px solid #fbe8ec" }}>
            <option value="score">Best match</option>
            <option value="rating">Rating</option>
            <option value="price">Price: low to high</option>
            <option value="distance">Distance</option>
          </select>
        </label>
      </div>

      {/* One swipeable row on phones instead of a tall stack of wrapped chips */}
      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
        <button onClick={() => setActiveCategory("all")} className="px-4 py-2 sm:py-1.5 rounded-full text-sm font-medium transition-all"
          style={activeCategory === "all" ? { background: "#a8213b", color: "#fff" } : { background: "#fff", color: "#1a1a1a", border: "1px solid #fbe8ec" }}>All</button>
        {(Object.keys(CATEGORY_META) as Category[]).map((k) => (
          <button key={k} onClick={() => setActiveCategory(k)} className="px-4 py-2 sm:py-1.5 rounded-full text-sm font-medium transition-all"
            style={activeCategory === k ? { background: "#a8213b", color: "#fff" } : { background: "#fff", color: "#1a1a1a", border: "1px solid #fbe8ec" }}>
            {CATEGORY_META[k].icon} {CATEGORY_META[k].label}
          </button>
        ))}
      </div>

      {status === "ready" && (
        <div className="flex gap-2 overflow-x-auto sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
          {([["all", `All (${vendors.length})`], ["osm", `📍 Real listings (${realCount})`], ["sample", `Sample vendors (${vendors.length - realCount})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSource(k)} className="px-4 py-2 sm:py-1.5 rounded-full text-sm font-medium"
              style={source === k ? { background: "#1a1a1a", color: "#fff" } : { background: "#fff", color: "#1a1a1a", border: "1px solid #ddd" }}>{label}</button>
          ))}
        </div>
      )}
      {status === "ready" && realCount === 0 && (
        <div className="rounded-xl p-3 text-sm text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
          No real listings have been imported for {city} yet, so you are seeing sample vendors only.
        </div>
      )}

      {status === "loading" && <div className="text-sm text-gray-700 py-10 text-center">Loading vendors…</div>}
      {status === "error" && <div className="text-sm font-medium py-10 text-center" style={{ color: "#a8213b" }}>{error}</div>}

      {status === "ready" && (
        <>
          <div className="text-sm text-gray-700">{filtered.length} of {vendors.length} vendors in {city}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl overflow-hidden group transition-all hover:shadow-md" style={{ border: "1px solid #fbe8ec" }}>
                <div className="relative">
                  {v.image
                    ? <img src={`https://images.unsplash.com/${v.image}?w=400&h=200&fit=crop&auto=format`} alt={v.name} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                        className="w-full h-36 object-cover" style={{ background: "#fdf2f4" }} />
                    : <RealListingTile category={v.category} className="w-full h-36" />}
                  <div className="absolute top-2 left-2 text-xs font-medium px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.92)", color: "#a8213b" }}>{v.source === "osm" ? "📍 Real listing" : v.tag}</div>
                  <button onClick={() => toggle(v.id)} aria-label={saved.has(v.id) ? "Remove from saved" : "Save vendor"}
                    className="absolute top-2 right-2 w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-lg transition-all"
                    style={saved.has(v.id) ? { background: "#a8213b", color: "#fff" } : { background: "rgba(255,255,255,0.85)", color: "#333" }}>
                    {saved.has(v.id) ? "♥" : "♡"}
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 text-sm">{v.name}</div>
                      <div className="text-xs text-gray-700 mt-0.5">{CATEGORY_META[v.category].icon} {CATEGORY_META[v.category].label}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{v.area ? `${v.area} · ` : ""}{v.distanceKm} km from centre</div>
                    </div>
                    <div className="text-right shrink-0">
                      {v.priceBand && <div className="text-xs font-semibold" style={{ color: "#c08a0c" }}>{v.priceBand}</div>}
                      <div className="text-xs text-gray-700">{v.estCostTypical ? "typical " : ""}~{inr(v.estCost)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {v.rating !== null
                      ? <div className="flex items-center gap-1.5"><Stars rating={v.rating} /><span className="text-xs text-gray-800 font-medium">{v.rating.toFixed(1)}</span></div>
                      : <span className="text-xs text-gray-700">Not rated yet</span>}
                    {v.partnerScore !== null
                      ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fdf2f4", color: "#a8213b" }} title="Partner score">{v.partnerScore}/100</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f1f1f1", color: "#333" }} title="No ratings exist yet for real listings">{v.phone ? "📞 phone listed" : "ask for quote"}</span>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setSelected(v)} className="flex-1 text-sm rounded-xl py-2.5 transition-colors" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>View & Contact</button>
                    <button onClick={() => onMessage(v)} aria-label={`Message ${v.name}`} className="text-sm rounded-xl px-4 py-2.5 text-white" style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}>💬</button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="col-span-full text-center py-16 text-gray-700 text-sm">No vendors match. Try another category or search.</div>}
          </div>
          <p className="text-xs text-gray-600">
            {realCount > 0 && <>{OSM_CREDIT}: they have no ratings or published prices yet. </>}
            Sample vendors are fictional. All prices are estimates for {plan.guestCount} guests over {days} day{days > 1 ? "s" : ""}, not quotes.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

function MessagesTab({ plan, threads, setThreads, activeId, setActiveId, onNavigate }: {
  plan: WeddingPlan; threads: Thread[]; setThreads: (t: Thread[]) => void; activeId: string; setActiveId: (id: string) => void;
  onNavigate: (t: Tab) => void;
}) {
  const [draft, setDraft] = useState("");
  // On phones only one pane shows at a time: the conversation list, or the open chat.
  const [view, setView] = useState<"list" | "chat">(activeId ? "chat" : "list");
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, active?.messages.length]);

  // Opening a chat from a vendor suggestion brings a drafted enquiry along for the couple to review.
  useEffect(() => {
    setDraft(active?.draft ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const send = () => {
    if (!active || !draft.trim()) return;
    const msg: ChatMessage = { id: String(Date.now()), from: "me", text: draft.trim(), time: now() };
    setThreads(threads.map((t) => t.id === active.id ? { ...t, messages: [...t.messages, msg], lastTime: "Just now", unread: false, draft: undefined } : t));
    setDraft("");
  };

  if (!active) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-5 sm:space-y-6">
        <div>
          <h1 className="text-3xl font-medium text-gray-800">Messages</h1>
          <p className="text-sm text-gray-600 mt-1">Your conversations with vendors live here.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 sm:p-12 text-center" style={{ border: "1px solid #fbe8ec" }}>
          <div className="text-4xl mb-3" aria-hidden="true">💬</div>
          <div className="text-xl font-medium text-gray-800">No conversations yet</div>
          <p className="text-sm text-gray-700 mt-2 max-w-md mx-auto">Message a vendor from the agent's suggestions on the Overview page, or browse the marketplace. A short enquiry is drafted for you to review before sending.</p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => onNavigate("dashboard")} className="rounded-xl px-5 py-2.5 text-sm font-medium text-white" style={PRIMARY_BTN}>See the agent's suggestions</button>
            <button onClick={() => onNavigate("vendors")} className="rounded-xl px-5 py-2.5 text-sm font-medium" style={{ color: "#a8213b", border: "1px solid #a8213b" }}>Browse vendors</button>
          </div>
        </div>
      </div>
    );
  }

  const selectThread = (id: string) => {
    setActiveId(id);
    setThreads(threads.map((t) => t.id === id ? { ...t, unread: false } : t));
    setView("chat");
  };

  const quickReplies = ["Confirmed! ✓", "Can we reschedule?", "Please send the invoice", "What's the advance amount?", "Thank you 🙏"];

  return (
    <div className="flex overflow-hidden h-full">
      {/* Thread list: its own screen on phones, a side column from tablet width up */}
      <div className={`${view === "list" ? "flex" : "hidden"} md:flex flex-col w-full md:w-72 md:shrink-0 overflow-y-auto bg-white`} style={{ borderRight: "1px solid #fbe8ec" }}>
        <div className="p-4 sm:p-5 sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid #fdf2f4" }}>
          <h2 className="text-xl font-medium text-gray-800">Messages</h2>
          <p className="text-sm text-gray-600 mt-0.5">Vendors & stakeholders</p>
        </div>
        {threads.map((t) => (
          <button key={t.id} onClick={() => selectThread(t.id)}
            className="w-full text-left p-4 transition-colors"
            style={{ background: active.id === t.id ? "#fdf2f4" : "transparent", borderBottom: "1px solid #fdf8f0" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-medium shrink-0"
                style={t.unread ? { background: "#a8213b", color: "#fff" } : { background: "#fdf2f4", color: "#a8213b" }}>
                {t.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold truncate ${t.unread ? "text-gray-800" : "text-gray-700"}`}>{t.sender}</span>
                  <span className="text-xs text-gray-600 shrink-0 ml-1">{t.lastTime}</span>
                </div>
                <div className="text-xs text-gray-600 truncate mt-0.5">{t.role.split("·")[0].trim()}</div>
                <div className={`text-sm truncate mt-0.5 ${t.unread ? "text-gray-800 font-medium" : "text-gray-700"}`}>
                  {t.messages[t.messages.length - 1]?.text ?? (t.draft ? "Draft enquiry ready to review" : "No messages yet")}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Chat pane */}
      <div className={`${view === "chat" ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col overflow-hidden`} style={{ background: "#fdf8f0" }}>
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white flex items-center gap-3 sm:gap-4 shrink-0" style={{ borderBottom: "1px solid #fbe8ec" }}>
          <button onClick={() => setView("list")} aria-label="Back to conversations" className="md:hidden text-2xl leading-none px-2 py-1" style={{ color: "#a8213b" }}>‹</button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-medium shrink-0" style={{ background: "#fdf2f4", color: "#a8213b" }}>
            {active.avatar}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-800 text-base truncate">{active.sender}</div>
            <div className="text-xs text-gray-600 truncate">{active.role}</div>
          </div>
          <div className="ml-auto hidden xl:flex gap-2">
            {["📅 Schedule Call", "📄 View Contract", "📎 Share File"].map((l) => (
              <span key={l} className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors select-none"
                style={{ background: "#fdf2f4", color: "#a8213b" }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 min-h-0">
          {/* Date stamp */}
          <div className="text-center">
            <span className="text-xs text-gray-600 bg-white px-3 py-1 rounded-full" style={{ border: "1px solid #fbe8ec" }}>Today</span>
          </div>

          {active.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
              {msg.from === "vendor" && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mr-2 mt-1 shrink-0"
                  style={{ background: "#fdf2f4", color: "#a8213b" }}>{active.avatar}</div>
              )}
              <div className="max-w-[85%] sm:max-w-md">
                <div className={`text-sm rounded-2xl px-4 py-3 leading-relaxed ${msg.from === "me" ? "rounded-tr-sm text-white" : "rounded-tl-sm text-gray-800 bg-white"}`}
                  style={msg.from === "me" ? { background: "linear-gradient(135deg, #a8213b, #881a30)" } : { border: "1px solid #fbe8ec" }}>
                  {msg.text}
                </div>
                <div className={`text-xs text-gray-600 mt-1 ${msg.from === "me" ? "text-right" : "text-left"}`}>{msg.time}</div>
              </div>
              {msg.from === "me" && (
                <div className="w-7 h-7 rounded-full items-center justify-center text-xs font-medium ml-2 mt-1 shrink-0 hidden sm:flex"
                  style={{ background: "#fbf0a1", color: "#9a6a0a" }}>{plan.name[0]}</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies: one swipeable row on phones */}
        <div className="px-3 sm:px-6 pt-2 flex gap-2 overflow-x-auto sm:flex-wrap bg-white [&>button]:shrink-0 [&>button]:whitespace-nowrap" style={{ borderTop: "1px solid #fbe8ec" }}>
          {quickReplies.map((q) => (
            <button key={q} onClick={() => setDraft(q)} className="text-sm px-3 py-2 sm:py-1.5 rounded-full transition-colors"
              style={{ color: "#a8213b", background: "#fdf2f4", border: "1px solid #f5c6d0" }}>{q}</button>
          ))}
        </div>

        {/* Compose */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white flex items-end gap-2 sm:gap-3 shrink-0">
          <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${active.sender.split(" ")[0]}…`}
            className="flex-1 min-w-0 rounded-xl px-4 py-3 text-base resize-none focus:outline-none max-h-40"
            style={{ border: "1px solid #fbe8ec", background: "#fdf8f0" }} />
          <button onClick={send} aria-label="Send" className="text-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg"
            style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Tab ────────────────────────────────────────────────────────────────

interface AgentEvent { step: number; title: string; detail: string; status: "done" | "warn" | "skipped" | "info"; }
interface AgentPick {
  id: string; name: string; area: string; category: Category; tier: number; rating: number;
  estCost: number; fit: "within" | "stretch" | "over"; score: number; reasons: string[];
  source: "osm" | "sample"; rated: boolean; phone: string | null;
}
interface AgentResult {
  events: AgentEvent[];
  envelope: { total: number; reserve: number; allocatable: number; perGuest: number; level: string; message: string };
  allocation: BudgetAllocation;
  shortlists: Partial<Record<Category, AgentPick[]>>;
  summary: string;
  usedLlm: boolean;
  totals?: { sumOfTopPicks: number; allocatable: number };
}
interface AgentState { objective: string; result: AgentResult | null; applied: boolean; }

function defaultObjective(plan: WeddingPlan) {
  const when = new Date(plan.date).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return `I have ${inr(plan.budget)}. ${plan.guestCount} guests. ${plan.location}. Wedding in ${when}. I want a premium-looking wedding but don't want to exceed my budget.`;
}

const STATUS_STYLE: Record<AgentEvent["status"], { icon: string; color: string; bg: string }> = {
  done:    { icon: "✓", color: "#2f6b1f", bg: "#f3faf0" },
  warn:    { icon: "!", color: "#a8213b", bg: "#fdf2f4" },
  skipped: { icon: "–", color: "#444444", bg: "#f1f1f1" },
  info:    { icon: "i", color: "#7a5206", bg: "#fffdf0" },
};
const FIT_STYLE: Record<AgentPick["fit"], { label: string; color: string; bg: string }> = {
  within:  { label: "Within allocation", color: "#2f6b1f", bg: "#f3faf0" },
  stretch: { label: "Stretch",           color: "#7a5206", bg: "#fffdf0" },
  over:    { label: "Over allocation",   color: "#a8213b", bg: "#fdf2f4" },
};

function AgentPanel({ plan, agent, setAgent, setAllocation, completed, onMessage }: {
  plan: WeddingPlan; agent: AgentState; setAgent: (fn: (a: AgentState) => AgentState) => void; setAllocation: (a: BudgetAllocation) => void;
  completed: Category[]; // categories the couple already marked done on the checklist
  onMessage: (v: VendorRef) => void; // opens a chat with a vendor the agent suggested
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState("");
  const [shown, setShown] = useState(agent.result?.events.length ?? 0);
  const result = agent.result;

  // Reveal the agent's steps one by one so the couple can follow what it is doing.
  useEffect(() => {
    if (!result || shown >= result.events.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 450);
    return () => clearTimeout(t);
  }, [result, shown]);
  const finished = !!result && shown >= result.events.length;

  const run = async () => {
    setPhase("running"); setError(""); setShown(0);
    setAgent((a) => ({ ...a, result: null, applied: false }));
    try {
      const res = await fetch(`${API_BASE}/api/agent/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, objective: agent.objective, completed }),
      });
      if (!res.ok) throw new Error(`The agent returned an error (${res.status}).`);
      const data: AgentResult = await res.json();
      setAgent((a) => ({ ...a, result: data }));
      setPhase("idle");
    } catch (e) {
      setError(e instanceof TypeError ? "Could not reach the agent. Check that the backend is running." : (e as Error).message);
      setPhase("error");
    }
  };

  const apply = () => {
    if (!result) return;
    setAllocation(result.allocation);
    setAgent((a) => ({ ...a, applied: true }));
  };

  const cats = result ? (Object.keys(result.allocation) as Category[]).sort((a, b) => result.allocation[b] - result.allocation[a]) : [];

  const openLabels = (Object.keys(CATEGORY_META) as Category[]).filter((k) => !completed.includes(k)).map((k) => CATEGORY_META[k].label);
  const doneLabels = completed.map((k) => CATEGORY_META[k].label);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-4 sm:p-6 space-y-4" style={{ border: "2px solid #f5c6d0" }}>
        <div>
          <h2 className="text-2xl font-medium text-gray-800">Wedding Agent ✦</h2>
          <p className="text-sm text-gray-600 mt-1">Tell the agent your goal. It plans the budget, searches vendors, checks availability and scores them for you.</p>
        </div>
        <label className="text-xs font-medium uppercase tracking-wider block" style={{ color: "#a8213b" }}>Your goal</label>
        <textarea rows={3} value={agent.objective} onChange={(e) => setAgent((a) => ({ ...a, objective: e.target.value }))}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none" style={INPUT_STYLE} />
        <div className="rounded-xl p-3 text-sm text-gray-700 space-y-1" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
          <div><span className="font-medium">Working on ({openLabels.length}):</span> {openLabels.length ? openLabels.join(", ") : "nothing: you've marked every vendor item as done"}</div>
          {doneLabels.length > 0 && <div><span className="font-medium">Skipping, you marked these done:</span> {doneLabels.join(", ")}</div>}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={run} disabled={phase === "running" || !agent.objective.trim() || openLabels.length === 0}
            className="text-white rounded-xl px-8 py-3.5 sm:py-3 font-medium text-sm disabled:opacity-50 sparkle-btn w-full sm:w-auto" style={PRIMARY_BTN}>
            {phase === "running" ? "Agent is working…" : result ? "✦ Run again" : "✦ Run the Wedding Agent"}
          </button>
          <span className="text-xs text-gray-600">Prototype: vendor data is a sample database, and availability is simulated.</span>
        </div>
        {phase === "error" && <div className="text-sm font-medium" style={{ color: "#a8213b" }}>{error}</div>}
      </div>

      {(phase === "running" || result) && (
        <div className="bg-white rounded-2xl p-4 sm:p-6" style={{ border: "1px solid #fbe8ec" }}>
          <h3 className="font-medium text-gray-700 text-sm mb-4">Agent activity</h3>
          <div className="space-y-4">
            {phase === "running" && <div className="text-sm text-gray-600">Planning, searching and scoring…</div>}
            {result?.events.slice(0, shown).map((e) => {
              const s = STATUS_STYLE[e.status];
              return (
                <div key={e.step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}` }}>{s.icon}</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{e.step}. {e.title}</div>
                    <div className="text-sm text-gray-700 leading-relaxed">{e.detail}</div>
                  </div>
                </div>
              );
            })}
            {result && !finished && <div className="text-sm text-gray-600">…</div>}
          </div>
        </div>
      )}

      {result && finished && (
        <>
          <div className="rounded-2xl p-4 sm:p-6" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "2px solid #c08a0c" }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#a8213b" }}>Agent summary</div>
            <p className="text-sm text-gray-800 leading-relaxed">{result.summary}</p>
            {!result.usedLlm && <p className="text-xs text-gray-600 mt-2">AI language model unavailable, so this uses default priorities and a templated summary.</p>}
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 space-y-4" style={{ border: "1px solid #fbe8ec" }}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div>
                <h3 className="font-medium text-gray-800 text-lg">Proposed budget</h3>
                <p className="text-sm text-gray-600">{inr(result.envelope.allocatable)} to allocate, plus {inr(result.envelope.reserve)} kept as a reserve.</p>
              </div>
              <button onClick={apply} disabled={agent.applied} className="rounded-xl px-5 py-3 sm:py-2.5 text-sm font-medium sm:shrink-0 w-full sm:w-auto"
                style={agent.applied ? { background: "#f3faf0", color: "#2f6b1f", border: "1px solid #9bd08a" } : { ...PRIMARY_BTN, color: "#fff" }}>
                {agent.applied ? "✓ Applied to your Budget" : "Apply to my Budget"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {cats.map((k) => (
                <div key={k} className="rounded-xl p-3 min-w-0" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
                  <div className="text-sm text-gray-700">{CATEGORY_META[k].icon} {CATEGORY_META[k].label}</div>
                  <div className="text-lg font-semibold" style={{ color: "#a8213b" }}>{inr(result.allocation[k])}</div>
                  <div className="text-xs text-gray-600">{Math.round((result.allocation[k] / result.envelope.total) * 100)}% of total</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">Nothing changes in your Budget until you press Apply.</p>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-800 text-lg">Top options by category</h3>
            {cats.filter((k) => result.shortlists[k]).map((k) => {
              const picks = result.shortlists[k] ?? [];
              return (
                <div key={k} className="bg-white rounded-2xl p-3 sm:p-5" style={{ border: "1px solid #fbe8ec" }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-3 px-1 sm:px-0">
                    <div className="text-sm font-semibold text-gray-800">{CATEGORY_META[k].icon} {CATEGORY_META[k].label}</div>
                    <div className="text-xs text-gray-600">Allocation {inr(result.allocation[k])}</div>
                  </div>
                  {picks.length === 0 && <div className="text-sm text-gray-600">No available vendors left for your dates.</div>}
                  <div className="space-y-3">
                    {picks.map((p, i) => {
                      const f = FIT_STYLE[p.fit];
                      return (
                        <div key={p.id} className="flex flex-wrap sm:flex-nowrap items-start gap-3 rounded-xl p-3" style={{ background: i === 0 ? "#fffafb" : "transparent", border: i === 0 ? "1px solid #f5c6d0" : "1px solid transparent" }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: "#fdf2f4", color: "#a8213b" }}>{p.score}</div>
                          <div className="flex-1 min-w-[10rem]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                              {i === 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#a8213b", color: "#fff" }}>Top pick</span>}
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: f.bg, color: f.color, border: `1px solid ${f.color}` }}>{f.label}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: p.source === "osm" ? "#eaf3ff" : "#f1f1f1", color: "#222", border: "1px solid #cfd8e3" }}>{p.source === "osm" ? "📍 Real listing" : "Sample"}</span>
                            </div>
                            <div className="text-sm text-gray-700">{p.area} · est. {inr(p.estCost)}</div>
                            <div className="text-xs text-gray-600">{p.reasons.slice(0, 2).join(" · ")}</div>
                          </div>
                          <button onClick={() => onMessage({ id: p.id, name: p.name, category: p.category, area: p.area, city: plan.location })}
                            className="w-full sm:w-auto sm:shrink-0 text-sm font-medium rounded-xl px-4 py-3 sm:py-2 text-white" style={PRIMARY_BTN}
                            title="Opens a chat with a drafted enquiry">💬 Message</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Phone / tablet navigation (the sidebar is desktop only) ────────────────────

const MOBILE_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overview", icon: "◈" },
  { id: "budget",    label: "Budget",   icon: "◎" },
  { id: "vendors",   label: "Vendors",  icon: "◉" },
  { id: "messages",  label: "Messages", icon: "◐" },
];

function MobileTopBar({ plan }: { plan: WeddingPlan }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(plan.date).getTime() - Date.now()) / 86400000));
  return (
    <header className="lg:hidden [@media(max-height:500px)]:hidden shrink-0 flex items-center justify-between px-4 bg-white" style={{ borderBottom: "1px solid #fbe8ec", minHeight: 52, paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#a8213b" }}><span className="text-white text-xs font-bold">P</span></div>
        <span className="text-lg font-medium" style={{ color: "#a8213b" }}>Partnered</span>
      </div>
      <div className="text-sm text-gray-800"><span className="font-semibold" style={{ color: "#a8213b" }}>{daysLeft}</span> days to go</div>
    </header>
  );
}

function MobileTabBar({ tab, setTab, plan, unreadCount }: { tab: Tab; setTab: (t: Tab) => void; plan: WeddingPlan; unreadCount: number }) {
  const [more, setMore] = useState(false);
  const moreActive = tab === "stories" || tab === "blogs";
  const item = (active: boolean) => ({ color: active ? "#a8213b" : "#1a1a1a", borderTop: `3px solid ${active ? "#a8213b" : "transparent"}` });
  return (
    <>
      <nav className="lg:hidden shrink-0 bg-white flex" style={{ borderTop: "1px solid #fbe8ec", paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Main">
        {MOBILE_TABS.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)} aria-current={tab === n.id ? "page" : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative min-h-14 [@media(max-height:500px)]:min-h-11 [@media(max-height:500px)]:py-1" style={item(tab === n.id)}>
            <span className="text-xl leading-none">{n.icon}</span>
            <span className="text-xs font-medium">{n.label}</span>
            {n.id === "messages" && unreadCount > 0 && (
              <span className="absolute top-1.5 right-[22%] text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold text-white" style={{ background: "#a8213b" }}>{unreadCount}</span>
            )}
          </button>
        ))}
        <button onClick={() => setMore(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 [@media(max-height:500px)]:min-h-11 [@media(max-height:500px)]:py-1" style={item(moreActive)}>
          <span className="text-xl leading-none">☰</span>
          <span className="text-xs font-medium">More</span>
        </button>
      </nav>

      {more && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setMore(false)}>
          <div className="w-full rounded-t-3xl bg-white p-5 space-y-4" style={{ borderTop: "3px solid #c08a0c", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-medium text-gray-800">More</h3>
              <button onClick={() => setMore(false)} aria-label="Close" className="text-xl px-3 py-2 -mr-3" style={{ color: "#444" }}>✕</button>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
              <div className="text-base font-medium text-gray-800">{plan.name} & {plan.partnerName}</div>
              <div className="text-sm text-gray-700">{plan.location} · {new Date(plan.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
              <div className="text-sm text-gray-700">{plan.guestCount} guests · {inr(plan.budget)}</div>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a8213b" }}>Inspiration</div>
            <div className="space-y-1">
              {INSPIRATION_NAV.map((n) => (
                <button key={n.id} onClick={() => { setTab(n.id); setMore(false); }}
                  className="w-full flex items-center gap-3 px-3 rounded-xl text-base font-medium text-left" style={{ minHeight: 48, color: tab === n.id ? "#fff" : "#1a1a1a", background: tab === n.id ? "linear-gradient(135deg, #a8213b, #881a30)" : "#fdf8f0" }}>
                  <span className="text-lg">{n.icon}</span>{n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Placeholder pages (content to be added) ─────────────────────────────────

function ComingSoonTab({ icon, title, blurb }: { icon: string; title: string; blurb: string }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-gray-800">{title}</h1>
        <p className="text-sm text-gray-600 mt-1">{blurb}</p>
      </div>
      <div className="bg-white rounded-2xl p-6 sm:p-12 text-center" style={{ border: "1px solid #fbe8ec" }}>
        <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
        <div className="text-xl font-medium text-gray-800">Coming soon</div>
        <p className="text-sm text-gray-600 mt-1">We're preparing this section.</p>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [plan, setPlan] = useState<WeddingPlan | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [allocation, setAllocation] = useState<BudgetAllocation>({} as BudgetAllocation);
  // Conversations only exist once the couple (or the agent's suggestions) start them.
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [agent, setAgent] = useState<AgentState>({ objective: "", result: null, applied: false });
  // Checklist is entirely the couple's call: nothing is ticked automatically.
  const [checklistDone, setChecklistDone] = useState<Set<string>>(new Set());
  const toggleCheck = (id: string) => setChecklistDone((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // The marketplace's cities come from the backend.
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [marketCity, setMarketCity] = useState("");
  useEffect(() => {
    let cancelled = false;
    // Retry a few times: a sleeping backend can take a moment to wake up.
    const load = (attempt: number) =>
      fetch(`${API_BASE}/api/cities`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { if (!cancelled) setCities(d.cities); })
        .catch(() => { if (!cancelled && attempt < 4) setTimeout(() => load(attempt + 1), 2000); });
    load(1);
    return () => { cancelled = true; };
  }, []);

  const toggleBook = (v: VendorRef, amount: number) =>
    setBookings((bs) => bs.some((b) => b.vendorId === v.id)
      ? bs.filter((b) => b.vendorId !== v.id)
      : [...bs, { vendorId: v.id, vendorName: v.name, category: v.category, amount }]);

  const unreadCount = threads.filter((t) => t.unread).length;

  const handleOnboard = (p: WeddingPlan) => {
    setPlan(p);
    setAllocation(mlAllocate(p.budget, p.guestCount));
    setAgent({ objective: defaultObjective(p), result: null, applied: false });
  };

  // "Message" on a vendor (marketplace or agent suggestion): open the chat with them, or start one with a
  // drafted enquiry the couple can review and send, then go to Messages.
  const messageVendor = (v: VendorRef) => {
    if (!plan) return;
    const id = `vendor-${v.id}`;
    if (!threads.some((t) => t.id === id)) {
      const days = plan.schedule.length ? plan.schedule : [{ date: plan.date, rituals: [] }];
      const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const first = days[0].date, last = days[days.length - 1].date;
      const when = first === last ? short(first) : `${short(first)} to ${short(last)}`;
      const thread: Thread = {
        id, sender: v.name, role: `${CATEGORY_META[v.category].label} · ${v.area}, ${v.city}`,
        avatar: v.name[0], unread: false, lastTime: "New", messages: [],
        draft: `Hi ${v.name} team, we're ${plan.name} and ${plan.partnerName}. We're planning a ${days.length}-day wedding in ${v.city} (${when}) for about ${plan.guestCount} guests. Are you available on those dates, and could you share a quote for ${CATEGORY_META[v.category].label.toLowerCase()}? Thank you!`,
      };
      setThreads([thread, ...threads]);
    }
    setActiveThreadId(id);
    setTab("messages");
  };

  if (!plan) return <OnboardingScreen cities={cities} onComplete={handleOnboard} />;

  // The marketplace opens on the couple's city if we have it, otherwise the first city in the list.
  const cityNames = cities.map((c) => c.name);
  const planCity = cities.find((c) => c.name.toLowerCase() === plan.location.trim().toLowerCase())?.name ?? cities[0]?.name ?? "";
  const shownCity = cityNames.includes(marketCity) ? marketCity : planCity;

  return (
    <div className="flex h-dvh overflow-hidden relative" style={{ background: "#fdf8f0" }}>
      <Backdrop />
      <div className="relative hidden lg:flex" style={{ zIndex: 10 }}>
        <Sidebar tab={tab} setTab={setTab} plan={plan} unreadCount={unreadCount} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col relative" style={{ zIndex: 10 }}>
      <MobileTopBar plan={plan} />
      <main className="flex-1 overflow-y-auto relative min-h-0">
        {tab === "dashboard" && <DashboardTab plan={plan} allocation={allocation} bookings={bookings} checklistDone={checklistDone} onToggleCheck={toggleCheck}
          agent={agent} setAgent={setAgent} setAllocation={setAllocation} setTab={setTab} onEditPlan={setPlan} onMessage={messageVendor} />}
        {tab === "stories"   && <ComingSoonTab icon="❀" title="Success Stories" blurb="Real weddings planned on Partnered." />}
        {tab === "blogs"     && <ComingSoonTab icon="✐" title="Blogs" blurb="Ideas, guides and advice for planning your shaadi." />}
        {tab === "budget"    && <BudgetTab plan={plan} allocation={allocation} setAllocation={setAllocation} />}
        {tab === "vendors"   && <VendorsTab plan={plan} cities={cities} city={shownCity} setCity={setMarketCity} bookings={bookings} onToggleBook={toggleBook} onMessage={messageVendor} />}
        {tab === "messages"  && <MessagesTab plan={plan} threads={threads} setThreads={setThreads} activeId={activeThreadId} setActiveId={setActiveThreadId} onNavigate={setTab} />}
      </main>
      <MobileTabBar tab={tab} setTab={setTab} plan={plan} unreadCount={unreadCount} />
      </div>
    </div>
  );
}

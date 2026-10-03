// Types and small helpers shared by App.tsx and the Payments, Guests and Deliveries pages.

export type Category = "attire" | "catering" | "decoration" | "gifts" | "logistics" | "transport" | "hotels" | "photography" | "music";
export type BudgetAllocation = Record<Category, number>;

// In development the backend runs on :8000; in production it is served under the same site at /api.
export const API_BASE = import.meta.env.DEV ? "http://localhost:8000" : "";

// A vendor the couple has booked. Spend is computed from these.
export interface Booking { vendorId: string; vendorName: string; category: Category; amount: number; }

// One day of the celebrations and the events held on it.
export interface ScheduleDay { date: string; rituals: string[]; }

export interface WeddingPlan {
  name: string; partnerName: string; date: string;
  location: string; budget: number; guestCount: number;
  rituals: string[];
  schedule: ScheduleDay[];
  creativeDirector: boolean;
  // Added by the longer onboarding. All optional, so plans saved earlier still open.
  dateMode?: "exact" | "month" | "unsure"; // for "month" and "unsure", `date` is a working date until the couple sets the real one
  state?: string;
  radiusKm?: number | null;               // how far from the city centre to look for vendors (null = not sure yet)
  sameVenue?: "yes" | "no" | "unsure";    // ceremony and reception in the same place?
  budgetBand?: string; guestBand?: string; // what the couple picked, when they gave a range
  styles?: string[];                       // up to three wedding styles
}

export const BUDGET_BANDS: { label: string; value: number }[] = [
  { label: "Under ₹5 lakh", value: 400000 }, { label: "₹5 – 10 lakh", value: 750000 }, { label: "₹10 – 20 lakh", value: 1500000 },
  { label: "₹20 – 30 lakh", value: 2500000 }, { label: "₹30 – 50 lakh", value: 4000000 }, { label: "₹50 lakh and above", value: 6000000 },
];
export const GUEST_BANDS: { label: string; value: number }[] = [
  { label: "Under 50", value: 40 }, { label: "50 – 100", value: 75 }, { label: "100 – 200", value: 150 },
  { label: "200 – 300", value: 250 }, { label: "300 – 500", value: 400 }, { label: "500 and above", value: 600 },
];
export const GUESTS_UNSURE = 200; // what we plan for when the couple is not sure yet

export const WEDDING_STYLES: { name: string; icon: string; blurb: string }[] = [
  { name: "Traditional & classic", icon: "🪔", blurb: "Rituals first, timeless look" },
  { name: "Modern & contemporary", icon: "✨", blurb: "Clean lines, current trends" },
  { name: "Royal & palace", icon: "👑", blurb: "Forts, palaces, grand scale" },
  { name: "Vintage & heritage", icon: "🏛️", blurb: "Havelis, old-world charm" },
  { name: "Rustic & garden", icon: "🌿", blurb: "Open air, florals, warm light" },
  { name: "Minimal & intimate", icon: "🕊️", blurb: "Small, calm, personal" },
  { name: "Ethnic & regional", icon: "🎎", blurb: "Inspired by your culture and region" },
  { name: "Themed", icon: "🎭", blurb: "A story or theme runs through it" },
  { name: "Destination", icon: "🌴", blurb: "Everyone travels to celebrate" },
  { name: "Glamorous & luxe", icon: "💎", blurb: "Statement decor, high drama" },
];

export const isTentative = (p: Pick<WeddingPlan, "dateMode">) => p.dateMode === "month" || p.dateMode === "unsure";

export function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
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

export const INPUT_STYLE = { border: "1px solid #f5c6d0", background: "#fdf2f4" };
export const PRIMARY_BTN = { background: "linear-gradient(135deg, #a8213b, #881a30)" };

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(s: string, n: number) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);
}
export function formatDay(s: string) {
  return new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
export function monthYear(s: string) {
  return new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
// How to show the wedding date: the real date, just the month, or a note that it is not set yet.
export function dateLabel(p: Pick<WeddingPlan, "date" | "dateMode">, long = true) {
  if (p.dateMode === "unsure") return "Date not set yet";
  if (p.dateMode === "month") return `${monthYear(p.date)} (date to be set)`;
  return long ? formatDay(p.date) : shortDay(p.date);
}
export function shortDay(s: string) {
  return new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export function uid(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }

// ── Payments ────────────────────────────────────────────────────────────────────

// Prototype: "paid" means paid in the test-mode checkout. Real money moves only once Pine Labs is connected.
export interface Payment {
  id: string; vendorId: string; vendorName: string; category: Category;
  label: string; amount: number; dueDate: string;
  status: "due" | "paid"; paidOn?: string; method?: string; ref?: string;
}
export type PaySplit = "30-40-30" | "50-50" | "100";
export const PAY_SPLITS: Record<PaySplit, { label: string; parts: [string, number, number][] }> = {
  // [label, share of the amount, days before the wedding that it falls due (null = on booking)]
  "30-40-30": { label: "30% now, 40% a month before, 30% a week before", parts: [["Advance", 0.3, -1], ["Second instalment", 0.4, 30], ["Final balance", 0.3, 7]] },
  "50-50":    { label: "50% now, 50% a week before", parts: [["Advance", 0.5, -1], ["Final balance", 0.5, 7]] },
  "100":      { label: "Pay in full now", parts: [["Full payment", 1, -1]] },
};

export function buildPayments(b: Booking, weddingDate: string, split: PaySplit): Payment[] {
  const today = isoDate(new Date());
  let allocated = 0;
  const parts = PAY_SPLITS[split].parts;
  return parts.map(([label, share, before], i) => {
    const amount = i === parts.length - 1 ? b.amount - allocated : Math.round((b.amount * share) / 100) * 100;
    allocated += amount;
    const due = before < 0 ? today : addDays(weddingDate, -before);
    return { id: uid("pay"), vendorId: b.vendorId, vendorName: b.vendorName, category: b.category, label, amount, dueDate: due < today ? today : due, status: "due" as const };
  });
}

// ── Guests and RSVP ─────────────────────────────────────────────────────────────

export type GuestGroup = "Bride's side" | "Groom's side" | "Friends" | "Other";
export type Rsvp = "not_invited" | "invited" | "yes" | "no" | "maybe";
export interface Guest {
  id: string; name: string; phone: string; group: GuestGroup; rsvp: Rsvp;
  party: number; // how many people are coming with this invitation, including the guest
  invitedOn?: string; inviteMode?: "whatsapp" | "sms" | "demo";
}

// ── Deliveries ──────────────────────────────────────────────────────────────────

export type DeliveryKind = "gift" | "invitation" | "attire" | "decor" | "other";
export const DELIVERY_STEPS = ["Ordered", "Picked up", "In transit", "Out for delivery", "Delivered"] as const;
export interface Delivery {
  id: string; item: string; kind: DeliveryKind; from: string; to: string; waybill: string;
  step: number; // index into DELIVERY_STEPS
  expected: string; neededBy: string; // yyyy-mm-dd
}
export const DELIVERY_KIND: Record<DeliveryKind, { label: string; icon: string }> = {
  gift: { label: "Gifts & hampers", icon: "🎁" }, invitation: { label: "Wedding invitations", icon: "💌" },
  attire: { label: "Dresses & attire", icon: "👗" }, decor: { label: "Decor items", icon: "💐" }, other: { label: "Other", icon: "📦" },
};

// ── Phone numbers ───────────────────────────────────────────────────────────────

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  const only = digits.replace(/\D/g, "");
  if (digits.startsWith("+")) return `+${only}`;
  if (only.length === 10) return `+91${only}`;
  if (only.length === 11 && only.startsWith("0")) return `+91${only.slice(1)}`;
  if (only.length === 12 && only.startsWith("91")) return `+${only}`;
  return only ? `+${only}` : "";
}
export function prettyPhone(p: string) {
  return p.startsWith("+91") && p.length === 13 ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p;
}

// ── Chat ────────────────────────────────────────────────────────────────────────

export interface ChatMessage { id: string; from: "me" | "vendor"; text: string; time: string; ts?: number; }

// ── Demo login ──────────────────────────────────────────────────────────────────
// A pretend sign-in for the prototype: any mobile number works, the OTP is always the one below, and nothing is
// checked on a server. Real sign-in (OTP by SMS) comes with the database.

export const DEMO_OTP = "123456";
export const DEMO_COUPLE = { phone: "+919000000001", email: "priya.demo@partnered.example" };
export const DEMO_VENDOR = { phone: "+919000000002", email: "vendor.demo@partnered.example" };

export type Role = "couple" | "vendor";
export interface Session { phone: string; email?: string; }

const SESSION_KEY = (role: Role) => `partnered.session.${role}`;
export function getSession(role: Role): Session | null {
  try { const s = JSON.parse(localStorage.getItem(SESSION_KEY(role)) ?? "null"); return s?.phone ? s : null; } catch { return null; }
}
export function setSession(role: Role, s: Session) { try { localStorage.setItem(SESSION_KEY(role), JSON.stringify(s)); } catch { /* storage unavailable */ } }
export function clearSession(role: Role) { try { localStorage.removeItem(SESSION_KEY(role)); } catch { /* nothing to clear */ } }

// ── Each couple's work, kept in this browser under their mobile number ─────────

const PROFILES_KEY = "partnered.profiles.v1";
const LEGACY_KEY = "partnered.state.v1"; // before logins existed: adopted by the demo couple account
function readProfiles(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "{}"); } catch { return {}; }
}
export function loadSaved<T>(phone: string): Partial<T> {
  const found = readProfiles()[phone];
  if (found) return found as Partial<T>;
  if (phone === DEMO_COUPLE.phone) { try { return JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "{}"); } catch { /* ignore */ } }
  return {};
}
export function save(phone: string, state: unknown) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify({ ...readProfiles(), [phone]: state })); } catch { /* private mode or storage full: carry on without saving */ }
}
export function clearSaved(phone: string) {
  try {
    const all = readProfiles(); delete all[phone];
    localStorage.setItem(PROFILES_KEY, JSON.stringify(all));
    if (phone === DEMO_COUPLE.phone) localStorage.removeItem(LEGACY_KEY);
  } catch { /* nothing to clear */ }
}

// ── The shared inbox: how a couple's message reaches the vendor desk (and the reply comes back) ─────
// Prototype: both live in this browser, so a couple tab and a vendor tab on the same device talk to each other.
// Across devices needs the database.

export interface VendorInfo { id: string; name: string; category: Category; area: string; city: string; estCost?: number; }
export interface Conversation {
  id: string; threadId: string; couplePhone: string;
  couple: { names: string; city: string; date: string; guests: number };
  vendor: VendorInfo; messages: ChatMessage[]; updatedAt: number;
}
export const INBOX_KEY = "partnered.inbox.v1";

export function readInbox(): Record<string, Conversation> {
  try { return JSON.parse(localStorage.getItem(INBOX_KEY) ?? "{}"); } catch { return {}; }
}
function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  [...a, ...b].forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((x, y) => (x.ts ?? 0) - (y.ts ?? 0));
}
// Add or update a conversation without losing messages the other side added in the meantime.
export function upsertConversation(c: Omit<Conversation, "updatedAt">) {
  try {
    const inbox = readInbox();
    const merged = mergeMessages(inbox[c.id]?.messages ?? [], c.messages);
    if (inbox[c.id] && merged.length === inbox[c.id].messages.length) return; // nothing new: do not wake other tabs
    inbox[c.id] = { ...c, messages: merged, updatedAt: Date.now() };
    localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
  } catch { /* storage unavailable */ }
}
export function appendMessage(convId: string, m: ChatMessage) {
  try {
    const inbox = readInbox();
    if (!inbox[convId]) return;
    inbox[convId] = { ...inbox[convId], messages: mergeMessages(inbox[convId].messages, [m]), updatedAt: Date.now() };
    localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
  } catch { /* storage unavailable */ }
}
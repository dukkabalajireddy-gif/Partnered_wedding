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
}

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

// ── Saving the couple's work in this browser ────────────────────────────────────

const STORE_KEY = "partnered.state.v1";
export function loadSaved<T>(): Partial<T> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}"); } catch { return {}; }
}
export function save(state: unknown) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode or storage full: carry on without saving */ }
}
export function clearSaved() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* nothing to clear */ }
}

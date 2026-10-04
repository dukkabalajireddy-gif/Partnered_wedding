import { inr, type Category, type WeddingPlan } from "./shared";

// Badges and "why this vendor" notes for the vendor pages. Everything here is worked out from facts we hold (the listing,
// the couple's plan and budget, the agent's shortlist) by plain rules, so nothing is invented.

export interface Badge { label: string; tone: "gold" | "rose" | "green" | "blue"; }
export interface InsightVendor {
  id: string; name: string; category: Category; estCost: number; distanceKm: number; partnerScore: number | null;
  features?: string[]; capacity: number | null; phone: string | null; website: string | null; rating: number | null;
}

export const BADGE_STYLE: Record<Badge["tone"], { bg: string; fg: string; border: string }> = {
  gold: { bg: "#fff7d6", fg: "#6b4a00", border: "#e8c75a" },
  rose: { bg: "#fdf2f4", fg: "#a8213b", border: "#f5c6d0" },
  green: { bg: "#f3faf0", fg: "#2f6b1f", border: "#9bd08a" },
  blue: { bg: "#eef3fb", fg: "#27457a", border: "#bccbe6" },
};

// Words in a vendor's name that hint at a wedding style. A hint, not a fact, and it is worded that way.
const STYLE_WORDS: Record<string, string[]> = {
  "Royal & palace": ["palace", "fort", "royal", "mahal", "grand", "haveli", "taj", "raj"],
  "Vintage & heritage": ["heritage", "haveli", "vintage", "classic", "palace"],
  "Rustic & garden": ["garden", "lawn", "farm", "orchard", "farmhouse", "resort"],
  "Destination": ["resort", "retreat", "lake", "villa"],
  "Glamorous & luxe": ["luxury", "grand", "royal", "taj", "hyatt", "marriott", "hilton", "novotel", "westin", "leela", "park"],
  "Modern & contemporary": ["modern", "studio", "digital", "design", "lounge"],
  "Minimal & intimate": ["boutique", "cottage", "intimate", "studio"],
  "Traditional & classic": ["traditional", "classic", "mandapam", "kalyana", "function hall", "convention", "banquet"],
  "Ethnic & regional": ["ethnic", "silk", "saree", "sarees", "pattu", "kanjivaram", "traditional"],
  "Themed": ["theme", "themed", "decor", "decorators"],
};
export const styleMatch = (name: string, styles: string[] = []) => {
  const n = name.toLowerCase();
  return styles.find((s) => (STYLE_WORDS[s] ?? []).some((w) => n.includes(w)));
};

// top: the agent's shortlist for each category, best first (empty before the agent has run)
export function vendorBadges(v: InsightVendor, plan: WeddingPlan, allocation: Partial<Record<Category, number>>, top: Partial<Record<Category, string[]>>): Badge[] {
  const out: Badge[] = [];
  const ranked = top[v.category] ?? [];
  if (ranked[0] === v.id) out.push({ label: "Best pick for you", tone: "gold" });
  else if (ranked.includes(v.id)) out.push({ label: "Recommended", tone: "rose" });
  const cap = allocation[v.category];
  if (cap && v.estCost <= cap) out.push({ label: "Within your budget", tone: "green" });
  const s = styleMatch(v.name, plan.styles);
  if (s) out.push({ label: `Suits your ${s.split(" ")[0].toLowerCase()} style`, tone: "blue" });
  return out;
}

export function vendorInsights(v: InsightVendor, plan: WeddingPlan, categoryBudget: number | undefined): { pros: string[]; cons: string[] } {
  const pros: string[] = [], cons: string[] = [];
  const stars = (v.features ?? []).find((f) => /^\d-star$/.test(f));

  if (categoryBudget && v.estCost <= categoryBudget) pros.push(`Typical price (${inr(v.estCost)}) fits your ${inr(categoryBudget)} budget for this`);
  if (categoryBudget && v.estCost > categoryBudget) cons.push(`Typical price is ${inr(v.estCost - categoryBudget)} over your ${inr(categoryBudget)} budget for this`);
  if (v.distanceKm <= 8) pros.push(`Close to the city centre (${v.distanceKm} km)`);
  if (v.distanceKm > 20) cons.push(`${v.distanceKm} km from the city centre, so allow for travel`);
  if (stars && parseInt(stars) >= 4) pros.push(`${stars} property`);
  if ((v.features ?? []).includes("Events venue")) pros.push("Listed as an events venue");
  if ((v.features ?? []).includes("Well known")) pros.push("A well-known name, so easier to check up on");
  if (v.capacity && v.capacity >= plan.guestCount) pros.push(`Listed capacity (${v.capacity}) covers your ${plan.guestCount} guests`);
  if (v.capacity && v.capacity < plan.guestCount) cons.push(`Listed capacity (${v.capacity}) is below your ${plan.guestCount} guests`);
  if (v.phone && v.website) pros.push("Easy to reach: phone and website are listed");
  else if (v.phone) pros.push("Phone number is listed");
  if (!v.phone && !v.website) cons.push("No phone or website listed, so contact may take longer");
  if (v.partnerScore !== null && v.partnerScore >= 75) pros.push(`Well-documented listing (Partner score ${v.partnerScore}/100)`);
  const s = styleMatch(v.name, plan.styles);
  if (s) pros.push(`Its name suggests it suits your ${s} style`);

  if (v.rating === null) cons.push("No customer reviews yet");
  cons.push("The price is a typical estimate: ask for a quote");

  if (pros.length === 0) pros.push("A real business listed in your city");
  return { pros: pros.slice(0, 4), cons: cons.slice(0, 4) };
}

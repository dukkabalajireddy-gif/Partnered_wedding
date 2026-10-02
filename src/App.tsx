import { useState, useMemo, useRef, useEffect } from "react";

type Category = "attire" | "catering" | "decoration" | "gifts" | "logistics" | "transport" | "hotels" | "photography" | "music";
type BudgetAllocation = Record<Category, number>;

interface Vendor {
  id: string; name: string; category: Category; location: string;
  distance: string; rating: number; price: string; tag: string; image: string;
}

interface ChatMessage {
  id: string; from: "me" | "vendor"; text: string; time: string;
}

interface Thread {
  id: string; sender: string; role: string; avatar: string;
  unread: boolean; lastTime: string; messages: ChatMessage[];
}

interface WeddingPlan {
  name: string; partnerName: string; date: string;
  location: string; budget: number; guestCount: number;
}

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

// ─── Vendors ─────────────────────────────────────────────────────────────────

const VENDORS: Vendor[] = [
  { id: "v1",  name: "Dum Pukht Banquets",         category: "catering",    location: "Connaught Place, Delhi", distance: "2.4 km",  rating: 4.9, price: "₹₹₹₹", tag: "Top Rated",       image: "photo-1555244162-803834f70033" },
  { id: "v2",  name: "Spice Route Events",          category: "catering",    location: "Lajpat Nagar, Delhi",    distance: "4.1 km",  rating: 4.7, price: "₹₹₹",  tag: "Popular",         image: "photo-1414235077428-338989a2e8c0" },
  { id: "v3",  name: "Pind Balluchi Catering",      category: "catering",    location: "Punjabi Bagh, Delhi",    distance: "6.0 km",  rating: 4.6, price: "₹₹₹",  tag: "Punjabi Special", image: "photo-1565299624946-b28f40a0ae38" },
  { id: "v4",  name: "Haldiram's Banquet",          category: "catering",    location: "Chandni Chowk, Delhi",   distance: "7.5 km",  rating: 4.5, price: "₹₹",   tag: "Budget Friendly", image: "photo-1567620905732-2d1ec7ab7445" },
  { id: "v5",  name: "Ritu Kumar Bridal Studio",    category: "attire",      location: "Khan Market, Delhi",     distance: "3.0 km",  rating: 5.0, price: "₹₹₹₹", tag: "Exclusive",       image: "photo-1519225421980-715cb0215aed" },
  { id: "v6",  name: "Sabyasachi Flagship",         category: "attire",      location: "Mehrauli, Delhi",        distance: "8.5 km",  rating: 4.9, price: "₹₹₹₹", tag: "Designer",        image: "photo-1594938298603-c8148c4b4bde" },
  { id: "v7",  name: "Manish Malhotra Studio",      category: "attire",      location: "DLF Emporio, Vasant Kunj",distance: "12 km",  rating: 4.8, price: "₹₹₹₹", tag: "Couture",         image: "photo-1515886657613-9f3515b0c78f" },
  { id: "v8",  name: "Nalli Silk Sarees",           category: "attire",      location: "Connaught Place, Delhi", distance: "2.8 km",  rating: 4.7, price: "₹₹₹",  tag: "Traditional",     image: "photo-1610030469983-98e550d6193c" },
  { id: "v9",  name: "Phool Mahal Decorators",      category: "decoration",  location: "Karol Bagh, Delhi",      distance: "1.8 km",  rating: 4.8, price: "₹₹₹",  tag: "Award Winning",   image: "photo-1507003211169-0a1dd7228f2d" },
  { id: "v10", name: "Rani Mahal Floral Events",    category: "decoration",  location: "Pitampura, Delhi",       distance: "9.0 km",  rating: 4.6, price: "₹₹₹",  tag: "Marigold Expert", image: "photo-1464366400600-7168b8af9bc3" },
  { id: "v11", name: "Tasveer Photography",         category: "photography", location: "Hauz Khas, Delhi",       distance: "5.2 km",  rating: 4.9, price: "₹₹₹₹", tag: "Cinematic",       image: "photo-1537633552985-df8429e8048b" },
  { id: "v12", name: "Stories by Joseph Radhik",    category: "photography", location: "South Delhi",            distance: "6.4 km",  rating: 5.0, price: "₹₹₹₹", tag: "Celebrity Pick",  image: "photo-1606216794074-735e91aa2c92" },
  { id: "v13", name: "Clicksunlimited Studio",      category: "photography", location: "Rohini, Delhi",          distance: "11 km",   rating: 4.5, price: "₹₹₹",  tag: "Value Pick",      image: "photo-1492691527719-9d1e07e534b4" },
  { id: "v14", name: "The Leela Palace",            category: "hotels",      location: "Chanakyapuri, Delhi",    distance: "0.8 km",  rating: 4.8, price: "₹₹₹₹", tag: "Grand Ballroom",  image: "photo-1566073771259-6a8506099945" },
  { id: "v15", name: "Udaivilas Oberoi",            category: "hotels",      location: "Udaipur, Rajasthan",     distance: "580 km",  rating: 5.0, price: "₹₹₹₹", tag: "Destination",     image: "photo-1520250497591-112f2f40a3f4" },
  { id: "v16", name: "ITC Grand Bharat",            category: "hotels",      location: "Gurugram, Haryana",      distance: "28 km",   rating: 4.7, price: "₹₹₹₹", tag: "Palace Lawns",    image: "photo-1551882547-ff40c63fe2e2" },
  { id: "v17", name: "Neemrana Fort Palace",        category: "hotels",      location: "Neemrana, Rajasthan",    distance: "122 km",  rating: 4.8, price: "₹₹₹₹", tag: "Heritage Stay",   image: "photo-1531804055935-76f44d7c3621" },
  { id: "v18", name: "Royal Wheels Fleet",          category: "transport",   location: "IGI Airport Zone",       distance: "8.0 km",  rating: 4.5, price: "₹₹₹",  tag: "Vintage Cars",    image: "photo-1449965408869-eaa3f722e40d" },
  { id: "v19", name: "Shahi Sawari Baraats",        category: "transport",   location: "Dwarka, Delhi",          distance: "14 km",   rating: 4.6, price: "₹₹₹",  tag: "Elephant & Horse",image: "photo-1558618666-fcd25c85cd64" },
  { id: "v20", name: "Shankar Mahadevan Troupe",    category: "music",       location: "Gurugram, Haryana",      distance: "28 km",   rating: 4.9, price: "₹₹₹₹", tag: "Sangeet Nights",  image: "photo-1493225457124-a3eb161ffa5f" },
  { id: "v21", name: "Bollywood DJ Nights",         category: "music",       location: "Vasant Kunj, Delhi",     distance: "10 km",   rating: 4.7, price: "₹₹₹",  tag: "DJ + Live Singer",image: "photo-1429962714451-bb934ecdc4ec" },
  { id: "v22", name: "Mithai & Moments Gifting",    category: "gifts",       location: "Chandni Chowk, Delhi",   distance: "2.9 km",  rating: 4.6, price: "₹₹",   tag: "Handcrafted",     image: "photo-1549465220-1a8b9238cd48" },
  { id: "v23", name: "Fabindia Wedding Gifting",    category: "gifts",       location: "Khan Market, Delhi",     distance: "3.1 km",  rating: 4.5, price: "₹₹",   tag: "Artisan Crafts",  image: "photo-1513201099705-a9746e1e201f" },
  { id: "v24", name: "Shaadi Logistics Co.",        category: "logistics",   location: "Dwarka, Delhi",          distance: "7.3 km",  rating: 4.4, price: "₹₹",   tag: "Full Service",    image: "photo-1553413077-190dd305871c" },
];

// ─── Chat Threads ─────────────────────────────────────────────────────────────

const INITIAL_THREADS: Thread[] = [
  {
    id: "t1", sender: "Chef Sanjeev Kumar", role: "Head Caterer · Dum Pukht Banquets",
    avatar: "S", unread: true, lastTime: "10:32 AM",
    messages: [
      { id: "1", from: "me",     text: "Hi Chef Sanjeev, wanted to confirm our menu tasting session. Are we still on for Saturday?", time: "9:45 AM" },
      { id: "2", from: "vendor", text: "Namaste! Yes absolutely. I have confirmed the slot for Saturday 11am at the banquet hall. We will cover all three menus — the Rajasthani thali, the North Indian spread, and the fusion starter section.", time: "10:10 AM" },
      { id: "3", from: "me",     text: "Perfect. Will our family members be allowed to join the tasting?", time: "10:20 AM" },
      { id: "4", from: "vendor", text: "Of course! Please bring up to 6 family members. We will also have our head of sweets present so you can finalise the mithai selection for the baraat and reception separately. I will send the revised proposal tonight with the per-plate pricing.", time: "10:32 AM" },
    ],
  },
  {
    id: "t2", sender: "Rahul Mishra", role: "Lead Photographer · Stories by Joseph Radhik",
    avatar: "R", unread: true, lastTime: "Yesterday",
    messages: [
      { id: "1", from: "vendor", text: "Hi! I have completed the shot list based on our last call. Sharing a Google Doc link shortly. I wanted to propose a quick venue walk-through — ideally a week before to scout lighting angles during golden hour.", time: "3:15 PM" },
      { id: "2", from: "me",     text: "That sounds great Rahul. We were also thinking of a pre-wedding shoot at Lodhi Garden. Is that something you cover?", time: "4:00 PM" },
      { id: "3", from: "vendor", text: "Absolutely — Lodhi Garden is one of my favourite locations! The Mughal architecture in the background gives a very regal look. I suggest early morning around 6:30am for the best soft light. Shall I block a date in early November?", time: "4:30 PM" },
    ],
  },
  {
    id: "t3", sender: "Sunita Floral Arts", role: "Floral Designer · Phool Mahal",
    avatar: "F", unread: false, lastTime: "Mon",
    messages: [
      { id: "1", from: "me",     text: "Sunita ji, quick update — we would like to go with the marigold + white tuberose combination for the mandap. Can you also do a genda phool entrance arch?", time: "11:00 AM" },
      { id: "2", from: "vendor", text: "Beautiful choice! Marigold and tuberose together smell absolutely divine. The entrance arch with genda phool will look very traditional and festive. I will prepare a fresh mood board by Wednesday. The saffron and crimson mix we discussed will tie everything together beautifully. 🌸", time: "11:45 AM" },
    ],
  },
  {
    id: "t4", sender: "The Leela Palace", role: "Banquet Manager · Chanakyapuri",
    avatar: "L", unread: false, lastTime: "Mon",
    messages: [
      { id: "1", from: "vendor", text: "Good afternoon. This is Vikram Singh from The Leela Palace banquet team. Your advance payment of ₹5,00,000 has been received and processed. We have confirmed the Grand Ballroom for your reception date and blocked 80 guest rooms in the Heritage Wing.", time: "2:00 PM" },
      { id: "2", from: "me",     text: "Thank you Vikram ji. Can we also arrange for a poolside cocktail area the evening before for family arrivals?", time: "3:30 PM" },
      { id: "3", from: "vendor", text: "Certainly! The Poolside Terrace is available that evening. I will add it to your booking with a complimentary mocktail setup for up to 40 guests as part of our premium package. A revised contract will reach you by tomorrow morning.", time: "4:15 PM" },
    ],
  },
  {
    id: "t5", sender: "Ritu Kumar Studio", role: "Stylist · Khan Market",
    avatar: "K", unread: true, lastTime: "Sun",
    messages: [
      { id: "1", from: "vendor", text: "Priya ji, your bridal lehenga is ready for the second fitting. We have adjusted the blouse neckline as you requested and added the additional zardosi work on the dupatta border. Can we schedule for the 18th at 3pm?", time: "10:00 AM" },
      { id: "2", from: "me",     text: "Yes the 18th works perfectly! Will the groom's sherwani also be ready for a joint fitting?", time: "10:30 AM" },
      { id: "3", from: "vendor", text: "Yes! The ivory silk sherwani with the gold thread embroidery will be ready too. We can do both fittings together — usually takes about 2 hours. Please avoid heavy meals before so the fitting sits properly. 😊", time: "11:00 AM" },
    ],
  },
  {
    id: "t6", sender: "Royal Wheels Fleet", role: "Transport Manager · Dwarka",
    avatar: "W", unread: false, lastTime: "Fri",
    messages: [
      { id: "1", from: "vendor", text: "Namaste! I have finalised the baraat route from Hotel Leela to the venue. The vintage Rolls Royce and two Maharaja Ambassadors will lead the procession. The dhol party and horse can join at the designated zone near the venue gate as per Delhi traffic guidelines.", time: "5:00 PM" },
      { id: "2", from: "me",     text: "Can you also arrange airport pickup for outstation guests on the 20th? Around 30 guests are arriving from Mumbai and Bangalore.", time: "5:45 PM" },
      { id: "3", from: "vendor", text: "Absolutely. We have a fleet of 6 Innova Crystas and 2 Tempo Travellers available. Please share the flight details and I will prepare a complete pickup schedule with driver contacts for each guest.", time: "6:20 PM" },
    ],
  },
];

// ─── Onboarding ───────────────────────────────────────────────────────────────

function OnboardingScreen({ onComplete }: { onComplete: (p: WeddingPlan) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<WeddingPlan>>({});
  const set = (k: keyof WeddingPlan, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fdf2f4 0%, #fefdf0 50%, #fdf8f0 100%)" }}>
      <div className="w-full max-w-lg px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#a8213b" }}>
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="text-2xl font-medium tracking-tight" style={{ color: "#a8213b" }}>Partnered</span>
          </div>
          <p className="text-sm font-light" style={{ color: "#c08a0c" }}>Plan your shaadi, your way</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1 rounded-full transition-all duration-300"
              style={{ width: i <= step ? 48 : 24, background: i <= step ? "#a8213b" : "#f5c6d0" }} />
          ))}
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8" style={{ border: "1px solid #f5c6d0" }}>
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-medium text-gray-800 mb-1">Welcome! What are your names?</h2>
                <p className="text-sm text-gray-400">No account needed — we'll remember you here.</p>
              </div>
              <div className="space-y-3">
                {(["name", "partnerName"] as const).map((k, i) => (
                  <div key={k}>
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>{i === 0 ? "Your name" : "Partner's name"}</label>
                    <input className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ border: "1px solid #f5c6d0", background: "#fdf2f4" }}
                      placeholder={i === 0 ? "e.g. Priya" : "e.g. Arjun"} value={(form[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <button className="w-full text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}
                disabled={!form.name || !form.partnerName} onClick={() => setStep(1)}>Continue →</button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-medium text-gray-800 mb-1">When and where?</h2>
                <p className="text-sm text-gray-400">We'll find shaadi vendors near your celebration city.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Wedding Date</label>
                  <input type="date" min={new Date().toISOString().split("T")[0]} className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ border: "1px solid #f5c6d0", background: "#fdf2f4" }}
                    value={form.date ?? ""} onChange={(e) => set("date", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>City / Location</label>
                  <input className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ border: "1px solid #f5c6d0", background: "#fdf2f4" }}
                    placeholder="e.g. Delhi, Jaipur, Udaipur, Goa…" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Expected Guests</label>
                  <input type="number" className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ border: "1px solid #f5c6d0", background: "#fdf2f4" }}
                    placeholder="e.g. 300" value={form.guestCount ?? ""} onChange={(e) => set("guestCount", Number(e.target.value))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 rounded-xl py-3 font-medium text-sm" style={{ border: "1px solid #f5c6d0", color: "#a8213b" }} onClick={() => setStep(0)}>Back</button>
                <button className="flex-[2] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40" style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}
                  disabled={!form.date || !form.location || !form.guestCount} onClick={() => setStep(2)}>Continue →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-medium text-gray-800 mb-1">What's your total budget?</h2>
                <p className="text-sm text-gray-400">Our AI will suggest ideal allocations across all shaadi categories.</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Total Budget (INR ₹)</label>
                <input type="number" className="mt-1 w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ border: "1px solid #f5c6d0", background: "#fdf2f4" }}
                  placeholder="e.g. 2500000" value={form.budget ?? ""} onChange={(e) => set("budget", Number(e.target.value))} />
                <div className="flex flex-wrap gap-2 mt-3">
                  {[["₹5,00,000", 500000], ["₹10,00,000", 1000000], ["₹25,00,000", 2500000], ["₹50,00,000", 5000000]].map(([label, val]) => (
                    <button key={String(label)} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "#fdf2f4", color: "#a8213b", border: "1px solid #f5c6d0" }}
                      onClick={() => set("budget", val as number)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 rounded-xl py-3 font-medium text-sm" style={{ border: "1px solid #f5c6d0", color: "#a8213b" }} onClick={() => setStep(1)}>Back</button>
                <button className="flex-[2] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-40" style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}
                  disabled={!form.budget} onClick={() => onComplete(form as WeddingPlan)}>Shubh Aarambh ✨</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "budget" | "vendors" | "messages";
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overview",  icon: "◈" },
  { id: "budget",    label: "Budget",    icon: "◎" },
  { id: "vendors",   label: "Vendors",   icon: "◉" },
  { id: "messages",  label: "Messages",  icon: "◐" },
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
            style={tab === n.id ? { background: "linear-gradient(135deg, #a8213b, #881a30)", color: "#fff" } : { color: "#6b6b6b" }}>
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
      </nav>

      <div className="px-4 py-4" style={{ borderTop: "1px solid #fdf2f4" }}>
        <div className="text-xs text-gray-400">{new Date(plan.date).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</div>
        <div className="text-xs mt-0.5" style={{ color: "#c08a0c" }}>{plan.guestCount} guests · {inr(plan.budget)}</div>
      </div>
    </aside>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardTab({ plan, allocation, setTab }: { plan: WeddingPlan; allocation: BudgetAllocation; setTab: (t: Tab) => void }) {
  const spentFraction: Record<Category, number> = { catering: 0.65, attire: 0.40, decoration: 0.20, photography: 0.80, hotels: 0.50, transport: 0, music: 0, gifts: 0, logistics: 0.10 };
  const spent = useMemo(() => {
    const r = {} as BudgetAllocation;
    (Object.keys(allocation) as Category[]).forEach((k) => { r[k] = Math.round(allocation[k] * spentFraction[k]); });
    return r;
  }, [allocation]);
  const totalSpent = Object.values(spent).reduce((a, b) => a + b, 0);

  const checklist = [
    { done: true,  text: "Venue booked" },
    { done: true,  text: "Catering contract signed" },
    { done: true,  text: "Photographer confirmed" },
    { done: false, text: "Floral & marigold arrangements finalised" },
    { done: false, text: "Wedding invitation (shaadi card) sent" },
    { done: false, text: "Baraat transport arranged" },
    { done: false, text: "Honeymoon booked" },
  ];

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-800">Namaste, {plan.name} ✦</h1>
        <p className="text-sm text-gray-400 mt-1">Here's where your shaadi stands today.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Budget",  value: inr(plan.budget),              sub: "set by you",                color: "#a8213b" },
          { label: "Spent So Far",  value: inr(totalSpent),               sub: `${Math.round((totalSpent/plan.budget)*100)}% of budget`, color: "#881a30" },
          { label: "Remaining",     value: inr(plan.budget - totalSpent), sub: "to allocate",               color: "#c08a0c" },
          { label: "Days Left",     value: String(Math.max(0, Math.ceil((new Date(plan.date).getTime() - Date.now()) / 86400000))), sub: "until the big day", color: "#c93a52" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #fbe8ec" }}>
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-white rounded-2xl p-6" style={{ border: "1px solid #fbe8ec" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-700 text-sm">Budget by Category</h3>
            <button onClick={() => setTab("budget")} className="text-xs px-2 py-1 rounded-full" style={{ background: "#fdf2f4", color: "#a8213b" }}>View all →</button>
          </div>
          <div className="space-y-3">
            {(Object.keys(allocation) as Category[]).slice(0, 6).map((k) => (
              <div key={k}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">{CATEGORY_META[k].icon} {CATEGORY_META[k].label}</span>
                  <span className="text-xs text-gray-400">{inr(spent[k])} / {inr(allocation[k])}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#fdf2f4" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((spent[k]/allocation[k])*100))}%`, background: `linear-gradient(to right, ${CATEGORY_META[k].color}, #c08a0c)` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-white rounded-2xl p-6" style={{ border: "1px solid #fbe8ec" }}>
          <h3 className="font-medium text-gray-700 text-sm mb-4">Shaadi Checklist</h3>
          <div className="space-y-2.5">
            {checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                  style={c.done ? { background: "#a8213b" } : { border: "2px solid #f5c6d0" }}>
                  {c.done && <span className="text-white text-xs">✓</span>}
                </div>
                <span className={`text-xs ${c.done ? "line-through text-gray-300" : "text-gray-600"}`}>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-medium text-gray-800">Budget Planner</h1>
          <p className="text-sm text-gray-400 mt-1">AI-suggested allocations for {plan.guestCount} guests.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLockTotal(!lockTotal)}
            className="text-xs px-4 py-2 rounded-xl transition-colors"
            style={lockTotal ? { background: "#fdf2f4", color: "#a8213b", border: "1px solid #a8213b" } : { color: "#6b6b6b", border: "1px solid #e5e5e5" }}>
            {lockTotal ? "🔒 Total locked" : "🔓 Total free"}
          </button>
          <button onClick={() => setAllocation(mlAllocate(plan.budget, plan.guestCount))}
            className="text-xs px-4 py-2 rounded-xl transition-colors"
            style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>✦ Reset to AI</button>
          <button onClick={() => setCertOpen(true)}
            className="text-xs px-4 py-2 rounded-xl text-white transition-colors"
            style={{ background: "linear-gradient(135deg, #c08a0c, #9a6a0a)" }}>
            🏅 Budget Certificate
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #fbe8ec" }}>
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
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(Object.keys(allocation) as Category[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_META[k].color }} />
              <span className="text-xs text-gray-500 truncate">{CATEGORY_META[k].label}</span>
              <span className="text-xs text-gray-400 ml-auto">{Math.round((allocation[k] / plan.budget) * 100)}%</span>
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
      <div className="grid grid-cols-3 gap-4">
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
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "#c08a0c" }}>edit</button>
                </div>
              )}
              <input type="range" min={0} max={plan.budget} step={5000} value={allocation[k]}
                onChange={(e) => updateCategory(k, Number(e.target.value))}
                aria-label={`${CATEGORY_META[k].label} budget`}
                className="mt-3 w-full cursor-pointer"
                style={{ accentColor: CATEGORY_META[k].color }} />
              <div className="text-xs text-gray-400 mt-1">
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
          <div className="w-full max-w-lg rounded-t-3xl p-8 space-y-5" style={{ background: "#fff", borderTop: "3px solid #c08a0c" }} onClick={(e) => e.stopPropagation()}>
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

function VendorsTab({ plan }: { plan: WeddingPlan }) {
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set(["v14", "v5"]));

  const filtered = VENDORS.filter((v) => {
    const matchCat = activeCategory === "all" || v.category === activeCategory;
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.location.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const toggle = (id: string) => setSaved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-gray-800">Find Vendors</h1>
        <p className="text-sm text-gray-400 mt-1">Top vendors near {plan.location} — sorted by distance. Destination options included.</p>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">⌕</span>
        <input className="w-full pl-8 pr-4 py-2.5 bg-white rounded-xl text-sm focus:outline-none"
          style={{ border: "1px solid #fbe8ec" }}
          placeholder="Search vendors or locations…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveCategory("all")} className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
          style={activeCategory === "all" ? { background: "#a8213b", color: "#fff" } : { background: "#fff", color: "#6b6b6b", border: "1px solid #fbe8ec" }}>All</button>
        {(Object.keys(CATEGORY_META) as Category[]).map((k) => (
          <button key={k} onClick={() => setActiveCategory(k)} className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            style={activeCategory === k ? { background: "#a8213b", color: "#fff" } : { background: "#fff", color: "#6b6b6b", border: "1px solid #fbe8ec" }}>
            {CATEGORY_META[k].icon} {CATEGORY_META[k].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {filtered.map((v) => (
          <div key={v.id} className="bg-white rounded-2xl overflow-hidden group transition-all hover:shadow-md" style={{ border: "1px solid #fbe8ec" }}>
            <div className="relative">
              <img src={`https://images.unsplash.com/${v.image}?w=400&h=200&fit=crop&auto=format`}
                alt={v.name} className="w-full h-36 object-cover" style={{ background: "#fdf2f4" }} />
              <div className="absolute top-2 left-2 text-xs font-medium px-2 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.92)", color: "#a8213b" }}>{v.tag}</div>
              <button onClick={() => toggle(v.id)}
                className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${saved.has(v.id) ? "" : "opacity-0 group-hover:opacity-100"}`}
                style={saved.has(v.id) ? { background: "#a8213b", color: "#fff" } : { background: "rgba(255,255,255,0.85)", color: "#aaa" }}>
                {saved.has(v.id) ? "♥" : "♡"}
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-800 text-sm">{v.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{v.location}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#c08a0c" }}>📍 {v.distance}</div>
                </div>
                <div className="text-xs font-semibold" style={{ color: "#c08a0c" }}>{v.price}</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span style={{ color: "#e0b015" }}>★</span>
                  <span className="text-xs text-gray-600 font-medium">{v.rating}</span>
                </div>
                <span className="text-xs" style={{ color: "#9a6a0a" }}>{CATEGORY_META[v.category].icon} {CATEGORY_META[v.category].label}</span>
              </div>
              <button className="mt-3 w-full text-xs rounded-xl py-2 transition-colors"
                style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>View & Contact</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400 text-sm">No vendors found.</div>
        )}
      </div>
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

function MessagesTab({ plan, threads, setThreads }: { plan: WeddingPlan; threads: Thread[]; setThreads: (t: Thread[]) => void }) {
  const [activeId, setActiveId] = useState("t1");
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId)!;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, active?.messages.length]);

  const send = () => {
    if (!draft.trim()) return;
    const msg: ChatMessage = { id: String(Date.now()), from: "me", text: draft.trim(), time: now() };
    setThreads(threads.map((t) => t.id === activeId ? { ...t, messages: [...t.messages, msg], lastTime: "Just now", unread: false } : t));
    setDraft("");
  };

  const selectThread = (id: string) => {
    setActiveId(id);
    setThreads(threads.map((t) => t.id === id ? { ...t, unread: false } : t));
  };

  const quickReplies = ["Confirmed! ✓", "Can we reschedule?", "Please send the invoice", "What's the advance amount?", "Thank you 🙏"];

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh" }}>
      {/* Thread list */}
      <div className="w-72 shrink-0 overflow-y-auto bg-white" style={{ borderRight: "1px solid #fbe8ec" }}>
        <div className="p-5 sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid #fdf2f4" }}>
          <h2 className="text-lg font-medium text-gray-800">Messages</h2>
          <p className="text-xs text-gray-400 mt-0.5">Vendors & stakeholders</p>
        </div>
        {threads.map((t) => (
          <button key={t.id} onClick={() => selectThread(t.id)}
            className="w-full text-left p-4 transition-colors"
            style={{ background: activeId === t.id ? "#fdf2f4" : "transparent", borderBottom: "1px solid #fdf8f0" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                style={t.unread ? { background: "#a8213b", color: "#fff" } : { background: "#fdf2f4", color: "#a8213b" }}>
                {t.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold truncate ${t.unread ? "text-gray-800" : "text-gray-600"}`}>{t.sender}</span>
                  <span className="text-xs text-gray-400 shrink-0 ml-1">{t.lastTime}</span>
                </div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{t.role.split("·")[0].trim()}</div>
                <div className={`text-xs truncate mt-0.5 ${t.unread ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                  {t.messages[t.messages.length - 1]?.text}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Chat pane */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#fdf8f0" }}>
        {/* Header */}
        <div className="px-6 py-4 bg-white flex items-center gap-4 shrink-0" style={{ borderBottom: "1px solid #fbe8ec" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium" style={{ background: "#fdf2f4", color: "#a8213b" }}>
            {active.avatar}
          </div>
          <div>
            <div className="font-medium text-gray-800 text-sm">{active.sender}</div>
            <div className="text-xs text-gray-400">{active.role}</div>
          </div>
          <div className="ml-auto flex gap-2">
            {["📅 Schedule Call", "📄 View Contract", "📎 Share File"].map((l) => (
              <span key={l} className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors select-none"
                style={{ background: "#fdf2f4", color: "#a8213b" }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Date stamp */}
          <div className="text-center">
            <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full" style={{ border: "1px solid #fbe8ec" }}>Today</span>
          </div>

          {active.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
              {msg.from === "vendor" && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mr-2 mt-1 shrink-0"
                  style={{ background: "#fdf2f4", color: "#a8213b" }}>{active.avatar}</div>
              )}
              <div className="max-w-xs">
                <div className={`text-xs rounded-2xl px-4 py-3 leading-relaxed ${msg.from === "me" ? "rounded-tr-sm text-white" : "rounded-tl-sm text-gray-700 bg-white"}`}
                  style={msg.from === "me" ? { background: "linear-gradient(135deg, #a8213b, #881a30)" } : { border: "1px solid #fbe8ec" }}>
                  {msg.text}
                </div>
                <div className={`text-xs text-gray-400 mt-1 ${msg.from === "me" ? "text-right" : "text-left"}`}>{msg.time}</div>
              </div>
              {msg.from === "me" && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ml-2 mt-1 shrink-0"
                  style={{ background: "#fbf0a1", color: "#9a6a0a" }}>{plan.name[0]}</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="px-6 pt-2 flex flex-wrap gap-2 bg-white" style={{ borderTop: "1px solid #fbe8ec" }}>
          {quickReplies.map((q) => (
            <button key={q} onClick={() => setDraft(q)} className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ color: "#a8213b", background: "#fdf2f4", border: "1px solid #f5c6d0" }}>{q}</button>
          ))}
        </div>

        {/* Compose */}
        <div className="px-6 py-4 bg-white flex items-end gap-3">
          <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${active.sender.split(" ")[0]}…`}
            className="flex-1 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{ border: "1px solid #fbe8ec", background: "#fdf8f0" }} />
          <button onClick={send} className="text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base"
            style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [plan, setPlan] = useState<WeddingPlan | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [allocation, setAllocation] = useState<BudgetAllocation>({} as BudgetAllocation);
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);

  const unreadCount = threads.filter((t) => t.unread).length;

  const handleOnboard = (p: WeddingPlan) => {
    setPlan(p);
    setAllocation(mlAllocate(p.budget, p.guestCount));
  };

  if (!plan) return <OnboardingScreen onComplete={handleOnboard} />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#fdf8f0" }}>
      <Sidebar tab={tab} setTab={setTab} plan={plan} unreadCount={unreadCount} />
      <main className="flex-1 overflow-y-auto">
        {tab === "dashboard" && <DashboardTab plan={plan} allocation={allocation} setTab={setTab} />}
        {tab === "budget"    && <BudgetTab plan={plan} allocation={allocation} setAllocation={setAllocation} />}
        {tab === "vendors"   && <VendorsTab plan={plan} />}
        {tab === "messages"  && <MessagesTab plan={plan} threads={threads} setThreads={setThreads} />}
      </main>
    </div>
  );
}

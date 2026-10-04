import { useMemo, useRef, useState } from "react";
import { INPUT_STYLE, PRIMARY_BTN, isoDate, normalisePhone, prettyPhone, shortDay, uid, type Guest, type GuestGroup, type Rsvp, type WeddingPlan } from "./shared";

// Guest list and RSVP. The guest list lives in this browser. Contacts are read here only (nothing is uploaded),
// and only the people the couple choose are added. Real one-tap bulk sending needs the WhatsApp Business API
// or an SMS gateway; until one is connected, invitations go out one tap at a time from the couple's own phone.

const GROUPS: GuestGroup[] = ["Bride's side", "Groom's side", "Friends", "Other"];
const RSVP_LABEL: Record<Rsvp, string> = { not_invited: "Not invited", invited: "Awaiting reply", yes: "Coming", no: "Can't come", maybe: "Maybe" };
const RSVP_STYLE: Record<Rsvp, { bg: string; fg: string }> = {
  not_invited: { bg: "#f1f1f1", fg: "#333" }, invited: { bg: "#fffdf0", fg: "#7a5206" },
  yes: { bg: "#f3faf0", fg: "#2f6b1f" }, no: { bg: "#fdf2f4", fg: "#a8213b" }, maybe: { bg: "#eef3fb", fg: "#27457a" },
};

// ── Reading contacts ────────────────────────────────────────────────────────────

interface Candidate { id: string; name: string; phone: string; picked: boolean; }

function parseVcf(text: string): { name: string; phone: string }[] {
  const out: { name: string; phone: string }[] = [];
  for (const card of text.replace(/\r?\n[ \t]/g, "").split(/BEGIN:VCARD/i).slice(1)) {
    const fn = card.match(/^FN[^:\n]*:(.+)$/im)?.[1]?.trim();
    const n = card.match(/^N[^:\n]*:(.+)$/im)?.[1]?.split(";").filter(Boolean).reverse().join(" ").trim();
    const tel = card.match(/^(?:item\d+\.)?TEL[^:\n]*:(.+)$/im)?.[1]?.trim();
    const phone = tel ? normalisePhone(tel) : "";
    if ((fn || n) && phone) out.push({ name: (fn || n)!, phone });
  }
  return out;
}

function parseLines(text: string): { name: string; phone: string }[] {
  const rows = text.split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((c) => c.replace(/^"|"$/g, "").trim()));
  const head = rows[0]?.map((c) => c.toLowerCase()) ?? [];
  const hasHeader = head.some((c) => /name|phone|mobile|number/.test(c));
  let ni = 0, pi = 1;
  if (hasHeader) {
    ni = Math.max(0, head.findIndex((c) => c.includes("name")));
    pi = Math.max(0, head.findIndex((c) => /phone|mobile|number|tel/.test(c)));
  }
  return rows.slice(hasHeader ? 1 : 0).flatMap((r) => {
    let name = r[ni] ?? "", phone = r[pi] ?? "";
    if (!phone && /\d{8,}/.test(name)) { phone = name; name = ""; } // a line holding only a number
    const p = normalisePhone(phone);
    return p.length >= 11 && name ? [{ name, phone: p }] : [];
  });
}

function AddContacts({ existing, onAdd, onClose }: { existing: Guest[]; onAdd: (c: Candidate[]) => void; onClose: () => void }) {
  const [list, setList] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerOk = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;
  const have = new Set(existing.map((g) => g.phone));

  const stage = (rows: { name: string; phone: string }[]) => {
    const seen = new Set(list.map((c) => c.phone));
    const fresh: Candidate[] = [];
    for (const r of rows) {
      if (seen.has(r.phone) || have.has(r.phone)) continue;
      seen.add(r.phone);
      fresh.push({ id: uid("c"), ...r, picked: false });
    }
    setList([...list, ...fresh]);
    setNote(rows.length === 0 ? "No contacts with a phone number were found there." : `${fresh.length} new contact${fresh.length === 1 ? "" : "s"} found${rows.length - fresh.length ? `, ${rows.length - fresh.length} skipped as already added` : ""}. Tick the people you want to invite.`);
  };
  const fromPhone = async () => {
    try {
      const picked: { name?: string[]; tel?: string[] }[] = await (navigator as unknown as { contacts: { select: (p: string[], o: object) => Promise<{ name?: string[]; tel?: string[] }[]> } }).contacts.select(["name", "tel"], { multiple: true });
      stage(picked.flatMap((c) => (c.name?.[0] && c.tel?.[0] ? [{ name: c.name[0], phone: normalisePhone(c.tel[0]) }] : [])));
    } catch { setNote("Contact picking was cancelled or isn't allowed on this device."); }
  };
  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    stage(/BEGIN:VCARD/i.test(text) ? parseVcf(text) : parseLines(text));
    if (fileRef.current) fileRef.current.value = "";
  };

  const shown = list.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query));
  const picked = list.filter((c) => c.picked);
  const toggle = (id: string) => setList((l) => l.map((c) => (c.id === id ? { ...c, picked: !c.picked } : c)));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-7 space-y-4 max-h-[92dvh] overflow-y-auto" style={{ borderTop: "3px solid #c08a0c", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-medium text-gray-800">Add guests from contacts</h3>
            <p className="text-sm text-gray-700 mt-1">You choose exactly who to add. Contacts are read in your browser and are not uploaded anywhere.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl px-3 py-2 -mr-3 -mt-2" style={{ color: "#444" }}>✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button onClick={fromPhone} disabled={!pickerOk} className="rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-50" style={PRIMARY_BTN}>📱 Choose from phone contacts</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-xl px-4 py-3 text-sm font-medium" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>📇 Import a contacts file (.vcf or .csv)</button>
          <input ref={fileRef} type="file" accept=".vcf,.csv,.txt,text/vcard,text/csv,text/plain" className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />
        </div>
        {!pickerOk && <p className="text-xs text-gray-700">Phone-contact picking works in Chrome on Android. On an iPhone or a computer, export your contacts as a .vcf file (Contacts app, Share) and import it here.</p>}

        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: "#a8213b" }}>Or paste names and numbers</label>
          <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Asha Sharma, 98765 43210\nRohan Mehta, 91234 56789"}
            className="w-full rounded-xl px-4 py-3 text-base resize-none focus:outline-none" style={INPUT_STYLE} />
          <button onClick={() => { stage(parseLines(paste)); setPaste(""); }} disabled={!paste.trim()} className="mt-2 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Add these to the list below</button>
        </div>

        {note && <div className="text-sm text-gray-800 rounded-xl p-3" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>{note}</div>}

        {list.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" aria-label="Search contacts" className="flex-1 min-w-[10rem] rounded-xl px-4 py-2.5 text-base focus:outline-none bg-white" style={{ border: "1px solid #fbe8ec" }} />
              <button onClick={() => setList((l) => l.map((c) => (shown.includes(c) ? { ...c, picked: true } : c)))} className="rounded-xl px-4 py-2.5 text-sm" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Tick all shown</button>
              <button onClick={() => setList((l) => l.map((c) => ({ ...c, picked: false })))} className="rounded-xl px-4 py-2.5 text-sm text-gray-800" style={{ border: "1px solid #ddd" }}>Clear</button>
            </div>
            <ul className="max-h-64 overflow-y-auto rounded-xl divide-y" style={{ border: "1px solid #fbe8ec" }}>
              {shown.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-3 px-3 py-2.5 min-h-12 cursor-pointer">
                    <input type="checkbox" checked={c.picked} onChange={() => toggle(c.id)} className="w-5 h-5 accent-[#a8213b]" />
                    <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-gray-800 truncate">{c.name}</span><span className="block text-xs text-gray-700">{prettyPhone(c.phone)}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={() => { onAdd(picked); onClose(); }} disabled={picked.length === 0} className="w-full text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50" style={PRIMARY_BTN}>
          Add {picked.length || ""} selected guest{picked.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

// ── Sending ─────────────────────────────────────────────────────────────────────

function SendQueue({ guests, text, onSent, onClose }: { guests: Guest[]; text: (g: Guest) => string; onSent: (id: string, mode: "whatsapp" | "sms") => void; onClose: () => void }) {
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const link = (g: Guest) => channel === "whatsapp"
    ? `https://wa.me/${g.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text(g))}`
    : `sms:${g.phone}?body=${encodeURIComponent(text(g))}`;
  const send = (g: Guest) => { window.open(link(g), "_blank", "noopener"); setSent((s) => new Set(s).add(g.id)); onSent(g.id, channel); };
  const next = guests.find((g) => !sent.has(g.id));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-7 space-y-4 max-h-[92dvh] overflow-y-auto" style={{ borderTop: "3px solid #c08a0c", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-medium text-gray-800">Send from your phone</h3>
            <p className="text-sm text-gray-700 mt-1">Each tap opens the message ready to send to one guest. {sent.size} of {guests.length} opened.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl px-3 py-2 -mr-3 -mt-2" style={{ color: "#444" }}>✕</button>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="Send using">
          {(["whatsapp", "sms"] as const).map((c) => (
            <button key={c} role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
              style={channel === c ? { background: "#a8213b", color: "#fff" } : { border: "1px solid #f5c6d0", color: "#a8213b" }}>{c === "whatsapp" ? "WhatsApp" : "SMS"}</button>
          ))}
        </div>
        {next && <button onClick={() => send(next)} className="w-full text-white rounded-xl py-3.5 font-medium text-sm sparkle-btn" style={PRIMARY_BTN}>Send to {next.name} →</button>}
        {!next && <div className="text-center text-sm font-medium py-2" style={{ color: "#2f6b1f" }}>✓ All opened. Guests reply to you directly.</div>}
        <ul className="rounded-xl divide-y max-h-60 overflow-y-auto" style={{ border: "1px solid #fbe8ec" }}>
          {guests.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-gray-800 truncate">{g.name}</span><span className="block text-xs text-gray-700">{prettyPhone(g.phone)}</span></span>
              {sent.has(g.id) ? <span className="text-sm" style={{ color: "#2f6b1f" }}>✓ Opened</span>
                : <button onClick={() => send(g)} className="text-sm rounded-lg px-3 py-2" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Send</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── The page ────────────────────────────────────────────────────────────────────

export default function GuestsTab({ plan, guests, setGuests, onGuestCount }: {
  plan: WeddingPlan; guests: Guest[]; setGuests: (fn: (g: Guest[]) => Guest[]) => void; onGuestCount: (n: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [queue, setQueue] = useState<Guest[] | null>(null);
  const [filter, setFilter] = useState<Rsvp | "all">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<"invite" | "reminder">("invite");
  const [form, setForm] = useState({ name: "", phone: "", group: GROUPS[0] as GuestGroup });

  const couple = `${plan.name} & ${plan.partnerName}`;
  const events = plan.schedule.map((d, i) => `Day ${i + 1}, ${shortDay(d.date)}: ${d.rituals.join(", ") || "Celebrations"}`).join("\n");
  const inviteTemplate = `Namaste {name}! 🙏🏻 ${couple} are getting married and would love to have you with us.\n\n📅 ${events}\n📍 ${plan.location}\n\nPlease reply YES or NO, and how many people will come. With love, ${plan.name} & ${plan.partnerName}`;
  const reminderTemplate = `Hi {name}, a gentle reminder from ${couple}: we'd love to know if you can join us in ${plan.location} for the wedding on ${shortDay(plan.date)}. Please reply YES or NO, and how many people will come. Thank you!`;
  const [templates, setTemplates] = useState({ invite: inviteTemplate, reminder: reminderTemplate });
  const template = templates[kind];
  const textFor = (g: Guest) => template.replace(/\{name\}/g, g.name.split(" ")[0]);

  const counts = useMemo(() => {
    const c = { total: guests.length, invited: 0, yes: 0, no: 0, maybe: 0, headcount: 0 };
    guests.forEach((g) => {
      if (g.rsvp !== "not_invited") c.invited++;
      if (g.rsvp === "yes") { c.yes++; c.headcount += g.party; }
      if (g.rsvp === "no") c.no++;
      if (g.rsvp === "maybe") c.maybe++;
    });
    return c;
  }, [guests]);

  const shown = guests.filter((g) => filter === "all" || g.rsvp === filter);
  const targets = guests.filter((g) => picked.has(g.id));
  const update = (id: string, patch: Partial<Guest>) => setGuests((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const togglePick = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addManual = () => {
    const phone = normalisePhone(form.phone);
    if (!form.name.trim() || phone.length < 11) return;
    setGuests((gs) => (gs.some((g) => g.phone === phone) ? gs : [...gs, { id: uid("g"), name: form.name.trim(), phone, group: form.group, rsvp: "not_invited", party: 1 }]));
    setForm({ ...form, name: "", phone: "" });
  };
  const addCandidates = (cs: Candidate[]) => setGuests((gs) => [...gs, ...cs.map((c) => ({ id: uid("g"), name: c.name, phone: c.phone, group: GROUPS[0], rsvp: "not_invited" as Rsvp, party: 1 }))]);

  const markInvited = (id: string, mode: "whatsapp" | "sms" | "demo") =>
    setGuests((gs) => gs.map((g) => (g.id === id ? { ...g, rsvp: g.rsvp === "not_invited" ? "invited" : g.rsvp, invitedOn: isoDate(new Date()), inviteMode: mode } : g)));

  const selectWhere = (fn: (g: Guest) => boolean) => setPicked(new Set(guests.filter(fn).map((g) => g.id)));

  // Demo only: shows how replies would update the list once real messages and replies flow through the platform.
  const simulateReplies = () => setGuests((gs) => gs.map((g) => {
    if (g.rsvp !== "invited") return g;
    const n = [...g.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 10;
    return { ...g, rsvp: n < 6 ? "yes" : n < 8 ? "no" : "maybe", party: n < 6 ? 1 + (n % 3) : 1 };
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-gray-800">Guests & RSVP</h1>
        <p className="text-sm text-gray-600 mt-1">Choose who to invite, send the invitation, and keep track of who is coming.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "On your list", value: String(counts.total), color: "#a8213b" },
          { label: "Invited", value: String(counts.invited), color: "#7a5206" },
          { label: "Coming", value: `${counts.yes} (${counts.headcount} people)`, color: "#2f6b1f" },
          { label: "Can't come", value: String(counts.no), color: "#a8213b" },
          { label: "Maybe", value: String(counts.maybe), color: "#27457a" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 min-w-0" style={{ border: "1px solid #fbe8ec" }}>
            <div className="text-xs text-gray-600 mb-1">{s.label}</div>
            <div className="text-lg font-semibold break-words" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      {counts.headcount > 0 && counts.headcount !== plan.guestCount && (
        <div className="rounded-xl p-3 text-sm text-gray-800 flex items-center justify-between gap-3 flex-wrap" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
          <span>{counts.headcount} people have said yes so far, and your plan is for {plan.guestCount}.</span>
          <button onClick={() => onGuestCount(counts.headcount)} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: "#a8213b", border: "1px solid #a8213b", background: "#fff" }}>Use {counts.headcount} as my guest count</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        <div className="xl:col-span-7 space-y-4 min-w-0">
          <div className="bg-white rounded-2xl p-4 sm:p-6 space-y-3" style={{ border: "1px solid #fbe8ec" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-medium text-gray-700 text-sm">Add guests</h3>
              <button onClick={() => setAdding(true)} className="text-white rounded-xl px-5 py-2.5 text-sm font-medium" style={PRIMARY_BTN}>📇 Add from contacts</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 [&>*]:min-w-0">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Guest name" aria-label="Guest name" className="rounded-xl px-4 py-3 text-base focus:outline-none" style={INPUT_STYLE} />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Mobile number" inputMode="tel" aria-label="Mobile number" className="rounded-xl px-4 py-3 text-base focus:outline-none" style={INPUT_STYLE} />
              <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value as GuestGroup })} aria-label="Group" className="rounded-xl px-3 py-3 text-base bg-white" style={{ border: "1px solid #f5c6d0" }}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select>
              <button onClick={addManual} disabled={!form.name.trim() || normalisePhone(form.phone).length < 11} className="rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-50 min-h-12" style={{ color: "#a8213b", border: "1px solid #a8213b" }}>Add</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 space-y-3" style={{ border: "1px solid #fbe8ec" }}>
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
              {([["all", `All (${guests.length})`], ...(Object.keys(RSVP_LABEL) as Rsvp[]).map((k) => [k, `${RSVP_LABEL[k]} (${guests.filter((g) => g.rsvp === k).length})`])] as [string, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k as Rsvp | "all")} className="px-4 py-2 rounded-full text-sm font-medium"
                  style={filter === k ? { background: "#1a1a1a", color: "#fff" } : { background: "#fff", color: "#1a1a1a", border: "1px solid #ddd" }}>{label}</button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap text-sm">
              <button onClick={() => selectWhere((g) => g.rsvp === "not_invited")} className="rounded-lg px-3 py-2" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Select everyone not yet invited</button>
              <button onClick={() => selectWhere((g) => g.rsvp === "invited")} className="rounded-lg px-3 py-2" style={{ color: "#a8213b", border: "1px solid #f5c6d0" }}>Select those who haven't replied</button>
              <button onClick={() => setPicked(new Set())} className="rounded-lg px-3 py-2 text-gray-800" style={{ border: "1px solid #ddd" }}>Clear selection</button>
            </div>

            {guests.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-700">No guests yet. Add people above, or choose them from your contacts.</div>
            ) : (
              <ul className="space-y-2">
                {shown.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl p-3" style={{ background: picked.has(g.id) ? "#fffafb" : "#fdf8f0", border: picked.has(g.id) ? "1px solid #f5c6d0" : "1px solid #fbe8ec" }}>
                    <input type="checkbox" checked={picked.has(g.id)} onChange={() => togglePick(g.id)} aria-label={`Select ${g.name}`} className="w-5 h-5 accent-[#a8213b] shrink-0" />
                    <div className="flex-1 min-w-[8rem]">
                      <div className="text-sm font-semibold text-gray-800">{g.name}</div>
                      <div className="text-xs text-gray-700">{prettyPhone(g.phone)}{g.invitedOn ? ` · invited ${shortDay(g.invitedOn)}${g.inviteMode === "demo" ? " (demo)" : ""}` : ""}</div>
                    </div>
                    <select value={g.group} onChange={(e) => update(g.id, { group: e.target.value as GuestGroup })} aria-label={`Group for ${g.name}`} className="rounded-lg px-2 py-2 text-sm bg-white" style={{ border: "1px solid #fbe8ec" }}>{GROUPS.map((x) => <option key={x}>{x}</option>)}</select>
                    <select value={g.rsvp} onChange={(e) => update(g.id, { rsvp: e.target.value as Rsvp })} aria-label={`RSVP for ${g.name}`} className="rounded-lg px-2 py-2 text-sm font-medium" style={{ background: RSVP_STYLE[g.rsvp].bg, color: RSVP_STYLE[g.rsvp].fg, border: `1px solid ${RSVP_STYLE[g.rsvp].fg}` }}>
                      {(Object.keys(RSVP_LABEL) as Rsvp[]).map((k) => <option key={k} value={k}>{RSVP_LABEL[k]}</option>)}
                    </select>
                    {g.rsvp === "yes" && (
                      <label className="flex items-center gap-1 text-xs text-gray-700">People
                        <input type="number" min={1} max={20} value={g.party} onChange={(e) => update(g.id, { party: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="w-14 rounded-lg px-2 py-1.5 text-sm bg-white" style={{ border: "1px solid #fbe8ec" }} />
                      </label>
                    )}
                    <button onClick={() => { setGuests((gs) => gs.filter((x) => x.id !== g.id)); setPicked((s) => { const n = new Set(s); n.delete(g.id); return n; }); }} aria-label={`Remove ${g.name}`} className="text-lg px-2 py-1 text-gray-600">✕</button>
                  </li>
                ))}
                {shown.length === 0 && <li className="text-sm text-gray-700 py-4 text-center">No guests in this view.</li>}
              </ul>
            )}
          </div>
        </div>

        <div className="xl:col-span-5 space-y-4 min-w-0 xl:sticky xl:top-4">
          <div className="bg-white rounded-2xl p-4 sm:p-6 space-y-3" style={{ border: "2px solid #f5c6d0" }}>
            <div className="flex gap-2" role="tablist" aria-label="Message type">
              {(["invite", "reminder"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                  style={kind === k ? { background: "#a8213b", color: "#fff" } : { border: "1px solid #f5c6d0", color: "#a8213b" }}>{k === "invite" ? "Invitation" : "Reminder"}</button>
              ))}
            </div>
            <label className="text-xs font-medium uppercase tracking-wider block" style={{ color: "#a8213b" }}>Message ({"{name}"} becomes each guest's first name)</label>
            <textarea rows={9} value={template} onChange={(e) => setTemplates({ ...templates, [kind]: e.target.value })} className="w-full rounded-xl px-4 py-3 text-base resize-y focus:outline-none" style={INPUT_STYLE} />
            {(targets[0] ?? guests[0]) && (
              <div className="rounded-xl p-3 text-sm text-gray-800 whitespace-pre-wrap" style={{ background: "#f3faf0", border: "1px solid #cfe6c4" }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#2f6b1f" }}>Preview for {(targets[0] ?? guests[0]).name}</div>
                {textFor(targets[0] ?? guests[0])}
              </div>
            )}
            <button onClick={() => setQueue(targets)} disabled={targets.length === 0} className="w-full text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50 sparkle-btn" style={PRIMARY_BTN}>
              {targets.length ? `Send ${kind === "invite" ? "invitation" : "reminder"} to ${targets.length} guest${targets.length === 1 ? "" : "s"}` : "Tick the guests you want to message"}
            </button>
            <button onClick={simulateReplies} disabled={!guests.some((g) => g.rsvp === "invited")} className="w-full rounded-xl py-3 font-medium text-sm disabled:opacity-50 text-gray-800" style={{ border: "1px solid #ddd" }}>Simulate guest replies (demo)</button>
          </div>

          <div className="rounded-2xl p-4 sm:p-5 text-sm text-gray-800 leading-relaxed space-y-2" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
            <div className="font-semibold" style={{ color: "#a8213b" }}>How sending works today</div>
            <p>"Send" opens WhatsApp or SMS on your phone with the message ready for one guest at a time, so it goes from your own number and guests reply to you. Tap each guest's reply into the RSVP status above.</p>
            <p>One-click sending to everyone, with replies read automatically, needs the WhatsApp Business API (Meta approval, a per-message fee, and guests must have agreed to receive messages) or an SMS service. Until one is connected, invitations go out one tap at a time from your own phone.</p>
          </div>
        </div>
      </div>

      {adding && <AddContacts existing={guests} onAdd={addCandidates} onClose={() => setAdding(false)} />}
      {queue && <SendQueue guests={queue} text={textFor} onSent={(id, mode) => markInvited(id, mode)} onClose={() => setQueue(null)} />}
    </div>
  );
}

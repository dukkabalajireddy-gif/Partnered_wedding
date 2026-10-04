import { useState } from "react";
import { BLOG_IMAGES } from "./blogImages";

// Blog posts for the Blogs tab. Written as data so a new post is just a new entry.
// Photos are freely licensed pictures from Wikimedia Commons and carry their credit. Industry figures cite their sources.

type Block =
  | { t: "p"; text: string }
  | { t: "h"; text: string }
  | { t: "list"; items: string[] }
  | { t: "dest"; n: number; name: string; city?: string; tagline: string; blurb: string; bestFor: string; season: string; img: string }
  | { t: "figure"; img: string; caption: string }
  | { t: "story"; names: string; where: string; when: string; blurb: string; takeaway: string }
  | { t: "stat"; items: { value: string; label: string }[] }
  | { t: "sources"; items: { label: string; href: string }[] };

interface Post { id: string; title: string; kicker: string; minutes: number; cover: string; intro: string; body: Block[]; }

const POSTS: Post[] = [
  {
    id: "destinations",
    title: "Top 10 wedding destinations in India",
    kicker: "Destinations",
    minutes: 5,
    cover: "udaipur",
    intro: "Palaces on lakes, forts in the desert, houseboats on quiet backwaters. Ten places couples keep choosing, and who each one suits best.",
    body: [
      { t: "p", text: "Many of these places already have venues, caterers and decorators who do nothing but weddings, so a destination wedding is easier to plan than it sounds. Pick the setting first, then let the season and your guest list settle the rest. Seasons are general guidance, so check the weather for your exact dates." },
      { t: "dest", n: 1, name: "Udaipur, Rajasthan", city: "Udaipur", img: "udaipur", tagline: "Palaces that seem to float on water.", blurb: "Lake Pichola and the City Palace give you a backdrop that needs almost no decorating. Arrive by boat, hold the sangeet on a terrace over the water, and finish with a lake-view dinner.", bestFor: "Grand weddings with a few hundred guests", season: "October to March" },
      { t: "dest", n: 2, name: "Jaipur, Rajasthan", city: "Jaipur", img: "jaipur", tagline: "Pink-city forts, havelis and a big wedding industry.", blurb: "Courtyards and ramparts around Amer give you royal photographs, and the city has some of the most experienced wedding vendors in the country. Comparing quotes is easy here.", bestFor: "Large guest lists and first-time planners", season: "October to March" },
      { t: "dest", n: 3, name: "Jodhpur, Rajasthan", city: "Jodhpur", img: "jodhpur", tagline: "A fortress above a blue city.", blurb: "Mehrangarh Fort looms over the old town, and Umaid Bhawan Palace hosted one of the most talked-about weddings of 2018. Expect heavy stone, deep colours and serious drama.", bestFor: "Couples who want a regal, photogenic setting", season: "October to March" },
      { t: "dest", n: 4, name: "Jaisalmer, Rajasthan", city: "Jaisalmer", img: "jaisalmer", tagline: "Golden sandstone and desert nights.", blurb: "The fort glows at sunset and desert camps sleep your guests under the stars. Cold nights make bonfire sangeets unforgettable. Guests stay together for several days.", bestFor: "Smaller, immersive weddings", season: "November to February" },
      { t: "dest", n: 5, name: "Goa", city: "Goa", img: "goa", tagline: "Barefoot ceremonies and sunset parties.", blurb: "Palm-lined beaches, easy flights and plenty of resorts. It suits a relaxed celebration where the baraat is a beach walk and the dance floor is the sand. Avoid the monsoon.", bestFor: "Friends-and-family weddings, informal and fun", season: "November to February" },
      { t: "dest", n: 6, name: "Alleppey, Kerala", city: "Alleppey", img: "alleppey", tagline: "Houseboats, coconut palms and quiet water.", blurb: "Resorts line the backwaters, and guests can float between events on houseboats. Calm, green and very photogenic, it works best when the group is small.", bestFor: "Intimate weddings", season: "October to February" },
      { t: "dest", n: 7, name: "Rishikesh, Uttarakhand", city: "Rishikesh", img: "rishikesh", tagline: "Ceremonies beside the Ganga.", blurb: "Evening aarti, the Laxman Jhula bridge and riverside camps give a spiritual feel. Check local rules before you plan the menu and bar: alcohol and non-veg food are restricted in parts of the town.", bestFor: "Spiritual, low-key celebrations", season: "February to April, September to November" },
      { t: "dest", n: 8, name: "Mussoorie, Uttarakhand", city: "Mussoorie", img: "mussoorie", tagline: "Cool air and mountain views.", blurb: "A hill-station wedding with misty mornings and warm lanterns in the evening, reachable by road from Delhi and Dehradun. Keep a covered backup space in case of rain.", bestFor: "Guests who want an escape from the plains", season: "March to June, September to November" },
      { t: "dest", n: 9, name: "Hyderabad, Telangana", city: "Hyderabad", img: "hyderabad", tagline: "Nizam-era palaces and some of India's best food.", blurb: "Heritage venues around Charminar and old palaces turned hotels, with a wedding feast to match. A strong choice when food is the star of your celebration.", bestFor: "Food-loving families and heritage venues", season: "October to February" },
      { t: "dest", n: 10, name: "Kochi, Kerala", city: "Kochi", img: "kochi", tagline: "Old-world Fort Kochi by the sea.", blurb: "Heritage hotels, the famous Chinese fishing nets and church-and-temple traditions side by side, with the backwaters an easy drive away.", bestFor: "Mixed-tradition families and heritage lovers", season: "October to February" },
      { t: "h", text: "How to choose" },
      { t: "list", items: [
        "Guest list size: forts and palaces suit 150 or more guests; desert camps and backwater resorts suit smaller groups.",
        "Travel: count how many guests need flights and how many nights they will stay. Travel often costs more than the venue.",
        "Menu and rules: if your wedding is vegetarian only, ask venues about their kitchens and local rules early.",
        "Season: peak months sell out early and cost more. Shoulder months can save a lot.",
        "Local vendors: a city with many established wedding vendors, like Jaipur or Hyderabad, makes comparing quotes easier.",
      ] },
    ],
  },
  {
    id: "industry-tech",
    title: "The wedding industry boom, and how technology is changing it",
    kicker: "Industry",
    minutes: 4,
    cover: "industry",
    intro: "Indian weddings are one of the country's biggest consumer categories, and planning them is still mostly done by phone calls and WhatsApp.",
    body: [
      { t: "stat", items: [
        { value: "$130 bn", label: "estimated size of the Indian wedding industry" },
        { value: "8-10 mn", label: "weddings a year" },
        { value: "~₹12 lakh", label: "estimated average spend per wedding" },
      ] },
      { t: "p", text: "Those figures come from a 2024 Jefferies report as covered in the press. It puts India's wedding market at nearly double the size of the United States, though smaller than China, and second only to food and grocery among consumer spending categories. Estimates differ between sources, so read them as a sense of scale rather than an exact count." },
      { t: "figure", img: "industry", caption: "A decorated mandap. Decor, venue and catering are where most wedding money goes." },
      { t: "h", text: "Why planning is still hard" },
      { t: "list", items: [
        "Fragmented vendors: most photographers, decorators and caterers are small businesses, found through word of mouth.",
        "Opaque pricing: quotes arrive over calls and chats, in different formats, so comparing is slow.",
        "Many moving parts: a multi-day wedding means dozens of bookings, deposits and dates to track.",
        "Budgets drift: a small overspend in one category quietly eats into another.",
      ] },
      { t: "h", text: "Where technology is helping" },
      { t: "list", items: [
        "Marketplaces and listings: vendors become searchable by city, category and budget.",
        "AI planning assistants: turning a goal like a total budget and guest count into a sensible category split and a shortlist.",
        "Messaging and voice: enquiries and follow-ups handled in the channels vendors already use, including voice in local languages.",
        "Digital payments: payment links and staged deposits replace cash handovers, and give couples a record of what was paid.",
        "Logistics tracking: knowing where shipments, outfits and gifts are on the way to the venue.",
      ] },
      { t: "h", text: "What this means for couples" },
      { t: "p", text: "The goal is not to remove the human touch, which is the heart of a wedding, but to remove the busywork around it: chasing replies, comparing quotes and tracking money. That is the problem Partnered is designed around." },
      { t: "sources", items: [
        { label: "The Week: Weddings now a $130 billion industry", href: "https://www.theweek.in/news/biz-tech/2024/06/25/weddings-now-a-dollar130-billion-industry-expenses-only-seen-going-up-disproportionately-in-most-cases.amp.html" },
        { label: "Outlook Business: Story in numbers, Big Fat Indian Wedding", href: "https://www.outlookbusiness.com/economy-and-policy/story-in-numbers-big-fat-indian-wedding" },
      ] },
    ],
  },
  {
    id: "celebrity",
    title: "Celebrity weddings and what couples can learn from them",
    kicker: "Stories",
    minutes: 4,
    cover: "celebrity",
    intro: "Five well-known weddings, each with a different style, and one idea from each that works at any budget.",
    body: [
      { t: "story", names: "Virat Kohli and Anushka Sharma", where: "Tuscany, Italy", when: "December 2017",
        blurb: "A small, private ceremony abroad, with the news shared after the event rather than before.",
        takeaway: "A short guest list lets you spend more per guest and keep the day personal." },
      { t: "story", names: "Deepika Padukone and Ranveer Singh", where: "Lake Como, Italy", when: "November 2018",
        blurb: "Two ceremonies on consecutive days, honouring both of their families' traditions.",
        takeaway: "Give each family's rituals their own space instead of squeezing them into one day." },
      { t: "story", names: "Priyanka Chopra and Nick Jonas", where: "Umaid Bhawan Palace, Jodhpur", when: "December 2018",
        blurb: "Christian and Hindu ceremonies held back to back at a palace hotel, with a multi-day guest programme.",
        takeaway: "A venue with rooms on site keeps families together and cuts transport planning." },
      { t: "story", names: "Katrina Kaif and Vicky Kaushal", where: "Six Senses Fort Barwara, Rajasthan", when: "December 2021",
        blurb: "A fort resort with tight privacy arrangements and a compact, close-family guest list.",
        takeaway: "Booking an entire property for a few days gives you control over privacy and schedule." },
      { t: "story", names: "Kiara Advani and Sidharth Malhotra", where: "Suryagarh, Jaisalmer", when: "February 2023",
        blurb: "A desert palace wedding with a small, close group of guests.",
        takeaway: "A distinctive setting does much of the decorating for you, so you can spend less on styling." },
      { t: "h", text: "The common thread" },
      { t: "list", items: [
        "Every one of these couples chose a place that fit their guest list, not the other way round.",
        "Most kept the guest list small or the schedule well organised, which is what keeps a big day calm.",
        "Spending was concentrated on a few things they cared about, such as the venue, the food and the photography.",
      ] },
      { t: "p", text: "Details of these weddings come from public reports and the couples' own announcements. Your wedding doesn't need a palace, only a plan that matches what matters to you both." },
    ],
  },
];

// A photo with its credit, as a link to the file's page on Wikimedia Commons.
function Credit({ img, light = false }: { img: string; light?: boolean }) {
  const i = BLOG_IMAGES[img];
  if (!i) return null;
  return (
    <a href={i.page} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: light ? "rgba(255,255,255,0.85)" : "#555" }}>
      Photo: {i.credit} · Wikimedia Commons
    </a>
  );
}

function Article({ post, onBack, onBrowseCity }: { post: Post; onBack: () => void; onBrowseCity: (city: string) => void }) {
  const cover = BLOG_IMAGES[post.cover];
  return (
    <article className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-5 sm:space-y-6">
      <button onClick={onBack} className="text-base font-medium py-2" style={{ color: "#a8213b" }}>← All blogs</button>

      <header className="rounded-3xl overflow-hidden relative text-white" style={{ background: "#3a0f1a" }}>
        {cover && <img src={cover.src} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(58,15,26,0.35) 0%, rgba(58,15,26,0.92) 100%)" }} />
        <div className="relative p-6 sm:p-10 pt-28 sm:pt-44">
          <div className="text-sm uppercase tracking-wider" style={{ color: "#f5d98a" }}>{post.kicker} · {post.minutes} min read</div>
          <h1 className="text-2xl sm:text-4xl font-medium mt-2 leading-tight">{post.title}</h1>
          <p className="mt-3 text-base sm:text-lg opacity-95 leading-relaxed">{post.intro}</p>
          <div className="mt-3"><Credit img={post.cover} light /></div>
        </div>
      </header>

      <div className="bg-white rounded-3xl p-5 sm:p-8 space-y-5" style={{ border: "1px solid #fbe8ec" }}>
        {post.body.map((b, i) => {
          switch (b.t) {
            case "p": return <p key={i} className="text-base text-gray-800 leading-relaxed">{b.text}</p>;
            case "h": return <h2 key={i} className="text-xl sm:text-2xl font-medium pt-2" style={{ color: "#a8213b" }}>{b.text}</h2>;
            case "list": return (
              <ul key={i} className="space-y-2.5">
                {b.items.map((it) => (
                  <li key={it} className="flex gap-3 text-base text-gray-800 leading-relaxed">
                    <span style={{ color: "#c08a0c" }} aria-hidden="true">✦</span><span>{it}</span>
                  </li>
                ))}
              </ul>
            );
            case "stat": return (
              <div key={i} className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
                {b.items.map((s) => (
                  <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: "linear-gradient(135deg, #fdf2f4, #fefdf0)", border: "1px solid #f5c6d0" }}>
                    <div className="text-2xl font-semibold" style={{ color: "#a8213b" }}>{s.value}</div>
                    <div className="text-sm text-gray-700 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            );
            case "figure": return (
              <figure key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid #fbe8ec" }}>
                <img src={BLOG_IMAGES[b.img]?.src} alt={b.caption} loading="lazy" className="w-full h-56 sm:h-72 object-cover" />
                <figcaption className="px-4 py-3 text-sm text-gray-700" style={{ background: "#fdf8f0" }}>{b.caption} <Credit img={b.img} /></figcaption>
              </figure>
            );
            case "dest": return (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid #fbe8ec", background: "#fff" }}>
                <div className="relative">
                  <img src={BLOG_IMAGES[b.img]?.src} alt={`${b.name}`} loading="lazy" className="w-full h-52 sm:h-64 object-cover" style={{ background: "#fdf2f4" }} />
                  <span className="absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold text-white" style={{ background: "#a8213b", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>{b.n}</span>
                </div>
                <div className="p-4 sm:p-5 space-y-3">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-medium text-gray-800">{b.name}</h3>
                    <div className="text-base font-medium mt-0.5" style={{ color: "#9a6a0a" }}>{b.tagline}</div>
                  </div>
                  <p className="text-base text-gray-800 leading-relaxed">{b.blurb}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-xl px-3 py-2" style={{ background: "#fdf2f4" }}><div className="text-xs uppercase tracking-wider text-gray-700">Best for</div><div className="text-sm font-medium text-gray-800">{b.bestFor}</div></div>
                    <div className="rounded-xl px-3 py-2" style={{ background: "#fff7d6" }}><div className="text-xs uppercase tracking-wider text-gray-700">Season</div><div className="text-sm font-medium text-gray-800">{b.season}</div></div>
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {b.city
                      ? <button onClick={() => onBrowseCity(b.city!)} className="text-sm font-medium rounded-xl px-4 py-2.5 min-h-11 text-white" style={{ background: "linear-gradient(135deg, #a8213b, #881a30)" }}>Browse vendors in {b.city} →</button>
                      : <span />}
                    <Credit img={b.img} />
                  </div>
                </div>
              </div>
            );
            case "story": return (
              <div key={i} className="rounded-2xl p-4 sm:p-5" style={{ background: "#fdf8f0", border: "1px solid #fbe8ec" }}>
                <h3 className="text-lg font-medium text-gray-800">{b.names}</h3>
                <div className="text-sm text-gray-700 mt-0.5">📍 {b.where} · {b.when}</div>
                <p className="text-base text-gray-800 leading-relaxed mt-2">{b.blurb}</p>
                <div className="mt-3 rounded-xl p-3 text-base text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
                  <span className="font-semibold" style={{ color: "#7a5206" }}>Takeaway: </span>{b.takeaway}
                </div>
              </div>
            );
            case "sources": return (
              <div key={i} className="pt-2 text-sm text-gray-700" style={{ borderTop: "1px solid #fbe8ec" }}>
                <div className="font-medium mb-1">Sources</div>
                <ul className="space-y-1">
                  {b.items.map((s) => <li key={s.href}><a href={s.href} target="_blank" rel="noreferrer" className="underline" style={{ color: "#a8213b" }}>{s.label}</a></li>)}
                </ul>
              </div>
            );
          }
        })}
      </div>
    </article>
  );
}

export default function BlogsTab({ onBrowseCity }: { onBrowseCity: (city: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = POSTS.find((p) => p.id === openId);
  if (open) return <Article post={open} onBack={() => setOpenId(null)} onBrowseCity={onBrowseCity} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-gray-800">Blogs</h1>
        <p className="text-sm text-gray-600 mt-1">Ideas, guides and advice for planning your shaadi.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {POSTS.map((p) => {
          const c = BLOG_IMAGES[p.cover];
          return (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="text-left bg-white rounded-2xl overflow-hidden transition-all hover:shadow-md flex flex-col" style={{ border: "1px solid #fbe8ec" }}>
              <div className="relative h-44" style={{ background: "#fdf2f4" }}>
                {c && <img src={c.small} alt="" loading="lazy" className="w-full h-full object-cover" />}
                <span className="absolute top-3 left-3 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.94)", color: "#a8213b" }}>{p.kicker}</span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-700">{p.minutes} min read</div>
                <h2 className="text-xl font-medium text-gray-800 mt-1 leading-snug">{p.title}</h2>
                <p className="text-sm text-gray-700 mt-2 leading-relaxed flex-1">{p.intro}</p>
                <div className="mt-4 text-sm font-medium" style={{ color: "#a8213b" }}>Read more →</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

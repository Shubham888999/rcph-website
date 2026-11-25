// Every event that has its own story page. Plain data only (no components or CSS), because
// the SEO build script and the sitemap test import this file in Node.
//
// To add an event page:
// 1. Add an entry here (newest first is not required; the gallery sorts by date).
// 2. Add its component to eventStoryLoaders.js under the same slug.
// 3. Add its path to public/sitemap.xml (a test checks this).
//
// `match` links the page to an event in BOD Tools by its exact name and date, so the calendar
// and the events list show "Read the story" for it. Leave it null until the event is reported.
// `projectTitle` does the same for a card on the Projects page.

export const EVENT_STORIES_PATH = "/events/stories";

export const eventStories = Object.freeze([
  {
    slug: "diwali-pahat-2026",
    title: "Diwali Pahat",
    date: "2026-11-10",
    avenues: ["CSD"],
    place: "Sarasbaug, Pune",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "A festive Padwa morning: members gathered at Sarasbaug at dawn, then headed to Bangalore Tiffin Room for breakfast.",
    seoTitle: "Diwali Pahat at Sarasbaug: Padwa Morning 2026 | RCPH",
    seoDescription:
      "Rotaract Club of Pune Heritage celebrated Diwali Pahat on the morning of Padwa at Sarasbaug, Pune, followed by breakfast at Bangalore Tiffin Room.",
    image: "/media/event-stories/diwali-pahat-2026/share.jpg",
    imageAlt: "RCPH members in festive outfits on the morning of Diwali Pahat",
    card: { background: "linear-gradient(180deg, #f2a7b5, #f4a259 55%, #ffe8a3)", color: "#7a1f3d" },
    motif: "sunrise",
    cover: { src: "/media/event-stories/diwali-pahat-2026/card.webp", small: "/media/event-stories/diwali-pahat-2026/card-640.webp", tint: "rgba(20, 10, 40, 0.15)", color: "#ffffff" },
    match: { name: "Diwali Pahat", date: "2026-11-10" },
    projectTitle: null,
  },
  {
    slug: "patakhas-assemble-2026",
    title: "Patakhas Assemble",
    date: "2026-11-13",
    avenues: ["CSD"],
    place: "Pune",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "Our Diwali party, where members celebrated the festival with a Bollywood Trivia game and a lovely dinner.",
    seoTitle: "Patakhas Assemble: Diwali Party 2026 | RCPH",
    seoDescription:
      "Rotaract Club of Pune Heritage celebrated Diwali 2026 with Patakhas Assemble, an evening of Bollywood Trivia, dinner and festive fun in Pune.",
    image: "/media/event-stories/patakhas-assemble-2026/share.jpg",
    imageAlt: "RCPH members in festive outfits at the Patakhas Assemble Diwali party",
    card: { background: "radial-gradient(circle at 70% 20%, #b3122d, #12061c 70%)", color: "#ffcf70" },
    motif: "sparkles",
    cover: { src: "/media/event-stories/patakhas-assemble-2026/card.webp", small: "/media/event-stories/patakhas-assemble-2026/card-640.webp", tint: "rgba(10, 4, 20, 0.15)", color: "#ffd166" },
    match: { name: "Patakhas Assemble", date: "2026-11-13" },
    projectTitle: null,
  },
  {
    slug: "couch-champions-2026",
    title: "Couch Champions",
    date: "2026-10-24",
    avenues: ["CSD"],
    place: "Online",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "An online game night where members played different games together, with plenty of friendly competition and laughter.",
    seoTitle: "Couch Champions: Online Game Night 2026 | RCPH",
    seoDescription:
      "Rotaract Club of Pune Heritage members came together online for Couch Champions, an evening of games, friendly competition and laughter.",
    image: "/media/event-stories/couch-champions-2026/share.jpg",
    imageAlt: "Online game night screenshot from Couch Champions",
    card: { background: "linear-gradient(135deg, #0d0a24, #3a0ca3)", color: "#7ef9ff" },
    motif: "pixels",
    cover: { src: "/media/event-stories/couch-champions-2026/card.webp", small: "/media/event-stories/couch-champions-2026/card-640.webp", tint: "rgba(20, 8, 50, 0.25)", color: "#7ef9ff" },
    match: { name: "Couch Champions", date: "2026-10-24" },
    projectTitle: null,
  },
  {
    slug: "rotary-club-assembly-2026",
    title: "Rotary Club Assembly",
    date: "2026-10-25",
    avenues: ["RRRO"],
    place: "Pune",
    hostedBy: "Rotary Club of Pune Heritage",
    summary:
      "RCPH's President and Secretary joined the Rotary Club of Pune Heritage's Club Assembly to review progress and plan joint Rotary–Rotaract projects.",
    seoTitle: "Rotary Club Assembly 2026: Rotary and Rotaract Planning | RCPH",
    seoDescription:
      "The President and Secretary of Rotaract Club of Pune Heritage attended the Rotary Club of Pune Heritage Club Assembly to review progress and plan joint projects.",
    image: "/media/event-stories/rotary-club-assembly-2026/share.jpg",
    imageAlt: "Rotary and Rotaract members of Pune Heritage on stage at the Club Assembly",
    card: { background: "linear-gradient(180deg, #f7a81b 0 0.5rem, #0c2a5c 0.5rem)", color: "#ffffff" },
    motif: "gears",
    cover: { src: "/media/event-stories/rotary-club-assembly-2026/card.webp", small: "/media/event-stories/rotary-club-assembly-2026/card-640.webp", tint: "rgba(8, 24, 70, 0.3)", color: "#ffffff" },
    match: { name: "Rotary Club Assembly", date: "2026-10-25" },
    projectTitle: null,
  },
  {
    slug: "rooted-2026",
    title: "ROOTED",
    date: "2026-10-13",
    avenues: ["PDD"],
    place: "S.P. Junior College, Pune",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "An interactive gardening workshop with S.P. Junior College's Environment Department: hands-on potting, myth-busting and sustainable plant care with 60+ participants.",
    seoTitle: "ROOTED: Gardening Workshop at S.P. Junior College | RCPH",
    seoDescription:
      "Rotaract Club of Pune Heritage and S.P. Junior College's Environment Department held ROOTED, a hands-on gardening workshop for 60+ participants in Pune.",
    image: "/media/event-stories/rooted-2026/share.jpg",
    imageAlt: "Participants holding potted saplings at the ROOTED gardening workshop",
    card: { background: "linear-gradient(160deg, #6bb35f, #2e1d13 85%)", color: "#f4ecdc" },
    motif: "leaves",
    cover: { src: "/media/event-stories/rooted-2026/card.webp", small: "/media/event-stories/rooted-2026/card-640.webp", tint: "rgba(40, 24, 10, 0.3)", color: "#f4ecdc" },
    match: { name: "ROOTED", date: "2026-10-13" },
    projectTitle: null,
  },
  {
    slug: "mahadaan-drive-2-2026",
    title: "Mahadaan 12.0 · Drive 2",
    date: "2026-10-03",
    avenues: ["CMD", "RRRO"],
    place: "Royal KP Stellar Society, NIBM Road, Pune",
    hostedBy: "Rotary Club of Pune Heritage",
    summary:
      "The second Mahadaan 12.0 drive collected 23 bags of clothes, 63 kg of food grains, daily-use items and Rs. 7,202 at Royal KP Stellar Society.",
    seoTitle: "Mahadaan 12.0 Drive 2: Donation Drive on NIBM Road | RCPH",
    seoDescription:
      "The second Mahadaan 12.0 drive by the Rotary and Rotaract Clubs of Pune Heritage collected 23 bags of clothes, 63 kg of food grains, daily-use items and Rs. 7,202 in Pune.",
    image: "/media/event-stories/mahadaan-drive-2-2026/share.jpg",
    imageAlt: "Rotarians and Rotaractors with the Mahadaan banner at Royal KP Stellar Society",
    card: { background: "linear-gradient(135deg, #e8731a, #7a1f2b)", color: "#fbf3e2" },
    motif: "sacks",
    cover: { src: "/media/event-stories/mahadaan-drive-2-2026/card.webp", small: "/media/event-stories/mahadaan-drive-2-2026/card-640.webp", tint: "rgba(251, 243, 226, 0.6)", color: "#7a1f2b" },
    match: { name: "Mahadaan 12.0 Drive 2", date: "2026-10-03" },
    projectTitle: null,
  },
  {
    slug: "mahadaan-drive-1-2026",
    title: "Mahadaan 12.0 · Drive 1",
    date: "2026-09-27",
    avenues: ["CMD", "RRRO"],
    place: "Padmavati Hills, Bavdhan, Pune",
    hostedBy: "Rotary Club of Pune Heritage",
    summary:
      "The first Mahadaan 12.0 drive, held during Pitru Paksha, collected 28 bags of clothes, 15 kg of food grains and Rs. 2,600 for welfare organisations.",
    seoTitle: "Mahadaan 12.0 Drive 1: Donation Drive in Bavdhan | RCPH",
    seoDescription:
      "During Pitru Paksha, the Rotary and Rotaract Clubs of Pune Heritage collected 28 bags of clothes, 15 kg of food grains and Rs. 2,600 at Padmavati Hills, Bavdhan, for welfare organisations.",
    image: "/media/event-stories/mahadaan-drive-1-2026/share.jpg",
    imageAlt: "RCPH members beside a truck loaded with Mahadaan donations",
    card: { background: "linear-gradient(135deg, #e8731a, #7a1f2b)", color: "#fbf3e2" },
    motif: "sacks",
    cover: { src: "/media/event-stories/mahadaan-drive-1-2026/card.webp", small: "/media/event-stories/mahadaan-drive-1-2026/card-640.webp", tint: "rgba(251, 243, 226, 0.5)", color: "#7a1f2b" },
    match: { name: "Mahadaan 12.0", date: "2026-09-27" },
    projectTitle: null,
  },
  {
    slug: "gajasanskruti-2026",
    title: "Gajasanskruti 10.0",
    date: "2026-09-26",
    avenues: ["ISD", "CMD", "RRRO"],
    place: "Pune",
    hostedBy: "Rotaract Club of Pune Mideast",
    summary:
      "A city cleanliness drive with 148 volunteers from 31 Rotaract clubs and 2 Rotary clubs, who filled 90 bags of garbage across four areas of Pune.",
    seoTitle: "Gajasanskruti 10.0: Pune Cleanliness Drive | RCPH",
    seoDescription:
      "RCPH joined Gajasanskruti 10.0, a cleanliness drive by the Rotaract Club of Pune Mideast: 148 volunteers from 31 Rotaract clubs cleaned FC Road, Karve Road, Nadiapatra and Deccan Gymkhana.",
    image: "/media/event-stories/gajasanskruti-2026/share.jpg",
    imageAlt: "Volunteers from many clubs after the Gajasanskruti cleanliness drive in Pune",
    card: { background: "linear-gradient(180deg, #1f8a5b 0 72%, #3b3f45 72%)", color: "#ffffff" },
    motif: "road",
    cover: { src: "/media/event-stories/gajasanskruti-2026/card.webp", small: "/media/event-stories/gajasanskruti-2026/card-640.webp", tint: "rgba(10, 30, 20, 0.35)", color: "#ffffff" },
    match: { name: "Gajasanskruti 10.0", date: "2026-09-26" },
    projectTitle: null,
  },
  {
    slug: "dine-and-unwind-2026",
    title: "Dine & Unwind",
    date: "2026-09-13",
    avenues: ["CSD"],
    place: "Pune",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "A club dinner where everyone could interact, bond and spend quality time together outside regular club activities.",
    seoTitle: "Dine & Unwind: Club Dinner 2026 | RCPH",
    seoDescription:
      "Members of Rotaract Club of Pune Heritage got together for Dine & Unwind, a relaxed club dinner in Pune to bond outside regular club activities.",
    image: "/media/event-stories/dine-and-unwind-2026/share.jpg",
    imageAlt: "RCPH members smiling in a group selfie after the Dine & Unwind dinner",
    card: { background: "radial-gradient(circle at 50% 50%, #8a2236, #4a0f1c 80%)", color: "#fbf6ec" },
    motif: "cutlery",
    cover: { src: "/media/event-stories/dine-and-unwind-2026/card.webp", small: "/media/event-stories/dine-and-unwind-2026/card-640.webp", tint: "rgba(30, 12, 6, 0.3)", color: "#fff6e8" },
    match: { name: "Dine & Unwind", date: "2026-09-13" },
    projectTitle: null,
  },
  {
    slug: "misal-brunch-2026",
    title: "Misal Brunch",
    date: "2026-09-19",
    avenues: ["ISD", "CSD"],
    place: "Pune Misal House, Pune",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "During Samyati 4.0, delegates from RID 3191, Bangalore, joined RCPH for a Misal Brunch celebrating Pune's iconic food culture.",
    seoTitle: "Misal Brunch with RID 3191 Delegates, Samyati 4.0 | RCPH",
    seoDescription:
      "Rotaract Club of Pune Heritage welcomed delegates from RID 3191, Bangalore, to a Misal Brunch during Samyati 4.0, celebrating Pune's iconic Misal Pav and interdistrict fellowship.",
    image: "/media/event-stories/misal-brunch-2026/share.jpg",
    imageAlt: "RCPH members and RID 3191 delegates outside Pune Misal House",
    card: { background: "linear-gradient(135deg, #c62d17, #7d1a0c)", color: "#f2b84b" },
    motif: "steam",
    cover: { src: "/media/event-stories/misal-brunch-2026/card.webp", small: "/media/event-stories/misal-brunch-2026/card-640.webp", tint: "rgba(60, 10, 0, 0.25)", color: "#ffffff" },
    match: { name: "Misal Brunch", date: "2026-09-19" },
    projectTitle: null,
  },
  {
    slug: "concord-2026",
    title: "CONCORD",
    date: "2026-09-06",
    avenues: ["CMD", "PDD", "DEI"],
    place: "Pune",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "The Peace Roundtable: an interactive forum on peacebuilding and conflict prevention, with discussions, a Situation Lab and a roundtable, alongside four Rotaract clubs.",
    seoTitle: "CONCORD: The Peace Roundtable | RCPH",
    seoDescription:
      "CONCORD by Rotaract Club of Pune Heritage explored peace from the individual to the global level through discussions, a Situation Lab and a Peace Roundtable in Pune.",
    image: "/media/event-stories/concord-2026/share.jpg",
    imageAlt: "Participants making peace signs at CONCORD, The Peace Roundtable",
    card: { background: "radial-gradient(circle at 50% 50%, #ffffff 0 18%, #c7ddf2 19% 38%, #8db6df 39% 58%, #2f6fb3 59%)", color: "#17325a" },
    motif: "olive",
    cover: { src: "/media/event-stories/concord-2026/card.webp", small: "/media/event-stories/concord-2026/card-640.webp", tint: "rgba(255, 255, 255, 0.35)", color: "#17325a" },
    match: { name: "CONCORD : The Peace Roundtable", date: "2026-09-06" },
    projectTitle: null,
  },
  {
    slug: "wings-of-honour-2026",
    title: "Wings of Honour",
    date: "2026-10-08",
    avenues: ["ISD", "PRO", "DEI"],
    place: "Instagram, across 6 Rotaract districts",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "A multi-district tribute campaign on Indian Air Force Day, where RCPH and 13 collaborating clubs thanked the heroes who guard our skies, each in their own mother tongue.",
    seoTitle: "Wings of Honour: Indian Air Force Day Tribute | RCPH",
    seoDescription:
      "On the 94th Indian Air Force Day, Rotaract Club of Pune Heritage and 13 clubs from 6 districts thanked the Indian Air Force in 11 languages.",
    image: "/media/wings-of-honour/00-banner-card.webp",
    imageAlt: "Wings of Honour campaign banner: A Salute to Guardians of the Skies",
    card: { background: "linear-gradient(135deg, #0c1b2c, #1d344e)", color: "#e7c58f" },
    motif: "flight",
    cover: { src: "/media/event-stories/wings-of-honour-2026/card.webp", small: "/media/event-stories/wings-of-honour-2026/card-640.webp", tint: "rgba(8, 16, 40, 0.25)", color: "#e7c58f" },
    match: { name: "Wings of Honour", date: "2026-10-08" },
    projectTitle: null,
  },
  {
    slug: "mens-day-2026",
    title: "From Us, To Him",
    date: "2026-11-19",
    avenues: ["CSD"],
    place: "Pune",
    hostedBy: "Rotaract Club of Pune Heritage",
    summary:
      "For International Men's Day, the club wrote a note for every man at Heritage. Here they are, pinned up and left unsigned.",
    seoTitle: "From Us, To Him: International Men's Day 2026 | RCPH",
    seoDescription:
      "Anonymous notes of appreciation written for the men of Rotaract Club of Pune Heritage on International Men's Day 2026.",
    image: null,
    imageAlt: null,
    card: { background: "#a9784a", color: "#fff4dc" },
    motif: "notes",
    cover: { src: "/media/event-stories/mens-day-2026/card.webp", small: "/media/event-stories/mens-day-2026/card-640.webp", tint: "rgba(60, 30, 10, 0.5)", color: "#ffffff" },
    match: null,
    projectTitle: null,
  },
]);

export function storyPath(story) {
  return `/events/${story.slug}`;
}

// Colours for a story card: the AI cover image (with a see-through tint) when there is one,
// otherwise the card's gradient.
export function cardStyle(story) {
  if (story.cover) {
    return {
      color: story.cover.color,
      backgroundImage: `linear-gradient(${story.cover.tint}, ${story.cover.tint}), url("${story.cover.small}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: story.card.background, color: story.card.color };
}

export function getEventStory(slug) {
  return eventStories.find((story) => story.slug === slug) || null;
}

export function storiesNewestFirst() {
  return [...eventStories].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function normalizeName(value) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "";
}

// Finds the story page for an event from BOD Tools (calendar, events list), if it has one.
export function findStoryForEvent(event) {
  if (!event) return null;
  const name = normalizeName(event.name);
  if (!name) return null;
  return eventStories.find((story) => story.match
    && story.match.date === event.date
    && normalizeName(story.match.name) === name) || null;
}

// Finds the story page for a card on the Projects page, if it has one.
export function findStoryForProject(project) {
  const title = normalizeName(project?.title);
  if (!title) return null;
  return eventStories.find((story) => story.projectTitle && normalizeName(story.projectTitle) === title) || null;
}

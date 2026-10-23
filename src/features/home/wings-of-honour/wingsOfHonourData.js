// Everything event-specific for the homepage tribute section lives here.
// To feature a different event, replace the values below; the components only read this file.

const MEDIA_ROOT = "/media/wings-of-honour";

export const SECTION_ID = "wings-of-honour";

// Paste the Instagram Highlight link here. The link stays hidden while this is empty.
export const INSTAGRAM_HIGHLIGHT_URL = "";

export const featuredEventBadge = {
  label: "Wings of Honour",
  to: `/#${SECTION_ID}`,
  ariaLabel: "See the Wings of Honour tribute stories",
};

export const eventDetails = {
  eyebrow: ["Tri-Service Tribute", "Indian Air Force Day, 8 October 2026"],
  title: "Wings of Honour",
  lede:
    "On the 94th Indian Air Force Day, RCPH and 13 collaborating clubs came together on Instagram to thank the heroes who guard our skies, each in their own mother tongue.",
  stats: [
    { value: "14", label: "clubs" },
    { value: "6", label: "Rotaract districts" },
    { value: "11", label: "languages" },
  ],
  credits: [
    { role: "Conducted by", name: "Rtr. Aarya Godbole, International Service Director", wide: true },
    { role: "Public Relations Officer", name: "Rtr. Yashali Shirodkar" },
    { role: "DEI Director", name: "Rtr. Tanishka Patekar" },
  ],
  highlightLabel: "See all stories on Instagram",
};

// "Thank you" in each campaign language, shown one at a time under the title.
// Hindi and Marathi share a word, so keep them apart. Pending native speaker review. `lang` is the BCP 47 code; `dir` is the text direction.
export const thankYous = [
  { name: "English", text: "Thank you", lang: "en", dir: "ltr" },
  { name: "Hindi", text: "धन्यवाद", lang: "hi", dir: "ltr" },
  { name: "Gujarati", text: "આભાર", lang: "gu", dir: "ltr" },
  { name: "Konkani", text: "देव बरें करूं", lang: "kok", dir: "ltr" },
  { name: "Odia", text: "ଧନ୍ୟବାଦ", lang: "or", dir: "ltr" },
  { name: "Marathi", text: "धन्यवाद", lang: "mr", dir: "ltr" },
  { name: "Telugu", text: "ధన్యవాదాలు", lang: "te", dir: "ltr" },
  { name: "Tamil", text: "நன்றி", lang: "ta", dir: "ltr" },
  { name: "Kannada", text: "ಧನ್ಯವಾದಗಳು", lang: "kn", dir: "ltr" },
  { name: "Punjabi", text: "ਧੰਨਵਾਦ", lang: "pa", dir: "ltr" },
  { name: "Urdu", text: "شکریہ", lang: "ur", dir: "rtl" },
];

// Story files go in public/media/wings-of-honour/, numbered in any order you like:
//   story-01-card.webp (400px wide), story-01-poster.webp (1080px wide), story-01.mp4 (viewer only)
// The banner uses 00-banner-card.webp and 00-banner-poster.webp.
// A missing file shows a placeholder, so stories appear as soon as their files are added.
// Change STORY_COUNT to show more or fewer stories.
export const STORY_COUNT = 8;

const STORY_TONES = ["#2b3d5a", "#24344f", "#33476a", "#1a2740", "#2f4260", "#203049", "#28395a", "#1d2c45"];

function mediaFor(slug, { hasVideo = true } = {}) {
  return {
    card: `${MEDIA_ROOT}/${slug}-card.webp`,
    poster: `${MEDIA_ROOT}/${slug}-poster.webp`,
    video: hasVideo ? `${MEDIA_ROOT}/${slug}.mp4` : null,
  };
}

const banner = {
  id: "banner",
  type: "banner",
  title: "Wings of Honour",
  subtitle: "Presented by RCPH",
  meta: ["Tri-Service Tribute", "Indian Air Force Day", "8 October 2026"],
  alt: "Wings of Honour event banner: a tribute to the Indian Air Force, presented by the Rotaract Club of Pune Heritage on 8 October 2026",
  ...mediaFor("00-banner", { hasVideo: false }),
};

const stories = Array.from({ length: STORY_COUNT }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");

  return {
    id: `story-${number}`,
    type: "story",
    alt: "A Rotaractor thanks the Indian Air Force in their mother tongue",
    tone: STORY_TONES[index % STORY_TONES.length],
    ...mediaFor(`story-${number}`),
  };
});

// The rotation order. The banner leads, then each story.
export const formationItems = [banner, ...stories];

// Ribbon of every participating club. With LOGOS_ENABLED, logos are picked up from
// public/media/wings-of-honour/logos/<slug>.webp; a club without a file shows its name only.
// Leave it false until the logo files are added, so the live site makes no requests for them.
export const LOGOS_ENABLED = false;
const LOGO_ROOT = `${MEDIA_ROOT}/logos`;

export const collaborators = [
  { slug: "pune-heritage", name: "Pune Heritage", district: "Host · RID 3131", host: true },
  { slug: "rscoe", name: "RSCOE", district: "RID 3131" },
  { slug: "pune-westside", name: "Pune Westside", district: "RID 3131" },
  { slug: "pune-shaniwarwada", name: "Pune Shaniwarwada", district: "RID 3131" },
  { slug: "pune-aurora", name: "Pune Aurora", district: "RID 3131" },
  { slug: "sspu", name: "SSPU", district: "RID 3131" },
  { slug: "gsmcoe", name: "GSMCOE", district: "RID 3131" },
  { slug: "roar-nibm", name: "Roar NIBM", district: "RID 3131" },
  { slug: "bhubaneshwar-jaydev", name: "Bhubaneshwar Jaydev", district: "RID 3262" },
  { slug: "lead-india-ahead", name: "Lead India Ahead", district: "RID 3206" },
  { slug: "curchorem-sanvordem", name: "Curchorem-Sanvordem", district: "RID 3170" },
  { slug: "rvce", name: "RVCE", district: "RID 3191" },
  { slug: "mount-carmel", name: "Mount Carmel (Deemed to be University)", district: "RID 3191" },
  { slug: "mumbai-downtown", name: "Mumbai DownTown", district: "RID 3141" },
].map((club) => ({ ...club, logo: LOGOS_ENABLED ? `${LOGO_ROOT}/${club.slug}.webp` : null }));

export const timing = {
  autoAdvanceMs: 4200,
  thankYouMs: 2600,
  holdAfterInteractionMs: 9000,
  placeholderStoryMs: 6000,
  bannerStoryMs: 5000,
};

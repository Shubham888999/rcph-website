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

// Each item's files live in public/media/wings-of-honour/ as <slug>-card.webp (400px wide),
// <slug>-poster.webp (1080px wide) and <slug>.mp4 (viewer only).
// Pass `true` once an item's files are committed; until then it shows a placeholder.
function storyMedia(slug, ready = false) {
  if (!ready) return { mediaSlug: slug, card: null, poster: null, video: null };

  return {
    mediaSlug: slug,
    card: `${MEDIA_ROOT}/${slug}-card.webp`,
    poster: `${MEDIA_ROOT}/${slug}-poster.webp`,
    video: `${MEDIA_ROOT}/${slug}.mp4`,
  };
}

// The rotation order. The banner leads, then each story.
export const formationItems = [
  {
    id: "banner",
    type: "banner",
    title: "Wings of Honour",
    subtitle: "Presented by RCPH",
    meta: ["Tri-Service Tribute", "Indian Air Force Day", "8 October 2026"],
    alt: "Wings of Honour event banner: a tribute to the Indian Air Force, presented by the Rotaract Club of Pune Heritage on 8 October 2026",
    // The banner is a still image, so it has no video.
    ...storyMedia("00-banner"),
    video: null,
  },
  {
    id: "rcph",
    type: "story",
    club: "Pune Heritage",
    district: "RID 3131",
    alt: "A member of the Rotaract Club of Pune Heritage thanks the Indian Air Force",
    tone: "#2b3d5a",
    ...storyMedia("01-pune-heritage"),
  },
  {
    id: "bhubaneshwar-jaydev",
    type: "story",
    club: "Bhubaneshwar Jaydev",
    district: "RID 3262",
    alt: "A member of the Rotaract Club of Bhubaneshwar Jaydev thanks the Indian Air Force",
    tone: "#24344f",
    ...storyMedia("02-bhubaneshwar-jaydev"),
  },
  {
    id: "curchorem-sanvordem",
    type: "story",
    club: "Curchorem-Sanvordem",
    district: "RID 3170",
    alt: "A member of the Rotaract Club of Curchorem-Sanvordem thanks the Indian Air Force",
    tone: "#33476a",
    ...storyMedia("03-curchorem-sanvordem"),
  },
  {
    id: "lead-india-ahead",
    type: "story",
    club: "Lead India Ahead",
    district: "RID 3206",
    alt: "A member of the Rotaract Club of Lead India Ahead thanks the Indian Air Force",
    tone: "#1a2740",
    ...storyMedia("04-lead-india-ahead"),
  },
  {
    id: "rvce",
    type: "story",
    club: "RVCE",
    district: "RID 3191",
    alt: "A member of the Rotaract Club of RVCE thanks the Indian Air Force",
    tone: "#2f4260",
    ...storyMedia("05-rvce"),
  },
  {
    id: "mumbai-downtown",
    type: "story",
    club: "Mumbai DownTown",
    district: "RID 3141",
    alt: "A member of the Rotaract Club of Mumbai DownTown thanks the Indian Air Force",
    tone: "#203049",
    ...storyMedia("06-mumbai-downtown"),
  },
  {
    id: "mount-carmel",
    type: "story",
    club: "Mount Carmel",
    district: "RID 3191",
    alt: "A member of the Rotaract Club of Mount Carmel thanks the Indian Air Force",
    tone: "#28395a",
    ...storyMedia("07-mount-carmel"),
  },
  {
    id: "roar-nibm",
    type: "story",
    club: "Roar NIBM",
    district: "RID 3131",
    alt: "A member of the Rotaract Club of Roar NIBM thanks the Indian Air Force",
    tone: "#1d2c45",
    ...storyMedia("08-roar-nibm"),
  },
];

// Ribbon of every participating club. Add a logo path (square PNG or WebP) to replace the placeholder circle.
export const collaborators = [
  { name: "Pune Heritage", district: "Host · RID 3131", host: true, logo: null },
  { name: "RSCOE", district: "RID 3131", logo: null },
  { name: "Pune Westside", district: "RID 3131", logo: null },
  { name: "Pune Shaniwarwada", district: "RID 3131", logo: null },
  { name: "Pune Aurora", district: "RID 3131", logo: null },
  { name: "SSPU", district: "RID 3131", logo: null },
  { name: "GSMCOE", district: "RID 3131", logo: null },
  { name: "Roar NIBM", district: "RID 3131", logo: null },
  { name: "Bhubaneshwar Jaydev", district: "RID 3262", logo: null },
  { name: "Lead India Ahead", district: "RID 3206", logo: null },
  { name: "Curchorem-Sanvordem", district: "RID 3170", logo: null },
  { name: "RVCE", district: "RID 3191", logo: null },
  { name: "Mount Carmel (Deemed to be University)", district: "RID 3191", logo: null },
  { name: "Mumbai DownTown", district: "RID 3141", logo: null },
];

export const timing = {
  autoAdvanceMs: 4200,
  thankYouMs: 2600,
  holdAfterInteractionMs: 9000,
  placeholderStoryMs: 6000,
  bannerStoryMs: 5000,
};

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

// "Thank you" in each campaign language. Pending native speaker review.
// `lang` is the BCP 47 code used for the lang attribute; `dir` is the text direction.
export const languages = {
  hi: { name: "Hindi", native: "हिन्दी", thankYou: "धन्यवाद", lang: "hi", dir: "ltr" },
  mr: { name: "Marathi", native: "मराठी", thankYou: "धन्यवाद", lang: "mr", dir: "ltr" },
  gu: { name: "Gujarati", native: "ગુજરાતી", thankYou: "આભાર", lang: "gu", dir: "ltr" },
  kok: { name: "Konkani", native: "कोंकणी", thankYou: "देव बरें करूं", lang: "kok", dir: "ltr" },
  or: { name: "Odia", native: "ଓଡ଼ିଆ", thankYou: "ଧନ୍ୟବାଦ", lang: "or", dir: "ltr" },
  te: { name: "Telugu", native: "తెలుగు", thankYou: "ధన్యవాదాలు", lang: "te", dir: "ltr" },
  ta: { name: "Tamil", native: "தமிழ்", thankYou: "நன்றி", lang: "ta", dir: "ltr" },
  kn: { name: "Kannada", native: "ಕನ್ನಡ", thankYou: "ಧನ್ಯವಾದಗಳು", lang: "kn", dir: "ltr" },
  pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ", thankYou: "ਧੰਨਵਾਦ", lang: "pa", dir: "ltr" },
  ur: { name: "Urdu", native: "اردو", thankYou: "شکریہ", lang: "ur", dir: "rtl" },
  en: { name: "English", native: "English", thankYou: "Thank you", lang: "en", dir: "ltr" },
};

// Language shown under the headline while the banner is at the front.
export const BANNER_LANGUAGE = "en";

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
    language: "mr",
    alt: "A member of the Rotaract Club of Pune Heritage thanks the Indian Air Force in Marathi",
    tone: "#2b3d5a",
    ...storyMedia("01-pune-heritage-marathi"),
  },
  {
    id: "bhubaneshwar-jaydev",
    type: "story",
    club: "Bhubaneshwar Jaydev",
    district: "RID 3262",
    language: "or",
    alt: "A member of the Rotaract Club of Bhubaneshwar Jaydev thanks the Indian Air Force in Odia",
    tone: "#24344f",
    ...storyMedia("02-bhubaneshwar-jaydev-odia"),
  },
  {
    id: "curchorem-sanvordem",
    type: "story",
    club: "Curchorem-Sanvordem",
    district: "RID 3170",
    language: "kok",
    alt: "A member of the Rotaract Club of Curchorem-Sanvordem thanks the Indian Air Force in Konkani",
    tone: "#33476a",
    ...storyMedia("03-curchorem-sanvordem-konkani"),
  },
  {
    id: "lead-india-ahead",
    type: "story",
    club: "Lead India Ahead",
    district: "RID 3206",
    language: "ta",
    alt: "A member of the Rotaract Club of Lead India Ahead thanks the Indian Air Force in Tamil",
    tone: "#1a2740",
    ...storyMedia("04-lead-india-ahead-tamil"),
  },
  {
    id: "rvce",
    type: "story",
    club: "RVCE",
    district: "RID 3191",
    language: "te",
    alt: "A member of the Rotaract Club of RVCE thanks the Indian Air Force in Telugu",
    tone: "#2f4260",
    ...storyMedia("05-rvce-telugu"),
  },
  {
    id: "mumbai-downtown",
    type: "story",
    club: "Mumbai DownTown",
    district: "RID 3141",
    language: "hi",
    alt: "A member of the Rotaract Club of Mumbai DownTown thanks the Indian Air Force in Hindi",
    tone: "#203049",
    ...storyMedia("06-mumbai-downtown-hindi"),
  },
  {
    id: "mount-carmel",
    type: "story",
    club: "Mount Carmel",
    district: "RID 3191",
    language: "ur",
    alt: "A member of the Rotaract Club of Mount Carmel thanks the Indian Air Force in Urdu",
    tone: "#28395a",
    ...storyMedia("07-mount-carmel-urdu"),
  },
  {
    id: "roar-nibm",
    type: "story",
    club: "Roar NIBM",
    district: "RID 3131",
    language: "gu",
    alt: "A member of the Rotaract Club of Roar NIBM thanks the Indian Air Force in Gujarati",
    tone: "#1d2c45",
    ...storyMedia("08-roar-nibm-gujarati"),
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
  stepMs: 560,
  holdAfterInteractionMs: 9000,
  placeholderStoryMs: 6000,
  bannerStoryMs: 5000,
};

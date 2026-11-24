// Content for the two Mahadaan 12.0 drive pages. Phone numbers on the banners in these photos are blurred.
const MEDIA = "/media/event-stories";

export const mahadaanDrives = [
  {
    number: 1,
    path: "/events/mahadaan-drive-1-2026",
    shortDate: "27 Sep",
    lede: "A donation drive by the Rotary Club of Pune Heritage, held during Pitru Paksha to promote the spirit of giving. It collected food grains, clothes and money for welfare organisations that support the elderly and the underprivileged.",
    facts: [
      { label: "When", value: "27 September 2026, 10 am to 2 pm" },
      { label: "Where", value: "Padmavati Hills, Bavdhan, Pune" },
      { label: "Focus area", value: "Community economic development" },
    ],
    photos: [
      {
        src: `${MEDIA}/mahadaan-drive-1-2026/truck.webp`,
        small: `${MEDIA}/mahadaan-drive-1-2026/truck-800.webp`,
        width: 1600,
        height: 1200,
        alt: "RCPH members standing beside a truck filled with donated sacks and bags, holding the RCPH banner and the Mahadaan banner",
        caption: "The truck, loaded and ready · Drive 1",
      },
    ],
    donations: ["grains", "clothes", "money"],
    doneText: "Loaded and on its way to welfare organisations like Matoshree Vruddhashram in Pune and Snehalaya in Ahmednagar.",
    notes: [
      { title: "Matoshree Vruddhashram, Pune", text: "One of the welfare organisations Mahadaan supports, caring for the elderly." },
      { title: "Snehalaya, Ahmednagar", text: "One of the welfare organisations Mahadaan supports, working with the underprivileged." },
      { title: "Tradition with responsibility", text: "Mahadaan blends the cultural spirit of giving during Pitru Paksha with social responsibility, meeting essential needs and strengthening social bonds." },
    ],
    conductedBy: [
      { name: "Rtr. Soumitra Lokur", role: "" },
      { name: "Rtr. Tanishka Patekar", role: "" },
      { name: "Rtr. Aneesh Ladkat", role: "" },
    ],
  },
  {
    number: 2,
    path: "/events/mahadaan-drive-2-2026",
    shortDate: "3 Oct",
    lede: "Continuing the spirit of giving from the first drive, residents and community members contributed usable clothes, food grains, daily-use items and money. Everything collected will be channelled through Rotary to charitable and welfare organisations.",
    facts: [
      { label: "When", value: "3 October 2026, 10 am to 2 pm" },
      { label: "Where", value: "Royal KP Stellar Society, NIBM Road, Pune" },
      { label: "Focus area", value: "Community economic development" },
    ],
    photos: [
      {
        src: `${MEDIA}/mahadaan-drive-2-2026/donations.webp`,
        small: `${MEDIA}/mahadaan-drive-2-2026/donations-800.webp`,
        width: 1080,
        height: 476,
        alt: "Bags and sacks of donated clothes, grains and daily-use items piled against a wall",
        caption: "Donations piling up",
      },
      {
        src: `${MEDIA}/mahadaan-drive-2-2026/team.webp`,
        small: `${MEDIA}/mahadaan-drive-2-2026/team-800.webp`,
        width: 1080,
        height: 478,
        alt: "Rotarians and Rotaractors standing on either side of the Mahadaan banner at Royal KP Stellar Society",
        caption: "Rotarians and Rotaractors, together",
      },
    ],
    donations: ["grains", "clothes", "daily", "money"],
    doneText: "Loaded and on its way, through Rotary, to charitable and welfare organisations supporting people in need.",
    notes: [
      { title: "Rotary and Rotaract, side by side", text: "The drive brought together Rotarians, Rotaractors, volunteers and community members, building on the first drive and strengthening our shared commitment to service." },
      { title: "Advice from the society", text: "Senior members of the society shared valuable guidance and suggestions on community service, opening up new opportunities for meaningful service." },
    ],
    conductedBy: [
      { name: "Rtr. Soumitra Lokur", role: "" },
      { name: "Rtr. Tanishka Patekar", role: "" },
      { name: "Rtr. Aneesh Ladkat", role: "" },
    ],
  },
];

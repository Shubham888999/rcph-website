const text = (value) => ({ type: "text", value });
const link = (label, to) => ({ type: "link", label, to });

export const faqCategories = Object.freeze([
  { id: "club", label: "Club Identity", description: "RCPH, its Rotary connection, history, and purpose." },
  { id: "events", label: "Events & Projects", description: "Public activities, service projects, and ways to explore club work." },
  { id: "membership", label: "Membership & Dues", description: "Joining RCPH and the existing published membership-dues information." },
  { id: "support", label: "Collaboration & Support", description: "Partnerships, enquiries, and reaching the club team." },
]);

export const faqItems = [
  {
    id: "what-is-rcph",
    category: "club",
    featured: true,
    keywords: ["about", "club", "rotaract", "pune"],
    question: "What is Rotaract Club of Pune Heritage?",
    answer: [text("Rotaract Club of Pune Heritage, or RCPH, is a community-based Rotaract club in Pune under Rotaract District 3131, Zone 4. The club brings together students and young professionals who want to serve the community, develop leadership skills, build friendships, and contribute through meaningful projects and events.")],
  },
  {
    id: "official-website",
    category: "club",
    keywords: ["official", "website", "rcph3131.org"],
    question: "Is this the official website of Rotaract Club of Pune Heritage?",
    answer: [text("Yes. rcph3131.org is the official website of Rotaract Club of Pune Heritage. It shares public information about the club, events, projects, membership, and collaborations.")],
  },
  {
    id: "district",
    category: "club",
    keywords: ["district", "zone", "3131"],
    question: "Which district is Rotaract Club of Pune Heritage part of?",
    answer: [text("Rotaract Club of Pune Heritage is part of Rotaract District 3131, Zone 4, Pune.")],
  },
  {
    id: "sponsor-club",
    category: "club",
    keywords: ["sponsor", "rotary"],
    question: "Who sponsors Rotaract Club of Pune Heritage?",
    answer: [text("Rotaract Club of Pune Heritage is sponsored by Rotary Club of Pune Heritage.")],
  },
  {
    id: "chartered",
    category: "club",
    keywords: ["charter", "founded", "history", "2015"],
    question: "When was Rotaract Club of Pune Heritage chartered?",
    answer: [text("Rotaract Club of Pune Heritage was chartered in 2015.")],
  },
  {
    id: "what-rcph-does",
    category: "club",
    keywords: ["service", "leadership", "fellowship", "activities"],
    question: "What does RCPH do?",
    answer: [text("RCPH organizes community service projects, professional development sessions, fellowship activities, cultural initiatives, district participation, awareness drives, collaborations, and youth leadership opportunities. The club gives members a platform to create, connect, and contribute.")],
  },
  {
    id: "motto",
    category: "club",
    keywords: ["motto", "theme", "create", "connect", "contribute"],
    question: "What is the motto or theme of RCPH?",
    answer: [text("The club’s guiding line is “Create. Connect. Contribute.”")],
  },
  {
    id: "events",
    category: "events",
    featured: true,
    keywords: ["events", "gbm", "service", "district", "fellowship"],
    question: "What kinds of events does RCPH organize?",
    answer: [text("RCPH events include service drives, General Body Meetings, professional development sessions, fellowship activities, district events, cultural exchanges, awareness sessions, and collaborations with other clubs, NGOs, colleges, and community partners.")],
  },
  {
    id: "projects",
    category: "events",
    keywords: ["projects", "education", "books", "community"],
    question: "What kinds of projects has RCPH worked on?",
    answer: [
      text("RCPH projects include education support, awareness initiatives, fellowship events, cultural exchanges, youth leadership activities, book donation drives, and collaborations with schools, clubs, and community organizations. Visitors can explore featured stories on the "),
      link("Projects page", "/projects"),
      text("."),
    ],
  },
  {
    id: "events-and-projects",
    category: "events",
    keywords: ["calendar", "events", "projects", "stories"],
    question: "Where can I see RCPH events and projects?",
    answer: [
      text("Public events can be viewed on the "),
      link("Events page", "/events"),
      text(", and featured project stories can be viewed on the "),
      link("Projects page", "/projects"),
      text(" of rcph3131.org."),
    ],
  },
  {
    id: "who-can-join",
    category: "membership",
    featured: true,
    keywords: ["join", "eligibility", "students", "professionals"],
    question: "Who can join Rotaract Club of Pune Heritage?",
    answer: [text("Students and young professionals who want to participate in community service, leadership, fellowship, and professional development can explore membership with RCPH.")],
  },
  {
    id: "how-to-join",
    category: "membership",
    featured: true,
    keywords: ["join", "membership", "apply", "contact"],
    question: "How can I join RCPH?",
    answer: [text("You can visit the "), link("Join page", "/join"), text(" on rcph3131.org or contact the club for membership guidance.")],
  },
  {
    id: "annual-dues",
    category: "membership",
    keywords: ["dues", "fee", "3000", "rotary year"],
    question: "What are the annual membership dues for RCPH and why are they required?",
    answer: [text("RCPH membership dues are ₹3,000 per Rotary Year. These dues help the club operate smoothly by supporting administrative requirements, club activities, member resources, event logistics, district obligations, and initiatives that directly benefit members throughout the year. Membership dues ensure that the club can continue creating meaningful service, leadership, fellowship, and professional development opportunities.")],
  },
  {
    id: "dues-utilization",
    category: "membership",
    keywords: ["dues", "fee", "district dues", "rotary international", "utilization"],
    question: "How is my ₹3,000 membership fee utilized?",
    answer: [text("RCPH is transparent about how membership dues are used. Out of the annual ₹3,000 membership fee, ₹300 per member is paid as District Dues to Rotaract District 3131, and USD $8 (approximately ₹760) is paid as Rotary International dues. The remaining amount supports club operations, member development initiatives, event infrastructure, fellowship activities, club administration, recognition programs, communication platforms, and various projects and opportunities throughout the Rotary Year.")],
  },
  {
    id: "collaborations",
    category: "support",
    keywords: ["collaborate", "ngo", "college", "sponsor", "partner"],
    question: "Can NGOs, colleges, sponsors, or other clubs collaborate with RCPH?",
    answer: [
      text("Yes. RCPH welcomes collaborations with NGOs, colleges, sponsors, Rotary clubs, Rotaract clubs, students, and community partners. Collaboration enquiries can be shared through the "),
      link("Contact page", "/contact"),
      text("."),
    ],
  },
  {
    id: "contact",
    category: "support",
    keywords: ["contact", "help", "membership", "volunteer", "sponsorship"],
    question: "How can I contact Rotaract Club of Pune Heritage?",
    answer: [text("You can contact RCPH through the "), link("Contact page", "/contact"), text(" on rcph3131.org for membership, collaboration, volunteering, event, or sponsorship enquiries.")],
  },
{
  id: "meeting-locations",
  category: "events",
  keywords: [
    "meeting",
    "meetings",
    "location",
    "venue",
    "karvenagar",
    "kothrud",
    "sahakarnagar",
    "gbm",
    "bod meeting",
  ],
  question: "Where does RCPH usually conduct its meetings?",
  answer: [
    text(
      "RCPH meetings are generally conducted in and around Karvenagar, Kothrud, and Sahakarnagar. The exact venue may vary depending on availability, convenience, and the nature of the meeting, and is communicated to members in advance."
    ),
  ],
},
  
];

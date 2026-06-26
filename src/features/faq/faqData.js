const text = (value) => ({ type: "text", value });
const link = (label, to) => ({ type: "link", label, to });

export const faqItems = [
  {
    id: "what-is-rcph",
    question: "What is Rotaract Club of Pune Heritage?",
    answer: [text("Rotaract Club of Pune Heritage, also known as RCPH, is a community-based Rotaract club in Pune under Rotaract District 3131, Zone 4. The club brings together students and young professionals who want to serve the community, develop leadership skills, build friendships, and contribute through meaningful projects and events.")],
  },
  {
    id: "official-website",
    question: "Is this the official website of Rotaract Club of Pune Heritage?",
    answer: [text("Yes. rcph3131.org is the official website of Rotaract Club of Pune Heritage. It shares public information about the club, events, projects, membership, and collaborations.")],
  },
  {
    id: "district",
    question: "Which district is Rotaract Club of Pune Heritage part of?",
    answer: [text("Rotaract Club of Pune Heritage is part of Rotaract District 3131, Zone 4, Pune.")],
  },
  {
    id: "sponsor-club",
    question: "Who sponsors Rotaract Club of Pune Heritage?",
    answer: [text("Rotaract Club of Pune Heritage is sponsored by Rotary Club of Pune Heritage.")],
  },
  {
    id: "chartered",
    question: "When was Rotaract Club of Pune Heritage chartered?",
    answer: [text("Rotaract Club of Pune Heritage was chartered in 2015.")],
  },
  {
    id: "what-rcph-does",
    question: "What does RCPH do?",
    answer: [text("RCPH organizes community service projects, professional development sessions, fellowship activities, cultural initiatives, district participation, awareness drives, collaborations, and youth leadership opportunities. The club gives members a platform to create, connect, and contribute.")],
  },
  {
    id: "events",
    question: "What kinds of events does RCPH organize?",
    answer: [text("RCPH events include service drives, General Body Meetings, professional development sessions, fellowship activities, district events, cultural exchanges, awareness sessions, and collaborations with other clubs, NGOs, colleges, and community partners.")],
  },
  {
    id: "projects",
    question: "What kinds of projects has RCPH worked on?",
    answer: [
      text("RCPH projects include education support, awareness initiatives, fellowship events, cultural exchanges, youth leadership activities, book donation drives, and collaborations with schools, clubs, and community organizations. Visitors can explore featured stories on the "),
      link("Projects page", "/projects"),
      text("."),
    ],
  },
  {
    id: "who-can-join",
    question: "Who can join Rotaract Club of Pune Heritage?",
    answer: [text("Students and young professionals who want to participate in community service, leadership, fellowship, and professional development can explore membership with RCPH.")],
  },
  {
    id: "how-to-join",
    question: "How can I join RCPH?",
    answer: [
      text("You can visit the "),
      link("Join page", "/join"),
      text(" on rcph3131.org or contact the club for membership guidance."),
    ],
  },
  {
    id: "annual-dues",
    question: "What are the annual membership dues for RCPH and why are they required?",
    answer: [text("RCPH membership dues are ₹3,000 per Rotary Year. These dues help the club operate smoothly by supporting administrative requirements, club activities, member resources, event logistics, district obligations, and initiatives that directly benefit members throughout the year. Membership dues ensure that the club can continue creating meaningful service, leadership, fellowship, and professional development opportunities.")],
  },
  {
    id: "dues-utilization",
    question: "How is my ₹3,000 membership fee utilized?",
    answer: [text("RCPH is transparent about how membership dues are used. Out of the annual ₹3,000 membership fee, ₹300 per member is paid as District Dues to Rotaract District 3131, and USD $8 (approximately ₹760) is paid as Rotary International dues. The remaining amount supports club operations, member development initiatives, event infrastructure, fellowship activities, club administration, recognition programs, communication platforms, and various projects and opportunities throughout the Rotary Year.")],
  },
  {
    id: "collaborations",
    question: "Can NGOs, colleges, sponsors, or other clubs collaborate with RCPH?",
    answer: [
      text("Yes. RCPH welcomes collaborations with NGOs, colleges, sponsors, Rotary clubs, Rotaract clubs, students, and community partners. Collaboration enquiries can be shared through the "),
      link("Contact page", "/contact"),
      text("."),
    ],
  },
  {
    id: "member-access",
    question: "Does the website have member login and dashboards?",
    answer: [text("Yes. The website includes a secure login system for approved members. General Body Members can access their personal dashboard, BOD members can manage events, and admins can manage attendance, approvals, fines, treasury, and insights.")],
  },
  {
    id: "motto",
    question: "What is the motto or theme of RCPH?",
    answer: [text("The club’s guiding line is “Create. Connect. Contribute.”")],
  },
  {
    id: "events-and-projects",
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
    id: "contact",
    question: "How can I contact Rotaract Club of Pune Heritage?",
    answer: [
      text("You can contact RCPH through the "),
      link("Contact page", "/contact"),
      text(" on rcph3131.org for membership, collaboration, volunteering, event, or sponsorship enquiries."),
    ],
  },
];

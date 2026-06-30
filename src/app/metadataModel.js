export const SITE_ORIGIN = "https://rcph3131.org";

const PUBLIC_METADATA = {
  "/": ["Rotaract Club of Pune Heritage | RID 3131", "Official website of Rotaract Club of Pune Heritage in Pune. Explore service projects, events, leadership, and membership."],
  "/about": ["About RCPH | Rotaract Club of Pune Heritage", "Learn about the story, identity, values, and Pune heritage of Rotaract Club of Pune Heritage."],
  "/events": ["Events | Rotaract Club of Pune Heritage", "Browse upcoming and recent public events from Rotaract Club of Pune Heritage."],
  "/calendar": ["Public Event Calendar | RCPH", "Explore public RCPH events in accessible month and list calendar views."],
  "/projects": ["Projects | Rotaract Club of Pune Heritage", "Explore community service, professional development, and fellowship projects by RCPH."],
  "/join": ["Join RCPH | Rotaract Club of Pune Heritage", "Learn about membership, eligibility, benefits, and the process for joining RCPH."],
  "/bod": ["Board of Directors | RCPH", "Meet the Board of Directors and club leadership of Rotaract Club of Pune Heritage."],
  "/faq": ["Frequently Asked Questions | RCPH", "Find official answers about RCPH membership, projects, events, partnerships, and club life."],
  "/contact": ["Contact RCPH | Rotaract Club of Pune Heritage", "Contact Rotaract Club of Pune Heritage for membership, visits, partnerships, and collaboration."],
};

const PRIVATE_TITLES = {
  "/login": "Sign In | RCPH",
  "/signup": "Create an Account | RCPH",
  "/forgot-password": "Password Recovery | RCPH",
  "/access": "Access Hub | RCPH",
  "/dashboard": "Member Dashboard | RCPH",
  "/bod-tools": "BOD Event Manager | RCPH",
};

export function getRouteMetadata(pathname) {
  const path = typeof pathname === "string" && pathname.startsWith("/") ? pathname : "/";
  const publicEntry = PUBLIC_METADATA[path];
  if (publicEntry) return { title: publicEntry[0], description: publicEntry[1], canonical: `${SITE_ORIGIN}${path === "/" ? "/" : path}`, robots: "index, follow", isPublic: true };
  const adminPath = path === "/admin" || path.startsWith("/admin/");
  const title = adminPath ? "Admin | RCPH" : PRIVATE_TITLES[path] || "Page Not Found | RCPH";
  return { title, description: "Protected or account-related area of the Rotaract Club of Pune Heritage website.", canonical: `${SITE_ORIGIN}${path}`, robots: "noindex, nofollow", isPublic: false };
}

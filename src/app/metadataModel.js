export const SITE_ORIGIN = "https://rcph3131.org";
export const DEFAULT_SOCIAL_IMAGE = "/images/rcph-lakshya-logo.webp";
export const DEFAULT_SOCIAL_IMAGE_ALT = "Rotaract Club of Pune Heritage official logo";

export const PUBLIC_ROUTES = Object.freeze([
  "/",
  "/about",
  "/events",
  "/calendar",
  "/projects",
  "/join",
  "/contact",
  "/faq",
  "/bod",
  "/terms",
  "/privacy",
]);

const PUBLIC_METADATA = Object.freeze({
  "/": {
    title: "Rotaract Club of Pune Heritage | RCPH",
    description: "Official website of Rotaract Club of Pune Heritage in Pune. Explore community projects, public events, club leadership, and membership opportunities.",
    breadcrumb: "Home",
  },
  "/about": {
    title: "About RCPH | Rotaract Club of Pune Heritage",
    description: "Learn about the story, identity, values, Rotary connection, and Pune heritage of the Rotaract Club of Pune Heritage.",
    breadcrumb: "About",
  },
  "/events": {
    title: "Events | Rotaract Club of Pune Heritage",
    description: "Browse upcoming and recent public RCPH events, including community service, professional development, fellowship, and district activities in Pune.",
    breadcrumb: "Events",
  },
  "/calendar": {
    title: "Public Event Calendar | RCPH",
    description: "Explore public Rotaract Club of Pune Heritage events through accessible month and list calendar views, with dates, descriptions, and service avenues.",
    breadcrumb: "Calendar",
  },
  "/projects": {
    title: "Projects | Rotaract Club of Pune Heritage",
    description: "Explore community service, education, professional development, fellowship, and cultural projects led by Rotaract Club of Pune Heritage.",
    breadcrumb: "Projects",
  },
  "/join": {
    title: "Join RCPH | Rotaract Club of Pune Heritage",
    description: "Learn about RCPH membership eligibility, benefits, service opportunities, fellowship, and the process for joining the club in Pune.",
    breadcrumb: "Join",
  },
  "/contact": {
    title: "Contact RCPH | Rotaract Club of Pune Heritage",
    description: "Contact Rotaract Club of Pune Heritage about membership, volunteering, college sessions, sponsorships, partnerships, and community collaboration.",
    breadcrumb: "Contact",
  },
  "/faq": {
    title: "Frequently Asked Questions | RCPH",
    description: "Find official answers about RCPH membership, projects, public events, volunteering, partnerships, account access, and club life in Pune.",
    breadcrumb: "FAQ",
  },
  "/bod": {
    title: "Board of Directors | RCPH",
    description: "Meet the Board of Directors and club leadership of Rotaract Club of Pune Heritage, including executive, service, and communications roles.",
    breadcrumb: "Board of Directors",
  },
  "/terms": {
    title: "Terms and Conditions | RCPH",
    description: "Read the RCPH terms for accounts, prospect participation, membership administration, meetings, conduct, dues, and club activities.",
    breadcrumb: "Terms and Conditions",
  },
  "/privacy": {
    title: "Privacy Notice | RCPH",
    description: "Read how RCPH collects, uses, stores, shares, and manages personal data for prospect and member accounts and club administration.",
    breadcrumb: "Privacy Notice",
  },
});

const PRIVATE_TITLES = Object.freeze({
  "/login": "Sign In | RCPH",
  "/signup": "Create an Account | RCPH",
  "/forgot-password": "Password Recovery | RCPH",
  "/access": "Access Hub | RCPH",
  "/website-guide": "Website Guide | RCPH",
  "/dashboard": "Member Dashboard | RCPH",
  "/bod-tools": "BOD Event Manager | RCPH",
  "/visits/club-assembly": "Club Assembly Dashboard | RCPH",
  "/visits/dzr-visit": "DZR Visit Dashboard | RCPH",
  "/visits/drr-visit": "DRR Visit Dashboard | RCPH",
});

export function normalizeRoutePath(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return "/";
  const path = pathname.replace(/\/{2,}/g, "/");
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

export function absoluteSiteUrl(value = "/") {
  try {
    const url = new URL(value, `${SITE_ORIGIN}/`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : `${SITE_ORIGIN}/`;
  } catch {
    return `${SITE_ORIGIN}/`;
  }
}

export function canonicalUrl(pathname) {
  const path = normalizeRoutePath(pathname);
  return `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
}

export function getRouteStructuredData(pathname) {
  const path = normalizeRoutePath(pathname);
  const entry = PUBLIC_METADATA[path];
  if (!entry || path === "/") return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: entry.breadcrumb, item: canonicalUrl(path) },
    ],
  };
}

export function serializeStructuredData(value) {
  return value ? JSON.stringify(value).replace(/</g, "\\u003c") : "";
}

export function getRouteMetadata(pathname) {
  const path = normalizeRoutePath(pathname);
  const publicEntry = PUBLIC_METADATA[path];
  if (publicEntry) {
    return {
      title: publicEntry.title,
      description: publicEntry.description,
      canonical: canonicalUrl(path),
      robots: "index, follow",
      image: absoluteSiteUrl(DEFAULT_SOCIAL_IMAGE),
      imageAlt: DEFAULT_SOCIAL_IMAGE_ALT,
      type: "website",
      structuredData: getRouteStructuredData(path),
      isPublic: true,
    };
  }
  const adminPath = path === "/admin" || path.startsWith("/admin/");
  return {
    title: adminPath ? "Admin | RCPH" : PRIVATE_TITLES[path] || "Page Not Found | RCPH",
    description: "Protected or account-related area of the Rotaract Club of Pune Heritage website.",
    canonical: canonicalUrl(path),
    robots: "noindex, nofollow",
    image: absoluteSiteUrl(DEFAULT_SOCIAL_IMAGE),
    imageAlt: DEFAULT_SOCIAL_IMAGE_ALT,
    type: "website",
    structuredData: null,
    isPublic: false,
  };
}

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
    title: "Rotaract Club of Pune Heritage | Rotaract Club in Pune",
    description: "RCPH is a Rotaract club in Pune in Rotaract District 3131, sponsored by the Rotary Club of Pune Heritage. Service, leadership and fellowship since 2015.",
    breadcrumb: "Home",
  },
  "/about": {
    title: "About Us | Rotaract Club of Pune Heritage, Pune",
    description: "The story of RCPH: a Rotaract club in Pune since 2015, sponsored by the Rotary Club of Pune Heritage, RID 3131, Zone 4.",
    breadcrumb: "About",
  },
  "/events": {
    title: "Rotaract Events in Pune | Rotaract Club of Pune Heritage",
    description: "Upcoming and recent RCPH events in Pune: community service, professional development, fellowship and Rotaract District 3131 activities.",
    breadcrumb: "Events",
  },
  "/calendar": {
    title: "Event Calendar | RCPH Pune",
    description: "Month-by-month calendar of public RCPH events in Pune.",
    breadcrumb: "Calendar",
  },
  "/projects": {
    title: "Community Service Projects in Pune | RCPH",
    description: "Community service, education, professional development and cultural projects by Rotaract Club of Pune Heritage, a Rotaract club in Pune.",
    breadcrumb: "Projects",
  },
  "/join": {
    title: "Join a Rotaract Club in Pune | RCPH",
    description: "Students and young professionals in Pune can join Rotaract Club of Pune Heritage. See the benefits, how to join, and create your member account.",
    breadcrumb: "Join",
  },
  "/contact": {
    title: "Contact Rotaract Club of Pune Heritage | Pune",
    description: "Contact RCPH about membership, volunteering, college sessions, sponsorships and partnerships with a Rotaract club in Pune.",
    breadcrumb: "Contact",
  },
  "/faq": {
    title: "RCPH FAQs | Rotaract Club in Pune",
    description: "Answers about joining RCPH, meetings in Kothrud, Karvenagar and Sahakarnagar, projects and volunteering.",
    breadcrumb: "FAQ",
  },
  "/bod": {
    title: "Board of Directors | RCPH Pune",
    description: "Meet the Board of Directors of Rotaract Club of Pune Heritage, a Rotaract club in Pune, RID 3131.",
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
    title: adminPath ? "Admin | RCPH" : PRIVATE_TITLES[path] || "Page not found | Rotaract Club of Pune Heritage",
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

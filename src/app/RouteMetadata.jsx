import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getRouteMetadata, SITE_ORIGIN } from "./metadataModel";

function upsertMeta(selector, attributes, content) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export default function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const metadata = getRouteMetadata(pathname);
    document.title = metadata.title;
    upsertMeta('meta[name="description"]', { name: "description" }, metadata.description);
    upsertMeta('meta[name="robots"]', { name: "robots" }, metadata.robots);
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, metadata.title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, metadata.description);
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, "website");
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, metadata.canonical);
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, `${SITE_ORIGIN}/images/logo3.webp`);
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, metadata.title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, metadata.description);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, `${SITE_ORIGIN}/images/logo3.webp`);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = metadata.canonical;
  }, [pathname]);
  return <Outlet />;
}

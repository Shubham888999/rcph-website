import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getRouteMetadata, serializeStructuredData } from "./metadataModel";

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
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, metadata.type);
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, metadata.canonical);
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, metadata.image);
    upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt" }, metadata.imageAlt);
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, metadata.title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, metadata.description);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, metadata.image);
    upsertMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt" }, metadata.imageAlt);
    const canonicals = [...document.head.querySelectorAll('link[rel="canonical"]')];
    let canonical = canonicals.shift();
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = metadata.canonical;
    canonicals.forEach((duplicate) => duplicate.remove());

    let routeSchema = document.head.querySelector('script[data-route-structured-data]');
    if (metadata.structuredData) {
      if (!routeSchema) {
        routeSchema = document.createElement("script");
        routeSchema.type = "application/ld+json";
        routeSchema.dataset.routeStructuredData = "true";
        document.head.appendChild(routeSchema);
      }
      routeSchema.textContent = serializeStructuredData(metadata.structuredData);
    } else {
      routeSchema?.remove();
    }
  }, [pathname]);
  return <Outlet />;
}

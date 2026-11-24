import { lazy } from "react";

// Each story's custom part loads only when someone opens that page.
export const eventStoryComponents = {
  "wings-of-honour-2026": lazy(() => import("./stories/WingsOfHonourStory")),
  "mens-day-2026": lazy(() => import("./stories/MensDayStory")),
  "patakhas-assemble-2026": lazy(() => import("./stories/PatakhasAssembleStory")),
  "couch-champions-2026": lazy(() => import("./stories/CouchChampionsStory")),
  "rooted-2026": lazy(() => import("./stories/RootedStory")),
  "mahadaan-drive-2-2026": lazy(() => import("./stories/MahadaanDrive2Story")),
  "mahadaan-drive-1-2026": lazy(() => import("./stories/MahadaanDrive1Story")),
};

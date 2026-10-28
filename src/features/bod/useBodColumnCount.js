import { useSyncExternalStore } from "react";
import { getBodColumnCount } from "./bodGridModel.js";

function subscribe(onChange) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getSnapshot() {
  return getBodColumnCount(window.innerWidth);
}

export default function useBodColumnCount() {
  return useSyncExternalStore(subscribe, getSnapshot, getBodColumnCount);
}

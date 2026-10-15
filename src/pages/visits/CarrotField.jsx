import { useEffect, useRef, useState } from "react";
import {
  carrotLayersForWidth,
  carrotTransform,
  createCarrot,
  stepCarrot,
} from "../../features/visits/carrotFieldModel.js";

const CARROT_SRC = "/visit-theme/carrot.svg";
const RESIZE_DEBOUNCE_MS = 200;

function viewportBounds() {
  return { width: window.innerWidth, height: window.innerHeight };
}

// A string key so an unchanged layout after a resize keeps the running field.
function layoutForWidth(width) {
  return carrotLayersForWidth(width).join(",");
}

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function paintCarrot(element, carrot) {
  if (!element) return;
  element.style.transform = carrotTransform(carrot);
}

// DZR carrot theme only: decorative carrots drifting behind the page content.
// Positions are written straight to the elements; React only renders the list.
export default function CarrotField() {
  const [layout, setLayout] = useState(() => layoutForWidth(window.innerWidth));
  const layers = layout ? layout.split(",") : [];
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const elementsRef = useRef([]);

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLayout(layoutForWidth(window.innerWidth)), RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", onResize);
    let query = null;
    const onMotionChange = (event) => setReducedMotion(event.matches);
    try {
      query = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
      query?.addEventListener?.("change", onMotionChange);
    } catch {
      query = null;
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      query?.removeEventListener?.("change", onMotionChange);
    };
  }, []);

  useEffect(() => {
    const random = Math.random;
    let carrots = (layout ? layout.split(",") : []).map((layer) => createCarrot(viewportBounds(), random, layer));

    carrots.forEach((carrot, index) => {
      const element = elementsRef.current[index];
      if (!element) return;
      element.style.width = `${carrot.width}px`;
      element.style.height = `${carrot.height}px`;
      element.style.opacity = String(carrot.opacity);
      paintCarrot(element, carrot);
    });

    if (reducedMotion) {
      return undefined;
    }

    let frame = 0;
    let last = 0;
    const tick = (now) => {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const bounds = viewportBounds();
      carrots = carrots.map((carrot, index) => {
        const next = stepCarrot(carrot, dt, bounds, random);
        paintCarrot(elementsRef.current[index], next);
        return next;
      });
      frame = window.requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || document.hidden) return;
      last = 0;
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [layout, reducedMotion]);

  return (
    <div className="visit-dashboard-carrot-field" aria-hidden="true">
      {layers.map((layer, index) => (
        <img
          className={`visit-dashboard-carrot-field__carrot is-${layer}`}
          key={`${layer}-${index}`}
          ref={(element) => {
            elementsRef.current[index] = element;
          }}
          src={CARROT_SRC}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      ))}
    </div>
  );
}

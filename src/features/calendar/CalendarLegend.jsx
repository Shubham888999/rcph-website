import { useState } from "react";
import { AVENUES } from "./avenues.js";

export default function CalendarLegend({ headingLevel = "h2" }) {
  const Heading = headingLevel;
  const [activeAvenueCode, setActiveAvenueCode] = useState("");

  function toggleAvenue(code) {
    setActiveAvenueCode((currentCode) => (currentCode === code ? "" : code));
  }

  return (
    <aside className="calendar-legend" aria-labelledby="calendar-legend-title">
      <p className="calendar-kicker">Color guide</p>
      <Heading id="calendar-legend-title">Event avenues</Heading>
      <ul>
        {AVENUES.map((avenue) => {
          const isActive = activeAvenueCode === avenue.code;
          const bubbleId = `calendar-legend-${avenue.code.toLowerCase()}-label`;

          return (
            <li className={`calendar-legend__item${isActive ? " is-active" : ""}`} key={avenue.code}>
              <button
                className="calendar-legend__button"
                type="button"
                aria-expanded={isActive}
                aria-describedby={isActive ? bubbleId : undefined}
                onClick={() => toggleAvenue(avenue.code)}
              >
                <span
                  className={`calendar-legend__swatch calendar-legend__swatch--${avenue.code.toLowerCase()}`}
                  aria-hidden="true"
                />
                <span className="calendar-legend__text">
                  <strong>{avenue.code}</strong>
                  <span className="calendar-legend__label">{avenue.label}</span>
                </span>
              </button>
              {isActive ? (
                <span className="calendar-legend__bubble" id={bubbleId} role="status">
                  {avenue.label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

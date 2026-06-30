import { AVENUES } from "./avenues.js";

export default function CalendarLegend({ headingLevel = "h2" }) {
  const Heading = headingLevel;

  return (
    <aside className="calendar-legend" aria-labelledby="calendar-legend-title">
      <p className="calendar-kicker">Color guide</p>
      <Heading id="calendar-legend-title">Event avenues</Heading>
      <ul>
        {AVENUES.map((avenue) => (
          <li key={avenue.code}>
            <span
              className={`calendar-legend__swatch calendar-legend__swatch--${avenue.code.toLowerCase()}`}
              aria-hidden="true"
            />
            <span><strong>{avenue.code}</strong>{avenue.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

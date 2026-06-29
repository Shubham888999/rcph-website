import { AVENUES } from "./avenues.js";

export default function CalendarLegend() {
  return (
    <aside className="calendar-legend" aria-labelledby="calendar-legend-title">
      <p className="calendar-kicker">Color guide</p>
      <h2 id="calendar-legend-title">Event avenues</h2>
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

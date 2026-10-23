import { useEffect, useState } from "react";
import { INDIA_MAP_SIZE, loadIndiaMapPaths } from "./indiaMapProjection.js";
import "../../styles/components/collaboration-map.css";

const ROLE_LABELS = Object.freeze({
  host: "RCPH hosted",
  cohost: "Co-hosted",
  collaborator: "RCPH collaborated",
  participant: "RCPH participated",
});

function defaultFormatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// A gentle curve from home to a city, bowing upward so lines fan out instead of overlapping.
function curvePath(from, to) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = Math.min(length * 0.22, 60);
  let nx = -dy / length;
  let ny = dx / length;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return `M${from.x},${from.y} Q${midX + nx * bend},${midY + ny * bend} ${to.x},${to.y}`;
}

function markerRadius(clubCount) {
  return 5 + Math.sqrt(clubCount) * 2.4;
}

function percent(value, total) {
  return `${(value / total) * 100}%`;
}

function CityCard({ city, formatDate }) {
  if (!city) {
    return (
      <div className="collab-map__card collab-map__card--empty">
        <p>Select a city on the map to see the clubs there.</p>
      </div>
    );
  }

  return (
    <div className="collab-map__card" aria-live="polite">
      <p className="collab-map__card-kicker">{city.state}</p>
      <h3 className="collab-map__card-title">{city.city}</h3>
      <p className="collab-map__card-count">
        {city.clubCount} {city.clubCount === 1 ? "club" : "clubs"}
      </p>
      <ul className="collab-map__clubs">
        {city.clubs.map((club) => (
          <li key={club.key}>
            <strong>{club.kind === "organization" ? club.name : `Rotaract Club of ${club.name}`}</strong>
            <span className="collab-map__club-district">{club.district}</span>
            <ul className="collab-map__events">
              {club.events.map((event) => (
                <li key={event.eventId}>
                  <span>{event.name}</span>
                  <small>
                    {formatDate(event.date)} · {ROLE_LABELS[event.rcphRole] || ROLE_LABELS.host}
                  </small>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

// India map of collaborations: a home marker, a line to every partner city and a card per city.
// `geography` comes from buildCollaborationGeography(); the component has no data source of its own,
// so it can be reused on public pages.
export default function CollaborationMap({ geography, formatDate = defaultFormatDate }) {
  const [paths, setPaths] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedKey, setSelectedKey] = useState(geography.cities[0]?.key || null);
  const { home, cities } = geography;
  const { width, height } = INDIA_MAP_SIZE;
  const selectedCity = cities.find((city) => city.key === selectedKey) || null;

  useEffect(() => {
    let active = true;
    loadIndiaMapPaths()
      .then((module) => {
        if (active) setPaths(module);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="collab-map">
      <figure className="collab-map__figure">
        <div className="collab-map__canvas" style={{ aspectRatio: `${width} / ${height}` }}>
          {paths ? (
            <svg
              className="collab-map__svg"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`Map of India showing collaborations from ${home.city} with clubs in ${cities.map((city) => city.city).join(", ")}`}
            >
              <path className="collab-map__land" d={paths.INDIA_OUTLINE_PATH} />
              <g className="collab-map__states">
                {paths.INDIA_STATE_PATHS.map((state) => (
                  <path key={state.name} d={state.d} />
                ))}
              </g>
              <g className="collab-map__routes">
                {cities
                  .filter((city) => city.key !== home.key)
                  .map((city) => (
                    <path
                      key={city.key}
                      className={`collab-map__route${city.key === selectedKey ? " is-selected" : ""}`}
                      d={curvePath(home, city)}
                      pathLength="1"
                    />
                  ))}
              </g>
              <g className="collab-map__home" transform={`translate(${home.x} ${home.y})`}>
                <circle r="11" className="collab-map__home-halo" />
                <path d="M0,-7 L2,-2 L7,-2 L3,1.5 L4.5,7 L0,3.6 L-4.5,7 L-3,1.5 L-7,-2 L-2,-2 Z" className="collab-map__home-star" />
              </g>
              {cities.map((city) => {
                const radius = markerRadius(city.clubCount);
                const isHome = city.key === home.key;
                const labelX = city.labelSide === "left" ? -(radius + 6) : radius + 6;
                return (
                  <g
                    key={city.key}
                    className={`collab-map__city${city.key === selectedKey ? " is-selected" : ""}${isHome ? " is-home" : ""}`}
                    transform={`translate(${city.x} ${city.y})`}
                  >
                    {isHome ? null : <circle r={radius} className="collab-map__dot" />}
                    <text
                      x={labelX}
                      y={isHome ? 22 : 4}
                      textAnchor={isHome ? "middle" : city.labelSide === "left" ? "end" : "start"}
                      className="collab-map__label"
                    >
                      {city.city}
                      <tspan className="collab-map__label-count"> {city.clubCount}</tspan>
                    </text>
                  </g>
                );
              })}
              {cities.some((city) => city.key === home.key) ? null : (
                <text x={home.x} y={home.y + 22} textAnchor="middle" className="collab-map__label">
                  {home.city}
                </text>
              )}
            </svg>
          ) : (
            <div className="collab-map__loading" role="status">
              {loadFailed ? "The map could not be loaded. The list below has every collaboration." : "Loading map…"}
            </div>
          )}

          {paths
            ? cities.map((city) => (
                <button
                  key={city.key}
                  type="button"
                  className="collab-map__hit"
                  style={{ left: percent(city.x, width), top: percent(city.y, height) }}
                  aria-pressed={city.key === selectedKey}
                  aria-label={`${city.city}, ${city.clubCount} ${city.clubCount === 1 ? "club" : "clubs"}`}
                  onClick={() => setSelectedKey(city.key)}
                  onMouseEnter={() => setSelectedKey(city.key)}
                />
              ))
            : null}
        </div>
        <figcaption className="collab-map__legend">
          <span className="collab-map__legend-item">
            <span className="collab-map__legend-home" aria-hidden="true" /> {home.city}
          </span>
          <span className="collab-map__legend-item">
            <span className="collab-map__legend-dot" aria-hidden="true" /> Partner clubs
          </span>
        </figcaption>
        <p className="collab-map__credit">Map data: DataMeet, Survey of India outline (CC BY 2.5 India).</p>
      </figure>

      <CityCard city={selectedCity} formatDate={formatDate} />
    </div>
  );
}

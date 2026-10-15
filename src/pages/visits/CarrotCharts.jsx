import {
  carrotFillPercent,
  carrotLengthPercent,
  plantedCarrotHeight,
} from "../../features/visits/visitDashboardModel.js";

// DZR carrot theme only. Fills come from scoped CSS classes; the numbers
// stay visible as text next to every chart.
const PLANTED_CARROT_MAX_HEIGHT = 46;

function LeafTuftHorizontal({ height }) {
  return (
    <svg
      className="visit-dashboard-carrot-leaf"
      viewBox="0 0 26 24"
      height={height}
      width={Math.round((height * 26) / 24)}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M26 12 C18 10 10 2 2 1 C8 6 14 9 26 12Z M26 12 C16 11 6 11 0 12 C6 13 16 13 26 12Z M26 12 C18 14 10 22 2 23 C8 18 14 15 26 12Z" />
    </svg>
  );
}

function LeafTuftVertical() {
  return (
    <svg className="visit-dashboard-carrot-leaf" viewBox="0 0 16 14" width="16" height="14" aria-hidden="true" focusable="false">
      <path d="M8 14 C7 9 3 5 1 1 C5 3 7 7 8 14Z M8 14 C7 9 7 4 8 0 C9 4 9 9 8 14Z M8 14 C9 7 11 3 15 1 C13 5 9 9 8 14Z" />
    </svg>
  );
}

// Attendance tree: the body is the track; the orange fill is rate% of the
// body, measured without the leaf.
export function CarrotTreeBar({ rate, label, size }) {
  const fill = carrotFillPercent(rate);
  return (
    <div className={`visit-dashboard-carrot-bar is-${size}`} role="img" aria-label={label}>
      <LeafTuftHorizontal height={size === "large" ? 30 : size === "medium" ? 24 : 20} />
      <span className="visit-dashboard-carrot-bar__body">
        {rate === null ? null : (
          <span className="visit-dashboard-carrot-bar__fill" style={{ width: `${fill}%` }} />
        )}
      </span>
    </div>
  );
}

// Events held: one planted carrot per avenue, height linear from zero.
export function PlantedCarrots({ bars, label }) {
  const maxCount = Math.max(0, ...bars.map((bar) => bar.count));
  return (
    <div className="visit-dashboard-planted" role="img" aria-label={label}>
      {bars.map((bar) => (
        <span className="visit-dashboard-planted__plant" key={bar.avenueCode} title={`${bar.avenueName || bar.avenueCode}: ${bar.count}`}>
          <LeafTuftVertical />
          <i
            className="visit-dashboard-planted__body"
            style={{ height: `${plantedCarrotHeight(bar.count, maxCount, PLANTED_CARROT_MAX_HEIGHT)}px` }}
          />
        </span>
      ))}
    </div>
  );
}

// Avenue-wise events: a whole carrot whose body length is count / max of
// the track after the leaf; thickness never changes.
export function AvenueCarrot({ count, maxCount }) {
  return (
    <span className="visit-dashboard-avenue-carrot" aria-hidden="true">
      <LeafTuftHorizontal height={18} />
      <span className="visit-dashboard-avenue-carrot__track">
        <span className="visit-dashboard-avenue-carrot__body" style={{ width: `${carrotLengthPercent(count, maxCount)}%` }} />
      </span>
    </span>
  );
}

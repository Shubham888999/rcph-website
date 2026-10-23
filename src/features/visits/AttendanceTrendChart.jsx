const Y_TICKS = [100, 75, 50, 25, 0];

function average(points) {
  return points.length ? Math.round(points.reduce((sum, point) => sum + point.rate, 0) / points.length) : null;
}

function chartLabel(series) {
  const parts = series
    .filter((line) => line.points.length)
    .map((line) => `${line.label}: ${line.points.length} ${line.points.length === 1 ? "record" : "records"}, average ${average(line.points)}%`);
  return `Attendance trend from July. ${parts.join(". ")}.`;
}

// Attendance % per event, one line for club records and one for BOD meetings.
// Lines are drawn in a stretched SVG; dots and labels are HTML so they stay round
// and readable at any width. `animated` draws the lines left to right.
export default function AttendanceTrendChart({ trend, animated = false }) {
  if (!trend?.hasPoints) {
    return (
      <div className="visit-trend visit-trend--empty">
        <p>No attendance records with a date yet.</p>
      </div>
    );
  }

  return (
    <figure className={animated ? "visit-trend is-animated" : "visit-trend"}>
      <figcaption className="visit-trend__head">
        <strong>Attendance trend</strong>
        <ul className="visit-trend__legend" aria-hidden="true">
          {trend.series.map((line) => (
            <li className={`is-${line.key}`} key={line.key}>
              <i />
              {line.label}
            </li>
          ))}
        </ul>
      </figcaption>

      <div className="visit-trend__chart" role="img" aria-label={chartLabel(trend.series)}>
        <ol className="visit-trend__y" aria-hidden="true">
          {Y_TICKS.map((tick) => (
            <li key={tick} style={{ bottom: `${tick}%` }}>{tick}%</li>
          ))}
        </ol>

        <div className="visit-trend__area" aria-hidden="true">
          {Y_TICKS.map((tick) => (
            <span className="visit-trend__grid" key={tick} style={{ bottom: `${tick}%` }} />
          ))}
          {trend.months.slice(1).map((month) => (
            <span className="visit-trend__month" key={month.key} style={{ left: `${month.x * 100}%` }} />
          ))}
          <svg className="visit-trend__lines" viewBox="0 0 1000 100" preserveAspectRatio="none" focusable="false">
            {trend.series.map((line) => (line.points.length > 1 ? (
              <polyline
                className={`is-${line.key}`}
                key={line.key}
                points={line.points.map((point) => `${(point.x * 1000).toFixed(1)},${100 - point.rate}`).join(" ")}
                vectorEffect="non-scaling-stroke"
              />
            ) : null))}
          </svg>
          {trend.series.flatMap((line) => line.points.map((point) => (
            <span
              className={`visit-trend__dot is-${line.key}`}
              key={`${line.key}:${point.eventId}`}
              style={{ left: `${point.x * 100}%`, bottom: `${point.rate}%` }}
              title={`${line.label}: ${point.title}, ${point.dateLabel}, ${point.rate}%`}
            />
          )))}
        </div>

        <ol className="visit-trend__x" aria-hidden="true">
          {trend.months.map((month) => (
            <li key={month.key} style={{ left: `${month.mid * 100}%` }}>{month.label}</li>
          ))}
        </ol>
      </div>
    </figure>
  );
}

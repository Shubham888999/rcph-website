const TYPE_OPTIONS = [
  ["", "All types"], ["clubEvent", "Club Events"], ["bodMeeting", "BOD Meetings"], ["districtEvent", "District Events"], ["unknown", "Unknown type"],
];

export default function BodEventFilters({ filters, onChange, onReset, avenues, months, resultCount }) {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value });
  return (
    <div className="bod-event-filters" aria-label="Submission filters" data-result-count={resultCount}>
      <div className="bod-filter-grid">
        <label>Search<input type="search" value={filters.search} onChange={set("search")} placeholder="Name, description, host…" /></label>
        <label>Status<select value={filters.status} onChange={set("status")}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
        <label>Type<select value={filters.type} onChange={set("type")}>{TYPE_OPTIONS.map(([value, label]) => <option value={value} key={value || "all"}>{label}</option>)}</select></label>
        <label>Avenue<select value={filters.avenue} onChange={set("avenue")}><option value="">All avenues</option>{avenues.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Month<select value={filters.month} onChange={set("month")}><option value="">All months</option>{months.map((value) => <option key={value} value={value}>{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(Number(value.slice(0, 4)), Number(value.slice(5)) - 1, 1))}</option>)}</select></label>
        <label className="bod-filter-check"><input type="checkbox" checked={filters.mine} onChange={set("mine")} /> My submissions</label>
      </div>
      <button type="button" className="bod-button bod-button--quiet" onClick={onReset}>Reset filters</button>
    </div>
  );
}

import { useMemo, useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import {
  ATTENDANCE_EXPORT_PANELS,
  createAttendanceExportReport,
  filterAttendanceEvents,
  selectFilteredAttendanceEvents,
  toggleAttendanceEventSelection,
} from "./attendanceExportModel";
import { downloadAttendanceWorkbook } from "./attendanceWorkbook";

function displayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "Date unavailable";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AttendanceExportPanel({ panelKey, members, events, attendance, onNotice }) {
  const panel = ATTENDANCE_EXPORT_PANELS[panelKey];
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", dateFrom: "", dateTo: "", category: "" });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const categories = useMemo(() => [...new Set(events.map((event) => panel.getCategory(event)).filter(Boolean))].sort(), [events, panel]);
  const filteredEvents = useMemo(() => filterAttendanceEvents(events, filters).filter((event) => (
    !filters.category || panel.getCategory(event) === filters.category
  )), [events, filters, panel]);
  const selectedEvents = events.filter((event) => selectedIds.has(event.id));
  const selectedRowCount = selectedEvents.length * members.length;

  async function download() {
    if (!selectedEvents.length || exporting) return;
    setExporting(true);
    setError("");
    try {
      const report = createAttendanceExportReport(panelKey, {
        members,
        events,
        attendance,
        selectedEventIds: [...selectedIds],
      });
      await downloadAttendanceWorkbook(report);
      onNotice?.({ type: "success", message: `${report.events.length} attendance event${report.events.length === 1 ? "" : "s"} exported to Excel.` });
    } catch {
      setError("The Excel workbook could not be generated. No attendance data was changed.");
    } finally {
      setExporting(false);
    }
  }

  if (!panel) return null;
  return <>
    <section className="admin-panel attendance-export-launcher">
      <div>
        <p className="admin-kicker">Spreadsheet export</p>
        <h3>Export attendance</h3>
        <p>Select specific events and download one Excel workbook containing only this panel’s visible attendance roster.</p>
      </div>
      <button type="button" disabled={!events.length || !members.length} onClick={() => setOpen(true)}>Export attendance</button>
    </section>
    {open ? <AdminDialog title={`Export ${panel.title}`} busy={exporting} onClose={() => setOpen(false)} className="admin-dialog--wide">
      <section className="attendance-export" aria-describedby="attendance-export-summary">
        <div className="attendance-export__filters">
          <label>Search event<input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Event name" /></label>
          <label>Date from<input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
          <label>Date to<input type="date" min={filters.dateFrom} value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
          {categories.length > 1 ? <label>{panel.categoryLabel}<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label> : null}
        </div>
        <div className="attendance-export__selection-actions">
          <button type="button" onClick={() => setSelectedIds(selectFilteredAttendanceEvents(selectedIds, filteredEvents))} disabled={!filteredEvents.length}>Select all filtered</button>
          <button type="button" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>Clear selection</button>
        </div>
        <p id="attendance-export-summary" aria-live="polite"><strong>{selectedEvents.length}</strong> event{selectedEvents.length === 1 ? "" : "s"} selected · approximately <strong>{selectedRowCount}</strong> attendance row{selectedRowCount === 1 ? "" : "s"}</p>
        <fieldset className="attendance-export__events">
          <legend>Available events</legend>
          {filteredEvents.length ? <ul>{filteredEvents.map((event) => <li key={event.id}><label><input type="checkbox" checked={selectedIds.has(event.id)} onChange={(change) => setSelectedIds(toggleAttendanceEventSelection(selectedIds, event.id, change.target.checked))} /><span><strong>{event.name}</strong><small>{displayDate(event.date)} · {panel.getCategory(event)}</small></span></label></li>)}</ul> : <p>No events match the current filters.</p>}
        </fieldset>
        {error ? <p role="alert" className="attendance-export__error">{error}</p> : null}
        <div className="admin-actions attendance-export__download">
          <button type="button" onClick={() => setOpen(false)} disabled={exporting}>Cancel</button>
          <button type="button" onClick={download} disabled={!selectedEvents.length || exporting}>{exporting ? "Building workbook…" : "Download Excel"}</button>
        </div>
      </section>
    </AdminDialog> : null}
  </>;
}

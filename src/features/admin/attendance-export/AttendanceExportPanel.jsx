import { useMemo, useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import {
  ATTENDANCE_EXPORT_PANELS,
  attendanceMonthKey,
  buildMonthlyAttendanceExport,
  eventsInMonths,
  listAttendanceMonths,
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

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function AttendanceExportPanel({ panelKey, members, events, attendance, onNotice, bod }) {
  const panel = ATTENDANCE_EXPORT_PANELS[panelKey];
  const [open, setOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [includeBod, setIncludeBod] = useState(true);
  const [includeProspects, setIncludeProspects] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const months = useMemo(() => listAttendanceMonths(events), [events]);
  const monthEvents = useMemo(() => eventsInMonths(events, selectedMonths), [events, selectedMonths]);
  const selectedEvents = monthEvents.filter((event) => selectedIds.has(event.id));
  const bodAvailable = Boolean(bod) && Array.isArray(bod.members) && bod.members.length > 0;

  function openDialog() {
    setSelectedMonths(new Set(months.length ? [months[0].key] : []));
    setSelectedIds(new Set());
    setError("");
    setOpen(true);
  }

  function toggleMonth(monthKey, checked) {
    const next = new Set(selectedMonths);
    if (checked) {
      next.add(monthKey);
    } else {
      next.delete(monthKey);
      setSelectedIds(new Set([...selectedIds].filter((id) => {
        const event = events.find((item) => item.id === id);
        return event && attendanceMonthKey(event.date) !== monthKey;
      })));
    }
    setSelectedMonths(next);
  }

  async function download() {
    if (!selectedEvents.length || exporting) return;
    setExporting(true);
    setError("");
    try {
      const report = buildMonthlyAttendanceExport({
        panelKey,
        primary: { members, events, attendance },
        bod: bodAvailable ? bod : null,
        monthKeys: [...selectedMonths],
        selectedEventIds: selectedEvents.map((event) => event.id),
        includeProspects,
        includeBod: bodAvailable ? includeBod : false,
      });
      await downloadAttendanceWorkbook(report);
      const exportedCount = report.months.reduce((total, month) => total + month.sections[0].events.length, 0);
      onNotice?.({ type: "success", message: `${exportedCount} attendance event${exportedCount === 1 ? "" : "s"} exported to Excel.` });
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
      <button type="button" disabled={!events.length || !members.length} onClick={openDialog}>Export attendance</button>
    </section>
    {open ? <AdminDialog title={`Export ${panel.title}`} busy={exporting} onClose={() => setOpen(false)} className="admin-dialog--wide">
      <section className="attendance-export" aria-describedby="attendance-export-summary">
        <fieldset className="attendance-export__events">
          <legend>Months</legend>
          {months.length ? <ul>{months.map((month) => <li key={month.key}><label><input type="checkbox" checked={selectedMonths.has(month.key)} onChange={(change) => toggleMonth(month.key, change.target.checked)} /><span><strong>{month.label} · {plural(month.eventCount, "event")}</strong></span></label></li>)}</ul> : <p>No events are available to export.</p>}
        </fieldset>
        <div className="attendance-export__selection-actions">
          <button type="button" onClick={() => setSelectedIds(new Set([...selectedIds, ...monthEvents.map((event) => event.id)]))} disabled={!monthEvents.length}>Select all events</button>
          <button type="button" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>Clear selection</button>
        </div>
        <fieldset className="attendance-export__events">
          <legend>Events</legend>
          {monthEvents.length ? <ul>{monthEvents.map((event) => <li key={event.id}><label><input type="checkbox" checked={selectedIds.has(event.id)} onChange={(change) => setSelectedIds(toggleAttendanceEventSelection(selectedIds, event.id, change.target.checked))} /><span><strong>{event.name}</strong><small>{displayDate(event.date)} · {panel.getCategory(event)}</small></span></label></li>)}</ul> : <p>Select a month to see its events.</p>}
        </fieldset>
        {bod ? (
          <label className="attendance-export__option">
            <input
              type="checkbox"
              checked={bodAvailable && includeBod}
              disabled={!bodAvailable}
              onChange={(event) => setIncludeBod(event.target.checked)}
            />
            {bodAvailable ? "Include BOD attendance" : "BOD attendance unavailable"}
          </label>
        ) : null}
        {panelKey === "club" || panelKey === "district" ? (
          <label className="attendance-export__option">
            <input
              type="checkbox"
              checked={includeProspects}
              onChange={(event) => setIncludeProspects(event.target.checked)}
            />
            Include prospects
          </label>
        ) : null}
        <p id="attendance-export-summary" aria-live="polite"><strong>{plural(selectedEvents.length, "event")}</strong> across <strong>{plural(selectedMonths.size, "month")}</strong> selected</p>
        {error ? <p role="alert" className="attendance-export__error">{error}</p> : null}
        <div className="admin-actions attendance-export__download">
          <button type="button" onClick={() => setOpen(false)} disabled={exporting}>Cancel</button>
          <button type="button" onClick={download} disabled={!selectedEvents.length || exporting}>{exporting ? "Building workbook…" : "Download Excel"}</button>
        </div>
      </section>
    </AdminDialog> : null}
  </>;
}

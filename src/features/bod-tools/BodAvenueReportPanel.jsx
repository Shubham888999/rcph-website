import { useEffect, useMemo, useState } from "react";
import {
  BOD_AVENUE_REPORT_LIMIT,
  REPORTABLE_BOD_AVENUES,
  buildBodAvenueReportModel,
  createBodAvenueSelection,
  filterBodAvenueReportEvents,
  normalizeBodAvenueDirectors,
  toggleBodAvenueEvent,
} from "./bodAvenueReportModel";
import { fetchBodAvenueReportDirectors } from "./bodEventService";

const EMPTY_DIRECTORS = Object.freeze([]);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function eventDateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Date unavailable";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day, 12));
}

function createPreview(options) {
  try { return buildBodAvenueReportModel(options); } catch { return null; }
}

export default function BodAvenueReportPanel({ events, onNotice }) {
  const [month, setMonth] = useState(currentMonth);
  const [avenueCode, setAvenueCode] = useState("");
  const [selection, setSelection] = useState(() => ({ scope: "", ids: new Set() }));
  const [directorData, setDirectorData] = useState(() => ({ avenueCode: "", state: "idle", directors: [] }));
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const matchingEvents = useMemo(
    () => filterBodAvenueReportEvents(events, { month, avenueCode }),
    [events, month, avenueCode],
  );
  const selectionScope = `${month}|${avenueCode}|${matchingEvents.map((event) => event.id).join("|")}`;
  const selectedIds = selection.scope === selectionScope ? selection.ids : createBodAvenueSelection(matchingEvents);
  const directors = directorData.avenueCode === avenueCode ? directorData.directors : EMPTY_DIRECTORS;
  const directorState = directorData.avenueCode === avenueCode ? directorData.state : (avenueCode ? "loading" : "idle");
  const selectedEvents = useMemo(
    () => matchingEvents.filter((event) => selectedIds.has(event.id)),
    [matchingEvents, selectedIds],
  );

  useEffect(() => {
    let cancelled = false;
    if (!avenueCode) return undefined;
    fetchBodAvenueReportDirectors(avenueCode).then((payload) => {
      if (cancelled) return;
      setDirectorData({ avenueCode, state: "success", directors: normalizeBodAvenueDirectors(payload, avenueCode) });
    }).catch(() => {
      if (cancelled) return;
      setDirectorData({ avenueCode, state: "error", directors: [] });
    });
    return () => { cancelled = true; };
  }, [avenueCode]);

  const preview = useMemo(() => createPreview({
    month,
    avenueCode,
    events,
    selectedEventIds: selectedIds,
    directors,
  }), [avenueCode, directors, events, month, selectedIds]);
  const tooMany = selectedEvents.length > BOD_AVENUE_REPORT_LIMIT;
  const canDownload = Boolean(preview && directorState !== "loading" && !tooMany && !downloading);

  async function download() {
    if (!canDownload) return;
    setDownloading(true);
    setMessage("");
    try {
      const finalized = buildBodAvenueReportModel({
        month,
        avenueCode,
        events,
        selectedEventIds: selectedIds,
        directors,
        generatedAt: new Date(),
      });
      const { downloadBodAvenueReportPdf } = await import("./bodAvenueReportPdf.js");
      await downloadBodAvenueReportPdf(finalized);
      setMessage(`${finalized.eventCount} event${finalized.eventCount === 1 ? "" : "s"} included in the PDF download.`);
      onNotice?.({ type: "success", message: "Monthly avenue report downloaded. No event records were changed." });
    } catch (error) {
      setMessage(error?.message || "The report could not be generated. Please review the selected events and try again.");
      onNotice?.({ type: "error", message: error?.message || "The report could not be generated." });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="bod-avenue-report" aria-labelledby="bod-avenue-report-title">
      <div className="bod-avenue-report__heading">
        <div>
          <p className="bod-tools-kicker">Read-only reporting</p>
          <h2 id="bod-avenue-report-title">Monthly Avenue Report</h2>
          <p>Generate a monthly summary of events conducted under a selected avenue.</p>
        </div>
        <span>Maximum {BOD_AVENUE_REPORT_LIMIT} events</span>
      </div>

      <div className="bod-avenue-report__filters">
        <label htmlFor="bod-report-month">Month<input id="bod-report-month" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setShowPreview(false); setMessage(""); }} /></label>
        <label htmlFor="bod-report-avenue">Avenue<select id="bod-report-avenue" value={avenueCode} onChange={(event) => { const next = event.target.value; setAvenueCode(next); setDirectorData({ avenueCode: next, state: next ? "loading" : "idle", directors: [] }); setShowPreview(false); setMessage(""); }}><option value="">Select an avenue</option>{REPORTABLE_BOD_AVENUES.map((avenue) => <option key={avenue.code} value={avenue.code}>{avenue.label}</option>)}</select></label>
      </div>

      {avenueCode ? <p className="bod-avenue-report__director">
        <strong>Director(s):</strong>{" "}
        {directorState === "loading" ? "Loading current assignments..." : directors.length
          ? directors.map((director) => `${director.name} (${director.positionTitle})`).join(", ")
          : "Not available"}
        {directorState === "error" ? <small> Current assignments could not be loaded; this does not block a report marked Not available.</small> : null}
      </p> : null}

      <div className="bod-avenue-report__selection-actions">
        <button type="button" onClick={() => setSelection({ scope: selectionScope, ids: createBodAvenueSelection(matchingEvents) })} disabled={!matchingEvents.length || selectedEvents.length === matchingEvents.length}>Select all events</button>
        <button type="button" onClick={() => setSelection({ scope: selectionScope, ids: new Set() })} disabled={!selectedIds.size}>Clear selection</button>
        <span aria-live="polite"><strong>{selectedEvents.length}</strong> event{selectedEvents.length === 1 ? "" : "s"} selected</span>
      </div>

      <fieldset className="bod-avenue-report__events">
        <legend>Eligible events</legend>
        {!month || !avenueCode ? <p>Select a month and avenue to find reportable events.</p> : matchingEvents.length ? <ul>{matchingEvents.map((event) => <li key={event.id}><label htmlFor={`bod-report-event-${event.id}`}><input id={`bod-report-event-${event.id}`} type="checkbox" checked={selectedIds.has(event.id)} onChange={(change) => setSelection({ scope: selectionScope, ids: toggleBodAvenueEvent(selectedIds, event.id, change.target.checked) })} /><span><strong>{event.name}</strong><small>{eventDateLabel(event.startDate)} · {event.avenues.join(" · ")} · {event.rcphRole} · Active</small></span></label></li>)}</ul> : <p>No reportable events were found for this avenue and month.</p>}
      </fieldset>

      {tooMany ? <p role="alert" className="bod-avenue-report__error">Select no more than {BOD_AVENUE_REPORT_LIMIT} events.</p> : null}
      <div className="bod-avenue-report__actions">
        <button type="button" onClick={() => setShowPreview(true)} disabled={!preview || tooMany}>Preview report</button>
        <button type="button" className="bod-button--primary" onClick={download} disabled={!canDownload}>{downloading ? "Generating PDF..." : "Download PDF"}</button>
      </div>

      {showPreview && preview ? <section className="bod-avenue-report__preview" aria-labelledby="bod-report-preview-title">
        <h3 id="bod-report-preview-title">Report preview</h3>
        <dl><div><dt>Month</dt><dd>{preview.monthLabel}</dd></div><div><dt>Avenue</dt><dd>{preview.avenueLabel}</dd></div><div><dt>Director(s)</dt><dd>{preview.directorText}</dd></div><div><dt>Events</dt><dd>{preview.eventCount}</dd></div></dl>
        <ol>{preview.events.map((event, index) => <li key={`${event.date}-${event.name}-${index}`}><strong>{event.name}</strong><span>{event.dateLabel} · {event.role}</span></li>)}</ol>
      </section> : null}
      {message ? <p className={message.startsWith("The report") ? "bod-avenue-report__error" : "bod-avenue-report__success"} role={message.startsWith("The report") ? "alert" : "status"} aria-live="polite">{message}</p> : null}
    </section>
  );
}

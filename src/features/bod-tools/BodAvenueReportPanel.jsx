import { useEffect, useMemo, useState } from "react";
import {
  BOD_AVENUE_REPORT_APPEARANCE_OPTIONS,
  BOD_AVENUE_REPORT_DEFAULT_APPEARANCE,
  BOD_AVENUE_REPORT_LIMIT,
  REPORTABLE_BOD_AVENUES,
  buildBodAvenueReportModel,
  createBodAvenueSelection,
  filterBodAvenueReportEvents,
  formatBodReportMonth,
  getBodAvenueReportMonthOptions,
  normalizeBodAvenueDirectors,
  normalizeBodReportAvenueCodes,
  normalizeBodReportMonths,
  toggleBodAvenueEvent,
} from "./bodAvenueReportModel";
import { buildBodSecretarialReportModel } from "./bodSecretarialReportModel";
import { fetchBodAvenueReportDirectors, fetchBodSecretarialReportMetrics } from "./bodEventService";

const EMPTY_DIRECTOR_MAP = Object.freeze({});

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

function reportItemDate(event) {
  return event?.startDate || event?.date || event?.eventStart || "";
}

function cleanRequired(value) {
  return String(value || "").trim();
}

function getSecretarialValidationErrors({ selectedMonths, clubScore, clubRank }) {
  const errors = [];
  if (!selectedMonths.length) errors.push("Select at least one month.");
  if (!cleanRequired(clubScore)) errors.push("Club Score is required.");
  if (!cleanRequired(clubRank)) errors.push("Club Rank (As of Now) is required.");
  return errors;
}

function formatReportAmount(value) {
  return `INR ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function createPreview(options) {
  try { return buildBodAvenueReportModel(options); } catch { return null; }
}

function toggleValue(values, value, checked, normalize) {
  const next = new Set(values);
  if (checked) next.add(value);
  else next.delete(value);
  return normalize([...next]);
}

function appearanceLabel(options, value) {
  return options.find((item) => item.value === value)?.label || value;
}

export default function BodAvenueReportPanel({ events, onNotice }) {
  const [selectedMonths, setSelectedMonths] = useState(() => [currentMonth()]);
  const [selectedAvenueCodes, setSelectedAvenueCodes] = useState([]);
  const [secretarialMode, setSecretarialMode] = useState(false);
  const [clubScore, setClubScore] = useState("");
  const [clubRank, setClubRank] = useState("");
  const [selection, setSelection] = useState(() => ({ scope: "", ids: new Set() }));
  const [directorData, setDirectorData] = useState(() => ({ scope: "", state: "idle", directorsByAvenue: {} }));
  const [appearance, setAppearance] = useState(BOD_AVENUE_REPORT_DEFAULT_APPEARANCE);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const monthOptions = useMemo(() => getBodAvenueReportMonthOptions(events, selectedMonths[0] || currentMonth()), [events, selectedMonths]);
  const matchingEvents = useMemo(
    () => filterBodAvenueReportEvents(events, { selectedMonths, selectedAvenueCodes }),
    [events, selectedAvenueCodes, selectedMonths],
  );
  const matchingReportItems = matchingEvents;
  const selectionScope = `${selectedMonths.join("|")}::${selectedAvenueCodes.join("|")}::${secretarialMode ? "secretarial" : "avenue"}::${matchingReportItems.map((event) => event.id).join("|")}`;
  // Existing UX reset behavior: when filters change, the valid matching set is selected again.
  const selectedIds = selection.scope === selectionScope ? selection.ids : createBodAvenueSelection(matchingReportItems);
  const selectedEvents = useMemo(
    () => matchingReportItems.filter((event) => selectedIds.has(event.id)),
    [matchingReportItems, selectedIds],
  );
  const directorScope = selectedAvenueCodes.join("|");
  const directorsByAvenue = directorData.scope === directorScope ? directorData.directorsByAvenue : EMPTY_DIRECTOR_MAP;
  const directorState = secretarialMode
    ? "idle"
    : (directorData.scope === directorScope ? directorData.state : (selectedAvenueCodes.length ? "loading" : "idle"));

  useEffect(() => {
    let cancelled = false;
    const scope = selectedAvenueCodes.join("|");
    if (secretarialMode || !scope) return undefined;
    Promise.allSettled(selectedAvenueCodes.map((avenueCode) => fetchBodAvenueReportDirectors(avenueCode).then((payload) => [avenueCode, payload])))
      .then((results) => {
        if (cancelled) return;
        const directors = {};
        let failed = false;
        results.forEach((result) => {
          if (result.status !== "fulfilled") { failed = true; return; }
          const [avenueCode, payload] = result.value;
          directors[avenueCode] = normalizeBodAvenueDirectors(payload, avenueCode);
        });
        setDirectorData({ scope, state: failed ? "error" : "success", directorsByAvenue: directors });
      });
    return () => { cancelled = true; };
  }, [secretarialMode, selectedAvenueCodes]);

  const preview = useMemo(() => {
    if (secretarialMode) return null;
    return createPreview({
      selectedMonths,
      selectedAvenueCodes,
      includeBodMeetings: false,
      events,
      selectedEventIds: selectedIds,
      directorsByAvenue,
      appearance,
    });
  }, [appearance, directorsByAvenue, events, secretarialMode, selectedAvenueCodes, selectedIds, selectedMonths]);
  const tooMany = !secretarialMode && selectedEvents.length > BOD_AVENUE_REPORT_LIMIT;
  const secretarialValidationErrors = useMemo(
    () => getSecretarialValidationErrors({ selectedMonths, clubScore, clubRank }),
    [clubRank, clubScore, selectedMonths],
  );
  const canDownload = secretarialMode
    ? Boolean(!secretarialValidationErrors.length && !downloading)
    : Boolean(preview && directorState !== "loading" && !tooMany && !downloading);

  function updateMonths(next) {
    setSelectedMonths(next);
    setShowPreview(false);
    setMessage("");
  }

  function updateAvenues(next) {
    setSelectedAvenueCodes(next);
    setShowPreview(false);
    setMessage("");
  }

  function updateSecretarialMode(checked) {
    setSecretarialMode(checked);
    if (!checked) {
      setClubScore("");
      setClubRank("");
    }
    setShowPreview(false);
    setMessage("");
  }

  function updateClubScore(value) {
    setClubScore(value);
    setMessage("");
  }

  function updateClubRank(value) {
    setClubRank(value);
    setMessage("");
  }

  function updateAppearance(key, value) {
    setAppearance((current) => ({ ...current, [key]: value }));
    setShowPreview(false);
    setMessage("");
  }

  async function download() {
    if (secretarialMode) {
      if (secretarialValidationErrors.length) {
        setMessage(secretarialValidationErrors[0]);
        return;
      }
      setDownloading(true);
      setMessage("");
      try {
        const metrics = await fetchBodSecretarialReportMetrics();
        const finalized = buildBodSecretarialReportModel({
          selectedMonths,
          events,
          clubScore,
          clubRank,
          metrics,
          generatedAt: new Date(),
        });
        const { downloadBodSecretarialReportPdf } = await import("./bodSecretarialReportPdf.js");
        await downloadBodSecretarialReportPdf(finalized);
        setMessage(`${finalized.periodLabel} Secretarial Report PDF downloaded.`);
        onNotice?.({ type: "success", message: "Secretarial report downloaded. No event records were changed." });
      } catch (error) {
        setMessage(error?.message || "The report could not be generated. Please review the Secretarial Reporting fields and try again.");
        onNotice?.({ type: "error", message: error?.message || "The report could not be generated." });
      } finally {
        setDownloading(false);
      }
      return;
    }
    if (!canDownload) return;
    setDownloading(true);
    setMessage("");
    try {
      const finalized = buildBodAvenueReportModel({
        selectedMonths,
        selectedAvenueCodes,
        includeBodMeetings: false,
        events,
        selectedEventIds: selectedIds,
        directorsByAvenue,
        appearance,
        generatedAt: new Date(),
      });
      const { downloadBodAvenueReportPdf } = await import("./bodAvenueReportPdf.js");
      await downloadBodAvenueReportPdf(finalized);
      setMessage(`${finalized.eventCount} report item${finalized.eventCount === 1 ? "" : "s"} included in the PDF download.`);
      onNotice?.({ type: "success", message: "Monthly avenue report downloaded. No event records were changed." });
    } catch (error) {
      setMessage(error?.message || "The report could not be generated. Please review the selected events and try again.");
      onNotice?.({ type: "error", message: error?.message || "The report could not be generated." });
    } finally {
      setDownloading(false);
    }
  }

  const allVisibleMonths = monthOptions.map((option) => option.value);
  const appearanceText = [
    appearanceLabel(BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.fontFamilies, appearance.fontFamily),
    appearanceLabel(BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.bodySizes, appearance.bodySize),
    appearanceLabel(BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.densities, appearance.density),
  ].join(" / ");

  return (
    <section className="bod-avenue-report" aria-labelledby="bod-avenue-report-title">
      <div className="bod-avenue-report__heading">
        <div>
          <p className="bod-tools-kicker">Read-only reporting</p>
          <h2 id="bod-avenue-report-title">Monthly Avenue Report</h2>
          <p>Generate a monthly summary of events conducted under selected avenues.</p>
        </div>
        <span>Maximum {BOD_AVENUE_REPORT_LIMIT} unique events</span>
      </div>

      <div className="bod-avenue-report__filters">
        <fieldset>
          <legend>Months</legend>
          <div className="bod-avenue-report__mini-actions">
            <button type="button" onClick={() => updateMonths(normalizeBodReportMonths(allVisibleMonths))} disabled={!allVisibleMonths.length || selectedMonths.length === allVisibleMonths.length}>Select all visible months</button>
            <button type="button" onClick={() => updateMonths([])} disabled={!selectedMonths.length}>Clear selection</button>
          </div>
          <div className="bod-avenue-report__check-grid">
            {monthOptions.map((option) => <label key={option.value} htmlFor={`bod-report-month-${option.value}`}><input id={`bod-report-month-${option.value}`} type="checkbox" checked={selectedMonths.includes(option.value)} onChange={(event) => updateMonths(toggleValue(selectedMonths, option.value, event.target.checked, normalizeBodReportMonths))} /> {option.label}</label>)}
          </div>
        </fieldset>

        <fieldset>
          <legend>Avenues</legend>
          <div className="bod-avenue-report__mini-actions">
            <button type="button" onClick={() => updateAvenues(REPORTABLE_BOD_AVENUES.map((avenue) => avenue.code))} disabled={secretarialMode || selectedAvenueCodes.length === REPORTABLE_BOD_AVENUES.length}>Select all</button>
            <button type="button" onClick={() => updateAvenues([])} disabled={secretarialMode || !selectedAvenueCodes.length}>Clear selection</button>
          </div>
          <div className="bod-avenue-report__check-grid">
            {REPORTABLE_BOD_AVENUES.map((avenue) => <label key={avenue.code} htmlFor={`bod-report-avenue-${avenue.code}`}><input id={`bod-report-avenue-${avenue.code}`} type="checkbox" checked={selectedAvenueCodes.includes(avenue.code)} disabled={secretarialMode} onChange={(event) => updateAvenues(toggleValue(selectedAvenueCodes, avenue.code, event.target.checked, normalizeBodReportAvenueCodes))} /> {avenue.label}</label>)}
          </div>
          <div className="bod-avenue-report__mode">
            <label className="bod-avenue-report__mode-toggle" htmlFor="bod-report-secretarial-mode">
              <input id="bod-report-secretarial-mode" type="checkbox" checked={secretarialMode} onChange={(event) => updateSecretarialMode(event.target.checked)} /> Secretarial Reporting
            </label>
            {secretarialMode ? <div className="bod-avenue-report__secretarial-fields">
              <label htmlFor="bod-report-club-score">Club Score<input id="bod-report-club-score" type="text" value={clubScore} onChange={(event) => updateClubScore(event.target.value)} required /></label>
              <label htmlFor="bod-report-club-rank">Club Rank (As of Now)<input id="bod-report-club-rank" type="text" value={clubRank} onChange={(event) => updateClubRank(event.target.value)} required /></label>
            </div> : null}
          </div>
        </fieldset>
      </div>

      {!secretarialMode ? <div className="bod-avenue-report__appearance">
        <label htmlFor="bod-report-font">Font family<select id="bod-report-font" value={appearance.fontFamily} onChange={(event) => updateAppearance("fontFamily", event.target.value)}>{BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.fontFamilies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label htmlFor="bod-report-body-size">Body font size<select id="bod-report-body-size" value={appearance.bodySize} onChange={(event) => updateAppearance("bodySize", event.target.value)}>{BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.bodySizes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label htmlFor="bod-report-density">Table density<select id="bod-report-density" value={appearance.density} onChange={(event) => updateAppearance("density", event.target.value)}>{BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.densities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div> : null}

      {!secretarialMode && selectedAvenueCodes.length ? <p className="bod-avenue-report__director">
        <strong>Director lookup:</strong>{" "}
        {directorState === "loading" ? "Loading current assignments..." : selectedAvenueCodes.length === 1
          ? (directorsByAvenue[selectedAvenueCodes[0]]?.length
            ? directorsByAvenue[selectedAvenueCodes[0]].map((director) => `${director.name} (${director.positionTitle})`).join(", ")
            : "Not available")
          : `${selectedAvenueCodes.length} avenue director groups`}
        {directorState === "error" ? <small> Some current assignments could not be loaded; unavailable groups will be marked Not available.</small> : null}
      </p> : null}

      {secretarialMode ? (
        <section className="bod-avenue-report__secretarial-note" aria-labelledby="bod-report-secretarial-summary">
          <h3 id="bod-report-secretarial-summary">Secretarial Reporting</h3>
          <p>PDF generation uses trusted club strength from the server and does not update event records.</p>
          <dl>
            <div><dt>Selected months</dt><dd>{selectedMonths.length || "None"}</dd></div>
            <div><dt>Club Score</dt><dd>{cleanRequired(clubScore) || "Required"}</dd></div>
            <div><dt>Club Rank (As of Now)</dt><dd>{cleanRequired(clubRank) || "Required"}</dd></div>
          </dl>
          {secretarialValidationErrors.length ? (
            <ul className="bod-avenue-report__secretarial-errors" role="alert">
              {secretarialValidationErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : (
            <p className="bod-avenue-report__success" role="status">Required fields are complete for PDF generation.</p>
          )}
        </section>
      ) : (
        <>
          <div className="bod-avenue-report__selection-actions">
            <button type="button" onClick={() => setSelection({ scope: selectionScope, ids: createBodAvenueSelection(matchingReportItems) })} disabled={!matchingReportItems.length || selectedEvents.length === matchingReportItems.length}>Select all report items</button>
            <button type="button" onClick={() => setSelection({ scope: selectionScope, ids: new Set() })} disabled={!selectedIds.size}>Clear selection</button>
            <span aria-live="polite"><strong>{selectedEvents.length}</strong> selected / <strong>{matchingReportItems.length}</strong> matching report items</span>
            <span>{selectedMonths.length} month{selectedMonths.length === 1 ? "" : "s"}</span>
            <span>{selectedAvenueCodes.length} avenue{selectedAvenueCodes.length === 1 ? "" : "s"}</span>
            {preview ? <span>{preview.groupCount} group{preview.groupCount === 1 ? "" : "s"}</span> : null}
            <span>{appearanceText}</span>
          </div>

          <fieldset className="bod-avenue-report__events">
            <legend>Eligible events</legend>
            {!selectedMonths.length || !selectedAvenueCodes.length ? <p>Select at least one month and one avenue.</p> : matchingReportItems.length ? <ul>{matchingReportItems.map((event) => {
              const date = reportItemDate(event);
              const selectedEventAvenues = (Array.isArray(event.avenues) ? event.avenues : []).filter((code) => selectedAvenueCodes.includes(code));
              const scopeText = `${selectedEventAvenues.join(", ")}${selectedEventAvenues.length > 1 ? " / multi-avenue match" : ""} / ${event.rcphRole}`;
              return <li key={event.id}><label htmlFor={`bod-report-event-${event.id}`}><input id={`bod-report-event-${event.id}`} type="checkbox" checked={selectedIds.has(event.id)} onChange={(change) => setSelection({ scope: selectionScope, ids: toggleBodAvenueEvent(selectedIds, event.id, change.target.checked) })} /><span><strong>{event.name}</strong><small>{eventDateLabel(date)} / {formatBodReportMonth(date.slice(0, 7))} / {scopeText} / Active</small></span></label></li>;
            })}</ul> : <p>No reportable events were found for this selection.</p>}
          </fieldset>

          {tooMany ? <p role="alert" className="bod-avenue-report__error">Select no more than {BOD_AVENUE_REPORT_LIMIT} unique events.</p> : null}
        </>
      )}

      <div className="bod-avenue-report__actions">
        {!secretarialMode ? <button type="button" onClick={() => setShowPreview(true)} disabled={!preview || tooMany}>Preview report</button> : null}
        <button type="button" className="bod-button--primary" onClick={download} disabled={!canDownload}>{downloading ? "Generating PDF..." : "Download PDF"}</button>
      </div>

      {showPreview && preview ? <section className="bod-avenue-report__preview" aria-labelledby="bod-report-preview-title">
        <h3 id="bod-report-preview-title">Report preview</h3>
        <dl>
          <div><dt>{preview.selectedMonths.length > 1 ? "Period" : "Month"}</dt><dd>{preview.periodLabel}</dd></div>
          <div><dt>Avenues</dt><dd>{preview.avenuesLabel}</dd></div>
          <div><dt>Director(s)</dt><dd>{preview.directorLines?.length ? preview.directorLines.map((line, index) => <span className="bod-avenue-report__director-line" key={`${line}-${index}`}>{line}</span>) : preview.directorText}</dd></div>
          <div><dt>Selected events</dt><dd>{preview.eventCount}</dd></div>
          <div><dt>Total expense</dt><dd>{formatReportAmount(preview.grandExpenseTotal)}</dd></div>
          {preview.monthTotals?.length > 1 ? <div><dt>Month expenses</dt><dd>{preview.monthTotals.map((month) => `${month.monthLabel}: ${formatReportAmount(month.monthExpenseTotal)}`).join(" / ")}</dd></div> : null}
          <div><dt>Groups</dt><dd>{preview.groupCount}</dd></div>
        </dl>
        <ol>{preview.events.map((event, index) => {
          const scopeText = event.avenues.join(", ");
          return <li key={`${event.date}-${event.name}-${index}`}><strong>{event.name}</strong><span>{event.dateLabel} / {scopeText} / Expense {formatReportAmount(event.expenseTotal)}</span></li>;
        })}</ol>
      </section> : null}
      {message ? <p className={message.startsWith("The report") ? "bod-avenue-report__error" : "bod-avenue-report__success"} role={message.startsWith("The report") ? "alert" : "status"} aria-live="polite">{message}</p> : null}
    </section>
  );
}

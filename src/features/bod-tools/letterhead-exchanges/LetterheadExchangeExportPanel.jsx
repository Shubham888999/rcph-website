import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeBodReportMonths } from "../bodAvenueReportModel";
import {
  buildLetterheadExchangeExportReport,
  exchangeMonthOptions,
  exchangeRepresentativeOptions,
  filterExportExchanges,
  summarizeExportExchanges,
} from "./letterheadExchangeExportModel";
import {
  buildLetterheadExchangeHeading,
  letterheadExchangesMissingReportPhoto,
} from "./letterheadExchangeModel";
import {
  fetchLetterheadReportImageBytes,
  getLetterheadExchangesForReport,
  getSafeLetterheadExchangeError,
  listLetterheadExchanges,
} from "./letterheadExchangeService";
import { prepareLetterheadReportImagesForPdf } from "./letterheadReportImagePreparation";

function toggleMonth(months, value, checked) {
  const next = new Set(months);
  if (checked) next.add(value);
  else next.delete(value);
  return normalizeBodReportMonths([...next]);
}

export default function LetterheadExchangeExportPanel() {
  const [listState, setListState] = useState({ status: "loading", exchanges: [], error: "" });
  const [months, setMonths] = useState([]);
  const [clubQuery, setClubQuery] = useState("");
  const [representative, setRepresentative] = useState("");
  const [includePhotos, setIncludePhotos] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [notice, setNotice] = useState(null);

  const fetchList = useCallback(async () => {
    try {
      const payload = await listLetterheadExchanges({ limit: 100 });
      return { status: "success", exchanges: payload.exchanges, error: "" };
    } catch (error) {
      return { status: "error", exchanges: [], error: getSafeLetterheadExchangeError(error, "Unable to load Letterhead Exchanges.") };
    }
  }, []);

  const applyList = useCallback((result) => {
    setListState(result);
    if (result.status === "success") {
      const options = exchangeMonthOptions(result.exchanges);
      setMonths((current) => (current.length ? current : options.length ? [options[0].value] : []));
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchList().then((result) => { if (active) applyList(result); });
    return () => { active = false; };
  }, [fetchList, applyList]);

  function retry() {
    setListState({ status: "loading", exchanges: [], error: "" });
    fetchList().then(applyList);
  }

  const monthOptions = useMemo(() => exchangeMonthOptions(listState.exchanges), [listState.exchanges]);
  const representatives = useMemo(() => exchangeRepresentativeOptions(listState.exchanges), [listState.exchanges]);
  const preview = useMemo(() => {
    const inMonths = listState.exchanges.filter((exchange) => months.includes(exchange.exchangeMonth));
    return summarizeExportExchanges(filterExportExchanges(inMonths, { clubQuery, representative }));
  }, [listState.exchanges, months, clubQuery, representative]);

  async function download() {
    setDownloading(true);
    setMessage({ type: "", text: "" });
    setNotice(null);
    try {
      let fetched;
      try {
        fetched = await getLetterheadExchangesForReport(months);
      } catch (error) {
        throw new Error(getSafeLetterheadExchangeError(error, "Unable to load Letterhead Exchanges for these months. Please try again."), { cause: error });
      }
      const exchanges = filterExportExchanges(fetched.exchanges, { clubQuery, representative });
      const report = buildLetterheadExchangeExportReport({ exchanges, months, includePhotos });
      let imagesByEventId = new Map();
      let failedIds = new Set();
      if (includePhotos) {
        try {
          const prepared = await prepareLetterheadReportImagesForPdf({ exchanges: report.letterheadExchanges, fetchImageBytes: fetchLetterheadReportImageBytes });
          imagesByEventId = prepared.imagesByKey;
          failedIds = new Set((prepared.warnings || []).map((warning) => warning.exchangeId));
        } catch {
          failedIds = new Set(report.letterheadExchanges.filter((exchange) => exchange.reportImage).map((exchange) => exchange.id));
        }
        const missing = letterheadExchangesMissingReportPhoto(report.letterheadExchanges).map((item) => item.label);
        const failed = report.letterheadExchanges
          .filter((exchange) => failedIds.has(exchange.id))
          .map((exchange) => buildLetterheadExchangeHeading({ ...exchange, associatedEvent: null }));
        if (missing.length || failed.length) setNotice({ missing, failed });
      }
      const { downloadBodAvenueReportPdf } = await import("../bodAvenueReportPdf.js");
      await downloadBodAvenueReportPdf(report, { imagesByEventId });
      setMessage({ type: "ok", text: `${report.exchangeCount} Letterhead Exchange${report.exchangeCount === 1 ? "" : "s"} included in the PDF.` });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "The report could not be made. Please try again." });
    } finally {
      setDownloading(false);
    }
  }

  if (listState.status === "loading") return <p className="letterhead-muted">Loading Letterhead Exchanges...</p>;
  if (listState.status === "error") {
    return (
      <div className="letterhead-inline-error" role="alert">
        <p>{listState.error}</p>
        <button type="button" onClick={retry}>Retry</button>
      </div>
    );
  }
  if (!monthOptions.length) return <p className="letterhead-muted">No Letterhead Exchanges have been recorded yet.</p>;

  const canDownload = months.length > 0 && preview.total > 0 && !downloading;
  return (
    <div className="letterhead-export">
      <div className="letterhead-export__intro">
        <h3>Export Letterhead Exchange report</h3>
        <p>Makes a PDF table of your Letterhead Exchanges on the official club letterhead. Choose the months and filters, then download.</p>
      </div>

      <fieldset className="letterhead-export__months">
        <legend>Months</legend>
        <div className="letterhead-export__month-actions">
          <button type="button" onClick={() => setMonths(monthOptions.map((option) => option.value))} disabled={months.length === monthOptions.length}>Select all months</button>
          <button type="button" onClick={() => setMonths([])} disabled={!months.length}>Clear</button>
        </div>
        <div className="letterhead-export__month-list">
          {monthOptions.map((option) => (
            <label key={option.value}>
              <input type="checkbox" checked={months.includes(option.value)} onChange={(event) => setMonths(toggleMonth(months, option.value, event.target.checked))} />
              {option.label} <span className="letterhead-muted">({option.count})</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="letterhead-export__filters">
        <label>Club name
          <input type="search" value={clubQuery} placeholder="Search by club" onChange={(event) => setClubQuery(event.target.value)} />
        </label>
        <label>RCPH representative
          <select value={representative} onChange={(event) => setRepresentative(event.target.value)}>
            <option value="">All representatives</option>
            {representatives.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      <label className="letterhead-export__photos">
        <input type="checkbox" checked={includePhotos} onChange={(event) => setIncludePhotos(event.target.checked)} />
        Include photos (the report photo chosen for each exchange)
      </label>

      <p className="letterhead-export__summary">
        {months.length ? (
          <>
            <strong>{preview.total}</strong> exchange{preview.total === 1 ? " matches" : "s match"}
            {includePhotos ? `, ${preview.withReportPhoto} with a report photo${preview.missingReportPhoto ? `, ${preview.missingReportPhoto} with photos but no report photo chosen` : ""}` : ""}.
          </>
        ) : "Choose at least one month."}
      </p>

      <div className="letterhead-form-actions">
        <button type="button" disabled={!canDownload} onClick={download}>{downloading ? "Making PDF..." : "Download PDF"}</button>
      </div>

      {message.text ? <p className={message.type === "error" ? "letterhead-inline-error" : "outward-letters__ok"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
      {notice ? (
        <div className="letterhead-inline-error" role="status">
          {notice.missing.length ? <p>No report photo chosen, so these appear without a photo: {notice.missing.join("; ")}.</p> : null}
          {notice.failed.length ? <p>The photo could not be included for: {notice.failed.join("; ")}.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

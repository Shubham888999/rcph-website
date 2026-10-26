import { useRef, useState } from "react";
import { formatOutwardDate, parseOutwardFile } from "./outwardLetterModel";
import { buildOutwardLettersPdf, buildOutwardLettersZip, loadOutwardAssets } from "./outwardLetterPdf";

function saveBlob(bytes, type, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OutwardLettersPanel() {
  const inputRef = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  const validRows = parsed ? parsed.rows.filter((row) => row.valid) : [];
  const invalidCount = parsed ? parsed.rows.length - validRows.length : 0;

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("reading");
    setMessage({ type: "", text: "" });
    try {
      setParsed(await parseOutwardFile(file));
      setFileName(file.name);
    } catch {
      setParsed(null);
      setFileName("");
      setMessage({ type: "error", text: "This file could not be read. Check that it is a .csv or .xlsx file and try again." });
    } finally {
      setBusy("");
    }
  }

  async function download(kind) {
    setBusy(kind);
    setMessage({ type: "", text: "" });
    try {
      const assets = await loadOutwardAssets();
      if (kind === "combined") {
        saveBlob(buildOutwardLettersPdf(validRows, assets), "application/pdf", "RCPH-Letterheads-combined.pdf");
      } else {
        saveBlob(await buildOutwardLettersZip(validRows, assets), "application/zip", "RCPH-Letterheads-separate.zip");
      }
      setMessage({ type: "ok", text: `${validRows.length} letter${validRows.length === 1 ? "" : "s"} downloaded.` });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "The letters could not be made. Please try again." });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="outward-letters">
      <div className="outward-letters__intro">
        <h3>Send letterheads to other clubs</h3>
        <p>Upload a CSV or Excel file with three columns: <strong>Date</strong>, <strong>RID</strong> and <strong>Club Name</strong>. Each row becomes one letter addressed to that club. Nothing is saved on the website.</p>
        <p className="letterhead-muted">Dates are read as DD/MM/YYYY, for example 26/10/2026. Write the club name without "Rotaract Club of".</p>
      </div>

      <label className="outward-letters__file">
        <span>{busy === "reading" ? "Reading..." : parsed ? "Choose a different file" : "Choose CSV or Excel file"}</span>
        <input ref={inputRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile} disabled={Boolean(busy)} />
      </label>

      {message.text ? <p className={message.type === "error" ? "letterhead-inline-error" : "outward-letters__ok"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}

      {parsed?.errors.length ? (
        <div className="letterhead-inline-error" role="alert">{parsed.errors.map((item) => <p key={item}>{item}</p>)}</div>
      ) : null}

      {parsed && parsed.rows.length ? (
        <>
          <p className="outward-letters__summary">
            <strong>{fileName}</strong>: {validRows.length} ready{invalidCount ? `, ${invalidCount} need fixing (left out of the download)` : ""}.
          </p>
          <div className="outward-letters__table-wrap">
            <table className="outward-letters__table">
              <thead><tr><th>Line</th><th>Date</th><th>RID</th><th>Club Name</th><th>Status</th></tr></thead>
              <tbody>
                {parsed.rows.map((row) => (
                  <tr key={row.line} className={row.valid ? "" : "is-invalid"}>
                    <td>{row.line}</td>
                    <td>{formatOutwardDate(row.date) || "-"}</td>
                    <td>{row.rid || "-"}</td>
                    <td>{row.clubName || "-"}</td>
                    <td>{row.valid ? (row.warnings[0] || "Ready") : row.problems.join(". ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="letterhead-form-actions outward-letters__actions">
            <button type="button" disabled={!validRows.length || Boolean(busy)} onClick={() => download("combined")}>{busy === "combined" ? "Making PDF..." : "Download combined PDF"}</button>
            <button type="button" disabled={!validRows.length || Boolean(busy)} onClick={() => download("separate")}>{busy === "separate" ? "Making ZIP..." : "Download separate PDFs (ZIP)"}</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

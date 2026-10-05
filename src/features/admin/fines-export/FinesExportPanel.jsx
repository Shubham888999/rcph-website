import { useMemo, useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import { buildFinesExport, listFineMonths } from "./finesExportModel";
import { downloadFinesWorkbook } from "./finesWorkbook";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function FinesExportPanel({ fines, onNotice }) {
  const [open, setOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const months = useMemo(() => listFineMonths(fines), [fines]);
  const selectedFineCount = months
    .filter((month) => selectedMonths.has(month.key))
    .reduce((total, month) => total + month.fineCount, 0);

  function openDialog() {
    setSelectedMonths(new Set(months.length ? [months[0].key] : []));
    setError("");
    setOpen(true);
  }

  function toggleMonth(monthKey, checked) {
    const next = new Set(selectedMonths);
    if (checked) next.add(monthKey);
    else next.delete(monthKey);
    setSelectedMonths(next);
  }

  async function download() {
    if (!selectedMonths.size || exporting) return;
    setExporting(true);
    setError("");
    try {
      const report = buildFinesExport({ fines, monthKeys: [...selectedMonths] });
      await downloadFinesWorkbook(report);
      const exportedCount = report.months.reduce((total, month) => total + month.rows.length, 0);
      onNotice?.({ type: "success", message: `${plural(exportedCount, "fine")} exported to Excel.` });
    } catch {
      setError("The Excel workbook could not be generated. No fines data was changed.");
    } finally {
      setExporting(false);
    }
  }

  return <>
    <section className="admin-panel attendance-export-launcher">
      <div>
        <p className="admin-kicker">Spreadsheet export</p>
        <h3>Export fines</h3>
        <p>Download fines as Excel, one sheet per month.</p>
      </div>
      <button type="button" disabled={!months.length} onClick={openDialog}>Export fines</button>
    </section>
    {open ? <AdminDialog title="Export fines" busy={exporting} onClose={() => setOpen(false)} className="admin-dialog--wide">
      <section className="attendance-export" aria-describedby="fines-export-summary">
        <fieldset className="attendance-export__events">
          <legend>Months</legend>
          {months.length ? <ul>{months.map((month) => <li key={month.key}><label><input type="checkbox" checked={selectedMonths.has(month.key)} onChange={(change) => toggleMonth(month.key, change.target.checked)} /><span><strong>{month.label} · {plural(month.fineCount, "fine")}</strong></span></label></li>)}</ul> : <p>No fines are available to export.</p>}
        </fieldset>
        <p id="fines-export-summary" aria-live="polite"><strong>{plural(selectedFineCount, "fine")}</strong> across <strong>{plural(selectedMonths.size, "month")}</strong> selected</p>
        {error ? <p role="alert" className="attendance-export__error">{error}</p> : null}
        <div className="admin-actions attendance-export__download">
          <button type="button" onClick={() => setOpen(false)} disabled={exporting}>Cancel</button>
          <button type="button" onClick={download} disabled={!selectedMonths.size || exporting}>{exporting ? "Building workbook…" : "Download Excel"}</button>
        </div>
      </section>
    </AdminDialog> : null}
  </>;
}

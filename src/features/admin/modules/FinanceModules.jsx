import { useEffect, useMemo, useRef, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty } from "../shared/AdminStates";
import {
  buildFineEventGroups,
  buildFinePayload,
  findFineEventOption,
  formatInr,
} from "../shared/adminModel";
import { addFine, deleteFine, deleteTreasury, newTreasuryId, setTreasuryById, updateTreasury, uploadTreasuryBill } from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";
import TreasuryAttachments from "../treasury/TreasuryAttachments";
import TreasuryFileField from "../treasury/TreasuryFileField";
import { buildTreasuryExportReport } from "../treasury/treasuryExportModel";
import { downloadTreasuryWorkbook } from "../treasury/treasuryExcel";
import {
  buildTreasuryBalanceSheetModel,
  downloadTreasuryBalanceSheet,
  treasuryBalanceSheetMonthLabel,
  treasuryBalanceSheetMonthRange,
} from "../treasury/treasuryBalanceSheet";
import { downloadTreasuryPdf } from "../treasury/treasuryPdf";
import { createTreasuryUploadState, getSafeTreasuryUploadError, validateTreasuryUploadFile } from "../treasury/treasuryUploadModel";
import {
  CLUB_DUES_AMOUNT,
  CLUB_DUES_TRANSACTION_TITLE,
  DEFAULT_TREASURY_FILTERS,
  TREASURY_PAYMENT_MODES,
  TREASURY_REIMBURSEMENT_STATUSES,
  TREASURY_WORKFLOW_TYPES,
  addClubDuesRow,
  applyTreasuryWorkflow,
  buildClubDuesImportPayloads,
  buildClubDuesPayloads,
  buildTreasuryPayload,
  buildTreasuryReview,
  buildTreasurySummary,
  createClubDuesDraft,
  createEmptyTreasuryDraft,
  filterAndSortTreasury,
  formatTreasuryDate,
  getTreasuryAvenueOptions,
  getTreasuryFieldPlan,
  getTreasuryMonthOptions,
  groupTreasuryByMonth,
  isReimbursementRecord,
  isTreasuryUploadWorking,
  normalizeTreasuryAvenue,
  normalizeReimbursementStatus,
  parseClubDuesGoogleFormCsv,
  parseClubDuesGoogleFormRows,
  prepareTreasuryDraft,
  removeClubDuesRow,
  resetClubDuesDraft,
  sanitizeAmountInput,
  transactionPartyLabel,
  treasuryHasSupportingFile,
  updateClubDuesImportRow,
  updateClubDuesDraft,
  validateClubDuesImportRows,
  validateClubDuesRows,
  validateTreasuryDraft,
} from "../treasury/treasuryModel";
import { formatRotaractorName } from "../../../utils/memberName";

export function FinesModule({
  fines,
  members,
  events,
  bodMeetings,
  districtEvents,
  lock,
  uid,
  onNotice,
}) {
const empty = {
  memberId: "",
  reason: "",
  eventSelection: "",
  eventId: "",
  eventSource: "",
  eventType: "",
  eventName: "",
  eventDate: "",
  date: "",
  amount: "",
};
  const [draft, setDraft] = useState(empty);
  const [target, setTarget] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "fines", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const total = fines.reduce((sum, fine) => sum + fine.amount, 0);
  const eventGroups = useMemo(
  () =>
    buildFineEventGroups({
      events,
      bodMeetings,
      districtEvents,
    }),
  [
    events,
    bodMeetings,
    districtEvents,
  ],
);
function selectEvent(value) {
  const selected =
    findFineEventOption(
      eventGroups,
      value,
    );

  if (!selected) {
    setDraft({
      ...draft,
      eventSelection: "",
      eventId: "",
      eventSource: "",
      eventType: "",
      eventName: "",
      eventDate: "",
    });

    return;
  }

  setDraft({
    ...draft,
    eventSelection: selected.value,
    eventId: selected.id,
    eventSource: selected.source,
    eventType: selected.type,
    eventName: selected.name,
    eventDate: selected.date,

    // Default the Fine/Treasury date
    // from the selected event.
    date: selected.date,
  });
}
  function submit(e) {
    e.preventDefault();
    const member = members.find((item) => item.id === draft.memberId);
    const payload = buildFinePayload({ ...draft, memberName: member?.name || "" });
if (
  !payload.memberId ||
  !payload.reason ||
  !payload.eventId ||
  !payload.eventSource ||
  !payload.eventType ||
  !payload.eventName ||
  !payload.eventDate ||
  !payload.date ||
  payload.amount === null ||
  payload.amount <= 0
) {
  return;
}
    run("add-fine", () => addFine(payload), "Fine added.").then((result) => { if (result) setDraft(empty); });
  }
  return (
    <>
      <AdminModuleHeader title="Sergeant-at-Arms: Fines" />
      <div className={`admin-lock-banner ${locked ? "is-locked" : ""}`}>{locked ? "Fines are locked or lock status is unavailable." : `${fines.length} records - ${formatInr(total)}`}</div>
      <section className="admin-panel">
        <form className="admin-form admin-form--inline" onSubmit={submit}>
          <label>Member<select value={draft.memberId} onChange={(e) => setDraft({ ...draft, memberId: e.target.value })} required><option value="">Choose member</option>{members.map((m) => <option key={m.id} value={m.id}>{formatRotaractorName(m.name, true)}</option>)}</select></label>
          <label>Reason<select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} required><option value="">Choose reason</option><option value="missing_badge">Missing badge</option><option value="late">Late to event/meeting</option></select></label>
<label>
  Event/meeting

  <select
    value={draft.eventSelection}
    onChange={(event) =>
      selectEvent(event.target.value)
    }
    required
  >
    <option value="">
      Choose event or meeting
    </option>

    {eventGroups.map((group) => (
      <optgroup
        key={group.key}
        label={group.label}
      >
        {group.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </optgroup>
    ))}
  </select>
</label>
          <label>Date<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required /></label>
          <label>Amount INR<input type="number" min="0" step="1" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} required /></label>
          <button disabled={locked || busy}>Add fine</button>
        </form>
      </section>
      {fines.length ? <div className="admin-table-wrap"><table><caption>Fine records</caption><thead><tr><th>Member</th><th>Amount</th><th>Reason</th><th>Event</th><th>Date</th><th>Action</th></tr></thead><tbody>{fines.map((fine) => <tr key={fine.id}><td>{formatRotaractorName(fine.memberName || fine.memberId, true)}</td><td>{formatInr(fine.amount)}</td><td>{fine.reason}</td><td>{fine.eventName}</td><td>{fine.date}</td><td><button className="danger" disabled={locked} onClick={() => setTarget(fine)}>Delete</button></td></tr>)}</tbody></table></div> : <AdminEmpty message="No fine records." />}
      {target ? <AdminDialog title="Permanently delete fine?" busy={busy} onClose={() => setTarget(null)}><p>This matches production behavior and cannot be undone.</p><div className="admin-actions"><button onClick={() => setTarget(null)}>Cancel</button><button className="danger" onClick={() => run("delete-fine", () => deleteFine(target.id), "Fine permanently deleted.").then((result) => { if (result !== null) setTarget(null); })}>Delete permanently</button></div></AdminDialog> : null}
    </>
  );
}

const TREASURY_TYPE_FILTERS = [
  ["all", "All types"],
  ["income", "Income"],
  ["expense", "Expense"],
  ["reimbursement", "Reimbursement"],
];

const TREASURY_SORT_LABELS = {
  newest: "Newest first",
  oldest: "Oldest first",
  "amount-desc": "Amount high to low",
  "amount-asc": "Amount low to high",
};

function reimbursementLabel(value) {
  const status = normalizeReimbursementStatus(value);
  if (status === "Done") return "Reimbursed";
  return status;
}

function transactionTypeLabel(record) {
  if (record.type === "income") return "Income";
  return isReimbursementRecord(record) ? "Reimbursement" : "Expense";
}

function compactTransactionParty(record) {
  if (record.type === "income") return { label: "From", value: record.paidBy || "Party not recorded" };
  if (isReimbursementRecord(record)) return { label: "To", value: record.reimbursedTo || record.paidTo || "Party not recorded" };
  return { label: "To", value: record.paidTo || "Party not recorded" };
}

function formatTimestamp(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function excelCellText(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "object") {
    if (typeof value.hyperlink === "string") return value.hyperlink;
    if (typeof value.text === "string") return value.text;
    if (typeof value.result === "string" || typeof value.result === "number") return String(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
  }
  return String(value);
}

async function parseClubDuesImportFile(file) {
  const name = file?.name || "";
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".csv") || file?.type === "text/csv") {
    return parseClubDuesGoogleFormCsv(await file.text());
  }
  if (lowerName.endsWith(".xlsx") || file?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const imported = await import("exceljs");
    const ExcelJS = imported.default || imported;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { rows: [], skippedRows: [], totalRows: 0, errors: ["The Excel workbook has no worksheets."] };
    const rows = [];
    worksheet.eachRow((row) => {
      rows.push(Array.from({ length: row.cellCount }, (_, index) => excelCellText(row.getCell(index + 1).value)));
    });
    return parseClubDuesGoogleFormRows(rows);
  }
  return { rows: [], skippedRows: [], totalRows: 0, errors: ["Upload a Google Form CSV or .xlsx export."] };
}

export function TreasuryModule({ transactions, members, lock, uid, onNotice }) {
  const [lastDefaults, setLastDefaults] = useState({ avenue: "", paymentMode: "" });
  const [draft, setDraft] = useState(() => createEmptyTreasuryDraft());
  const [draftErrors, setDraftErrors] = useState({});
  const [draftUpload, setDraftUpload] = useState(createTreasuryUploadState);
  const [draftRecordId, setDraftRecordId] = useState("");
  const duesRowSequence = useRef(1);
  const [clubDuesMode, setClubDuesMode] = useState(false);
  const [duesRows, setDuesRows] = useState(() => [createClubDuesDraft({ clientId: "club-dues-1" })]);
  const [duesErrors, setDuesErrors] = useState([{}]);
  const [duesUploads, setDuesUploads] = useState(() => [createTreasuryUploadState()]);
  const [duesSaving, setDuesSaving] = useState(false);
  const duesImportSequence = useRef(0);
  const [duesImportRows, setDuesImportRows] = useState([]);
  const [duesImportMeta, setDuesImportMeta] = useState({ fileName: "", totalRows: 0, skippedCount: 0, error: "" });
  const [duesImporting, setDuesImporting] = useState(false);
  const [duesImportSaving, setDuesImportSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editUpload, setEditUpload] = useState(createTreasuryUploadState);
  const [details, setDetails] = useState(null);
  const [target, setTarget] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_TREASURY_FILTERS);
  const [exporting, setExporting] = useState("");
  const [balanceSheetDraft, setBalanceSheetDraft] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "treasury", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const summary = useMemo(() => buildTreasurySummary(transactions), [transactions]);
  const filteredTransactions = useMemo(() => filterAndSortTreasury(transactions, filters), [transactions, filters]);
  const groupedTransactions = useMemo(() => groupTreasuryByMonth(filteredTransactions), [filteredTransactions]);
  const duesImportValidation = useMemo(() => validateClubDuesImportRows(duesImportRows, transactions), [duesImportRows, transactions]);
  const monthOptions = useMemo(() => getTreasuryMonthOptions(transactions), [transactions]);
  const avenueOptions = useMemo(() => getTreasuryAvenueOptions(transactions), [transactions]);
  const incomeCount = transactions.filter((item) => item.type === "income").length;
  const expenseCount = transactions.filter((item) => item.type === "expense").length;
  const duesUploadWorking = duesUploads.some(isTreasuryUploadWorking);
  const duesBusy = busy || locked || duesSaving || duesUploadWorking || duesImportSaving;
  const duesAmountLabel = formatInr(CLUB_DUES_AMOUNT).replace(".00", "");

  function reportValidation(message) {
    onNotice?.({ type: "error", message });
  }

  function resetDraft(defaults = lastDefaults) {
    setDraft(createEmptyTreasuryDraft(defaults));
    setDraftErrors({});
    setDraftUpload(createTreasuryUploadState());
    setDraftRecordId("");
  }

  function createDuesUiRow() {
    duesRowSequence.current += 1;
    return createClubDuesDraft({ clientId: `club-dues-${duesRowSequence.current}` });
  }

  function resetDuesBatch() {
    const row = createDuesUiRow();
    setDuesRows([row]);
    setDuesErrors([{}]);
    setDuesUploads([createTreasuryUploadState()]);
  }

  function importRowId() {
    duesImportSequence.current += 1;
    return `club-dues-import-${duesImportSequence.current}`;
  }

  function setImportedRows(rows) {
    setDuesImportRows(rows.map((row) => ({ ...row, clientId: row.clientId || importRowId() })));
  }

  function rememberDefaults(value) {
    const defaults = {
      avenue: value.avenue || lastDefaults.avenue,
      paymentMode: value.paymentMode || lastDefaults.paymentMode,
    };
    setLastDefaults(defaults);
    return defaults;
  }

  function validateForSave(source, setErrors) {
    const validation = validateTreasuryDraft(source);
    setErrors(validation.errors);
    if (!validation.valid) {
      reportValidation(Object.values(validation.errors)[0] || "Complete the required Treasury fields before saving.");
      return null;
    }
    return buildTreasuryPayload(source);
  }

  async function uploadForRecord(fileState, setFileState, payload, transactionId, onComplete) {
    const result = await run(
      "upload-treasury-file",
      async () => {
        const metadata = fileState.uploadedMetadata || await uploadTreasuryBill(fileState.file, payload, transactionId, (status) => setFileState((current) => ({ ...current, status, error: "" })));
        setFileState((current) => ({ ...current, status: "processing", error: "", uploadedMetadata: metadata }));
        await updateTreasury(transactionId, metadata);
        return metadata;
      },
      "Supporting file uploaded.",
      {
        onError(error) {
          const message = getSafeTreasuryUploadError(error);
          setFileState((current) => ({ ...current, status: "failed", error: message }));
          onNotice?.({ type: "error", message: `The Treasury record is saved, but its supporting file was not uploaded. ${message}` });
          return true;
        },
      },
    );
    if (result) {
      setFileState((current) => ({ ...current, status: "uploaded", error: "" }));
      onComplete();
    }
    return result;
  }

  async function saveDraft(event) {
    event?.preventDefault();
    if (isTreasuryUploadWorking(draftUpload)) return;
    const value = validateForSave(draft, setDraftErrors);
    if (!value) return;
    if (draftUpload.error && !draftUpload.file) return reportValidation(draftUpload.error);
    if (draftUpload.file) {
      const fileError = validateTreasuryUploadFile(draftUpload.file);
      if (fileError) return reportValidation(fileError);
      if (!value.purpose) return reportValidation("Enter a purpose or description before uploading a supporting file.");
    }
    const id = draftRecordId || newTreasuryId();
    const saved = await run(
      draftRecordId ? "update-transaction-before-retry" : "create-transaction",
      async () => {
        if (draftRecordId) await updateTreasury(id, value);
        else await setTreasuryById(id, value);
        return id;
      },
      draftRecordId ? "Treasury transaction updated." : "Treasury transaction saved.",
    );
    if (!saved) return;
    setDraftRecordId(id);
    const defaults = rememberDefaults(value);
    if (!draftUpload.file) {
      resetDraft(defaults);
      return;
    }
    await uploadForRecord(draftUpload, setDraftUpload, value, id, () => resetDraft(defaults));
  }

  function updateDuesRow(index, changes) {
    setDuesRows((current) => current.map((row, rowIndex) => (rowIndex === index ? updateClubDuesDraft(row, changes) : row)));
    setDuesErrors((current) => current.map((rowErrors, rowIndex) => (rowIndex === index ? {} : rowErrors)));
  }

  function addDuesPaymentRow() {
    setDuesRows((current) => addClubDuesRow(current, createDuesUiRow()));
    setDuesErrors((current) => [...current, {}]);
    setDuesUploads((current) => [...current, createTreasuryUploadState()]);
  }

  function removeDuesPaymentRow(index) {
    setDuesRows((current) => removeClubDuesRow(current, index));
    setDuesErrors((current) => (current.length <= 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)));
    setDuesUploads((current) => (current.length <= 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)));
  }

  function resetDuesPaymentRow(index) {
    setDuesRows((current) => current.map((row, rowIndex) => (rowIndex === index ? resetClubDuesDraft(row) : row)));
    setDuesErrors((current) => current.map((rowErrors, rowIndex) => (rowIndex === index ? {} : rowErrors)));
    setDuesUploads((current) => current.map((upload, rowIndex) => (rowIndex === index ? createTreasuryUploadState() : upload)));
  }

  function setDuesUploadAt(index) {
    return (valueOrUpdater) => {
      setDuesUploads((current) => current.map((upload, rowIndex) => {
        if (rowIndex !== index) return upload;
        return typeof valueOrUpdater === "function" ? valueOrUpdater(upload) : valueOrUpdater;
      }));
    };
  }

  function validateDuesForSave(rows, uploads) {
    const validation = validateClubDuesRows(rows);
    const rowErrors = validation.errors.map((item) => ({ ...item }));
    rows.forEach((row, index) => {
      const upload = uploads[index] || createTreasuryUploadState();
      if (upload.error && !upload.file) rowErrors[index].bill = upload.error;
      if (!upload.file) return;
      const fileError = validateTreasuryUploadFile(upload.file);
      if (fileError) rowErrors[index].bill = fileError;
      if (!row.purpose) rowErrors[index].purpose = "Enter a description before uploading a bill screenshot.";
    });

    const firstErrorIndex = rowErrors.findIndex((rowError) => Object.keys(rowError).length > 0);
    return {
      valid: firstErrorIndex < 0,
      errors: rowErrors,
      firstErrorIndex,
      firstError: firstErrorIndex < 0 ? "" : Object.values(rowErrors[firstErrorIndex])[0],
    };
  }

  function markDuesRowRecordId(index, recordId) {
    setDuesRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, recordId } : row)));
  }

  async function saveClubDues(event) {
    event?.preventDefault();
    if (duesSaving || busy || duesUploads.some(isTreasuryUploadWorking)) return;
    const rows = duesRows.map((row) => createClubDuesDraft(row));
    const validation = validateDuesForSave(rows, duesUploads);
    setDuesRows(rows);
    setDuesErrors(validation.errors);
    if (!validation.valid) {
      reportValidation(`Row ${validation.firstErrorIndex + 1}: ${validation.firstError}`);
      return;
    }

    const payloads = buildClubDuesPayloads(rows);
    setDuesSaving(true);
    try {
      for (let index = 0; index < payloads.length; index += 1) {
        const payload = payloads[index];
        const currentRow = rows[index];
        const id = currentRow.recordId || newTreasuryId();
        const saved = await run(
          currentRow.recordId ? "update-dues-transaction-before-retry" : "create-dues-transaction",
          async () => {
            if (currentRow.recordId) await updateTreasury(id, payload);
            else await setTreasuryById(id, payload);
            return id;
          },
          currentRow.recordId ? `Dues transaction ${index + 1} updated.` : `Dues transaction ${index + 1} saved.`,
        );
        if (!saved) {
          reportValidation(`Row ${index + 1}: The dues transaction could not be saved. No later rows were processed.`);
          return;
        }
        markDuesRowRecordId(index, id);

        const upload = duesUploads[index] || createTreasuryUploadState();
        if (!upload.file) continue;
        const uploaded = await uploadForRecord(upload, setDuesUploadAt(index), payload, id, () => {});
        if (!uploaded) {
          reportValidation(`Row ${index + 1}: The transaction is saved, but its bill screenshot needs retry.`);
          return;
        }
      }

      onNotice?.({
        type: "success",
        message: `${payloads.length} dues transaction${payloads.length === 1 ? "" : "s"} saved separately.`,
      });
      resetDuesBatch();
    } finally {
      setDuesSaving(false);
    }
  }

  async function importClubDuesFile(file) {
    if (!file || duesImporting) return;
    setDuesImporting(true);
    try {
      const result = await parseClubDuesImportFile(file);
      if (result.errors?.length) {
        setDuesImportRows([]);
        setDuesImportMeta({ fileName: file.name, totalRows: result.totalRows || 0, skippedCount: 0, error: result.errors[0] });
        reportValidation(result.errors[0]);
        return;
      }
      setImportedRows(result.rows || []);
      setDuesImportMeta({
        fileName: file.name,
        totalRows: result.totalRows || 0,
        skippedCount: result.skippedRows?.length || 0,
        error: "",
      });
      onNotice?.({
        type: "success",
        message: `${result.rows?.length || 0} payable dues row${result.rows?.length === 1 ? "" : "s"} imported for review.`,
      });
    } catch {
      const message = "The Google Form response file could not be parsed.";
      setDuesImportRows([]);
      setDuesImportMeta({ fileName: file.name, totalRows: 0, skippedCount: 0, error: message });
      reportValidation(message);
    } finally {
      setDuesImporting(false);
    }
  }

  function updateDuesImportRow(index, changes) {
    setDuesImportRows((current) => current.map((row, rowIndex) => (rowIndex === index ? updateClubDuesImportRow(row, changes) : row)));
  }

  function removeDuesImportRow(index) {
    setDuesImportRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function clearDuesImportRows() {
    setDuesImportRows([]);
    setDuesImportMeta({ fileName: "", totalRows: 0, skippedCount: 0, error: "" });
  }

  async function saveImportedClubDues(event) {
    event?.preventDefault();
    if (duesImportSaving || duesSaving || duesUploadWorking || busy || locked) return;
    if (!duesImportRows.length) {
      reportValidation("Import payable dues rows before saving transactions.");
      return;
    }
    const validation = validateClubDuesImportRows(duesImportRows, transactions);
    if (!validation.valid) {
      const firstErrorIndex = validation.errors.findIndex((rowErrors) => Object.keys(rowErrors).length > 0);
      reportValidation(`Imported row ${firstErrorIndex + 1}: ${Object.values(validation.errors[firstErrorIndex])[0]}`);
      return;
    }
    const payloads = buildClubDuesImportPayloads(duesImportRows);
    setDuesImportSaving(true);
    try {
      const saved = await run(
        "create-imported-dues-transactions",
        async () => {
          for (const payload of payloads) {
            const id = newTreasuryId();
            await setTreasuryById(id, payload);
          }
          return payloads.length;
        },
        `${payloads.length} imported dues transaction${payloads.length === 1 ? "" : "s"} saved.`,
      );
      if (saved !== null) clearDuesImportRows();
    } finally {
      setDuesImportSaving(false);
    }
  }

  async function saveEdit(event) {
    event?.preventDefault();
    if (!editing || isTreasuryUploadWorking(editUpload)) return;
    const value = validateForSave(editing, setEditErrors);
    if (!value) return;
    if (editUpload.error && !editUpload.file) return reportValidation(editUpload.error);
    if (editUpload.file) {
      const fileError = validateTreasuryUploadFile(editUpload.file);
      if (fileError) return reportValidation(fileError);
      if (!value.purpose) return reportValidation("Enter a purpose or description before uploading a supporting file.");
    }
    const saved = await run("update-transaction", async () => { await updateTreasury(editing.id, value); return editing.id; }, "Treasury transaction updated.");
    if (!saved) return;
    rememberDefaults(value);
    if (!editUpload.file) {
      setEditing(null);
      setEditErrors({});
      return;
    }
    await uploadForRecord(editUpload, setEditUpload, value, editing.id, () => {
      setEditing(null);
      setEditErrors({});
      setEditUpload(createTreasuryUploadState());
    });
  }

  function startEdit(item) {
    setEditUpload(createTreasuryUploadState());
    setEditErrors({});
    setEditing(prepareTreasuryDraft(item, lastDefaults));
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
function openBalanceSheetExport() {
  const availableMonths = monthOptions
    .map((item) => item.value)
    .sort((a, b) => a.localeCompare(b));

  if (!availableMonths.length) {
    reportValidation(
      "Add at least one dated Treasury transaction before exporting a Balance Sheet.",
    );
    return;
  }

  const startMonth = availableMonths[0];
  const endMonth = availableMonths.at(-1);
  const selectedMonths = treasuryBalanceSheetMonthRange(
    startMonth,
    endMonth,
  );

  setBalanceSheetDraft({
    startMonth,
    endMonth,
    openingCashInHand: "0",
    cashInHandByMonth: Object.fromEntries(
      selectedMonths.map((month) => [month, "0"]),
    ),
  });
}

function updateBalanceSheetRange(key, value) {
  setBalanceSheetDraft((current) => {
    if (!current) return current;

    const next = {
      ...current,
      [key]: value,
    };

    const selectedMonths = treasuryBalanceSheetMonthRange(
      next.startMonth,
      next.endMonth,
    );

    return {
      ...next,
      cashInHandByMonth: Object.fromEntries(
        selectedMonths.map((month) => [
          month,
          current.cashInHandByMonth?.[month] ?? "0",
        ]),
      ),
    };
  });
}

function updateBalanceSheetCash(month, value) {
  setBalanceSheetDraft((current) => (
    current
      ? {
          ...current,
          cashInHandByMonth: {
            ...current.cashInHandByMonth,
            [month]: value,
          },
        }
      : current
  ));
}

function validBalanceSheetAmount(value) {
  if (value === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

async function exportBalanceSheet() {
  if (!balanceSheetDraft || exporting) return;

  const selectedMonths = treasuryBalanceSheetMonthRange(
    balanceSheetDraft.startMonth,
    balanceSheetDraft.endMonth,
  );

  if (!selectedMonths.length) {
    reportValidation(
      "Choose a valid Balance Sheet month range.",
    );
    return;
  }

  if (
    !validBalanceSheetAmount(
      balanceSheetDraft.openingCashInHand,
    )
  ) {
    reportValidation(
      "Enter a valid opening Cash in Hand amount.",
    );
    return;
  }

  const invalidMonth = selectedMonths.find(
    (month) => !validBalanceSheetAmount(
      balanceSheetDraft.cashInHandByMonth?.[month],
    ),
  );

  if (invalidMonth) {
    reportValidation(
      `Enter a valid closing Cash in Hand amount for ${
        treasuryBalanceSheetMonthLabel(invalidMonth)
      }.`,
    );
    return;
  }

  setExporting("balance-sheet");

  try {
    const model = buildTreasuryBalanceSheetModel({
      transactions,
      startMonth: balanceSheetDraft.startMonth,
      endMonth: balanceSheetDraft.endMonth,
      openingCashInHand: Number(
        balanceSheetDraft.openingCashInHand,
      ),
      cashInHandByMonth: Object.fromEntries(
        selectedMonths.map((month) => [
          month,
          Number(
            balanceSheetDraft.cashInHandByMonth[month],
          ),
        ]),
      ),
    });

    await downloadTreasuryBalanceSheet(model);

    setBalanceSheetDraft(null);

    onNotice?.({
      type: "success",
      message:
        `${model.months.length} monthly Balance Sheet`
        + `${model.months.length === 1 ? "" : "s"} exported.`,
    });
  } catch (error) {
    onNotice?.({
      type: "error",
      message:
        error?.message
        || "The Balance Sheet workbook could not be generated. No Treasury data was changed.",
    });
  } finally {
    setExporting("");
  }
}
  async function exportTreasury(format) {
    if (exporting) return;
    setExporting(format);
    try {
      const report = buildTreasuryExportReport({
        transactions,
        members,
        filters,
        generatedAt: new Date(),
      });
      if (format === "excel") await downloadTreasuryWorkbook(report);
      else await downloadTreasuryPdf(report);
      onNotice?.({
        type: "success",
        message: `${report.transactionCount} Treasury transaction${report.transactionCount === 1 ? "" : "s"} exported to ${format === "excel" ? "Excel" : "PDF"}.`,
      });
    } catch {
      onNotice?.({
        type: "error",
        message: `The Treasury ${format === "excel" ? "Excel workbook" : "PDF"} could not be generated. No Treasury data was changed.`,
      });
    } finally {
      setExporting("");
    }
  }

  return (
    <>
      <AdminModuleHeader title="Treasury Command Center" description="Income, expenses, reimbursements, documents, and transaction history." />
      <div className={`admin-lock-banner ${locked ? "is-locked" : ""}`}>
        {locked ? "Treasury is locked or unavailable." : "Treasury is open for authorized finance updates."}
      </div>
      <TreasuryOverview summary={summary} incomeCount={incomeCount} expenseCount={expenseCount} />
      <section className="treasury-entry-grid" aria-label="Quick transaction entry">
        <div className="admin-panel treasury-entry-panel">
          <div className="treasury-section-heading">
            <div>
              <span>Quick entry</span>
              <h3>{clubDuesMode ? CLUB_DUES_TRANSACTION_TITLE : draftRecordId ? "Resume saved transaction" : "Record transaction"}</h3>
            </div>
            {draftRecordId ? <strong>Record saved - upload can be retried</strong> : null}
          </div>
          <label className="treasury-dues-toggle">
            <input
              type="checkbox"
              checked={clubDuesMode}
              onChange={(event) => setClubDuesMode(event.target.checked)}
              disabled={busy || locked || isTreasuryUploadWorking(draftUpload)}
            />
            <span>
              <strong>Club dues</strong>
              <small>Use this to enter multiple {duesAmountLabel} club dues payments quickly. Each row is saved as a separate income transaction.</small>
            </span>
          </label>
          {clubDuesMode ? (
            <TreasuryClubDuesForm
              rows={duesRows}
              uploads={duesUploads}
              errors={duesErrors}
              members={members}
              onSubmit={saveClubDues}
              onRowChange={updateDuesRow}
              onUploadChange={(index, value) => setDuesUploadAt(index)(value)}
              onAddRow={addDuesPaymentRow}
              onRemoveRow={removeDuesPaymentRow}
              onResetRow={resetDuesPaymentRow}
              importRows={duesImportRows}
              importMeta={duesImportMeta}
              importValidation={duesImportValidation}
              importBusy={duesImporting}
              importSaving={duesImportSaving || busy}
              onImportFile={importClubDuesFile}
              onImportRowChange={updateDuesImportRow}
              onImportRowRemove={removeDuesImportRow}
              onImportClear={clearDuesImportRows}
              onImportSave={saveImportedClubDues}
              disabled={duesBusy}
              saving={duesSaving || busy || duesUploadWorking}
            />
          ) : (
            <TreasuryForm
              formId="treasury-create"
              value={draft}
              setValue={setDraft}
              members={members}
              onSubmit={saveDraft}
              busy={busy || locked}
              upload={draftUpload}
              setUpload={setDraftUpload}
              onRetry={saveDraft}
              errors={draftErrors}
              mode="create"
              onClear={() => resetDraft()}
            />
          )}
        </div>
        <div className="treasury-review-column">
          {clubDuesMode ? (
            <TreasuryClubDuesReviewPanel rows={duesRows} uploads={duesUploads} errors={duesErrors} />
          ) : (
            <TreasuryReviewPanel value={draft} upload={draftUpload} errors={draftErrors} />
          )}
        </div>
      </section>
<TreasuryHistory
  transactions={transactions}
  filteredTransactions={filteredTransactions}
  groupedTransactions={groupedTransactions}
  filters={filters}
  monthOptions={monthOptions}
  avenueOptions={avenueOptions}
  locked={locked}
  onFilter={updateFilter}
  onClearFilters={() => setFilters(DEFAULT_TREASURY_FILTERS)}
  onDetails={setDetails}
  onEdit={startEdit}
  onDelete={setTarget}
  exporting={exporting}
  onExportExcel={() => exportTreasury("excel")}
  onExportPdf={() => exportTreasury("pdf")}
  onExportBalanceSheet={openBalanceSheetExport}
/>
{balanceSheetDraft ? (
  <AdminDialog
    title="Export Treasury Balance Sheet"
    busy={exporting === "balance-sheet"}
    onClose={() => {
      if (!exporting) setBalanceSheetDraft(null);
    }}
    className="admin-dialog--wide"
  >
    <div className="treasury-balance-sheet-dialog">
      <p>
        Choose the month range and enter the actual Cash in Hand.
        All non-cash Treasury transactions will be placed under Bank.
      </p>

      <div className="treasury-balance-sheet-range">
        <label>
          <FieldLabel label="From month" required />

          <select
            value={balanceSheetDraft.startMonth}
            onChange={(event) => updateBalanceSheetRange(
              "startMonth",
              event.target.value,
            )}
            disabled={Boolean(exporting)}
          >
            {[...monthOptions]
              .sort((a, b) => a.value.localeCompare(b.value))
              .map((month) => (
                <option
                  value={month.value}
                  key={month.value}
                >
                  {month.label}
                </option>
              ))}
          </select>
        </label>

        <label>
          <FieldLabel label="To month" required />

          <select
            value={balanceSheetDraft.endMonth}
            onChange={(event) => updateBalanceSheetRange(
              "endMonth",
              event.target.value,
            )}
            disabled={Boolean(exporting)}
          >
            {[...monthOptions]
              .sort((a, b) => a.value.localeCompare(b.value))
              .map((month) => (
                <option
                  value={month.value}
                  key={month.value}
                >
                  {month.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      <section className="treasury-balance-sheet-cash">
        <header>
          <span>Opening balance</span>
          <h4>
            Cash in Hand before {
              treasuryBalanceSheetMonthLabel(
                balanceSheetDraft.startMonth,
              )
            }
          </h4>
        </header>

        <label>
          <FieldLabel
            label="Opening Cash in Hand"
            required
          />

          <span className="treasury-amount-input">
            <span aria-hidden="true">₹</span>

            <input
              type="number"
              min="0"
              step="0.01"
              value={balanceSheetDraft.openingCashInHand}
              onChange={(event) => setBalanceSheetDraft(
                (current) => ({
                  ...current,
                  openingCashInHand: event.target.value,
                }),
              )}
              disabled={Boolean(exporting)}
            />
          </span>
        </label>
      </section>

      <section className="treasury-balance-sheet-cash">
        <header>
          <span>Monthly closing balances</span>
          <h4>Cash in Hand for each selected month</h4>
          <p>
            Enter the actual physical cash remaining at the end
            of each month.
          </p>
        </header>

        <div className="treasury-balance-sheet-months">
          {treasuryBalanceSheetMonthRange(
            balanceSheetDraft.startMonth,
            balanceSheetDraft.endMonth,
          ).map((month) => (
            <label key={month}>
              <FieldLabel
                label={`${treasuryBalanceSheetMonthLabel(month)} ${
                  month.slice(0, 4)
                }`}
                required
              />

              <span className="treasury-amount-input">
                <span aria-hidden="true">₹</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    balanceSheetDraft.cashInHandByMonth?.[
                      month
                    ] ?? ""
                  }
                  onChange={(event) => updateBalanceSheetCash(
                    month,
                    event.target.value,
                  )}
                  disabled={Boolean(exporting)}
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="admin-actions">
        <button
          type="button"
          onClick={exportBalanceSheet}
          disabled={Boolean(exporting)}
        >
          {exporting === "balance-sheet"
            ? "Generating Balance Sheet..."
            : "Export Balance Sheet"}
        </button>

        <button
          type="button"
          onClick={() => setBalanceSheetDraft(null)}
          disabled={Boolean(exporting)}
        >
          Cancel
        </button>
      </div>
    </div>
  </AdminDialog>
) : null}
      {editing ? (
        <AdminDialog title={`Editing transaction: ${editing.title || "Untitled transaction"}`} busy={busy} onClose={() => setEditing(null)} className="admin-dialog--wide">
          <div className="treasury-edit-shell">
            <TreasuryForm
              formId="treasury-edit"
              value={editing}
              setValue={setEditing}
              members={members}
              onSubmit={saveEdit}
              busy={busy}
              upload={editUpload}
              setUpload={setEditUpload}
              onRetry={saveEdit}
              errors={editErrors}
              mode="edit"
              existingRecord={editing}
              onCancel={() => {
                setEditing(null);
                setEditErrors({});
                setEditUpload(createTreasuryUploadState());
              }}
            />
            <div className="treasury-review-column">
              <TreasuryReviewPanel value={editing} upload={editUpload} errors={editErrors} compact />
            </div>
          </div>
        </AdminDialog>
      ) : null}
      {details ? (
        <AdminDialog title={details.title || "Treasury record"} onClose={() => setDetails(null)} className="admin-dialog--wide">
          <TreasuryDetails record={details} />
        </AdminDialog>
      ) : null}
      {target ? (
        <AdminDialog title="Delete transaction?" busy={busy} onClose={() => setTarget(null)}>
          <div className="treasury-delete-summary">
            <strong>{target.title || "Untitled transaction"}</strong>
            <span>{formatInr(target.amount)} - {formatTreasuryDate(target.date)}</span>
          </div>
          <p>This permanently removes the Firestore record and may affect Treasury totals and reports. It does not delete externally uploaded Drive files.</p>
          <div className="admin-actions">
            <button onClick={() => setTarget(null)}>Cancel</button>
            <button className="danger" onClick={() => run("delete-transaction", () => deleteTreasury(target.id), "Treasury transaction permanently deleted.").then((result) => { if (result !== null) setTarget(null); })}>Delete permanently</button>
          </div>
        </AdminDialog>
      ) : null}
    </>
  );
}

function TreasuryOverview({ summary, incomeCount, expenseCount }) {
  const cards = [
    { label: "Total Income", amount: summary.income, detail: `${incomeCount} income records`, tone: "income" },
    { label: "Total Expense", amount: summary.expense, detail: `${expenseCount} expense records`, tone: "expense" },
    { label: "Net Balance", amount: summary.net, detail: summary.net >= 0 ? "Positive club balance" : "Expenses exceed income", tone: summary.net >= 0 ? "net" : "danger" },
    { label: "Pending Reimbursements", amount: summary.pendingReimbursementAmount, detail: `${summary.pendingReimbursementCount} records`, tone: summary.pendingReimbursementCount ? "warning" : "neutral" },
    { label: "This Month", amount: summary.monthNet, detail: `${summary.monthTransactionCount} transactions`, tone: summary.monthNet >= 0 ? "net" : "danger" },
  ];
  return (
    <section className="treasury-overview" aria-label="Treasury overview">
      {cards.map((card) => (
        <article className={`treasury-metric is-${card.tone}`} key={card.label}>
          <span>{card.label}</span>
          <strong>{formatInr(card.amount)}</strong>
          <small>{card.detail}</small>
        </article>
      ))}
    </section>
  );
}

function FieldLabel({ label, required = false, optional = false }) {
  return (
    <span className="treasury-field-label">
      <span>{label}{required ? " *" : ""}</span>
      {optional ? <em>Optional</em> : null}
    </span>
  );
}

function FieldError({ id, message }) {
  return message ? <small id={id} className="treasury-field-error" role="alert">{message}</small> : null;
}

function TreasuryFormSection({ label, title, children }) {
  return (
    <section className="treasury-form-section" aria-label={title}>
      <header>
        <span>{label}</span>
        <h4>{title}</h4>
      </header>
      <div className="treasury-form-grid">
        {children}
      </div>
    </section>
  );
}

function TreasuryForm({ formId, value, setValue, members, onSubmit, busy, upload, setUpload, onRetry, errors, mode, existingRecord, onClear, onCancel }) {
  const plan = getTreasuryFieldPlan(value);
  const uploadWorking = isTreasuryUploadWorking(upload);
  const disabled = busy || uploadWorking;
  const peopleListId = `${formId}-people`;
  const set = (key) => (event) => setValue({ ...value, [key]: event.target.value });
  const describedBy = (key) => errors[key] ? `${formId}-${key}-error` : undefined;
  const statusValue = normalizeReimbursementStatus(value.reimbursementStatus);

  function setWorkflow(workflowType) {
    setValue(applyTreasuryWorkflow(value, workflowType));
  }

  function setAmount(event) {
    setValue({ ...value, amount: sanitizeAmountInput(event.target.value) });
  }

  function setReimbursementStatus(event) {
    const reimbursementStatus = normalizeReimbursementStatus(event.target.value);
    setValue({
      ...value,
      reimbursementStatus,
      reimbursedTo: reimbursementStatus === "Not Applicable" ? "" : value.reimbursedTo,
      reimbursementDate: reimbursementStatus === "Not Applicable" ? "" : value.reimbursementDate,
    });
  }

  return (
    <form className={`admin-form treasury-form is-${plan.accent}`} onSubmit={onSubmit} noValidate>
      <div className="treasury-type-selector" role="radiogroup" aria-label="Transaction type">
        {TREASURY_WORKFLOW_TYPES.map((item) => (
          <button
            type="button"
            role="radio"
            aria-checked={plan.workflowType === item.id}
            className={plan.workflowType === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setWorkflow(item.id)}
            disabled={disabled}
          >
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>
      <datalist id={peopleListId}>
        <option value="Rotaract Club of Pune Heritage" />
        {members.map((member) => <option key={member.id} value={formatRotaractorName(member.name, true)} />)}
      </datalist>
      <TreasuryFormSection label="Core details" title="Transaction identity">
        <label>
          <FieldLabel label="Title" required />
          <input value={value.title} onChange={set("title")} required aria-invalid={Boolean(errors.title)} aria-describedby={describedBy("title")} />
          <FieldError id={`${formId}-title-error`} message={errors.title} />
        </label>
        <label>
          <FieldLabel label={plan.labels.amount} required />
          <span className="treasury-amount-input">
            <span aria-hidden="true">₹</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]+(\\.[0-9]{1,2})?"
              value={value.amount}
              onChange={setAmount}
              onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }}
              required
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={describedBy("amount")}
            />
          </span>
          <FieldError id={`${formId}-amount-error`} message={errors.amount} />
        </label>
        <label>
          <FieldLabel label={plan.labels.date} required />
          <input type="date" value={value.date} onChange={set("date")} required aria-invalid={Boolean(errors.date)} aria-describedby={describedBy("date")} />
          <FieldError id={`${formId}-date-error`} message={errors.date} />
        </label>
      </TreasuryFormSection>
      <TreasuryFormSection label="Transaction details" title="Party, avenue, and payment">
        <label>
          <FieldLabel label="Avenue" optional />
          <select value={value.avenue} onChange={set("avenue")}>
            <option value="">Choose avenue</option>
            {getTreasuryAvenueOptions([]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {plan.show.paidBy ? (
          <label>
            <FieldLabel label={plan.labels.paidBy} required={plan.required.paidBy} optional={!plan.required.paidBy} />
            <input list={peopleListId} value={value.paidBy} onChange={set("paidBy")} required={plan.required.paidBy} aria-invalid={Boolean(errors.paidBy)} aria-describedby={describedBy("paidBy")} />
            <FieldError id={`${formId}-paidBy-error`} message={errors.paidBy} />
          </label>
        ) : null}
        {plan.show.paidTo ? (
          <label>
            <FieldLabel label={plan.labels.paidTo} required />
            <input list={peopleListId} value={value.paidTo} onChange={set("paidTo")} required aria-invalid={Boolean(errors.paidTo)} aria-describedby={describedBy("paidTo")} />
            <FieldError id={`${formId}-paidTo-error`} message={errors.paidTo} />
          </label>
        ) : null}
        {plan.isReimbursement ? (
          <label>
            <FieldLabel label="Reimbursed to" required />
            <input list={peopleListId} value={value.reimbursedTo} onChange={set("reimbursedTo")} required aria-invalid={Boolean(errors.reimbursedTo)} aria-describedby={describedBy("reimbursedTo")} />
            <FieldError id={`${formId}-reimbursedTo-error`} message={errors.reimbursedTo} />
          </label>
        ) : null}
        {plan.show.reimbursementStatus ? (
          <label>
            <FieldLabel label="Reimbursement status" optional />
            <select value={statusValue} onChange={setReimbursementStatus}>
              {TREASURY_REIMBURSEMENT_STATUSES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
        {plan.show.reimbursementDetails && !plan.isReimbursement ? (
          <label>
            <FieldLabel label="Reimbursed to" required={plan.required.reimbursedTo} />
            <input list={peopleListId} value={value.reimbursedTo} onChange={set("reimbursedTo")} required={plan.required.reimbursedTo} aria-invalid={Boolean(errors.reimbursedTo)} aria-describedby={describedBy("reimbursedTo")} />
            <FieldError id={`${formId}-reimbursedTo-error`} message={errors.reimbursedTo} />
          </label>
        ) : null}
        {plan.show.reimbursementDetails ? (
          <label>
            <FieldLabel label="Reimbursement date" required={plan.required.reimbursementDate} optional={!plan.required.reimbursementDate} />
            <input type="date" value={value.reimbursementDate} onChange={set("reimbursementDate")} required={plan.required.reimbursementDate} aria-invalid={Boolean(errors.reimbursementDate)} aria-describedby={describedBy("reimbursementDate")} />
            <FieldError id={`${formId}-reimbursementDate-error`} message={errors.reimbursementDate} />
          </label>
        ) : null}
        <label>
          <FieldLabel label="Payment mode" optional />
          <select value={value.paymentMode} onChange={set("paymentMode")}>
            <option value="">Choose mode</option>
            {TREASURY_PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <FieldLabel label={plan.labels.reference} optional />
          <input value={value.referenceNumber} onChange={set("referenceNumber")} />
        </label>
      </TreasuryFormSection>
      <TreasuryFormSection label="Notes and evidence" title="Description and supporting document">
        <label className="treasury-form-grid__wide">
          <FieldLabel label={plan.labels.purpose} optional />
          <textarea rows="3" value={value.purpose} onChange={set("purpose")} />
        </label>
        <div className="treasury-form-grid__wide treasury-evidence-stack">
          <details className="treasury-form-advanced" open={Boolean(value.billUrl)}>
            <summary>External supporting link</summary>
            <label>
              <FieldLabel label={plan.labels.externalLink} optional />
              <input type="url" value={value.billUrl} onChange={set("billUrl")} placeholder="https://drive.google.com/..." />
            </label>
          </details>
          {existingRecord?.billUrl ? (
            <div className="treasury-existing-file">
              <span>Existing supporting document</span>
              <TreasuryAttachments record={existingRecord} />
            </div>
          ) : null}
          <TreasuryFileField value={upload} onChange={setUpload} disabled={disabled} onRetry={onRetry} />
        </div>
      </TreasuryFormSection>
      <div className="admin-actions treasury-form-actions">
        <button disabled={disabled}>{busy ? "Saving..." : mode === "edit" ? "Update transaction" : "Save transaction"}</button>
        {mode === "edit" ? <button type="button" onClick={onCancel} disabled={busy}>Cancel edit</button> : <button type="button" onClick={onClear} disabled={busy}>Clear form</button>}
      </div>
    </form>
  );
}

function TreasuryClubDuesImportPanel({ rows, meta, validation, disabled, importing, saving, onImportFile, onRowChange, onRowRemove, onClear, onSave }) {
  const inputRef = useRef(null);
  const canSave = rows.length > 0 && !disabled && !saving && !importing;

  function selectFile(event) {
    const file = event.target.files?.[0];
    if (file) onImportFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function rowStatus(rowErrors, rowWarnings) {
    if (Object.keys(rowErrors).length) return { label: "Error", className: "is-error" };
    if (rowWarnings.length) return { label: "Warning", className: "is-warning" };
    return { label: "Ready", className: "is-ready" };
  }

  return (
    <section className="treasury-dues-import" aria-labelledby="treasury-dues-import-title">
      <div className="treasury-dues-import__heading">
        <div>
          <span>Google Form import</span>
          <h4 id="treasury-dues-import-title">Upload CSV/Excel from Google Form responses</h4>
          <p>CSV and .xlsx exports are parsed into a review table first. No Treasury records are created until Save transactions is clicked.</p>
        </div>
        <label className="treasury-dues-import__picker">
          <span>{importing ? "Parsing..." : "Choose CSV or Excel"}</span>
          <input ref={inputRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={selectFile} disabled={disabled || importing || saving} />
        </label>
      </div>
      {meta.fileName || meta.error ? (
        <div className={`treasury-dues-import__meta ${meta.error ? "is-error" : ""}`}>
          <strong>{meta.fileName || "Import"}</strong>
          <span>{meta.error || `${rows.length} payable row${rows.length === 1 ? "" : "s"} ready for review from ${meta.totalRows} response row${meta.totalRows === 1 ? "" : "s"}. ${meta.skippedCount} row${meta.skippedCount === 1 ? "" : "s"} skipped because Dues Paid was not Yes.`}</span>
        </div>
      ) : null}
      {rows.length ? (
        <>
          <div className="treasury-dues-import__table-wrap">
            <table className="treasury-dues-import__table">
              <caption>Imported Club dues transactions pending confirmation</caption>
              <thead>
                <tr>
                  <th>Status / row</th>
                  <th>Date</th>
                  <th>Member name / Received from</th>
                  <th>Amount</th>
                  <th>Payment mode</th>
                  <th>Payment reference</th>
                  <th>Description</th>
                  <th>Proof link</th>
                  <th>Remove</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowErrors = validation.errors[index] || {};
                  const rowWarnings = validation.warnings[index] || [];
                  const status = rowStatus(rowErrors, rowWarnings);
                  const rowMessages = [...Object.values(rowErrors), ...rowWarnings];
                  return (
                    <tr key={row.clientId || index}>
                      <td>
                        <span className={`treasury-dues-import-status ${status.className}`}>{status.label}</span>
                        <small>Form row {row.sourceRowNumber || index + 2}</small>
                        {rowMessages.map((message) => <small className="treasury-dues-import-message" key={message}>{message}</small>)}
                      </td>
                      <td>
                        <input type="date" value={row.date} onChange={(event) => onRowChange(index, { date: event.target.value })} aria-invalid={Boolean(rowErrors.date)} disabled={disabled || saving} />
                      </td>
                      <td>
                        <input value={row.paidBy} onChange={(event) => onRowChange(index, { paidBy: event.target.value })} aria-invalid={Boolean(rowErrors.paidBy)} disabled={disabled || saving} />
                      </td>
                      <td><span className="treasury-amount is-income">{formatInr(CLUB_DUES_AMOUNT)}</span></td>
                      <td>
                        <select value={row.paymentMode} onChange={(event) => onRowChange(index, { paymentMode: event.target.value })} disabled={disabled || saving}>
                          <option value="">Choose mode</option>
                          {TREASURY_PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </td>
                      <td>
                        <input value={row.referenceNumber} onChange={(event) => onRowChange(index, { referenceNumber: event.target.value })} disabled={disabled || saving} />
                      </td>
                      <td>
                        <textarea rows="3" value={row.purpose} onChange={(event) => onRowChange(index, { purpose: event.target.value })} disabled={disabled || saving} />
                      </td>
                      <td>
                        <input type="url" value={row.rawProofLink || row.billUrl} onChange={(event) => onRowChange(index, { billUrl: event.target.value })} placeholder="https://drive.google.com/open?id=..." disabled={disabled || saving} />
                      </td>
                      <td>
                        <button type="button" onClick={() => onRowRemove(index)} disabled={disabled || saving}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-actions treasury-dues-import__actions">
            <button type="button" onClick={onSave} disabled={!canSave}>{saving ? "Saving transactions..." : "Save transactions"}</button>
            <button type="button" onClick={onClear} disabled={disabled || saving}>Clear import</button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function TreasuryClubDuesForm({
  rows,
  uploads,
  errors,
  members,
  onSubmit,
  onRowChange,
  onUploadChange,
  onAddRow,
  onRemoveRow,
  onResetRow,
  importRows,
  importMeta,
  importValidation,
  importBusy,
  importSaving,
  onImportFile,
  onImportRowChange,
  onImportRowRemove,
  onImportClear,
  onImportSave,
  disabled,
  saving,
}) {
  const peopleListId = "treasury-club-dues-people";
  const rowCount = rows.length;
  const amountLabel = formatInr(CLUB_DUES_AMOUNT).replace(".00", "");

  function rowFieldId(rowKey, key) {
    return `treasury-dues-${rowKey}-${key}`;
  }

  function describedBy(rowKey, rowErrors, key) {
    return rowErrors[key] ? rowFieldId(rowKey, `${key}-error`) : undefined;
  }

  return (
    <>
      <TreasuryClubDuesImportPanel
        rows={importRows}
        meta={importMeta}
        validation={importValidation}
        disabled={disabled}
        importing={importBusy}
        saving={importSaving}
        onImportFile={onImportFile}
        onRowChange={onImportRowChange}
        onRowRemove={onImportRowRemove}
        onClear={onImportClear}
        onSave={onImportSave}
      />
      <form className="admin-form treasury-club-dues-form is-income" onSubmit={onSubmit} noValidate>
        <datalist id={peopleListId}>
          <option value="Rotaract Club of Pune Heritage" />
          {members.map((member) => <option key={member.id} value={formatRotaractorName(member.name, true)} />)}
        </datalist>
        <div className="treasury-club-dues-manual-heading">
          <span>Manual dues rows</span>
          <strong>Enter payments by hand</strong>
        </div>
        <div className="treasury-club-dues-rows">
          {rows.map((row, index) => {
            const rowKey = row.clientId || `row-${index + 1}`;
            const rowErrors = errors[index] || {};
            const upload = uploads[index] || createTreasuryUploadState();
            return (
              <section className="treasury-club-dues-row" key={rowKey} aria-label={`Club dues payment ${index + 1}`}>
                <header className="treasury-club-dues-row__header">
                  <div>
                    <span>Payment {index + 1}</span>
                    <h4>{CLUB_DUES_TRANSACTION_TITLE}</h4>
                    <small>{amountLabel} - Income - Club</small>
                  </div>
                  <div className="treasury-club-dues-row__actions">
                    <button type="button" onClick={() => onResetRow(index)} disabled={disabled || Boolean(row.recordId)}>Reset row</button>
                    {rowCount > 1 ? <button type="button" onClick={() => onRemoveRow(index)} disabled={disabled}>Remove</button> : null}
                  </div>
                </header>
                <div className="treasury-club-dues-grid">
                  <label>
                    <FieldLabel label="Date" required />
                    <input
                      type="date"
                      value={row.date}
                      onChange={(event) => onRowChange(index, { date: event.target.value })}
                      required
                      aria-invalid={Boolean(rowErrors.date)}
                      aria-describedby={describedBy(rowKey, rowErrors, "date")}
                    />
                    <FieldError id={rowFieldId(rowKey, "date-error")} message={rowErrors.date} />
                  </label>
                  <label>
                    <FieldLabel label="Received from" required />
                    <input
                      list={peopleListId}
                      value={row.paidBy}
                      onChange={(event) => onRowChange(index, { paidBy: event.target.value })}
                      required
                      aria-invalid={Boolean(rowErrors.paidBy)}
                      aria-describedby={describedBy(rowKey, rowErrors, "paidBy")}
                    />
                    <FieldError id={rowFieldId(rowKey, "paidBy-error")} message={rowErrors.paidBy} />
                  </label>
                  <label>
                    <FieldLabel label="Payment mode" required />
                    <select
                      value={row.paymentMode}
                      onChange={(event) => onRowChange(index, { paymentMode: event.target.value })}
                      required
                      aria-invalid={Boolean(rowErrors.paymentMode)}
                      aria-describedby={describedBy(rowKey, rowErrors, "paymentMode")}
                    >
                      <option value="">Choose mode</option>
                      {TREASURY_PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <FieldError id={rowFieldId(rowKey, "paymentMode-error")} message={rowErrors.paymentMode} />
                  </label>
                  <label>
                    <FieldLabel label="Reference" optional />
                    <input value={row.referenceNumber} onChange={(event) => onRowChange(index, { referenceNumber: event.target.value })} />
                  </label>
                  <label className="treasury-club-dues-grid__wide">
                    <FieldLabel label="Description" optional />
                    <textarea rows="3" value={row.purpose} onChange={(event) => onRowChange(index, { purpose: event.target.value })} aria-invalid={Boolean(rowErrors.purpose)} aria-describedby={describedBy(rowKey, rowErrors, "purpose")} />
                    <FieldError id={rowFieldId(rowKey, "purpose-error")} message={rowErrors.purpose} />
                  </label>
                  <div className="treasury-club-dues-grid__wide treasury-club-dues-bill">
                    <FieldLabel label="Bill screenshot" optional />
                    <TreasuryFileField
                      value={upload}
                      onChange={(value) => onUploadChange(index, value)}
                      disabled={disabled}
                      onRetry={onSubmit}
                      heading="Bill screenshot"
                      helpText="Upload one payment screenshot or receipt for this dues transaction."
                    />
                    <FieldError id={rowFieldId(rowKey, "bill-error")} message={rowErrors.bill} />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        <button className="treasury-dues-add" type="button" onClick={onAddRow} disabled={disabled}>+ Add another dues payment</button>
        <div className="admin-actions treasury-form-actions">
          <button disabled={disabled}>{saving ? "Saving dues transactions..." : "Save dues transactions"}</button>
        </div>
      </form>
    </>
  );
}

function TreasuryClubDuesReviewPanel({ rows, uploads, errors }) {
  const validation = validateClubDuesRows(rows);
  const readyCount = validation.errors.filter((rowErrors) => Object.keys(rowErrors).length === 0).length;
  const fileCount = uploads.filter((upload) => upload?.file || upload?.uploadedMetadata).length;
  const currentErrors = errors.flatMap((rowErrors, index) => Object.values(rowErrors || {}).map((message) => `Row ${index + 1}: ${message}`));
  return (
    <aside className="treasury-review treasury-dues-review is-income" aria-live="polite">
      <div className="treasury-section-heading">
        <div>
          <span>Batch review</span>
          <h3>{CLUB_DUES_TRANSACTION_TITLE}</h3>
        </div>
        <strong>{formatInr(rows.length * CLUB_DUES_AMOUNT)}</strong>
      </div>
      <dl>
        <div><dt>Rows</dt><dd>{rows.length} dues payment{rows.length === 1 ? "" : "s"}</dd></div>
        <div><dt>Ready</dt><dd>{readyCount} of {rows.length}</dd></div>
        <div><dt>Each amount</dt><dd>{formatInr(CLUB_DUES_AMOUNT)}</dd></div>
        <div><dt>Evidence</dt><dd>{fileCount} separate file{fileCount === 1 ? "" : "s"} selected</dd></div>
      </dl>
      {currentErrors.length ? (
        <div className="treasury-review__alerts">
          {currentErrors.slice(0, 3).map((message) => <span key={message}>{message}</span>)}
        </div>
      ) : null}
    </aside>
  );
}

function TreasuryReviewPanel({ value, upload, errors, compact = false }) {
  const review = buildTreasuryReview(value, upload);
  const missing = Object.values(errors || {});
  return (
    <aside className={`treasury-review is-${review.accent} ${compact ? "is-compact" : ""}`} aria-live="polite">
      <div className="treasury-section-heading">
        <div>
          <span>Live review</span>
          <h3>{review.label}</h3>
        </div>
        <strong>{review.amountLabel}</strong>
      </div>
      <dl>
        <div><dt>Transaction</dt><dd>{review.title}</dd></div>
        <div><dt>Party</dt><dd>{review.party}</dd></div>
        <div><dt>Date</dt><dd>{review.date}</dd></div>
        <div><dt>Mode</dt><dd>{review.mode}</dd></div>
        <div><dt>Reference</dt><dd>{review.reference}</dd></div>
        <div><dt>Evidence</dt><dd>{review.evidence}</dd></div>
      </dl>
      {missing.length ? (
        <div className="treasury-review__alerts">
          {missing.slice(0, 3).map((message) => <span key={message}>{message}</span>)}
        </div>
      ) : null}
    </aside>
  );
}

function TreasuryHistory({
  transactions,
  filteredTransactions,
  groupedTransactions,
  filters,
  monthOptions,
  avenueOptions,
  locked,
  onFilter,
  onClearFilters,
  onDetails,
  onEdit,
  onDelete,
  exporting,
  onExportExcel,
  onExportPdf,
  onExportBalanceSheet,
}) {
    const [activeMobileMenuId, setActiveMobileMenuId] = useState("");
  const activeMobileMenuRef = useRef(null);
  const activeFilters = Object.entries(filters).some(([key, value]) => key !== "sort" && Boolean(value)) || filters.sort !== DEFAULT_TREASURY_FILTERS.sort;

  useEffect(() => {
    if (!activeMobileMenuId) return undefined;
    function closeOnOutsideClick(event) {
      if (activeMobileMenuRef.current && !activeMobileMenuRef.current.contains(event.target)) setActiveMobileMenuId("");
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setActiveMobileMenuId("");
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeMobileMenuId]);

  function runMobileAction(action, item) {
    setActiveMobileMenuId("");
    action(item);
  }

  return (
    <section className="admin-panel treasury-history" aria-labelledby="treasury-history-title">
      <div className="treasury-section-heading">
        <div>
          <span>History</span>
          <h3 id="treasury-history-title">Transaction history</h3>
        </div>
        <div className="treasury-history__actions">
          <strong>{filteredTransactions.length} of {transactions.length}</strong>
          <div className="admin-actions treasury-export-actions" aria-label="Treasury export actions">
            <button type="button" onClick={onExportExcel} disabled={Boolean(exporting)}>{exporting === "excel" ? "Generating Excel..." : "Export Excel"}</button>
            <button type="button" onClick={onExportPdf} disabled={Boolean(exporting)}>{exporting === "pdf" ? "Generating PDF..." : "Export PDF"}</button>
          <button
  type="button"
  onClick={onExportBalanceSheet}
  disabled={Boolean(exporting)}
>
  {exporting === "balance-sheet"
    ? "Generating Balance Sheet..."
    : "Export Balance Sheet"}
</button>
          </div>
        </div>
      </div>
      <TreasuryFilterBar filters={filters} monthOptions={monthOptions} avenueOptions={avenueOptions} onFilter={onFilter} onClear={onClearFilters} activeFilters={activeFilters} />
      {filteredTransactions.length ? (
        <>
          <div className="treasury-history__desktop">
            {groupedTransactions.map((group) => (
              <section className="treasury-month-group" key={group.key}>
                <header>
                  <h4>{group.label}</h4>
                  <span>Income {formatInr(group.income)} - Expense {formatInr(group.expense)} - Net {formatInr(group.net)}</span>
                </header>
                <div className="admin-table-wrap treasury-table-wrap">
                  <table>
                    <caption>{group.label} Treasury transactions</caption>
                    <thead><tr><th>Date</th><th>Transaction</th><th>Type</th><th>Amount</th><th>Party</th><th>Avenue</th><th>Payment mode</th><th>Reimbursement</th><th>File</th><th>Actions</th></tr></thead>
                    <tbody>{group.items.map((item) => <TreasuryTableRow key={item.id} item={item} locked={locked} onDetails={onDetails} onEdit={onEdit} onDelete={onDelete} />)}</tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
          <div className="treasury-history__mobile">
            {groupedTransactions.map((group) => (
              <section className="treasury-month-group" key={group.key}>
                <header>
                  <h4>{group.label}</h4>
                  <span>Net {formatInr(group.net)}</span>
                </header>
                <div className="treasury-mobile-list">
                  {group.items.map((item) => (
                    <TreasuryMobileRow
                      key={item.id}
                      item={item}
                      locked={locked}
                      menuOpen={activeMobileMenuId === item.id}
                      menuRef={activeMobileMenuId === item.id ? activeMobileMenuRef : null}
                      onToggleMenu={() => setActiveMobileMenuId((current) => (current === item.id ? "" : item.id))}
                      onDetails={() => runMobileAction(onDetails, item)}
                      onEdit={() => runMobileAction(onEdit, item)}
                      onDelete={() => runMobileAction(onDelete, item)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : <AdminEmpty message="No treasury transactions match the current filters." />}
    </section>
  );
}

function TreasuryFilterBar({ filters, monthOptions, avenueOptions, onFilter, onClear, activeFilters }) {
  return (
    <div className="treasury-filterbar">
      <label className="treasury-filterbar__search">
        <span>Search</span>
        <input value={filters.search} onChange={(event) => onFilter("search", event.target.value)} placeholder="Title, purpose, party, reference" />
      </label>
      <label>
        <span>Type</span>
        <select value={filters.type} onChange={(event) => onFilter("type", event.target.value)}>
          {TREASURY_TYPE_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        <span>Month</span>
        <select value={filters.month} onChange={(event) => onFilter("month", event.target.value)}>
          <option value="">All months</option>
          {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>
        <span>Avenue</span>
        <select value={filters.avenue} onChange={(event) => onFilter("avenue", event.target.value)}>
          <option value="">All avenues</option>
          {avenueOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        <span>Payment mode</span>
        <select value={filters.paymentMode} onChange={(event) => onFilter("paymentMode", event.target.value)}>
          <option value="">All modes</option>
          {TREASURY_PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        <span>Reimbursement</span>
        <select value={filters.reimbursementStatus} onChange={(event) => onFilter("reimbursementStatus", event.target.value)}>
          <option value="">All statuses</option>
          {TREASURY_REIMBURSEMENT_STATUSES.map((item) => <option key={item}>{reimbursementLabel(item)}</option>)}
        </select>
      </label>
      <label>
        <span>File</span>
        <select value={filters.hasFile} onChange={(event) => onFilter("hasFile", event.target.value)}>
          <option value="">Any</option>
          <option value="yes">Has file</option>
          <option value="no">No file</option>
        </select>
      </label>
      <label>
        <span>Sort</span>
        <select value={filters.sort} onChange={(event) => onFilter("sort", event.target.value)}>
          {Object.entries(TREASURY_SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button className="treasury-filterbar__clear" type="button" onClick={onClear} disabled={!activeFilters}>Clear filters</button>
    </div>
  );
}

function TreasuryTableRow({ item, locked, onDetails, onEdit, onDelete }) {
  const type = transactionTypeLabel(item);
  return (
    <tr>
      <td>{formatTreasuryDate(item.date)}</td>
      <td><strong>{item.title || "Untitled transaction"}</strong><span className="treasury-muted">{item.purpose || "No notes"}</span></td>
      <td><span className={`treasury-chip is-${type.toLowerCase()}`}>{type}</span></td>
      <td><span className={`treasury-amount is-${item.type}`}>{formatInr(item.amount)}</span></td>
      <td>{transactionPartyLabel(item)}</td>
      <td>{normalizeTreasuryAvenue(item.avenue) || "-"}</td>
      <td>{item.paymentMode || "-"}</td>
      <td>{reimbursementLabel(item.reimbursementStatus)}</td>
      <td>{treasuryHasSupportingFile(item) ? <button type="button" onClick={() => onDetails(item)}>View</button> : <span className="treasury-muted">None</span>}</td>
      <td><div className="treasury-row-actions"><button type="button" onClick={() => onDetails(item)}>Details</button><button type="button" disabled={locked} onClick={() => onEdit(item)}>Edit</button><button type="button" className="danger" disabled={locked} onClick={() => onDelete(item)}>Delete</button></div></td>
    </tr>
  );
}

function TreasuryMobileRow({ item, locked, menuOpen, menuRef, onToggleMenu, onDetails, onEdit, onDelete }) {
  const type = transactionTypeLabel(item);
  const party = compactTransactionParty(item);
  const menuId = `treasury-mobile-actions-${item.id}`;
  return (
    <article className={`treasury-mobile-row is-${item.type}`}>
      <div className="treasury-mobile-row__top">
        <span className="treasury-mobile-row__date">{formatTreasuryDate(item.date)}</span>
        <span className={`treasury-chip is-${type.toLowerCase()}`}>{type}</span>
        <strong className={`treasury-mobile-row__amount treasury-amount is-${item.type}`}>{formatInr(item.amount)}</strong>
        <div className="treasury-mobile-row__actions" ref={menuRef}>
          <button
            type="button"
            className="treasury-mobile-row__menu-trigger"
            aria-label={`Actions for ${item.title || "untitled transaction"}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={onToggleMenu}
          >
            <span className="treasury-mobile-row__menu-dots" aria-hidden="true"><span></span><span></span><span></span></span>
          </button>
          {menuOpen ? (
            <div className="treasury-mobile-row__menu" id={menuId} role="menu" aria-label="Transaction actions">
              <button type="button" role="menuitem" onClick={onDetails}>View details</button>
              <button type="button" role="menuitem" disabled={locked} onClick={onEdit}>Edit transaction</button>
              <button type="button" role="menuitem" className="danger" disabled={locked} onClick={onDelete}>Delete transaction</button>
            </div>
          ) : null}
        </div>
      </div>
      <strong className="treasury-mobile-row__title">{item.title || "Untitled transaction"}</strong>
      <p className="treasury-mobile-row__party"><span>{party.label}</span> {party.value}</p>
      <p className="treasury-mobile-row__meta">
        <span>{normalizeTreasuryAvenue(item.avenue) || "No avenue"}</span>
        <span>{item.paymentMode || "No mode"}</span>
        <span>{treasuryHasSupportingFile(item) ? "File attached" : "No file"}</span>
      </p>
    </article>
  );
}

function TreasuryDetails({ record }) {
  const rows = [
    ["Type", transactionTypeLabel(record)],
    ["Amount", formatInr(record.amount)],
    ["Date", formatTreasuryDate(record.date)],
    ["Party", transactionPartyLabel(record)],
    ["Avenue", normalizeTreasuryAvenue(record.avenue) || "Not recorded"],
    ["Purpose / notes", record.purpose || "Not recorded"],
    ["Payment mode", record.paymentMode || "Not recorded"],
    ["Payment reference", record.referenceNumber || "Not recorded"],
    ["Reimbursement status", reimbursementLabel(record.reimbursementStatus)],
    ["Reimbursed to", record.reimbursedTo || "Not recorded"],
    ["Reimbursement date", record.reimbursementDate ? formatTreasuryDate(record.reimbursementDate) : "Not recorded"],
    ["Created at", formatTimestamp(record.createdAt)],
    ["Created by", record.createdByName || "Not recorded"],
    ["Updated at", formatTimestamp(record.updatedAt)],
    ["Updated by", record.updatedByName || "Not recorded"],
  ];
  return (
    <div className="treasury-details">
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <TreasuryAttachments record={record} />
    </div>
  );
}

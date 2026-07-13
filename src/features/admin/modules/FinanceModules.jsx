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
import { downloadTreasuryPdf } from "../treasury/treasuryPdf";
import { createTreasuryUploadState, getSafeTreasuryUploadError, validateTreasuryUploadFile } from "../treasury/treasuryUploadModel";
import {
  DEFAULT_TREASURY_FILTERS,
  TREASURY_PAYMENT_MODES,
  TREASURY_REIMBURSEMENT_STATUSES,
  TREASURY_WORKFLOW_TYPES,
  applyTreasuryWorkflow,
  buildTreasuryPayload,
  buildTreasuryReview,
  buildTreasurySummary,
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
  prepareTreasuryDraft,
  sanitizeAmountInput,
  transactionPartyLabel,
  treasuryHasSupportingFile,
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

export function TreasuryModule({ transactions, members, lock, uid, onNotice }) {
  const [lastDefaults, setLastDefaults] = useState({ avenue: "", paymentMode: "" });
  const [draft, setDraft] = useState(() => createEmptyTreasuryDraft());
  const [draftErrors, setDraftErrors] = useState({});
  const [draftUpload, setDraftUpload] = useState(createTreasuryUploadState);
  const [draftRecordId, setDraftRecordId] = useState("");
  const [editing, setEditing] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editUpload, setEditUpload] = useState(createTreasuryUploadState);
  const [details, setDetails] = useState(null);
  const [target, setTarget] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_TREASURY_FILTERS);
  const [exporting, setExporting] = useState("");
  const { busy, run } = useAdminMutation({ uid, module: "treasury", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const summary = useMemo(() => buildTreasurySummary(transactions), [transactions]);
  const filteredTransactions = useMemo(() => filterAndSortTreasury(transactions, filters), [transactions, filters]);
  const groupedTransactions = useMemo(() => groupTreasuryByMonth(filteredTransactions), [filteredTransactions]);
  const monthOptions = useMemo(() => getTreasuryMonthOptions(transactions), [transactions]);
  const avenueOptions = useMemo(() => getTreasuryAvenueOptions(transactions), [transactions]);
  const incomeCount = transactions.filter((item) => item.type === "income").length;
  const expenseCount = transactions.filter((item) => item.type === "expense").length;

  function reportValidation(message) {
    onNotice?.({ type: "error", message });
  }

  function resetDraft(defaults = lastDefaults) {
    setDraft(createEmptyTreasuryDraft(defaults));
    setDraftErrors({});
    setDraftUpload(createTreasuryUploadState());
    setDraftRecordId("");
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
              <h3>{draftRecordId ? "Resume saved transaction" : "Record transaction"}</h3>
            </div>
            {draftRecordId ? <strong>Record saved - upload can be retried</strong> : null}
          </div>
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
        </div>
        <div className="treasury-review-column">
          <TreasuryReviewPanel value={draft} upload={draftUpload} errors={draftErrors} />
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
      />
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

function TreasuryHistory({ transactions, filteredTransactions, groupedTransactions, filters, monthOptions, avenueOptions, locked, onFilter, onClearFilters, onDetails, onEdit, onDelete, exporting, onExportExcel, onExportPdf }) {
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

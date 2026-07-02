import { useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty } from "../shared/AdminStates";
import { AVENUES, buildFinePayload, formatInr, safeUrl } from "../shared/adminModel";
import { addFine, deleteFine, deleteTreasury, newTreasuryId, setTreasuryById, updateTreasury, uploadTreasuryBill } from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";
import TreasuryAttachments from "../treasury/TreasuryAttachments";
import TreasuryFileField from "../treasury/TreasuryFileField";
import { createTreasuryUploadState, getSafeTreasuryUploadError, validateTreasuryUploadFile } from "../treasury/treasuryUploadModel";

export function FinesModule({ fines, members, lock, uid, onNotice }) {
  const empty = { memberId: "", reason: "", eventName: "", date: "", amount: "" };
  const [draft, setDraft] = useState(empty);
  const [target, setTarget] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "fines", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const total = fines.reduce((sum, fine) => sum + fine.amount, 0);
  function submit(e) {
    e.preventDefault();
    const member = members.find((item) => item.id === draft.memberId);
    const payload = buildFinePayload({ ...draft, memberName: member?.name || "" });
    if (!payload.memberId || !payload.reason || !payload.eventName || !payload.date || payload.amount === null) return;
    run("add-fine", () => addFine(payload), "Fine added.").then((result) => { if (result) setDraft(empty); });
  }
  return <><AdminModuleHeader title="Sergeant-at-Arms: Fines" /><div className={`admin-lock-banner ${locked ? "is-locked" : ""}`}>{locked ? "Fines are locked or lock status is unavailable." : `${fines.length} records · ${formatInr(total)}`}</div><section className="admin-panel"><form className="admin-form admin-form--inline" onSubmit={submit}><label>Member<select value={draft.memberId} onChange={(e) => setDraft({ ...draft, memberId: e.target.value })} required><option value="">Choose member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Reason<select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} required><option value="">Choose reason</option><option value="missing_badge">Missing badge</option><option value="late">Late to event/meeting</option></select></label><label>Event/meeting<input value={draft.eventName} onChange={(e) => setDraft({ ...draft, eventName: e.target.value })} required /></label><label>Date<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required /></label><label>Amount INR<input type="number" min="0" step="1" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} required /></label><button disabled={locked || busy}>Add fine</button></form></section>{fines.length ? <div className="admin-table-wrap"><table><caption>Fine records</caption><thead><tr><th>Member</th><th>Amount</th><th>Reason</th><th>Event</th><th>Date</th><th>Action</th></tr></thead><tbody>{fines.map((fine) => <tr key={fine.id}><td>{fine.memberName || fine.memberId}</td><td>{formatInr(fine.amount)}</td><td>{fine.reason}</td><td>{fine.eventName}</td><td>{fine.date}</td><td><button className="danger" disabled={locked} onClick={() => setTarget(fine)}>Delete</button></td></tr>)}</tbody></table></div> : <AdminEmpty message="No fine records." />}{target ? <AdminDialog title="Permanently delete fine?" busy={busy} onClose={() => setTarget(null)}><p>This matches production behavior and cannot be undone.</p><div className="admin-actions"><button onClick={() => setTarget(null)}>Cancel</button><button className="danger" onClick={() => run("delete-fine", () => deleteFine(target.id), "Fine permanently deleted.").then((result) => { if (result !== null) setTarget(null); })}>Delete permanently</button></div></AdminDialog> : null}</>;
}

const EMPTY_TREASURY = {
  title: "", type: "income", amount: "", date: "", avenue: "", purpose: "", paidBy: "", paidByType: "other", paidByMemberId: "", paidTo: "", paidToType: "other", paidToMemberId: "", paymentMode: "", referenceNumber: "", reimbursementStatus: "Not Applicable", reimbursedTo: "", reimbursementDate: "", billUrl: "",
};

function treasuryPayload(source) {
  const fields = { ...source };
  delete fields.id;
  return {
    ...fields,
    title: source.title.trim(),
    name: source.title.trim(),
    amount: Number(source.amount),
    purpose: source.purpose.trim(),
    linkedEventName: source.purpose.trim(),
    cheque: source.referenceNumber.trim(),
    reimburse: source.reimbursementStatus,
    billUrl: safeUrl(source.billUrl),
  };
}

function validTreasuryPayload(value) {
  return Boolean(value.title && value.date && value.avenue && value.amount > 0);
}

export function TreasuryModule({ transactions, members, lock, uid, onNotice }) {
  const [draft, setDraft] = useState(EMPTY_TREASURY);
  const [draftUpload, setDraftUpload] = useState(createTreasuryUploadState);
  const [draftRecordId, setDraftRecordId] = useState("");
  const [editing, setEditing] = useState(null);
  const [editUpload, setEditUpload] = useState(createTreasuryUploadState);
  const [details, setDetails] = useState(null);
  const [target, setTarget] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "treasury", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);

  function reportValidation(message) {
    onNotice?.({ type: "error", message });
  }

  async function uploadForRecord(fileState, setFileState, source, transactionId, onComplete) {
    const value = treasuryPayload(source);
    const result = await run(
      "upload-treasury-file",
      async () => {
        const metadata = fileState.uploadedMetadata || await uploadTreasuryBill(fileState.file, value, transactionId, (status) => setFileState((current) => ({ ...current, status, error: "" })));
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
    const value = treasuryPayload(draft);
    if (!validTreasuryPayload(value)) return reportValidation("Complete the required Treasury fields before saving.");
    if (draftUpload.error && !draftUpload.file) return reportValidation(draftUpload.error);
    if (draftUpload.file) {
      const fileError = validateTreasuryUploadFile(draftUpload.file);
      if (fileError) return reportValidation(fileError);
      if (!value.purpose) return reportValidation("Enter a transaction purpose before uploading a supporting file.");
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
    if (!draftUpload.file) {
      setDraft(EMPTY_TREASURY);
      setDraftUpload(createTreasuryUploadState());
      setDraftRecordId("");
      return;
    }
    await uploadForRecord(draftUpload, setDraftUpload, value, id, () => {
      setDraft(EMPTY_TREASURY);
      setDraftUpload(createTreasuryUploadState());
      setDraftRecordId("");
    });
  }

  async function saveEdit(event) {
    event?.preventDefault();
    const value = treasuryPayload(editing);
    if (!validTreasuryPayload(value)) return reportValidation("Complete the required Treasury fields before saving.");
    if (editUpload.error && !editUpload.file) return reportValidation(editUpload.error);
    if (editUpload.file) {
      const fileError = validateTreasuryUploadFile(editUpload.file);
      if (fileError) return reportValidation(fileError);
      if (!value.purpose) return reportValidation("Enter a transaction purpose before uploading a supporting file.");
    }
    const saved = await run("update-transaction", async () => { await updateTreasury(editing.id, value); return editing.id; }, "Treasury transaction updated.");
    if (!saved) return;
    if (!editUpload.file) return setEditing(null);
    await uploadForRecord(editUpload, setEditUpload, value, editing.id, () => setEditing(null));
  }

  function startEdit(item) {
    setEditUpload(createTreasuryUploadState());
    setEditing({ ...item });
  }

  return (
    <>
      <AdminModuleHeader title="Treasury" description="Income, expenses, reimbursements, bills." />
      <div className={`admin-lock-banner ${locked ? "is-locked" : ""}`}>{locked ? "Treasury is locked or unavailable." : `Income ${formatInr(income)} · Expense ${formatInr(expense)} · Net ${formatInr(income - expense)}`}</div>
      <section className="admin-panel">
        <h3>Add transaction</h3>
        <TreasuryForm value={draft} setValue={setDraft} members={members} onSubmit={saveDraft} busy={busy || locked} upload={draftUpload} setUpload={setDraftUpload} onRetry={saveDraft} />
      </section>
      {transactions.length ? (
        <div className="admin-table-wrap">
          <table>
            <caption>Treasury transactions</caption>
            <thead><tr><th>Title</th><th>Type</th><th>Amount</th><th>Date</th><th>Avenue</th><th>Paid by/to</th><th>Reimbursement</th><th>File</th><th>Actions</th></tr></thead>
            <tbody>{transactions.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.type}</td><td>{formatInr(item.amount)}</td><td>{item.date}</td><td>{item.avenue}</td><td>{item.paidBy || "-"} / {item.paidTo || "-"}</td><td>{item.reimbursementStatus}</td><td>{item.billUrl ? <button type="button" onClick={() => setDetails(item)}>View file</button> : "None"}</td><td><button disabled={locked} onClick={() => startEdit(item)}>Edit</button><button className="danger" disabled={locked} onClick={() => setTarget(item)}>Delete</button></td></tr>)}</tbody>
          </table>
        </div>
      ) : <AdminEmpty message="No treasury transactions." />}
      {editing ? <AdminDialog title={`Edit ${editing.title}`} busy={busy} onClose={() => setEditing(null)} className="admin-dialog--wide"><TreasuryForm value={editing} setValue={setEditing} members={members} onSubmit={saveEdit} busy={busy} upload={editUpload} setUpload={setEditUpload} onRetry={saveEdit} /></AdminDialog> : null}
      {details ? <AdminDialog title={details.title || "Treasury record"} onClose={() => setDetails(null)}><TreasuryAttachments record={details} /></AdminDialog> : null}
      {target ? <AdminDialog title="Permanently delete transaction?" busy={busy} onClose={() => setTarget(null)}><p>This matches production behavior and does not delete an externally uploaded Drive file.</p><div className="admin-actions"><button onClick={() => setTarget(null)}>Cancel</button><button className="danger" onClick={() => run("delete-transaction", () => deleteTreasury(target.id), "Treasury transaction permanently deleted.").then((result) => { if (result !== null) setTarget(null); })}>Delete permanently</button></div></AdminDialog> : null}
    </>
  );
}

function TreasuryForm({ value, setValue, members, onSubmit, busy, upload, setUpload, onRetry }) {
  const set = (key) => (event) => setValue({ ...value, [key]: event.target.value });
  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <div className="admin-form-grid">
        <label>Title<input value={value.title} onChange={set("title")} required /></label>
        <label>Type<select value={value.type} onChange={set("type")}><option value="income">Income</option><option value="expense">Expense</option></select></label>
        <label>Amount INR<input type="number" min="0.01" step="0.01" value={value.amount} onChange={set("amount")} required /></label>
        <label>Date<input type="date" value={value.date} onChange={set("date")} required /></label>
        <label>Avenue<select value={value.avenue} onChange={set("avenue")} required><option value="">Choose</option>{[...AVENUES, "Other"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Purpose<input value={value.purpose} onChange={set("purpose")} /></label>
        <label>Paid by<select value={value.paidBy} onChange={set("paidBy")}><option value="">Other/none</option><option value="Rotaract Club of Pune Heritage">Club</option>{members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
        <label>Paid to<input value={value.paidTo} onChange={set("paidTo")} /></label>
        <label>Payment mode<select value={value.paymentMode} onChange={set("paymentMode")}><option value="">Choose</option>{["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Reference<input value={value.referenceNumber} onChange={set("referenceNumber")} /></label>
        <label>Reimbursement<select value={value.reimbursementStatus} onChange={set("reimbursementStatus")}><option>Not Applicable</option><option>Pending</option><option>Done</option></select></label>
        <label>Reimbursed to<input value={value.reimbursedTo} onChange={set("reimbursedTo")} /></label>
        <label>Reimbursement date<input type="date" value={value.reimbursementDate} onChange={set("reimbursementDate")} /></label>
        <label>Existing file URL<input type="url" value={value.billUrl} onChange={set("billUrl")} /></label>
      </div>
      <TreasuryFileField value={upload} onChange={setUpload} disabled={busy} onRetry={onRetry} />
      <button disabled={busy}>Save transaction</button>
    </form>
  );
}

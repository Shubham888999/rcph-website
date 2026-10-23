import { useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import { removeFineProof, uploadFineProof } from "../shared/adminService";
import TreasuryAttachments from "../treasury/TreasuryAttachments";
import TreasuryFileField from "../treasury/TreasuryFileField";
import { isTreasuryUploadWorking } from "../treasury/treasuryModel";
import { createTreasuryUploadState, getSafeTreasuryUploadError, validateTreasuryUploadFile } from "../treasury/treasuryUploadModel";
import { formatInr } from "../shared/adminModel";
import { fineHasProof } from "./fineProofModel";

// Manage a Fine's payment screenshot from Fines or Treasury. Saving updates the
// Fine, its Treasury entry and the visit dashboard together.
export default function FineProofDialog({ target, locked, busy, run, onClose }) {
  const [upload, setUpload] = useState(createTreasuryUploadState());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const hasProof = fineHasProof(target.record);
  const working = busy || isTreasuryUploadWorking(upload);

  async function save() {
    const fileError = validateTreasuryUploadFile(upload.file);
    if (fileError) {
      setUpload((current) => ({ ...current, error: fileError }));
      return;
    }
    const saved = await run(
      "upload-fine-proof",
      () => uploadFineProof(upload.file, target, (status) => setUpload((current) => ({ ...current, status, error: "" }))),
      hasProof ? "Payment screenshot replaced." : "Payment screenshot saved.",
      {
        onError(error) {
          setUpload((current) => ({ ...current, status: "failed", error: getSafeTreasuryUploadError(error) }));
          return false;
        },
      },
    );
    if (saved) onClose();
  }

  async function remove() {
    const removed = await run("remove-fine-proof", () => removeFineProof(target.fineId), "Payment screenshot removed.");
    if (removed) onClose();
  }

  return (
    <AdminDialog title="Manage fine" busy={working} onClose={onClose} className="fine-proof-dialog">
      <div className="fine-proof-dialog__summary">
        <strong>{target.memberName || "Member"}</strong>
        <span>{[formatInr(target.transaction.amount), target.transaction.date, target.summary].filter(Boolean).join(" · ")}</span>
      </div>

      {hasProof ? <TreasuryAttachments record={target.record} /> : <p className="treasury-attachments__empty">No payment screenshot yet.</p>}

      <TreasuryFileField
        value={upload}
        onChange={setUpload}
        disabled={locked || working}
        heading={hasProof ? "Replace payment screenshot" : "Add payment screenshot"}
        helpText="A screenshot or PDF of the payment. It shows on this fine, its Treasury entry and the visit dashboard."
      />

      {locked ? <p className="fine-proof-dialog__note">Fines or Treasury are locked, so screenshots can't be changed right now.</p> : null}

      <div className="admin-actions">
        {hasProof ? (
          confirmRemove ? (
            <button type="button" className="danger" disabled={locked || working} onClick={remove}>Confirm remove</button>
          ) : (
            <button type="button" className="danger" disabled={locked || working} onClick={() => setConfirmRemove(true)}>Remove screenshot</button>
          )
        ) : null}
        <button type="button" onClick={onClose} disabled={working}>Close</button>
        <button type="button" disabled={locked || working || !upload.file} onClick={save}>
          {hasProof ? "Replace screenshot" : "Save screenshot"}
        </button>
      </div>
    </AdminDialog>
  );
}

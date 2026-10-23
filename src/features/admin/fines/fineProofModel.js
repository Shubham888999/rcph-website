import { fineReasonLabel } from "../fines-export/finesExportModel.js";

// A Fine's payment proof is one file, stored on the Fine and on its linked
// Treasury entry. These helpers describe the upload from either side, so Fines
// and Treasury attach the same file the same way.

function text(value, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function fineHasProof(record) {
  return Boolean(text(record?.billUrl, 1000));
}

export function isFineLinkedTreasury(item) {
  return item?.source === "fine" && Boolean(text(item?.fineId, 128));
}

export function fineProofTargetFromFine(fine) {
  const reason = fineReasonLabel(fine?.reason);
  const memberName = text(fine?.memberName, 160);
  return {
    fineId: fine.id,
    // Historical Fines without a Treasury entry still get a Drive folder by Fine ID.
    transactionId: text(fine?.treasuryEntryId, 128) || `fine_${fine.id}`,
    transaction: {
      date: fine.date,
      purpose: text(["Fine", reason, memberName].filter(Boolean).join(" - "), 180),
      type: "income",
      amount: fine.amount,
    },
    record: fine,
    memberName,
    summary: [reason, fine.eventName].filter(Boolean).join(" · "),
  };
}

export function fineProofTargetFromTreasury(item) {
  return {
    fineId: item.fineId,
    transactionId: item.id,
    transaction: {
      date: item.date,
      purpose: text(item.purpose || item.title, 180) || "Fine",
      type: item.type || "income",
      amount: item.amount,
    },
    record: item,
    memberName: text(item.memberName || item.paidBy, 160),
    summary: [item.title, item.eventName].filter(Boolean).join(" · "),
  };
}

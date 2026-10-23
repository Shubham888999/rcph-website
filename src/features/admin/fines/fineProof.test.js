import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeFine } from "../shared/adminModel.js";
import { normalizeVisitDashboardData } from "../../visits/visitDashboardModel.js";
import { fineHasProof, fineProofTargetFromFine, fineProofTargetFromTreasury, isFineLinkedTreasury } from "./fineProofModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const financeSource = read("../modules/FinanceModules.jsx");
const dialogSource = read("./FineProofDialog.jsx");
const serviceSource = read("../shared/adminService.js");
const visitPageSource = read("../../../pages/visits/VisitDashboardPage.jsx");

const rawFine = {
  memberId: "m1",
  memberName: "Rtr. Harshal Nikam",
  reason: "late",
  amount: 50,
  date: "2026-09-26",
  eventName: "Gajasanskruti 10.0",
  treasuryEntryId: "fine_f1",
  billUrl: "https://drive.google.com/file/d/proof-file-id/view",
  billDriveFileId: "proof-file-id",
  billFileName: "upi.png",
  billMimeType: "image/png",
  billSizeBytes: 1200,
};

test("fines keep their payment proof fields", () => {
  const fine = normalizeFine("f1", rawFine);
  assert.equal(fine.billUrl, rawFine.billUrl);
  assert.equal(fine.billDriveFileId, "proof-file-id");
  assert.equal(fineHasProof(fine), true);
  assert.equal(fineHasProof(normalizeFine("f2", { ...rawFine, billUrl: "" })), false);
});

test("a fine's screenshot goes to its Treasury entry, or a fine_ folder for older fines", () => {
  const target = fineProofTargetFromFine(normalizeFine("f1", rawFine));
  assert.equal(target.fineId, "f1");
  assert.equal(target.transactionId, "fine_f1");
  assert.deepEqual(target.transaction, { date: "2026-09-26", purpose: "Fine - Late to event/meeting - Harshal Nikam", type: "income", amount: 50 });

  const historical = fineProofTargetFromFine(normalizeFine("old", { ...rawFine, treasuryEntryId: "" }));
  assert.equal(historical.transactionId, "fine_old");
});

test("Treasury recognises fine entries and manages the same fine", () => {
  const item = { id: "fine_f1", source: "fine", fineId: "f1", date: "2026-09-26", amount: 50, type: "income", title: "Fine - late", purpose: "Fine - late - Harshal Nikam", memberName: "Harshal Nikam" };
  assert.equal(isFineLinkedTreasury(item), true);
  assert.equal(isFineLinkedTreasury({ ...item, source: "" }), false);
  assert.equal(isFineLinkedTreasury({ ...item, fineId: "" }), false);
  const target = fineProofTargetFromTreasury(item);
  assert.equal(target.fineId, "f1");
  assert.equal(target.transactionId, "fine_f1");
  assert.equal(target.transaction.purpose, "Fine - late - Harshal Nikam");
});

test("the upload uses the Treasury uploader, then the backend saves it on both records", () => {
  assert.match(serviceSource, /callable\("setFineProof", \{ fineId, proof \}\)/);
  assert.match(serviceSource, /callable\("setFineProof", \{ fineId, remove: true \}\)/);
  assert.match(serviceSource, /uploadTreasuryBill\(file, target\.transaction, target\.transactionId, onStatus\)/);
  assert.doesNotMatch(serviceSource, /updateTreasury\(target/, "fine-linked Treasury entries are backend-only");
});

test("fine rows use a ⋮ menu with Manage and Delete, and show the screenshot", () => {
  const fines = financeSource.slice(financeSource.indexOf("export function FinesModule"), financeSource.indexOf("const TREASURY_TYPE_FILTERS"));
  assert.match(fines, /<RowActionsMenu/);
  assert.match(fines, /\{ label: "Manage", onSelect: \(\) => setProofTarget\(fineProofTargetFromFine\(fine\)\) \}/);
  assert.match(fines, /\{ label: "Delete", danger: true, disabled: locked, onSelect: \(\) => setTarget\(fine\) \}/);
  assert.doesNotMatch(fines, /<button className="danger" disabled=\{locked\} onClick=\{\(\) => setTarget\(fine\)\}>Delete<\/button>/);
  assert.match(fines, /<th>Screenshot<\/th>/);
  assert.match(fines, /heading="Payment screenshot \(optional\)"/);
  assert.match(fines, /<FineProofDialog target=\{proofTarget\}/);
});

test("Treasury swaps Edit and Delete for the screenshot on fine entries", () => {
  assert.match(financeSource, /isFineLinkedTreasury\(item\) \? \(\s*<button type="button" onClick=\{\(\) => onManageProof\(item\)\}/);
  assert.match(financeSource, /<button type="button" role="menuitem" onClick=\{onManageProof\}>Manage screenshot<\/button>/);
  assert.match(financeSource, /<FineProofDialog target=\{fineProofTarget\}/);
});

test("the Manage dialog can add, replace and remove, and respects locks", () => {
  assert.match(dialogSource, /uploadFineProof\(upload\.file, target,/);
  assert.match(dialogSource, /removeFineProof\(target\.fineId\)/);
  assert.match(dialogSource, /Confirm remove/);
  assert.match(dialogSource, /disabled=\{locked \|\| working \|\| !upload\.file\}/);
});

test("the DZR fines table links the same screenshot", () => {
  const data = normalizeVisitDashboardData({
    fines: { rows: [
      { fineKey: "a", memberName: "A", reason: "late", amount: 50, date: "2026-09-26", proofCanOpen: true, proofOpenUrl: "https://drive.google.com/file/d/proof-file-id/view?usp=x" },
      { fineKey: "b", memberName: "B", reason: "late", amount: 50, date: "2026-09-25", proofCanOpen: true, proofOpenUrl: "https://evil.example/file" },
    ] },
  });
  const [withProof, badLink] = data.fines.rows;
  assert.equal(withProof.proofOpenUrl, "https://drive.google.com/file/d/proof-file-id/view");
  assert.equal(withProof.proofCanOpen, true);
  assert.equal(badLink.proofCanOpen, false, "only Drive file links are shown");
  assert.match(visitPageSource, /<th scope="col">Proof<\/th>/);
  assert.match(visitPageSource, /href=\{fine\.proofOpenUrl\}/);
});

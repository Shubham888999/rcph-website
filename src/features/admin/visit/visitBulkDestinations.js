import { visitUploadChoices } from "./visitModel.js";

const pathKey = label => String(label || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function bulkDestinationChoices(folder) {
  return visitUploadChoices(folder).map(choice => ({
    ...choice,
    label: choice.key ? choice.label : "Main folder / Supporting files",
  }));
}

export function bulkSharedDestinationChoices(folders = []) {
  const paths = new Map();
  for (const folder of folders) {
    for (const choice of bulkDestinationChoices(folder).filter(choice => choice.key)) {
      const value = pathKey(choice.label);
      if (!paths.has(value)) paths.set(value, { value, label: choice.label });
    }
  }
  return [...paths.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveBulkDestination(folder, sharedPath = "", selectedKey) {
  const choices = bulkDestinationChoices(folder);
  const choice = selectedKey !== undefined
    ? choices.find(item => item.key === selectedKey)
    : choices.find(item => sharedPath ? pathKey(item.label) === pathKey(sharedPath) : item.key === "");
  return choice
    ? { documentCategory: choice.key, destinationLabel: choice.label, destinationValid: true, destinationError: "" }
    : { documentCategory: "__missing__", destinationLabel: `Missing: ${sharedPath || "selected folder"}`, destinationValid: false, destinationError: "The selected destination does not exist here. Create it first and reopen Bulk upload, or choose another destination." };
}

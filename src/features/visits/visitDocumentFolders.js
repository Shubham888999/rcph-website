import { visitFolderCategories } from "../admin/visit/visitModel.js";

const SECRETARY_KEYS = new Set(["secretary", "joint-secretary", "co-secretary"]);
const BUILT_IN_KEYS = new Set(["inward", "outward", "inward-register", "outward-register"]);
const CUSTOM_KEY = /^custom-[a-f0-9]{8}$/;

export function normalizeVisitDocumentFolderMetadata(panel) {
  const supportsDocumentCategories = SECRETARY_KEYS.has(panel?.positionKey);
  const seen = new Set();
  const folders = (Array.isArray(panel?.customFolders) ? panel.customFolders : []).slice(0, 40).flatMap(raw => {
    if (!raw || typeof raw.key !== "string" || !CUSTOM_KEY.test(raw.key) || seen.has(raw.key) || typeof raw.name !== "string" || !raw.name.trim()) return [];
    seen.add(raw.key);
    return [{ key: raw.key, name: raw.name.trim().slice(0, 80), parentKey: typeof raw.parentKey === "string" ? raw.parentKey : "" }];
  });
  const parents = new Set(folders.filter(folder => !folder.parentKey).map(folder => folder.key));
  return {
    supportsDocumentCategories,
    customFolders: folders.filter(folder => !folder.parentKey || parents.has(folder.parentKey) || (supportsDocumentCategories && BUILT_IN_KEYS.has(folder.parentKey))),
  };
}

// Use the same folder order and labels as Club Visits. Unknown legacy categories
// stay accessible under Supporting files instead of disappearing from the viewer.
export function buildVisitDocumentFolderTree(panel, orderedFiles = panel?.files || []) {
  const categories = visitFolderCategories(normalizeVisitDocumentFolderMetadata(panel));
  const nodes = new Map(categories.map(folder => [folder.key, { key: folder.key, label: folder.label, parentKey: folder.parentKey || "", files: [], children: [], fileCount: 0 }]));
  const roots = [];
  for (const folder of categories) {
    const node = nodes.get(folder.key);
    if (folder.depth && nodes.has(folder.parentKey)) nodes.get(folder.parentKey).children.push(node);
    else roots.push(node);
  }
  for (const file of orderedFiles) {
    const node = nodes.get(file.documentCategory || "") || nodes.get("");
    node.files.push(file);
  }
  for (const node of nodes.values()) node.fileCount = node.files.length;
  for (const node of roots) node.fileCount += node.children.reduce((total, child) => total + child.fileCount, 0);
  return roots;
}

export function visitDocumentFolderPath(nodes, submissionId) {
  if (!submissionId) return [];
  for (const node of nodes) {
    if (node.files.some(file => file.submissionId === submissionId)) return [node.key];
    const childPath = visitDocumentFolderPath(node.children, submissionId);
    if (childPath.length) return [node.key, ...childPath];
  }
  return [];
}

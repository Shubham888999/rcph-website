import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import { safeAdminError } from "../shared/adminErrors";
import {
  VISIT_OPTIONS,
  buildFolderChecklistRows,
  createDefaultVisitConfig,
  createVisitDraft,
  createVisitDrafts,
  normalizeVisitConfigs,
  toggleVisiblePositionKey,
  updateVisitDraftBoolean,
  updateVisitDraftOfficialNames,
} from "./clubVisitManagementModel";
import {
  loadVisitDashboardConfigs,
  loadVisitDashboardFolderOptions,
  loadVisitSignupAvailability,
  saveVisitDashboardConfig,
} from "./clubVisitManagementService";

const EMPTY_FOLDERS = Object.freeze([]);
const DEFAULT_SIGNUP_AVAILABILITY = Object.freeze({ available: false, visits: [] });
const TOGGLES = Object.freeze([
  ["enabled", "Enable visit"],
  ["signupOpen", "Open District Official signup"],
  ["dashboardVisible", "Show dashboard/access"],
  ["allowDistrictOfficials", "Allow District Officials to access this dashboard"],
]);

function mergeVisitConfig(configs, savedConfig) {
  const normalized = normalizeVisitConfigs(configs);
  return normalized.map((config) => (
    config.visitType === savedConfig.visitType ? savedConfig : config
  ));
}

function folderStateFor(states, visitType) {
  return states[visitType] || { status: "idle", folders: EMPTY_FOLDERS, error: "" };
}

function statusClass(active) {
  return active ? "is-active" : "is-muted";
}

export default function ClubVisitManagementModule({ onNotice }) {
  const [selectedVisitType, setSelectedVisitType] = useState(VISIT_OPTIONS[0].visitType);
  const [configs, setConfigs] = useState(() => normalizeVisitConfigs([]));
  const [drafts, setDrafts] = useState(() => createVisitDrafts([]));
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [signupAvailability, setSignupAvailability] = useState(DEFAULT_SIGNUP_AVAILABILITY);
  const [folderStates, setFolderStates] = useState({});
  const generationRef = useRef(0);

  const selectedOption = VISIT_OPTIONS.find((visit) => visit.visitType === selectedVisitType) || VISIT_OPTIONS[0];
  const draft = drafts[selectedVisitType] || createVisitDraft(createDefaultVisitConfig(selectedVisitType));
  const folderState = folderStateFor(folderStates, selectedVisitType);
  const folderRows = useMemo(
    () => buildFolderChecklistRows(draft, folderState.folders || EMPTY_FOLDERS),
    [draft, folderState.folders],
  );

  const load = useCallback(async (refresh = false) => {
    const generation = ++generationRef.current;
    setStatus((current) => (current === "success" && refresh ? "refreshing" : "loading"));
    setError("");
    try {
      const [nextConfigs, nextSignupAvailability] = await Promise.all([
        loadVisitDashboardConfigs(),
        loadVisitSignupAvailability(),
      ]);
      if (generationRef.current !== generation) return;
      setConfigs(nextConfigs);
      setDrafts(createVisitDrafts(nextConfigs));
      setSignupAvailability(nextSignupAvailability);
      setStatus("success");
    } catch (failure) {
      if (generationRef.current !== generation) return;
      setError(safeAdminError(failure));
      setStatus("error");
    }
  }, []);

  const loadFolders = useCallback(async (visitType, refresh = false) => {
    setFolderStates((current) => ({
      ...current,
      [visitType]: {
        status: refresh && current[visitType]?.status === "success" ? "refreshing" : "loading",
        folders: current[visitType]?.folders || EMPTY_FOLDERS,
        error: "",
      },
    }));
    try {
      const folders = await loadVisitDashboardFolderOptions(visitType);
      setFolderStates((current) => ({
        ...current,
        [visitType]: { status: "success", folders, error: "" },
      }));
    } catch (failure) {
      setFolderStates((current) => ({
        ...current,
        [visitType]: {
          status: "error",
          folders: current[visitType]?.folders || EMPTY_FOLDERS,
          error: safeAdminError(failure),
        },
      }));
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    const current = folderStateFor(folderStates, selectedVisitType);
    if (current.status !== "idle") return;
    loadFolders(selectedVisitType);
  }, [folderStates, loadFolders, selectedVisitType]);

  function patchDraft(updater) {
    setDrafts((current) => {
      const currentDraft = current[selectedVisitType] || createVisitDraft(createDefaultVisitConfig(selectedVisitType));
      return { ...current, [selectedVisitType]: updater(currentDraft) };
    });
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const savedConfig = await saveVisitDashboardConfig(draft);
      setConfigs((current) => mergeVisitConfig(current, savedConfig));
      setDrafts((current) => ({ ...current, [savedConfig.visitType]: createVisitDraft(savedConfig) }));
      setSignupAvailability(await loadVisitSignupAvailability());
      onNotice?.({ type: "success", message: "Club Visit Management settings saved." });
    } catch (failure) {
      const message = safeAdminError(failure);
      setError(message);
      onNotice?.({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  return <>
    <AdminModuleHeader
      title="Club Visit Management"
      description="Control visit access, District Official signup, and dashboard folder visibility."
      action={<button type="button" onClick={() => load(true)} disabled={status === "loading" || status === "refreshing" || saving}>{status === "refreshing" ? "Refreshing..." : "Refresh"}</button>}
    />
    {status === "loading" ? <AdminLoading label="Loading Club Visit Management..." /> : null}
    {status === "error" ? <AdminError message={error} onRetry={() => load(true)} /> : null}
    {status === "success" || status === "refreshing" ? <form className="visit-management" onSubmit={save}>
      {error ? <p className="visit-management__error" role="alert">{error}</p> : null}
      <section className="visit-management__selector" aria-label="Visit type">
        <label htmlFor="visit-management-type">Visit</label>
        <select id="visit-management-type" value={selectedVisitType} onChange={(event) => setSelectedVisitType(event.target.value)}>
          {VISIT_OPTIONS.map((visit) => <option key={visit.visitType} value={visit.visitType}>{visit.visitName}</option>)}
        </select>
      </section>
      <section className="visit-management__status-strip" aria-label={`${selectedOption.visitName} status`}>
        <span className={statusClass(draft.enabled)}>{draft.enabled ? "Enabled" : "Disabled"}</span>
        <span className={statusClass(draft.signupOpen)}>{draft.signupOpen ? "Signup Open" : "Signup Closed"}</span>
        <span className={statusClass(draft.dashboardVisible)}>{draft.dashboardVisible ? "Dashboard Visible" : "Dashboard Hidden"}</span>
        <span className={statusClass(draft.allowDistrictOfficials)}>{draft.allowDistrictOfficials ? "District Officials Allowed" : "District Officials Blocked"}</span>
      </section>
      <section className="visit-management__panel">
        <header className="visit-management__section-heading">
          <div>
            <h3>{selectedOption.visitName}</h3>
            <p>Upload folders remain managed in Club Visits. This page only controls what appears on read-only visit dashboards.</p>
          </div>
          <span>{signupAvailability.available ? `${signupAvailability.visits.length} signup option${signupAvailability.visits.length === 1 ? "" : "s"} live` : "Signup closed"}</span>
        </header>
        <div className="visit-management__toggle-grid">
          {TOGGLES.map(([field, label]) => <label key={field} className="visit-management__toggle">
            <input type="checkbox" checked={draft[field] === true} onChange={(event) => patchDraft((current) => updateVisitDraftBoolean(current, field, event.target.checked))} />
            <span>{label}</span>
          </label>)}
        </div>
        {draft.signupOpen ? <p className="visit-management__safety">District Official signup will appear on the Create Account page while this setting is on.</p> : null}
        {draft.dashboardVisible ? <p className="visit-management__safety">Approved District Officials, Admins, BODs, and President may see this visit in Available Areas based on access rules.</p> : null}
        <label className="visit-management__names" htmlFor="visit-management-officials">
          <span>District Official display names</span>
          <textarea
            id="visit-management-officials"
            rows="6"
            value={draft.officialDisplayNamesText}
            onChange={(event) => patchDraft((current) => updateVisitDraftOfficialNames(current, event.target.value))}
          />
        </label>
        <details className="visit-management__folders">
          <summary>Visible BOD folders</summary>
          <FolderChecklist
            rows={folderRows}
            state={folderState}
            onRetry={() => loadFolders(selectedVisitType, true)}
            onToggle={(positionKey, checked) => patchDraft((current) => toggleVisiblePositionKey(current, positionKey, checked))}
          />
        </details>
        <div className="admin-actions visit-management__actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</button>
        </div>
      </section>
    </form> : null}
  </>;
}

function FolderChecklist({ rows, state, onRetry, onToggle }) {
  if (state.status === "loading" || state.status === "refreshing") {
    return <AdminLoading label={state.status === "refreshing" ? "Refreshing folder options..." : "Loading folder options..."} />;
  }
  if (state.status === "error") {
    return <AdminError message={state.error} onRetry={onRetry} />;
  }
  if (!rows.length) {
    return <AdminEmpty message="No BOD folders are available for this visit yet." />;
  }
  return <div className="visit-management__folder-list">
    {rows.map((row) => <label key={row.positionKey} className={`visit-management__folder-row${row.unavailable ? " is-unavailable" : ""}`}>
      <input
        type="checkbox"
        value={row.positionKey}
        checked={row.checked}
        onChange={(event) => onToggle(row.positionKey, event.target.checked)}
      />
      <span>
        <strong>{row.positionTitle}</strong>
        <small>{row.avenueCode || "No avenue"} - {row.unavailable ? "Unavailable - uncheck to remove" : `${row.enabled ? "Enabled" : "Disabled"} / ${row.submissionOpen ? "Open" : "Closed"} / ${row.locked ? "Locked" : "Unlocked"} / ${row.activeFileCount} active files`}</small>
      </span>
    </label>)}
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import AdminDialog from "../admin/shared/AdminDialog";
import {
  PROFILE_GENDERS,
  buildProfileUpdatePayload,
  createProfileDraft,
  formatProfileHistoryValue,
  getProfileFieldLabel,
  isProspectProfile,
  todayDateString,
  updateProfileDraft,
  validateProfileDraft,
} from "./profileModel";
import "../../styles/components/profile-editor.css";

const GENDER_OPTIONS = [
  ["", "Not recorded"],
  ["woman", "Woman"],
  ["man", "Man"],
  ["non-binary", "Non-binary"],
  ["self-describe", "Prefer to self-describe"],
  ["prefer-not-to-say", "Prefer not to say"],
];

function FieldError({ id, message }) {
  return message ? <p id={id} className="profile-field-error" role="alert">{message}</p> : null;
}

function fieldId(prefix, field) {
  return `${prefix}-${field}`;
}

export default function ProfileEditorDialog({
  profile,
  title,
  busy = false,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => createProfileDraft(profile));
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const today = todayDateString();
  const role = profile?.role || draft.role;
  const prospect = isProspectProfile(role);
  const canEditRotaryId = !prospect;
  const validation = useMemo(
    () => validateProfileDraft(draft, { role, today }),
    [draft, role, today],
  );
  const disabled = busy || saving;
  const prefix = "profile-editor";

  function change(field, value) {
    setDraft((current) => updateProfileDraft(current, field, value));
    setSaveError("");
  }

  async function submit(event) {
    event.preventDefault();
    const nextValidation = validateProfileDraft(draft, { role, today });
    if (!nextValidation.valid || disabled) return;
    setSaving(true);
    setSaveError("");
    try {
      const result = await onSave(buildProfileUpdatePayload(draft, { role, today }));
      setSaving(false);
      onClose(result);
    } catch (error) {
      setSaveError(error?.message || "Profile could not be saved. Please retry.");
      setSaving(false);
    }
  }

  return (
    <AdminDialog title={title || "Edit profile"} busy={disabled} onClose={() => onClose(null)} className="profile-editor-dialog">
      <form className="profile-editor-form" onSubmit={submit}>
        {saveError ? <p className="profile-editor-alert" role="alert">{saveError}</p> : null}

        <div className="profile-editor-grid">
          <label>
            <span>Full name</span>
            <input
              id={fieldId(prefix, "name")}
              value={draft.name}
              maxLength="160"
              disabled={disabled}
              aria-invalid={Boolean(validation.errors.name)}
              aria-describedby={validation.errors.name ? fieldId(prefix, "name-error") : undefined}
              onChange={(event) => change("name", event.target.value)}
              autoFocus
            />
            <FieldError id={fieldId(prefix, "name-error")} message={validation.errors.name} />
          </label>

          <label>
            <span>Email address</span>
            <input value={draft.email || "Not recorded"} readOnly disabled />
          </label>

          <label>
            <span>Phone</span>
            <input
              value={draft.phone}
              type="tel"
              autoComplete="tel"
              maxLength="40"
              disabled={disabled}
              aria-invalid={Boolean(validation.errors.phone)}
              aria-describedby={validation.errors.phone ? fieldId(prefix, "phone-error") : undefined}
              onChange={(event) => change("phone", event.target.value)}
            />
            <FieldError id={fieldId(prefix, "phone-error")} message={validation.errors.phone} />
          </label>

          {canEditRotaryId ? (
            <label>
              <span>RID / Rotary ID</span>
              <input
                value={draft.rotaryId}
                maxLength="40"
                placeholder="Enter your Rotary ID if available"
                disabled={disabled}
                aria-invalid={Boolean(validation.errors.rotaryId)}
                aria-describedby={`${fieldId(prefix, "rotaryId-help")}${validation.errors.rotaryId ? ` ${fieldId(prefix, "rotaryId-error")}` : ""}`}
                onChange={(event) => change("rotaryId", event.target.value)}
              />
              <p id={fieldId(prefix, "rotaryId-help")} className="profile-field-help">Add this only if you already have a Rotary International ID.</p>
              <FieldError id={fieldId(prefix, "rotaryId-error")} message={validation.errors.rotaryId} />
            </label>
          ) : null}

          <label>
            <span>Date of birth</span>
            <input
              value={draft.dateOfBirth}
              type="date"
              min="1900-01-01"
              max={today}
              disabled={disabled}
              aria-invalid={Boolean(validation.errors.dateOfBirth)}
              aria-describedby={validation.errors.dateOfBirth ? fieldId(prefix, "dateOfBirth-error") : undefined}
              onChange={(event) => change("dateOfBirth", event.target.value)}
            />
            <FieldError id={fieldId(prefix, "dateOfBirth-error")} message={validation.errors.dateOfBirth} />
          </label>

          <label>
            <span>Gender</span>
            <select
              value={PROFILE_GENDERS.includes(draft.gender) ? draft.gender : ""}
              disabled={disabled}
              aria-invalid={Boolean(validation.errors.gender)}
              aria-describedby={validation.errors.gender ? fieldId(prefix, "gender-error") : undefined}
              onChange={(event) => change("gender", event.target.value)}
            >
              {GENDER_OPTIONS.map(([value, label]) => <option key={value || "empty"} value={value}>{label}</option>)}
            </select>
            <FieldError id={fieldId(prefix, "gender-error")} message={validation.errors.gender} />
          </label>

          {draft.gender === "self-describe" ? (
            <label>
              <span>Gender description</span>
              <input
                value={draft.genderSelfDescribe}
                maxLength="160"
                disabled={disabled}
                aria-invalid={Boolean(validation.errors.genderSelfDescribe)}
                aria-describedby={validation.errors.genderSelfDescribe ? fieldId(prefix, "genderSelfDescribe-error") : undefined}
                onChange={(event) => change("genderSelfDescribe", event.target.value)}
              />
              <FieldError id={fieldId(prefix, "genderSelfDescribe-error")} message={validation.errors.genderSelfDescribe} />
            </label>
          ) : null}
        </div>

        <label>
          <span>Hobbies</span>
          <textarea
            value={draft.hobbies}
            rows="3"
            maxLength="600"
            disabled={disabled}
            aria-invalid={Boolean(validation.errors.hobbies)}
            aria-describedby={validation.errors.hobbies ? fieldId(prefix, "hobbies-error") : undefined}
            onChange={(event) => change("hobbies", event.target.value)}
          />
          <FieldError id={fieldId(prefix, "hobbies-error")} message={validation.errors.hobbies} />
        </label>

        {prospect ? (
          <fieldset className="profile-editor-fieldset">
            <legend>Prospect details</legend>
            <div className="profile-editor-grid">
              <label>
                <span>Previous Rotaract</span>
                <select
                  value={draft.previousRotaract}
                  disabled={disabled}
                  aria-invalid={Boolean(validation.errors.previousRotaract)}
                  onChange={(event) => change("previousRotaract", event.target.value)}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                <FieldError id={fieldId(prefix, "previousRotaract-error")} message={validation.errors.previousRotaract} />
              </label>

              <label>
                <span>Referred</span>
                <select
                  value={draft.referred}
                  disabled={disabled}
                  aria-invalid={Boolean(validation.errors.referred)}
                  onChange={(event) => change("referred", event.target.value)}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                <FieldError id={fieldId(prefix, "referred-error")} message={validation.errors.referred} />
              </label>
            </div>

            {draft.previousRotaract === "yes" ? (
              <label>
                <span>Rotaract experience</span>
                <textarea
                  value={draft.previousRotaractDetails}
                  rows="3"
                  maxLength="1200"
                  disabled={disabled}
                  aria-invalid={Boolean(validation.errors.previousRotaractDetails)}
                  aria-describedby={validation.errors.previousRotaractDetails ? fieldId(prefix, "previousRotaractDetails-error") : undefined}
                  onChange={(event) => change("previousRotaractDetails", event.target.value)}
                />
                <FieldError id={fieldId(prefix, "previousRotaractDetails-error")} message={validation.errors.previousRotaractDetails} />
              </label>
            ) : null}

            <label>
              <span>Reason for joining</span>
              <textarea
                value={draft.joinReason}
                rows="3"
                maxLength="1200"
                disabled={disabled}
                aria-invalid={Boolean(validation.errors.joinReason)}
                aria-describedby={validation.errors.joinReason ? fieldId(prefix, "joinReason-error") : undefined}
                onChange={(event) => change("joinReason", event.target.value)}
              />
              <FieldError id={fieldId(prefix, "joinReason-error")} message={validation.errors.joinReason} />
            </label>

            {draft.referred === "yes" ? (
              <label>
                <span>Referred by</span>
                <input
                  value={draft.referredBy}
                  maxLength="160"
                  disabled={disabled}
                  aria-invalid={Boolean(validation.errors.referredBy)}
                  aria-describedby={validation.errors.referredBy ? fieldId(prefix, "referredBy-error") : undefined}
                  onChange={(event) => change("referredBy", event.target.value)}
                />
                <FieldError id={fieldId(prefix, "referredBy-error")} message={validation.errors.referredBy} />
              </label>
            ) : null}
          </fieldset>
        ) : null}

        <div className="profile-editor-actions">
          <button type="button" onClick={() => onClose(null)} disabled={disabled}>Cancel</button>
          <button type="submit" disabled={disabled || !validation.valid}>{saving ? "Saving..." : "Save profile"}</button>
        </div>
      </form>
    </AdminDialog>
  );
}

export function ProfileHistoryDialog({
  target,
  onClose,
  loadHistory,
}) {
  const [state, setState] = useState({ status: "loading", entries: [], cursor: null, error: "" });
  const targetUid = target?.targetUid || target?.uid || "";

  useEffect(() => {
    let active = true;
    setState({ status: "loading", entries: [], cursor: null, error: "" });
    loadHistory({ targetUid, limit: 20, cursor: null })
      .then((result) => {
        if (!active) return;
        setState({
          status: "success",
          entries: Array.isArray(result.history) ? result.history : [],
          cursor: result.nextCursor || null,
          error: "",
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({ status: "error", entries: [], cursor: null, error: error?.message || "History could not be loaded." });
      });
    return () => {
      active = false;
    };
  }, [loadHistory, targetUid]);

  async function loadMore() {
    if (!state.cursor || state.status === "loading-more") return;
    setState((current) => ({ ...current, status: "loading-more" }));
    try {
      const result = await loadHistory({ targetUid, limit: 20, cursor: state.cursor });
      const incoming = Array.isArray(result.history) ? result.history : [];
      setState((current) => ({
        status: "success",
        entries: [...current.entries, ...incoming.filter((entry) => !current.entries.some((item) => item.id === entry.id))],
        cursor: result.nextCursor || null,
        error: "",
      }));
    } catch (error) {
      setState((current) => ({ ...current, status: "success", error: error?.message || "More history could not be loaded." }));
    }
  }

  return (
    <AdminDialog title={`Profile history: ${target?.name || "Account"}`} onClose={onClose} className="profile-history-dialog">
      {state.status === "loading" ? <p className="profile-history-state">Loading history...</p> : null}
      {state.status === "error" ? <p className="profile-editor-alert" role="alert">{state.error}</p> : null}
      {state.error && state.status === "success" ? <p className="profile-editor-alert" role="alert">{state.error}</p> : null}
      {state.status !== "loading" && state.status !== "error" && !state.entries.length ? (
        <p className="profile-history-state">No profile changes recorded.</p>
      ) : null}
      {state.entries.length ? (
        <ol className="profile-history-list">
          {state.entries.map((entry) => (
            <li key={entry.id}>
              <header>
                <strong>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Time not recorded"}</strong>
                <span>{entry.actorName || entry.actorUid || "Unknown actor"} - {entry.source === "self" ? "Self-service" : "Admin"}</span>
              </header>
              <dl>
                {(entry.changedFields || []).map((field) => (
                  <div key={field}>
                    <dt>{getProfileFieldLabel(field)}</dt>
                    <dd>
                      <span>{formatProfileHistoryValue(entry.before?.[field])}</span>
                      <b aria-hidden="true">-&gt;</b>
                      <span>{formatProfileHistoryValue(entry.after?.[field])}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="profile-editor-actions">
        <button type="button" onClick={onClose}>Close</button>
        {state.cursor ? <button type="button" onClick={loadMore} disabled={state.status === "loading-more"}>{state.status === "loading-more" ? "Loading..." : "Load more"}</button> : null}
      </div>
    </AdminDialog>
  );
}

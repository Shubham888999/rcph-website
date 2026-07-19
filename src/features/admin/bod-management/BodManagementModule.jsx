import { useCallback, useEffect, useRef, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import { adminCalls, uploadBodProfilePhoto } from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";
import BodCouncil from "../../bod/BodCouncil";
import BodLeadership from "../../bod/BodLeadership";
import {
  BOD_PHOTO_FILE_ACCEPT,
  BOD_PROFILE_SECTION_KEY,
  BOD_MANAGEMENT_RIY_LABEL,
  BOD_MANAGEMENT_SECTIONS,
  LEADERSHIP_PROFILE_SECTION_KEY,
  activeProfilesForSection,
  applyBodProfileMutationResult,
  applyBodSectionPublishResult,
  applyBodSectionSaveResult,
  archivedProfilesForSection,
  bodProfileToForm,
  buildArchiveBodProfilePayload,
  buildCreateBodPhotoUploadSessionPayload,
  buildFinalizeBodPhotoUploadPayload,
  buildPublishBodSectionPayload,
  buildRemoveBodProfilePhotoPayload,
  buildReorderBodProfilesPayload,
  buildRestoreBodProfilePayload,
  buildSaveBodSectionPublicationPayload,
  buildUpsertBodProfilePayload,
  createDefaultBodManagementBoard,
  createDefaultBodProfileForm,
  formatBodPublishedDate,
  formatBodPhotoSize,
  getBodDraftPreviewMembers,
  getBodProfileWarnings,
  getBodPhotoBadge,
  getBodPhotoDimensionWarnings,
  getBodSectionPublicationReview,
  getProfileCountsForSection,
  hasReadyPhoto,
  initialBodPublicationSelections,
  isBodSectionSaveEnabled,
  isRevisionConflict,
  canMoveProfile,
  moveProfileOrder,
  needsDraftConfirmation,
  normalizeBodManagementBoard,
  normalizeBodProfileForm,
  profileDraftIndicators,
  sectionConfig,
  validateBodPhotoFile,
  validateBodProfileForm,
} from "./bodManagementModel";
import "../../../styles/components/bod.css";

const CHANGE_NOTICE = "BOD Management changed elsewhere. The latest profile data is being loaded.";
function formatRiyLabel(label) {
  return String(label || "").replace(/(\d{4})\s*-\s*(\d{2})/, "$1 - $2");
}
export default function BodManagementModule({ uid, onNotice }) {
  const [state, setState] = useState({
    status: "loading",
    board: createDefaultBodManagementBoard(),
    selections: initialBodPublicationSelections(),
  });
  const [confirmSectionKey, setConfirmSectionKey] = useState("");
  const [publishSectionKey, setPublishSectionKey] = useState("");
  const [previewSectionKey, setPreviewSectionKey] = useState("");
  const [workspaceSectionKey, setWorkspaceSectionKey] = useState(BOD_PROFILE_SECTION_KEY);
  const [editor, setEditor] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [photoTarget, setPhotoTarget] = useState(null);
  const [removePhotoTarget, setRemovePhotoTarget] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "bod-management", onNotice });

  const applyBoardResult = useCallback((result) => {
    const board = normalizeBodManagementBoard(result);
    setState({
      status: "success",
      board,
      selections: initialBodPublicationSelections(board),
    });
  }, []);

  const load = useCallback((refresh = false) => {
    setState((current) => ({
      ...current,
      status: current.status === "success" && refresh ? "refreshing" : "loading",
    }));
    adminCalls.getBodManagementBoard()
      .then(applyBoardResult)
      .catch(() => {
        setState((current) => ({ ...current, status: "error" }));
      });
  }, [applyBoardResult]);

  useEffect(() => {
    let active = true;
    adminCalls.getBodManagementBoard()
      .then((result) => {
        if (active) applyBoardResult(result);
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, status: "error" }));
      });
    return () => { active = false; };
  }, [applyBoardResult]);

  function updateSelection(sectionKey, publicationStatus) {
    setState((current) => ({
      ...current,
      selections: {
        ...current.selections,
        [sectionKey]: publicationStatus === "public" ? "public" : "draft",
      },
    }));
  }

  function handleConflict(error) {
    if (!isRevisionConflict(error)) return false;
    setEditor(null);
    setArchiveTarget(null);
    setRemovePhotoTarget(null);
    setConfirmSectionKey("");
    setPublishSectionKey("");
    setPreviewSectionKey("");
    onNotice?.({ type: "error", message: CHANGE_NOTICE });
    load(true);
    return true;
  }

  function applyProfileResult(result) {
    setState((current) => {
      const board = applyBodProfileMutationResult(current.board, result);
      return {
        status: "success",
        board,
        selections: initialBodPublicationSelections(board),
      };
    });
  }

  async function saveSection(sectionKey) {
    const payload = buildSaveBodSectionPublicationPayload(state.board, sectionKey);
    const result = await run(
      `save-${sectionKey}-draft`,
      () => adminCalls.saveBodSectionPublication(payload),
      "BOD Management status saved.",
      { onError: handleConflict },
    );
    if (!result) return false;
    const board = applyBodSectionSaveResult(state.board, result);
    setState({
      status: "success",
      board,
      selections: initialBodPublicationSelections(board),
    });
    return true;
  }

  function requestSave(sectionKey) {
    if (!isBodSectionSaveEnabled(state.board, state.selections, sectionKey)) return;
    if (needsDraftConfirmation(state.board, state.selections, sectionKey)) {
      setConfirmSectionKey(sectionKey);
      return;
    }
    saveSection(sectionKey);
  }

  async function publishSection(sectionKey) {
    let payload;

    try {
      payload = buildPublishBodSectionPayload(state.board, sectionKey);
    } catch (error) {
      onNotice?.({
        type: "error",
        message: error.message || "This BOD section cannot be published.",
      });
      return false;
    }

    const result = await run(
      `publish-bod-section-${sectionKey}`,
      () => adminCalls.publishBodSection(payload),
      "BOD section published successfully.",
      { onError: handleConflict },
    );

    if (!result) return false;

    const board = applyBodSectionPublishResult(state.board, result);

    setState({
      status: "success",
      board,
      selections: initialBodPublicationSelections(board),
    });

    setPublishSectionKey("");
    return true;
  }

  function requestPublish(sectionKey) {
    if (busy || !state.board.initialized) return;
    setPublishSectionKey(sectionKey);
  }

  function requestDraftPreview(sectionKey) {
    if (busy || !state.board.initialized) return;
    setPreviewSectionKey(sectionKey);
  }

  async function submitProfile(form) {
    let payload;
    try {
      payload = buildUpsertBodProfilePayload(state.board, form);
    } catch (error) {
      onNotice?.({ type: "error", message: error.message || "Check the BOD profile fields." });
      return;
    }
    const result = await run(
      form.profileId ? `update-bod-profile-${form.sectionKey}` : `create-bod-profile-${form.sectionKey}`,
      () => adminCalls.upsertBodProfile(payload),
      form.profileId ? "BOD profile updated." : "BOD profile created.",
      { onError: handleConflict },
    );
    if (!result) return;
    applyProfileResult(result);
    setEditor(null);
  }

  async function archiveProfile(profile) {
    const result = await run(
      `archive-bod-profile-${profile.sectionKey}`,
      () => adminCalls.archiveBodProfile(buildArchiveBodProfilePayload(state.board, profile.id)),
      "BOD profile archived.",
      { onError: handleConflict },
    );
    if (!result) return;
    applyProfileResult(result);
    setArchiveTarget(null);
  }

  async function restoreProfile(profile) {
    const result = await run(
      `restore-bod-profile-${profile.sectionKey}`,
      () => adminCalls.restoreBodProfile(buildRestoreBodProfilePayload(state.board, profile.id)),
      "BOD profile restored.",
      { onError: handleConflict },
    );
    if (!result) return;
    applyProfileResult(result);
  }

  async function removePhoto(profile) {
    const result = await run(
      `remove-bod-photo-${profile.sectionKey}`,
      () => adminCalls.removeBodProfilePhoto(buildRemoveBodProfilePhotoPayload(state.board, profile.id)),
      "BOD profile photo removed.",
      { onError: handleConflict },
    );
    if (!result) return;
    applyProfileResult(result);
    setRemovePhotoTarget(null);
  }

  async function reorderProfile(profile, direction) {
    const sectionKey = profile.sectionKey || workspaceSectionKey;
    const orderedProfileIds = moveProfileOrder(state.board, sectionKey, profile.id, direction);
    if (!orderedProfileIds.length) return;
    const currentIds = activeProfilesForSection(state.board, sectionKey).map((item) => item.id);
    if (orderedProfileIds.join("|") === currentIds.join("|")) return;
    const result = await run(
      `reorder-bod-profiles-${sectionKey}`,
      () => adminCalls.reorderBodProfiles(buildReorderBodProfilesPayload(state.board, sectionKey, orderedProfileIds)),
      "BOD profile order saved.",
      { onError: handleConflict },
    );
    if (!result) return;
    applyProfileResult(result);
  }

  if (state.status === "loading") {
    return <AdminLoading label="Loading BOD Management status..." />;
  }

  if (state.status === "error") {
    return <AdminError message="BOD Management status could not be loaded." onRetry={() => load(true)} />;
  }

  const board = state.board;
  const confirmConfig = sectionConfig(confirmSectionKey);
  const publishConfig = sectionConfig(publishSectionKey);
  const previewConfig = sectionConfig(previewSectionKey);
  const publishReview = publishConfig
    ? getBodSectionPublicationReview(board, publishSectionKey)
    : null;
  const previewMembers = previewConfig
    ? getBodDraftPreviewMembers(board, previewSectionKey)
    : [];

  return (
    <>
      <AdminModuleHeader
        title="BOD Management"
        description="Manage draft Club BOD and external leadership profiles, along with their section publication status."
        action={<button type="button" onClick={() => load(true)} disabled={busy || state.status === "refreshing"}>{state.status === "refreshing" ? "Refreshing..." : "Refresh"}</button>}
      />

      <section className="admin-panel bod-management-summary" aria-labelledby="bod-management-riy-title">
        <div>
          <p className="admin-kicker">Active RIY</p>
<h3 id="bod-management-riy-title">
  {formatRiyLabel(board.riyLabel || BOD_MANAGEMENT_RIY_LABEL)}
</h3>
          <p>Board ID: {formatRiyLabel(board.boardId)}</p>
        </div>
        <span className={board.initialized ? "bod-management-badge is-public" : "bod-management-badge is-draft"}>
          {board.initialized ? "Initialized" : "Not initialized"}
        </span>
      </section>

      {!board.initialized ? (
        <section className="admin-panel bod-management-notice" role="status">
<p>
  BOD Management has not been initialized yet. Saving either section as Draft will create the{" "}
  {formatRiyLabel(BOD_MANAGEMENT_RIY_LABEL)} configuration.
</p>        </section>
      ) : null}

      <div className="admin-card-grid bod-management-grid">
        {BOD_MANAGEMENT_SECTIONS.map((section) => (
          <BodSectionStatusCard
            key={section.key}
            board={board}
            busy={busy}
            config={section}
            selected={state.selections[section.key]}
            publicationReview={getBodSectionPublicationReview(board, section.key)}
            onChange={(value) => updateSelection(section.key, value)}
            onSave={() => requestSave(section.key)}
            onPreview={() => requestDraftPreview(section.key)}
            onPublish={() => requestPublish(section.key)}
          />
        ))}
      </div>

      <BodProfileWorkspace
        board={board}
        busy={busy}
        selectedSectionKey={workspaceSectionKey}
        onSelectSection={(sectionKey) => {
          if (!busy) setWorkspaceSectionKey(sectionKey);
        }}
        onAdd={() => setEditor(createDefaultBodProfileForm(board, workspaceSectionKey))}
        onEdit={(profile) => setEditor(bodProfileToForm(profile))}
        onPhoto={setPhotoTarget}
        onRemovePhoto={setRemovePhotoTarget}
        onArchive={setArchiveTarget}
        onRestore={restoreProfile}
        onMove={reorderProfile}
      />

      {!BOD_MANAGEMENT_SECTIONS.length ? <AdminEmpty message="No BOD Management sections are configured." /> : null}

      {editor ? (
        <BodProfileEditorDialog
          board={board}
          busy={busy}
          form={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={submitProfile}
          onPhoto={setPhotoTarget}
          onRemovePhoto={setRemovePhotoTarget}
        />
      ) : null}

{photoTarget ? (
  <BodProfilePhotoDialog
    key={`${photoTarget.sectionKey}:${photoTarget.id}`}
    board={board}
          profile={currentProfile(board, photoTarget)}
          onNotice={onNotice}
          onClose={() => setPhotoTarget(null)}
          onApplied={applyProfileResult}
          onConflict={() => {
            onNotice?.({ type: "error", message: CHANGE_NOTICE });
            load(true);
          }}
        />
      ) : null}

{removePhotoTarget ? (
  <AdminDialog
    title={`Remove photo for ${removePhotoTarget.name || "this profile"}?`}
    busy={busy}
    onClose={() => setRemovePhotoTarget(null)}
  >
    <p>
      The working draft will mark the current photo as removed. The private Drive
      file is retained for audit and recovery.
    </p>

    <div className="admin-actions">
            <button type="button" onClick={() => setRemovePhotoTarget(null)} disabled={busy}>Cancel</button>
            <button type="button" className="danger" disabled={busy} onClick={() => removePhoto(removePhotoTarget)}>
              Remove Photo
            </button>
          </div>
        </AdminDialog>
      ) : null}

      {archiveTarget ? (
        <AdminDialog
          title={archiveTarget.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY
            ? "Archive this external leadership profile?"
            : "Archive this Club BOD profile?"}
          busy={busy}
          onClose={() => setArchiveTarget(null)}
        >
          <p>It will leave active management, be excluded from the next publication, and can be restored later.</p>
          <div className="admin-actions">
            <button type="button" onClick={() => setArchiveTarget(null)} disabled={busy}>Cancel</button>
            <button type="button" className="danger" disabled={busy} onClick={() => archiveProfile(archiveTarget)}>
              Archive Profile
            </button>
          </div>
        </AdminDialog>
      ) : null}

      {confirmConfig ? (
        <AdminDialog
          title={confirmConfig.confirmTitle}
          busy={busy}
          onClose={() => setConfirmSectionKey("")}
        >
          <p>{confirmConfig.confirmMessage}</p>
          <div className="admin-actions">
            <button type="button" onClick={() => setConfirmSectionKey("")} disabled={busy}>Cancel</button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => saveSection(confirmSectionKey).then((saved) => {
                if (saved) setConfirmSectionKey("");
              })}
            >
              Save Draft
            </button>
          </div>
        </AdminDialog>
      ) : null}

      {previewConfig ? (
        <BodDraftPreviewDialog
          config={previewConfig}
          members={previewMembers}
          sectionKey={previewSectionKey}
          onClose={() => setPreviewSectionKey("")}
        />
      ) : null}

      {publishConfig && publishReview ? (
  <AdminDialog
    title={`Review & publish ${publishConfig.title}?`}
    busy={busy}
    onClose={() => setPublishSectionKey("")}
  >
    <p>
      This will replace only the current public snapshot for this section.
      Changes in the other BOD section will not be published.
    </p>

    <dl className="bod-management-meta">
      <div>
        <dt>Draft revision</dt>
        <dd>{board.sections[publishSectionKey]?.draftRevision}</dd>
      </div>
      <div>
        <dt>Current published revision</dt>
        <dd>{board.sections[publishSectionKey]?.publishedRevision}</dd>
      </div>
      <div>
        <dt>Profiles included</dt>
        <dd>{publishReview.includedCount}</dd>
      </div>
    </dl>

    {publishReview.incompleteProfiles.length ? (
      <>
        <p className="bod-management-help">
          Publication is blocked until these profiles are complete:
        </p>

        <ul className="bod-management-warning-list">
          {publishReview.incompleteProfiles.map((profile) => (
            <li key={profile.profileId}>
              <strong>{profile.name}:</strong>{" "}
              Missing {profile.missingFields.join(", ")}
            </li>
          ))}
        </ul>
      </>
    ) : (
      <p className="bod-management-help">
        All {publishReview.includedCount} included{" "}
        {publishReview.includedCount === 1 ? "profile is" : "profiles are"} ready.
      </p>
    )}

    <div className="admin-actions">
      <button
        type="button"
        disabled={busy}
        onClick={() => setPublishSectionKey("")}
      >
        Cancel
      </button>

      <button
        type="button"
        disabled={busy || !publishReview.canPublish}
        onClick={() => publishSection(publishSectionKey)}
      >
        {busy ? "Publishing..." : "Publish Section"}
      </button>
    </div>
  </AdminDialog>
) : null}
    </>
  );
}

function BodSectionStatusCard({
  board,
  busy,
  config,
  selected,
  publicationReview,
  onChange,
  onSave,
  onPreview,
  onPublish,
}) {
  const section = board.sections[config.key];
  const currentStatus = section.publicationStatus;
  const publicDisabled = currentStatus === "draft";
  const saveEnabled = isBodSectionSaveEnabled(board, { [config.key]: selected }, config.key);
  const publishReviewEnabled = board.initialized === true;
  const includedCount = publicationReview?.includedCount || 0;
  const incompleteCount = publicationReview?.incompleteCount || 0;
  const helpId = `${config.key}-public-help`;

  return (
    <article className="admin-record-card bod-management-card">
      <header>
        <div>
          <h3>{config.title}</h3>
          <span className={currentStatus === "public" ? "bod-management-badge is-public" : "bod-management-badge is-draft"}>
            {currentStatus === "public" ? config.publicLabel : config.draftLabel}
          </span>
        </div>
      </header>

      <dl className="bod-management-meta">
        <div><dt>Draft revision</dt><dd>{section.draftRevision}</dd></div>
        <div><dt>Published revision</dt><dd>{section.publishedRevision}</dd></div>
        <div><dt>Last published</dt><dd>{formatBodPublishedDate(section.publishedAt)}</dd></div>
      </dl>

      <fieldset className="bod-management-control">
        <legend>Public status</legend>
        <label>
          <input
            type="radio"
            name={`${config.key}-publication-status`}
            value="draft"
            checked={selected === "draft"}
            disabled={busy}
            onChange={() => onChange("draft")}
          />
          <span>{config.draftLabel}</span>
        </label>
        <label>
          <input
            type="radio"
            name={`${config.key}-publication-status`}
            value="public"
            checked={selected === "public"}
            disabled={busy || publicDisabled}
            aria-describedby={helpId}
            onChange={() => onChange("public")}
          />
          <span>{config.publicLabel}</span>
        </label>
      </fieldset>

      <p id={helpId} className="bod-management-help">
        {publicDisabled ? config.publicHelp : config.draftExplanation}
      </p>

      <p className="bod-management-help">
        {includedCount === 0
          ? "Include at least one active profile before publishing."
          : incompleteCount > 0
            ? `${incompleteCount} included ${incompleteCount === 1 ? "profile needs" : "profiles need"} required content or a ready photo.`
            : `${includedCount} included ${includedCount === 1 ? "profile is" : "profiles are"} ready for publication review.`}
      </p>

      <div className="admin-actions">
        <button type="button" disabled={busy || !saveEnabled} onClick={onSave}>
          {busy ? "Saving..." : `Save ${config.draftLabel}`}
        </button>

        <button
          type="button"
          disabled={busy || !publishReviewEnabled}
          onClick={onPreview}
        >
          Preview Draft
        </button>

        <button
          type="button"
          disabled={busy || !publishReviewEnabled}
          onClick={onPublish}
        >
          {currentStatus === "public"
            ? "Review & Publish Changes"
            : "Review & Publish"}
        </button>
      </div>
    </article>
  );
}

function BodDraftPreviewDialog({ config, members, sectionKey, onClose }) {
  const external = sectionKey === LEADERSHIP_PROFILE_SECTION_KEY;

  return (
    <AdminDialog
      title={`${config.title} draft preview`}
      className="admin-dialog--wide"
      onClose={onClose}
    >
      <div className="bod-management-draft-preview" aria-label="Draft preview, not public">
        <header className="bod-management-draft-preview__header">
          <div>
            <p className="admin-kicker">Draft preview</p>
            <h3>{config.title}</h3>
            <p>
              This is a static admin-only preview of the current working draft.
              It does not publish, save, or update public snapshots.
            </p>
          </div>
          <span className="bod-management-badge is-draft">Not public</span>
        </header>

        {members.length ? (
          <div className="bod-management-draft-preview__canvas">
            {external ? (
              <BodCouncil
                members={members}
                kicker="Draft preview"
                title={config.title}
                statusLabel="Not public"
              />
            ) : (
              <BodLeadership
                members={members}
                kicker="Draft preview"
                title={config.title}
                statusLabel="Not public"
              />
            )}
          </div>
        ) : (
          <div className="admin-state bod-management-draft-preview__empty" role="status">
            No active profiles are selected for public display in this draft section.
          </div>
        )}

        <p className="bod-management-help">
          Draft photos stay private. This preview uses protected photo placeholders
          until an authenticated draft-photo preview endpoint is available.
        </p>

        <div className="admin-actions">
          <button type="button" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </AdminDialog>
  );
}

function formatProfileUpdatedDate(value) {
  if (!value) return "Update date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function linkedBodMemberDisplay(profile, options) {
  if (!profile.linkedBodMemberId) return { text: "None", missing: false };
  const link = options.bodMemberLinks.find((item) => item.id === profile.linkedBodMemberId);
  if (!link) return { text: `Missing linked record (${profile.linkedBodMemberId})`, missing: true };
  return {
    text: `${link.name}${link.positionLabel ? ` - ${link.positionLabel}` : ""}`,
    missing: false,
  };
}

function linkedUserDisplay(profile, options) {
  if (!profile.linkedUserUid) return { text: "None", missing: false };
  const link = options.userLinks.find((item) => item.uid === profile.linkedUserUid);
  if (!link) return { text: `Missing linked account (${profile.linkedUserUid})`, missing: true };
  return {
    text: `${link.name}${link.role ? ` - ${link.role}` : ""}`,
    missing: false,
  };
}

function currentProfile(board, target) {
  if (!target) return null;
  return board.profiles?.[target.sectionKey]?.find((profile) => profile.id === target.id) || target;
}

function BodProfileWorkspace({
  board,
  busy,
  selectedSectionKey,
  onSelectSection,
  onAdd,
  onEdit,
  onPhoto,
  onRemovePhoto,
  onArchive,
  onRestore,
  onMove,
}) {
  const config = sectionConfig(selectedSectionKey) || sectionConfig(BOD_PROFILE_SECTION_KEY);
  const activeProfiles = activeProfilesForSection(board, config.key);
  const archivedProfiles = archivedProfilesForSection(board, config.key);
  const counts = getProfileCountsForSection(board, config.key);
  const panelId = `${config.key}-profile-workspace`;
  const isExternal = config.key === LEADERSHIP_PROFILE_SECTION_KEY;

  return (
    <section className="admin-panel bod-management-profiles" aria-labelledby={panelId}>
      <div className="bod-management-section-tabs" role="group" aria-label="BOD profile workspace">
        {BOD_MANAGEMENT_SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            aria-pressed={section.key === config.key}
            className={section.key === config.key ? "is-active" : ""}
            disabled={busy}
            onClick={() => onSelectSection(section.key)}
          >
            {section.title}
          </button>
        ))}
      </div>

      <header className="bod-management-section-heading">
        <div>
          <p className="admin-kicker">Working draft</p>
          <h3 id={panelId}>{config.workspaceTitle}</h3>
          <p>{config.workspaceHelp}</p>
        </div>
        <button type="button" disabled={busy || !board.initialized} onClick={onAdd}>
          {config.addLabel}
        </button>
      </header>

      <div className="admin-metric-grid bod-management-profile-metrics">
        <div className="admin-metric"><span>Active</span><strong>{counts.active}</strong></div>
        <div className="admin-metric"><span>Included</span><strong>{counts.included}</strong></div>
        <div className="admin-metric"><span>Needs attention</span><strong>{counts.needsAttention}</strong></div>
        <div className="admin-metric"><span>Archived</span><strong>{counts.archived}</strong></div>
      </div>

      {!board.initialized ? (
        <p className="bod-management-help">Save Draft in the section controls before adding profiles.</p>
      ) : activeProfiles.length ? (
        <div className="admin-card-grid bod-management-profile-grid">
          {activeProfiles.map((profile) => (
            <BodProfileCard
              key={profile.id}
              board={board}
              busy={busy}
              profile={profile}
              profiles={activeProfiles}
              onEdit={onEdit}
              onPhoto={onPhoto}
              onRemovePhoto={onRemovePhoto}
              onArchive={onArchive}
              onMove={onMove}
            />
          ))}
        </div>
      ) : (
        <AdminEmpty message={isExternal ? "No active external leadership profiles yet." : "No active Club BOD profiles yet."} />
      )}

      {archivedProfiles.length ? (
        <details className="bod-management-archive">
          <summary>Archived profiles ({archivedProfiles.length})</summary>
          <div className="bod-management-archived-list">
            {archivedProfiles.map((profile) => (
              <article key={profile.id} className="bod-management-archived-row">
                <div>
                  <strong>{profile.name || "Unnamed profile"}</strong>
                  <span>{profile.positionLabel || (isExternal ? "No external role" : "No position")}</span>
                  <span>{formatProfileUpdatedDate(profile.updatedAt)}</span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Restore ${profile.name || "unnamed profile"}`}
                  onClick={() => onRestore(profile)}
                >
                  Restore
                </button>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function getBodPhotoStatusText(photo, readyPhoto) {
  if (readyPhoto) return `v${photo.version}`;
  if (photo?.status === "removed") return "Photo removed";
  return "Photo missing";
}

function BodProfileCard({ board, busy, profile, profiles, onEdit, onPhoto, onRemovePhoto, onArchive, onMove }) {
  const indicators = profileDraftIndicators(profile);
  const warnings = getBodProfileWarnings(profile, profiles);
  const moveUp = canMoveProfile(board, profile.sectionKey, profile.id, "up");
  const moveDown = canMoveProfile(board, profile.sectionKey, profile.id, "down");
  const profileName = profile.name || "unnamed profile";
  const bodMemberLink = linkedBodMemberDisplay(profile, board.options);
  const userLink = linkedUserDisplay(profile, board.options);
  const isExternal = profile.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY;
  const photoBadge = getBodPhotoBadge(profile);
  const readyPhoto = hasReadyPhoto(profile);
  const photoStatusText = getBodPhotoStatusText(profile.photo, readyPhoto);

  return (
    <article className="admin-record-card bod-management-profile-card">
      <header>
        <div className={`bod-management-photo-placeholder ${readyPhoto ? "is-ready" : ""}`} aria-label={photoBadge.label}>
          <span>{readyPhoto ? "Ready" : "Photo"}</span>
          <small>{photoStatusText}</small>
        </div>
        <div>
          <h4>{profile.name || "Unnamed profile"}</h4>
          <p>{profile.positionLabel || (isExternal ? "External role not added" : "No position selected")}</p>
          {isExternal ? <small>{profile.organizationName || "Organization not added"}</small> : null}
        </div>
      </header>

      <div className="bod-management-profile-badges">
        {isExternal ? (
          <span className={profile.leadershipLevel ? "bod-management-badge is-public" : "bod-management-badge is-draft"}>
            {profile.leadershipLevelLabel || "Level not added"}
          </span>
        ) : null}
        <span className="bod-management-badge is-public">Active</span>
        <span className={profile.displayPublicly ? "bod-management-badge is-public" : "bod-management-badge is-draft"}>
          {profile.displayPublicly ? "Included in next publish" : "Not included"}
        </span>
        <span className={indicators.hasTextBasics ? "bod-management-badge is-public" : "bod-management-badge is-draft"}>
          {indicators.label}
        </span>
        <span className={`bod-management-badge ${photoBadge.className}`}>{photoBadge.label}</span>
      </div>

      {profile.summary ? <p className="bod-management-summary-preview">{profile.summary}</p> : <p className="bod-management-summary-preview">No summary yet.</p>}

      <dl className="bod-management-profile-meta">
        {isExternal ? (
          <>
            <div><dt>Level</dt><dd>{profile.leadershipLevelLabel || "Level not added"}</dd></div>
            <div><dt>Organization</dt><dd>{profile.organizationName || "Organization not added"}</dd></div>
            <div><dt>Term</dt><dd>{profile.termLabel || "Not added"}</dd></div>
          </>
        ) : null}
        <div><dt>Avenues</dt><dd>{profile.avenueLabels.length ? profile.avenueLabels.join(", ") : "None"}</dd></div>
        <div><dt>Instagram</dt><dd>{profile.instagramUsername ? `@${profile.instagramUsername}` : "None"}</dd></div>
        <div><dt>Photo file</dt><dd>{profile.photo?.originalName || "None"}</dd></div>
        <div><dt>Photo size</dt><dd>{profile.photo ? formatBodPhotoSize(profile.photo.sizeBytes) : "None"}</dd></div>
        <div><dt>Photo version</dt><dd>{profile.photo?.version ? `v${profile.photo.version}` : "None"}</dd></div>
        <div><dt>BOD roster link</dt><dd className={bodMemberLink.missing ? "bod-management-missing-link" : ""}>{bodMemberLink.text}</dd></div>
        <div><dt>Portal account link</dt><dd className={userLink.missing ? "bod-management-missing-link" : ""}>{userLink.text}</dd></div>
      </dl>

      {warnings.length ? (
        <ul className="bod-management-warning-list">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}

      <div className="admin-actions">
        <button type="button" disabled={busy} aria-label={`Edit ${profileName}`} onClick={() => onEdit(profile)}>Edit</button>
        <button type="button" disabled={busy} aria-label={`${readyPhoto ? "Replace" : "Add"} photo for ${profileName}`} onClick={() => onPhoto(profile)}>
          {readyPhoto ? "Replace Photo" : "Add Photo"}
        </button>
        {readyPhoto ? (
          <button type="button" className="danger" disabled={busy} aria-label={`Remove photo for ${profileName}`} onClick={() => onRemovePhoto(profile)}>
            Remove Photo
          </button>
        ) : null}
        <button type="button" disabled={busy || !moveUp} aria-label={`Move ${profileName} up`} onClick={() => onMove(profile, "up")}>Move Up</button>
        <button type="button" disabled={busy || !moveDown} aria-label={`Move ${profileName} down`} onClick={() => onMove(profile, "down")}>Move Down</button>
        <button type="button" className="danger" disabled={busy} aria-label={`Archive ${profileName}`} onClick={() => onArchive(profile)}>Archive</button>
      </div>
    </article>
  );
}

function BodProfileEditorDialog({ board, busy, form, onChange, onClose, onSave, onPhoto, onRemovePhoto }) {
  const options = board.options;
  const validation = validateBodProfileForm(form, options);
  const normalized = normalizeBodProfileForm(form, options);
  const savedProfile = form.profileId
    ? board.profiles?.[form.sectionKey]?.find((profile) => profile.id === form.profileId)
    : null;
  const indicators = profileDraftIndicators({ ...normalized, id: form.profileId || "draft", status: "active", photo: savedProfile?.photo || null });
  const photoBadge = getBodPhotoBadge(savedProfile);
  const readyPhoto = hasReadyPhoto(savedProfile);
  const photoStatusText = getBodPhotoStatusText(savedProfile?.photo, readyPhoto);
  const isExternal = form.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY;
  const isCustomPosition = !isExternal && form.positionKey === "custom";
  const instagramHelpId = "bod-profile-instagram-help";
  const includeHelpId = "bod-profile-include-help";
  const leadershipLevelHelpId = "bod-profile-leadership-level-help";
  const organizationHelpId = "bod-profile-organization-help";
  const termHelpId = "bod-profile-term-help";

  function update(field, value) {
    onChange({ ...form, [field]: value });
  }

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <AdminDialog
      title={isExternal
        ? (form.profileId ? "Edit Leadership Profile" : "Create Leadership Profile")
        : (form.profileId ? "Edit Club BOD profile" : "Add Club BOD profile")}
      busy={busy}
      className="admin-dialog--wide"
      onClose={onClose}
    >
      <form className="admin-form bod-management-profile-form" onSubmit={submit}>
        <div className="bod-management-form-photo">
          <div className={`bod-management-photo-placeholder ${readyPhoto ? "is-ready" : ""}`} aria-label={photoBadge.label}>
            <span>{readyPhoto ? "Ready" : "Photo"}</span>
            <small>{photoStatusText}</small>
          </div>
          {form.profileId && savedProfile ? (
            <>
              <p>{savedProfile.photo?.originalName ? `${savedProfile.photo.originalName} - ${formatBodPhotoSize(savedProfile.photo.sizeBytes)}` : photoBadge.label}</p>
              <div className="admin-actions">
                <button type="button" disabled={busy} onClick={() => onPhoto(savedProfile)}>
                  {readyPhoto ? "Replace Photo" : "Add Photo"}
                </button>
                {readyPhoto ? <button type="button" className="danger" disabled={busy} onClick={() => onRemovePhoto(savedProfile)}>Remove Photo</button> : null}
              </div>
            </>
          ) : (
            <p>Save this profile before adding a photo.</p>
          )}
        </div>

        <div className="admin-form-grid">
          <label>
            <span className="bod-management-field-heading">
              <span>Name</span>
              <CharacterCount value={form.name} max={120} />
            </span>
            <input value={form.name} maxLength="120" onChange={(event) => update("name", event.target.value)} />
          </label>
          {isExternal ? (
            <>
              <label>
                <span className="bod-management-field-heading">
                  <span>External role title</span>
                  <CharacterCount value={form.positionLabel} max={140} />
                </span>
                <input value={form.positionLabel} maxLength="140" onChange={(event) => update("positionLabel", event.target.value)} />
              </label>
              <label>
                Leadership level
                <select
                  value={form.leadershipLevel || ""}
                  aria-describedby={leadershipLevelHelpId}
                  onChange={(event) => update("leadershipLevel", event.target.value)}
                >
                  <option value="">Choose level</option>
                  {options.leadershipLevels.map((level) => (
                    <option key={level.key} value={level.key}>{level.label}</option>
                  ))}
                </select>
                <span id={leadershipLevelHelpId} className="bod-management-field-help">
                  Choose where this appointment sits outside the club.
                </span>
              </label>
              <label>
                <span className="bod-management-field-heading">
                  <span>Organization name</span>
                  <CharacterCount value={form.organizationName} max={140} />
                </span>
                <input
                  value={form.organizationName}
                  maxLength="140"
                  aria-describedby={organizationHelpId}
                  onChange={(event) => update("organizationName", event.target.value)}
                />
                <span id={organizationHelpId} className="bod-management-field-help">
                  Examples: Rotaract District 3131, Rotary District 3131, or the relevant national or international body.
                </span>
              </label>
              <label>
                <span className="bod-management-field-heading">
                  <span>Term label</span>
                  <CharacterCount value={form.termLabel} max={60} />
                </span>
                <input
                  value={form.termLabel}
                  maxLength="60"
                  aria-describedby={termHelpId}
                  onChange={(event) => update("termLabel", event.target.value)}
                />
                <span id={termHelpId} className="bod-management-field-help">
                  Optional. Confirm that the term belongs to the current appointment before saving.
                </span>
              </label>
            </>
          ) : (
            <>
              <label>
                Position
                <select
                  value={form.positionKey || ""}
                  onChange={(event) => update("positionKey", event.target.value)}
                >
                  <option value="">Choose position</option>
                  {options.positionPresets.map((preset) => (
                    <option key={preset.key} value={preset.key}>{preset.label}</option>
                  ))}
                </select>
              </label>
              {isCustomPosition ? (
                <label>
                  <span className="bod-management-field-heading">
                    <span>Custom position</span>
                    <CharacterCount value={form.positionLabel} max={140} />
                  </span>
                  <input value={form.positionLabel} maxLength="140" onChange={(event) => update("positionLabel", event.target.value)} />
                </label>
              ) : null}
            </>
          )}
          <label>
            Instagram
            <input
              value={form.instagramUsername}
              maxLength="120"
              placeholder="@username"
              aria-describedby={instagramHelpId}
              onChange={(event) => update("instagramUsername", event.target.value)}
            />
            <span id={instagramHelpId} className="bod-management-field-help">
              Use username, @username, or a standard Instagram profile URL.
            </span>
          </label>
        </div>

        <label>
          <span className="bod-management-field-heading">
            <span>Summary</span>
            <CharacterCount value={form.summary} max={240} />
          </span>
          <textarea rows="2" value={form.summary} maxLength="240" onChange={(event) => update("summary", event.target.value)} />
        </label>

        <label>
          <span className="bod-management-field-heading">
            <span>Biography</span>
            <CharacterCount value={form.bio} max={900} />
          </span>
          <textarea rows="5" value={form.bio} maxLength="900" onChange={(event) => update("bio", event.target.value)} />
        </label>

        <div className="admin-form-grid">
          <label>
            Avenue labels
            <input value={form.avenueText} maxLength="320" placeholder="CSD, ISD" onChange={(event) => update("avenueText", event.target.value)} />
          </label>
          <label>
            BOD roster link
            <select value={form.linkedBodMemberId || ""} onChange={(event) => update("linkedBodMemberId", event.target.value)}>
              <option value="">No linked roster record</option>
              {options.bodMemberLinks.map((item) => (
                <option key={item.id} value={item.id}>{item.name}{item.positionLabel ? ` - ${item.positionLabel}` : ""}</option>
              ))}
            </select>
          </label>
          <label>
            Portal account link
            <select value={form.linkedUserUid || ""} onChange={(event) => update("linkedUserUid", event.target.value)}>
              <option value="">No linked portal account</option>
              {options.userLinks.map((item) => (
                <option key={item.uid} value={item.uid}>{item.name}{item.role ? ` - ${item.role}` : ""}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="bod-management-checkbox-group">
          <label className="bod-management-checkbox">
            <input
              type="checkbox"
              checked={form.displayPublicly === true}
              aria-describedby={includeHelpId}
              onChange={(event) => update("displayPublicly", event.target.checked)}
            />
            <span>Include in next publish</span>
          </label>
          <p id={includeHelpId}>This does not change the current public page.</p>
        </div>

        <div className="bod-management-form-status">
          <span className={indicators.hasTextBasics ? "bod-management-badge is-public" : "bod-management-badge is-draft"}>
            {indicators.label}
          </span>
          {indicators.missingFields.length ? <span>Missing: {indicators.missingFields.join(", ")}</span> : null}
          {normalized.avenueLabels.length ? <span>{normalized.avenueLabels.length} avenue label{normalized.avenueLabels.length === 1 ? "" : "s"}</span> : null}
        </div>

        {!validation.ok ? (
          <ul className="bod-management-warning-list" role="alert">
            {validation.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        ) : null}

        <div className="admin-actions">
          <button type="submit" disabled={busy || !validation.ok}>{busy ? "Saving..." : "Save Profile"}</button>
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </AdminDialog>
  );
}

function BodProfilePhotoDialog({ board, profile, onNotice, onClose, onApplied, onConflict }) {
  const [state, setState] = useState({
    file: null,
    previewUrl: "",
    warnings: [],
    error: "",
    step: "Preparing",
    progress: 0,
    uploadedSessionId: "",
    working: false,
  });
const abortRef = useRef(null);
const uploadInFlightRef = useRef(false);
const mountedRef = useRef(false);
const operationGenerationRef = useRef(0);
const imageLoadGenerationRef = useRef(0);
  const readyPhoto = hasReadyPhoto(profile);
  const actionLabel = readyPhoto ? "Replace Photo" : "Add Photo";

useEffect(() => {
  mountedRef.current = true;

  return () => {
    mountedRef.current = false;
    operationGenerationRef.current += 1;
    imageLoadGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  };
}, []);

useEffect(() => () => {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }
}, [state.previewUrl]);

function isCurrentOperation(generation) {
  return (
    mountedRef.current
    && operationGenerationRef.current === generation
  );
}

function setPreview(file) {
  const imageLoadGeneration = ++imageLoadGenerationRef.current;
  const error = validateBodPhotoFile(file);

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }

  if (error) {
    setState((current) => ({
      ...current,
      file: null,
      previewUrl: "",
      warnings: [],
      error,
      progress: 0,
      uploadedSessionId: "",
      step: "Preparing",
    }));
    return;
  }

  const previewUrl = URL.createObjectURL(file);

  setState((current) => ({
    ...current,
    file,
    previewUrl,
    warnings: [],
    error: "",
    progress: 0,
    uploadedSessionId: "",
    step: "Preparing",
  }));

  const image = new Image();

  image.onload = () => {
    if (
      !mountedRef.current
      || imageLoadGenerationRef.current !== imageLoadGeneration
    ) {
      return;
    }

    setState((current) => (
      current.previewUrl === previewUrl
        ? {
            ...current,
            warnings: getBodPhotoDimensionWarnings({
              width: image.naturalWidth,
              height: image.naturalHeight,
            }),
          }
        : current
    ));
  };

  image.src = previewUrl;
}

function abortUpload() {
  operationGenerationRef.current += 1;
  abortRef.current?.abort();
  abortRef.current = null;

  if (!mountedRef.current) return;

  setState((current) => ({
    ...current,
    working: false,
    step: "Preparing",
    error: "Photo upload was aborted.",
    progress: 0,
  }));
}
async function finalizeUploaded(sessionId, existingGeneration = null) {
  const generation = existingGeneration
    ?? ++operationGenerationRef.current;

  if (!isCurrentOperation(generation)) return;

  setState((current) => ({
    ...current,
    working: true,
    step: "Finalizing",
    error: "",
  }));

  try {
    const result = await adminCalls.finalizeBodPhotoUpload(
      buildFinalizeBodPhotoUploadPayload(board, profile, sessionId)
    );

    if (!isCurrentOperation(generation)) return;

    setState((current) => ({
      ...current,
      working: false,
      step: "Complete",
      progress: 100,
      error: "",
    }));

    onApplied(result);

    if (!isCurrentOperation(generation)) return;

    onNotice?.({
      type: "success",
      message: readyPhoto
        ? "BOD profile photo replaced."
        : "BOD profile photo added.",
    });
  } catch (error) {
    if (!isCurrentOperation(generation)) return;

    if (isRevisionConflict(error)) {
      setState((current) => ({
        ...current,
        working: false,
        step: "Finalizing",
        uploadedSessionId: sessionId,
        error: "Profile data changed elsewhere. Review the refreshed board, then retry finalization.",
      }));
      onConflict?.();
      return;
    }

    setState((current) => ({
      ...current,
      working: false,
      step: "Finalizing",
      uploadedSessionId: sessionId,
      error: error?.message || "Photo finalization failed.",
    }));
  }
}

async function startUpload() {
  if (
    !state.file
    || state.working
    || uploadInFlightRef.current
  ) {
    return;
  }

  const file = state.file;
  let payload;

  try {
    payload = buildCreateBodPhotoUploadSessionPayload(
      board,
      profile,
      file
    );
  } catch (error) {
    setState((current) => ({
      ...current,
      error: error.message || "Check the selected photo.",
    }));
    return;
  }

  uploadInFlightRef.current = true;
  const generation = ++operationGenerationRef.current;
  const controller = new AbortController();
  abortRef.current = controller;

  setState((current) => ({
    ...current,
    working: true,
    step: "Creating secure session",
    progress: 0,
    error: "",
    uploadedSessionId: "",
  }));

  try {
    const session = await adminCalls.createBodPhotoUploadSession(payload);

    if (
      !isCurrentOperation(generation)
      || controller.signal.aborted
    ) {
      return;
    }

    setState((current) => ({
      ...current,
      step: "Uploading to private Drive",
      progress: 0,
    }));

    const uploaded = await uploadBodProfilePhoto(
      file,
      session,
      payload,
      {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!isCurrentOperation(generation)) return;

          setState((current) => ({
            ...current,
            progress,
          }));
        },
      }
    );

    if (!isCurrentOperation(generation)) return;

    if (abortRef.current === controller) {
      abortRef.current = null;
    }

    const sessionId = uploaded.sessionId || session.sessionId;

    setState((current) => ({
      ...current,
      uploadedSessionId: sessionId,
      step: "Finalizing",
    }));

    await finalizeUploaded(sessionId, generation);
  } catch (error) {
    if (abortRef.current === controller) {
      abortRef.current = null;
    }

    if (!isCurrentOperation(generation)) return;

    setState((current) => ({
      ...current,
      working: false,
      error: error?.message || "Photo upload failed.",
      step: "Preparing",
    }));
  } finally {
    uploadInFlightRef.current = false;
  }
}

  const selected = state.file;
  const working = state.working;

  return (
    <AdminDialog
      title={`${actionLabel} - ${profile?.name || "BOD profile"}`}
      busy={working}
      className="admin-dialog--wide"
      onClose={working ? abortUpload : onClose}
    >
      <div className="bod-photo-dialog">
        <div className="bod-photo-preview" aria-label="Selected photo preview">
          {state.previewUrl ? <img src={state.previewUrl} alt="" /> : <span>4:5</span>}
        </div>
        <div className="bod-photo-panel">
          <p><strong>{profile?.positionLabel || "Profile role"}</strong></p>
          <label htmlFor="bod-photo-file">Choose photo</label>
          <input
            id="bod-photo-file"
            type="file"
            accept={BOD_PHOTO_FILE_ACCEPT}
            disabled={working}
            onChange={(event) => {
              setPreview(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
          <p className="bod-management-help">JPEG, PNG, or WebP. Maximum {formatBodPhotoSize(5 * 1024 * 1024)}. Recommended 4:5 portrait around 800 x 1000 pixels.</p>
          {selected ? <p className="bod-photo-file-name">{selected.name} - {formatBodPhotoSize(selected.size)}</p> : null}
          {state.warnings.length ? (
            <ul className="bod-management-warning-list">
              {state.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}
          <div className="bod-photo-progress" aria-live="polite">
            <span>{state.step}</span>
            <progress max="100" value={state.progress}>{state.progress}%</progress>
            <small>{state.progress}%</small>
          </div>
          {state.error ? <p role="alert" className="bod-management-upload-error">{state.error}</p> : null}
          <div className="admin-actions">
            {working ? <button type="button" className="danger" onClick={abortUpload}>Abort</button> : null}
            {!working ? <button type="button" disabled={!selected} onClick={startUpload}>{state.error ? "Retry upload" : actionLabel}</button> : null}
            {!working && state.uploadedSessionId ? <button type="button" onClick={() => finalizeUploaded(state.uploadedSessionId)}>Retry finalization</button> : null}
            <button type="button" disabled={working} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}

function CharacterCount({ value, max }) {
  return <span className="bod-management-character-count">{String(value || "").length}/{max}</span>;
}

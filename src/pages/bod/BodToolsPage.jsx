import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BodEventArchiveDialog from "../../features/bod-tools/BodEventArchiveDialog";
import BodAvenueReportPanel from "../../features/bod-tools/BodAvenueReportPanel";
import BodEventDetailsDialog from "../../features/bod-tools/BodEventDetailsDialog";
import BodEventFilters from "../../features/bod-tools/BodEventFilters";
import BodEventForm from "../../features/bod-tools/BodEventForm";
import BodEventList from "../../features/bod-tools/BodEventList";
import BodEventMutationNotice from "../../features/bod-tools/BodEventMutationNotice";
import BodReportingQueuePanel from "../../features/bod-tools/BodReportingQueuePanel";
import { getBodEventDiagnostic, getSafeBodEventError } from "../../features/bod-tools/bodEventErrors";
import { filterBodEvents } from "../../features/bod-tools/bodEventModel";
import {
  archiveBodEvent,
  clearBodEventCache,
  fetchBodReportingQueue,
  fetchReportingWindowPrefill,
  submitBodEvent,
  syncBodEventToAttendance,
  updateBodEvent,
} from "../../features/bod-tools/bodEventService";
import BodToolsErrorState from "../../features/bod-tools/BodToolsErrorState";
import BodToolsHeader from "../../features/bod-tools/BodToolsHeader";
import BodToolsShell from "../../features/bod-tools/BodToolsShell";
import BodToolsSkeleton from "../../features/bod-tools/BodToolsSkeleton";
import BodLetterheadExchangePanel from "../../features/bod-tools/letterhead-exchanges/BodLetterheadExchangePanel";
import useBodEvents from "../../features/bod-tools/useBodEvents";
import { clearDashboardDataCache } from "../../features/dashboard/dashboardService";
import useAuth from "../../hooks/useAuth";
import { formatRotaractorName } from "../../utils/memberName";
import "../../styles/components/bod-tools.css";

const DEFAULT_FILTERS = { status: "active", type: "", avenue: "", month: "", mine: false, search: "" };

function queueEventIds(item = {}) {
  return new Set([item.linkedBodEventId, item.linkedEventId, item.linkedTargetId].filter(Boolean));
}

function findLinkedQueueEvent(item, candidates = []) {
  const ids = queueEventIds(item);
  if (!ids.size) return null;
  return candidates.find((event) => ids.has(event.id) || ids.has(event.syncedEventId) || ids.has(event.bodMeetingId) || ids.has(event.syncedMeetingId)) || null;
}

export default function BodToolsPage() {
  const { access, user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const uid = user?.uid || "";
  const reportingWindowId = (searchParams.get("reportingWindowId") || "").trim();
  const { status, events, lock, avenueReportingLocks, reload } = useBodEvents({ uid, enabled: Boolean(uid && access?.canAccessBodTools) });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submissionsExpanded, setSubmissionsExpanded] = useState(false);
  const [reportingQueue, setReportingQueue] = useState({ status: "idle", items: [], error: "" });
  const [queueOpeningId, setQueueOpeningId] = useState("");
  const mutationLockRef = useRef(false);
  const sessionUidRef = useRef(uid);
  const prefillAppliedRef = useRef("");
  const reportingQueueVersionRef = useRef(0);
  useEffect(() => { sessionUidRef.current = uid; }, [uid]);

  const refreshReportingQueue = useCallback(async () => {
    if (!uid || access?.canAccessBodTools !== true) {
      setReportingQueue({ status: "idle", items: [], error: "" });
      return [];
    }
    const requestUid = uid;
    const version = ++reportingQueueVersionRef.current;
    setReportingQueue((current) => ({
      status: "loading",
      items: current.items,
      error: "",
    }));
    try {
      const items = await fetchBodReportingQueue();
      if (sessionUidRef.current !== requestUid || version !== reportingQueueVersionRef.current) return items;
      setReportingQueue({ status: "success", items, error: "" });
      return items;
    } catch (error) {
      if (sessionUidRef.current === requestUid && version === reportingQueueVersionRef.current) {
        setReportingQueue((current) => ({
          status: "error",
          items: current.items,
          error: getSafeBodEventError(error),
        }));
      }
      return [];
    }
  }, [access?.canAccessBodTools, uid]);

  useEffect(() => {
    if (!uid || access?.canAccessBodTools !== true) {
      reportingQueueVersionRef.current += 1;
      setReportingQueue({ status: "idle", items: [], error: "" });
      return;
    }
    refreshReportingQueue();
  }, [access?.canAccessBodTools, refreshReportingQueue, uid]);

  useEffect(() => {
    if (!reportingWindowId) {
      prefillAppliedRef.current = "";
      return undefined;
    }
    if (!uid || access?.canAccessBodTools !== true || status !== "success") return undefined;
    if (prefillAppliedRef.current === reportingWindowId) return undefined;

    let active = true;
    prefillAppliedRef.current = reportingWindowId;
    setMutationError("");
    fetchReportingWindowPrefill(reportingWindowId)
      .then((prefill) => {
        if (!active) return;
        setForm({ event: null, prefill });
        setSubmissionsExpanded(false);
      })
      .catch(() => {
        if (!active) return;
        setNotice({
          type: "error",
          message: "Reporting window prefill could not be opened. Check that the window is still open and your account has BOD Tools access.",
        });
        refreshReportingQueue();
      });

    return () => {
      active = false;
    };
  }, [access?.canAccessBodTools, refreshReportingQueue, reportingWindowId, status, uid]);

  const lockState = lock.status === "success" ? (lock.locked ? "locked" : "unlocked") : "unknown";
  const canMutate = lockState === "unlocked" || (lockState === "locked" && access.canAccessPresidentControls);
  const visibleEvents = useMemo(() => filterBodEvents(events, filters, uid), [events, filters, uid]);
  const avenues = useMemo(() => [...new Set(events.flatMap((event) => event.avenues))].sort(), [events]);
  const months = useMemo(() => [...new Set(events.map((event) => event.startDate.slice(0, 7)))].sort().reverse(), [events]);
  const displayName = formatRotaractorName(access?.user?.name || user?.displayName || "RCPH member", access?.user || access?.storedRole);

  async function runMutation(operation, request, successMessage, close) {
    if (mutationLockRef.current || !canMutate) return;
    mutationLockRef.current = true;
    setBusy(true);
    setMutationError("");
    const requestUid = uid;
    try {
      const result = await request();
      if (sessionUidRef.current !== requestUid) return;
      if (result.ok !== true) throw new Error("Invalid mutation response.");
      close();
      const rows = result.attendanceRowsUpdated;
      setNotice({ type: "success", message: `${successMessage}${rows === null ? "" : ` Attendance initialized for ${rows} member rows.`}` });
      reload();
      refreshReportingQueue();
    } catch (error) {
      if (sessionUidRef.current !== requestUid) return;
      if (import.meta.env.DEV) console.error("BOD event operation failed.", getBodEventDiagnostic(error, operation, requestUid));
      setMutationError(getSafeBodEventError(error));
    } finally {
      if (sessionUidRef.current === requestUid) setBusy(false);
      mutationLockRef.current = false;
    }
  }

  async function submitForm(payload) {
    if (mutationLockRef.current || !canMutate) throw new Error("Event changes are currently unavailable.");
    mutationLockRef.current = true;
    setBusy(true);
    setMutationError("");
    const editing = Boolean(payload.eventId);
    try {
      const result = await (editing ? updateBodEvent(payload) : submitBodEvent(payload));
      if (result.ok !== true) throw new Error("Invalid mutation response.");
      return result;
    } catch (error) {
      if (import.meta.env.DEV) console.error("BOD event operation failed.", getBodEventDiagnostic(error, editing ? "update" : "create", uid));
      setMutationError(getSafeBodEventError(error));
      refreshReportingQueue();
      throw error;
    } finally {
      setBusy(false);
      mutationLockRef.current = false;
    }
  }

  function completeForm(result) {
    setForm(null);
    setMutationError("");
    const rows = result?.attendanceRowsUpdated;
    const recordLabel = result?.meetingId || result?.bodMeetingId ? "Meeting" : "Event";
    setNotice({ type: "success", message: `${recordLabel} saved and synchronized.${rows === null ? "" : ` Attendance initialized for ${rows} member rows.`}` });
    reload();
    refreshReportingQueue();
  }

  async function openEditForm(event) {
    setMutationError("");
    if (!event?.reportingWindowId) {
      setForm({ event });
      return;
    }
    setBusy(true);
    try {
      const prefill = await fetchReportingWindowPrefill(event.reportingWindowId);
      setForm({ event, prefill });
    } catch {
      setNotice({
        type: "error",
        message: "Reporting window metadata could not be verified for this event. Try again before editing the linked report.",
      });
      refreshReportingQueue();
    } finally {
      setBusy(false);
    }
  }

  async function openReportingQueueAdd(item) {
    if (queueOpeningId || item?.locked) return;
    const reportingId = item?.reportingWindowId || "";
    if (!reportingId) return;
    setQueueOpeningId(reportingId);
    setMutationError("");
    try {
      const prefill = await fetchReportingWindowPrefill(reportingId);
      setForm({ event: null, prefill });
      setSubmissionsExpanded(false);
    } catch (error) {
      setNotice({ type: "error", message: getSafeBodEventError(error) });
      refreshReportingQueue();
    } finally {
      setQueueOpeningId("");
    }
  }

  async function openReportingQueueContinue(item) {
    if (queueOpeningId || item?.locked) return;
    const reportingId = item?.reportingWindowId || item?.linkedBodEventId || "";
    setQueueOpeningId(reportingId);
    setMutationError("");
    try {
      let linkedEvent = findLinkedQueueEvent(item, events);
      if (!linkedEvent) {
        const refreshedEvents = await reload();
        linkedEvent = findLinkedQueueEvent(item, refreshedEvents);
      }
      if (!linkedEvent?.reportingWindowId) {
        setNotice({
          type: "error",
          message: "The linked BOD event could not be loaded. Refresh and try again.",
        });
        return;
      }
      await openEditForm(linkedEvent);
    } catch (error) {
      if (import.meta.env.DEV) console.error("BOD reporting queue continue failed.", getBodEventDiagnostic(error, "reporting-continue", uid));
      setNotice({
        type: "error",
        message: "The linked BOD event could not be loaded. Refresh and try again.",
      });
      refreshReportingQueue();
    } finally {
      setQueueOpeningId("");
    }
  }

  function confirmMutation() {
    if (!confirmation) return;
    const { event, mode } = confirmation;
    if (mode === "archive") {
      const recordLabel = event.recordKind === "bodMeeting" ? "Meeting" : "Event";
      runMutation("archive", () => archiveBodEvent(event.id), `${recordLabel} archived; attendance history was preserved.`, () => setConfirmation(null));
    } else {
      runMutation("sync", () => syncBodEventToAttendance(event.id), "Synchronization complete.", () => setConfirmation(null));
    }
  }

  async function handleSignOut() {
    clearBodEventCache(uid);
    clearDashboardDataCache(uid);
    await signOut();
  }

  return (
    <main className="bod-tools-page">
      <BodToolsShell>
<BodToolsHeader
  access={access}
  displayName={displayName}
  onSignOut={handleSignOut}
  canCreateEvent={canMutate}
  lock={lock}
  canBypassLock={access.canAccessPresidentControls}
  onCreateEvent={() => {
    setMutationError("");
    setForm({ event: null, prefill: null });
  }}
/>
        <BodEventMutationNotice notice={notice} onDismiss={() => setNotice(null)} />
<section
  className="bod-tools-metrics"
  aria-label="BOD event overview"
>
  <article className="bod-tools-metric">
    <span>Active events</span>
    <strong>
      {events.filter((event) => event.isActive).length}
    </strong>
    <small>Current event records</small>
  </article>

  <article className="bod-tools-metric">
    <span>Visible results</span>
    <strong>{visibleEvents.length}</strong>
    <small>Based on active filters</small>
  </article>

  <article className="bod-tools-metric">
    <span>Avenues represented</span>
    <strong>{avenues.length}</strong>
    <small>Across loaded events</small>
  </article>

  <article
    className={`bod-tools-metric bod-tools-metric--${
      lockState === "unlocked" ? "open" : "locked"
    }`}
  >
    <span>Submissions</span>
    <strong>
      {lock.status === "loading"
        ? "Checking"
        : lock.status === "error"
          ? "Unavailable"
          : lock.locked
            ? "Locked"
            : "Open"}
    </strong>
    <small>
      {canMutate
        ? "Event actions available"
        : "Changes currently disabled"}
    </small>
  </article>
</section>
        {status === "loading" ? <BodToolsSkeleton /> : null}
        {status === "error" ? <BodToolsErrorState onRetry={reload} onSignOut={handleSignOut} /> : null}
{status === "success" ? (
  <>
    <BodReportingQueuePanel
      status={reportingQueue.status}
      items={reportingQueue.items}
      error={reportingQueue.error}
      openingId={queueOpeningId}
      onRetry={refreshReportingQueue}
      onAddEvent={openReportingQueueAdd}
      onContinueEvent={openReportingQueueContinue}
    />

    <section className="bod-submissions" aria-labelledby="bod-submissions-title">
      <header className="bod-submissions__header">
        <div>
          <p className="bod-tools-kicker">Created events</p>
          <h2 id="bod-submissions-title">Submissions</h2>
        </div>
        <div className="bod-submissions__summary">
          <span aria-live="polite">{visibleEvents.length} results</span>
          <button
            type="button"
            className="bod-submissions__toggle"
            aria-expanded={submissionsExpanded}
            aria-controls="bod-submissions-panel"
            onClick={() => setSubmissionsExpanded((current) => !current)}
          >
            {submissionsExpanded ? "Hide submissions" : "Show submissions"}
          </button>
        </div>
      </header>

      <div
        id="bod-submissions-panel"
        className={`bod-submissions__panel ${submissionsExpanded ? "is-open" : ""}`}
      >
        <BodEventFilters
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          avenues={avenues}
          months={months}
          resultCount={visibleEvents.length}
        />

        <BodEventList
          events={visibleEvents}
          access={access}
          lockState={lockState}
          onDetails={setDetails}
          onEdit={openEditForm}
          onArchive={(event) => {
            setMutationError("");
            setConfirmation({ event, mode: "archive" });
          }}
          onSync={(event) => {
            setMutationError("");
            setConfirmation({ event, mode: "sync" });
          }}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
      </div>
    </section>

    <BodAvenueReportPanel
      events={events}
      onNotice={setNotice}
    />

    <BodLetterheadExchangePanel />
  </>
) : null}      </BodToolsShell>
      <BodEventDetailsDialog
        event={details}
        access={access}
        uid={uid}
        onNotice={setNotice}
        onUploaded={(mom) => {
          setDetails((current) => current ? { ...current, mom } : current);
          reload();
          refreshReportingQueue();
        }}
        onReportImageChanged={(result) => {
          if (!result?.eventId) return;
          reload();
        }}
        onClose={() => setDetails(null)}
      />
      {form ? <BodEventForm key={form.event?.id || form.prefill?.reportingWindowId || "create"} event={form.event || null} prefill={form.prefill || null} displayName={displayName} busy={busy} mutationError={mutationError} lockedAvenueReportingLocks={avenueReportingLocks.items} onClose={() => { if (!busy) { setForm(null); setMutationError(""); } }} onSubmit={submitForm} onComplete={completeForm} /> : null}
      <BodEventArchiveDialog event={confirmation?.event || null} mode={confirmation?.mode} busy={busy} error={mutationError} onClose={() => { if (!busy) { setConfirmation(null); setMutationError(""); } }} onConfirm={confirmMutation} />
    
    
    </main>
  );
}

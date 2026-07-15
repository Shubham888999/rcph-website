import { useEffect, useMemo, useRef, useState } from "react";
import BodEventArchiveDialog from "../../features/bod-tools/BodEventArchiveDialog";
import BodAvenueReportPanel from "../../features/bod-tools/BodAvenueReportPanel";
import BodEventDetailsDialog from "../../features/bod-tools/BodEventDetailsDialog";
import BodEventFilters from "../../features/bod-tools/BodEventFilters";
import BodEventForm from "../../features/bod-tools/BodEventForm";
import BodEventList from "../../features/bod-tools/BodEventList";
import BodEventMutationNotice from "../../features/bod-tools/BodEventMutationNotice";
import { getBodEventDiagnostic, getSafeBodEventError } from "../../features/bod-tools/bodEventErrors";
import { filterBodEvents } from "../../features/bod-tools/bodEventModel";
import {
  archiveBodEvent,
  clearBodEventCache,
  submitBodEvent,
  syncBodEventToAttendance,
  updateBodEvent,
} from "../../features/bod-tools/bodEventService";
import BodLockNotice from "../../features/bod-tools/BodLockNotice";
import BodToolsErrorState from "../../features/bod-tools/BodToolsErrorState";
import BodToolsHeader from "../../features/bod-tools/BodToolsHeader";
import BodToolsShell from "../../features/bod-tools/BodToolsShell";
import BodToolsSkeleton from "../../features/bod-tools/BodToolsSkeleton";
import useBodEvents from "../../features/bod-tools/useBodEvents";
import { clearDashboardDataCache } from "../../features/dashboard/dashboardService";
import useAuth from "../../hooks/useAuth";
import { formatRotaractorName } from "../../utils/memberName";
import "../../styles/components/bod-tools.css";

const DEFAULT_FILTERS = { status: "active", type: "", avenue: "", month: "", mine: false, search: "" };

export default function BodToolsPage() {
  const { access, user, signOut } = useAuth();
  const uid = user?.uid || "";
  const { status, events, lock, reload } = useBodEvents({ uid, enabled: Boolean(uid && access?.canAccessBodTools) });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState(false);
  const mutationLockRef = useRef(false);
  const sessionUidRef = useRef(uid);
  useEffect(() => { sessionUidRef.current = uid; }, [uid]);

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
    setNotice({ type: "success", message: `Event saved and synchronized.${rows === null ? "" : ` Attendance initialized for ${rows} member rows.`}` });
    reload();
  }

  function confirmMutation() {
    if (!confirmation) return;
    const { event, mode } = confirmation;
    if (mode === "archive") {
      runMutation("archive", () => archiveBodEvent(event.id), "Event archived; attendance history was preserved.", () => setConfirmation(null));
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
  onCreateEvent={() => {
    setMutationError("");
    setForm({ event: null });
  }}
/>
        <BodLockNotice lock={lock} canBypass={access.canAccessPresidentControls} />
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
      onEdit={(event) => {
        setMutationError("");
        setForm({ event });
      }}
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

    <BodAvenueReportPanel
      events={events}
      onNotice={setNotice}
    />
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
        }}
        onClose={() => setDetails(null)}
      />
      {form ? <BodEventForm key={form.event?.id || "create"} event={form.event || null} displayName={displayName} busy={busy} mutationError={mutationError} onClose={() => { if (!busy) { setForm(null); setMutationError(""); } }} onSubmit={submitForm} onComplete={completeForm} /> : null}
      <BodEventArchiveDialog event={confirmation?.event || null} mode={confirmation?.mode} busy={busy} error={mutationError} onClose={() => { if (!busy) { setConfirmation(null); setMutationError(""); } }} onConfirm={confirmMutation} />
    
    
    </main>
  );
}

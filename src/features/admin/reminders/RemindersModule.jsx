import {
  useEffect,
  useMemo,
  useState,
} from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import { AdminEmpty } from "../shared/AdminStates";
import { AVENUES } from "../shared/adminModel";
import useAdminMutation from "../shared/useAdminMutation";
import { fetchBodEvents } from "../../bod-tools/bodEventService";
import {
  buildConductedReminderEvents,
  buildEventReminderConfigPayload,
  buildReportingWindowPayload,
  canManageReminders,
  EVENT_REMINDER_RECORD_TYPE,
  EVENT_REMINDER_TYPES,
  findEventReminderConfig,
  REPORTING_WINDOW_RECORD_TYPE,
  summarizeEventReminderStatus,
} from "./reminderModel";
import {
  createReportingWindowReminder,
  upsertEventReminderConfig,
} from "./reminderService";

const emptyReportingWindow = {
  avenue: AVENUES[0],
  eventConductedDate: "",
  eventTime: "",
};

function formatDateTime(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReminderActionMenu({
  event,
  reminders,
  busy,
  canManage,
  open,
  onToggle,
  onConfigure,
}) {
  const mom = findEventReminderConfig(reminders, event, "mom_submission");
  const attendance = findEventReminderConfig(reminders, event, "attendance_marking");

  return (
    <div className="reminders-action-menu">
      <button
        type="button"
        className="reminders-action-menu__trigger"
        aria-label={`Reminder actions for ${event.name}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="reminders-action-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={!canManage || busy}
            onClick={() => onConfigure(event, "mom_submission")}
          >
            MOM Submission Reminder
            {mom ? <small>Configured</small> : null}
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={!canManage || busy}
            onClick={() => onConfigure(event, "attendance_marking")}
          >
            Attendance Marking Reminder
            {attendance ? <small>Configured</small> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function RemindersModule({
  data,
  access,
  uid,
  actorName,
  onNotice,
}) {
  const [draft, setDraft] = useState(emptyReportingWindow);
  const [conductedExpanded, setConductedExpanded] = useState(true);
  const [menuKey, setMenuKey] = useState("");
  const [bodEventState, setBodEventState] = useState({
    uid: "",
    status: "idle",
    events: [],
    error: "",
  });
  const { busy, run } = useAdminMutation({
    uid,
    module: "reminders",
    onNotice,
  });
  const canManage = canManageReminders(access);
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];
  const reportingWindows = reminders.filter((item) =>
    item.recordType === REPORTING_WINDOW_RECORD_TYPE
  );
  const eventReminderConfigs = reminders.filter((item) =>
    item.recordType === EVENT_REMINDER_RECORD_TYPE
  );
  const canLoadBodEvents = Boolean(uid && access?.canAccessBodTools === true);
  const currentBodEventState = canLoadBodEvents && bodEventState.uid === uid
    ? bodEventState
    : {
        uid,
        status: canLoadBodEvents ? "loading" : "success",
        events: [],
        error: "",
      };

  useEffect(() => {
    let active = true;

    if (!canLoadBodEvents) return undefined;

    fetchBodEvents(uid)
      .then((events) => {
        if (active) {
          setBodEventState({ uid, status: "success", events, error: "" });
        }
      })
      .catch(() => {
        if (active) {
          setBodEventState({
            uid,
            status: "error",
            events: [],
            error: "BOD Event Manager records could not be loaded.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [canLoadBodEvents, uid]);

  const conductedEvents = useMemo(() =>
    buildConductedReminderEvents({
      events: data.events,
      bodEvents: currentBodEventState.events,
      bodMeetings: data.bodMeetings,
      districtEvents: data.districtEvents,
    }),
  [
    currentBodEventState.events,
    data.bodMeetings,
    data.districtEvents,
    data.events,
  ]);

  function saveReportingWindow(event) {
    event.preventDefault();

    if (!canManage) {
      onNotice?.({
        type: "error",
        message: "Admin or president-level access is required for Reminders.",
      });
      return;
    }

    const result = buildReportingWindowPayload(draft);
    if (!result.ok) {
      onNotice?.({
        type: "error",
        message: result.errors[0],
      });
      return;
    }

    run(
      "create-reporting-window-reminder",
      () => createReportingWindowReminder(result.payload, {
        uid,
        name: actorName,
        canManage,
      }),
      "Reporting window saved.",
    ).then((saved) => {
      if (saved) setDraft(emptyReportingWindow);
    });
  }

  function configureReminder(row, reminderType) {
    if (!canManage) {
      onNotice?.({
        type: "error",
        message: "Admin or president-level access is required for Reminders.",
      });
      return;
    }

    const result = buildEventReminderConfigPayload(row, reminderType);
    if (!result.ok) {
      onNotice?.({
        type: "error",
        message: result.errors[0],
      });
      return;
    }

    setMenuKey("");
    run(
      "configure-event-reminder",
      () => upsertEventReminderConfig(result.payload, {
        uid,
        name: actorName,
        canManage,
      }),
      `${EVENT_REMINDER_TYPES[reminderType].label} configured.`,
    );
  }

  return (
    <>
      <AdminModuleHeader
        title="Reminders"
        description="Phase 1 reminder setup for reporting windows and conducted event follow-ups."
      />

      {!canManage ? (
        <div className="admin-lock-banner is-locked">
          Admin or president-level access is required to create reminder records.
        </div>
      ) : null}

      <section className="admin-panel reminders-window-panel">
        <header className="reminders-section-header">
          <div>
            <p className="admin-kicker">Avenue Reporting Window</p>
            <h3>Reporting window setup</h3>
          </div>
        </header>

        <form className="admin-form reminders-window-form" onSubmit={saveReportingWindow}>
          <div className="admin-form-grid">
            <label>
              Avenue
              <select
                value={draft.avenue}
                onChange={(event) => setDraft({
                  ...draft,
                  avenue: event.target.value,
                })}
                required
              >
                {AVENUES.map((avenue) => (
                  <option key={avenue} value={avenue}>
                    {avenue}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Event conducted date
              <input
                type="date"
                value={draft.eventConductedDate}
                onChange={(event) => setDraft({
                  ...draft,
                  eventConductedDate: event.target.value,
                })}
                required
              />
            </label>

            <label>
              Event time
              <input
                type="time"
                value={draft.eventTime}
                onChange={(event) => setDraft({
                  ...draft,
                  eventTime: event.target.value,
                })}
              />
            </label>
          </div>

          <button type="submit" disabled={!canManage || busy}>
            Save reporting window
          </button>
        </form>

        <div className="reminders-saved-list">
          <h4>Saved reporting windows</h4>

          {reportingWindows.length ? (
            <div className="admin-table-wrap reminders-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Avenue</th>
                    <th>Conducted</th>
                    <th>Opens</th>
                    <th>Due</th>
                    <th>Lock target</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportingWindows.map((item) => (
                    <tr key={item.id}>
                      <td>{item.avenue}</td>
                      <td>
                        {item.eventConductedDate}
                        {item.eventTime ? ` at ${item.eventTime}` : ""}
                      </td>
                      <td>{formatDateTime(item.reportingOpensAt)}</td>
                      <td>{formatDateTime(item.reportingDueAt)}</td>
                      <td>{formatDateTime(item.lockAt)}</td>
                      <td>
                        {item.remindersEnabled ? "Reminders enabled" : "Reminders off"}
                        {" / "}
                        {item.lockEnabled ? "Lock enabled" : "Lock off"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmpty message="No reporting windows have been saved yet." />
          )}
        </div>
      </section>

      <section className="reminders-conducted-list">
        <button
          type="button"
          className="attendance-section-heading attendance-section-heading--button"
          aria-expanded={conductedExpanded}
          aria-controls="conducted-events-reminders"
          onClick={() => setConductedExpanded((current) => !current)}
        >
          <span className="attendance-section-heading__text">
            <span className="admin-kicker">Conducted Events & Meetings</span>
            <span className="attendance-section-heading__title">
              Past event reminder configs
            </span>
          </span>

          <span className="attendance-section-heading__meta">
            <strong>{conductedEvents.length}</strong>
            <span
              className={`attendance-section-heading__chevron ${
                conductedExpanded ? "is-expanded" : ""
              }`}
              aria-hidden="true"
            >
              &gt;
            </span>
          </span>
        </button>

        {conductedExpanded ? (
          <div id="conducted-events-reminders" className="reminders-conducted-list__body">
            {currentBodEventState.error ? (
              <p className="reminders-inline-error">{currentBodEventState.error}</p>
            ) : null}

            {currentBodEventState.status === "loading" ? (
              <p className="reminders-inline-note">Loading BOD Event Manager records...</p>
            ) : null}

            {conductedEvents.length ? (
              <div className="admin-table-wrap reminders-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Avenue</th>
                      <th>Conducted date</th>
                      <th>Reminder status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conductedEvents.map((row) => (
                      <tr key={row.key}>
                        <td>{row.name}</td>
                        <td>{row.type}</td>
                        <td>{row.avenue.join(", ") || "Not available"}</td>
                        <td>{row.date}</td>
                        <td>{summarizeEventReminderStatus(eventReminderConfigs, row)}</td>
                        <td>
                          <ReminderActionMenu
                            event={row}
                            reminders={eventReminderConfigs}
                            busy={busy}
                            canManage={canManage}
                            open={menuKey === row.key}
                            onToggle={() => setMenuKey((current) =>
                              current === row.key ? "" : row.key
                            )}
                            onConfigure={configureReminder}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmpty message="No conducted events or meetings are available yet." />
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}

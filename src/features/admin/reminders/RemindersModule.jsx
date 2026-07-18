import {
  useEffect,
  useMemo,
  useState,
} from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import { AdminEmpty } from "../shared/AdminStates";
import useAdminMutation from "../shared/useAdminMutation";
import { fetchBodEvents } from "../../bod-tools/bodEventService";
import {
  buildConductedReminderEvents,
  buildEventReminderConfigPayload,
  buildReminderTemplateTestPayload,
  buildReportingWindowPayload,
  buildReminderStatusSummaries,
  canManageReminders,
  EVENT_REMINDER_RECORD_TYPE,
  EVENT_REMINDER_TYPES,
  findEventReminderConfig,
  reportingWindowSentText,
  reportingWindowStatusNote,
  reportingWindowStatusText,
  reportingWindowStatusTone,
  reminderStatusText,
  REMINDER_TEMPLATE_TEST_OPTIONS,
  REPORTING_WINDOW_AVENUE_OPTIONS,
  REPORTING_WINDOW_RECORD_TYPE,
  safeFormatReminderDateTime,
} from "./reminderModel";
import {
  createReportingWindowReminder,
  runReminderEmailSweep,
  sendReminderTemplateTestEmail,
  unlockAvenueReportingWindow,
  upsertEventReminderConfig,
} from "./reminderService";

const createEmptyReportingWindow = () => ({
  avenue: REPORTING_WINDOW_AVENUE_OPTIONS[0],
  targetName: "",
  eventConductedDate: "",
  eventTime: "",
  remindersEnabled: true,
  lockEnabled: true,
});

const emptyReminderTemplateTest = {
  templateType: REMINDER_TEMPLATE_TEST_OPTIONS[0].value,
  recipientEmail: "",
};

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
            {mom ? <small>{reminderStatusText(mom)}</small> : null}
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={!canManage || busy}
            onClick={() => onConfigure(event, "attendance_marking")}
          >
            Attendance Marking Reminder
            {attendance ? <small>{reminderStatusText(attendance)}</small> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReminderStatusBadges({ summaries }) {
  if (!summaries.length) return <span className="reminders-status-empty">Not configured</span>;

  return (
    <div className="reminders-status-badges">
      {summaries.map((item) => (
        <div className="reminders-status-item" key={item.reminderType}>
          <span className={`reminders-status-badge reminders-status-badge--${item.tone}`}>
            {item.shortLabel}: {item.text}
          </span>
          {item.lastReminderSentAt ? (
            <small>Last sent {safeFormatReminderDateTime(item.lastReminderSentAt)}</small>
          ) : null}
          {item.completionReason ? <small>{item.completionReason}</small> : null}
        </div>
      ))}
    </div>
  );
}

function ReportingWindowNote({ item }) {
  const notes = [];
  const statusNote = reportingWindowStatusNote(item);
  if (statusNote) notes.push(statusNote);
  if (item.lockedAt) notes.push(`Locked ${safeFormatReminderDateTime(item.lockedAt)}`);
  if (item.unlockedAt) notes.push(`Unlocked ${safeFormatReminderDateTime(item.unlockedAt)}`);

  return (
    <span className="reminders-window-note">
      {notes.join(" / ") || "None"}
    </span>
  );
}

function sweepSummaryText(summary) {
  if (!summary) return "";
  return [
    `processed ${summary.processed}`,
    `sent ${summary.sent}`,
    `skipped ${summary.skipped}`,
    `failed ${summary.failed}`,
    `completed ${summary.completed}`,
    `no recipient ${summary.noRecipient}`,
    `locked ${summary.locked}`,
    `already submitted ${summary.alreadySubmitted}`,
  ].join(" / ");
}

function reminderTemplateTestLabel(templateType) {
  return REMINDER_TEMPLATE_TEST_OPTIONS.find((option) =>
    option.value === templateType
  )?.label || "Reminder template";
}

export default function RemindersModule({
  data,
  access,
  uid,
  actorName,
  onNotice,
}) {
  const [draft, setDraft] = useState(createEmptyReportingWindow);
  const [conductedExpanded, setConductedExpanded] = useState(true);
  const [menuKey, setMenuKey] = useState("");
  const [sweepSummary, setSweepSummary] = useState(null);
  const [templateTestDraft, setTemplateTestDraft] = useState(emptyReminderTemplateTest);
  const [templateTestMessage, setTemplateTestMessage] = useState(null);
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
        message: "Admin panel authority is required to create reporting windows.",
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
      if (saved) setDraft(createEmptyReportingWindow());
    });
  }

  function runManualSweep() {
    if (!canManage) {
      onNotice?.({
        type: "error",
        message: "Admin panel authority is required to create reporting windows.",
      });
      return;
    }

    if (!window.confirm("Run reminder email sweep now?")) return;

    setSweepSummary(null);
    run(
      "run-reminder-email-sweep",
      runReminderEmailSweep,
      "Reminder email sweep complete.",
    ).then((summary) => {
      if (summary) setSweepSummary(summary);
    });
  }

  function sendTemplateTest(event) {
    event.preventDefault();

    if (!canManage) {
      onNotice?.({
        type: "error",
        message: "Admin panel authority is required to send reminder test emails.",
      });
      return;
    }

    const result = buildReminderTemplateTestPayload(templateTestDraft);
    if (!result.ok) {
      const message = result.errors[0];
      setTemplateTestMessage({ type: "error", message });
      onNotice?.({ type: "error", message });
      return;
    }

    setTemplateTestMessage(null);
    run(
      "send-reminder-template-test-email",
      () => sendReminderTemplateTestEmail(result.payload),
      "Reminder test email sent.",
      {
        onError: () => {
          setTemplateTestMessage({
            type: "error",
            message: "Reminder test email could not be sent.",
          });
          return false;
        },
      },
    ).then((sent) => {
      if (!sent) return;
      setTemplateTestMessage({
        type: "success",
        message: `${reminderTemplateTestLabel(result.payload.templateType)} test sent to ${sent.recipientEmail}.`,
      });
    });
  }

  function configureReminder(row, reminderType) {
    if (!canManage) {
      onNotice?.({
        type: "error",
        message: "Admin panel authority is required to create reporting windows.",
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

  function unlockReportingWindow(item) {
    if (!canManage) {
      onNotice?.({
        type: "error",
        message: "Admin panel authority is required to unlock reporting windows.",
      });
      return;
    }

    const label = item.targetName || item.avenue || "this reporting window";
    if (!window.confirm(`Unlock reporting window for ${label}?`)) return;
    const unlockReason = window.prompt("Unlock reason", "Administrative override");
    if (unlockReason === null) return;

    run(
      "unlock-avenue-reporting-window",
      () => unlockAvenueReportingWindow(item.id, unlockReason),
      "Reporting window unlocked.",
    );
  }

  return (
    <>
      <AdminModuleHeader
        title="Reminders"
        description="Reminder setup and automated follow-up status for conducted events and meetings."
        action={canManage ? (
          <button
            type="button"
            className="reminders-sweep-button"
            disabled={busy}
            onClick={runManualSweep}
          >
            Run reminder email sweep
          </button>
        ) : null}
      />

      {!canManage ? (
        <div className="admin-lock-banner is-locked">
          Admin panel authority is required to create reporting windows.
        </div>
      ) : null}

      {sweepSummary ? (
        <p className="reminders-inline-note reminders-sweep-summary">
          Reminder sweep: {sweepSummaryText(sweepSummary)}
        </p>
      ) : null}

      <section className="admin-panel reminders-window-panel">
        <header className="reminders-section-header">
          <div>
            <p className="admin-kicker">Avenue Reporting Window</p>
            <h3>Reporting window setup</h3>
            <p className="reminders-section-note">
              Reporting reminders are sent to the mapped Avenue Director. GBM/BOD Meeting reminders go to Secretary.
            </p>
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
                {REPORTING_WINDOW_AVENUE_OPTIONS.map((avenue) => (
                  <option key={avenue} value={avenue}>
                    {avenue}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Event/meeting name
              <input
                type="text"
                value={draft.targetName}
                placeholder="Optional"
                onChange={(event) => setDraft({
                  ...draft,
                  targetName: event.target.value,
                })}
              />
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

          <div className="reminders-window-toggles">
            <label>
              <input
                type="checkbox"
                checked={draft.remindersEnabled}
                onChange={(event) => setDraft({
                  ...draft,
                  remindersEnabled: event.target.checked,
                })}
              />
              Send reminder emails
            </label>

            <label>
              <input
                type="checkbox"
                checked={draft.lockEnabled}
                onChange={(event) => setDraft({
                  ...draft,
                  lockEnabled: event.target.checked,
                })}
              />
              Lock after deadline
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
                    <th>Event/meeting</th>
                    <th>Conducted</th>
                    <th>Opens</th>
                    <th>Due</th>
                    <th>Lock target</th>
                    <th>Reminders</th>
                    <th>Lock</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Last sent</th>
                    <th>Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportingWindows.map((item) => (
                    <tr key={item.id}>
                      <td>{item.avenue}</td>
                      <td>{item.targetName || "Not recorded"}</td>
                      <td>
                        {safeFormatReminderDateTime(item.conductedDate || item.eventConductedDate)}
                        {item.eventTime ? ` at ${item.eventTime}` : ""}
                      </td>
                      <td>{safeFormatReminderDateTime(item.windowOpensAt || item.reportingOpensAt)}</td>
                      <td>{safeFormatReminderDateTime(item.reportDueAt || item.reportingDueAt)}</td>
                      <td>{safeFormatReminderDateTime(item.lockAt)}</td>
                      <td>
                        {item.remindersEnabled ? "On" : "Off"}
                      </td>
                      <td>
                        {item.lockEnabled ? "On" : "Off"}
                      </td>
                      <td>
                        <span className={`reminders-status-badge reminders-status-badge--${reportingWindowStatusTone(item)}`}>
                          {reportingWindowStatusText(item)}
                        </span>
                      </td>
                      <td>{reportingWindowSentText(item)}</td>
                      <td>{safeFormatReminderDateTime(item.lastReminderSentAt)}</td>
                      <td>
                        <ReportingWindowNote item={item} />
                      </td>
                      <td>
                        {item.status === "locked" && canManage ? (
                          <button
                            type="button"
                            className="reminders-inline-action"
                            disabled={busy}
                            onClick={() => unlockReportingWindow(item)}
                          >
                            Unlock
                          </button>
                        ) : (
                          <span className="reminders-window-note">None</span>
                        )}
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
                        <td>
                          <ReminderStatusBadges
                            summaries={buildReminderStatusSummaries(eventReminderConfigs, row)}
                          />
                        </td>
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

      {canManage ? (
        <section className="admin-panel reminders-test-panel">
          <header className="reminders-section-header">
            <div>
              <p className="admin-kicker">Reminder Email Test</p>
              <h3>Template preview sender</h3>
              <p className="reminders-section-note">
                Test only. Does not create reminder configs, update counts, or change locks.
              </p>
            </div>
          </header>

          <form className="admin-form reminders-test-form" onSubmit={sendTemplateTest}>
            <div className="admin-form-grid">
              <label>
                Template
                <select
                  value={templateTestDraft.templateType}
                  onChange={(event) => {
                    setTemplateTestMessage(null);
                    setTemplateTestDraft({
                      ...templateTestDraft,
                      templateType: event.target.value,
                    });
                  }}
                  required
                >
                  {REMINDER_TEMPLATE_TEST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Recipient email
                <input
                  type="email"
                  inputMode="email"
                  value={templateTestDraft.recipientEmail}
                  placeholder="name@example.com"
                  onChange={(event) => {
                    setTemplateTestMessage(null);
                    setTemplateTestDraft({
                      ...templateTestDraft,
                      recipientEmail: event.target.value,
                    });
                  }}
                  required
                />
              </label>
            </div>

            <div className="reminders-test-actions">
              <span>Uses test placeholders and sends one email to the address above.</span>
              <button type="submit" disabled={busy}>
                {busy ? "Sending..." : "Send test email"}
              </button>
            </div>
          </form>

          {templateTestMessage ? (
            <p className={`reminders-inline-${templateTestMessage.type === "error" ? "error" : "note"}`}>
              {templateTestMessage.message}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

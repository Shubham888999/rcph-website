import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import AttendanceMark from "../../components/status/AttendanceMark";
import useAuth from "../../hooks/useAuth";
import {
  VISIT_ATTENDANCE_TABS,
  attendanceStatusLabel,
  formatVisitAttendanceName,
  formatVisitAttendanceRoleCode,
  formatVisitDashboardDate,
  formatVisitDashboardDateTime,
  formatVisitDashboardFileSize,
  formatVisitDashboardMoney,
  getVisitDocumentPanelActionLabel,
  getVisitDashboardErrorMessage,
  normalizeVisitDashboardData,
  validVisitAttendanceTab,
  visitTypeFromSlug,
} from "../../features/visits/visitDashboardModel.js";
import { loadVisitDashboardData } from "../../features/visits/visitDashboardService.js";
import "../../styles/components/visit-dashboard.css";

const LOAD_STATUS = Object.freeze({
  loading: "loading",
  ready: "ready",
  error: "error",
});

function VisitDashboardLoading({ title }) {
  return (
    <main className="visit-dashboard-page">
      <section className="visit-dashboard-state" aria-labelledby="visit-dashboard-loading-title">
        <p className="visit-dashboard-eyebrow">Visit dashboard</p>
        <h1 id="visit-dashboard-loading-title">{title}</h1>
        <p>Loading protected visit totals.</p>
        <div className="visit-dashboard-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}

function VisitDashboardError({ title, onRetry }) {
  return (
    <main className="visit-dashboard-page">
      <section className="visit-dashboard-state" aria-labelledby="visit-dashboard-error-title">
        <p className="visit-dashboard-eyebrow">Visit dashboard</p>
        <h1 id="visit-dashboard-error-title">{title}</h1>
        <p>{getVisitDashboardErrorMessage()}</p>
        <button type="button" onClick={onRetry}>Retry</button>
      </section>
    </main>
  );
}

function StatRail({ stats }) {
  const values = [
    { label: "Total members", value: stats.totalMembers },
    { label: "Male", value: stats.maleMembers },
    { label: "Female", value: stats.femaleMembers },
    { label: "Other", value: stats.otherGenderMembers },
    { label: "Not specified", value: stats.unknownGenderMembers },
    { label: "Male/Female ratio", value: stats.maleFemaleRatio },
    { label: "Total events", value: stats.totalEvents },
    { label: "Income", value: formatVisitDashboardMoney(stats.treasuryIncome), tone: "income" },
    { label: "Expense", value: formatVisitDashboardMoney(stats.treasuryExpense), tone: "expense" },
    { label: "Net", value: formatVisitDashboardMoney(stats.treasuryNet), tone: stats.treasuryNet < 0 ? "expense" : "income" },
  ];

  return (
    <dl className="visit-dashboard-stat-rail">
      {values.map((item) => (
        <div key={item.label} className={item.tone ? `is-${item.tone}` : ""}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AvenueCounts({ rows }) {
  return (
    <section className="visit-dashboard-avenue-section" aria-labelledby="visit-dashboard-avenues-title">
      <header>
        <p className="visit-dashboard-eyebrow">Club activity</p>
        <h2 id="visit-dashboard-avenues-title">Avenue-wise events</h2>
      </header>
      <ul className="visit-dashboard-avenue-list">
        {rows.map((row) => (
          <li className={row.count === 0 ? "is-zero" : ""} key={row.avenueCode}>
            <span className="visit-dashboard-avenue-chip__label">
              <strong>{row.avenueName}</strong>
              <small>{row.avenueCode}</small>
            </span>
            <b aria-label={`${row.count} ${row.count === 1 ? "event" : "events"}`}>{row.count}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DocumentPanels({ panels }) {
  const hasPanels = panels.length > 0;
  const allPanelsCanOpen = hasPanels && panels.every((panel) => panel.canOpen && panel.openUrl);
  const folderLinkNote = allPanelsCanOpen
    ? "Open the selected Google Drive folders shared by the club admin."
    : "Folder links appear when shared by the club admin.";

  return (
    <section className="visit-dashboard-documents" aria-labelledby="visit-dashboard-documents-title">
      <header className="visit-dashboard-section-heading">
        <div>
          <p className="visit-dashboard-eyebrow">Selected folders</p>
          <h2 id="visit-dashboard-documents-title">BOD Documents</h2>
        </div>
        <p>Only folders selected by the club admin are visible here.</p>
      </header>

      {!hasPanels ? (
        <div className="visit-dashboard-empty-state">
          <strong>No document folders have been selected for this visit yet.</strong>
        </div>
      ) : (
        <div className="visit-dashboard-folder-directory">
          <p className="visit-dashboard-documents-note">
            {folderLinkNote}
          </p>
          {panels.map((panel) => {
            const folderCode = formatVisitAttendanceRoleCode(panel.positionTitle || panel.positionKey || panel.avenueCode);
            const actionLabel = getVisitDocumentPanelActionLabel(panel);
            const fileCountLabel = `${panel.fileCount} ${panel.fileCount === 1 ? "file" : "files"}`;
            return (
            <details className="visit-dashboard-folder-panel" key={panel.positionKey}>
              <summary aria-label={`${panel.folderLabel}: ${fileCountLabel}${actionLabel ? `. ${actionLabel}` : ""}`} title={panel.folderLabel}>
                <span className="visit-dashboard-folder-title">
                  <strong>{panel.folderLabel}</strong>
                  <small>{folderCode}</small>
                </span>
                <span className="visit-dashboard-folder-actions">
                  <span className="visit-dashboard-folder-count">{fileCountLabel}</span>
                  {actionLabel ? (
                    <a
                      className="visit-dashboard-folder-action"
                      href={panel.openUrl}
                      onClick={(event) => event.stopPropagation()}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {actionLabel}
                    </a>
                  ) : null}
                </span>
              </summary>
              {panel.files.length ? (
                <ul className="visit-dashboard-document-list">
                  {panel.files.map((file) => {
                    const fileMeta = [
                      file.mimeType || "",
                      formatVisitDashboardFileSize(file.fileSize),
                    ].filter(Boolean).join(" / ");
                    return (
                      <li key={file.submissionId}>
                        <div>
                          <strong>{file.title}</strong>
                          <span>{file.fileName || "Document"}</span>
                        </div>
                        <dl>
                          {fileMeta ? (
                            <div>
                              <dt>Type/Size</dt>
                              <dd>{fileMeta}</dd>
                            </div>
                          ) : null}
                          {file.uploadedAt ? (
                            <div>
                              <dt>Uploaded</dt>
                              <dd>{formatVisitDashboardDateTime(file.uploadedAt)}</dd>
                            </div>
                          ) : null}
                          {file.uploadedByName ? (
                            <div>
                              <dt>By</dt>
                              <dd>{file.uploadedByName}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="visit-dashboard-empty-state visit-dashboard-empty-state--compact">
                  <strong>No visible documents uploaded for this folder yet.</strong>
                </div>
              )}
            </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

function attendanceStatusMarkValue(status) {
  if (status === "present" || status === "late") return true;
  if (status === "absent") return false;
  return "NA";
}

function AttendanceTable({ view }) {
  if (!view.columns.length) {
    return (
      <div className="visit-dashboard-empty-state">
        <strong>No attendance records are available yet.</strong>
      </div>
    );
  }

  if (!view.rows.length) {
    return (
      <div className="visit-dashboard-empty-state">
        <strong>No members are available for this attendance view.</strong>
      </div>
    );
  }

  const tableMinWidth = Math.max(980, 400 + view.columns.length * 96);

  return (
    <div className="visit-dashboard-attendance-table-wrap">
      <table className="visit-dashboard-attendance-table" style={{ minWidth: `${tableMinWidth}px` }}>
        <caption>Read-only attendance overview</caption>
        <colgroup>
          <col className="visit-dashboard-attendance-col-name" />
          <col className="visit-dashboard-attendance-col-role" />
          {view.columns.map((column) => (
            <col className="visit-dashboard-attendance-col-status" key={column.eventId} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role/Position</th>
            {view.columns.map((column) => (
              <th scope="col" key={column.eventId}>
                <span>{column.title}</span>
                <small>{column.date || column.avenueName || column.avenueCode || "Event"}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => {
            const displayName = formatVisitAttendanceName(row.name);
            const fullRole = row.roleOrPosition || "Member";
            const roleCode = formatVisitAttendanceRoleCode(fullRole);
            return (
            <tr key={row.personId}>
              <th className="visit-dashboard-attendance-name" scope="row" title={displayName}>{displayName}</th>
              <td className="visit-dashboard-attendance-role" title={fullRole} aria-label={`${displayName} role or position: ${fullRole}`}>{roleCode}</td>
              {view.columns.map((column) => {
                const status = row.cells[column.eventId] || "unknown";
                const statusClass = ["present", "absent", "late", "excused", "unknown"].includes(status)
                  ? status
                  : "unknown";
                const statusLabel = attendanceStatusLabel(statusClass);
                return (
                  <td className="visit-dashboard-attendance-mark-cell" key={column.eventId}>
                    <span
                      className={`visit-dashboard-attendance-status is-${statusClass}`}
                      aria-label={`${displayName}, ${column.title}: ${statusLabel}`}
                      title={statusLabel}
                    >
                      <AttendanceMark
                        value={attendanceStatusMarkValue(statusClass)}
                        size="small"
                        ariaLabel={statusLabel}
                        title={statusLabel}
                      />
                    </span>
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceRecords({ attendance }) {
  const [activeTab, setActiveTab] = useState(VISIT_ATTENDANCE_TABS[0].key);
  const currentTab = validVisitAttendanceTab(activeTab);

  return (
    <details className="visit-dashboard-attendance" aria-labelledby="visit-dashboard-attendance-title">
      <summary>
        <span>
          <p className="visit-dashboard-eyebrow">Read-only</p>
          <h2 id="visit-dashboard-attendance-title">Attendance Records</h2>
        </span>
        <b>View</b>
      </summary>
      <div className="visit-dashboard-attendance-tabs" role="tablist" aria-label="Attendance views">
        {VISIT_ATTENDANCE_TABS.map((tab) => (
          <button
            aria-controls={`visit-dashboard-attendance-${tab.key}`}
            aria-selected={currentTab === tab.key}
            className={currentTab === tab.key ? "is-active" : ""}
            id={`visit-dashboard-attendance-tab-${tab.key}`}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {VISIT_ATTENDANCE_TABS.map((tab) => {
        const view = attendance[tab.key];
        const active = currentTab === tab.key;
        return (
          <section
            aria-labelledby={`visit-dashboard-attendance-tab-${tab.key}`}
            className={active ? "visit-dashboard-attendance-panel is-active" : "visit-dashboard-attendance-panel"}
            hidden={!active}
            id={`visit-dashboard-attendance-${tab.key}`}
            key={tab.key}
            role="tabpanel"
          >
            <dl className="visit-dashboard-attendance-summary">
              <div>
                <dt>Records</dt>
                <dd>{view.summary.totalEvents}</dd>
              </div>
              <div>
                <dt>People</dt>
                <dd>{view.summary.totalPeople}</dd>
              </div>
              <div>
                <dt>Average</dt>
                <dd>{view.summary.averageAttendanceRate}%</dd>
              </div>
            </dl>
            <AttendanceTable view={view} />
          </section>
        );
      })}
    </details>
  );
}

function TreasuryRecords({ treasury }) {
  const summaryValues = [
    { label: "Income", value: formatVisitDashboardMoney(treasury.summary.income), tone: "income" },
    { label: "Expense", value: formatVisitDashboardMoney(treasury.summary.expense), tone: "expense" },
    { label: "Net", value: formatVisitDashboardMoney(treasury.summary.net), tone: treasury.summary.net < 0 ? "expense" : "income" },
    { label: "Transactions", value: treasury.summary.transactionCount },
  ];

  return (
    <section className="visit-dashboard-treasury" aria-labelledby="visit-dashboard-treasury-title">
      <header className="visit-dashboard-section-heading">
        <div>
          <p className="visit-dashboard-eyebrow">Read-only</p>
          <h2 id="visit-dashboard-treasury-title">Treasury Records</h2>
        </div>
        <p>Read-only financial summary and transaction register for the selected visit.</p>
      </header>

      <dl className="visit-dashboard-treasury-summary">
        {summaryValues.map((item) => (
          <div className={item.tone ? `is-${item.tone}` : ""} key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      {treasury.rows.length ? (
        <div className="visit-dashboard-treasury-table-wrap">
          <table className="visit-dashboard-treasury-table">
            <caption>Read-only treasury transaction register</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Title / Description</th>
                <th scope="col">Type</th>
                <th scope="col">Category / Avenue</th>
                <th scope="col">Amount</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {treasury.rows.map((row) => {
                const typeClass = ["income", "expense", "unknown"].includes(row.type) ? row.type : "unknown";
                return (
                  <tr key={row.transactionId}>
                    <td>{formatVisitDashboardDate(row.date) || row.date}</td>
                    <th scope="row">
                      <strong>{row.title}</strong>
                      {row.description ? <small>{row.description}</small> : null}
                    </th>
                    <td>
                      <span className={`visit-dashboard-treasury-type is-${typeClass}`}>
                        {typeClass === "income" ? "Income" : typeClass === "expense" ? "Expense" : "Unknown"}
                      </span>
                    </td>
                    <td>
                      <strong>{row.category || "Uncategorized"}</strong>
                      <small>{row.avenueName || row.avenueCode || "No avenue"}</small>
                    </td>
                    <td className={`visit-dashboard-treasury-amount is-${typeClass}`}>
                      {formatVisitDashboardMoney(row.amount)}
                    </td>
                    <td>{row.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="visit-dashboard-empty-state">
          <strong>No treasury records are available yet.</strong>
        </div>
      )}
    </section>
  );
}

export default function VisitDashboardPage() {
  const { visitSlug = "" } = useParams();
  const { user } = useAuth();
  const visitType = visitTypeFromSlug(visitSlug);
  const fallbackData = useMemo(
    () => normalizeVisitDashboardData(null, visitType),
    [visitType],
  );
  const [loadState, setLoadState] = useState({
    status: LOAD_STATUS.loading,
    data: null,
    error: null,
  });

  const loadDashboard = useCallback(async () => {
    if (!user?.uid || !visitType) {
      setLoadState({ status: LOAD_STATUS.error, data: null, error: new Error("Visit dashboard unavailable.") });
      return;
    }

    setLoadState((current) => ({
      status: LOAD_STATUS.loading,
      data: current.data,
      error: null,
    }));

    try {
      const data = await loadVisitDashboardData(user.uid, visitType);
      setLoadState({ status: LOAD_STATUS.ready, data, error: null });
    } catch (error) {
      setLoadState({ status: LOAD_STATUS.error, data: null, error });
    }
  }, [user?.uid, visitType]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const data = loadState.data || fallbackData;
  const { visit, stats, documentPanels, attendance, treasury } = data;
  const officialNames = visit.officialDisplayNames.length
    ? visit.officialDisplayNames
    : ["District Officials"];

  if (loadState.status === LOAD_STATUS.loading && !loadState.data) {
    return <VisitDashboardLoading title={visit.title} />;
  }

  if (loadState.status === LOAD_STATUS.error) {
    return <VisitDashboardError title={visit.title} onRetry={loadDashboard} />;
  }

  return (
    <main className="visit-dashboard-page">
      <div className="visit-dashboard-shell">
        <header className="visit-dashboard-masthead" aria-labelledby="visit-dashboard-title">
          <div>
            <p className="visit-dashboard-eyebrow">Visit dashboard</p>
            <h1 id="visit-dashboard-title">{visit.title}</h1>
            <p className="visit-dashboard-intro">Welcome District Officials</p>
            <ul className="visit-dashboard-officials" aria-label="District official names">
              {officialNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <span className="visit-dashboard-readonly">Read-only</span>
        </header>

        <StatRail stats={stats} />

        <AvenueCounts rows={stats.avenueEventCounts} />

        <DocumentPanels panels={documentPanels} />

        <AttendanceRecords attendance={attendance} />

        <TreasuryRecords treasury={treasury} />

        {data.generatedAt ? (
          <p className="visit-dashboard-freshness">
            Updated {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Kolkata",
            }).format(new Date(data.generatedAt))}
          </p>
        ) : null}
      </div>
    </main>
  );
}

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import AttendanceMark from "../../components/status/AttendanceMark";
import useAuth from "../../hooks/useAuth";
import {
  VISIT_ATTENDANCE_TABS,
  attendanceStatusLabel,
  buildGlanceStats,
  buildTreasuryLedger,
  finesHasNotes,
  formatVisitAttendanceName,
  formatVisitAttendanceRoleCode,
  formatVisitDashboardDate,
  formatVisitDashboardDateTime,
  formatVisitDashboardFileSize,
  formatVisitDashboardMoney,
  formatVisitDocumentBlockFileCount,
  formatVisitLedgerAmount,
  getVisitDocumentBlockAriaLabel,
  getVisitDocumentPanelActionLabel,
  getVisitAttendanceEventsForAvenue,
  getVisitDashboardErrorMessage,
  groupDocumentPanelsByPerson,
  normalizeVisitDashboardData,
  parseOfficialDisplayName,
  resolveVisitDocumentRoleCode,
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

const SECTION_LINKS = Object.freeze([
  { id: "visit-dashboard-overview", label: "Overview" },
  { id: "visit-dashboard-avenues", label: "Avenues" },
  { id: "visit-dashboard-documents", label: "BOD documents" },
  { id: "visit-dashboard-attendance", label: "Attendance" },
  { id: "visit-dashboard-letterhead", label: "Letterhead exchanges", letterhead: true },
  { id: "visit-dashboard-fines", label: "Fines" },
  { id: "visit-dashboard-treasury", label: "Treasury ledger" },
]);

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function openAndScrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  if (target.tagName === "DETAILS") target.open = true;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const focusTarget = target.tagName === "DETAILS" ? target.querySelector("summary") : target;
  focusTarget?.focus?.({ preventScroll: true });
}

function VisitingPanel({ names }) {
  if (!names.length) return null;
  return (
    <ul className="visit-dashboard-visiting-panel" aria-label="Visiting panel">
      {names.map((line) => {
        const official = parseOfficialDisplayName(line);
        return (
          <li key={line}>
            <strong>{official.name}</strong>
            {official.role ? <span>{official.role}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function SectionLinks({ showLetterhead }) {
  return (
    <nav className="visit-dashboard-section-links" aria-label="Dashboard sections">
      {SECTION_LINKS.filter((link) => showLetterhead || !link.letterhead).map((link) => (
        <a
          href={`#${link.id}`}
          key={link.id}
          onClick={(event) => {
            event.preventDefault();
            openAndScrollToSection(link.id);
          }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function GlanceBar({ segments, label }) {
  return (
    <div className="visit-dashboard-glance-bar" role="img" aria-label={label}>
      {segments.map((segment) => (
        <span className={`is-${segment.key}`} key={segment.key} style={{ width: `${segment.share}%` }} />
      ))}
    </div>
  );
}

function ClubAtAGlance({ glance }) {
  const { members, events, attendance, treasury } = glance;
  return (
    <section
      className="visit-dashboard-glance"
      id="visit-dashboard-overview"
      tabIndex={-1}
      aria-labelledby="visit-dashboard-glance-title"
    >
      <header className="visit-dashboard-section-heading">
        <div>
          <p className="visit-dashboard-eyebrow">Overview</p>
          <h2 id="visit-dashboard-glance-title">Club at a glance</h2>
        </div>
      </header>

      <div className="visit-dashboard-glance-grid">
        <article className="visit-dashboard-glance-tile">
          <h3>Members</h3>
          <p className="visit-dashboard-glance-value">{members.total}</p>
          <GlanceBar
            segments={members.segments}
            label={`Members by gender: ${members.segments.map((segment) => `${segment.value} ${segment.label.toLowerCase()}`).join(", ")}`}
          />
          <p className="visit-dashboard-glance-line">{members.line}</p>
        </article>

        <article className="visit-dashboard-glance-tile">
          <h3>Events held</h3>
          <p className="visit-dashboard-glance-value">{events.total}</p>
          {events.bars.length ? (
            <div
              className="visit-dashboard-glance-columns"
              role="img"
              aria-label={`Events by avenue: ${events.bars.map((bar) => `${bar.avenueCode} ${bar.count}`).join(", ")}`}
            >
              {events.bars.map((bar) => (
                <span key={bar.avenueCode} title={`${bar.avenueName || bar.avenueCode}: ${bar.count}`}>
                  <i style={{ height: `${Math.max(bar.share, 8)}%` }} />
                </span>
              ))}
            </div>
          ) : null}
          <p className="visit-dashboard-glance-line">{events.line}</p>
        </article>

        <article className="visit-dashboard-glance-tile">
          <h3>Club attendance</h3>
          <p className="visit-dashboard-glance-value">{attendance.label}</p>
          {attendance.hasData ? (
            <div className="visit-dashboard-glance-bar" role="img" aria-label={`Average club attendance ${attendance.label}`}>
              <span className="is-progress" style={{ width: `${attendance.rate}%` }} />
            </div>
          ) : null}
          <p className="visit-dashboard-glance-line">{attendance.line}</p>
        </article>

        <article className="visit-dashboard-glance-tile">
          <h3>Treasury balance</h3>
          <p className={`visit-dashboard-glance-value ${treasury.negative ? "is-negative" : "is-positive"}`}>
            {formatVisitDashboardMoney(treasury.net)}
          </p>
          <GlanceBar
            segments={treasury.segments}
            label={`Income ${formatVisitDashboardMoney(treasury.income)}, expense ${formatVisitDashboardMoney(treasury.expense)}`}
          />
          <p className="visit-dashboard-glance-line">{treasury.line}</p>
        </article>
      </div>
    </section>
  );
}

function AvenueCounts({ rows, attendance }) {
  const activeAvenueRows = rows
    .filter((row) => (
      row.avenueCode !== "GBM"
      && Number(row.count) > 0
    ))
    .map((row) => ({
      ...row,
      events: getVisitAttendanceEventsForAvenue(attendance, row),
    }))
    .filter((row) => row.events.length > 0);
  const maxEventCount = Math.max(1, ...activeAvenueRows.map((row) => row.events.length));

  return (
    <section
      className="visit-dashboard-avenue-section"
      id="visit-dashboard-avenues"
      tabIndex={-1}
      aria-labelledby="visit-dashboard-avenues-title"
    >
      <header>
        <p className="visit-dashboard-eyebrow">Club activity</p>
        <h2 id="visit-dashboard-avenues-title">Avenue-wise events</h2>
      </header>

      {activeAvenueRows.length ? (
        <ul className="visit-dashboard-avenue-list">
          {activeAvenueRows.map((row) => {
            const events = row.events;
            const eventCount = events.length;

            return (
              <li key={row.avenueCode}>
                <details className="visit-dashboard-avenue-disclosure">
                  <summary>
                    <span className="visit-dashboard-avenue-chip__label">
                      <strong>{row.avenueName}</strong>
                      <small>{row.avenueCode}</small>
                    </span>

                    <span className="visit-dashboard-avenue-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round((eventCount / maxEventCount) * 100)}%` }} />
                    </span>

                    <span className="visit-dashboard-avenue-count-wrap">
                      <b aria-label={`${eventCount} ${eventCount === 1 ? "event" : "events"}`}>
                        {eventCount}
                      </b>
                      <i aria-hidden="true">&gt;</i>
                    </span>
                  </summary>

                  {events.length ? (
                    <ul className="visit-dashboard-avenue-event-list">
                      {events.map((event) => (
                        <li key={event.eventId}>
                          <strong>{event.title}</strong>
                          <span>{event.date}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="visit-dashboard-avenue-empty">
                      No linked attendance records found for this avenue yet.
                    </p>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="visit-dashboard-empty-state">
          <strong>No avenue-wise events have been recorded yet.</strong>
        </div>
      )}
    </section>
  );
}

function getPanelDocumentGroups(panel) {
  return {
    primary: panel?.primaryPresentation || null,
  };
}

function DocumentFileList({ files }) {
  if (!files.length) {
    return (
      <p className="visit-dashboard-document-empty">
        No other documents in this folder.
      </p>
    );
  }

  return (
    <ul className="visit-dashboard-document-list">
      {files.map((file) => {
        const sizeLabel = formatVisitDashboardFileSize(file.fileSize);
        const meta = [file.fileName || "Document", sizeLabel].filter(Boolean).join(" / ");
        return (
          <li key={file.submissionId}>
            <div>
              <strong>{file.title}</strong>
              <span>{meta}</span>
            </div>
            {file.canOpen && file.openUrl ? (
              <a
                className="visit-dashboard-document-action"
                href={file.openUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open file
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DocumentPanelBody({ panel, showEmptyFolderLink = false }) {
  const actionLabel = getVisitDocumentPanelActionLabel(panel);
  const { primary } = getPanelDocumentGroups(panel);
  if (!panel.files.length) {
    return (
      <div className="visit-dashboard-empty-state visit-dashboard-empty-state--compact">
        <strong>No visible documents uploaded for this folder yet.</strong>
        {showEmptyFolderLink && actionLabel ? (
          <a
            className="visit-dashboard-folder-action"
            href={panel.openUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {actionLabel}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="visit-dashboard-document-panel-body">
      {primary ? (
        <div className="visit-dashboard-document-preview">
          <div className="visit-dashboard-document-preview-heading">
            <div>
              <p className="visit-dashboard-document-kicker">Primary preview</p>
              <h3>{primary.title}</h3>
              <span>{primary.fileName || "Document"}</span>
            </div>
          </div>

          <iframe
            className="visit-dashboard-document-preview-frame"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={primary.previewUrl}
            title={`Preview of ${primary.title}`}
          />
        </div>
      ) : (
        <p className="visit-dashboard-document-empty">
          No main presentation has been selected for this folder.
        </p>
      )}

      <details className="visit-dashboard-document-files" aria-label="Other documents">
        <summary>
          <span className="visit-dashboard-document-files-title">
            All Files
          </span>

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
        </summary>

        <DocumentFileList files={panel.files} />
      </details>
    </div>
  );
}

function DocumentRoleLabel({ panel }) {
  const folderCode = resolveVisitDocumentRoleCode(
    panel,
    formatVisitAttendanceRoleCode(panel.positionTitle || panel.positionKey || panel.avenueCode),
  );
  return (
    <span className="visit-dashboard-role-inline" title={panel.folderLabel}>
      {folderCode ? <span className="visit-dashboard-role-code">{folderCode}</span> : null}
      <span className="visit-dashboard-role-title">{panel.positionTitle}</span>
    </span>
  );
}

function DocumentBlock({ block }) {
  const multiRole = block.panels.length > 1;
  return (
    <details className="visit-dashboard-folder-panel visit-dashboard-person-block">
      <summary aria-label={getVisitDocumentBlockAriaLabel(block)} title={block.title}>
        <span className="visit-dashboard-folder-title visit-dashboard-person-heading">
          {block.vacant ? (
            <span className="visit-dashboard-person-vacant">Vacant</span>
          ) : (
            <strong>{block.title}</strong>
          )}
          <span className="visit-dashboard-role-inline-list">
            {block.panels.map((panel) => (
              <Fragment key={panel.positionKey}>
                <span className="visit-dashboard-role-divider" aria-hidden="true" />
                <DocumentRoleLabel panel={panel} />
              </Fragment>
            ))}
          </span>
        </span>

        <span className="visit-dashboard-folder-actions">
          <span className="visit-dashboard-folder-count">{formatVisitDocumentBlockFileCount(block)}</span>
        </span>
      </summary>

      {multiRole ? (
        <div className="visit-dashboard-person-roles">
          {block.panels.map((panel) => (
            <section
              className="visit-dashboard-person-role"
              aria-labelledby={`visit-dashboard-role-${block.blockKey}-${panel.positionKey}`}
              key={panel.positionKey}
            >
              <h3 className="visit-dashboard-person-role-heading" id={`visit-dashboard-role-${block.blockKey}-${panel.positionKey}`}>
                <DocumentRoleLabel panel={panel} />
                <small>{panel.fileCount} {panel.fileCount === 1 ? "file" : "files"}</small>
              </h3>
              <DocumentPanelBody panel={panel} showEmptyFolderLink />
            </section>
          ))}
        </div>
      ) : (
        <DocumentPanelBody panel={block.panels[0]} />
      )}
    </details>
  );
}

function DocumentPanels({ panels }) {
  const hasPanels = panels.length > 0;
  const blocks = groupDocumentPanelsByPerson(panels);

  return (
    <section
      className="visit-dashboard-documents"
      id="visit-dashboard-documents"
      tabIndex={-1}
      aria-labelledby="visit-dashboard-documents-title"
    >
      <header className="visit-dashboard-section-heading">
        <div>
          <p className="visit-dashboard-eyebrow">Selected folders</p>
          <h2 id="visit-dashboard-documents-title">BOD Documents</h2>
        </div>
      </header>

      {!hasPanels ? (
        <div className="visit-dashboard-empty-state">
          <strong>No document folders have been selected for this visit yet.</strong>
        </div>
      ) : !blocks.length ? (
        <div className="visit-dashboard-empty-state">
          <strong>No role holders or documents to show for the selected folders yet.</strong>
        </div>
      ) : (
        <div className="visit-dashboard-folder-directory">
          {blocks.map((block) => <DocumentBlock block={block} key={block.blockKey} />)}
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

  const fixedColumnsWidth = 6 + 16 + 7;
  const eventColumnWidth = 8;
  const tableWidthRem = fixedColumnsWidth + (view.columns.length * eventColumnWidth);

  return (
    <div className="visit-dashboard-attendance-table-shell">
<div
  className="visit-dashboard-attendance-table-wrap"
  tabIndex={0}
>
          <table
          className="visit-dashboard-attendance-table"
          style={{ width: `${tableWidthRem}rem`, minWidth: "69rem" }}
        >
          <caption>Read-only attendance overview</caption>
          <colgroup>
            <col className="visit-dashboard-attendance-col-percent" />
            <col className="visit-dashboard-attendance-col-name" />
            <col className="visit-dashboard-attendance-col-role" />
            {view.columns.map((column) => (
              <col className="visit-dashboard-attendance-col-status" key={column.eventId} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="visit-dashboard-attendance-percent-heading" scope="col">Member %</th>
              <th className="visit-dashboard-attendance-name-heading" scope="col">Name</th>
              <th className="visit-dashboard-attendance-role-heading" scope="col">Role</th>
              {view.columns.map((column) => (
                <th
                  className="visit-dashboard-attendance-event-heading"
                  key={column.eventId}
                  scope="col"
                  title={`${column.title} / ${column.date || column.avenueName || column.avenueCode || "Event"} / ${column.attendanceLabel}`}
                >
                  <span>{column.title}</span>
                  <small>{column.date || column.avenueName || column.avenueCode || "Event"}</small>
                  <small className="visit-dashboard-attendance-event-rate">
                    {column.attendanceLabel}
                  </small>
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
                  <td className="visit-dashboard-attendance-percent" title={`${displayName}: ${row.attendanceLabel}`}>
                    {row.attendanceLabel}
                  </td>
                  <th className="visit-dashboard-attendance-name" scope="row" title={displayName}>
                    {displayName}
                  </th>
                  <td className="visit-dashboard-attendance-role" title={fullRole} aria-label={`${displayName} role or position: ${fullRole}`}>
                    {roleCode}
                  </td>
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
                            ariaLabel={statusLabel}
                            size="small"
                            title={statusLabel}
                            value={attendanceStatusMarkValue(statusClass)}
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
    </div>
  );
}

function AttendanceRecords({ attendance }) {
  const [activeTab, setActiveTab] = useState(VISIT_ATTENDANCE_TABS[0].key);
  const currentTab = validVisitAttendanceTab(activeTab);

  return (
    <details className="visit-dashboard-attendance" id="visit-dashboard-attendance" aria-labelledby="visit-dashboard-attendance-title">
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
                <dd>{view.summary.averageAttendanceLabel}</dd>
              </div>
              <div>
                <dt>Event attendance %</dt>
                <dd>{view.summary.averageEventAttendanceLabel}</dd>
              </div>
              <div>
                <dt>Member attendance %</dt>
                <dd>{view.summary.averageMemberAttendanceLabel}</dd>
              </div>
            </dl>
            <AttendanceTable view={view} />
          </section>
        );
      })}
    </details>
  );
}

function fineStatusLabel(status) {
  const labels = {
    paid: "Paid",
    pending: "Pending",
    waived: "Waived",
    unknown: "Unknown",
  };
  return labels[status] || labels.unknown;
}

function rupees(value) {
  return `₹${formatVisitLedgerAmount(value)}`;
}

function RecordsDisclosure({ id, className, titleId, title, meta, children }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={`visit-dashboard-records ${className}`}
      id={id}
      aria-labelledby={titleId}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="visit-dashboard-records-chevron" aria-hidden="true" />
        <h2 id={titleId}>{title}</h2>
        <span className="visit-dashboard-records-meta">{meta}</span>
        <span className="visit-dashboard-records-toggle">{open ? "Hide records" : "Show records"}</span>
      </summary>
      {children}
    </details>
  );
}

function LetterheadExchanges({ letterhead }) {
  const { rows, summary } = letterhead;
  return (
    <RecordsDisclosure
      id="visit-dashboard-letterhead"
      className="visit-dashboard-letterhead"
      titleId="visit-dashboard-letterhead-title"
      title="Letterhead exchanges"
      meta={(
        <>
          <span>{summary.count} {summary.count === 1 ? "exchange" : "exchanges"}</span>
          <span>{summary.clubCount} {summary.clubCount === 1 ? "club" : "clubs"}</span>
        </>
      )}
    >
      {rows.length ? (
        <div className="visit-dashboard-ledger-wrap" tabIndex={0} aria-label="Letterhead exchanges table">
          <table className="visit-dashboard-ledger-table visit-dashboard-letterhead-table">
            <caption>Read-only letterhead exchanges</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Exchanged with</th>
                <th scope="col">RCPH representatives</th>
                <th scope="col">Event</th>
                <th scope="col" className="is-number">Photos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const clubs = [...new Set(row.externalParticipants.map((participant) => participant.clubName).filter(Boolean))];
                return (
                  <tr key={row.exchangeId}>
                    <td className="is-date">{formatVisitDashboardDate(row.exchangeDate)}</td>
                    <th scope="row">
                      <strong>{clubs.join(", ") || "—"}</strong>
                      {row.externalParticipants.map((participant, index) => (
                        <small key={`${participant.rotaractorName}-${index}`}>
                          {[formatVisitAttendanceName(participant.rotaractorName), participant.position].filter(Boolean).join(" · ")}
                        </small>
                      ))}
                    </th>
                    <td>{row.rcphRepresentatives.join(", ") || "—"}</td>
                    <td>{row.associatedEvent?.name || "—"}</td>
                    <td className="is-number">{row.imageCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="visit-dashboard-empty-state">
          <strong>No letterhead exchanges recorded yet.</strong>
        </div>
      )}
    </RecordsDisclosure>
  );
}

function FinesRecords({ fines }) {
  const showNotes = finesHasNotes(fines.rows);
  const columnCount = showNotes ? 7 : 6;
  return (
    <RecordsDisclosure
      id="visit-dashboard-fines"
      className="visit-dashboard-fines"
      titleId="visit-dashboard-fines-title"
      title="Fines"
      meta={(
        <>
          <span>{fines.summary.totalFines} {fines.summary.totalFines === 1 ? "fine" : "fines"}</span>
          <span className="is-collected">{formatVisitDashboardMoney(fines.summary.collectedAmount)} collected</span>
          <span>{formatVisitDashboardMoney(fines.summary.pendingAmount)} pending</span>
        </>
      )}
    >
      {fines.rows.length ? (
        <div className="visit-dashboard-ledger-wrap" tabIndex={0} aria-label="Fines table">
          <table className="visit-dashboard-ledger-table visit-dashboard-fines-table">
            <caption>Read-only fines register</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Member</th>
                <th scope="col">Reason</th>
                <th scope="col">Event</th>
                <th scope="col" className="is-number">Amount</th>
                <th scope="col">Status</th>
                {showNotes ? <th scope="col">Notes</th> : null}
              </tr>
            </thead>
            <tbody>
              {fines.rows.map((fine) => {
                const statusClass = ["paid", "pending", "waived", "unknown"].includes(fine.status)
                  ? fine.status
                  : "unknown";
                return (
                  <tr key={fine.fineKey}>
                    <td className="is-date">{formatVisitDashboardDate(fine.date) || fine.date}</td>
                    <th scope="row">{formatVisitAttendanceName(fine.memberName)}</th>
                    <td>{fine.reason}</td>
                    <td>{fine.title && fine.title !== fine.reason ? fine.title : "—"}</td>
                    <td className="is-number">{rupees(fine.amount)}</td>
                    <td className={`visit-dashboard-fines-status is-${statusClass}`}>{fineStatusLabel(statusClass)}</td>
                    {showNotes ? <td className="visit-dashboard-fines-notes">{fine.notes || "—"}</td> : null}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={4}>Total · {fines.summary.totalFines} {fines.summary.totalFines === 1 ? "fine" : "fines"}</th>
                <td className="is-number">{rupees(fines.summary.totalAmount)}</td>
                <td colSpan={columnCount - 5} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="visit-dashboard-empty-state">
          <strong>No fines have been recorded yet.</strong>
        </div>
      )}
    </RecordsDisclosure>
  );
}

function TreasuryLedger({ treasury }) {
  const ledger = buildTreasuryLedger(treasury.rows);
  return (
    <section
      className="visit-dashboard-treasury"
      id="visit-dashboard-treasury"
      tabIndex={-1}
      aria-labelledby="visit-dashboard-treasury-title"
    >
      <header className="visit-dashboard-section-heading">
        <div>
          <p className="visit-dashboard-eyebrow">Read-only</p>
          <h2 id="visit-dashboard-treasury-title">Treasury ledger</h2>
        </div>
        <p>Oldest first · running balance · {ledger.entryCount} {ledger.entryCount === 1 ? "entry" : "entries"}</p>
      </header>

      {ledger.entryCount ? (
        <div className="visit-dashboard-ledger-wrap visit-dashboard-ledger-wrap--tall" tabIndex={0} aria-label="Treasury ledger table">
          <table className="visit-dashboard-ledger-table visit-dashboard-treasury-table">
            <caption>Read-only treasury ledger with running balance</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Particulars</th>
                <th scope="col">Bill</th>
                <th scope="col" className="is-number">Receipts (₹)</th>
                <th scope="col" className="is-number">Payments (₹)</th>
                <th scope="col" className="is-number">Balance (₹)</th>
              </tr>
            </thead>
            {ledger.groups.map((group) => (
              <tbody key={group.monthKey}>
                <tr className="visit-dashboard-ledger-month">
                  <th scope="colgroup" colSpan={6}>{group.label}</th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.transactionId}>
                    <td className="is-date">{formatVisitDashboardDate(row.date) || row.date}</td>
                    <th scope="row" className="visit-dashboard-ledger-particulars">
                      <strong>{row.title}</strong>
                      {row.description && row.description !== row.title ? <span>{row.description}</span> : null}
                    </th>
                    <td className="visit-dashboard-bill-cell">
                      {row.billCanOpen && row.billOpenUrl ? (
                        <a
                          className="visit-dashboard-bill-link"
                          href={row.billOpenUrl}
                          aria-label={`View bill for ${row.title}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          View
                        </a>
                      ) : (
                        <span className="visit-dashboard-bill-empty" aria-label="No bill available">&mdash;</span>
                      )}
                    </td>
                    <td className="is-number is-receipt">{row.receipt === null ? "" : formatVisitLedgerAmount(row.receipt)}</td>
                    <td className="is-number is-payment">{row.payment === null ? "" : formatVisitLedgerAmount(row.payment)}</td>
                    <td className={`is-number is-balance${row.balance < 0 ? " is-negative" : ""}`}>{formatVisitLedgerAmount(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>Totals · closing balance</th>
                <td className="is-number is-receipt">{formatVisitLedgerAmount(ledger.totals.receipts)}</td>
                <td className="is-number is-payment">{formatVisitLedgerAmount(ledger.totals.payments)}</td>
                <td className={`is-number is-balance${ledger.totals.closing < 0 ? " is-negative" : ""}`}>{formatVisitLedgerAmount(ledger.totals.closing)}</td>
              </tr>
            </tfoot>
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
  const { visit, stats, documentPanels, attendance, fines, treasury, letterhead } = data;
  const glance = buildGlanceStats({ stats, attendance, treasury });
  const dataAsOf = formatVisitDashboardDateTime(data.generatedAt);

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
            <VisitingPanel names={visit.officialDisplayNames} />
          </div>
          <div className="visit-dashboard-masthead__actions">
            <a className="visit-dashboard-action-link" href="/access">
              Access page
            </a>
            <span className="visit-dashboard-readonly">Read-only</span>
            {dataAsOf ? <p className="visit-dashboard-asof">Data as of {dataAsOf}</p> : null}
          </div>
        </header>

        <SectionLinks showLetterhead={Boolean(letterhead)} />

        <ClubAtAGlance glance={glance} />

        <AvenueCounts rows={stats.avenueEventCounts} attendance={attendance} />

        <DocumentPanels panels={documentPanels} />

        <AttendanceRecords attendance={attendance} />

        {letterhead ? <LetterheadExchanges letterhead={letterhead} /> : null}

        <FinesRecords fines={fines} />

        <TreasuryLedger treasury={treasury} />
      </div>
    </main>
  );
}

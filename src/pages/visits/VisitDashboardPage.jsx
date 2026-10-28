import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import AttendanceMark from "../../components/status/AttendanceMark";
import useAccessibleDialog from "../../features/bod-tools/useAccessibleDialog";
import useAuth from "../../hooks/useAuth";
import CarrotField from "./CarrotField";
import {
  VISIT_ATTENDANCE_TABS,
  attendanceStatusLabel,
  buildGlanceStats,
  buildTreasuryLedger,
  buildVisitAttendanceTree,
  finesHasNotes,
  formatVisitAttendanceName,
  formatVisitAttendanceRoleCode,
  formatVisitDashboardDate,
  formatVisitDashboardDateTime,
  formatVisitDashboardFileSize,
  formatVisitDashboardMoney,
  formatVisitDocumentBlockFileCount,
  formatVisitDocumentRoleLabel,
  formatVisitLedgerAmount,
  getVisitDocumentFileKey,
  getVisitDocumentFileType,
  getVisitDocumentMainPresentations,
  getVisitDocumentPanelActionLabel,
  getVisitDocumentRoleCode,
  getVisitDocumentTileAriaLabel,
  getVisitDashboardErrorMessage,
  getVisitDashboardTheme,
  groupVisibleDocumentPanelsByPerson,
  isVisitDocumentMainPresentation,
  normalizeVisitDashboardData,
  orderVisitDocumentPanelFiles,
  parseOfficialDisplayName,
  pickDefaultVisitDocumentFileKey,
  splitVisitDashboardTitle,
  validVisitAttendanceTab,
  visitTypeFromSlug,
} from "../../features/visits/visitDashboardModel.js";
import { loadVisitDashboardData } from "../../features/visits/visitDashboardService.js";
import CollaborationMap from "../../features/collaborations/CollaborationMap.jsx";
import { buildCollaborationGeography } from "../../features/collaborations/collaborationGeography.js";
import { CITIES, findClub } from "../../features/collaborations/clubDirectory.js";
import { buildVisitPresentationSlides } from "../../features/visits/visitPresentationModel.js";
import { buildAttendanceTrend, buildAvenueMonthStrip } from "../../features/visits/visitTrendsModel.js";
import AttendanceTrendChart from "../../features/visits/AttendanceTrendChart.jsx";
import { buildVisitTreasuryBreakdowns } from "../../features/visits/visitTreasuryModel.js";

// Presentation mode loads only when someone presses Present.
const VisitPresentation = lazy(() => import("./VisitPresentation.jsx"));
const PRESENT_BUTTON_ID = "visit-dashboard-present";
import "../../styles/components/visit-dashboard.css";

const LOAD_STATUS = Object.freeze({
  loading: "loading",
  ready: "ready",
  error: "error",
});

function CarrotIcon({ className = "visit-dashboard-carrot-icon" }) {
  return (
    <svg className={className} width="16" height="20" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
      <path className="visit-dashboard-carrot-icon__leaf" d="M16 14 C10 4 6 4 5 1 C11 1 15 5 16 11 C17 4 20 1 27 0 C25 4 20 6 16 14Z" />
      <path className="visit-dashboard-carrot-icon__root" d="M6 14 H26 C26 24 20 34 16 40 C12 34 6 24 6 14Z" />
    </svg>
  );
}

function VisitEyebrow({ theme }) {
  return (
    <p className="visit-dashboard-eyebrow">
      {theme === "carrot" ? <CarrotIcon /> : null}
      Visit dashboard
    </p>
  );
}

function VisitTitle({ title, theme }) {
  const { lead, tail } = splitVisitDashboardTitle(title);
  if (theme !== "carrot" || !tail) return title;
  return (
    <>
      {lead} <span className="visit-dashboard-title-accent">{tail}</span>
    </>
  );
}

function VisitDashboardLoading({ title, theme }) {
  return (
    <main className="visit-dashboard-page" data-visit-theme={theme || undefined}>
      <section className="visit-dashboard-state" aria-labelledby="visit-dashboard-loading-title">
        <VisitEyebrow theme={theme} />
        <h1 id="visit-dashboard-loading-title"><VisitTitle title={title} theme={theme} /></h1>
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

function VisitDashboardError({ title, theme, onRetry }) {
  return (
    <main className="visit-dashboard-page" data-visit-theme={theme || undefined}>
      <section className="visit-dashboard-state" aria-labelledby="visit-dashboard-error-title">
        <VisitEyebrow theme={theme} />
        <h1 id="visit-dashboard-error-title"><VisitTitle title={title} theme={theme} /></h1>
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
  { id: "visit-dashboard-collaborations", label: "Collaborations", collaborations: true },
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

function SectionLinks({ showLetterhead, showCollaborations }) {
  return (
    <nav className="visit-dashboard-section-links" aria-label="Dashboard sections">
      {SECTION_LINKS.filter((link) => (showLetterhead || !link.letterhead) && (showCollaborations || !link.collaborations)).map((link) => (
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

function AttendanceTreeBar({ node, name }) {
  return (
    <div
      className="visit-dashboard-tree-bar"
      role="img"
      aria-label={node.rate === null ? `${name} attendance, no records yet` : `${name} attendance ${node.label}`}
    >
      {node.rate === null ? null : <span style={{ width: `${node.rate}%` }} />}
    </div>
  );
}

function AttendanceTreeNode({ area, level, kicker, note, node, name }) {
  return (
    <article className={`visit-dashboard-tree-node is-${area} is-level-${level}`}>
      <div className="visit-dashboard-tree-node__head">
        <p className="visit-dashboard-tree-kicker">{kicker}</p>
        {note ? <p className="visit-dashboard-tree-note">{note}</p> : null}
      </div>
      <p className="visit-dashboard-tree-value">{node.label}</p>
      <AttendanceTreeBar node={node} name={name} />
    </article>
  );
}

function AttendanceTree({ tree }) {
  return (
    <section className="visit-dashboard-attendance-tree" aria-labelledby="visit-dashboard-attendance-tree-title">
      <h3 id="visit-dashboard-attendance-tree-title">Attendance</h3>
      <div className="visit-dashboard-tree-grid">
        <AttendanceTreeNode area="overall" level={1} kicker="Overall attendance" note="GBMs + club events + BOD meetings" node={tree.overall} name="Overall" />
        <AttendanceTreeNode area="club" level={2} kicker="Overall › Club" note="GBMs + club events" node={tree.club} name="Club" />
        <AttendanceTreeNode area="board" level={2} kicker="Overall › Board" note="BOD meetings" node={tree.bod} name="Board" />
        <AttendanceTreeNode area="gbm" level={3} kicker="Club › GBMs" node={tree.gbm} name="GBM" />
        <AttendanceTreeNode area="events" level={3} kicker="Club › Events" node={tree.events} name="Club event" />
      </div>
    </section>
  );
}

function ClubAtAGlance({ glance, attendanceTree }) {
  const { members, events, treasury } = glance;
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

      <AttendanceTree tree={attendanceTree} />
    </section>
  );
}

function AvenueMonthStrip({ stats, attendance }) {
  const strip = useMemo(() => buildAvenueMonthStrip(stats, attendance, new Date()), [stats, attendance]);
  const { months, rows, totals } = strip;
  const range = months.length > 1 ? `${months[0].label} to ${months.at(-1).label}` : months[0].label;

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
        <p className="visit-dashboard-avenue-range">{range}, events per month</p>
      </header>

      {rows.length ? (
        <div className="visit-dashboard-avenue-strip" style={{ "--strip-months": months.length }}>
          <div className="visit-dashboard-avenue-strip__inner">
            <div className="visit-dashboard-avenue-strip__row is-head" aria-hidden="true">
              <span>Avenue</span>
              {months.map((month) => <span key={month.key}>{month.label}</span>)}
              <span>Total</span>
            </div>

            <ul className="visit-dashboard-avenue-list">
              {rows.map((row) => {
                const events = row.events;
                const eventCount = events.length;
                const monthSummary = months
                  .map((month, index) => (row.counts[index] ? `${row.counts[index]} in ${month.label}` : ""))
                  .filter(Boolean)
                  .join(", ");

                return (
                  <li key={row.avenueCode}>
                    <details className="visit-dashboard-avenue-disclosure">
                      <summary
                        className="visit-dashboard-avenue-strip__row"
                        aria-label={`${row.avenueName}: ${eventCount} ${eventCount === 1 ? "event" : "events"}${monthSummary ? ` (${monthSummary})` : ""}`}
                      >
                        <span className="visit-dashboard-avenue-chip__label">
                          <strong>{row.avenueName}</strong>
                          <small>{row.avenueCode}</small>
                        </span>

                        {row.counts.map((value, index) => (
                          <span
                            aria-hidden="true"
                            className={`visit-dashboard-avenue-cell is-level-${row.levels[index]}`}
                            key={months[index].key}
                          >
                            {value || "·"}
                          </span>
                        ))}

                        <span className="visit-dashboard-avenue-count-wrap" aria-hidden="true">
                          <b>{eventCount}</b>
                          <i>&gt;</i>
                        </span>
                      </summary>

                      <ul className="visit-dashboard-avenue-event-list">
                        {events.map((event) => (
                          <li key={event.eventId}>
                            <strong>{event.title}</strong>
                            <span>{event.date}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>

            <div className="visit-dashboard-avenue-strip__row is-total" aria-label={`Total: ${strip.total} events`}>
              <span>Total</span>
              {totals.map((value, index) => <span aria-hidden="true" key={months[index].key}>{value || "·"}</span>)}
              <span aria-hidden="true">{strip.total}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="visit-dashboard-empty-state">
          <strong>No avenue-wise events have been recorded yet.</strong>
        </div>
      )}
    </section>
  );
}

function PresentationIcon() {
  return (
    <svg className="visit-dashboard-doc-tile__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 4h18M4 4v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4M12 15v3M8 21l4-3 4 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentTile({ block, theme, onOpen }) {
  const mains = getVisitDocumentMainPresentations(block);
  const links = block.panels.flatMap(panel => panel.files.filter(file => file.sourceType === "link"));
  return (
    <button
      type="button"
      className="visit-dashboard-doc-tile"
      aria-label={getVisitDocumentTileAriaLabel(block)}
      onClick={(event) => {
        // Safari does not focus buttons on click; the viewer returns focus here.
        event.currentTarget.focus();
        onOpen(block.blockKey);
      }}
    >
      <span className="visit-dashboard-doc-tile__top">
        <strong className="visit-dashboard-doc-tile__name" title={block.title}>{block.title}</strong>
        <span className="visit-dashboard-doc-tile__count">{formatVisitDocumentBlockFileCount(block)}</span>
      </span>

      <span className="visit-dashboard-doc-tile__roles">
        {block.panels.map((panel) => {
          const code = getVisitDocumentRoleCode(panel);
          return (
            <span className="visit-dashboard-doc-tile__role" key={panel.positionKey}>
              {code ? <span className="visit-dashboard-role-code">{code}</span> : null}
              <span className="visit-dashboard-role-title">{panel.positionTitle}</span>
            </span>
          );
        })}
      </span>

      {/* Not every board member presents, so tiles without a main presentation show nothing here. */}
      {mains.length ? (
        <span className="visit-dashboard-doc-tile__main">
          {theme === "carrot" ? <CarrotIcon className="visit-dashboard-doc-tile__icon" /> : <PresentationIcon />}
          <span className="visit-dashboard-doc-tile__main-text">
            <span className="visit-dashboard-doc-tile__main-label">
              {mains.length === 1 ? "Main presentation" : `${mains.length} main presentations`}
            </span>
            {mains.map((file) => (
              <span className="visit-dashboard-doc-tile__main-title" key={file.submissionId}>{file.title}</span>
            ))}
          </span>
        </span>
      ) : null}
      {links.length ? <span className="visit-dashboard-doc-tile__main"><span className="visit-dashboard-doc-tile__main-text"><span className="visit-dashboard-doc-tile__main-label">Live links</span>{links.map(link => <span className="visit-dashboard-doc-tile__main-title" key={link.linkId}>{link.title}</span>)}</span></span> : null}
    </button>
  );
}

function DocumentTypeBadge({ file }) {
  const type = getVisitDocumentFileType(file);
  return <span className="visit-dashboard-doc-type" data-file-type={type}>{type}</span>;
}

function DocumentFolderLink({ panel }) {
  const actionLabel = getVisitDocumentPanelActionLabel(panel);
  if (!actionLabel) return null;
  return (
    <a
      className="visit-dashboard-folder-action"
      href={panel.openUrl}
      aria-label={`${actionLabel} for ${panel.positionTitle}`}
      rel="noopener noreferrer"
      target="_blank"
    >
      {actionLabel}
    </a>
  );
}

function DocumentOpenLink({ file }) {
  if (!file.canOpen || !file.openUrl) return null;
  return (
    <a
      className="visit-dashboard-document-action"
      href={file.openUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in new tab
    </a>
  );
}

function DocumentPreview({ panel, file }) {
  const [previewVersion, setPreviewVersion] = useState(0);
  const canPreview = Boolean(file.canPreview && file.previewUrl);
  const isLiveLink = file.sourceType === "link";
  return (
    <div className="visit-dashboard-doc-preview">
      <div className="visit-dashboard-doc-preview__head">
        <div className="visit-dashboard-doc-preview__title">
          <h3>{file.title}</h3>
          <span className="visit-dashboard-doc-preview__tags">
            <DocumentTypeBadge file={file} />
            {isLiveLink ? <span className="visit-dashboard-doc-main-pill">Live link</span> : null}
            {isVisitDocumentMainPresentation(panel, file) ? (
              <span className="visit-dashboard-doc-main-pill">Main presentation</span>
            ) : null}
          </span>
        </div>
        <div className="visit-dashboard-doc-viewer__nav">{canPreview && isLiveLink ? <button type="button" onClick={() => setPreviewVersion(value => value + 1)}>Refresh preview</button> : null}{canPreview ? <DocumentOpenLink file={file} /> : null}</div>
      </div>

      {isLiveLink && canPreview ? <p className="visit-dashboard-live-link-note">This opens the live Google document. Use Refresh preview for the latest changes, or open it in a new tab to edit. Google sharing permissions apply.</p> : null}

      {canPreview ? (
        <iframe
          className="visit-dashboard-document-preview-frame"
          key={`${file.previewUrl}:${previewVersion}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={file.previewUrl}
          title={`Preview of ${file.title}`}
        />
      ) : (
        <div className="visit-dashboard-doc-preview__none">
          <p>{isLiveLink ? "This link opens in a new tab." : "Preview not available for this file type."}</p>
          <DocumentOpenLink file={file} />
        </div>
      )}
    </div>
  );
}

function DocumentViewer({ block, position, total, previousBlock, nextBlock, onNavigate, onClose }) {
  const dialogRef = useAccessibleDialog({ open: true, onClose });
  const [selection, setSelection] = useState({ blockKey: "", fileKey: "" });
  const fileKey = selection.blockKey === block.blockKey ? selection.fileKey : pickDefaultVisitDocumentFileKey(block);
  const selected = block.panels
    .flatMap((panel) => panel.files.map((file) => ({ panel, file })))
    .find((entry) => getVisitDocumentFileKey(entry.panel, entry.file) === fileKey);
  const name = block.title;
  const canNavigate = total > 1;

  return (
    <div
      className="visit-dashboard-doc-viewer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="visit-dashboard-doc-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-dashboard-doc-viewer-title"
        tabIndex={-1}
      >
        <header className="visit-dashboard-doc-viewer__header">
          <div className="visit-dashboard-doc-viewer__who">
            <h2 id="visit-dashboard-doc-viewer-title">{name}</h2>
            <p>{block.panels.map(formatVisitDocumentRoleLabel).join(" | ")}</p>
          </div>
          <div className="visit-dashboard-doc-viewer__nav">
            <span className="visit-dashboard-doc-viewer__position">{position} of {total}</span>
            <button
              type="button"
              disabled={!canNavigate}
              aria-label={`Previous: ${previousBlock.title}`}
              onClick={() => onNavigate(previousBlock.blockKey)}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNavigate}
              aria-label={`Next: ${nextBlock.title}`}
              onClick={() => onNavigate(nextBlock.blockKey)}
            >
              Next
            </button>
            <button
              type="button"
              className="visit-dashboard-doc-viewer__close"
              aria-label="Close document viewer"
              onClick={onClose}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </header>

        <div className="visit-dashboard-doc-viewer__body">
          <div className="visit-dashboard-doc-rail">
            {block.panels.map((panel) => {
              const files = orderVisitDocumentPanelFiles(panel);
              const headingId = `visit-dashboard-doc-rail-${panel.positionKey}`;
              return (
                <section className="visit-dashboard-doc-rail__group" aria-labelledby={headingId} key={panel.positionKey}>
                  <div className="visit-dashboard-doc-rail__heading">
                    <h3 id={headingId}>{formatVisitDocumentRoleLabel(panel)}</h3>
                    <DocumentFolderLink panel={panel} />
                  </div>
                  {files.length ? (
                    <ul>
                      {files.map((file) => {
                        const key = getVisitDocumentFileKey(panel, file);
                        const current = key === fileKey;
                        const sizeLabel = formatVisitDashboardFileSize(file.fileSize);
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              className={current ? "visit-dashboard-doc-file is-selected" : "visit-dashboard-doc-file"}
                              aria-current={current ? "true" : undefined}
                              onClick={() => setSelection({ blockKey: block.blockKey, fileKey: key })}
                            >
                              <DocumentTypeBadge file={file} />
                              <span className="visit-dashboard-doc-file__title">{file.title}</span>
                              {file.sourceType === "link" ? <span className="visit-dashboard-doc-main-tag">LIVE LINK</span> : null}
                              {sizeLabel ? <span className="visit-dashboard-doc-file__size">{sizeLabel}</span> : null}
                              {isVisitDocumentMainPresentation(panel, file) ? (
                                <span className="visit-dashboard-doc-main-tag">MAIN</span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="visit-dashboard-doc-rail__empty">No visible documents uploaded for this folder yet.</p>
                  )}
                </section>
              );
            })}
          </div>

          <div className="visit-dashboard-doc-viewer__preview">
            {selected ? (
              <DocumentPreview panel={selected.panel} file={selected.file} />
            ) : (
              <div className="visit-dashboard-empty-state">
                <strong>No visible documents uploaded for these folders yet.</strong>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function DocumentPanels({ panels, theme }) {
  const [openBlockKey, setOpenBlockKey] = useState("");
  const hasPanels = panels.length > 0;
  const blocks = useMemo(() => groupVisibleDocumentPanelsByPerson(panels), [panels]);
  const openIndex = blocks.findIndex((block) => block.blockKey === openBlockKey);
  const closeViewer = useCallback(() => setOpenBlockKey(""), []);

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
        <div className="visit-dashboard-doc-grid">
          {blocks.map((block) => (
            <DocumentTile block={block} key={block.blockKey} theme={theme} onOpen={setOpenBlockKey} />
          ))}
        </div>
      )}

      {openIndex >= 0 ? (
        <DocumentViewer
          block={blocks[openIndex]}
          position={openIndex + 1}
          total={blocks.length}
          previousBlock={blocks[(openIndex - 1 + blocks.length) % blocks.length]}
          nextBlock={blocks[(openIndex + 1) % blocks.length]}
          onNavigate={setOpenBlockKey}
          onClose={closeViewer}
        />
      ) : null}
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
  const trend = useMemo(() => buildAttendanceTrend(attendance, new Date()), [attendance]);

  return (
    <details className="visit-dashboard-attendance" id="visit-dashboard-attendance" aria-labelledby="visit-dashboard-attendance-title">
      <summary>
        <span>
          <p className="visit-dashboard-eyebrow">Read-only</p>
          <h2 id="visit-dashboard-attendance-title">Attendance Records</h2>
        </span>
        <b>View</b>
      </summary>
      <AttendanceTrendChart trend={trend} />
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
      {typeof children === "function" ? children(open) : children}
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

const COLLABORATION_ROLE_LABELS = Object.freeze({
  host: "Host",
  cohost: "Co-host",
  collaborator: "Collaborator",
  participant: "Participant",
});

function CollaborationList({ rows }) {
  return (
    <details className="visit-dashboard-collab-list">
      <summary>
        <span className="visit-dashboard-records-chevron" aria-hidden="true" />
        View as a list
      </summary>
      <div className="visit-dashboard-ledger-wrap" tabIndex={0} aria-label="Collaborations table">
        <table className="visit-dashboard-ledger-table visit-dashboard-collab-table">
          <caption>Read-only collaborations this Rotary year</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Event</th>
              <th scope="col">RCPH role</th>
              <th scope="col">Partner clubs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.eventId}>
                <td className="is-date">{formatVisitDashboardDate(row.date)}</td>
                <th scope="row">{row.name}</th>
                <td>{COLLABORATION_ROLE_LABELS[row.rcphRole]}</td>
                <td>
                  <ul className="visit-dashboard-collab-partners">
                    {row.partners.map((partner) => {
                      const club = findClub(partner.name);
                      return (
                        <li key={partner.name}>
                          {partner.name}
                          {partner.relation === "host" ? <em> (host)</em> : null}
                          <small>{club ? `${club.district} · ${CITIES[club.cityKey].city}` : "Location not set"}</small>
                        </li>
                      );
                    })}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Collaborations({ collaborations }) {
  const { rows } = collaborations;
  const geography = useMemo(() => buildCollaborationGeography(rows), [rows]);
  const { summary } = geography;

  return (
    <RecordsDisclosure
      id="visit-dashboard-collaborations"
      className="visit-dashboard-collaborations"
      titleId="visit-dashboard-collaborations-title"
      title="Collaborations"
      meta={(
        <>
          <span>{summary.eventCount} {summary.eventCount === 1 ? "event" : "events"}</span>
          <span>{summary.clubCount} {summary.clubCount === 1 ? "club" : "clubs"}</span>
          <span>{summary.districtCount} {summary.districtCount === 1 ? "district" : "districts"}</span>
        </>
      )}
    >
      {(open) => (rows.length ? (
        <div className="visit-dashboard-collab-body">
          {/* The map and its outlines load only once the section is opened. */}
          {open ? (
            <CollaborationMap geography={geography} formatDate={formatVisitDashboardDate} />
          ) : null}
          {geography.unplaced.length ? (
            <p className="visit-dashboard-collab-note">
              Not on the map yet: {geography.unplaced.map((club) => club.name).join(", ")}.
            </p>
          ) : null}
          <CollaborationList rows={rows} />
        </div>
      ) : (
        <div className="visit-dashboard-empty-state">
          <strong>No collaborations recorded yet this Rotary year.</strong>
        </div>
      ))}
    </RecordsDisclosure>
  );
}

function FinesRecords({ fines }) {
  const showNotes = finesHasNotes(fines.rows);
  const columnCount = showNotes ? 8 : 7;
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
                <th scope="col">Proof</th>
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
                    <td className="visit-dashboard-bill-cell">
                      {fine.proofCanOpen && fine.proofOpenUrl ? (
                        <a
                          className="visit-dashboard-bill-link"
                          href={fine.proofOpenUrl}
                          aria-label={`View payment proof for ${formatVisitAttendanceName(fine.memberName)}, ${fine.date}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          View
                        </a>
                      ) : (
                        <span className="visit-dashboard-bill-empty" aria-label="No payment proof">&mdash;</span>
                      )}
                    </td>
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

function TreasuryLedgerTable({ ledger, label, runningBalance = false }) {
  const columns = runningBalance ? 9 : 8;
  if (!ledger.entryCount) return <div className="visit-dashboard-empty-state"><strong>No treasury records are available yet.</strong></div>;
  return (
    <div className="visit-dashboard-ledger-wrap visit-dashboard-ledger-wrap--tall" tabIndex={0} aria-label={label}>
      <table className="visit-dashboard-ledger-table visit-dashboard-treasury-table">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Particulars</th>
            <th scope="col">Avenue</th>
            <th scope="col">Event</th>
            <th scope="col">Bill</th>
            <th scope="col">Bank proof</th>
            <th scope="col" className="is-number">Receipts (₹)</th>
            <th scope="col" className="is-number">Payments (₹)</th>
            {runningBalance ? <th scope="col" className="is-number">Balance (₹)</th> : null}
          </tr>
        </thead>
        {ledger.groups.map((group) => (
          <tbody key={group.monthKey}>
            <tr className="visit-dashboard-ledger-month"><th scope="colgroup" colSpan={columns}>{group.label}</th></tr>
            {group.rows.map((row) => (
              <tr key={row.transactionId}>
                <td className="is-date">{formatVisitDashboardDate(row.date) || row.date}</td>
                <th scope="row" className="visit-dashboard-ledger-particulars">
                  <strong>{row.title}</strong>
                  {row.description && row.description !== row.title ? <small>{row.description}</small> : null}
                  {row.spentDate ? <small>Spent {formatVisitDashboardDate(row.spentDate) || row.spentDate}, repaid on this date</small> : null}
                  {row.paymentMode ? <small>{row.paymentMode}{row.referenceNumber ? ` · Ref: ${row.referenceNumber}` : ""}</small> : null}
                  {row.reimbursementStatus && row.reimbursementStatus !== "Not Applicable" ? <small>Reimbursement: {row.reimbursementStatus}</small> : null}
                </th>
                <td>{row.avenueName || row.avenueCode || "Other"}</td>
                <td>{row.eventName || (row.eventId ? "Linked event" : "Not linked to an event")}</td>
                <td className="visit-dashboard-bill-cell">
                  {row.billCanOpen && row.billOpenUrl ? (
                    <a className="visit-dashboard-bill-link" href={row.billOpenUrl} aria-label={`View bill for ${row.title}`} rel="noopener noreferrer" target="_blank">View</a>
                  ) : <span className="visit-dashboard-bill-empty" aria-label="No bill available">&mdash;</span>}
                </td>
                <td className="visit-dashboard-bill-cell">
                  {row.bankProofs?.length ? (
                    <ul className="visit-dashboard-bank-proofs">
                      {row.bankProofs.map((proof, index) => (
                        <li key={`${proof.openUrl}-${index}`}><a className="visit-dashboard-bill-link" href={proof.openUrl} aria-label={`View bank proof ${index + 1} for ${row.title}: ${proof.label}`} rel="noopener noreferrer" target="_blank">{row.bankProofs.length > 1 ? `Proof ${index + 1}` : "View"}</a></li>
                      ))}
                    </ul>
                  ) : <span className="visit-dashboard-bill-empty" aria-label="No bank proof available">&mdash;</span>}
                </td>
                <td className="is-number is-receipt">{row.receipt === null ? "" : formatVisitLedgerAmount(row.receipt)}</td>
                <td className="is-number is-payment">{row.payment === null ? "" : formatVisitLedgerAmount(row.payment)}</td>
                {runningBalance ? <td className={`is-number is-balance${row.balance < 0 ? " is-negative" : ""}`}>{formatVisitLedgerAmount(row.balance)}</td> : null}
              </tr>
            ))}
          </tbody>
        ))}
        <tfoot>
          <tr>
            <th scope="row" colSpan={6}>{runningBalance ? "Totals · closing balance" : "Totals"}</th>
            <td className="is-number is-receipt">{formatVisitLedgerAmount(ledger.totals.receipts)}</td>
            <td className="is-number is-payment">{formatVisitLedgerAmount(ledger.totals.payments)}</td>
            {runningBalance ? <td className={`is-number is-balance${ledger.totals.closing < 0 ? " is-negative" : ""}`}>{formatVisitLedgerAmount(ledger.totals.closing)}</td> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TreasuryTotals({ ledger }) {
  return <><span>{ledger.entryCount} {ledger.entryCount === 1 ? "entry" : "entries"}</span><span>In {rupees(ledger.totals.receipts)}</span><span>Out {rupees(ledger.totals.payments)}</span><span>Net {rupees(ledger.totals.closing)}</span></>;
}

function TreasuryLedger({ treasury }) {
  const ledger = buildTreasuryLedger(treasury.rows);
  return (
    <RecordsDisclosure id="visit-dashboard-treasury" className="visit-dashboard-treasury" titleId="visit-dashboard-treasury-title" title="Treasury ledger" meta={<TreasuryTotals ledger={ledger} />}>
      {(open) => open ? <TreasuryLedgerTable ledger={ledger} label="Read-only treasury ledger with running balance" runningBalance /> : null}
    </RecordsDisclosure>
  );
}

const TREASURY_CATEGORIES = [
  { key: "ledger", label: "Treasury Ledger" },
  { key: "flows", label: "Income/Expense" },
  { key: "avenues", label: "Avenue wise" },
  { key: "months", label: "Month Wise" },
];

function TreasuryWorkspace({ treasury }) {
  const reports = useMemo(() => buildVisitTreasuryBreakdowns(treasury.rows), [treasury.rows]);
  const ledger = useMemo(() => buildTreasuryLedger(treasury.rows), [treasury.rows]);
  const [category, setCategory] = useState(null);
  const [openViews, setOpenViews] = useState({ flows: [], avenues: [], months: [] });
  const options = {
    flows: [
      { key: "income", title: "Income Transactions", ledger: reports.income },
      { key: "expense", title: "Expense Transactions", ledger: reports.expense },
    ],
    avenues: reports.avenues.map((avenue) => ({ key: avenue.code, title: avenue.label, ledger: avenue.ledger })),
    months: [
      { key: "income", title: "Income", panelTitle: "Month-wise income", ledger: reports.income, months: reports.incomeMonths },
      { key: "expense", title: "Expense", panelTitle: "Month-wise expenses", ledger: reports.expense, months: reports.expenseMonths },
    ],
  };
  const choices = options[category] || [];
  const opened = (openViews[category] || []).filter((key) => choices.some((view) => view.key === key));
  const panels = category === "ledger"
    ? [{ key: "ledger", title: "Treasury Ledger", ledger, runningBalance: true }]
    : opened.map((key) => choices.find((view) => view.key === key));
  const buttonId = (key) => `visit-finance-button-${category}-${encodeURIComponent(key)}`;
  const panelId = (key) => `visit-finance-panel-${category}-${encodeURIComponent(key)}`;

  function toggleView(key) {
    setOpenViews((current) => {
      const valid = current[category].filter((id) => choices.some((view) => view.key === id));
      return { ...current, [category]: valid.includes(key) ? valid.filter((id) => id !== key) : [...valid, key] };
    });
  }

  function closePanel(key) {
    if (category === "ledger") {
      setCategory(null);
      document.getElementById("visit-finance-category-ledger")?.focus();
    } else {
      toggleView(key);
      document.getElementById(buttonId(key))?.focus();
    }
  }

  return (
    <section id="visit-dashboard-treasury" tabIndex={-1} className="visit-dashboard-finance-switcher" aria-labelledby="visit-dashboard-treasury-title">
      <header className="visit-dashboard-finance-heading">
        <h2 id="visit-dashboard-treasury-title">Treasury Panel</h2>
      </header>
      <div className="visit-dashboard-finance-buttons visit-dashboard-finance-main-buttons" role="group" aria-label="Treasury sections">
        {TREASURY_CATEGORIES.map((item) => (
          <button key={item.key} id={`visit-finance-category-${item.key}`} type="button" className="visit-dashboard-finance-button" aria-pressed={category === item.key} aria-expanded={category === item.key} aria-controls="visit-finance-content" onClick={() => setCategory((current) => current === item.key ? null : item.key)}>
            <strong>{item.key === "flows" ? <>Income/<wbr />Expense</> : item.label}</strong>
          </button>
        ))}
      </div>
      <div id="visit-finance-content" hidden={!category}>
        {category && category !== "ledger" ? (
          <div className="visit-dashboard-finance-subcontrols">
            <div className="visit-dashboard-finance-subbuttons" role="group" aria-label={`${TREASURY_CATEGORIES.find((item) => item.key === category).label} views`}>
              {choices.map((view) => (
                <button key={view.key} id={buttonId(view.key)} type="button" className="visit-dashboard-finance-button" aria-pressed={opened.includes(view.key)} aria-expanded={opened.includes(view.key)} aria-controls={opened.includes(view.key) ? panelId(view.key) : undefined} onClick={() => toggleView(view.key)}>
                  <strong>{view.title}</strong>
                  <small>{view.ledger.entryCount} {view.ledger.entryCount === 1 ? "entry" : "entries"}</small>
                </button>
              ))}
            </div>
            {category === "avenues" ? (
              <div className="visit-dashboard-finance-bulk-actions">
                <button type="button" className="visit-dashboard-action-link" disabled={opened.length === choices.length} onClick={() => setOpenViews((current) => ({ ...current, avenues: [...opened, ...choices.map((view) => view.key).filter((key) => !opened.includes(key))] }))}>Open all</button>
                <button type="button" className="visit-dashboard-action-link" disabled={!opened.length} onClick={() => setOpenViews((current) => ({ ...current, avenues: [] }))}>Close all</button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="visit-dashboard-finance-panels">
          {panels.map((view) => (
            <section key={`${category}:${view.key}`} id={panelId(view.key)} className="visit-dashboard-finance-panel" aria-labelledby={`${panelId(view.key)}-title`}>
              <header className="visit-dashboard-finance-panel-heading">
                <div>
                  <h2 id={`${panelId(view.key)}-title`}>{view.panelTitle || view.title}</h2>
                  <span className="visit-dashboard-records-meta"><TreasuryTotals ledger={view.ledger} /></span>
                </div>
                <button type="button" className="visit-dashboard-action-link" onClick={() => closePanel(view.key)}>Close view</button>
              </header>
              {view.months ? (
                <div className="visit-dashboard-finance-groups">
                  {view.months.length ? view.months.map((month) => (
                    <section key={month.monthKey} className="visit-dashboard-finance-month" aria-label={month.label}>
                      <h3>{month.label}</h3>
                      <span className="visit-dashboard-records-meta"><TreasuryTotals ledger={month.ledger} /></span>
                      <TreasuryLedgerTable ledger={month.ledger} label={`${view.panelTitle}: ${month.label}`} />
                    </section>
                  )) : <p className="visit-dashboard-finance-note">No transactions recorded yet.</p>}
                </div>
              ) : <TreasuryLedgerTable ledger={view.ledger} label={view.title} runningBalance={view.runningBalance} />}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function VisitDashboardPage() {
  const { visitSlug = "" } = useParams();
  const { user } = useAuth();
  const visitType = visitTypeFromSlug(visitSlug);
  const theme = getVisitDashboardTheme(visitType);
  const fallbackData = useMemo(
    () => normalizeVisitDashboardData(null, visitType),
    [visitType],
  );
  const loadControl = useRef({ request: 0, activeScope: null });
  const scope = `${user?.uid || ""}:${visitType}`;
  const [loadState, setLoadState] = useState({
    status: LOAD_STATUS.loading,
    data: null,
    error: null,
  });

  const loadDashboard = useCallback(async () => {
    const control = loadControl.current;
    if (control.activeScope === scope) return;
    control.activeScope = scope;
    const request = ++control.request;
    if (!user?.uid || !visitType) {
      control.activeScope = null;
      setLoadState({ scope, status: LOAD_STATUS.error, data: null, error: new Error("Visit dashboard unavailable.") });
      return;
    }

    setLoadState((current) => ({
      scope,
      status: LOAD_STATUS.loading,
      data: current.scope === scope ? current.data : null,
      error: null,
    }));

    try {
      const data = await loadVisitDashboardData(user.uid, visitType);
      if (request === control.request) setLoadState({ scope, status: LOAD_STATUS.ready, data, error: null });
    } catch (error) {
      const accessDenied = ["functions/permission-denied", "functions/unauthenticated"].includes(error?.code);
      if (request === control.request) setLoadState((current) => ({ ...current, status: LOAD_STATUS.error, data: accessDenied ? null : current.data, error }));
    } finally {
      if (request === control.request) control.activeScope = null;
    }
  }, [user?.uid, visitType, scope]);

  useEffect(() => {
    const control = loadControl.current;
    loadDashboard();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") loadDashboard();
    };
    // Visit viewers use the protected callable; they cannot subscribe to Admin Treasury.
    const timer = window.setInterval(refreshVisible, 60_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      ++control.request;
      control.activeScope = null;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [loadDashboard]);

  const currentData = loadState.scope === scope ? loadState.data : null;
  const data = currentData || fallbackData;
  const { visit, stats, documentPanels, attendance, fines, treasury, letterhead, collaborations } = data;
  const glance = buildGlanceStats({ stats, treasury });
  const attendanceTree = buildVisitAttendanceTree(attendance);
  const dataAsOf = formatVisitDashboardDateTime(data.generatedAt);
  const [presenting, setPresenting] = useState(false);
  // Built when Present is pressed, so slides follow the latest data and main presentations.
  const slides = useMemo(() => (presenting ? buildVisitPresentationSlides(data) : []), [presenting, data]);
  const closePresentation = useCallback(() => {
    setPresenting(false);
    document.getElementById(PRESENT_BUTTON_ID)?.focus();
  }, []);

  if (!currentData && (loadState.status === LOAD_STATUS.loading || loadState.scope !== scope)) {
    return <VisitDashboardLoading title={visit.title} theme={theme} />;
  }

  if (loadState.status === LOAD_STATUS.error && !currentData) {
    return <VisitDashboardError title={visit.title} theme={theme} onRetry={loadDashboard} />;
  }

  return (
    <main className="visit-dashboard-page" data-visit-theme={theme || undefined}>
      {theme === "carrot" ? <CarrotField /> : null}
      <div className="visit-dashboard-shell">
        <header className="visit-dashboard-masthead" aria-labelledby="visit-dashboard-title">
          <div>
            <VisitEyebrow theme={theme} />
            <h1 id="visit-dashboard-title"><VisitTitle title={visit.title} theme={theme} /></h1>
            <p className="visit-dashboard-intro">Welcome District Officials</p>
            <VisitingPanel names={visit.officialDisplayNames} />
          </div>
          <div className="visit-dashboard-masthead__actions">
            <button
              id={PRESENT_BUTTON_ID}
              type="button"
              className="visit-dashboard-present-button"
              onClick={() => setPresenting(true)}
            >
              Present
            </button>
            <button type="button" className="visit-dashboard-action-link" onClick={loadDashboard} disabled={loadState.status === LOAD_STATUS.loading}>
              {loadState.status === LOAD_STATUS.loading ? "Refreshing…" : "Refresh data"}
            </button>
            <a className="visit-dashboard-action-link" href="/access">
              Access page
            </a>
            <span className="visit-dashboard-readonly">Read-only</span>
            {dataAsOf ? <p className="visit-dashboard-asof">Data as of {dataAsOf}</p> : null}
          </div>
        </header>

        {loadState.status === LOAD_STATUS.error ? <p className="visit-dashboard-refresh-error" role="status">Could not refresh. Showing the last loaded data; use Refresh data to try again.</p> : null}

        <SectionLinks showLetterhead={Boolean(letterhead)} showCollaborations={Boolean(collaborations)} />

        <ClubAtAGlance glance={glance} attendanceTree={attendanceTree} />

        <AvenueMonthStrip stats={stats} attendance={attendance} />

        <DocumentPanels panels={documentPanels} theme={theme} />

        <AttendanceRecords attendance={attendance} />

        {letterhead ? <LetterheadExchanges letterhead={letterhead} /> : null}

        {collaborations ? <Collaborations collaborations={collaborations} /> : null}

        <FinesRecords fines={fines} />

        <div className="visit-dashboard-treasury-area">
          {visitType === "dzrVisit" ? <TreasuryWorkspace treasury={treasury} /> : <TreasuryLedger treasury={treasury} />}
        </div>
      </div>

      {presenting ? (
        <Suspense fallback={null}>
          <VisitPresentation slides={slides} onClose={closePresentation} />
        </Suspense>
      ) : null}
    </main>
  );
}

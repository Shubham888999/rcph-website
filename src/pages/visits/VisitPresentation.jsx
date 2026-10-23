import { useCallback, useEffect, useRef, useState } from "react";
import CollaborationMap from "../../features/collaborations/CollaborationMap.jsx";
import {
  formatVisitAttendanceName,
  formatVisitDashboardDate,
  formatVisitDashboardMoney,
  formatVisitLedgerAmount,
} from "../../features/visits/visitDashboardModel.js";
import "../../styles/components/visit-presentation.css";

const FINE_STATUS_LABELS = Object.freeze({ paid: "Paid", pending: "Pending", waived: "Waived", unknown: "Unknown" });
const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

function rupees(value) {
  return `₹${formatVisitLedgerAmount(value)}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// Counts up to `value` once, writing straight to the DOM so the slide does not re-render every frame.
function CountUp({ value, format = (number) => Math.round(number).toLocaleString("en-IN") }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const target = Number(value) || 0;
    if (prefersReducedMotion() || target === 0) {
      element.textContent = format(target);
      return undefined;
    }

    const duration = 1100;
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = format(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, format]);

  return <span ref={ref}>{format(0)}</span>;
}

function SlideHeading({ eyebrow, title }) {
  return (
    <header className="visit-present__heading">
      {eyebrow ? <p className="visit-present__eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
    </header>
  );
}

function WelcomeSlide({ slide }) {
  return (
    <div className="visit-present__center">
      <p className="visit-present__eyebrow">{slide.visitName}</p>
      <h2 className="visit-present__display">{slide.title}</h2>
      <p className="visit-present__sub">RID 3131 · Zone 4 · {todayLabel()}</p>
      {slide.officials.length ? (
        <ul className="visit-present__officials" aria-label="Visiting panel">
          {slide.officials.map((official) => (
            <li key={`${official.name}-${official.role}`}>
              <strong>{official.name}</strong>
              {official.role ? <span>{official.role}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="visit-present__theme">Lakshya · Shaping Aim Through Experience</p>
    </div>
  );
}

function GlanceSlide({ slide }) {
  const { members, events, treasury } = slide.glance;
  return (
    <>
      <SlideHeading eyebrow="Overview" title={slide.title} />
      <div className="visit-present__tiles">
        <article className="visit-present__tile">
          <h3>Members</h3>
          <p className="visit-present__number"><CountUp value={members.total} /></p>
          <p>{members.line}</p>
        </article>
        <article className="visit-present__tile">
          <h3>Events held</h3>
          <p className="visit-present__number"><CountUp value={events.total} /></p>
          <p>{events.line}</p>
        </article>
        <article className="visit-present__tile">
          <h3>Treasury balance</h3>
          <p className={`visit-present__number${treasury.negative ? " is-negative" : ""}`}>
            <CountUp value={treasury.net} format={formatVisitDashboardMoney} />
          </p>
          <p>{treasury.line}</p>
        </article>
      </div>
    </>
  );
}

const ATTENDANCE_NODES = [
  { key: "overall", label: "Overall", note: "GBMs, club events and BOD meetings" },
  { key: "club", label: "Club", note: "GBMs and club events" },
  { key: "bod", label: "Board", note: "BOD meetings" },
  { key: "gbm", label: "GBMs" },
  { key: "events", label: "Club events" },
];

function Bar({ share }) {
  return (
    <span className="visit-present__bar" aria-hidden="true">
      {share === null ? null : <span style={{ transform: `scaleX(${Math.max(0, Math.min(100, share)) / 100})` }} />}
    </span>
  );
}

function AttendanceSlide({ slide }) {
  return (
    <>
      <SlideHeading eyebrow="Overview" title={slide.title} />
      <div className="visit-present__attendance">
        {ATTENDANCE_NODES.map((node) => {
          const value = slide.tree[node.key];
          return (
            <article key={node.key} className={`visit-present__tile is-${node.key}`}>
              <h3>{node.label}</h3>
              {node.note ? <p className="visit-present__note">{node.note}</p> : null}
              <p className="visit-present__number">{value.label}</p>
              <Bar share={value.rate} />
            </article>
          );
        })}
      </div>
    </>
  );
}

function AvenuesSlide({ slide }) {
  return (
    <>
      <SlideHeading eyebrow="Club activity" title={slide.title} />
      <ul className="visit-present__avenues">
        {slide.rows.map((row) => (
          <li key={row.avenueCode}>
            <span className="visit-present__avenue-name">{row.avenueName}</span>
            <Bar share={row.share} />
            <strong>{row.eventCount}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function CollaborationsSlide({ slide }) {
  const { summary } = slide.geography;
  return (
    <>
      <SlideHeading
        eyebrow={`${plural(summary.eventCount, "event")} · ${plural(summary.clubCount, "club")} · ${plural(summary.districtCount, "district")}`}
        title={slide.title}
      />
      <div className="visit-present__map">
        <CollaborationMap geography={slide.geography} formatDate={formatVisitDashboardDate} />
      </div>
    </>
  );
}

function LetterheadSlide({ slide }) {
  const clubs = [...new Set(slide.rows.flatMap((row) => row.externalParticipants.map((participant) => participant.clubName)).filter(Boolean))];
  return (
    <>
      <SlideHeading eyebrow="Club relations" title={slide.title} />
      <div className="visit-present__tiles is-two">
        <article className="visit-present__tile">
          <h3>Exchanges</h3>
          <p className="visit-present__number"><CountUp value={slide.summary.count} /></p>
        </article>
        <article className="visit-present__tile">
          <h3>Clubs</h3>
          <p className="visit-present__number"><CountUp value={slide.summary.clubCount} /></p>
        </article>
      </div>
      {clubs.length ? (
        <ul className="visit-present__chips">
          {clubs.map((club) => <li key={club}>{club}</li>)}
        </ul>
      ) : null}
    </>
  );
}

function DirectorSlide({ slide }) {
  return (
    <div className="visit-present__director">
      <header className="visit-present__director-head">
        <div>
          <p className="visit-present__eyebrow">{slide.role}</p>
          <h2>{slide.title}</h2>
        </div>
        {slide.file.openUrl ? (
          <a className="visit-present__link" href={slide.file.openUrl} target="_blank" rel="noopener noreferrer">
            Open in new tab
          </a>
        ) : null}
      </header>
      {/* Keyed by file so a changed deck reloads; only the current slide's deck is mounted. */}
      <iframe
        key={slide.file.previewUrl}
        className="visit-present__deck"
        src={slide.file.previewUrl}
        title={`${slide.title}, ${slide.role}: ${slide.file.title}`}
        referrerPolicy="no-referrer-when-downgrade"
        allow="fullscreen"
      />
    </div>
  );
}

function FinesSlide({ slide }) {
  const { summary } = slide;
  return (
    <>
      <SlideHeading
        eyebrow={`${plural(summary.totalFines, "fine")} · ${formatVisitDashboardMoney(summary.collectedAmount)} collected · ${formatVisitDashboardMoney(summary.pendingAmount)} pending`}
        title={slide.title}
      />
      {slide.rows.length ? (
        <table className="visit-present__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Member</th>
              <th scope="col">Reason</th>
              <th scope="col" className="is-number">Amount</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {slide.rows.map((fine) => (
              <tr key={fine.fineKey}>
                <td>{formatVisitDashboardDate(fine.date) || fine.date}</td>
                <th scope="row">{formatVisitAttendanceName(fine.memberName)}</th>
                <td>{fine.title && fine.title !== fine.reason ? `${fine.reason} · ${fine.title}` : fine.reason}</td>
                <td className="is-number">{rupees(fine.amount)}</td>
                <td>{FINE_STATUS_LABELS[fine.status] || FINE_STATUS_LABELS.unknown}</td>
              </tr>
            ))}
          </tbody>
          {slide.isLastPage ? (
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>Total</th>
                <td className="is-number">{rupees(summary.totalAmount)}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      ) : (
        <p className="visit-present__empty">No fines have been recorded yet.</p>
      )}
    </>
  );
}

function TreasurySlide({ slide }) {
  const { totals } = slide;
  return (
    <>
      <SlideHeading
        eyebrow={`Receipts ${rupees(totals.receipts)} · Payments ${rupees(totals.payments)} · Closing balance ${rupees(totals.closing)}`}
        title={slide.title}
      />
      {slide.rows.length ? (
        <table className="visit-present__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Particulars</th>
              <th scope="col" className="is-number">Receipts</th>
              <th scope="col" className="is-number">Payments</th>
              <th scope="col" className="is-number">Balance</th>
            </tr>
          </thead>
          <tbody>
            {slide.rows.map((row) => (
              <tr key={row.transactionId}>
                <td>{formatVisitDashboardDate(row.date) || row.date}</td>
                <th scope="row">{row.title}</th>
                <td className="is-number">{row.receipt === null ? "" : formatVisitLedgerAmount(row.receipt)}</td>
                <td className="is-number">{row.payment === null ? "" : formatVisitLedgerAmount(row.payment)}</td>
                <td className={`is-number${row.balance < 0 ? " is-negative" : ""}`}>{formatVisitLedgerAmount(row.balance)}</td>
              </tr>
            ))}
          </tbody>
          {slide.isLastPage ? (
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>Totals · closing balance</th>
                <td className="is-number">{formatVisitLedgerAmount(totals.receipts)}</td>
                <td className="is-number">{formatVisitLedgerAmount(totals.payments)}</td>
                <td className={`is-number${totals.closing < 0 ? " is-negative" : ""}`}>{formatVisitLedgerAmount(totals.closing)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      ) : (
        <p className="visit-present__empty">No treasury records are available yet.</p>
      )}
    </>
  );
}

function ThanksSlide() {
  return (
    <div className="visit-present__center">
      <h2 className="visit-present__display">Thank you</h2>
      <p className="visit-present__sub">Rotaract Club of Pune Heritage · RID 3131</p>
      <p className="visit-present__theme">Lakshya · Shaping Aim Through Experience</p>
    </div>
  );
}

const SLIDE_COMPONENTS = {
  welcome: WelcomeSlide,
  glance: GlanceSlide,
  attendance: AttendanceSlide,
  avenues: AvenuesSlide,
  collaborations: CollaborationsSlide,
  letterhead: LetterheadSlide,
  director: DirectorSlide,
  fines: FinesSlide,
  treasury: TreasurySlide,
  thanks: ThanksSlide,
};

function slideListLabel(slide) {
  return slide.kind === "director" ? `${slide.title} · ${slide.role}` : slide.title;
}

// Full screen slides built from the visit dashboard data. Keys: arrows, Space, PageUp/PageDown
// (presentation clickers), Home/End, Esc to leave. While a director's deck has focus, its own
// keys drive the deck; use the on-screen buttons to move between slides.
export default function VisitPresentation({ slides, onClose }) {
  const rootRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastIndex = slides.length - 1;
  const slide = slides[Math.min(index, lastIndex)];
  const SlideBody = SLIDE_COMPONENTS[slide.kind];

  const go = useCallback((target) => {
    setIndex(Math.max(0, Math.min(lastIndex, target)));
    setListOpen(false);
  }, [lastIndex]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    rootRef.current?.focus();
    rootRef.current?.requestFullscreen?.().catch(() => {});

    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);

    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("fullscreenchange", syncFullscreen);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, a") && (event.key === " " || event.key === "Enter")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (listOpen) setListOpen(false);
        else onClose();
      } else if (NEXT_KEYS.has(event.key)) {
        event.preventDefault();
        go(index + 1);
      } else if (PREVIOUS_KEYS.has(event.key)) {
        event.preventDefault();
        go(index - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        go(0);
      } else if (event.key === "End") {
        event.preventDefault();
        go(lastIndex);
      } else if (event.key === "f" || event.key === "F") {
        toggleFullscreen();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [go, index, lastIndex, listOpen, onClose, toggleFullscreen]);

  return (
    <div
      ref={rootRef}
      className="visit-present"
      role="dialog"
      aria-modal="true"
      aria-label="Visit presentation"
      tabIndex={-1}
    >
      <div className="visit-present__progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${(index + 1) / slides.length})` }} />
      </div>

      <section
        key={slide.key}
        className={`visit-present__slide is-${slide.kind}`}
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${slides.length}: ${slideListLabel(slide)}`}
      >
        <SlideBody slide={slide} />
      </section>

      <footer className="visit-present__controls">
        <button type="button" className="visit-present__button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">
          ‹
        </button>
        <span className="visit-present__counter" aria-live="polite">
          {index + 1} / {slides.length}
        </span>
        <button type="button" className="visit-present__button" onClick={() => go(index + 1)} disabled={index === lastIndex} aria-label="Next slide">
          ›
        </button>
        <button type="button" className="visit-present__button is-text" aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
          Slides
        </button>
        <button type="button" className="visit-present__button is-text" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit full screen" : "Full screen"}
        </button>
        <button type="button" className="visit-present__button is-text" onClick={onClose}>
          Exit
        </button>
      </footer>

      {listOpen ? (
        <nav className="visit-present__list" aria-label="All slides">
          <ol>
            {slides.map((item, itemIndex) => (
              <li key={item.key}>
                <button type="button" aria-current={itemIndex === index ? "true" : undefined} onClick={() => go(itemIndex)}>
                  <span>{itemIndex + 1}</span>
                  {slideListLabel(item)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}

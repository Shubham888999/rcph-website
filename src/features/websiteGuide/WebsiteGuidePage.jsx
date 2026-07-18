import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import {
  getFirstGuideFeatureId,
  getGuideEntry,
  getGuideFeatureOptions,
  getGuideRoleLabel,
  getGuideRoleOptions,
  getInitialGuideSelection,
} from "./websiteGuideModel";
import "../../styles/components/website-guide.css";

const revealItem = {
  hidden: { opacity: 1, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
};

const ruleReveal = {
  hidden: { scaleX: 0.15 },
  visible: { scaleX: 1, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

export default function WebsiteGuidePage() {
  const { access } = useAuth();
  const reduceMotion = useReducedMotion();
  const initialSelection = useMemo(() => getInitialGuideSelection(access), [access]);
  const [roleId, setRoleId] = useState(initialSelection.roleId);
  const [featureId, setFeatureId] = useState(initialSelection.featureId);
  const roleOptions = getGuideRoleOptions();
  const featureOptions = useMemo(() => getGuideFeatureOptions(roleId), [roleId]);
  const selectedEntry = getGuideEntry(roleId, featureId);
  const roleLabel = getGuideRoleLabel(roleId);

  function changeRole(event) {
    const nextRoleId = event.target.value;
    setRoleId(nextRoleId);
    setFeatureId(getFirstGuideFeatureId(nextRoleId));
  }

  return (
    <main className="website-guide-page">
      <motion.section
        className="website-guide-shell"
        aria-labelledby="website-guide-title"
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      >
        <header className="website-guide-masthead">
          <div className="website-guide-masthead__copy">
            <motion.p className="website-guide-eyebrow" variants={reduceMotion ? undefined : revealItem}>Help Center</motion.p>
            <motion.h1 id="website-guide-title" variants={reduceMotion ? undefined : revealItem}>
              RCPH Website Guide
            </motion.h1>
            <motion.p className="website-guide-masthead__subtitle" variants={reduceMotion ? undefined : revealItem}>
              Use this guide to understand how each section of the club website works. Select a role and then choose a feature to view instructions.
            </motion.p>
          </div>
          <motion.nav className="website-guide-masthead__actions" aria-label="Guide navigation" variants={reduceMotion ? undefined : revealItem}>
            <Link to="/access">Access Hub</Link>
            <Link to="/dashboard">Dashboard</Link>
          </motion.nav>
          <motion.span className="website-guide-masthead__rule" aria-hidden="true" variants={reduceMotion ? undefined : ruleReveal} />
        </header>

        <motion.section className="website-guide-controls" aria-label="Website guide selectors" variants={reduceMotion ? undefined : revealItem}>
          <label htmlFor="website-guide-role">
            <span>Role</span>
            <select id="website-guide-role" value={roleId} onChange={changeRole}>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </label>
          <label htmlFor="website-guide-feature">
            <span>Feature</span>
            <select
              id="website-guide-feature"
              value={featureId}
              onChange={(event) => setFeatureId(event.target.value)}
              disabled={!featureOptions.length}
            >
              <option value="">Choose a feature</option>
              {featureOptions.map((feature) => (
                <option key={feature.id} value={feature.id}>{feature.label}</option>
              ))}
            </select>
          </label>
        </motion.section>

        <motion.section className="website-guide-layout" variants={reduceMotion ? undefined : revealItem}>
          <aside className="website-guide-role-card" aria-label={`${roleLabel} guide features`}>
            <p className="website-guide-eyebrow">{roleLabel}</p>
            <h2>Feature Map</h2>
            <ul>
              {featureOptions.map((feature) => (
                <li key={feature.id} className={feature.id === featureId ? "is-active" : undefined}>
                  <span>{feature.label}</span>
                </li>
              ))}
            </ul>
          </aside>

          {selectedEntry ? <GuideEntry entry={selectedEntry} roleLabel={roleLabel} /> : <GuideEmptyState roleLabel={roleLabel} />}
        </motion.section>
      </motion.section>
    </main>
  );
}

function GuideEntry({ entry, roleLabel }) {
  return (
    <article className="website-guide-entry" aria-labelledby="website-guide-entry-title">
      <div className="website-guide-entry__header">
        <p className="website-guide-eyebrow">{roleLabel} Guide</p>
        <h2 id="website-guide-entry-title">{entry.title}</h2>
      </div>

      <PreviewRenderer entry={entry} />

      <div className="website-guide-entry__grid">
        <GuidePurpose purpose={entry.purpose} />
        <GuideList title="What you can do" items={entry.canDo} />
      </div>

      <section className="website-guide-entry__steps" aria-labelledby="website-guide-steps-title">
        <h3 id="website-guide-steps-title">How to use</h3>
        <ol>
          {entry.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <GuideList title="Who uses this" items={entry.whoUses} />
      <GuideList title="Important notes" items={entry.notes} />
    </article>
  );
}

function GuidePurpose({ purpose }) {
  return (
    <section className="website-guide-list website-guide-list--purpose">
      <h3>What this page is for</h3>
      <p>{purpose}</p>
    </section>
  );
}

function GuideList({ title, items }) {
  return (
    <section className="website-guide-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function PreviewRenderer({ entry }) {
  if (!entry.preview) return null;
  if (entry.preview.type === "announcementForm") return <AnnouncementFormPreview />;
  if (entry.preview.type === "announcementCard") return <AnnouncementCardPreview />;
  return <StaticPreview entry={entry} />;
}

function StaticPreview({ entry }) {
  return (
    <aside className="website-guide-preview" aria-label={`${entry.title} static mini UI preview`}>
      <div className="website-guide-preview__chrome">
        <span />
        <span />
        <span />
      </div>
      <p className="website-guide-preview__label">Static mini preview</p>
      <h3>{entry.preview.label}</h3>
      <div className="website-guide-preview__rows" aria-hidden="true">
        {entry.preview.rows.map((row, index) => (
          <span key={row} style={{ "--preview-row": index + 1 }}>{row}</span>
        ))}
      </div>
      <small>Preview only. No live module data is loaded.</small>
    </aside>
  );
}

function MockField({ label, value, tall = false, wide = false }) {
  return (
    <div className={`website-guide-mock-field${tall ? " website-guide-mock-field--tall" : ""}${wide ? " website-guide-mock-field--wide" : ""}`}>
      <span>{label}</span>
      <div>{value}</div>
    </div>
  );
}

function AnnouncementFormPreview() {
  const recipientGroups = ["all", "prospect", "gbm", "bod", "admin", "president"];
  return (
    <aside className="website-guide-mockup website-guide-announcement-preview" aria-label="Announcements static mini UI preview">
      <div className="website-guide-preview__chrome">
        <span />
        <span />
        <span />
      </div>
      <p className="website-guide-preview__label">Preview only</p>
      <header className="website-guide-announcement-preview__header">
        <div>
          <h3>Announcements</h3>
          <p>Publish dashboard announcements with optional email delivery.</p>
        </div>
        <span aria-hidden="true">Static mockup</span>
      </header>

      <div className="website-guide-announcement-preview__form" aria-hidden="true">
        <MockField label="Title" value="Monthly fellowship update" />
        <MockField label="Priority" value="Normal" />
        <MockField label="Message" value="Share a concise update for eligible dashboard recipients." tall wide />
        <MockField label="Action text" value="View details" />
        <MockField label="HTTPS action URL" value="https://rcph3131.org/calendar" />
        <MockField label="Expires at" value="2026-07-31 21:00" />

        <div className="website-guide-mock-attachment website-guide-mock-field--wide">
          <span>Attachment</span>
          <div>Choose image or PDF</div>
        </div>

        <div className="website-guide-mock-groups website-guide-mock-field--wide">
          <span>Recipient groups</span>
          <div>
            {recipientGroups.map((group) => <span key={group}>{group}</span>)}
          </div>
        </div>

        <div className="website-guide-mock-recipients website-guide-mock-field--wide">
          <span>Specific recipients</span>
          <div>
            <span>Rtr. Example Member</span>
            <span>Rtr. Example Officer</span>
          </div>
        </div>

        <div className="website-guide-mock-checkbox website-guide-mock-field--wide">
          <span aria-hidden="true" />
          <strong>Also send email to the same eligible recipients</strong>
        </div>

        <div className="website-guide-mock-submit website-guide-mock-field--wide">Publish announcement</div>
      </div>

      <small>This is a non-functional preview. It does not publish announcements or send email.</small>
    </aside>
  );
}

function AnnouncementCardPreview() {
  return (
    <aside className="website-guide-mockup website-guide-announcement-card-preview" aria-label="Dashboard announcement static mini UI preview">
      <div className="website-guide-preview__chrome">
        <span />
        <span />
        <span />
      </div>
      <p className="website-guide-preview__label">Preview only</p>

      <header className="website-guide-announcement-card-preview__header">
        <div>
          <p className="website-guide-eyebrow">Announcements</p>
          <h3>Dashboard notice</h3>
        </div>
        <span>Unread</span>
      </header>

      <article className="website-guide-announcement-card-preview__card" aria-hidden="true">
        <div className="website-guide-announcement-card-preview__topline">
          <span>Normal priority</span>
          <span>Club update</span>
        </div>
        <h4>Profile update reminder</h4>
        <p>
          Please complete your profile details so club records remain accurate and updated.
        </p>
        <div className="website-guide-announcement-card-preview__attachment">
          <span>PDF / Image attachment</span>
          <strong>View attachment</strong>
        </div>
        <footer>
          <span>Published by RCPH Admin</span>
          <strong>Mark as read</strong>
        </footer>
      </article>

      <small>This is a non-functional preview. It does not open, mark, hide, or delete announcements.</small>
    </aside>
  );
}

function GuideEmptyState({ roleLabel }) {
  return (
    <section className="website-guide-empty" aria-live="polite">
      <p className="website-guide-eyebrow">{roleLabel} Guide</p>
      <h2>Choose a feature</h2>
      <p>Select a feature to view static instructions for this role.</p>
    </section>
  );
}

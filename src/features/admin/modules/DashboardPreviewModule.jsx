import { useState } from "react";
import DashboardHeader from "../../dashboard/DashboardHeader";
import DashboardMetricRail from "../../dashboard/DashboardMetricRail";
import MemberAnnouncements from "../../dashboard/MemberAnnouncements";
import MemberOverview from "../../dashboard/MemberOverview";
import ProspectProgress from "../../prospect/ProspectProgress";
import AdminModuleHeader from "../AdminModuleHeader";
import {
  DASHBOARD_PREVIEW_NOTICE,
  DASHBOARD_PREVIEW_ROLES,
  getDashboardPreviewData,
} from "./dashboardPreviewModel";
import "../../../styles/components/member-dashboard.css";

const noop = () => {};

export default function DashboardPreviewModule() {
  const [selectedRole, setSelectedRole] = useState("prospect");
  const preview = getDashboardPreviewData(selectedRole);

  return (
    <>
      <AdminModuleHeader
        kicker="Website Director"
        title="Dashboard Preview"
        description="Static role dashboard previews for CWD review."
      />

      <section className="dashboard-preview" aria-labelledby="dashboard-preview-title">
        <div className="dashboard-preview__notice" role="status">
          {DASHBOARD_PREVIEW_NOTICE}
        </div>

        <div className="dashboard-preview__role-switcher" role="group" aria-label="Dashboard role previews">
          {DASHBOARD_PREVIEW_ROLES.map((role) => (
            <button
              type="button"
              key={role.id}
              className={selectedRole === role.id ? "is-active" : ""}
              aria-pressed={selectedRole === role.id}
              onClick={() => setSelectedRole(role.id)}
            >
              {role.label}
            </button>
          ))}
        </div>

        <header className="dashboard-preview__context">
          <div>
            <p className="admin-kicker">{preview.meta.kicker}</p>
            <h3 id="dashboard-preview-title">{preview.meta.title}</h3>
          </div>
          <p>{preview.meta.summary}</p>
        </header>

        <DashboardPreviewFrame preview={preview} />
      </section>
    </>
  );
}

function DashboardPreviewFrame({ preview }) {
  const dashboard = preview.dashboard;
  const prospect = preview.role === "prospect";

  return (
    <div className="dashboard-preview__frame" aria-label={`${preview.label} dashboard static preview`}>
      <div className="member-dashboard-page dashboard-preview__dashboard">
        <div className="member-dashboard-shell">
          <DashboardHeader
            profile={dashboard.profile}
            mode={dashboard.mode}
            access={{ hasWebsiteDirectorPosition: false, hasPresidentAuthority: false }}
            onEditProfile={noop}
            onSignOut={noop}
          />

          <MemberAnnouncements
            uid=""
            announcements={dashboard.announcements}
            busyId=""
          />

          {preview.role === "bod" ? <StaticResolutionPreview /> : null}

          {prospect ? (
            <ProspectProgress data={dashboard} />
          ) : (
            <MemberOverview data={dashboard} />
          )}

          <RoleSpecificPreview role={preview.role} />
        </div>
      </div>
    </div>
  );
}

function RoleSpecificPreview({ role }) {
  if (role === "prospect") return null;
  if (role === "gbm") return <GbmPreviewExtras />;
  if (role === "bod") return <BodPreviewExtras />;
  if (role === "admin") return <AdminPreviewExtras />;
  return null;
}

function GbmPreviewExtras() {
  return (
    <StaticActionSection
      kicker="Member actions"
      title="Quick member links"
      items={[
        {
          title: "Calendar check-in",
          detail: "Next public event and GBM dates are visible for planning attendance.",
          status: "Ready",
          action: "View calendar",
        },
        {
          title: "Profile details",
          detail: "Contact, RID, and member profile details are available from dashboard actions.",
          status: "Current",
          action: "Edit profile",
        },
        {
          title: "Club contact",
          detail: "Member support and club contact links remain easy to reach.",
          status: "Available",
          action: "Contact club",
        },
      ]}
    />
  );
}

function BodPreviewExtras() {
  return (
    <>
      <DashboardMetricRail
        label="BOD reporting reminders"
        items={[
          { key: "mom-pending", label: "MOM pending", value: 2, detail: "Drafts awaiting upload" },
          { key: "attendance-pending", label: "Attendance pending", value: 1, detail: "BOD meeting register" },
          { key: "reporting", label: "Reporting window", value: "Open", detail: "CWD support reminder" },
          { key: "tasks", label: "Director tasks", value: 4, detail: "Static preview count" },
        ]}
      />

      <StaticActionSection
        kicker="BOD tasks"
        title="Leadership follow-ups"
        items={[
          {
            title: "MOM review",
            detail: "July BOD Meeting minutes are marked as pending final upload.",
            status: "Due soon",
            action: "Open MOM",
          },
          {
            title: "Attendance check",
            detail: "One director row still needs confirmation before the meeting register is complete.",
            status: "Pending",
            action: "Review attendance",
          },
          {
            title: "Reporting reminder",
            detail: "CSD and CMD reports are staged for the current club reporting cycle.",
            status: "In progress",
            action: "Review report",
          },
        ]}
      />

      <StaticEntrySection
        kicker="Leadership access"
        title="BOD Tools"
        detail="Create events, review reporting support, and manage BOD operational context from the protected BOD Tools area."
        action="Open BOD Tools"
      />
    </>
  );
}

function AdminPreviewExtras() {
  return (
    <>
      <DashboardMetricRail
        label="Admin management summary"
        items={[
          { key: "requests", label: "Pending requests", value: 3, detail: "Account review" },
          { key: "announcements", label: "Active notices", value: 4, detail: "Dashboard recipients" },
          { key: "treasury", label: "Treasury checks", value: 2, detail: "Attachment review" },
          { key: "locks", label: "Locks", value: "Open", detail: "Operations available" },
        ]}
      />

      <StaticActionSection
        kicker="Admin tasks"
        title="Management actions"
        items={[
          {
            title: "Account requests",
            detail: "New approved-role requests are queued for Admin review.",
            status: "3 pending",
            action: "Review accounts",
          },
          {
            title: "Announcement queue",
            detail: "Draft dashboard notices can be checked before publishing from Admin tools.",
            status: "Draft",
            action: "Open announcements",
          },
          {
            title: "Treasury evidence",
            detail: "Two sample expense entries are waiting for attachment confirmation.",
            status: "Needs check",
            action: "Open treasury",
          },
        ]}
      />
    </>
  );
}

function StaticResolutionPreview() {
  return (
    <section className="member-dashboard-section dashboard-resolutions" aria-labelledby="preview-resolution-title">
      <div className="dashboard-section-heading">
        <div>
          <p className="auth-access-kicker">Live BOD voting</p>
          <h2 id="preview-resolution-title">Resolutions awaiting your vote</h2>
        </div>
        <button type="button" disabled>Refresh</button>
      </div>

      <div className="dashboard-resolution-list">
        <article className="dashboard-resolution-card">
          <header>
            <span>RCPH/BOD/2026-27/04</span>
            <strong>Voting open</strong>
          </header>
          <h3>Approve August service budget allocation</h3>
          <p className="dashboard-resolution-card__meeting">BOD Meeting 04 - 2026-07-26</p>
          <p className="dashboard-resolution-card__method">Authenticated dashboard vote - Fingerprint A7C2</p>
          <div className="dashboard-resolution-card__body">
            Approval requested for the upcoming community service allocation, including logistics,
            materials, and partner coordination for August activities.
          </div>
          <dl>
            <div><dt>Proposed by</dt><dd>Rotaractor Riya Mehta - Club Service Director</dd></div>
            <div><dt>Seconded by</dt><dd>Rotaractor Sameer Patil - Community Service Director</dd></div>
          </dl>
          <fieldset disabled>
            <legend>Static vote controls</legend>
            <div className="dashboard-resolution-votes">
              <button type="button">Approve</button>
              <button type="button">Reject</button>
              <button type="button">Abstain</button>
            </div>
          </fieldset>
          <div className="dashboard-resolution-card__current" aria-live="polite">
            <strong>Your vote: Not submitted</strong>
            <small>Preview controls are disabled and do not submit votes.</small>
          </div>
        </article>
      </div>
    </section>
  );
}

function StaticActionSection({ kicker, title, items }) {
  return (
    <section className="dashboard-preview-static" aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>
      <header className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">{kicker}</p>
          <h2 id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>{title}</h2>
        </div>
      </header>

      <div className="dashboard-preview-static__grid">
        {items.map((item) => (
          <article className="dashboard-preview-static__item" key={item.title}>
            <span>{item.status}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            {item.action ? <button type="button" disabled>{item.action}</button> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function StaticEntrySection({ kicker, title, detail, action }) {
  return (
    <section className="prospect-next-action dashboard-preview-entry" aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>
      <div>
        <p className="dashboard-eyebrow">{kicker}</p>
        <h2 id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>{title}</h2>
        <p>{detail}</p>
      </div>
      <button type="button" disabled>{action}</button>
    </section>
  );
}

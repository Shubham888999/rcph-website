const auth = window.auth;
const db = window.db;
const dashboardFunction = firebase.functions().httpsCallable('getMyDashboardStats');
const markAnnouncementReadFunction = firebase.functions().httpsCallable('markAnnouncementRead');
const dismissAnnouncementFunction = firebase.functions().httpsCallable('dismissAnnouncement');
const REQUIRED_CONSECUTIVE_ATTENDANCE = 3;
const ANNOUNCEMENT_PRIORITIES = new Set(['normal', 'important', 'urgent']);

let dashboardAnnouncements = [];
const dashboardAnnouncementBusy = new Set();
const dashboardAnnouncementErrors = new Map();

const els = {
  loading: document.getElementById('loadingState'),
  error: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  content: document.getElementById('dashboardContent'),
  dashboardTitle: document.getElementById('dashboardTitle'),
  welcomeName: document.getElementById('welcomeName'),
  memberLinkNote: document.getElementById('memberLinkNote'),
  dashboardAnnouncements: document.getElementById('dashboardAnnouncements'),
  dashboardAnnouncementCount: document.getElementById('dashboardAnnouncementCount'),
  dashboardAnnouncementList: document.getElementById('dashboardAnnouncementList'),
  adminPanelBtn: document.getElementById('adminPanelBtn'),
  bodPanelBtn: document.getElementById('bodPanelBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  kpiAttendance: document.getElementById('kpiAttendance'),
  kpiPresent: document.getElementById('kpiPresent'),
  kpiAbsent: document.getElementById('kpiAbsent'),
  clubRankingKpiCard: document.getElementById('clubRankingKpiCard'),
  kpiRank: document.getElementById('kpiRank'),
  kpiRankSubtitle: document.getElementById('kpiRankSubtitle'),
  attendanceProgress: document.getElementById('attendanceProgress'),
  countedNote: document.getElementById('countedNote'),
  attendanceSummaryText: document.getElementById('attendanceSummaryText'),
  avenueBreakdown: document.getElementById('avenueBreakdown'),
  recentAttendance: document.getElementById('recentAttendance'),
  districtPercent: document.getElementById('districtPercent'),
  districtRecent: document.getElementById('districtRecent'),
  clubStatsList: document.getElementById('clubStatsList'),
  upcomingEvents: document.getElementById('upcomingEvents'),
  eventsByAvenue: document.getElementById('eventsByAvenue'),
  memberDashboardSections: document.getElementById('memberDashboardSections'),
  prospectDashboardSections: document.getElementById('prospectDashboardSections'),
  prospectProgressStatus: document.getElementById('prospectProgressStatus'),
  prospectProgressPercent: document.getElementById('prospectProgressPercent'),
  prospectProgressCount: document.getElementById('prospectProgressCount'),
  prospectProgressTrack: document.getElementById('prospectProgressTrack'),
  prospectProgressFill: document.getElementById('prospectProgressFill'),
  prospectGbmItem: document.getElementById('prospectGbmItem'),
  prospectGbmValue: document.getElementById('prospectGbmValue'),
  prospectAvenueItem: document.getElementById('prospectAvenueItem'),
  prospectAvenueValue: document.getElementById('prospectAvenueValue'),
  prospectCriteriaMessage: document.getElementById('prospectCriteriaMessage'),
  prospectQualifyingEvents: document.getElementById('prospectQualifyingEvents'),
  prospectClubRankingSection: document.getElementById('prospectClubRankingSection'),
  prospectClubRankingValue: document.getElementById('prospectClubRankingValue'),
  prospectClubRankingSubtitle: document.getElementById('prospectClubRankingSubtitle'),
  prospectUpcomingEvents: document.getElementById('prospectUpcomingEvents')
};

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function roleLabel(role) {
  const labels = {
    prospect: 'Prospect',
    gbm: 'GBM',
    bod: 'BOD',
    admin: 'Admin',
    president: 'President'
  };
  return labels[String(role || '').toLowerCase()] || 'Member';
}

function formatMemberHeading(name, position, role) {
  const cleanName = String(name || 'Member')
    .replace(/^Rtr\.\s*/i, '')
    .trim();

  const designation = String(position || roleLabel(role) || 'Member').trim();

return `Rtr. ${cleanName} (${designation})`;
}

function avenueText(avenue) {
  const list = Array.isArray(avenue) ? avenue : (avenue ? [avenue] : []);
  return list.length ? list.join(', ') : 'Other';
}

function formatDate(date) {
  if (!date) return '-';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusClass(value) {
  if (value === true || value === 'Present') return 'status-present';
  if (value === false || value === 'Absent') return 'status-absent';
  return 'status-na';
}

function showLoading() {
  els.loading.hidden = false;
  els.loading.removeAttribute('hidden');
  els.error.hidden = true;
  els.error.setAttribute('hidden', '');
  els.content.hidden = true;
  els.content.setAttribute('hidden', '');
}

function showError(message) {
  els.loading.hidden = true;
  els.loading.setAttribute('hidden', '');
  els.error.hidden = false;
  els.error.removeAttribute('hidden');
  els.content.hidden = true;
  els.content.setAttribute('hidden', '');
  els.errorMessage.textContent = message || 'Something went wrong.';
}

function showDashboard() {
  els.loading.hidden = true;
  els.loading.setAttribute('hidden', '');
  els.error.hidden = true;
  els.error.setAttribute('hidden', '');
  els.content.hidden = false;
  els.content.removeAttribute('hidden');
}

function renderEventList(target, events, emptyText) {
  if (!events || !events.length) {
    target.innerHTML = `<p class="subtle">${escapeHtml(emptyText)}</p>`;
    return;
  }

  target.innerHTML = events.map(event => `
    <article class="event-row">
      <div>
        <h3>${escapeHtml(event.name || '-')}</h3>
        <p>${escapeHtml(formatDate(event.date))}${event.endDate && event.endDate !== event.date ? ` - ${escapeHtml(formatDate(event.endDate))}` : ''}</p>
        <p>${escapeHtml(avenueText(event.avenue))}</p>
      </div>
      ${event.label ? `<span class="status-chip ${statusClass(event.value)}">${escapeHtml(event.label)}</span>` : ''}
    </article>
  `).join('');
}

function renderAvenueBreakdown(rows) {
  if (!rows || !rows.length) {
    els.avenueBreakdown.innerHTML = '<p class="subtle">No attendance has been recorded yet.</p>';
    return;
  }

  els.avenueBreakdown.innerHTML = `
    <table class="member-table">
      <thead>
        <tr>
          <th>Avenue</th>
          <th>Present</th>
          <th>Counted</th>
          <th>%</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.avenue)}</td>
            <td>${Number(row.present || 0)}</td>
            <td>${Number(row.totalCounted || 0)}</td>
            <td>${Number(row.percentage || 0)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderClubStats(stats) {
  els.clubStatsList.innerHTML = [
    ['Total public club events', stats.totalEvents ?? 0],
    ['Most active avenue', stats.mostActiveAvenue || '-'],
    ['Club average attendance', `${stats.clubAverageAttendance || 0}%`],
  ].map(([label, value]) => `
    <div class="stat-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');
}

function normalizeDashboardClubRanking(raw) {
  if (!raw || raw.enabled !== true || typeof raw.value !== 'string') {
    return { enabled: false, value: '', subtitle: '' };
  }

  const value = raw.value.trim();
  const subtitle = typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '';
  const hasUnsafeText = /[<>]/.test(value) || /[<>]/.test(subtitle);

  if (!value || hasUnsafeText) {
    return { enabled: false, value: '', subtitle: '' };
  }

  return {
    enabled: true,
    value: value.slice(0, 80),
    subtitle: subtitle.slice(0, 120),
  };
}

function setClubRankingCard(card, valueEl, subtitleEl, ranking) {
  if (!card || !valueEl) return;

  if (!ranking.enabled) {
    card.hidden = true;
    card.setAttribute('hidden', '');
    valueEl.textContent = '';
    if (subtitleEl) {
      subtitleEl.textContent = '';
      subtitleEl.hidden = true;
      subtitleEl.setAttribute('hidden', '');
    }
    return;
  }

  card.hidden = false;
  card.removeAttribute('hidden');
  valueEl.textContent = ranking.value;

  if (subtitleEl) {
    subtitleEl.textContent = ranking.subtitle;
    subtitleEl.hidden = !ranking.subtitle;
    if (ranking.subtitle) {
      subtitleEl.removeAttribute('hidden');
    } else {
      subtitleEl.setAttribute('hidden', '');
    }
  }
}

function renderClubRanking(rawRanking, mode) {
  const ranking = normalizeDashboardClubRanking(rawRanking);
  if (mode === 'prospect') {
    setClubRankingCard(
      els.prospectClubRankingSection,
      els.prospectClubRankingValue,
      els.prospectClubRankingSubtitle,
      ranking
    );
    return;
  }

  setClubRankingCard(els.clubRankingKpiCard, els.kpiRank, els.kpiRankSubtitle, ranking);
}

function safeTrimmedString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function parseDashboardDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  const ms = parsed.getTime();
  if (Number.isNaN(ms)) return null;
  return { date: parsed, ms, iso: parsed.toISOString() };
}

function formatDashboardDateTime(value) {
  const parsed = parseDashboardDate(value);
  if (!parsed) return '';
  return parsed.date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function normalizeDashboardAction(raw) {
  const actionText = safeTrimmedString(raw?.actionText, 80);
  const actionUrl = safeTrimmedString(raw?.actionUrl, 1000);

  if (!actionText || !actionUrl || /[<>]/.test(actionText)) {
    return { actionText: '', actionUrl: '' };
  }

  try {
    const parsed = new URL(actionUrl);
    if (parsed.protocol !== 'https:') {
      return { actionText: '', actionUrl: '' };
    }
    return { actionText, actionUrl: parsed.href };
  } catch (err) {
    return { actionText: '', actionUrl: '' };
  }
}

function normalizeDashboardAnnouncements(raw) {
  if (!Array.isArray(raw)) return [];

  const seen = new Set();
  const now = Date.now();
  const normalized = [];

  raw.forEach(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;

    const id = safeTrimmedString(item.id, 160);
    if (!id || id.includes('/') || seen.has(id)) return;

    const title = safeTrimmedString(item.title, 160);
    const body = safeTrimmedString(item.body, 5000);
    if (!title || !body || /[<>]/.test(title) || /[<>]/.test(body)) return;

    const priorityValue = safeTrimmedString(item.priority, 24).toLowerCase();
    const priority = ANNOUNCEMENT_PRIORITIES.has(priorityValue) ? priorityValue : 'normal';
    const publishedAt = parseDashboardDate(item.publishedAt);
    const expiresAt = parseDashboardDate(item.expiresAt);
    if (expiresAt && expiresAt.ms <= now) return;

    const action = normalizeDashboardAction(item);
    seen.add(id);
    normalized.push({
      id,
      title,
      body,
      priority,
      actionText: action.actionText,
      actionUrl: action.actionUrl,
      publishedAt: publishedAt ? publishedAt.iso : '',
      publishedAtMs: publishedAt ? publishedAt.ms : 0,
      expiresAt: expiresAt ? expiresAt.iso : '',
      read: item.read === true
    });
  });

  return normalized
    .sort((a, b) => b.publishedAtMs - a.publishedAtMs)
    .slice(0, 5);
}

function announcementPriorityLabel(priority) {
  if (priority === 'urgent') return 'Urgent';
  if (priority === 'important') return 'Important';
  return 'Normal';
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function setDashboardAnnouncementError(id, message) {
  if (message) {
    dashboardAnnouncementErrors.set(id, message);
  } else {
    dashboardAnnouncementErrors.delete(id);
  }
}

function setDashboardAnnouncementBusy(id, busy) {
  if (busy) {
    dashboardAnnouncementBusy.add(id);
  } else {
    dashboardAnnouncementBusy.delete(id);
  }
}

function safeAnnouncementActionError(error, fallback) {
  const message = error?.message || error?.details?.message || fallback;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

function renderDashboardAnnouncementCard(announcement) {
  const isBusy = dashboardAnnouncementBusy.has(announcement.id);
  const errorMessage = dashboardAnnouncementErrors.get(announcement.id) || '';
  const card = document.createElement('article');
  card.className = `dashboard-announcement dashboard-announcement--${announcement.priority}${announcement.read ? ' is-read' : ''}`;
  card.dataset.announcementId = announcement.id;

  const header = document.createElement('div');
  header.className = 'dashboard-announcement__header';
  const badge = createTextElement('span', 'dashboard-announcement__priority', announcementPriorityLabel(announcement.priority));
  const readStatus = createTextElement('span', 'dashboard-announcement__read-status', announcement.read ? 'Read' : 'Unread');
  header.append(badge, readStatus);

  const title = createTextElement('h3', '', announcement.title);
  const body = createTextElement('p', 'dashboard-announcement__body', announcement.body);

  const meta = document.createElement('div');
  meta.className = 'dashboard-announcement__meta';
  const published = formatDashboardDateTime(announcement.publishedAt);
  const expires = formatDashboardDateTime(announcement.expiresAt);
  if (published) meta.appendChild(createTextElement('span', '', `Published ${published}`));
  if (expires) meta.appendChild(createTextElement('span', '', `Expires ${expires}`));

  const actions = document.createElement('div');
  actions.className = 'dashboard-announcement__actions';

  if (announcement.actionText && announcement.actionUrl) {
    const actionLink = document.createElement('a');
    actionLink.className = 'btn btn-outline dashboard-announcement__action';
    actionLink.href = announcement.actionUrl;
    actionLink.target = '_blank';
    actionLink.rel = 'noopener noreferrer';
    actionLink.textContent = announcement.actionText;
    if (isBusy) {
      actionLink.setAttribute('aria-disabled', 'true');
      actionLink.tabIndex = -1;
    }
    actions.appendChild(actionLink);
  }

  if (!announcement.read) {
    const readButton = document.createElement('button');
    readButton.type = 'button';
    readButton.className = 'btn btn-outline';
    readButton.dataset.announcementRead = announcement.id;
    readButton.textContent = 'Mark as read';
    readButton.disabled = isBusy;
    actions.appendChild(readButton);
  }

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'btn btn-primary';
  dismissButton.dataset.announcementDismiss = announcement.id;
  dismissButton.textContent = 'Dismiss';
  dismissButton.disabled = isBusy;
  actions.appendChild(dismissButton);

  const message = createTextElement('p', 'dashboard-announcement__message', errorMessage);
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  message.hidden = !errorMessage;

  card.append(header, title, body);
  if (meta.childNodes.length) card.appendChild(meta);
  card.append(actions, message);
  return card;
}

function renderDashboardAnnouncementList() {
  if (!els.dashboardAnnouncements || !els.dashboardAnnouncementList) return;

  els.dashboardAnnouncementList.replaceChildren();

  if (!dashboardAnnouncements.length) {
    els.dashboardAnnouncements.hidden = true;
    els.dashboardAnnouncements.setAttribute('hidden', '');
    if (els.dashboardAnnouncementCount) els.dashboardAnnouncementCount.textContent = '';
    return;
  }

  els.dashboardAnnouncements.hidden = false;
  els.dashboardAnnouncements.removeAttribute('hidden');
  if (els.dashboardAnnouncementCount) {
    const count = dashboardAnnouncements.length;
    els.dashboardAnnouncementCount.textContent = `${count} announcement${count === 1 ? '' : 's'}`;
  }

  const fragment = document.createDocumentFragment();
  dashboardAnnouncements.forEach(announcement => {
    fragment.appendChild(renderDashboardAnnouncementCard(announcement));
  });
  els.dashboardAnnouncementList.appendChild(fragment);
}

function renderDashboardAnnouncements(rawAnnouncements) {
  dashboardAnnouncements = normalizeDashboardAnnouncements(rawAnnouncements);
  dashboardAnnouncementBusy.clear();
  dashboardAnnouncementErrors.clear();
  renderDashboardAnnouncementList();
}

async function markDashboardAnnouncementRead(id) {
  const announcement = dashboardAnnouncements.find(item => item.id === id);
  if (!announcement || dashboardAnnouncementBusy.has(id)) return;

  setDashboardAnnouncementBusy(id, true);
  setDashboardAnnouncementError(id, '');
  renderDashboardAnnouncementList();

  try {
    await markAnnouncementReadFunction({ announcementId: id });
    announcement.read = true;
    setDashboardAnnouncementBusy(id, false);
    renderDashboardAnnouncementList();
  } catch (error) {
    setDashboardAnnouncementBusy(id, false);
    setDashboardAnnouncementError(id, safeAnnouncementActionError(error, 'Could not mark this announcement as read.'));
    renderDashboardAnnouncementList();
  }
}

async function dismissDashboardAnnouncement(id) {
  if (!dashboardAnnouncements.some(item => item.id === id) || dashboardAnnouncementBusy.has(id)) return;

  setDashboardAnnouncementBusy(id, true);
  setDashboardAnnouncementError(id, '');
  renderDashboardAnnouncementList();

  try {
    await dismissAnnouncementFunction({ announcementId: id });
    dashboardAnnouncements = dashboardAnnouncements.filter(item => item.id !== id);
    dashboardAnnouncementBusy.delete(id);
    dashboardAnnouncementErrors.delete(id);
    renderDashboardAnnouncementList();
  } catch (error) {
    setDashboardAnnouncementBusy(id, false);
    setDashboardAnnouncementError(id, safeAnnouncementActionError(error, 'Could not dismiss this announcement.'));
    renderDashboardAnnouncementList();
  }
}

function renderEventsByAvenue(rows) {
  if (!rows || !rows.length) {
    els.eventsByAvenue.innerHTML = '<p class="subtle">No public club events yet.</p>';
    return;
  }

  const max = Math.max(...rows.map(row => Number(row.count || 0)), 1);
  els.eventsByAvenue.innerHTML = rows.map(row => {
    const width = Math.max(4, Math.round((Number(row.count || 0) / max) * 100));
    return `
      <div class="avenue-bar">
        <div class="avenue-bar__top">
          <strong>${escapeHtml(row.avenue)}</strong>
          <span class="subtle">${Number(row.count || 0)} events</span>
        </div>
        <div class="avenue-bar__track">
          <div class="avenue-bar__fill" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderUpcoming(target, events) {
  if (!events || !events.length) {
    target.innerHTML = '<p class="subtle">No upcoming public events yet.</p>';
    return;
  }

  target.innerHTML = events.map(event => `
    <article class="event-row">
      <div>
        <h3>${escapeHtml(event.name || '-')}</h3>
        <p>${escapeHtml(formatDate(event.date))}${event.endDate && event.endDate !== event.date ? ` - ${escapeHtml(formatDate(event.endDate))}` : ''}</p>
        <p>${escapeHtml(avenueText(event.avenue))}</p>
        ${event.desc ? `<p>${escapeHtml(event.desc)}</p>` : ''}
      </div>
    </article>
  `).join('');
}

function setDashboardMode(isProspect) {
  els.memberDashboardSections.hidden = isProspect;
  els.prospectDashboardSections.hidden = !isProspect;
  if (isProspect) {
    els.memberDashboardSections.setAttribute('hidden', '');
    els.prospectDashboardSections.removeAttribute('hidden');
  } else {
    els.memberDashboardSections.removeAttribute('hidden');
    els.prospectDashboardSections.setAttribute('hidden', '');
  }
}

function renderMemberDashboard(data) {
  const profile = data.profile || {};
  const my = data.myAttendance || {};
  const district = data.districtAttendance || {};
  const club = data.clubStats || {};
  const displayName = profile.name || profile.memberName || 'Member';
  const position = profile.memberPosition || profile.clubPosition || '';

  document.title = 'My RCPH Dashboard';
  els.dashboardTitle.textContent = 'My RCPH Dashboard';
  setDashboardMode(false);
els.welcomeName.textContent = formatMemberHeading(
  displayName,
  position,
  profile.role
);
  if (!profile.memberName) {
    els.memberLinkNote.textContent = 'Your profile is created, but attendance has not been linked yet. Please contact admin.';
  } else if (!my.totalCounted) {
    els.memberLinkNote.textContent = 'No attendance has been recorded yet.';
  } else {
    els.memberLinkNote.textContent = `${profile.memberName}${position ? ` - ${position}` : ''}`;
  }

  const role = String(profile.role || '').toLowerCase();
  const hasPresidentAuthority = profile.authority?.hasPresidentAuthority === true || role === 'president';
  els.adminPanelBtn.hidden = !(role === 'admin' || hasPresidentAuthority);
  els.bodPanelBtn.hidden = !(role === 'bod' || role === 'admin' || hasPresidentAuthority);

  els.kpiAttendance.textContent = `${my.percentage || 0}%`;
  els.kpiPresent.textContent = Number(my.present || 0);
  els.kpiAbsent.textContent = Number(my.absent || 0);
  renderClubRanking(data.clubRanking, 'member');
  els.attendanceProgress.style.width = `${Math.max(0, Math.min(100, Number(my.percentage || 0)))}%`;
  els.countedNote.textContent = `${Number(my.totalCounted || 0)} counted events. NA events are excluded.`;
  els.attendanceSummaryText.textContent = `${Number(my.present || 0)} present, ${Number(my.absent || 0)} absent, ${Number(my.na || 0)} NA.`;

  renderAvenueBreakdown(my.avenueBreakdown || []);
  renderEventList(els.recentAttendance, my.recent || [], 'No attendance has been recorded yet.');
  els.districtPercent.textContent = `${district.percentage || 0}%`;
  renderEventList(els.districtRecent, district.recent || [], 'No district attendance has been recorded yet.');
  renderClubStats(club);
  renderUpcoming(els.upcomingEvents, data.upcomingEvents || []);
  renderEventsByAvenue(club.eventsByAvenue || []);
  showDashboard();
}

function progressStatus(progress) {
  if (progress.ready) return 'Ready for Induction';
  if (progress.attendanceRequirementMet) return 'Dues Pending';
  if (Number(progress.currentConsecutiveAttendance || 0) > 0) return 'In Progress';
  return 'Getting Started';
}

function setCriterionState(item, complete) {
  item.classList.toggle('is-complete', complete);
}

function prospectDuesStatus(progress) {
  if (progress.duesPaid) return 'Paid';
  if (progress.duesDue || progress.attendanceRequirementMet) return 'Pending';
  return 'Not yet due';
}

function prospectCriteriaMessage(progress) {
  if (progress.ready) {
    return 'All membership criteria are complete. Your induction is pending club approval.';
  }
  if (progress.attendanceRequirementMet) {
    return 'Attendance requirement complete. Membership dues are now payable at your 4th eligible club activity.';
  }
  return 'Attend 3 eligible club meetings or events consecutively. Missing an eligible meeting or event resets the active streak.';
}

function renderProspectQualifyingEvents(events) {
  if (!els.prospectQualifyingEvents) return;
  const list = Array.isArray(events) ? events : [];
  if (!list.length) {
    els.prospectQualifyingEvents.hidden = true;
    els.prospectQualifyingEvents.innerHTML = '';
    return;
  }
  els.prospectQualifyingEvents.hidden = false;
  els.prospectQualifyingEvents.innerHTML = `
    <strong>Qualifying activities</strong>
    <ul>
      ${list.map(event => `
        <li>
          <span>${escapeHtml(event.name || 'Club activity')}</span>
          <span>${escapeHtml(formatDate(event.date))}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderProspectDashboard(data) {
  const profile = data.profile || {};
  const progress = data.prospectProgress || {};
  const criteria = progress.criteria || {};
  const requiredConsecutive = Math.max(1, Number(progress.requiredConsecutiveAttendance || criteria.requiredConsecutiveAttendance) || REQUIRED_CONSECUTIVE_ATTENDANCE);
  const currentStreak = Math.max(0, Number(progress.currentConsecutiveAttendance) || 0);
  const attendanceRequirementMet = progress.attendanceRequirementMet === true;
  const duesPaid = progress.duesPaid === true;
  const ready = progress.ready === true;
  const attendanceProgressCount = attendanceRequirementMet
    ? requiredConsecutive
    : Math.min(currentStreak, requiredConsecutive);
  const percent = Math.max(0, Math.min(100, Math.round((attendanceProgressCount / requiredConsecutive) * 100)));
  const duesStatus = prospectDuesStatus(progress);
  const displayName = profile.name || 'Prospect';

  document.title = 'My Dashboard';
  els.dashboardTitle.textContent = 'My Dashboard';
  setDashboardMode(true);
const cleanProspectName = String(displayName || 'Prospect')
  .replace(/^Rtr\.\s*/i, '')
  .trim();

els.welcomeName.textContent =
  `${cleanProspectName} (Prospect)`;
  els.memberLinkNote.textContent = 'You are currently a Prospect Member. Complete the membership criteria below to become an official RCPH member.';
  els.adminPanelBtn.hidden = true;
  els.bodPanelBtn.hidden = true;
  renderClubRanking(data.clubRanking, 'prospect');

  els.prospectProgressStatus.textContent = progressStatus({ ...progress, ready, attendanceRequirementMet, currentConsecutiveAttendance: currentStreak });
  els.prospectProgressPercent.textContent = `${attendanceProgressCount} / ${requiredConsecutive}`;
  els.prospectProgressCount.textContent = `Progress: ${attendanceProgressCount} / ${requiredConsecutive}`;
  els.prospectProgressFill.style.width = `${percent}%`;
  els.prospectProgressTrack.setAttribute('aria-valuenow', String(percent));
els.prospectGbmValue.textContent =
  `Current streak: ${attendanceProgressCount} / ${requiredConsecutive}`;
    els.prospectAvenueValue.textContent = duesStatus;
  if (els.prospectCriteriaMessage) els.prospectCriteriaMessage.textContent = prospectCriteriaMessage({ ...progress, ready, attendanceRequirementMet });
  setCriterionState(els.prospectGbmItem, attendanceRequirementMet);
  setCriterionState(els.prospectAvenueItem, duesPaid);
  renderProspectQualifyingEvents(attendanceRequirementMet ? progress.qualifyingEvents : []);
  renderUpcoming(els.prospectUpcomingEvents, data.upcomingEvents || []);
  showDashboard();
}

function renderDashboard(data) {
  renderDashboardAnnouncements(data.announcements);
  if (data.mode === 'prospect') {
    renderProspectDashboard(data);
    return;
  }
  renderMemberDashboard(data);
}

async function redirectForAccountState(user) {
  const snap = await db.collection('users').doc(user.uid).get().catch(() => null);
  const status = snap && snap.exists ? String(snap.data()?.status || '').toLowerCase() : '';
  if (status === 'pending') {
    location.href = 'login.html?reason=pending';
    return true;
  }
  if (status === 'rejected') {
    location.href = 'login.html?reason=rejected';
    return true;
  }
  return false;
}

els.signOutBtn.addEventListener('click', async () => {
  await auth.signOut();
  location.href = 'login.html';
});

if (els.dashboardAnnouncementList) {
  els.dashboardAnnouncementList.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const readButton = target.closest('[data-announcement-read]');
    if (readButton) {
      markDashboardAnnouncementRead(readButton.dataset.announcementRead);
      return;
    }

    const dismissButton = target.closest('[data-announcement-dismiss]');
    if (dismissButton) {
      dismissDashboardAnnouncement(dismissButton.dataset.announcementDismiss);
    }
  });
}

auth.onAuthStateChanged(async user => {
  if (!user) {
    location.href = 'login.html';
    return;
  }

  showLoading();
  try {
    const result = await dashboardFunction();
    renderDashboard(result.data || {});
  } catch (err) {
    const redirected = await redirectForAccountState(user);
    if (redirected) return;
    showError(err?.message || 'You need an approved account to view this dashboard.');
  }
});

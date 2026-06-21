const auth = window.auth;
const db = window.db;
const dashboardFunction = firebase.functions().httpsCallable('getMyDashboardStats');
const REQUIRED_GBM = 2;
const REQUIRED_AVENUE_EVENTS = 2;

const els = {
  loading: document.getElementById('loadingState'),
  error: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  content: document.getElementById('dashboardContent'),
  dashboardTitle: document.getElementById('dashboardTitle'),
  welcomeName: document.getElementById('welcomeName'),
  memberLinkNote: document.getElementById('memberLinkNote'),
  roleChip: document.getElementById('roleChip'),
  positionChip: document.getElementById('positionChip'),
  adminPanelBtn: document.getElementById('adminPanelBtn'),
  bodPanelBtn: document.getElementById('bodPanelBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  kpiAttendance: document.getElementById('kpiAttendance'),
  kpiPresent: document.getElementById('kpiPresent'),
  kpiAbsent: document.getElementById('kpiAbsent'),
  kpiRank: document.getElementById('kpiRank'),
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
  prospectDuesItem: document.getElementById('prospectDuesItem'),
  prospectDuesValue: document.getElementById('prospectDuesValue'),
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
    ['Ranked members', stats.rankedMemberCount ?? 0]
  ].map(([label, value]) => `
    <div class="stat-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');
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
  els.welcomeName.textContent = `Welcome, ${displayName}`;
  els.roleChip.textContent = roleLabel(profile.role);
  els.positionChip.hidden = !position;
  els.positionChip.textContent = position;

  if (!profile.memberName) {
    els.memberLinkNote.textContent = 'Your profile is created, but attendance has not been linked yet. Please contact admin.';
  } else if (!my.totalCounted) {
    els.memberLinkNote.textContent = 'No attendance has been recorded yet.';
  } else {
    els.memberLinkNote.textContent = `${profile.memberName}${position ? ` - ${position}` : ''}`;
  }

  const role = String(profile.role || '').toLowerCase();
  els.adminPanelBtn.hidden = !(role === 'admin' || role === 'president');
  els.bodPanelBtn.hidden = !(role === 'bod' || role === 'admin' || role === 'president');

  els.kpiAttendance.textContent = `${my.percentage || 0}%`;
  els.kpiPresent.textContent = Number(my.present || 0);
  els.kpiAbsent.textContent = Number(my.absent || 0);
  els.kpiRank.textContent = club.myRank ? `#${club.myRank}` : '-';
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

function progressStatus(percent) {
  if (percent >= 100) return 'Ready for Review';
  if (percent >= 67) return 'Almost There';
  if (percent > 0) return 'In Progress';
  return 'Getting Started';
}

function setCriterionState(item, complete) {
  item.classList.toggle('is-complete', complete);
}

function renderProspectDashboard(data) {
  const profile = data.profile || {};
  const progress = data.prospectProgress || {};
  const criteria = progress.criteria || {};
  const requiredGbm = Math.max(1, Number(criteria.requiredGbm) || REQUIRED_GBM);
  const requiredAvenueEvents = Math.max(1, Number(criteria.requiredAvenueEvents) || REQUIRED_AVENUE_EVENTS);
  const gbmAttended = Math.max(0, Number(progress.gbmAttended) || 0);
  const avenueEventsAttended = Math.max(0, Number(progress.avenueEventsAttended) || 0);
  const duesPaid = progress.duesPaid === true;
  const gbmComplete = gbmAttended >= requiredGbm;
  const avenueComplete = avenueEventsAttended >= requiredAvenueEvents;
  const completedFallback = [gbmComplete, avenueComplete, duesPaid].filter(Boolean).length;
  const completedCount = Math.max(0, Number(progress.completedCount) || completedFallback);
  const totalCount = Math.max(1, Number(progress.totalCount) || 3);
  const calculatedPercent = Math.round((completedCount / totalCount) * 100);
  const suppliedPercent = Number(progress.percent);
  const percent = Math.max(0, Math.min(100, Number.isFinite(suppliedPercent) ? suppliedPercent : calculatedPercent));
  const displayName = profile.name || 'Prospect';

  document.title = 'My Dashboard';
  els.dashboardTitle.textContent = 'My Dashboard';
  setDashboardMode(true);
  els.welcomeName.textContent = `Welcome, ${displayName}`;
  els.roleChip.textContent = 'Prospect';
  els.positionChip.hidden = true;
  els.positionChip.setAttribute('hidden', '');
  els.memberLinkNote.textContent = 'You are currently a Prospect Member. Complete the onboarding criteria below to become an official RCPH member.';
  els.adminPanelBtn.hidden = true;
  els.bodPanelBtn.hidden = true;

  els.prospectProgressStatus.textContent = progressStatus(percent);
  els.prospectProgressPercent.textContent = `${percent}%`;
  els.prospectProgressCount.textContent = `${completedCount} of ${totalCount} criteria complete`;
  els.prospectProgressFill.style.width = `${percent}%`;
  els.prospectProgressTrack.setAttribute('aria-valuenow', String(percent));
  els.prospectGbmValue.textContent = `${gbmAttended} / ${requiredGbm} attended`;
  els.prospectAvenueValue.textContent = `${avenueEventsAttended} / ${requiredAvenueEvents} attended`;
  els.prospectDuesValue.textContent = duesPaid ? 'Paid' : 'Not paid';
  setCriterionState(els.prospectGbmItem, gbmComplete);
  setCriterionState(els.prospectAvenueItem, avenueComplete);
  setCriterionState(els.prospectDuesItem, duesPaid);
  renderUpcoming(els.prospectUpcomingEvents, data.upcomingEvents || []);
  showDashboard();
}

function renderDashboard(data) {
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

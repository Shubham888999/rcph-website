const auth = window.auth;
const db = window.db;
const dashboardFunction = firebase.functions().httpsCallable('getMyDashboardStats');

const els = {
  loading: document.getElementById('loadingState'),
  error: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  content: document.getElementById('dashboardContent'),
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
  eventsByAvenue: document.getElementById('eventsByAvenue')
};

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function roleLabel(role) {
  const labels = {
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
  els.error.hidden = true;
  els.content.hidden = true;
}

function showError(message) {
  els.loading.hidden = true;
  els.error.hidden = false;
  els.content.hidden = true;
  els.errorMessage.textContent = message || 'Something went wrong.';
}

function showDashboard() {
  els.loading.hidden = true;
  els.error.hidden = true;
  els.content.hidden = false;
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

function renderUpcoming(events) {
  if (!events || !events.length) {
    els.upcomingEvents.innerHTML = '<p class="subtle">No upcoming public events yet.</p>';
    return;
  }

  els.upcomingEvents.innerHTML = events.map(event => `
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

function renderDashboard(data) {
  const profile = data.profile || {};
  const my = data.myAttendance || {};
  const district = data.districtAttendance || {};
  const club = data.clubStats || {};
  const displayName = profile.name || profile.memberName || 'Member';
  const position = profile.memberPosition || profile.clubPosition || '';

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
  renderUpcoming(data.upcomingEvents || []);
  renderEventsByAvenue(club.eventsByAvenue || []);
  showDashboard();
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

/**
 * Insights panel calculations and chart rendering helpers.
 */

function isExcludedFromAttendanceRanking(member) {
  const name = String(member?.name || '').trim().toLowerCase();
  return name === 'shubham deshpande';
}
function renderAttendanceInsights(){
  const { members, events } = getFilteredMembersAndEvents();
  document.getElementById('attEvtCount').textContent = events.length || '0';

  let totalSlots = 0, totalPresent = 0;
  const perEventPresent = events.map(ev => {
    let c = 0, considered = 0;
    members.forEach(m => {
      const v = (ATT[m.id] || {})[ev.id];
      if (v !== 'NA') { considered++; if (v === true) c++; }
    });
    totalSlots += considered;
    totalPresent += c;
    return c;
  });

  const avg = totalSlots ? Math.round((totalPresent/totalSlots)*100) : 0;
  document.getElementById('attAvg').textContent = `${avg}%`;

  const perMemberPresent = members
    .filter(m => !isExcludedFromAttendanceRanking(m))
    .map(m => {
      let c = 0;
      events.forEach(ev => {
        if ((ATT[m.id] || {})[ev.id] === true) c++;
      });
      return { name: m.name || '', c };
    })
    .sort((a, b) => b.c - a.c)
    .slice(0, 3);

  const attTopEl = document.getElementById('attTop');
  if (attTopEl) {
    attTopEl.textContent =
      perMemberPresent.length
        ? perMemberPresent.map(x => `${x.name.split(' ')[0]}(${x.c})`).join(', ')
        : '–';
  }

  const ctx = document.getElementById('attChart');
  drawChart('att', ctx, {
    type:'bar',
    data:{
      labels: events.map(e => e.name || ''),
      datasets:[{ label:'Present', data: perEventPresent }]
    },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}
function renderInsightsPanel() {
  if (!insightSummaryList) return;

  const totalMembers = MEMBERS.length;
  const totalEvents = EVENTS.length;

  let totalSlots = 0;
  let totalPresent = 0;

  const memberStats = MEMBERS
    .filter(m => !isExcludedFromAttendanceRanking(m))
    .map(m => {
      const att = ATT[m.id] || {};
      const vals = EVENTS.map(e => att[e.id]);
      const considered = vals.filter(v => v !== 'NA');
      const total = considered.length;
      const present = considered.filter(v => v === true).length;
      const pct = total ? Math.round((present / total) * 100) : 0;

      totalSlots += total;
      totalPresent += present;

      return {
        name: m.name || '',
        total,
        present,
        pct
      };
    });

  const overallPct = totalSlots ? Math.round((totalPresent / totalSlots) * 100) : 0;

  let attendanceHealth = '';
  if (overallPct >= 85) attendanceHealth = 'Excellent';
  else if (overallPct >= 70) attendanceHealth = 'Good';
  else if (overallPct >= 55) attendanceHealth = 'Average';

  const MIN_ATTENDANCE_PCT = 33.33;
const lowAttendanceMembers = memberStats.filter(m => m.pct < MIN_ATTENDANCE_PCT && m.total > 0);

  const avenueCounts = {
    ISD: 0, CMD: 0, CSD: 0, PDD: 0, RRRO: 0, PRO: 0, DEI: 0, GBM: 0, Other: 0
  };

  EVENTS.forEach(ev => {
    const avs = Array.isArray(ev.avenues) ? ev.avenues : (ev.avenue ? [ev.avenue] : []);
    if (!avs.length) {
      avenueCounts.Other++;
    } else {
      avs.forEach(a => {
        if (avenueCounts[a] !== undefined) avenueCounts[a]++;
        else avenueCounts.Other++;
      });
    }
  });

  const topAvenueEntry = Object.entries(avenueCounts).sort((a,b) => b[1] - a[1])[0];
  const topAvenue = topAvenueEntry ? `${topAvenueEntry[0]} (${topAvenueEntry[1]})` : '–';

  const recentEvents = [...EVENTS]
    .filter(e => e.date)
    .sort((a,b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  let recentTotalSlots = 0;
  let recentTotalPresent = 0;

  recentEvents.forEach(ev => {
    MEMBERS.forEach(m => {
      const v = (ATT[m.id] || {})[ev.id];
      if (v !== 'NA') {
        recentTotalSlots++;
        if (v === true) recentTotalPresent++;
      }
    });
  });

  const recentPct = recentTotalSlots ? Math.round((recentTotalPresent / recentTotalSlots) * 100) : 0;
  const trendText =
    recentPct > overallPct ? `Improving ↑ (${recentPct}%)`
    : recentPct < overallPct ? `Dropping ↓ (${recentPct}%)`
    : `Stable → (${recentPct}%)`;

  if (insightAttendanceHealth) insightAttendanceHealth.textContent = `${attendanceHealth} (${overallPct}%)`;
  if (insightLowAttendance) insightLowAttendance.textContent = `${lowAttendanceMembers.length}`;
  if (insightTopAvenue) insightTopAvenue.textContent = topAvenue;
  if (insightTrend) insightTrend.textContent = trendText;

  const top3 = memberStats
    .filter(m => m.total > 0)
    .sort((a,b) => b.pct - a.pct)
    .slice(0, 3);

  const low3 = lowAttendanceMembers
    .sort((a,b) => a.pct - b.pct)
    .slice(0, 3);

  const lines = [];

  if (top3.length) {
    lines.push(`<div class="insight-item"><strong>Top Attendees:</strong> ${top3.map(x => `${x.name.split(' ')[0]} (${x.pct}%)`).join(', ')}</div>`);
  }

  if (low3.length) {
    lines.push(`<div class="insight-item"><strong>Low Attendees:</strong> ${low3.map(x => `${x.name.split(' ')[0]} (${x.pct}%)`).join(', ')}</div>`);
  } else {
    lines.push(`<div class="insight-item"><strong>Great sign:</strong> No members are currently below the 60% attendance threshold.</div>`);
  }

  insightSummaryList.innerHTML = lines.join('');
}

const COLLAB_RCPH_NAME = 'Rotaract Club of Pune Heritage';

function isCollaborationReportsExpanded() {
  return !collaborationReportsBody || collaborationReportsBody.hidden === false;
}

function setCollaborationReportsExpanded(expanded, shouldScroll = false) {
  if (!collaborationReportsBody || !collaborationReportsToggle) return;

  collaborationReportsBody.hidden = !expanded;
  collaborationReports?.classList.toggle('is-collapsed', !expanded);
  collaborationReports?.classList.toggle('is-expanded', expanded);
  collaborationReportsToggle.setAttribute('aria-expanded', String(expanded));
  if (collaborationReportsToggleText) {
    collaborationReportsToggleText.textContent = expanded ? 'Hide Reports' : 'Show Reports';
  }
  if (collaborationReportsChevron) {
    collaborationReportsChevron.setAttribute('aria-hidden', 'true');
  }

  if (expanded) {
    requestAnimationFrame(() => {
      renderCollaborationReports();
      if (shouldScroll) collaborationReports?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  } else if (shouldScroll) {
    collaborationReports?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function normalizeCollabRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ['host', 'cohost', 'collaborator', 'participant'].includes(role) ? role : 'host';
}

function collabRoleLabel(value) {
  return {
    host: 'Host Club',
    cohost: 'Co-host',
    collaborator: 'Collaborating Club',
    participant: 'Participating Club'
  }[normalizeCollabRole(value)];
}

function collabAvenues(eventData) {
  const raw = Array.isArray(eventData?.avenue)
    ? eventData.avenue
    : (Array.isArray(eventData?.avenues) ? eventData.avenues : (eventData?.avenue ? [eventData.avenue] : []));
  return raw.map(a => String(a || '').trim()).filter(Boolean);
}

function collabPartners(collaborators) {
  if (!Array.isArray(collaborators)) return [];
  const seen = new Set();
  return collaborators
    .map(item => String(typeof item === 'string' ? item : item?.name || '').trim())
    .filter(name => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatCollabPartners(collaborators) {
  return collabPartners(collaborators).join(', ');
}

function isRcphClubName(name) {
  return String(name || '').trim().toLowerCase() === COLLAB_RCPH_NAME.toLowerCase();
}

function buildCollaborationFilters() {
  if (!collabMonthFilter || !collabAvenueFilter) return;

  const selectedMonth = collabMonthFilter.value;
  const selectedAvenue = collabAvenueFilter.value;
  const months = new Set();
  const avenues = new Set();

  EVENTS.forEach(ev => {
    if (ev.date) months.add(String(ev.date).slice(0, 7));
    const avs = collabAvenues(ev);
    if (!avs.length) avenues.add('Other');
    avs.forEach(a => avenues.add(a));
  });

  const monthOptions = Array.from(months).sort().reverse();
  collabMonthFilter.innerHTML = '<option value="">All months</option>' +
    monthOptions.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  collabMonthFilter.value = monthOptions.includes(selectedMonth) ? selectedMonth : '';

  const avenueOptions = Array.from(avenues).sort((a, b) => a.localeCompare(b));
  collabAvenueFilter.innerHTML = '<option value="">All avenues</option>' +
    avenueOptions.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  collabAvenueFilter.value = avenueOptions.includes(selectedAvenue) ? selectedAvenue : '';
}

function getFilteredCollaborationEvents() {
  const month = collabMonthFilter?.value || '';
  const avenue = collabAvenueFilter?.value || '';
  const role = collabRoleFilter?.value || '';
  const q = String(collabSearch?.value || '').trim().toLowerCase();

  return EVENTS.filter(ev => {
    const evRole = normalizeCollabRole(ev.rcphRole);
    const avs = collabAvenues(ev);
    const partnerText = formatCollabPartners(ev.collaborators);
    const hostClub = ev.hostClub || COLLAB_RCPH_NAME;

    if (month && !String(ev.date || '').startsWith(month)) return false;
    if (avenue && !avs.includes(avenue)) return false;
    if (role && evRole !== role) return false;

    if (q) {
      const hay = [
        ev.name,
        hostClub,
        partnerText,
        ev.createdByName,
        ev.createdByEmail,
        ev.createdBy
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

function renderCollaborationReports() {
  if (!collabReportBody) return;

  const rows = getFilteredCollaborationEvents();
  const roleCounts = { host: 0, cohost: 0, collaborator: 0, participant: 0 };
  const avenueCounts = {};
  const uniquePartners = new Set();

  rows.forEach(ev => {
    const role = normalizeCollabRole(ev.rcphRole);
    const hostClub = ev.hostClub || COLLAB_RCPH_NAME;
    roleCounts[role] += 1;

    const avs = collabAvenues(ev);
    if (!avs.length) avenueCounts.Other = (avenueCounts.Other || 0) + 1;
    avs.forEach(a => { avenueCounts[a] = (avenueCounts[a] || 0) + 1; });

    collabPartners(ev.collaborators).forEach(name => uniquePartners.add(name.toLowerCase()));
    if ((role === 'collaborator' || role === 'participant') && hostClub && !isRcphClubName(hostClub)) {
      uniquePartners.add(hostClub.toLowerCase());
    }
  });

  if (collabTotalEvents) collabTotalEvents.textContent = String(rows.length);
  if (collabHostedCount) collabHostedCount.textContent = String(roleCounts.host);
  if (collabCohostedCount) collabCohostedCount.textContent = String(roleCounts.cohost);
  if (collabCollaboratorCount) collabCollaboratorCount.textContent = String(roleCounts.collaborator);
  if (collabParticipantCount) collabParticipantCount.textContent = String(roleCounts.participant);
  if (collabUniquePartners) collabUniquePartners.textContent = String(uniquePartners.size);
  if (collaborationReportsBadge) {
    collaborationReportsBadge.textContent = rows.length === 1 ? '1 event' : `${rows.length} events`;
  }

  const avenueEntries = Object.entries(avenueCounts).sort((a, b) => b[1] - a[1]);
  if (isCollaborationReportsExpanded()) {
    drawChart('collabRole', collabRoleChart, {
      type: 'doughnut',
      data: {
        labels: ['Host Club', 'Co-host', 'Collaborating Club', 'Participating Club'],
        datasets: [{
          data: [roleCounts.host, roleCounts.cohost, roleCounts.collaborator, roleCounts.participant],
          backgroundColor: ['#f4b43a', '#60c3c4', '#9b59b6', '#95a5a6']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    drawChart('collabAvenue', collabAvenueChart, {
      type: 'bar',
      data: {
        labels: avenueEntries.map(([name]) => name),
        datasets: [{ label: 'Events', data: avenueEntries.map(([, count]) => count), backgroundColor: '#60c3c4' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  collabReportBody.innerHTML = rows.map(ev => {
    const avs = collabAvenues(ev);
    const partners = collabPartners(ev.collaborators);
    const createdBy = ev.createdByName || ev.createdByEmail || ev.createdBy || '-';
    return `
      <tr>
        <td>${escapeHtml(ev.name || '-')}</td>
        <td>${escapeHtml(formatDate(ev.date))}</td>
        <td>${escapeHtml(avs.length ? avs.join(', ') : 'Other')}</td>
        <td><span class="collab-role-chip collab-role-${normalizeCollabRole(ev.rcphRole)}">${escapeHtml(collabRoleLabel(ev.rcphRole))}</span></td>
        <td>${escapeHtml(ev.hostClub || COLLAB_RCPH_NAME)}</td>
        <td>${partners.length ? partners.map(name => `<span class="collab-partner-chip">${escapeHtml(name)}</span>`).join('') : '-'}</td>
        <td>${escapeHtml(createdBy)}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="7">No collaboration records match these filters.</td></tr>';
}

function exportCollaborationReports() {
  if (!window.XLSX) {
    alert('Excel exporter not loaded.');
    return;
  }

  const rows = getFilteredCollaborationEvents();
  const data = rows.map(ev => ({
    Event: ev.name || '',
    Date: ev.date || '',
    Avenue: collabAvenues(ev).join(', ') || 'Other',
    'RCPH Role': collabRoleLabel(ev.rcphRole),
    'Host Club': ev.hostClub || COLLAB_RCPH_NAME,
    Collaborators: formatCollabPartners(ev.collaborators),
    'Collaboration Notes': ev.collaborationNotes || '',
    'Created By': ev.createdByName || ev.createdByEmail || ev.createdBy || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 34 }, { wch: 14 }, { wch: 18 }, { wch: 22 },
    { wch: 34 }, { wch: 42 }, { wch: 50 }, { wch: 28 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Collaboration Reports');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `collaboration_reports_${stamp}.xlsx`);
}

[collabMonthFilter, collabAvenueFilter, collabRoleFilter].forEach(el => {
  if (el) el.addEventListener('change', renderCollaborationReports);
});
if (collabSearch) collabSearch.addEventListener('input', renderCollaborationReports);
if (exportCollabXlsxBtn) exportCollabXlsxBtn.addEventListener('click', exportCollaborationReports);
if (collaborationReportsToggle) {
  collaborationReportsToggle.addEventListener('click', () => {
    setCollaborationReportsExpanded(!isCollaborationReportsExpanded());
  });
}
if (collaborationReportsCard) {
  collaborationReportsCard.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    setCollaborationReportsExpanded(!isCollaborationReportsExpanded());
  });
}
document.querySelectorAll('a[href="#collaborationReports"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState(null, '', '#collaborationReports');
    setCollaborationReportsExpanded(true, true);
  });
});
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#collaborationReports') {
    setCollaborationReportsExpanded(true, true);
  }
});
if (window.location.hash === '#collaborationReports') {
  setTimeout(() => setCollaborationReportsExpanded(true, true), 0);
}



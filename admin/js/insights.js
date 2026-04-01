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



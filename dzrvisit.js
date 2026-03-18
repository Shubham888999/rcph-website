function getGdriveImageUrl(url) {
  if (!url) return "";
  // Check for standard Drive share links
  if (url.includes("drive.google.com")) {
    const idMatch = url.match(/[-\w]{25,}/);
    if (idMatch) {
      // Use the thumbnail endpoint
      return `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=s1000`;
    }
  }
  return url;
}
/* global firebase */
const auth = window.auth;
const db   = window.db;
const signOutBtn = document.getElementById('dzrSignOut');
if (signOutBtn) {
  signOutBtn.addEventListener('click', async () => {
    try { await auth.signOut(); location.href = 'login.html'; }
    catch (e) { alert(e.message || 'Sign out failed'); }
  });
}
/* DOM */
const mSearch   = document.getElementById('dzrMemberSearch');
const mSelect   = document.getElementById('dzrMemberSelect');
const mAllBtn   = document.getElementById('dzrMemberAll');

const eSearch   = document.getElementById('dzrEventSearch');
const eSelect   = document.getElementById('dzrEventSelect');
const eAllBtn   = document.getElementById('dzrEventAll');
const monthSel  = document.getElementById('dzrMonthFilter');

const attHead   = document.getElementById('dzrAttHead');
const attBody   = document.getElementById('dzrAttBody');
const evtCount  = document.getElementById('dzrEvtCount');
const avgSpan   = document.getElementById('dzrAvg');
const topSpan   = document.getElementById('dzrTop');

const bodSearch = document.getElementById('dzrBodSearch');
const bodSelect = document.getElementById('dzrBodSelect');
const bodAllBtn = document.getElementById('dzrBodAll');

const meetSearch= document.getElementById('dzrMeetSearch');
const meetSelect= document.getElementById('dzrMeetSelect');
const meetAllBtn= document.getElementById('dzrMeetAll');

const bodHead   = document.getElementById('dzrBodHead');
const bodBody   = document.getElementById('dzrBodBody');
const meetCount = document.getElementById('dzrMeetCount');
const bodAvg    = document.getElementById('dzrBodAvg');
const bodTop    = document.getElementById('dzrBodTop');

const finesBody   = document.getElementById('dzrFinesBody');
const finesTotal  = document.getElementById('dzrFinesTotal');
const finesMonth  = document.getElementById('dzrFinesMonth');
const finesCount  = document.getElementById('dzrFinesCount');

const treBody   = document.getElementById('dzrTreBody');
const treIncEl  = document.getElementById('dzrTreInc');
const treExpEl  = document.getElementById('dzrTreExp');
const treNetEl  = document.getElementById('dzrTreNet');

const drrClubRankEl      = document.getElementById('drrClubRank');
const drrMemberStrengthEl= document.getElementById('drrMemberStrength');
const drrMaleCountEl     = document.getElementById('drrMaleCount');
const drrFemaleCountEl   = document.getElementById('drrFemaleCount');
const drrGenderRatioEl   = document.getElementById('drrGenderRatio');
const drrTotalEventsEl   = document.getElementById('drrTotalEvents');
const drrAvenueGridEl    = document.getElementById('drrAvenueGrid');

let TREAS = [];


let FINES = [];
let MEMBERS=[], EVENTS=[], ATT={};
let BODM=[], BODMEET=[], BODATT={};

// Auth guard: allow dzr/admin/president
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = 'login.html'; return; }

  try {
    const snap = await db.collection('roles').doc(user.uid).get();
    const role = snap.exists ? String(snap.data().role || '').toLowerCase() : '';

    const goAdminBtn = document.getElementById('goAdminBtn');
    const goBodBtn   = document.getElementById('goBodBtn');

    // Allow only dzr / president / admin
    if (role === 'dzr' || role === 'president' || role === 'admin') {

      // Navigation buttons: only president gets cross-panel jumps
      if (role === 'president') {
        if (goAdminBtn) {
          goAdminBtn.style.display = 'inline-block';
          goAdminBtn.onclick = () => location.href = 'admin.html';
        }
        if (goBodBtn) {
          goBodBtn.style.display = 'inline-block';
          goBodBtn.onclick = () => location.href = 'bodlogin.html';
        }
      } else {
        // hide them for dzr/admin
        if (goAdminBtn) goAdminBtn.style.display = 'none';
        if (goBodBtn)   goBodBtn.style.display   = 'none';
      }

      // finally load the page
      start();
      return;
    }

    // ❌ Any other role is not allowed here
    if (role === 'bod') {
      location.href = 'bodlogin.html';
    } else {
      location.href = 'login.html';
    }
  } catch (e) {
    console.warn('Role check on DZR page failed:', e);
    location.href = 'login.html';
  }
});

function initLemonadeAnimations() {
  if (!window.lottie) return;

  const leftEl = document.getElementById('lemonadeLeft');
  const rightEl = document.getElementById('lemonadeRight');

  if (leftEl) {
    lottie.loadAnimation({
      container: leftEl,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'Lemonade.json'
    });
  }

  if (rightEl) {
    lottie.loadAnimation({
      container: rightEl,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'Lemonade.json'
    });
  }
}
function initButterflies() {
  if (!window.lottie) return;

  const left = document.getElementById('butterflyLeft');
  const right = document.getElementById('butterflyRight');

  if (left) {
    lottie.loadAnimation({
      container: left,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'butterfly 04.json'
    });
  }

  if (right) {
    lottie.loadAnimation({
      container: right,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'butterfly 04.json'
    });
  }
}
function initKpiPalmTrees() {
  if (!window.lottie) return;

  const palms = [
    { id: 'kpiPalm1', scale: 2.0 },
    { id: 'kpiPalm2', scale: 1.95 },
    { id: 'kpiPalm3', scale: 2.05 }
  ];

  palms.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return;

    lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'Palm Tree Leaf Animation.json'
    });
  });
}
async function start(){
  initLemonadeAnimations();
  initButterflies();
  initKpiPalmTrees();
  await Promise.all([
    loadAttendance(),
    loadBOD(),
    loadFinesOnce(),
    loadTreasuryOnce()
  ]);

  attachListeners();
  attachFinesListener();
  attachTreasuryListener();

  renderClubMetrics();   // NEW
  renderAttendance();
  renderBOD();
  renderTreasury();
}

/* ---------- Attendance (members/events) ---------- */
async function loadAttendance(){
  const [mSnap, eSnap, aSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get(),
    db.collection('attendance').get()
  ]);
  MEMBERS = mSnap.docs.map(d=>({id:d.id, ...d.data()}));
  EVENTS  = eSnap.docs.map(d=>({id:d.id, ...d.data()}));
  ATT     = {};
  aSnap.forEach(d=>{ ATT[d.id] = d.data() || {}; });

  // populate selects
  mSelect.innerHTML = MEMBERS.map(m => `<option value="${m.id}">${(m.name||'').replace(/</g,'&lt;')}</option>`).join('');
  eSelect.innerHTML = EVENTS.map(e => `<option value="${e.id}">${(e.name||'').replace(/</g,'&lt;')}</option>`).join('');

  // month filter
  monthSel.innerHTML = '<option value="">All months</option>';
  Array.from(new Set(EVENTS.map(e => (e.date||'').slice(0,7))))
    .filter(Boolean).sort()
    .forEach(ym => {
      const o = document.createElement('option');
      o.value = ym;
      const [y,m] = ym.split('-').map(Number);
      const d = new Date(y,m-1,1);
      o.textContent = d.toLocaleString(undefined,{month:'long', year:'numeric'});
      monthSel.appendChild(o);
    });
}

function renderAttendance(){
  const memQuery = (mSearch.value||'').toLowerCase();
  const evQuery  = (eSearch.value||'').toLowerCase();
  const month    = monthSel.value;

  const chosenMembers = Array.from(mSelect.selectedOptions).map(o=>o.value);
  const chosenEvents  = Array.from(eSelect.selectedOptions).map(o=>o.value);

  const members = MEMBERS
    .filter(m => (m.name||'').toLowerCase().includes(memQuery))
    .filter(m => !chosenMembers.length || chosenMembers.includes(m.id));

  let events = EVENTS
    .filter(e => (e.name||'').toLowerCase().includes(evQuery))
    .filter(e => !month || (e.date||'').startsWith(month))
    .filter(e => !chosenEvents.length || chosenEvents.includes(e.id));

  const h = document.createElement('tr');
  h.innerHTML =
    `<th class="sticky-col">Member \\ Event</th>` +
    events.map(e => `
      <th title="${e.date || ''}">
        <div class="ev-head">
          <strong>${e.name || ''}</strong>
          <small>${(e.date || '').slice(0,10)}</small>
        </div>
      </th>
    `).join('');

  attHead.innerHTML = '';
  attHead.appendChild(h);

  attBody.innerHTML = '';

  let totalSlots = 0, totalPresent = 0;
  const topCounts = [];
  const perEventPresent = [];

  members.forEach(m => {
    const att = ATT[m.id] || {};
    const tr = document.createElement('tr');

    const values = events.map(e => att[e.id]);
    const considered = values.filter(v => v !== 'NA');
    const total = considered.length;
    const present = considered.filter(v => v === true).length;

    totalSlots += total;
    totalPresent += present;
    topCounts.push({ name: m.name || '', c: present });

    tr.innerHTML = `
      <td class="sticky-col">
        <div class="mem-left">
          <div class="stat-box">
            <span class="stat">All: ${present}/${total} · ${total ? Math.round((present/total)*100) : 0}%</span>
          </div>
          <div>${(m.name || '').replace(/</g,'&lt;')}</div>
        </div>
      </td>
    ` + events.map(e => {
      const v = att[e.id];
      let cls = 'off';
      let aria = 'Absent';

      if (v === true) {
        cls = 'on';
        aria = 'Present';
      } else if (v === 'NA') {
        cls = 'na';
        aria = 'Not applicable';
      }

      return `<td><button class="cell-btn ${cls}" aria-label="${aria}" tabindex="-1"></button></td>`;
    }).join('');

    attBody.appendChild(tr);
  });

  events.forEach(ev => {
    let c = 0;
    members.forEach(m => {
      if ((ATT[m.id] || {})[ev.id] === true) c++;
    });
    perEventPresent.push(c);
  });

  evtCount.textContent = events.length;
  avgSpan.textContent  = totalSlots ? `${Math.round((totalPresent/totalSlots)*100)}%` : '—';
  topSpan.textContent  =
    topCounts.sort((a,b)=>b.c-a.c).slice(0,3).map(x=>`${x.name.split(' ')[0]}(${x.c})`).join(', ') || '—';

  const ctx = document.getElementById('dzrAttChart');
  if (window.Chart && ctx) {
    if (window._dzrAttChart) window._dzrAttChart.destroy();
    window._dzrAttChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: events.map(e => e.name || ''),
        datasets: [{ label: 'Present', data: perEventPresent }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

/* ---------- BOD Attendance ---------- */
async function loadBOD(){
  const [mSnap, tSnap, aSnap] = await Promise.all([
    db.collection('bodMembers').orderBy('name').get(),
    db.collection('bodMeetings').orderBy('date','desc').get(),
    db.collection('bodAttendance').get()
  ]);
  BODM    = mSnap.docs.map(d=>({id:d.id, ...d.data()}));
  BODMEET = tSnap.docs.map(d=>({id:d.id, ...d.data()}));
  BODATT  = {};
  aSnap.forEach(d=>{ BODATT[d.id] = d.data() || {}; });

  bodSelect.innerHTML = BODM.map(m => `<option value="${m.id}">${(m.name||'').replace(/</g,'&lt;')} — ${(m.position||'')}</option>`).join('');
  meetSelect.innerHTML= BODMEET.map(t => `<option value="${t.id}">${(t.name||'').replace(/</g,'&lt;')}</option>`).join('');
}

function renderBOD(){
  const bodQ  = (bodSearch.value||'').toLowerCase();
  const meetQ = (meetSearch.value||'').toLowerCase();

  const chosenBod  = Array.from(bodSelect.selectedOptions).map(o=>o.value);
  const chosenMeet = Array.from(meetSelect.selectedOptions).map(o=>o.value);

  const members = BODM
    .filter(m => ((m.name||'') + ' ' + (m.position||'')).toLowerCase().includes(bodQ))
    .filter(m => !chosenBod.length || chosenBod.includes(m.id));

  const meetings = BODMEET
    .filter(t => (t.name||'').toLowerCase().includes(meetQ))
    .filter(t => !chosenMeet.length || chosenMeet.includes(t.id));

  const h = document.createElement('tr');
  h.innerHTML =
    `<th class="sticky-col">BOD \\ Meeting<br><small>Position</small></th>` +
    meetings.map(t => `
      <th title="${t.date||''}">
        <div class="ev-head">
          <strong>${t.name||''}</strong>
          <small>${(t.date||'').slice(0,10)}</small>
        </div>
      </th>
    `).join('');

  bodHead.innerHTML = '';
  bodHead.appendChild(h);

  bodBody.innerHTML = '';

  let totalSlots = 0, totalPresent = 0;
  const topCounts = [];
  const perMeetingPresent = [];

  members.forEach(m => {
    const att = BODATT[m.id] || {};
    const values = meetings.map(t => att[t.id]);
    const considered = values.filter(v => v !== 'NA');
    const total = considered.length;
    const present = considered.filter(v => v === true).length;

    totalSlots += total;
    totalPresent += present;
    topCounts.push({ name: m.name || '', c: present });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="sticky-col">
        <div class="mem-left">
          <div class="stat-box">
            <span class="stat">All: ${present}/${total} · ${total ? Math.round((present/total)*100) : 0}%</span>
          </div>
          <div>
            ${(m.name || '').replace(/</g,'&lt;')}<br>
            <small>${(m.position || '').replace(/</g,'&lt;')}</small>
          </div>
        </div>
      </td>
    ` + meetings.map(t => {
      const v = att[t.id];
      let cls = 'off';
      let aria = 'Absent';

      if (v === true) {
        cls = 'on';
        aria = 'Present';
      } else if (v === 'NA') {
        cls = 'na';
        aria = 'Not applicable';
      }

      return `<td><button class="cell-btn ${cls}" aria-label="${aria}" tabindex="-1"></button></td>`;
    }).join('');

    bodBody.appendChild(tr);
  });

  meetings.forEach(mt => {
    let c = 0;
    members.forEach(m => {
      if ((BODATT[m.id] || {})[mt.id] === true) c++;
    });
    perMeetingPresent.push(c);
  });

  meetCount.textContent = meetings.length;
  bodAvg.textContent = totalSlots ? `${Math.round((totalPresent/totalSlots)*100)}%` : '—';
  bodTop.textContent =
    topCounts.sort((a,b)=>b.c-a.c).slice(0,3).map(x=>`${x.name.split(' ')[0]}(${x.c})`).join(', ') || '—';

  const ctx = document.getElementById('dzrBodChart');
  if (window.Chart && ctx) {
    if (window._dzrBodChart) window._dzrBodChart.destroy();
    window._dzrBodChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meetings.map(t => t.name || ''),
        datasets: [{ label: 'Present', data: perMeetingPresent }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

document.querySelectorAll('details').forEach(det => {
    const summary = det.querySelector('summary');
    if (!summary) return;

    let arrow = summary.querySelector('.details-arrow');
    if (!arrow) {
      arrow = document.createElement('span');
      arrow.className = 'details-arrow';
      arrow.textContent = det.open ? '▲' : '▼';
      arrow.style.marginLeft = 'auto';
      arrow.style.transition = 'transform 0.2s ease';
      summary.appendChild(arrow);
    }

    det.addEventListener('toggle', () => {
      arrow.textContent = det.open ? '▲' : '▼';

      if (det.open) {
        const parent = det.parentElement;
        if (parent) {
          Array.from(parent.children).forEach(sib => {
            if (sib !== det && sib.tagName === 'DETAILS' && sib.open) {
              sib.open = false;
            }
          });
        }

        if (det.closest('.panel-grid') || det.parentElement?.tagName === 'DETAILS') {
          setTimeout(() => {
            det.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        }
      }
    });
  });
function normalizeGender(member){
  const raw = String(
    member.gender ||
    member.sex ||
    member.memberGender ||
    ''
  ).trim().toLowerCase();

  if (raw === 'male' || raw === 'm' || raw === 'boy') return 'male';
  if (raw === 'female' || raw === 'f' || raw === 'girl') return 'female';
  return 'unknown';
}

function getEventAvenues(ev){
  const raw = ev.avenues || ev.avenue || [];
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return arr.map(x => String(x).trim()).filter(Boolean);
}

function renderClubMetrics(){
  const CLUB_RANK = '2';
  const MEMBER_STRENGTH = 31;
  const MALE = 13;
  const FEMALE = 18;
  const TOTAL_EVENTS = 62;

  const AVENUES = {
    CMD: 16,
    CSD: 19,
    PDD: 13,
    ISD: 8,
    RRRO: 9,
    PRO: 1,
    DEI: 5,
    GBM: 17
  };

  if (drrClubRankEl) drrClubRankEl.textContent = CLUB_RANK;
  if (drrMemberStrengthEl) drrMemberStrengthEl.textContent = MEMBER_STRENGTH;
  if (drrMaleCountEl) drrMaleCountEl.textContent = MALE;
  if (drrFemaleCountEl) drrFemaleCountEl.textContent = FEMALE;
  if (drrGenderRatioEl) drrGenderRatioEl.textContent = `${MALE} : ${FEMALE}`;
  if (drrTotalEventsEl) drrTotalEventsEl.textContent = TOTAL_EVENTS;

  // Avenue grid
  if (drrAvenueGridEl) {
    drrAvenueGridEl.innerHTML = Object.entries(AVENUES)
      .map(([name, count]) => `
        <div class="avenue-chip">
          <div class="name">${name}</div>
          <div class="count">${count}</div>
        </div>
      `)
      .join('');
  }
}
async function loadFinesOnce() {
  const snap = await db.collection('fines').orderBy('date','desc').get();
  FINES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFinesView();
}

function attachFinesListener() {
  db.collection('fines').orderBy('date','desc')
    .onSnapshot(snap => {
      FINES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFinesView();
    });
}

function renderFinesView(){
  if (!finesBody) return;

  let total = 0, monthTotal = 0;
  const nowYM = new Date().toISOString().slice(0,7);

  const rows = FINES.map(f => {
    const amt = Number(f.amount || 0) || 0;
    total += amt;
    if ((f.date||'').slice(0,7) === nowYM) monthTotal += amt;

    const reasonLabel =
      f.reason === 'missing_badge' ? 'Missing badge' :
      f.reason === 'late' ? 'Late to event/meeting' :
      (f.reason || '');

    return `
      <tr>
        <td>${(f.memberName || '').replace(/</g,'&lt;')}</td>
        <td>₹ ${amt.toLocaleString()}</td>
        <td>${reasonLabel}</td>
        <td>${(f.eventName || '').replace(/</g,'&lt;')}</td>
        <td>${(f.date||'').slice(0,10)}</td>
      </tr>
    `;
  }).join('');

  finesBody.innerHTML = rows || `<tr><td colspan="5" style="opacity:.7">No fines yet.</td></tr>`;
  if (finesTotal) finesTotal.textContent = `₹ ${total.toLocaleString()}`;
  if (finesMonth) finesMonth.textContent = `₹ ${monthTotal.toLocaleString()}`;
  if (finesCount) finesCount.textContent = `${FINES.length}`;
}

async function loadTreasuryOnce(){
  const tSnap = await db.collection('treasury').orderBy('date','desc').get();
  TREAS = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function attachTreasuryListener(){
  db.collection('treasury').orderBy('date','desc')
    .onSnapshot(snap => {
      TREAS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTreasury();
    });
}

function renderTreasury() {
  if (!treBody) return;

  let inc = 0, exp = 0;

  treBody.innerHTML = TREAS.map(t => {
    const amt = Number(t.amount || 0);
    // Normalize type check (case insensitive)
    const type = (t.type || "").toLowerCase();
    if (type === "income") inc += amt;
    else if (type === "expense") exp += amt;

    const dateStr = (t.date || "").slice(0, 10);

    // 1. Use the helper for the image URL
    const thumbUrl = getGdriveImageUrl(t.billUrl);
    
    const billPreview = t.billUrl
      ? `<img src="${thumbUrl}" 
              style="width:60px; height:40px; object-fit:cover; border-radius:6px; cursor:pointer; border:1px solid #333;"
              onclick="window.open('${t.billUrl}', '_blank')"
              alt="Bill"
              onerror="this.style.display='none';this.parentElement.innerText='🔗'">`
      : "—";

    return `
      <tr>
        <td>${(t.name || "-").replace(/</g,'&lt;')}</td>
        <td>${t.type || "-"}</td>
        <td>₹ ${amt.toLocaleString()}</td>
        <td>${(t.avenue || "Other").replace(/</g,'&lt;')}</td>
        <td>${dateStr}</td>
        
        <td>${(t.paidBy || "-").replace(/</g,'&lt;')}</td>
        <td>${(t.reimburse || "-").replace(/</g,'&lt;')}</td>
        <td>${(t.cheque || "-").replace(/</g,'&lt;')}</td>
        
        <td>${billPreview}</td>
      </tr>
    `;
  }).join("");

  if (treIncEl) treIncEl.textContent = "₹ " + inc.toLocaleString();
  if (treExpEl) treExpEl.textContent = "₹ " + exp.toLocaleString();
  if (treNetEl) treNetEl.textContent = "₹ " + (inc - exp).toLocaleString();
}



/* ---------- Interactions ---------- */
function attachListeners(){
  [mSearch,eSearch,monthSel].forEach(el => el.addEventListener('input', renderAttendance));
  [bodSearch,meetSearch].forEach(el => el.addEventListener('input', renderBOD));
  mSelect.addEventListener('change', renderAttendance);
  eSelect.addEventListener('change', renderAttendance);
  bodSelect.addEventListener('change', renderBOD);
  meetSelect.addEventListener('change', renderBOD);

  mAllBtn.addEventListener('click', () => { for (const o of mSelect.options) o.selected = true; renderAttendance(); });
  eAllBtn.addEventListener('click', () => { for (const o of eSelect.options) o.selected = true; renderAttendance(); });
  bodAllBtn.addEventListener('click', () => { for (const o of bodSelect.options) o.selected = true; renderBOD(); });
  meetAllBtn.addEventListener('click', () => { for (const o of meetSelect.options) o.selected = true; renderBOD(); });
}
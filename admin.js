/* Uses global window.auth / window.db created in firebase-init.js */
const auth = window.auth;
const db   = window.db;

/* DOM */
const countBadge  = document.getElementById('countBadge');
const signOutBtn  = document.getElementById('signOutBtn');

const memberSearch = document.getElementById('memberSearch');
const eventSearch  = document.getElementById('eventSearch');
const monthFilter  = document.getElementById('monthFilter');

const addMemberBtn = document.getElementById('addMemberBtn');
const addEventBtn  = document.getElementById('addEventBtn');

const attHead  = document.getElementById('attHead');
const attBody  = document.getElementById('attBody');

/* Modal bits */
const admModal   = document.getElementById('admModal');
const admTitle   = document.getElementById('admModalTitle');
const memberForm = document.getElementById('memberForm');
const eventForm  = document.getElementById('eventForm');
const finesBadge = document.getElementById('finesBadge');
const fineForm   = document.getElementById('fineForm');
const fineMember = document.getElementById('fineMember');
const fineReason = document.getElementById('fineReason');
const fineEvent  = document.getElementById('fineEvent');
const fineDate   = document.getElementById('fineDate');
const finesBody  = document.getElementById('finesBody');
const fineAmount = document.getElementById('fineAmount');
const exportXlsxBtn = document.getElementById('exportXlsxBtn');

const bodCountBadge    = document.getElementById('bodCountBadge');
const bodMemName       = document.getElementById('bodMemName');
const bodMemPos        = document.getElementById('bodMemPos');
const bodAddMemberBtn  = document.getElementById('bodAddMemberBtn');
const bodMeetName      = document.getElementById('bodMeetName');
const bodMeetDate      = document.getElementById('bodMeetDate');
const bodAddMeetingBtn = document.getElementById('bodAddMeetingBtn');
const bodHead          = document.getElementById('bodHead');
const bodBody          = document.getElementById('bodBody');
const exportBodXlsxBtn = document.getElementById('exportBodXlsxBtn');

const treBadge           = document.getElementById('treBadge');
const treName            = document.getElementById('treName');
const treType            = document.getElementById('treType');
const treAmount          = document.getElementById('treAmount');
const treDate            = document.getElementById('treDate');
const treAddBtn          = document.getElementById('treAddBtn');
const treBody            = document.getElementById('treBody');
const exportTreXlsxBtn   = document.getElementById('exportTreXlsxBtn');
const treAvenue = document.getElementById('treAvenue');

const lockAttendanceBtn = document.getElementById('lockAttendanceBtn');
const lockAttendanceState = document.getElementById('lockAttendanceState');

const lockBodAttBtn = document.getElementById('lockBodAttBtn');
const lockBodAttState = document.getElementById('lockBodAttState');

const lockFinesBtn = document.getElementById('lockFinesBtn');
const lockFinesState = document.getElementById('lockFinesState');

const lockTreasuryBtn = document.getElementById('lockTreasuryBtn');
const lockTreasuryState = document.getElementById('lockTreasuryState');

const goBodBtn = document.getElementById('goBodBtn');

let BODM = [];      // [{id, name, position}]
let BODMEET = [];   // [{id, name, date}]
let BODATT = {};    // { bodMemberId: { meetingId: boolean } }
let FINES = [];
let unsubFines = null;
let unsubBodM  = null;
let unsubBodMt = null;
let unsubBodAt = null;

// Treasurer state
let TREAS = []; // [{id, name, type, amount, date, createdAt, createdBy}]
let unsubTre = null;

/* Helper: map memberId -> name for dropdown rendering */
function membersMap() {
  const map = {};
  MEMBERS.forEach(m => map[m.id] = m.name || '');
  return map;
}

let MEMBERS = [];
let EVENTS  = [];
let ATT     = {}; // {memberId: {eventId: boolean}}
let unsubMembers = null;
let unsubEvents  = null;
let unsubAtt     = null; 

const _charts = {};
function drawChart(key, ctx, cfg){
  if (!window.Chart || !ctx) return; // graceful no-chart fallback
  if (_charts[key]) { _charts[key].destroy(); }
  _charts[key] = new Chart(ctx, cfg);
}

// Small utils
const fmt = n => Number(n).toLocaleString();
const yyyymm = d => d.slice(0,7);

let IS_PRESIDENT = false;
/* ---------- Auth guard + role check ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }

  try {
    const snap = await db.collection('roles').doc(user.uid).get();
    const role = snap.exists ? String(snap.data().role).toLowerCase() : null;
    IS_PRESIDENT = (role === 'president');

    // Only redirect if we KNOW they’re not admin.
    if (role && role !== 'admin') {
      window.location.href = 'bodlogin.html';
      return;
    }
  } catch (e) {
    console.warn('Role check failed; continuing to avoid loops:', e);
    // fall through – still show the page
  }

  // ✅ Immediately paint once, then attach realtime listeners
  await startAttendancePage();
});

function watchLock(panelKey, btnEl, badgeEl, onLockedChange) {
  db.collection('locks').doc(panelKey).onSnapshot(snap => {
    const locked = snap.exists && !!snap.data().locked;
    if (badgeEl) badgeEl.textContent = locked ? 'Locked' : 'Unlocked';
    if (btnEl) {
      btnEl.disabled = !IS_PRESIDENT;           // only president can click
      btnEl.textContent = locked ? '🔓' : '🔒';  // flip icon
    }
    onLockedChange?.(locked);
  });
}

// Hook them up:
watchLock('attendance',   lockAttendanceBtn,   lockAttendanceState,   (locked) => {
  // disable attendance UI when locked (buttons/inputs)
  document.querySelectorAll('#attBody .cell-btn, #addMemberBtn, #addEventBtn')
    .forEach(el => el.disabled = locked);
});

watchLock('bodAttendance', lockBodAttBtn, lockBodAttState, (locked) => {
  document.querySelectorAll('#bodBody .cell-btn, #bodAddMemberBtn, #bodAddMeetingBtn')
    .forEach(el => el.disabled = locked);
});

watchLock('fines',        lockFinesBtn,       lockFinesState, (locked) => {
  document.querySelectorAll('#fineForm input, #fineForm select, #fineForm button')
    .forEach(el => el.disabled = locked);
});

watchLock('treasury',     lockTreasuryBtn,    lockTreasuryState, (locked) => {
  document.querySelectorAll('#treForm input, #treForm select, #treForm button')
    .forEach(el => el.disabled = locked);
});

async function toggleLock(panelKey) {
  if (!IS_PRESIDENT) return; // safety
  const ref = db.collection('locks').doc(panelKey);
  const snap = await ref.get();
  const cur = snap.exists && !!snap.data().locked;
  await ref.set({ locked: !cur }, { merge: true });
}

if (lockAttendanceBtn) lockAttendanceBtn.onclick = () => toggleLock('attendance');
if (lockBodAttBtn)     lockBodAttBtn.onclick     = () => toggleLock('bodAttendance');
if (lockFinesBtn)      lockFinesBtn.onclick      = () => toggleLock('fines');
if (lockTreasuryBtn)   lockTreasuryBtn.onclick   = () => toggleLock('treasury');


signOutBtn.addEventListener('click', async () => {
  await auth.signOut();
  location.href = 'login.html';
});
if (goBodBtn) {
  goBodBtn.addEventListener('click', () => {
    // Admins can freely go to BOD panel
    location.href = 'bodlogin.html';
  });
}
/* ---------- Data load ---------- */
async function loadData(){
  const [mSnap, eSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get()
  ]);

  MEMBERS = mSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  EVENTS  = eSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    MEMBERS.map(m => `<option value="${m.id}">${(m.name || '').replace(/</g,'&lt;')}</option>`).join('');

    if (bodHead && bodBody) {
    const [bmSnap, mtSnap, baSnap] = await Promise.all([
      db.collection('bodMembers').orderBy('name').get(),
      db.collection('bodMeetings').orderBy('date','desc').get(),
      db.collection('bodAttendance').get()
    ]);

    BODM    = bmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    BODMEET = mtSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    BODATT = {};
    baSnap.forEach(d => { BODATT[d.id] = d.data() || {}; });

    renderBodGrid();
  }

    if (fineMember) {
  fineMember.innerHTML =
    '<option value="" disabled selected>Member…</option>' +
    MEMBERS.map(m =>
      `<option value="${m.id}">${(m.name || '').replace(/</g,'&lt;')}</option>`
    ).join('');
}

// Default date = today
if (fineDate && !fineDate.value) {
  fineDate.value = new Date().toISOString().slice(0,10);
}

// Fines initial load
if (unsubFines) { unsubFines(); unsubFines = null; }
if (finesBody) {
  unsubFines = db.collection('fines').orderBy('date', 'desc')
    .onSnapshot((snap) => {
      FINES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFines();
    });
}

    if (unsubBodM)  { unsubBodM();  unsubBodM  = null; }
  if (unsubBodMt) { unsubBodMt(); unsubBodMt = null; }
  if (unsubBodAt) { unsubBodAt(); unsubBodAt = null; }
    if (bodHead && bodBody) {
    unsubBodM = db.collection('bodMembers').orderBy('name')
      .onSnapshot(snap => {
        BODM = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderBodGrid();
      });

    unsubBodMt = db.collection('bodMeetings').orderBy('date','desc')
      .onSnapshot(snap => {
        BODMEET = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderBodGrid();
      });

    unsubBodAt = db.collection('bodAttendance')
      .onSnapshot(snap => {
        const next = {};
        snap.forEach(d => { next[d.id] = d.data() || {}; });
        BODATT = next;
        renderBodGrid();
      });
  }

  // Default date = today
  if (fineDate && !fineDate.value) {
    fineDate.value = new Date().toISOString().slice(0,10);
  }

  const fSnap = await db.collection('fines').orderBy('date','desc').get();
  FINES = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFines();


buildMonthFilterFromEvents();

  // attendance (1 doc per member)
  const attSnap = await db.collection('attendance').get();
  ATT = {};
  attSnap.forEach(d => { ATT[d.id] = d.data() || {}; });

  renderGrid();

  if (treBody) {
  if (treDate && !treDate.value) treDate.value = new Date().toISOString().slice(0,10);
  const tSnap = await db.collection('treasury').orderBy('date','desc').get();
  TREAS = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTreasurer();
}
}

async function startAttendancePage() {
  // 1) One-time fetch so the grid renders immediately
  await loadData();

  // 2) Realtime listeners so the grid stays up to date
  attachRealtimeListeners();
}

function attachRealtimeListeners() {
  // Clean up old listeners if they exist
  if (unsubMembers) { unsubMembers(); unsubMembers = null; }
  if (unsubEvents)  { unsubEvents();  unsubEvents  = null; }
  if (unsubAtt)     { unsubAtt();     unsubAtt     = null; }
  if (unsubFines) { unsubFines(); unsubFines = null; }
  
  unsubFines = db.collection('fines').orderBy('date', 'desc')
    .onSnapshot((snap) => {
      FINES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFines();});

  // Members
  unsubMembers = db.collection('members').orderBy('name')
    .onSnapshot((snap) => {
      MEMBERS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderGrid(); // you already rebuild from MEMBERS/EVENTS/ATT
    });

  // Events (also rebuild the month filter when events change)
  unsubEvents = db.collection('events').orderBy('date', 'desc')
    .onSnapshot((snap) => {
      EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      buildMonthFilterFromEvents();
      renderGrid();
    });

  // (Optional) attendance live updates across devices.
  // If you only edit attendance from this page, you can skip this to reduce chatter.
  unsubAtt = db.collection('attendance')
    .onSnapshot((snap) => {
      const next = {};
      snap.forEach(d => { next[d.id] = d.data() || {}; });
      ATT = next;
      renderGrid();
    });

    // Treasurer realtime
if (unsubTre) { unsubTre(); unsubTre = null; }
if (treBody) {
  unsubTre = db.collection('treasury').orderBy('date','desc')
    .onSnapshot(snap => {
      TREAS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTreasurer();
    });
}

}

// Small helper used by both loadData() and realtime event updates
function buildMonthFilterFromEvents() {
  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  monthFilter.innerHTML = '<option value="">All months</option>';
  Array.from(new Set(EVENTS.map(e => (e.date || '').slice(0, 7))))
    .filter(Boolean)
    .sort()
    .forEach(ym => {
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = monthLabel(ym);
      monthFilter.appendChild(opt);
    });
}


/* ---------- Render grid ---------- */
function renderGrid(){
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value; // "" or YYYY-MM

  const members = MEMBERS.filter(m => (m.name || '').toLowerCase().includes(memQuery));

  let events = EVENTS.filter(e => (e.name || '').toLowerCase().includes(evQuery));
  if (monthSel) events = events.filter(e => (e.date || '').startsWith(monthSel));

  // header
  const headRow = document.createElement('tr');
headRow.innerHTML =
  `<th class="sticky-col">Member \\ Event</th>` +
  events.map(e => `
    <th title="${e.date || ''}">
      <div class="ev-head">
        <span>${e.name || ''}</span>
        <small>${(e.date || '').slice(0,10)}</small>
        <button class="icon-btn" title="Rename event" data-edit-event="${e.id}">✏️</button>
        <button class="icon-btn" title="Delete event" data-del-event="${e.id}">🗑</button>
      </div>
    </th>
  `).join('');
  attHead.innerHTML = '';
  attHead.appendChild(headRow);

  // body
  attBody.innerHTML = '';
  members.forEach(m => {
    const tr = document.createElement('tr');
    const attForMember = ATT[m.id] || {};

const values  = events.map(e => attForMember[e.id]);
const considered = values.filter(v => v !== 'NA');  // ignore NA
const total   = considered.length;
const present = considered.filter(v => v === true).length;
    const pct     = total ? Math.round((present/total)*100) : 0;

    // GBM-specific percentage
const gbmIds = events.filter(e => {
  const a = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
  return a.includes('GBM');
}).map(e => e.id);
const gbmValues   = gbmIds.map(id => attForMember[id]);
const gbmConsider = gbmValues.filter(v => v !== 'NA');     // exclude NA
const gbmTotal    = gbmConsider.length;
const gbmPresent  = gbmConsider.filter(v => v === true).length;
const gbmPct      = gbmTotal ? Math.round((gbmPresent/gbmTotal)*100) : 0;

    tr.innerHTML =
      `
      <td class="sticky-col">
        <div class="mem-left">
          <div class="stat-box" title="Across visible columns">
            <span class="stat">All: ${present}/${total} · ${pct}%</span>
            <span class="stat">GBM: ${gbmPresent}/${gbmTotal} · ${gbmPct}%</span>
          </div>
          <div class="mem-cell">
            <span>${m.name || ''}</span>
            <button class="icon-btn" title="Rename member" data-edit-member="${m.id}">✏️</button>
            <button class="icon-btn" title="Delete member" data-del-member="${m.id}">🗑</button>
          </div>
        </div>
      </td>
      ` +
      events.map(e => {
const v = attForMember[e.id]; // true | false | 'NA' | undefined
let cls = 'off', aria = 'Absent';
if (v === true) { cls = 'on'; aria = 'Present'; }
else if (v === false) { cls = 'off'; aria = 'Absent'; }
else if (v === 'NA') { cls = 'na'; aria = 'Not applicable'; }

return `
  <td data-m="${m.id}" data-e="${e.id}">
    <button class="cell-btn ${cls}" aria-label="${aria}"></button>
  </td>`;
      }).join('');

    attBody.appendChild(tr);
  });

  countBadge.textContent = `${members.length} members · ${events.length} events`;
  renderAttendanceInsights();
}

function renderAttendanceInsights(){
  const { members, events } = getFilteredMembersAndEvents();
  const mCount = members.length, eCount = events.length;

  document.getElementById('attEvtCount').textContent = eCount || '0';

  // per-event present (only 'true'), and compute global avg ignoring 'NA'
  let totalSlots = 0, totalPresent = 0;

  const perEventPresent = events.map(ev => {
    let c = 0, considered = 0;
    members.forEach(m => {
      const v = (ATT[m.id] || {})[ev.id];  // true | false | 'NA' | undefined
      if (v !== 'NA') { considered++; if (v === true) c++; }
    });
    totalSlots += considered;
    totalPresent += c;
    return c;
  });

  const avg = totalSlots ? Math.round((totalPresent/totalSlots)*100) : 0;

  document.getElementById('attAvg').textContent = `${avg}%`;

  // top attendees (by present count on considered events only)
  const perMemberPresent = members.map(m => {
    let c = 0;
    events.forEach(ev => { if ((ATT[m.id]||{})[ev.id] === true) c++; });
    return { name: m.name || '', c };
  }).sort((a,b)=>b.c-a.c).slice(0,3);

  document.getElementById('attTop').textContent =
    perMemberPresent.length ? perMemberPresent.map(x=>`${x.name.split(' ')[0]}(${x.c})`).join(', ') : '–';

  // chart: x=events; y=present count
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



function renderBodGrid(){
  if (!bodHead || !bodBody) return;

  // Header: first sticky col shows "Name / Position", then meeting columns
  const headRow = document.createElement('tr');
headRow.innerHTML =
  `<th class="sticky-col">BOD \\ Meeting<br><small>Position</small></th>` +
  BODMEET.map(mt => `
    <th title="${mt.date || ''}">
      <div class="ev-head">
        <span>${mt.name || ''}</span>
        <small>${(mt.date || '').slice(0,10)}</small>   <!-- NEW -->
        <button class="icon-btn" title="Rename meeting" data-edit-bod-meeting="${mt.id}">✏️</button>
        <button class="icon-btn" title="Delete meeting" data-del-bod-meeting="${mt.id}">🗑</button>
      </div>
    </th>
  `).join('');
  bodHead.innerHTML = '';
  bodHead.appendChild(headRow);

  // Body: each row is a BOD member (name + position + cells + % stat)
  bodBody.innerHTML = '';
  const total = BODMEET.length;

  BODM.forEach(m => {
    const tr = document.createElement('tr');
    const att = BODATT[m.id] || {};

    // count present across ALL visible meetings
let present = 0, considered = 0;
BODMEET.forEach(mt => {
  const v = att[mt.id];
  if (v !== 'NA') { considered++; if (v === true) present++; }
});
const pct = considered ? Math.round((present / considered) * 100) : 0;

    tr.innerHTML =
      `
      <td class="sticky-col">
        <div class="mem-left">
          <div class="stat-box" title="Across visible BOD meetings">
            <span class="stat">All: ${present}/${total} · ${pct}%</span>
          </div>
          <div class="mem-cell">
            <span>${(m.name || '')}</span>
            <small style="opacity:.7; display:block">${(m.position || '')}</small>
            <button class="icon-btn" title="Edit name/position" data-edit-bod-member="${m.id}">✏️</button>
            <button class="icon-btn" title="Remove BOD" data-del-bod-member="${m.id}">🗑</button>
          </div>
        </div>
      </td>
      ` +
      BODMEET.map(mt => {
const v = att[mt.id]; // true | false | 'NA' | undefined
let cls = 'off', aria = 'Absent';
if (v === true) { cls = 'on'; aria = 'Present'; }
else if (v === false) { cls = 'off'; aria = 'Absent'; }
else if (v === 'NA') { cls = 'na'; aria = 'Not applicable'; }

return `
  <td data-bod-m="${m.id}" data-bod-meet="${mt.id}">
    <button class="cell-btn ${cls}" aria-label="${aria}"></button>
  </td>`;

      }).join('');

    bodBody.appendChild(tr);
  });

  if (bodCountBadge) bodCountBadge.textContent = `${BODM.length} BOD · ${BODMEET.length} meetings`;
  renderBodInsights();
}

function renderBodInsights(){
  const mCount = BODM.length, meetCount = BODMEET.length;
  document.getElementById('bodMeetCount').textContent = meetCount || '0';

  let totalSlots = 0, totalPresent = 0;

  const perMeetingPresent = BODMEET.map(mt => {
    let c = 0, considered = 0;
    BODM.forEach(m => {
      const v = (BODATT[m.id] || {})[mt.id];
      if (v !== 'NA') { considered++; if (v === true) c++; }
    });
    totalSlots += considered;
    totalPresent += c;
    return c;
  });

  const avg = totalSlots ? Math.round((totalPresent/totalSlots)*100) : 0;
  document.getElementById('bodAvg').textContent = `${avg}%`;

  const ctx = document.getElementById('bodChart');
  drawChart('bod', ctx, {
    type:'bar',
    data:{ labels: BODMEET.map(mt=>mt.name||''), datasets:[{label:'Present', data:perMeetingPresent}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}


// Add BOD member
if (bodAddMemberBtn) {
  bodAddMemberBtn.addEventListener('click', async () => {
    const name = (bodMemName?.value || '').trim();
    const position = (bodMemPos?.value || '').trim();
    if (!name) return;
    try {
      await db.collection('bodMembers').add({ name, position });
      if (bodMemName) bodMemName.value = '';
      if (bodMemPos)  bodMemPos.value  = '';
    } catch (err) { alert('Failed to add BOD: ' + err.message); }
  });
}

// Add BOD meeting
if (bodAddMeetingBtn) {
  bodAddMeetingBtn.addEventListener('click', async () => {
    const name = (bodMeetName?.value || '').trim();
    const date = (bodMeetDate?.value || '');
    if (!name || !date) return;
    try {
      await db.collection('bodMeetings').add({ name, date });
      if (bodMeetName) bodMeetName.value = '';
      // keep date if you run multiple adds; comment out next line if you want sticky date
      // if (bodMeetDate) bodMeetDate.value = '';
    } catch (err) { alert('Failed to add meeting: ' + err.message); }
  });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-edit-bod-member]');
  if (!btn) return;

  const id = btn.dataset.editBodMember;
  const cur = BODM.find(x => x.id === id) || {};
  const newName = window.prompt('Edit BOD name:', cur.name || '');
  if (newName == null) return; // cancelled
  const newPos  = window.prompt('Edit position:', cur.position || '');
  if (newPos == null) return; // cancelled

  const name = newName.trim();
  const position = (newPos || '').trim();
  if (!name) return;

  try {
    await db.collection('bodMembers').doc(id).update({ name, position });
    // optional immediate UI feedback (realtime listeners will also refresh)
    const i = BODM.findIndex(x => x.id === id);
    if (i >= 0) { BODM[i].name = name; BODM[i].position = position; }
    renderBodGrid();
  } catch (err) {
    alert('Failed to update BOD: ' + err.message);
  }
});
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-edit-bod-meeting]');
  if (!btn) return;

  const id = btn.dataset.editBodMeeting;
  const cur = BODMEET.find(x => x.id === id) || {};
  const next = window.prompt('Edit meeting name:', cur.name || '');
  if (!next || next.trim() === cur.name?.trim()) return;

  try {
    await db.collection('bodMeetings').doc(id).update({ name: next.trim() });
    // optional immediate UI feedback
    const i = BODMEET.findIndex(x => x.id === id);
    if (i >= 0) BODMEET[i].name = next.trim();
    renderBodGrid();
  } catch (err) {
    alert('Failed to update meeting: ' + err.message);
  }
});

// Toggle BOD attendance & delete actions
document.addEventListener('click', async (e) => {
  // Delete BOD member
  const delBodMem = e.target.closest('button[data-del-bod-member]');
  if (delBodMem) {
    const id = delBodMem.dataset.delBodMember;
    const m  = BODM.find(x => x.id === id);
    if (!confirm(`Remove BOD "${m?.name || id}"? This also deletes their BOD attendance.`)) return;
    try {
      await db.collection('bodMembers').doc(id).delete();
      await db.collection('bodAttendance').doc(id).delete();
    } catch (err) { alert('Failed to remove BOD: ' + err.message); }
    return;
  }

  // Delete BOD meeting
  const delBodMeet = e.target.closest('button[data-del-bod-meeting]');
  if (delBodMeet) {
    const id = delBodMeet.dataset.delBodMeeting;
    const mt = BODMEET.find(x => x.id === id);
    if (!confirm(`Delete meeting "${mt?.name || id}"? This removes it from all BOD attendance.`)) return;
    try {
      await db.collection('bodMeetings').doc(id).delete();
      // remove this field from all bodAttendance docs
      const snap = await db.collection('bodAttendance').get();
      const batch = db.batch();
      snap.forEach(doc => batch.update(doc.ref, { [id]: firebase.firestore.FieldValue.delete() }));
      await batch.commit();
    } catch (err) { alert('Failed to delete meeting: ' + err.message); }
    return;
  }

  // Toggle BOD attendance
// Toggle BOD attendance
const btn = e.target.closest('td[data-bod-m][data-bod-meet] .cell-btn');
if (btn) {
  const td = btn.closest('td');
  const bodMemberId = td.dataset.bodM;
  const meetingId   = td.dataset.bodMeet;

  const cur = ((BODATT[bodMemberId] || {})[meetingId]); // true | false | 'NA' | undefined
  let next;
  if (cur === true) next = false;
  else if (cur === false) next = 'NA';
  else next = true;

  btn.classList.remove('on','off','na');
  if (next === true) { btn.classList.add('on');  btn.setAttribute('aria-label','Present'); }
  else if (next === false){ btn.classList.add('off'); btn.setAttribute('aria-label','Absent'); }
  else { btn.classList.add('na'); btn.setAttribute('aria-label','Not applicable'); }

  const ref = db.collection('bodAttendance').doc(bodMemberId);
  await ref.set({ [meetingId]: next }, { merge: true });
  BODATT[bodMemberId] = BODATT[bodMemberId] || {};
  BODATT[bodMemberId][meetingId] = next;
}
});




function renderFines(){
  if (!finesBody) return;
  const mnames = membersMap();

  let total = 0;
  finesBody.innerHTML = FINES.map(f => {
    const reasonLabel = (f.reason === 'missing_badge') ? 'Missing badge'
                      : (f.reason === 'late') ? 'Late to event/meeting'
                      : (f.reason || '');
    const memberName = f.memberName || mnames[f.memberId] || f.memberId;
    const dateStr    = (f.date || '').slice(0,10);
    const amt        = Number(f.amount || 0);
    total += Number.isFinite(amt) ? amt : 0;

    return `
      <tr>
        <td>${(memberName || '').replace(/</g,'&lt;')}</td>
        <td>₹ ${amt.toLocaleString()}</td>
        <td>${reasonLabel}</td>
        <td>${(f.eventName || '').replace(/</g,'&lt;')}</td>
        <td>${dateStr}</td>
        <td>
          <button class="icon-btn" title="Delete fine" data-del-fine="${f.id}">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  if (finesBadge) finesBadge.textContent = `${FINES.length} records · ₹ ${total.toLocaleString()}`;
  renderFinesInsights();
}

function renderFinesInsights(){
  // Totals
  let total = 0, monthTotal = 0;
  const nowYM = new Date().toISOString().slice(0,7);

  // By reason for doughnut
  const reasonTotals = { missing_badge:0, late:0, other:0 };
  // By month for bars
  const byMonth = {}; // { 'YYYY-MM': amt }

  (FINES||[]).forEach(f=>{
    const amt = Number(f.amount || 0);
    total += amt;
    const ym = (f.date||'').slice(0,7);
    if (ym === nowYM) monthTotal += amt;
    if (!byMonth[ym]) byMonth[ym]=0; byMonth[ym]+=amt;

    if (f.reason === 'missing_badge') reasonTotals.missing_badge += amt;
    else if (f.reason === 'late')     reasonTotals.late += amt;
    else                              reasonTotals.other += amt;
  });

  document.getElementById('finesTotal').textContent = `₹ ${fmt(total)}`;
  document.getElementById('finesMonth').textContent = `₹ ${fmt(monthTotal)}`;

  // Reason doughnut
  drawChart('finesReason', document.getElementById('finesByReasonChart'), {
    type:'doughnut',
    data:{ labels:['Missing badge','Late','Other'], datasets:[{ data:[
      reasonTotals.missing_badge, reasonTotals.late, reasonTotals.other
    ]}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
  });

  // Month bars (sorted by month)
  const months = Object.keys(byMonth).filter(Boolean).sort();
  drawChart('finesMonth', document.getElementById('finesByMonthChart'), {
    type:'bar',
    data:{ labels: months, datasets:[{ label:'₹', data: months.map(m=>byMonth[m]) }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}


// Create fine
if (fineForm) {
  fineForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = fineMember.value;
    const reason   = fineReason.value;
    const eventName= fineEvent.value.trim();
    const date     = fineDate.value;
    const amount   = Number((fineAmount && fineAmount.value) || 0);

    if (!memberId || !reason || !eventName || !date) return;
    if (!Number.isFinite(amount) || amount < 0) { alert('Enter a valid amount (₹)'); return; }


    // Resolve member name for convenience
    const m = MEMBERS.find(x => x.id === memberId);
    const memberName = m ? (m.name || '') : '';

    const payload = {
      memberId,
      memberName,       // denormalized for simpler listings
      reason,           // 'missing_badge' | 'late'
      eventName,
      date,
      amount,             // 'YYYY-MM-DD'
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: (auth.currentUser && auth.currentUser.uid) || null
    };

    try {
      await db.collection('fines').add(payload);
      fineForm.reset();
      // keep today as default after reset
      fineDate.value = new Date().toISOString().slice(0,10);
    } catch (err) {
      alert('Failed to add fine: ' + err.message);
    }
  });
}

// Delete fine
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-del-fine]');
  if (!btn) return;
  const id = btn.dataset.delFine;
  if (!confirm('Delete this fine record?')) return;
  try {
    await db.collection('fines').doc(id).delete();
  } catch (err) {
    alert('Failed to delete fine: ' + err.message);
  }
});

// Rename MEMBER
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-edit-member]');
  if (!btn) return;
  const memberId = btn.dataset.editMember;
  const current = (MEMBERS.find(x => x.id === memberId)?.name) || '';
  const next = window.prompt('Enter new member name:', current);
  if (!next || next.trim() === current.trim()) return;

  try {
    await db.collection('members').doc(memberId).update({ name: next.trim() });
    // Update local cache for instant UI feedback (optional; realtime will also refresh)
    const i = MEMBERS.findIndex(x => x.id === memberId);
    if (i >= 0) MEMBERS[i].name = next.trim();
    renderGrid();
  } catch (err) {
    alert('Rename failed: ' + err.message);
  }
});

// Rename EVENT
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-edit-event]');
  if (!btn) return;
  const eventId = btn.dataset.editEvent;
  const current = (EVENTS.find(x => x.id === eventId)?.name) || '';
  const next = window.prompt('Enter new event name:', current);
  if (!next || next.trim() === current.trim()) return;

  try {
    await db.collection('events').doc(eventId).update({ name: next.trim() });
    const i = EVENTS.findIndex(x => x.id === eventId);
    if (i >= 0) EVENTS[i].name = next.trim();
    renderGrid();
  } catch (err) {
    alert('Rename failed: ' + err.message);
  }
});


/* ---------- Deletes & toggles ---------- */
attHead.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-del-event]');
  if (btn) removeEvent(btn.dataset.delEvent);
});

attBody.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('button[data-del-member]');
  if (delBtn) { removeMember(delBtn.dataset.delMember); return; }

  const btn = e.target.closest('.cell-btn');
  if (!btn) return;

  const td = btn.closest('td');
  const memberId = td.dataset.m;
  const eventId  = td.dataset.e;

  // current value in our in-memory map
  const cur = (ATT[memberId] || {})[eventId];  // true | false | 'NA' | undefined

  // next state: true -> false -> 'NA' -> true …
  let next;
  if (cur === true) next = false;
  else if (cur === false) next = 'NA';
  else next = true;

  // update classes for UI
  btn.classList.remove('on','off','na');
  if (next === true) { btn.classList.add('on');  btn.setAttribute('aria-label','Present'); }
  else if (next === false){ btn.classList.add('off'); btn.setAttribute('aria-label','Absent'); }
  else { btn.classList.add('na'); btn.setAttribute('aria-label','Not applicable'); }

  // write back
  const ref = db.collection('attendance').doc(memberId);
  await ref.set({ [eventId]: next }, { merge: true });
  ATT[memberId] = ATT[memberId] || {};
  ATT[memberId][eventId] = next;
});

/* ---------- Treasurer: render, add, delete, export ---------- */
function renderTreasurer(){
  if (!treBody) return;

  let inc = 0, exp = 0;
treBody.innerHTML = (TREAS || []).map(t => {
  const amt = Number(t.amount || 0);
  if (t.type === 'income') inc += amt;
  else if (t.type === 'expense') exp += amt;

  const dateStr = (t.date || '').slice(0,10);
  const typeLabel = t.type === 'income' ? 'Income' : 'Expense';
  return `
    <tr>
      <td>${(t.name || '').replace(/</g,'&lt;')}</td>
      <td>${typeLabel}</td>
      <td>₹ ${amt.toLocaleString()}</td>
      <td>${(t.avenue || '-').replace(/</g,'&lt;')}</td>   <!-- NEW -->
      <td>${dateStr}</td>
      <td><button class="icon-btn" title="Delete entry" data-del-tre="${t.id}">🗑</button></td>
    </tr>`;
}).join('');

  const net = inc - exp;
  if (treBadge) {
    treBadge.textContent =
      `${TREAS.length} records · ₹ ${inc.toLocaleString()} income · ₹ ${exp.toLocaleString()} expense · Net ₹ ${net.toLocaleString()}`;
      renderTreasurerInsights();

  }
}

function renderTreasurerInsights(){
  // KPIs
  let inc=0, exp=0;
  (TREAS||[]).forEach(t => {
    const a = Number(t.amount||0);
    if (t.type==='income') inc+=a; else if (t.type==='expense') exp+=a;
  });
  const net = inc - exp;
  document.getElementById('treInc').textContent = `₹ ${fmt(inc)}`;
  document.getElementById('treExp').textContent = `₹ ${fmt(exp)}`;
  document.getElementById('treNet').textContent = `₹ ${fmt(net)}`;

  // Cumulative balance line
  const rows = [...(TREAS||[])].sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  let running = 0;
  const labels = [], data = [];
  rows.forEach(r => {
    const a = Number(r.amount||0);
    running += (r.type==='income') ? a : -a;
    labels.push((r.date||'').slice(5)); // MM-DD
    data.push(running);
  });

  drawChart('tre', document.getElementById('treBalanceChart'), {
    type:'line',
    data:{ labels, datasets:[{ label:'Balance (₹)', data, tension:.25, fill:false }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}


// Add entry
if (treAddBtn) {
  treAddBtn.addEventListener('click', async () => {
    const name   = (treName?.value || '').trim();
    const type   = treType?.value || '';
    const amount = Number(treAmount?.value || 0);
    const date   = treDate?.value || '';
    const avenue = treAvenue?.value || '';   // <-- NEW

    if (!name || !type || !date || !Number.isFinite(amount) || amount < 0) {
      alert('Please fill Name, Type, Amount (>=0), Date'); return;
    }

    const payload = {
      name, type, amount, date,
      avenue,                                  // <-- NEW (save it)
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: (auth.currentUser && auth.currentUser.uid) || null
    };

    try {
      await db.collection('treasury').add(payload);
      if (treName)   treName.value = '';
      if (treType)   treType.value = '';
      if (treAmount) treAmount.value = '';
    } catch (err) {
      alert('Failed to add entry: ' + err.message);
    }
  });
}


// Delete entry
document.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('button[data-del-tre]');
  if (!delBtn) return;
  const id = delBtn.dataset.delTre;
  if (!confirm('Delete this entry?')) return;
  try {
    await db.collection('treasury').doc(id).delete();
  } catch (err) {
    alert('Failed to delete entry: ' + err.message);
  }
});

// Export to Excel (Treasury)
function exportTreasuryToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  const header = ['Name', 'Type', 'Amount (₹)', 'Avenue', 'Date'];
const rows = (TREAS || []).map(t => [
  t.name || '',
  t.type === 'income' ? 'Income' : 'Expense',
  Number(t.amount || 0),
  t.avenue || '',                                 // + Avenue
  (t.date || '').slice(0,10)
]);

  // Totals for a summary sheet
  let inc = 0, exp = 0;
  (TREAS || []).forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'income') inc += amt; else exp += amt;
  });
  const net = inc - exp;

  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws1['!cols'] = [{wch:30},{wch:12},{wch:14},{wch:12},{wch:12}];

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Summary'],
    ['Total Income (₹)', inc],
    ['Total Expense (₹)', exp],
    ['Net (₹)', net],
  ]);
  ws2['!cols'] = [{wch:22},{wch:16}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Treasury');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `treasury_${dateTag}.xlsx`);
}

if (exportTreXlsxBtn) {
  exportTreXlsxBtn.addEventListener('click', exportTreasuryToExcel);
}




/* ---------- Delete helpers ---------- */
async function removeMember(memberId){
  const m = MEMBERS.find(x => x.id === memberId);
  if (!confirm(`Delete member "${m?.name || memberId}"? This also deletes their attendance.`)) return;
  try{
    await db.collection('members').doc(memberId).delete();
    await db.collection('attendance').doc(memberId).delete();
    await loadData();
  }catch(err){
    alert('Failed to delete member: ' + err.message);
  }
}

async function removeEvent(eventId){
  const ev = EVENTS.find(x => x.id === eventId);
  if (!confirm(`Delete event "${ev?.name || eventId}"? This removes it from all attendance records.`)) return;
  try{
    await db.collection('events').doc(eventId).delete();
    const snap = await db.collection('attendance').get();
    const batch = db.batch();
    snap.forEach(doc => batch.update(doc.ref, { [eventId]: firebase.firestore.FieldValue.delete() }));
    await batch.commit();
    await loadData();
  }catch(err){
    alert('Failed to delete event: ' + err.message);
  }
}

/* ---------- Filters ---------- */
[memberSearch, eventSearch, monthFilter].forEach(el => {
  el.addEventListener('input', renderGrid);
});

/* ---------- Modal open/close + submit ---------- */
function showModal(kind){
  admModal.setAttribute('aria-hidden','false');
  memberForm.hidden = kind !== 'member';
  eventForm.hidden  = kind !== 'event';
  admTitle.textContent = (kind === 'member') ? 'Add Member' : 'Add Event';
}
function hideModal(){
  admModal.setAttribute('aria-hidden','true');
  memberForm.reset(); eventForm.reset();
  const d = document.getElementById('evDate'); if (d) d.value = new Date().toISOString().slice(0,10);
}

document.getElementById('admClose').onclick = hideModal;
document.getElementById('memCancel').onclick = hideModal;
document.getElementById('evCancel').onclick  = hideModal;
admModal.addEventListener('click', e => { if (e.target === admModal) hideModal(); });

addMemberBtn.onclick = () => showModal('member');
addEventBtn.onclick  = () => showModal('event');

memberForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('memName').value.trim();
  if (!name) return;
  try{
    await db.collection('members').add({ name });
    hideModal();
    await loadData();
  }catch(err){ alert('Failed to add member: ' + err.message); }
});

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('evName').value.trim();
  const date = document.getElementById('evDate').value;
  const description = document.getElementById('evDesc').value.trim();
  const avenues = Array.from(eventForm.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);

  if (!name || !date) return;
  const payload = { name, date, description };
  if (avenues.length) payload.avenue = avenues;

  try{
    await db.collection('events').add(payload);
    hideModal();
    await loadData();
  }catch(err){ alert('Failed to add event: ' + err.message); }
});

function getFilteredMembersAndEvents(){
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value; // "" or YYYY-MM

  const members = MEMBERS.filter(m => (m.name || '').toLowerCase().includes(memQuery));

  let events = EVENTS.filter(e => (e.name || '').toLowerCase().includes(evQuery));
  if (monthSel) events = events.filter(e => (e.date || '').startsWith(monthSel));

  return { members, events };
}

function exportAttendanceToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  const { members, events } = getFilteredMembersAndEvents();

  const header = ['Member \\ Event', ...events.map(e => {
    const d = (e.date||'').slice(0,10);
    return d ? `${e.name||''} (${d})` : (e.name||'');
  })];

  const rows = members.map(m => {
    const attForMember = ATT[m.id] || {};
    const cells = events.map(e => {
      const v = attForMember[e.id];        // true | false | 'NA' | undefined
      if (v === true)  return 'P';
      if (v === false) return 'A';
      if (v === 'NA')  return 'NA';
      return ''; // blank if unset
    });
    return [m.name || '', ...cells];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // column widths
  const colWidths = header.map((h, idx) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map(r => String(r[idx] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
  });
  ws['!cols'] = colWidths;

  ws['!freeze'] = { xSplit: 1, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `attendance_${dateTag}.xlsx`);
}


if (exportXlsxBtn) {
  exportXlsxBtn.addEventListener('click', exportAttendanceToExcel);
}

function exportBodAttendanceToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  // Header: first col label, then all meetings
  const header = [
    'BOD (Name / Position)',
    ...BODMEET.map(mt => {
      const d = (mt.date || '').slice(0,10);
      return d ? `${mt.name || ''} (${d})` : (mt.name || '');
    })
  ];

  // Rows: BODM order; cells are P/A
const rows = BODM.map(m => {
  const att = BODATT[m.id] || {};
  const cells = BODMEET.map(mt => {
    const v = att[mt.id];
    if (v === true)  return 'P';
    if (v === false) return 'A';
    if (v === 'NA')  return 'NA';
    return '';
  });
  const namePos = `${m.name || ''}${m.position ? ' — ' + m.position : ''}`;
  return [namePos, ...cells];
});


  const aoa = [header, ...rows];

  // Sheet + widths + freeze panes
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colWidths = header.map((h, idx) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map(r => String(r[idx] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
  });
  ws['!cols'] = colWidths;
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOD Attendance');

  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `bod_attendance_${dateTag}.xlsx`);
}

if (exportBodXlsxBtn) {
  exportBodXlsxBtn.addEventListener('click', exportBodAttendanceToExcel);
}


/**
 * admin.js
 * Complete updated version with new Treasurer fields and fixes.
 */

function getGdriveImageUrl(url) {
  if (!url) return "";
  // Check for standard Drive share links
  if (url.includes("drive.google.com")) {
    const idMatch = url.match(/[-\w]{25,}/);
    if (idMatch) {
      // Use the thumbnail endpoint (sz=s1000 gives a 1000px image)
      return `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=s1000`;
    }
  }
  return url;
}

/* Uses global window.auth / window.db created in firebase-init.js */
const auth = window.auth;
const db   = window.db;

/* DOM ELEMENTS */
const countBadge  = document.getElementById('countBadge');
const signOutBtn  = document.getElementById('signOutBtn');

const memberSearch = document.getElementById('memberSearch');
const eventSearch  = document.getElementById('eventSearch');
const monthFilter  = document.getElementById('monthFilter');
const avenueFilter = document.getElementById('avenueFilter');

const addMemberBtn = document.getElementById('addMemberBtn');
const addEventBtn  = document.getElementById('addEventBtn');

if (addMemberBtn) addMemberBtn.onclick = () => openModal('addMemberModal');
if (addEventBtn)  addEventBtn.onclick  = () => openModal('addEventModal');

const attHead  = document.getElementById('attHead');
const attBody  = document.getElementById('attBody');

/* Modal bits */
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

/* TREASURER DOM ELEMENTS */
const treBadge           = document.getElementById('treBadge');
const treBody            = document.getElementById('treBody');
const exportTreXlsxBtn   = document.getElementById('exportTreXlsxBtn');

// Add Transaction Inputs
const transName      = document.getElementById("transName");
const transType      = document.getElementById("transType");
const transAmount    = document.getElementById("transAmount");
const transAvenue    = document.getElementById("transAvenue");
const transDate      = document.getElementById("transDate");
// NEW FIELDS
const transPaidBy    = document.getElementById("transPaidBy");
const transReimburse = document.getElementById("transReimburse");
const transCheque    = document.getElementById("transCheque");

const transBill      = document.getElementById("transBill");
const transBillPreview = document.getElementById("transBillPreview");
const addTransForm   = document.getElementById("addTransForm");
const treAddBtn      = document.getElementById('treAddBtn');

// Edit Transaction Inputs
const editTransForm   = document.getElementById("editTransForm");
const editTransId     = document.getElementById("editTransId"); // Ensure this hidden input exists
const editTransName   = document.getElementById("editTransName");
const editTransType   = document.getElementById("editTransType");
const editTransAmount = document.getElementById("editTransAmount");
const editTransAvenue = document.getElementById("editTransAvenue");
const editTransDate   = document.getElementById("editTransDate");
const editTransBill   = document.getElementById("editTransBill");
const editTransBillPreview = document.getElementById("editTransBillPreview");
// NEW EDIT FIELDS
const editTransPaidBy    = document.getElementById("editTransPaidBy");
const editTransReimburse = document.getElementById("editTransReimburse");
const editTransCheque    = document.getElementById("editTransCheque");

// Lightbox
const billLightboxImg = document.getElementById("billLightboxImg");

/* LOCK BUTTONS */
const lockAttendanceBtn = document.getElementById('lockAttendanceBtn');
const lockAttendanceState = document.getElementById('lockAttendanceState');
const lockBodAttBtn = document.getElementById('lockBodAttBtn');
const lockBodAttState = document.getElementById('lockBodAttState');
const lockFinesBtn = document.getElementById('lockFinesBtn');
const lockFinesState = document.getElementById('lockFinesState');
const lockTreasuryBtn = document.getElementById('lockTreasuryBtn');
const lockTreasuryState = document.getElementById('lockTreasuryState');

const treFilterType   = document.getElementById('treFilterType');
const treFilterMonth  = document.getElementById('treFilterMonth');
const treFilterAvenue = document.getElementById('treFilterAvenue');
// ===== MODAL ELEMENTS =====
const addMemberModal      = document.getElementById('addMemberModal');
const addMemberForm       = document.getElementById('addMemberForm');
const addMemName          = document.getElementById('addMemName');

const editMemberModal     = document.getElementById('editMemberModal');
const editMemberForm      = document.getElementById('editMemberForm');
const editMemId           = document.getElementById('editMemId');
const editMemName         = document.getElementById('editMemName');

const addEventModal       = document.getElementById('addEventModal');
const addEventForm        = document.getElementById('addEventForm');
const addEvName           = document.getElementById('addEvName');
const addEvDate           = document.getElementById('addEvDate');
const addEvDesc           = document.getElementById('addEvDesc');

const editEventModal      = document.getElementById('editEventModal');
const editEventForm       = document.getElementById('editEventForm');
const editEvId            = document.getElementById('editEvId');
const editEvName          = document.getElementById('editEvName');
const editEvDate          = document.getElementById('editEvDate');
const editEvDesc          = document.getElementById('editEvDesc');

const editBodMemberModal  = document.getElementById('editBodMemberModal');
const editBodMemberForm   = document.getElementById('editBodMemberForm');
const editBodMemId        = document.getElementById('editBodMemId');
const editBodMemName      = document.getElementById('editBodMemName');
const editBodMemPos       = document.getElementById('editBodMemPos');

const editBodMeetingModal = document.getElementById('editBodMeetingModal');
const editBodMeetingForm  = document.getElementById('editBodMeetingForm');
const editBodMeetId       = document.getElementById('editBodMeetId');
const editBodMeetName     = document.getElementById('editBodMeetName');
const editBodMeetDate     = document.getElementById('editBodMeetDate');

const goBodBtn = document.getElementById('goBodBtn');

// Modal helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.setAttribute('aria-hidden', 'true');
    const form = modal.querySelector('form');
    if (form) form.reset();
    // Clear previews if any
    if(modalId === 'addTransModal' && transBillPreview) transBillPreview.innerHTML = "";
    if(modalId === 'editTransModal' && editTransBillPreview) editTransBillPreview.innerHTML = "";
  }
}

// Universal close handler for all modals
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
  }
});

/* DATA STATE */
let MEMBERS = [];
let EVENTS  = [];
let ATT     = {}; // {memberId: {eventId: boolean}}

let BODM = [];      // [{id, name, position}]
let BODMEET = [];   // [{id, name, date}]
let BODATT = {};    // { bodMemberId: { meetingId: boolean } }

let FINES = [];
let TREAS = []; // Treasury Data

/* UNSUBSCRIBE HANDLERS */
let unsubMembers = null;
let unsubEvents  = null;
let unsubAtt     = null; 
let unsubFines   = null;
let unsubBodM    = null;
let unsubBodMt   = null;
let unsubBodAt   = null;
let unsubTre     = null;

let IS_PRESIDENT = false;

const _charts = {};
function drawChart(key, ctx, cfg){
  if (!window.Chart || !ctx) return; 
  if (_charts[key]) { _charts[key].destroy(); }
  _charts[key] = new Chart(ctx, cfg);
}

// Small utils
const fmt = n => Number(n).toLocaleString();
const yyyymm = d => d.slice(0,7);

/* Helper: map memberId -> name */
function membersMap() {
  const map = {};
  MEMBERS.forEach(m => map[m.id] = m.name || '');
  return map;
}

/* ---------- Auth guard + role check ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }

  try {
    const snap = await db.collection('roles').doc(user.uid).get();
    const role = snap.exists ? String(snap.data().role).toLowerCase() : null;
    IS_PRESIDENT = (role === 'president');
    
    const goDZRBtn = document.getElementById('goDZRBtn');
    if (goDZRBtn) {
        if (IS_PRESIDENT) {
            goDZRBtn.style.display = 'inline-block';
            goDZRBtn.onclick = () => location.href = 'dzrvisit.html';
        } else {
            goDZRBtn.style.display = 'none';
        }
    }
    // Only redirect if we KNOW they’re not admin.
    if (role && role !== 'admin' && role !== 'president') {
      window.location.href = 'bodlogin.html';
      return;
    }
  } catch (e) {
    console.warn('Role check failed; continuing:', e);
  }

  // Immediately paint once, then attach realtime listeners
  await startAttendancePage();
});

/* Lock Logic */
function watchLock(panelKey, btnEl, badgeEl, onLockedChange) {
  db.collection('locks').doc(panelKey).onSnapshot(snap => {
    const locked = snap.exists && !!snap.data().locked;
    if (badgeEl) badgeEl.textContent = locked ? 'Locked' : 'Unlocked';
    if (btnEl) {
      btnEl.disabled = !IS_PRESIDENT;           
      btnEl.textContent = locked ? '🔓' : '🔒'; 
    }
    onLockedChange?.(locked);
  });
}

// Hook up locks
watchLock('attendance', lockAttendanceBtn, lockAttendanceState, (locked) => {
  document.querySelectorAll('#attBody .cell-btn, #addMemberBtn, #addEventBtn')
    .forEach(el => el.disabled = locked);
});
watchLock('bodAttendance', lockBodAttBtn, lockBodAttState, (locked) => {
  document.querySelectorAll('#bodBody .cell-btn, #bodAddMemberBtn, #bodAddMeetingBtn')
    .forEach(el => el.disabled = locked);
});
watchLock('fines', lockFinesBtn, lockFinesState, (locked) => {
  document.querySelectorAll('#fineForm input, #fineForm select, #fineForm button')
    .forEach(el => el.disabled = locked);
});
watchLock('treasury', lockTreasuryBtn, lockTreasuryState, (locked) => {
  // Lock treasury inputs
  const btns = document.querySelectorAll('#treAddBtn, #treBody .icon-btn');
  btns.forEach(b => b.disabled = locked);
});

async function toggleLock(panelKey) {
  if (!IS_PRESIDENT) return; 
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
  goBodBtn.addEventListener('click', () => location.href = 'bodlogin.html');
}

// Helper: Filter Treasury Data based on dropdowns
function getFilteredTreasury() {
  const typeVal   = treFilterType.value;
  const monthVal  = treFilterMonth.value;
  const avenueVal = treFilterAvenue.value;

  return TREAS.filter(t => {
    // Filter Type
    if (typeVal && t.type !== typeVal) return false;
    
    // Filter Month (Format: YYYY-MM)
    if (monthVal && (t.date || '').slice(0, 7) !== monthVal) return false;

    // Filter Avenue
    if (avenueVal) {
      if (avenueVal === '_NONE_') {
        if (t.avenue && t.avenue !== 'No Avenue' && t.avenue !== '_NONE_') return false;
      } else {
        if (t.avenue !== avenueVal) return false;
      }
    }
    return true;
  });
}

// Helper: Populate Month Filter dynamically
function buildTreasuryMonthFilter() {
  const existingVal = treFilterMonth.value;
  treFilterMonth.innerHTML = '<option value="">All Months</option>';
  
  const months = new Set(TREAS.map(t => (t.date || '').slice(0, 7)));
  Array.from(months).filter(Boolean).sort().reverse().forEach(ym => {
    const [y, m] = ym.split('-');
    const dateObj = new Date(y, m - 1, 1);
    const label = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = label;
    treFilterMonth.appendChild(opt);
  });

  // Restore selection if still valid
  if (existingVal) treFilterMonth.value = existingVal;
}
/* ---------- Data load ---------- */
async function loadData(){
  // Members & Events
  const [mSnap, eSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get()
  ]);

  MEMBERS = mSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  EVENTS  = eSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  
  // Populate Fine Member Dropdown
  if (fineMember) {
    fineMember.innerHTML = '<option value="" disabled selected>Member…</option>' +
      MEMBERS.map(m => `<option value="${m.id}">${(m.name || '').replace(/</g,'&lt;')}</option>`).join('');
  }

  // BOD
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

  // Fines
  const fSnap = await db.collection('fines').orderBy('date','desc').get();
  FINES = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFines();

  // Attendance
  buildMonthFilterFromEvents();
  const attSnap = await db.collection('attendance').get();
  ATT = {};
  attSnap.forEach(d => { ATT[d.id] = d.data() || {}; });
  renderGrid();

  // Treasury
if (treBody) {
  if (transDate && !transDate.value) transDate.value = new Date().toISOString().slice(0,10);
  const tSnap = await db.collection('treasury').orderBy('date','desc').get();
  TREAS = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  buildTreasuryMonthFilter(); // <--- Add this
  renderTreasurer();
}
}
async function startAttendancePage() {
  await loadData();
  attachRealtimeListeners();
}

function attachRealtimeListeners() {
  if (unsubMembers) { unsubMembers(); unsubMembers = null; }
  if (unsubEvents)  { unsubEvents();  unsubEvents  = null; }
  if (unsubAtt)     { unsubAtt();     unsubAtt     = null; }
  if (unsubFines)   { unsubFines();   unsubFines   = null; }
  if (unsubBodM)    { unsubBodM();    unsubBodM    = null; }
  if (unsubBodMt)   { unsubBodMt();   unsubBodMt   = null; }
  if (unsubBodAt)   { unsubBodAt();   unsubBodAt   = null; }
  if (unsubTre)     { unsubTre();     unsubTre     = null; }

  // Fines
  unsubFines = db.collection('fines').orderBy('date', 'desc').onSnapshot((snap) => {
    FINES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFines();
  });

  // Members
  unsubMembers = db.collection('members').orderBy('name').onSnapshot((snap) => {
    MEMBERS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid(); 
  });

  // Events
  unsubEvents = db.collection('events').orderBy('date', 'desc').onSnapshot((snap) => {
    EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    buildMonthFilterFromEvents();
    renderGrid();
  });

  // Attendance
  unsubAtt = db.collection('attendance').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data() || {}; });
    ATT = next;
    renderGrid();
  });

  // BOD
  if (bodHead) {
    unsubBodM = db.collection('bodMembers').orderBy('name').onSnapshot(snap => {
      BODM = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderBodGrid();
    });
    unsubBodMt = db.collection('bodMeetings').orderBy('date','desc').onSnapshot(snap => {
      BODMEET = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderBodGrid();
    });
    unsubBodAt = db.collection('bodAttendance').onSnapshot(snap => {
      const next = {};
      snap.forEach(d => { next[d.id] = d.data() || {}; });
      BODATT = next;
      renderBodGrid();
    });
  }

  // Treasury
  if (treBody) {
unsubTre = db.collection('treasury').orderBy('date','desc').onSnapshot(snap => {
  TREAS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildTreasuryMonthFilter(); // <--- Add this
  renderTreasurer();
});
  }
}

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

/* ---------- Render grid (Attendance) ---------- */
function renderGrid(){
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value; 
  const avenueSel = avenueFilter.value; 

  const members = MEMBERS.filter(m => (m.name || '').toLowerCase().includes(memQuery));
  let events = EVENTS.filter(e => (e.name || '').toLowerCase().includes(evQuery));
  
  if (monthSel) events = events.filter(e => (e.date || '').startsWith(monthSel));
  
  if (avenueSel) {
    events = events.filter(e => {
      const eventAvenues = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      if (avenueSel === '_NONE_') return eventAvenues.length === 0;
      return eventAvenues.includes(avenueSel);
    });
  }

  // Header
  const headRow = document.createElement('tr');
  headRow.innerHTML =
    `<th class="sticky-col">Member \\ Event</th>` +
    events.map(e => { 
      const a = e.avenue || []; 
      const avenues = Array.isArray(a) ? a : (a ? [a] : []); 
      const avenueString = avenues.join(', ');
      const avenueHtml = avenueString
        ? `<small style="color: var(--color-accent, #60C3C4); font-weight: 600;">${avenueString}</small>`
        : '';

      return `
        <th title="${e.date || ''}">
          <div class="ev-head">
            <span>${e.name || ''}</span>
            ${avenueHtml}  <small>${(e.date || '').slice(0,10)}</small>
            <button class="icon-btn" title="Rename event" data-edit-event="${e.id}">✏️</button>
            <button class="icon-btn" title="Delete event" data-del-event="${e.id}">🗑</button>
          </div>
        </th>
      `;
    }).join('');
    
  attHead.innerHTML = '';
  attHead.appendChild(headRow);

  // Body
  attBody.innerHTML = '';
  members.forEach(m => {
    const tr = document.createElement('tr');
    const attForMember = ATT[m.id] || {};

    const values  = events.map(e => attForMember[e.id]);
    const considered = values.filter(v => v !== 'NA'); 
    const total   = considered.length;
    const present = considered.filter(v => v === true).length;
    const pct     = total ? Math.round((present/total)*100) : 0;

    // GBM %
    const gbmIds = events.filter(e => {
      const a = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      return a.includes('GBM');
    }).map(e => e.id);
    
    const gbmValues   = gbmIds.map(id => attForMember[id]);
    const gbmConsider = gbmValues.filter(v => v !== 'NA');
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
        const v = attForMember[e.id]; 
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

  const perMemberPresent = members.map(m => {
    let c = 0;
    events.forEach(ev => { if ((ATT[m.id]||{})[ev.id] === true) c++; });
    return { name: m.name || '', c };
  }).sort((a,b)=>b.c-a.c).slice(0,3);

  document.getElementById('attTop').textContent =
    perMemberPresent.length ? perMemberPresent.map(x=>`${x.name.split(' ')[0]}(${x.c})`).join(', ') : '–';

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

/* ---------- Render BOD Grid ---------- */
function renderBodGrid(){
  if (!bodHead || !bodBody) return;

  const headRow = document.createElement('tr');
  headRow.innerHTML =
    `<th class="sticky-col">BOD \\ Meeting<br><small>Position</small></th>` +
    BODMEET.map(mt => `
      <th title="${mt.date || ''}">
        <div class="ev-head">
          <span>${mt.name || ''}</span>
          <small>${(mt.date || '').slice(0,10)}</small>   
          <button class="icon-btn" title="Rename meeting" data-edit-bod-meeting="${mt.id}">✏️</button>
          <button class="icon-btn" title="Delete meeting" data-del-bod-meeting="${mt.id}">🗑</button>
        </div>
      </th>
    `).join('');
  bodHead.innerHTML = '';
  bodHead.appendChild(headRow);

  bodBody.innerHTML = '';
  const total = BODMEET.length;

  BODM.forEach(m => {
    const tr = document.createElement('tr');
    const att = BODATT[m.id] || {};

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
        const v = att[mt.id]; 
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
  document.getElementById('bodMeetCount').textContent = BODMEET.length || '0';
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

/* BOD Interactions */
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
if (bodAddMeetingBtn) {
  bodAddMeetingBtn.addEventListener('click', async () => {
    const name = (bodMeetName?.value || '').trim();
    const date = (bodMeetDate?.value || '');
    if (!name || !date) return;
    try {
      await db.collection('bodMeetings').add({ name, date });
      if (bodMeetName) bodMeetName.value = '';
    } catch (err) { alert('Failed to add meeting: ' + err.message); }
  });
}

/* BOD Click Handler (Delete, Edit, Toggle) */
document.addEventListener('click', async (e) => {
  // 1. Delete BOD member
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

  // 2. Delete BOD meeting
  const delBodMeet = e.target.closest('button[data-del-bod-meeting]');
  if (delBodMeet) {
    const id = delBodMeet.dataset.delBodMeeting;
    const mt = BODMEET.find(x => x.id === id);
    if (!confirm(`Delete meeting "${mt?.name || id}"? This removes it from all BOD attendance.`)) return;
    try {
      await db.collection('bodMeetings').doc(id).delete();
      const snap = await db.collection('bodAttendance').get();
      const batch = db.batch();
      snap.forEach(doc => batch.update(doc.ref, { [id]: firebase.firestore.FieldValue.delete() }));
      await batch.commit();
    } catch (err) { alert('Failed to delete meeting: ' + err.message); }
    return;
  }

  // 3. Edit BOD MEMBER
  const ebmBtn = e.target.closest('button[data-edit-bod-member]');
  if (ebmBtn) {
    const id = ebmBtn.dataset.editBodMember;
    const m  = (BODM || []).find(x => x.id === id);
    if (!m) return;
    editBodMemId.value   = id;
    editBodMemName.value = m.name || '';
    editBodMemPos.value  = m.position || '';
    openModal('editBodMemberModal');
    return;
  }

  // 4. Edit BOD MEETING
  const ebmtBtn = e.target.closest('button[data-edit-bod-meeting]');
  if (ebmtBtn) {
    const id = ebmtBtn.dataset.editBodMeeting;
    const mt = (BODMEET || []).find(x => x.id === id);
    if (!mt) return;
    editBodMeetId.value   = id;
    editBodMeetName.value = mt.name || '';
    editBodMeetDate.value = (mt.date || '').slice(0,10);
    openModal('editBodMeetingModal');
    return;
  }

  // 5. Toggle BOD attendance
  const btn = e.target.closest('td[data-bod-m][data-bod-meet] .cell-btn');
  if (btn) {
    const td = btn.closest('td');
    const bodMemberId = td.dataset.bodM;
    const meetingId   = td.dataset.bodMeet;
    const cur = ((BODATT[bodMemberId] || {})[meetingId]); 
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

/* ---------- Fines Logic ---------- */
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
  let total = 0, monthTotal = 0;
  const nowYM = new Date().toISOString().slice(0,7);
  const reasonTotals = { missing_badge:0, late:0, other:0 };
  const byMonth = {}; 

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

  drawChart('finesReason', document.getElementById('finesByReasonChart'), {
    type:'doughnut',
    data:{ labels:['Missing badge','Late','Other'], datasets:[{ data:[
      reasonTotals.missing_badge, reasonTotals.late, reasonTotals.other
    ]}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
  });

  const months = Object.keys(byMonth).filter(Boolean).sort();
  drawChart('finesMonth', document.getElementById('finesByMonthChart'), {
    type:'bar',
    data:{ labels: months, datasets:[{ label:'₹', data: months.map(m=>byMonth[m]) }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}

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

    const m = MEMBERS.find(x => x.id === memberId);
    const memberName = m ? (m.name || '') : '';

    const payload = {
      memberId,
      memberName,      
      reason,           
      eventName,
      date,
      amount,             
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: (auth.currentUser && auth.currentUser.uid) || null
    };

    try {
      await db.collection('fines').add(payload);
      fineForm.reset();
      fineDate.value = new Date().toISOString().slice(0,10);
    } catch (err) { alert('Failed to add fine: ' + err.message); }
  });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-del-fine]');
  if (!btn) return;
  const id = btn.dataset.delFine;
  if (!confirm('Delete this fine record?')) return;
  try { await db.collection('fines').doc(id).delete(); } 
  catch (err) { alert('Failed to delete fine: ' + err.message); }
});

/* ---------- Attendance Event/Member Actions ---------- */
attHead.addEventListener('click', (e) => {
  // Delete event
  const delBtn = e.target.closest('button[data-del-event]');
  if (delBtn) {
    removeEvent(delBtn.dataset.delEvent);
    return; 
  }

  // Edit event
  const editBtn = e.target.closest('button[data-edit-event]');
  if (editBtn) {
    const id = editBtn.dataset.editEvent;
    const ev = (EVENTS || []).find(x => x.id === id);
    if (!ev) return;

    document.getElementById('editEvId').value = id;
    document.getElementById('editEvName').value = ev.name || '';
    document.getElementById('editEvDate').value = (ev.date || '').slice(0, 10);
    document.getElementById('editEvDesc').value = ev.desc || '';

    const avenueCheckboxes = document.querySelectorAll('#editEventModal input[type="checkbox"]');
    avenueCheckboxes.forEach(cb => cb.checked = false);
    const eventAvenues = Array.isArray(ev.avenue) ? ev.avenue : (ev.avenue ? [ev.avenue] : []);
    eventAvenues.forEach(avenueValue => {
      const cb = document.querySelector(`#editEventModal input[value="${avenueValue}"]`);
      if (cb) cb.checked = true;
    });

    openModal('editEventModal');
  }
});

attBody.addEventListener('click', async (e) => {
  // Delete member
  const delBtn = e.target.closest('button[data-del-member]');
  if (delBtn) {
    removeMember(delBtn.dataset.delMember);
    return;
  }

  // Edit member
  const editBtn = e.target.closest('button[data-edit-member]');
  if (editBtn) {
    const id = editBtn.dataset.editMember;
    const m  = (MEMBERS || []).find(x => x.id === id);
    if (!m) return;
    editMemId.value   = id;
    editMemName.value = m.name || '';
    openModal('editMemberModal');
    return;
  }

  // Cell toggle
  const btn = e.target.closest('.cell-btn');
  if (!btn) return;

  const td = btn.closest('td');
  const memberId = td.dataset.m;
  const eventId  = td.dataset.e;
  const cur = (ATT[memberId] || {})[eventId]; 
  let next;
  if (cur === true) next = false;
  else if (cur === false) next = 'NA';
  else next = true;

  btn.classList.remove('on','off','na');
  if (next === true) { btn.classList.add('on');  btn.setAttribute('aria-label','Present'); }
  else if (next === false){ btn.classList.add('off'); btn.setAttribute('aria-label','Absent'); }
  else { btn.classList.add('na'); btn.setAttribute('aria-label','Not applicable'); }

  const ref = db.collection('attendance').doc(memberId);
  await ref.set({ [eventId]: next }, { merge: true });
  ATT[memberId] = ATT[memberId] || {};
  ATT[memberId][eventId] = next;
});

/* ---------- Treasurer Logic ---------- */
// 1. RENDER
function renderTreasurer(){
  if (!treBody) return;

  const data = getFilteredTreasury(); // <--- Use filtered data

  let inc = 0, exp = 0;
  treBody.innerHTML = data.map(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'income') inc += amt;
    else if (t.type === 'expense') exp += amt;

    const dateStr = (t.date || '').slice(0,10);
    const typeLabel = t.type === 'income' ? 'Income' : 'Expense';
    const thumbUrl = getGdriveImageUrl(t.billUrl);

    return `
    <tr>
      <td>${(t.name || '').replace(/</g,'&lt;')}</td>
      <td>${typeLabel}</td>
      <td>₹ ${amt.toLocaleString()}</td>
      <td>${(t.avenue || '-').replace(/</g,'&lt;')}</td>
      <td>${dateStr}</td>
      <td>${(t.paidBy || '-').replace(/</g,'&lt;')}</td>
      <td>${(t.reimburse || '-').replace(/</g,'&lt;')}</td>
      <td>${(t.cheque || '-').replace(/</g,'&lt;')}</td>
      <td>
        ${
          t.billUrl
            ? `<img src="${thumbUrl}" 
                    style="width:60px; height:40px; object-fit:cover; border-radius:6px; cursor:pointer; border:1px solid #333;"
                    onclick="showBill('${t.billUrl}')"
                    alt="Bill"
                    onerror="this.style.display='none';this.parentElement.innerText='🔗'" 
               />`
            : '—'
        }
      </td>
      <td>
         <button class="icon-btn" data-edit-tre="${t.id}" title="Edit entry">✏️</button>
         <button class="icon-btn" data-del-tre="${t.id}" title="Delete entry">🗑</button>
      </td>
    </tr>`;
  }).join('');

  // Calculate Net for the badge
  const net = inc - exp;
  if (treBadge) {
    treBadge.textContent = `${data.length} records · Net ₹ ${net.toLocaleString()}`;
  }

  // Update KPIs and Chart with filtered data
  renderTreasurerInsights(data);
}

window.showBill = (url) => {
  billLightboxImg.src = getGdriveImageUrl(url);
  openModal("billLightbox");
};

function renderTreasurerInsights(data){
  let inc=0, exp=0;
  (data||[]).forEach(t => {
    const a = Number(t.amount||0);
    if (t.type==='income') inc+=a; else if (t.type==='expense') exp+=a;
  });
  const net = inc - exp;
  
  document.getElementById('treInc').textContent = `₹ ${fmt(inc)}`;
  document.getElementById('treExp').textContent = `₹ ${fmt(exp)}`;
  document.getElementById('treNet').textContent = `₹ ${fmt(net)}`;

  // Sort by date for chart
  const rows = [...(data||[])].sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  
  let running = 0;
  const labels = [], chartData = [];
  rows.forEach(r => {
    const a = Number(r.amount||0);
    running += (r.type==='income') ? a : -a;
    labels.push((r.date||'').slice(5)); 
    chartData.push(running);
  });

  const ctx = document.getElementById('treBalanceChart');
  if(ctx) {
    drawChart('tre', ctx, {
      type:'line',
      data:{ labels, datasets:[{ label:'Balance (₹)', data: chartData, tension:.25, fill:false, borderColor: '#60C3C4' }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
  }
}

// Add Modal Open
if (treAddBtn) treAddBtn.onclick = () => {
  openModal("addTransModal");
};

// Bill Preview in Add Modal
if (transBill) {
  transBill.addEventListener("change", () => {
    const file = transBill.files[0];
    if (!file) {
      transBillPreview.innerHTML = "";
      return;
    }
    const url = URL.createObjectURL(file);
    transBillPreview.innerHTML = `
      <img src="${url}" style="width:120px; border-radius:8px; cursor:pointer;" id="billThumbTemp"/>
    `;
    document.getElementById("billThumbTemp").onclick = () => {
      billLightboxImg.src = url;
      openModal("billLightbox");
    };
  });
}

// --- UPLOAD LOGIC ---
const TREASURY_GAS_URL = "https://script.google.com/macros/s/AKfycbxhSGPm2HFUxUhZVLS16zKPiTV4Dnmxtz0CWC_OvH9KJobLYQSrSiAr3BcSIWS3-4Qtcg/exec";

function readAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); 
    reader.readAsDataURL(file);
  });
}

// Find and replace the uploadBillToDrive function in admin.js
async function uploadBillToDrive(file) {
  if (!file) return null;
  
  // Convert file to base64
  const base64 = await readAsBase64(file);
  
  // Prepare payload
  const payload = JSON.stringify({
    action: "uploadBill",
    fileName: file.name,
    fileData: base64
  });
  
  try {
    // "Content-Type: text/plain" is crucial for Google Apps Script CORS
    const res = await fetch(TREASURY_GAS_URL, { 
      method: "POST", 
      body: payload,
      headers: { "Content-Type": "text/plain" } 
    });

    if (!res.ok) {
      throw new Error(`Server responded with status: ${res.status}`);
    }

    const json = await res.json();
    if (json.status === "success") {
      return json.fileUrl;
    } else {
      throw new Error(json.message || "Script returned an error.");
    }

  } catch (err) {
    console.error("Upload Error:", err);
    // If it fails, we throw an error so the main Save function stops
    throw new Error("Bill upload failed. (Check: Is the script deployed as 'Anyone'?)");
  }
}
/*
addTransForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = addTransForm.querySelector('button[type="submit"]');
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const name = transName.value.trim();
    const type = transType.value;
    const amount = Number(transAmount.value);
    const avenue = transAvenue.value;
    
    const paidBy = transPaidBy.value.trim();
    const reimburse = transReimburse.value.trim();
    const cheque = transCheque.value.trim();

    const date = transDate.value;
    const billFile = transBill.files[0];
    let billUrl = "";

    if (billFile) {
      billUrl = await uploadBillToDrive(billFile);
    }

    await db.collection("treasury").add({
      name, type, amount, avenue, date,
      paidBy, reimburse, cheque, 
      billUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    closeModal("addTransModal");
    alert("Transaction saved!");
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = prevText;
  }
}); */
addTransForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: transName.value.trim(),
    type: transType.value,
    amount: Number(transAmount.value),
    avenue: transAvenue.value,
    date: transDate.value,
    paidBy: transPaidBy.value.trim() || "",
    reimburse: transReimburse.value.trim() || "",
    cheque: transCheque.value.trim() || "",
    billUrl: document.getElementById("transBillUrl").value.trim(),   // 👈 NEW
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("treasury").add(payload);
    closeModal("addTransModal");
  } catch (err) {
    alert("Failed to add transaction: " + err.message);
  }
});
// 3. EDIT POPULATION
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-edit-tre]");
  if (!btn) return;

  const id = btn.dataset.editTre;
  const t = TREAS.find(x => x.id === id);
  if (!t) return;

  document.getElementById("editTransId").value = id;
  
  // Populate fields
  document.getElementById("editTransName").value = t.name || "";
  document.getElementById("editTransType").value = t.type || "income";
  document.getElementById("editTransAmount").value = t.amount || 0;
  document.getElementById("editTransAvenue").value = t.avenue || "";
  document.getElementById("editTransDate").value = (t.date || "").slice(0,10);
  
  // NEW FIELDS
  editTransPaidBy.value = t.paidBy || "";
  editTransReimburse.value = t.reimburse || "";
  editTransCheque.value = t.cheque || "";

  // Bill preview
  if (t.billUrl) {
    editTransBillPreview.innerHTML = `
      <img src="${getGdriveImageUrl(t.billUrl)}"
           style="width:120px; border-radius:8px; cursor:pointer;"
           onclick="showBill('${t.billUrl}')">
    `;
  } else {
    editTransBillPreview.innerHTML = "No bill uploaded";
  }

  openModal("editTransModal");
});

// 4. UPDATE TRANSACTION SUBMIT
editTransForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = editTransForm.querySelector('button[type="submit"]');
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    const id = editTransId.value;
    const payload = {
      name: editTransName.value.trim(),
      type: editTransType.value,
      amount: Number(editTransAmount.value),
      avenue: editTransAvenue.value.trim(),
      date: editTransDate.value,
      
      // NEW FIELDS
      paidBy: editTransPaidBy.value.trim(),
      reimburse: editTransReimburse.value.trim(),
      cheque: editTransCheque.value.trim(),
    };

    const newFile = editTransBill.files[0];
    if (newFile) {
      payload.billUrl = await uploadBillToDrive(newFile);
    }

    await db.collection("treasury").doc(id).update(payload);
    closeModal("editTransModal");
    alert("Transaction updated!");
  } catch(err) {
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = prevText;
  }
});

// Delete Transaction
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

/* ---------- Export Logic ---------- */
// Treasury Export
function exportTreasuryToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  const data = getFilteredTreasury(); // <--- Export filtered data

  const header = ['Name', 'Type', 'Amount (₹)', 'Avenue', 'Date', 'Paid By', 'Reimbursement', 'Cheque No'];
  const rows = data.map(t => [
    t.name || '',
    t.type === 'income' ? 'Income' : 'Expense',
    Number(t.amount || 0),
    t.avenue || '',                                 
    (t.date || '').slice(0,10),
    t.paidBy || '',
    t.reimburse || '',
    t.cheque || ''
  ]);

  let inc = 0, exp = 0;
  data.forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'income') inc += amt; else exp += amt;
  });
  const net = inc - exp;

  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws1['!cols'] = [{wch:30},{wch:12},{wch:14},{wch:12},{wch:12}, {wch:20}, {wch:20}, {wch:15}];

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Summary (Filtered)'],
    ['Total Income (₹)', inc],
    ['Total Expense (₹)', exp],
    ['Net (₹)', net],
  ]);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Treasury');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `treasury_filtered_${dateTag}.xlsx`);
}
if (exportTreXlsxBtn) {
  exportTreXlsxBtn.addEventListener('click', exportTreasuryToExcel);
}

// Attendance Export
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
      const v = attForMember[e.id];        
      if (v === true)  return 'P';
      if (v === false) return 'A';
      if (v === 'NA')  return 'NA';
      return ''; 
    });
    return [m.name || '', ...cells];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `attendance_${dateTag}.xlsx`);
}
if (exportXlsxBtn) {
  exportXlsxBtn.addEventListener('click', exportAttendanceToExcel);
}

// BOD Export
function exportBodAttendanceToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }
  const header = [
    'BOD (Name / Position)',
    ...BODMEET.map(mt => {
      const d = (mt.date || '').slice(0,10);
      return d ? `${mt.name || ''} (${d})` : (mt.name || '');
    })
  ];
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
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOD Attendance');
  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `bod_attendance_${dateTag}.xlsx`);
}
if (exportBodXlsxBtn) {
  exportBodXlsxBtn.addEventListener('click', exportBodAttendanceToExcel);
}

/* ---------- Delete / Update Helpers ---------- */
async function removeMember(memberId){
  const m = MEMBERS.find(x => x.id === memberId);
  if (!confirm(`Delete member "${m?.name || memberId}"? This also deletes their attendance.`)) return;
  try{
    await db.collection('members').doc(memberId).delete();
    await db.collection('attendance').doc(memberId).delete();
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
  }catch(err){
    alert('Failed to delete event: ' + err.message);
  }
}

/* Filters */
[memberSearch, eventSearch, monthFilter, avenueFilter].forEach(el => {
  if (el) el.addEventListener('input', renderGrid);
});

/* Modal Logic Helpers (Edit Forms) */
if (editMemberForm) {
  editMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = editMemId.value;
    const name = (editMemName.value || '').trim();
    if (!id || !name) return;
    try {
      await db.collection('members').doc(id).update({ name });
      closeModal('editMemberModal');
    } catch (err) { alert('Failed to save member: ' + err.message); }
  });
}

if (editEventForm) {
  editEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = document.getElementById('editEvId').value;
    const name = (document.getElementById('editEvName').value || '').trim();
    const date = document.getElementById('editEvDate').value;
    const desc = (document.getElementById('editEvDesc').value || '').trim();
    const avenues = Array.from(document.querySelectorAll('#editEventModal input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    if (!id || !name || !date) return;
    try {
      await db.collection('events').doc(id).update({ name, date, desc, avenue: avenues });
      closeModal('editEventModal');
    } catch (err) { alert('Failed to save event: ' + err.message); }
  });
}

if (editBodMemberForm) {
  editBodMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = editBodMemId.value;
    const name = (editBodMemName.value || '').trim();
    const pos  = (editBodMemPos.value || '').trim();
    if (!id || !name) return;
    try {
      await db.collection('bodMembers').doc(id).update({ name, position: pos });
      closeModal('editBodMemberModal');
    } catch (err) { alert('Failed to save BOD member: ' + err.message); }
  });
}

if (editBodMeetingForm) {
  editBodMeetingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = editBodMeetId.value;
    const name = (editBodMeetName.value || '').trim();
    const date = editBodMeetDate.value || '';
    if (!id || !name || !date) return;
    try {
      await db.collection('bodMeetings').doc(id).update({ name, date });
      closeModal('editBodMeetingModal');
    } catch (err) { alert('Failed to save meeting: ' + err.message); }
  });
}

if (addMemberForm) {
  addMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (addMemName?.value || '').trim();
    if (!name) return;
    await db.collection('members').add({ name });
    closeModal('addMemberModal');
  });
}

if (addEventForm) {
  addEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (addEvName?.value || '').trim();
    const date = addEvDate?.value || '';
    const desc = (addEvDesc?.value || '').trim();
    const avenues = Array.from(addEventForm.querySelectorAll('fieldset input[type="checkbox"]:checked'))
      .map(c => c.value);
    if (!name || !date) return;
    await db.collection('events').add({ name, date, desc, avenue: avenues });
    closeModal('addEventModal');
  });
}

function getFilteredMembersAndEvents(){
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value; 
  const avenueSel = avenueFilter.value; 

  const members = MEMBERS.filter(m => (m.name || '').toLowerCase().includes(memQuery));
  let events = EVENTS.filter(e => (e.name || '').toLowerCase().includes(evQuery));
  if (monthSel) events = events.filter(e => (e.date || '').startsWith(monthSel));
  if (avenueSel) {
    events = events.filter(e => {
      const eventAvenues = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      if (avenueSel === '_NONE_') return eventAvenues.length === 0;
      return eventAvenues.includes(avenueSel);
    });
  }
  return { members, events };
}

if (document.getElementById('bodMemCancel'))  document.getElementById('bodMemCancel').onclick  = () => closeModal('editBodMemberModal');
if (document.getElementById('bodMeetCancel')) document.getElementById('bodMeetCancel').onclick = () => closeModal('editBodMeetingModal');
if (document.getElementById('memCancel')) document.getElementById('memCancel').onclick = () => closeModal('editMemberModal');
if (document.getElementById('evCancel'))  document.getElementById('evCancel').onclick  = () => closeModal('editEventModal');

// Treasury Filter Listeners
if (treFilterType) treFilterType.addEventListener('change', renderTreasurer);
if (treFilterMonth) treFilterMonth.addEventListener('change', renderTreasurer);
if (treFilterAvenue) treFilterAvenue.addEventListener('change', renderTreasurer);
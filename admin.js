function getGdriveImageUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com")) {
    const idMatch = url.match(/[-\w]{25,}/);
    if (idMatch) {
      return `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=s1000`;
    }
  }
  return url;
}

const auth = window.auth;
const db   = window.db;

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
const treBody            = document.getElementById('treBody');
const exportTreXlsxBtn   = document.getElementById('exportTreXlsxBtn');

const transName      = document.getElementById("transName");
const transType      = document.getElementById("transType");
const transAmount    = document.getElementById("transAmount");
const transAvenue    = document.getElementById("transAvenue");
const transDate      = document.getElementById("transDate");
const transPaidBy    = document.getElementById("transPaidBy");
const transReimburse = document.getElementById("transReimburse");
const transCheque    = document.getElementById("transCheque");

const transBill      = document.getElementById("transBill");
const transBillPreview = document.getElementById("transBillPreview");
const addTransForm   = document.getElementById("addTransForm");
const treAddBtn      = document.getElementById('treAddBtn');

const editTransForm   = document.getElementById("editTransForm");
const editTransId     = document.getElementById("editTransId"); // Ensure this hidden input exists
const editTransName   = document.getElementById("editTransName");
const editTransType   = document.getElementById("editTransType");
const editTransAmount = document.getElementById("editTransAmount");
const editTransAvenue = document.getElementById("editTransAvenue");
const editTransDate   = document.getElementById("editTransDate");
const editTransBill   = document.getElementById("editTransBill");
const editTransBillPreview = document.getElementById("editTransBillPreview");
const editTransPaidBy    = document.getElementById("editTransPaidBy");
const editTransReimburse = document.getElementById("editTransReimburse");
const editTransCheque    = document.getElementById("editTransCheque");

const billLightboxImg = document.getElementById("billLightboxImg");

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

const distCountBadge   = document.getElementById('distCountBadge');

const distMemberSearch = document.getElementById('distMemberSearch');
const distEventSearch  = document.getElementById('distEventSearch');
const distMonthFilter  = document.getElementById('distMonthFilter');

const addDistEventBtn  = document.getElementById('addDistEventBtn');
const exportDistXlsxBtn= document.getElementById('exportDistXlsxBtn');

const distHead         = document.getElementById('distHead');
const distBody         = document.getElementById('distBody');

const distAvg          = document.getElementById('distAvg');
const distEvtCount     = document.getElementById('distEvtCount');
const distTop          = document.getElementById('distTop');

const addDistEventModal= document.getElementById('addDistEventModal');
const addDistEventForm = document.getElementById('addDistEventForm');
const addDistEvName    = document.getElementById('addDistEvName');
const addDistEvDate    = document.getElementById('addDistEvDate');
const addDistEvEndDate = document.getElementById('addDistEvEndDate');
const addDistEvDesc    = document.getElementById('addDistEvDesc');

const sendMailBtn        = document.getElementById('sendMailBtn');
const sendMailMenu       = document.getElementById('sendMailMenu');
const sendWarningBtn     = document.getElementById('sendWarningBtn');
const sendTerminationBtn = document.getElementById('sendTerminationBtn');

const mailModalTitle = document.getElementById('mailModalTitle');
const mailTypeChip   = document.getElementById('mailTypeChip');
const mailTargetChip = document.getElementById('mailTargetChip');
const mailForm       = document.getElementById('mailForm');
const mailFrom       = document.getElementById('mailFrom');
const mailTo         = document.getElementById('mailTo');
const mailSubject    = document.getElementById('mailSubject');
const mailBody       = document.getElementById('mailBody');

const sendGbmMailBtn        = document.getElementById('sendGbmMailBtn');
const sendGbmMailMenu       = document.getElementById('sendGbmMailMenu');
const sendGbmWarningBtn     = document.getElementById('sendGbmWarningBtn');
const sendGbmTerminationBtn = document.getElementById('sendGbmTerminationBtn');

const insightAttendanceHealth = document.getElementById('insightAttendanceHealth');
const insightLowAttendance    = document.getElementById('insightLowAttendance');
const insightTopAvenue        = document.getElementById('insightTopAvenue');
const insightTrend            = document.getElementById('insightTrend');
const insightSummaryList      = document.getElementById('insightSummaryList');

if (addDistEventBtn) addDistEventBtn.onclick = () => openModal('addDistEventModal');

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
    if(modalId === 'addTransModal' && transBillPreview) transBillPreview.innerHTML = "";
    if(modalId === 'editTransModal' && editTransBillPreview) editTransBillPreview.innerHTML = "";
  }
}

document.addEventListener('click', async (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
    return;
  }

  const delDistEventBtn = e.target.closest('button[data-del-dist-event]');
  if (delDistEventBtn) {
    const id = delDistEventBtn.dataset.delDistEvent;
    const ev = DIST_EVENTS.find(x => x.id === id);

    if (!confirm(`Delete district event "${ev?.name || id}"?`)) return;

    try {
      await db.collection('districtEvents').doc(id).delete();
    } catch (err) {
      alert('Failed to delete district event: ' + err.message);
    }
    return;
  }
});

let MEMBERS = [];
let EVENTS  = [];
let ATT     = {}; 

let DIST_EVENTS = [];
let DIST_ATT    = {}; 

let BODM = [];      
let BODMEET = [];   
let BODATT = {};   

let FINES = [];
let TREAS = []; 

let unsubMembers = null;
let unsubEvents  = null;
let unsubAtt     = null; 
let unsubFines   = null;
let unsubBodM    = null;
let unsubBodMt   = null;
let unsubBodAt   = null;
let unsubTre     = null;
let unsubDistEvents = null;
let unsubDistAtt    = null;

let IS_PRESIDENT = false;

const _charts = {};
function drawChart(key, ctx, cfg){
  if (!window.Chart || !ctx) return; 
  if (_charts[key]) { _charts[key].destroy(); }
  _charts[key] = new Chart(ctx, cfg);
}

const fmt = n => Number(n).toLocaleString();
const yyyymm = d => d.slice(0,7);

function membersMap() {
  const map = {};
  MEMBERS.forEach(m => map[m.id] = m.name || '');
  return map;
}

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
    if (role && role !== 'admin' && role !== 'president') {
      window.location.href = 'bodlogin.html';
      return;
    }
  } catch (e) {
    console.warn('Role check failed; continuing:', e);
  }

  await startAttendancePage();
});

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

function getFilteredTreasury() {
  const typeVal   = treFilterType.value;
  const monthVal  = treFilterMonth.value;
  const avenueVal = treFilterAvenue.value;

  return TREAS.filter(t => {
    if (typeVal && t.type !== typeVal) return false;
    
    if (monthVal && (t.date || '').slice(0, 7) !== monthVal) return false;

    if (avenueVal) {
      if (avenueVal === 'Other') {
        if (t.avenue && t.avenue !== 'No Avenue' && t.avenue !== 'Other') return false;
      } else {
        if (t.avenue !== avenueVal) return false;
      }
    }
    return true;
  });
}

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

  if (existingVal) treFilterMonth.value = existingVal;
}
async function loadData(){
  const [mSnap, eSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get()
  ]);

  MEMBERS = mSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  EVENTS  = eSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  
  if (fineMember) {
    fineMember.innerHTML = '<option value="" disabled selected>Member…</option>' +
      MEMBERS.map(m => `<option value="${m.id}">${(m.name || '').replace(/</g,'&lt;')}</option>`).join('');
  }
  
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

  const fSnap = await db.collection('fines').orderBy('date','desc').get();
  FINES = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFines();

  buildMonthFilterFromEvents();
  const attSnap = await db.collection('attendance').get();
  ATT = {};
  attSnap.forEach(d => { ATT[d.id] = d.data() || {}; });
  renderGrid();
  if (distHead && distBody) {
    await loadDistrictData();
  }
if (treBody) {
  if (transDate && !transDate.value) transDate.value = new Date().toISOString().slice(0,10);
  const tSnap = await db.collection('treasury').orderBy('date','desc').get();
  TREAS = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  buildTreasuryMonthFilter(); 
  renderTreasurer();
}
}
async function startAttendancePage() {
  await loadData();
  attachRealtimeListeners();
}

function attachRealtimeListeners() {
  if (unsubDistEvents) { unsubDistEvents(); unsubDistEvents = null; }
  if (unsubDistAtt)    { unsubDistAtt();    unsubDistAtt    = null; }
  if (unsubMembers) { unsubMembers(); unsubMembers = null; }
  if (unsubEvents)  { unsubEvents();  unsubEvents  = null; }
  if (unsubAtt)     { unsubAtt();     unsubAtt     = null; }
  if (unsubFines)   { unsubFines();   unsubFines   = null; }
  if (unsubBodM)    { unsubBodM();    unsubBodM    = null; }
  if (unsubBodMt)   { unsubBodMt();   unsubBodMt   = null; }
  if (unsubBodAt)   { unsubBodAt();   unsubBodAt   = null; }
  if (unsubTre)     { unsubTre();     unsubTre     = null; }

  unsubFines = db.collection('fines').orderBy('date', 'desc').onSnapshot((snap) => {
    FINES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFines();
  });

unsubMembers = db.collection('members').orderBy('name').onSnapshot((snap) => {
  MEMBERS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGrid();
  renderInsightsPanel(); 
});

unsubEvents = db.collection('events').orderBy('date', 'desc').onSnapshot((snap) => {
  EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildMonthFilterFromEvents();
  renderGrid();
  renderInsightsPanel();   
});

unsubAtt = db.collection('attendance').onSnapshot((snap) => {
  const next = {};
  snap.forEach(d => { next[d.id] = d.data() || {}; });
  ATT = next;
  renderGrid();
  renderInsightsPanel();   
});
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
  if (distHead && distBody) {
    unsubDistEvents = db.collection('districtEvents').orderBy('date', 'desc').onSnapshot(snap => {
      DIST_EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      buildDistMonthFilterFromEvents();
      renderDistrictGrid();
    });

    unsubDistAtt = db.collection('districtAttendance').onSnapshot(snap => {
      const next = {};
      snap.forEach(d => { next[d.id] = d.data() || {}; });
      DIST_ATT = next;
      renderDistrictGrid();
    });
  }
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
function getFilteredMembersAndEvents() {
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value;
  const avenueSel = avenueFilter.value;

  const members = MEMBERS.filter(m => (m.name || '').toLowerCase().includes(memQuery));

  let events = EVENTS.filter(e => (e.name || '').toLowerCase().includes(evQuery));

  if (monthSel) {
    events = events.filter(e => (e.date || '').startsWith(monthSel));
  }

  if (avenueSel) {
    events = events.filter(e => {
      const eventAvenues = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      if (avenueSel === 'Other') return eventAvenues.length === 0;
      return eventAvenues.includes(avenueSel);
    });
  }

  return { members, events };
}

async function bulkSetAttendanceForEvent(eventId, value) {
  const { members } = getFilteredMembersAndEvents();
  if (!members.length) return;

  const batch = db.batch();

  members.forEach(m => {
    const ref = db.collection('attendance').doc(m.id);
    batch.set(ref, { [eventId]: value }, { merge: true });
    ATT[m.id] = ATT[m.id] || {};
    ATT[m.id][eventId] = value;
  });

  await batch.commit();
  renderGrid();
}

async function bulkSetAttendanceForMember(memberId, value) {
  const { events } = getFilteredMembersAndEvents();
  if (!events.length) return;

  const payload = {};
  events.forEach(ev => {
    payload[ev.id] = value;
  });

  await db.collection('attendance').doc(memberId).set(payload, { merge: true });

  ATT[memberId] = ATT[memberId] || {};
  events.forEach(ev => {
    ATT[memberId][ev.id] = value;
  });

  renderGrid();
}

async function bulkSetBodForMeeting(meetingId, value) {
  if (!BODM.length) return;

  const batch = db.batch();

  BODM.forEach(m => {
    const ref = db.collection('bodAttendance').doc(m.id);
    batch.set(ref, { [meetingId]: value }, { merge: true });
    BODATT[m.id] = BODATT[m.id] || {};
    BODATT[m.id][meetingId] = value;
  });

  await batch.commit();
  renderBodGrid();
}

async function bulkSetBodForMember(memberId, value) {
  if (!BODMEET.length) return;

  const payload = {};
  BODMEET.forEach(mt => {
    payload[mt.id] = value;
  });

  await db.collection('bodAttendance').doc(memberId).set(payload, { merge: true });

  BODATT[memberId] = BODATT[memberId] || {};
  BODMEET.forEach(mt => {
    BODATT[memberId][mt.id] = value;
  });

  renderBodGrid();
}
function isWRWEvent(ev) {
  const name = String(ev.name || '').trim().toLowerCase();

  const WRW_EVENT_NAMES = [
    'clean up drive',
    'mahadaan 11.0',
    'rotary-rotaract round table',
    'the luxe carry',
    'rotaract originals',
    'pickleball smashdown',
    'celebrating her'
  ];

  return WRW_EVENT_NAMES.includes(name);
}

function getEventAttendanceCount(eventId, members) {
  let present = 0;
  let considered = 0;

  members.forEach(m => {
    const v = (ATT[m.id] || {})[eventId];
    if (v !== 'NA') {
      considered++;
      if (v === true) present++;
    }
  });

  return { present, considered };
}
function buildDistMonthFilterFromEvents() {
  if (!distMonthFilter) return;

  distMonthFilter.innerHTML = '<option value="">All months</option>';

  Array.from(new Set(DIST_EVENTS.map(e => (e.date || '').slice(0, 7))))
    .filter(Boolean)
    .sort()
    .forEach(ym => {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m - 1, 1);

      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      distMonthFilter.appendChild(opt);
    });
}

async function loadDistrictData() {
  const [deSnap, daSnap] = await Promise.all([
    db.collection('districtEvents').orderBy('date', 'desc').get(),
    db.collection('districtAttendance').get()
  ]);

  DIST_EVENTS = deSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  DIST_ATT = {};
  daSnap.forEach(d => {
    DIST_ATT[d.id] = d.data() || {};
  });

  buildDistMonthFilterFromEvents();
  renderDistrictGrid();
}
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
      if (avenueSel === 'Other') return eventAvenues.length === 0;
      return eventAvenues.includes(avenueSel);
    });
  }

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
            const wrwHtml = isWRWEvent(e)
        ? `<div class="event-mini-tag wrw">WRW</div>`
        : '';

const { present: eventPresent } = getEventAttendanceCount(e.id, members);
const eventCountHtml = `<div class="event-att-count">✓ ${eventPresent}</div>`;

return `
  <th title="${e.date || ''}">
    <div class="bulk-wrap">
      <div class="ev-head">
        <span>${e.name || ''}</span>
        <button class="icon-btn" title="Rename event" data-edit-event="${e.id}">✏️</button>
        <button class="icon-btn" title="Delete event" data-del-event="${e.id}">🗑</button>
      </div>

      ${wrwHtml}
      ${avenueHtml}

      <small>
        ${(e.date || '').slice(0,10)}
        ${e.endDate ? ` → ${e.endDate.slice(0,10)}` : ""}
      </small>

      <select class="bulk-select" data-bulk-event="${e.id}">
        <option value="">All attendance</option>
        <option value="P">✓ Present</option>
        <option value="A">✗ Absent</option>
        <option value="NA">NA</option>
      </select>

      ${eventCountHtml}
    </div>
  </th>
`;
    }).join('');
    
  attHead.innerHTML = '';
  attHead.appendChild(headRow);

  attBody.innerHTML = '';
  members.forEach(m => {
    const tr = document.createElement('tr');
    const attForMember = ATT[m.id] || {};

    const values  = events.map(e => attForMember[e.id]);
    const considered = values.filter(v => v !== 'NA'); 
    const total   = considered.length;
    const present = considered.filter(v => v === true).length;
    const pct     = total ? Math.round((present/total)*100) : 0;

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

    <div class="bulk-wrap" style="align-items:flex-start;">
      <div class="mem-cell">
        <span>${m.name || ''}</span>
        <button class="icon-btn" title="Rename member" data-edit-member="${m.id}">✏️</button>
        <button class="icon-btn" title="Delete member" data-del-member="${m.id}">🗑</button>
      </div>

      <select class="bulk-select" data-bulk-member="${m.id}">
        <option value="">All events</option>
        <option value="P">✓ Present</option>
        <option value="A">✗ Absent</option>
        <option value="NA">NA</option>
      </select>
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

  const lowAttendanceMembers = memberStats.filter(m => m.pct < 60 && m.total > 0);

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

  lines.push(`<div class="insight-item"><strong>${totalMembers}</strong> members and <strong>${totalEvents}</strong> events are currently tracked in the attendance system.</div>`);

  if (top3.length) {
    lines.push(`<div class="insight-item"><strong>Top Attendees:</strong> ${top3.map(x => `${x.name.split(' ')[0]} (${x.pct}%)`).join(', ')}</div>`);
  }

  if (low3.length) {
    lines.push(`<div class="insight-item"><strong>Low Attendees:</strong> ${low3.map(x => `${x.name.split(' ')[0]} (${x.pct}%)`).join(', ')}</div>`);
  } else {
    lines.push(`<div class="insight-item"><strong>Great sign:</strong> No members are currently below the 60% attendance threshold.</div>`);
  }

  lines.push(`<div class="insight-item"><strong>Most active avenue:</strong> ${topAvenue}</div>`);
  lines.push(`<div class="insight-item"><strong>Recent trend:</strong> ${trendText}</div>`);

  insightSummaryList.innerHTML = lines.join('');
}
function renderDistrictGrid() {
  if (!distHead || !distBody) return;

  const memQuery = (distMemberSearch?.value || '').trim().toLowerCase();
  const evQuery  = (distEventSearch?.value || '').trim().toLowerCase();
  const monthSel = distMonthFilter?.value || '';

  const members = MEMBERS.filter(m =>
    (m.name || '').toLowerCase().includes(memQuery)
  );

  let events = DIST_EVENTS.filter(e =>
    (e.name || '').toLowerCase().includes(evQuery)
  );

  if (monthSel) {
    events = events.filter(e => (e.date || '').startsWith(monthSel));
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML =
    `<th class="sticky-col">Member \\ District Event</th>` +
    events.map(e => `
      <th title="${e.date || ''}">
        <div class="bulk-wrap">
          <div class="ev-head">
            <span>${e.name || ''}</span>
            <button class="icon-btn" title="Delete district event" data-del-dist-event="${e.id}">🗑</button>
          </div>
          <small>
            ${(e.date || '').slice(0,10)}
            ${e.endDate ? ` → ${e.endDate.slice(0,10)}` : ''}
          </small>
        </div>
      </th>
    `).join('');

  distHead.innerHTML = '';
  distHead.appendChild(headRow);

  distBody.innerHTML = '';

  members.forEach(m => {
    const attForMember = DIST_ATT[m.id] || {};

    const values = events.map(e => attForMember[e.id]);
    const considered = values.filter(v => v !== 'NA');
    const total = considered.length;
    const present = considered.filter(v => v === true).length;
    const pct = total ? Math.round((present / total) * 100) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML =
      `
      <td class="sticky-col">
        <div class="mem-left">
          <div class="stat-box" title="Across visible district events">
            <span class="stat">All: ${present}/${total} · ${pct}%</span>
          </div>
          <div class="mem-cell">
            <span>${m.name || ''}</span>
          </div>
        </div>
      </td>
      ` +
      events.map(e => {
        const v = attForMember[e.id];
        let cls = 'off';
        let aria = 'Absent';

        if (v === true) {
          cls = 'on';
          aria = 'Present';
        } else if (v === 'NA') {
          cls = 'na';
          aria = 'Not applicable';
        }

        return `
          <td data-dist-m="${m.id}" data-dist-e="${e.id}">
            <button class="cell-btn ${cls}" aria-label="${aria}"></button>
          </td>
        `;
      }).join('');

    distBody.appendChild(tr);
  });

  if (distCountBadge) {
    distCountBadge.textContent = `${members.length} members · ${events.length} district events`;
  }

  renderDistrictInsights(members, events);
}
function renderDistrictInsights(members, events) {
  if (distEvtCount) distEvtCount.textContent = events.length || '0';

  let totalSlots = 0;
  let totalPresent = 0;

  const perEventPresent = events.map(ev => {
    let present = 0;
    let considered = 0;

    members.forEach(m => {
      const v = (DIST_ATT[m.id] || {})[ev.id];
      if (v !== 'NA') {
        considered++;
        if (v === true) present++;
      }
    });

    totalSlots += considered;
    totalPresent += present;
    return present;
  });

  const avg = totalSlots ? Math.round((totalPresent / totalSlots) * 100) : 0;
  if (distAvg) distAvg.textContent = `${avg}%`;

  const topMembers = members.map(m => {
    let c = 0;
    events.forEach(ev => {
      if ((DIST_ATT[m.id] || {})[ev.id] === true) c++;
    });
    return { name: m.name || '', c };
  })
  .sort((a, b) => b.c - a.c)
  .slice(0, 3);

  if (distTop) {
    distTop.textContent = topMembers.length
      ? topMembers.map(x => `${x.name.split(' ')[0]}(${x.c})`).join(', ')
      : '–';
  }

  const ctx = document.getElementById('distChart');
  drawChart('dist', ctx, {
    type: 'bar',
    data: {
      labels: events.map(e => e.name || ''),
      datasets: [{
        label: 'Present',
        data: perEventPresent
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
if (distBody) {
  distBody.addEventListener('click', async (e) => {
    const td = e.target.closest('td[data-dist-m][data-dist-e]');
    if (!td) return;

    const memberId = td.dataset.distM;
    const eventId  = td.dataset.distE;

    const current = (DIST_ATT[memberId] || {})[eventId];
    const next = current === true ? false : current === false ? 'NA' : true;

    try {
      await db.collection('districtAttendance').doc(memberId).set(
        { [eventId]: next },
        { merge: true }
      );

      DIST_ATT[memberId] = DIST_ATT[memberId] || {};
      DIST_ATT[memberId][eventId] = next;

      renderDistrictGrid();
    } catch (err) {
      alert('Failed to update district attendance: ' + err.message);
    }
  });
}
if (addDistEventForm) {
  addDistEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (addDistEvName?.value || '').trim();
    const date = addDistEvDate?.value || '';
    const endDate = addDistEvEndDate?.value || '';
    const desc = (addDistEvDesc?.value || '').trim();

    if (!name || !date) {
      alert('Please enter district event name and start date.');
      return;
    }

    try {
      await db.collection('districtEvents').add({
        name,
        date,
        endDate: endDate || '',
        desc: desc || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.uid || null
      });

      closeModal('addDistEventModal');
    } catch (err) {
      alert('Failed to add district event: ' + err.message);
    }
  });
}
if (exportDistXlsxBtn) {
  exportDistXlsxBtn.addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
      alert('Excel export library not loaded.');
      return;
    }

    const members = MEMBERS.filter(m =>
      (m.name || '').toLowerCase().includes((distMemberSearch?.value || '').trim().toLowerCase())
    );

    let events = DIST_EVENTS.filter(e =>
      (e.name || '').toLowerCase().includes((distEventSearch?.value || '').trim().toLowerCase())
    );

    const monthSel = distMonthFilter?.value || '';
    if (monthSel) {
      events = events.filter(e => (e.date || '').startsWith(monthSel));
    }

    const rows = members.map(m => {
      const row = { Member: m.name || '' };

      events.forEach(ev => {
        const v = (DIST_ATT[m.id] || {})[ev.id];
        row[ev.name || ev.id] = v === true ? 'Present' : v === false ? 'Absent' : 'NA';
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'District Attendance');
    XLSX.writeFile(wb, 'district_attendance.xlsx');
  });
}

function renderBodGrid(){
  if (!bodHead || !bodBody) return;

  const headRow = document.createElement('tr');
  headRow.innerHTML =
    `<th class="sticky-col">BOD \\ Meeting<br><small>Position</small></th>` +
    BODMEET.map(mt => `
<th title="${mt.date || ''}">
  <div class="bulk-wrap">
    <div class="ev-head">
      <span>${mt.name || ''}</span>
      <button class="icon-btn" title="Rename meeting" data-edit-bod-meeting="${mt.id}">✏️</button>
      <button class="icon-btn" title="Delete meeting" data-del-bod-meeting="${mt.id}">🗑</button>
    </div>

    <small>${(mt.date || '').slice(0,10)}</small>

    <select class="bulk-select" data-bulk-bod-meeting="${mt.id}">
      <option value="">All attendance</option>
      <option value="P">✓ Present</option>
      <option value="A">✗ Absent</option>
      <option value="NA">NA</option>
    </select>
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

    <div class="bulk-wrap" style="align-items:flex-start;">
      <div class="mem-cell">
        <span>${m.name || ''}</span>
        <small style="opacity:.7; display:block">${m.position || ''}</small>
        <button class="icon-btn" title="Edit name/position" data-edit-bod-member="${m.id}">✏️</button>
        <button class="icon-btn" title="Remove BOD" data-del-bod-member="${m.id}">🗑</button>
      </div>

      <select class="bulk-select" data-bulk-bod-member="${m.id}">
        <option value="">All meetings</option>
        <option value="P">✓ Present</option>
        <option value="A">✗ Absent</option>
        <option value="NA">NA</option>
      </select>
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

document.addEventListener('click', async (e) => {
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
  bodHead.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-bod-meeting]');
  if (!sel || !sel.value) return;

  const meetingId = sel.dataset.bulkBodMeeting;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all BOD members as ${label} for this meeting?`)) {
    sel.value = '';
    return;
  }

  await bulkSetBodForMeeting(meetingId, value);
  sel.value = '';
});

bodBody.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-bod-member]');
  if (!sel || !sel.value) return;

  const memberId = sel.dataset.bulkBodMember;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all meetings as ${label} for this BOD member?`)) {
    sel.value = '';
    return;
  }

  await bulkSetBodForMember(memberId, value);
  sel.value = '';
});
});

function escapeMailValue(value) {
  return encodeURIComponent(value || '');
}

function buildMailtoUrl({ to, subject, body, from }) {
  const fullBody = from
    ? `${body}\n\nFrom: ${from}`
    : body;

  return `mailto:${encodeURIComponent(to || '')}?subject=${escapeMailValue(subject)}&body=${escapeMailValue(fullBody)}`;
}

function buildWarningTemplate() {
  return `Dear Rtr. [Name],

Greetings from the desk of President and Sergeant At Arms,

This is to formally inform you that you have been absent for three consecutive meetings of the Rotaract Club of Pune Heritage.

As per the club bylaws under:
“Article X – Termination”
a member/BOD who is not present for three consecutive General Body Meetings (GBMs) is liable to receive a formal warning from the President and Sergeant-at-Arms.

This email serves as your official warning notice.

We request you to take this matter seriously and ensure your regular attendance in upcoming meetings. Consistent absence may lead to further action as per the club bylaws, including possible termination from your position.

We value your presence and contributions to the club and hope to see active participation from your end moving forward.

If you have any valid reasons or concerns, feel free to communicate with us.

Regards,  
Rtr. Aneesh Ladkat  
President | RIY 2025–26  
Rotaract Club of Pune Heritage  

Rtr. Riya Chandavale  
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26  
Rotaract Club of Pune Heritage`;
}

function buildTerminationTemplate() {
  return `Dear Rtr. [Name],
Greetings from the desk of President and Sergeant At Arms,
This is to formally inform you that your termination from the position of [Postion Name], effective [Date], has been issued.
This decision has been taken in accordance with the club bylaws under:
“ANNEXURE B – BOD Termination”
Please note that this termination is only from the Board position and does not affect your membership as a
General Body Member of the Rotaract Club of Pune Heritage. You will continue to remain a valued part of
the club as a member.
Please find the official termination letter attached with this email for your reference and necessary action.
You are requested to ensure that all pending handovers (files, data, access, and reports) are completed with the
concerned authority before the effective date.
We truly appreciate your contributions so far, and we would like to assure you that the club will always remain supportive
and available for you whenever needed.
Regards,
Rtr. Aneesh Ladkat
President | RIY 2025–26
Rotaract Club of Pune Heritage
Rtr. Riya Chandavale
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26
Rotaract Club of Pune Heritage`;
}
function buildGbmWarningTemplate() {
  return `Dear Rtr. [Name],

Greetings from the desk of President and Sergeant At Arms,

This is to formally inform you that you have been absent for three consecutive meetings of the Rotaract Club of Pune Heritage.

As per the club bylaws under:
“Article X – Termination”
a member/BOD who is not present for three consecutive General Body Meetings (GBMs) is liable to receive a formal warning from the President and Sergeant-at-Arms.

This email serves as your official warning notice.

We request you to take this matter seriously and ensure your regular attendance in upcoming meetings. Consistent absence may lead to further action as per the club bylaws, including possible termination from your position.

We value your presence and contributions to the club and hope to see active participation from your end moving forward.

If you have any valid reasons or concerns, feel free to communicate with us.

Regards,  
Rtr. Aneesh Ladkat  
President | RIY 2025–26  
Rotaract Club of Pune Heritage  

Rtr. Riya Chandavale  
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26  
Rotaract Club of Pune Heritage`;
}

function buildGbmTerminationTemplate() {
  return `Dear Rtr. [Name],
Greetings from the desk of President and Sergeant At Arms,
This is to formally inform you that your termination as a General Body Member, effective [Date], has been issued.
This decision has been taken in accordance with the club bylaws under:
“Article X – Termination”
which states that if a member remains absent for three consecutive General Body Meetings (GBMs) and continues to remain inactive for a period exceeding 45 days, they shall be liable for termination from the club membership.
Despite prior communication and a formal warning issued from the President and Sergeant-at-Arms, there has been no sufficient improvement in attendance/participation.

Please note that with this termination, you will no longer hold membership in the Rotaract Club of Pune Heritage.

We request you to complete any pending formalities, if applicable, and return any club-related materials or responsibilities.

We sincerely appreciate your association with the club and wish you the very best in your future endeavors.
Regards,
Rtr. Aneesh Ladkat
President | RIY 2025–26
Rotaract Club of Pune Heritage
Rtr. Riya Chandavale
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26
Rotaract Club of Pune Heritage`;
}
function setMailMenuOpen(isOpen) {
  if (!sendMailMenu) return;
  sendMailMenu.hidden = !isOpen;
}

function openBodMailModal(type) {
  const isWarning = type === 'warning';

  if (mailModalTitle) {
    mailModalTitle.textContent = isWarning ? 'Send Warning Mail' : 'Send Termination Mail';
  }

  if (mailTypeChip) {
    mailTypeChip.textContent = isWarning ? 'Warning' : 'Termination';
  }

  if (mailTargetChip) {
    mailTargetChip.textContent = 'Manual recipient';
  }

  if (mailFrom) mailFrom.value = '';
  if (mailTo) mailTo.value = '';
  if (mailSubject) {
    mailSubject.value = isWarning
      ? 'Attendance Warning Notice'
      : 'Termination of Position – [Postion Name] | RIY 25-26';
  }

  if (mailBody) {
    mailBody.value = isWarning
      ? buildWarningTemplate()
      : buildTerminationTemplate();
  }

  openModal('mailModal');
}
function openGbmMailModal(type) {
  const isWarning = type === 'warning';

  if (mailModalTitle) {
    mailModalTitle.textContent = isWarning ? 'Send GBM Warning Mail' : 'Send GBM Termination Mail';
  }

  if (mailTypeChip) {
    mailTypeChip.textContent = isWarning ? 'GBM Warning' : 'GBM Termination';
  }

  if (mailTargetChip) {
    mailTargetChip.textContent = 'Manual recipient';
  }

  if (mailFrom) mailFrom.value = '';
  if (mailTo) mailTo.value = '';
  if (mailSubject) {
    mailSubject.value = isWarning
      ? 'GBM Attendance Warning Notice'
      : 'GBM Attendance Termination Notice';
  }

  if (mailBody) {
    mailBody.value = isWarning
      ? buildGbmWarningTemplate()
      : buildGbmTerminationTemplate();
  }

  openModal('mailModal');
}
if (sendMailBtn && sendMailMenu) {
  sendMailBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const shouldOpen = sendMailMenu.hidden;
    setMailMenuOpen(shouldOpen);
  });

  sendMailMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    const clickedInsideMenu = e.target.closest('.mail-menu');
    if (!clickedInsideMenu) {
      setMailMenuOpen(false);
    }
  });
}

if (sendWarningBtn) {
  sendWarningBtn.addEventListener('click', () => {
    setMailMenuOpen(false);
    openBodMailModal('warning');
  });
}

if (sendTerminationBtn) {
  sendTerminationBtn.addEventListener('click', () => {
    setMailMenuOpen(false);
    openBodMailModal('termination');
  });
}
if (sendGbmMailBtn && sendGbmMailMenu) {
  sendGbmMailBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const shouldOpen = sendGbmMailMenu.hidden;
    sendGbmMailMenu.hidden = !shouldOpen;

    if (sendMailMenu) sendMailMenu.hidden = true;
  });

  sendGbmMailMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    const clickedInsideGbmMenu = e.target.closest('#sendGbmMailBtn, #sendGbmMailMenu');
    if (!clickedInsideGbmMenu) {
      sendGbmMailMenu.hidden = true;
    }
  });
}

if (sendGbmWarningBtn) {
  sendGbmWarningBtn.addEventListener('click', () => {
    if (sendGbmMailMenu) sendGbmMailMenu.hidden = true;
    openGbmMailModal('warning');
  });
}

if (sendGbmTerminationBtn) {
  sendGbmTerminationBtn.addEventListener('click', () => {
    if (sendGbmMailMenu) sendGbmMailMenu.hidden = true;
    openGbmMailModal('termination');
  });
}
if (mailForm) {
  mailForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const to = (mailTo?.value || '').trim();
    const from = (mailFrom?.value || '').trim();
    const subject = (mailSubject?.value || '').trim();
    const body = (mailBody?.value || '').trim();

    if (!to || !subject || !body) {
      alert('Please fill To, Subject, and Message before opening the draft.');
      return;
    }

    const mailtoUrl = buildMailtoUrl({ to, subject, body, from });
    window.location.href = mailtoUrl;
    closeModal('mailModal');
  });
}

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

attHead.addEventListener('click', (e) => {
  const delBtn = e.target.closest('button[data-del-event]');
  if (delBtn) {
    removeEvent(delBtn.dataset.delEvent);
    return; 
  }

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
  const delBtn = e.target.closest('button[data-del-member]');
  if (delBtn) {
    removeMember(delBtn.dataset.delMember);
    return;
  }

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
attHead.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-event]');
  if (!sel || !sel.value) return;

  const eventId = sel.dataset.bulkEvent;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all visible members as ${label} for this event?`)) {
    sel.value = '';
    return;
  }

  await bulkSetAttendanceForEvent(eventId, value);
  sel.value = '';
});
attBody.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-member]');
  if (!sel || !sel.value) return;

  const memberId = sel.dataset.bulkMember;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all visible events as ${label} for this member?`)) {
    sel.value = '';
    return;
  }

  await bulkSetAttendanceForMember(memberId, value);
  sel.value = '';
});
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

  const net = inc - exp;
  if (treBadge) {
    treBadge.textContent = `${data.length} records · Net ₹ ${net.toLocaleString()}`;
  }

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

if (treAddBtn) treAddBtn.onclick = () => {
  openModal("addTransModal");
};

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

const TREASURY_GAS_URL = "https://script.google.com/macros/s/AKfycbxhSGPm2HFUxUhZVLS16zKPiTV4Dnmxtz0CWC_OvH9KJobLYQSrSiAr3BcSIWS3-4Qtcg/exec";

function readAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); 
    reader.readAsDataURL(file);
  });
}

async function uploadBillToDrive(file) {
  if (!file) return null;
  
  const base64 = await readAsBase64(file);
  
  const payload = JSON.stringify({
    action: "uploadBill",
    fileName: file.name,
    fileData: base64
  });
  
  try {
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
    throw new Error("Bill upload failed. (Check: Is the script deployed as 'Anyone'?)");
  }
}
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
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-edit-tre]");
  if (!btn) return;

  const id = btn.dataset.editTre;
  const t = TREAS.find(x => x.id === id);
  if (!t) return;

  document.getElementById("editTransId").value = id;
  
  document.getElementById("editTransName").value = t.name || "";
  document.getElementById("editTransType").value = t.type || "income";
  document.getElementById("editTransAmount").value = t.amount || 0;
  document.getElementById("editTransAvenue").value = t.avenue || "";
  document.getElementById("editTransDate").value = (t.date || "").slice(0,10);
  
  editTransPaidBy.value = t.paidBy || "";
  editTransReimburse.value = t.reimburse || "";
  editTransCheque.value = t.cheque || "";

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

function exportTreasuryToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  const data = getFilteredTreasury(); // <--- Export filtered data

  const header = ['Name', 'Type', 'Amount (₹)', 'Avenue', 'Date', 'Paid By', 'Reimbursement', 'Bank Statement'];
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

[memberSearch, eventSearch, monthFilter, avenueFilter].forEach(el => {
  if (el) el.addEventListener('input', renderGrid);
});

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
    const endDate  = document.getElementById('editEvEndDate').value || '';
    const desc = (document.getElementById('editEvDesc').value || '').trim();
    const avenues = Array.from(document.querySelectorAll('#editEventModal input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    if (!id || !name || !date) return;
    try {
      await db.collection('events').doc(id).update({ name, date, endDate, desc, avenue: avenues });
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
    const endDate   = addEvEndDate?.value || '';
    const desc = (addEvDesc?.value || '').trim();
    const avenues = Array.from(addEventForm.querySelectorAll('fieldset input[type="checkbox"]:checked'))
      .map(c => c.value);
    if (!name || !date) return;
    await db.collection('events').add({ name, date, endDate, desc, avenue: avenues });
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
      if (avenueSel === 'Other') return eventAvenues.length === 0;
      return eventAvenues.includes(avenueSel);
    });
  }
  return { members, events };
}

if (document.getElementById('bodMemCancel'))  document.getElementById('bodMemCancel').onclick  = () => closeModal('editBodMemberModal');
if (document.getElementById('bodMeetCancel')) document.getElementById('bodMeetCancel').onclick = () => closeModal('editBodMeetingModal');
if (document.getElementById('memCancel')) document.getElementById('memCancel').onclick = () => closeModal('editMemberModal');
if (document.getElementById('evCancel'))  document.getElementById('evCancel').onclick  = () => closeModal('editEventModal');

if (treFilterType) treFilterType.addEventListener('change', renderTreasurer);
if (treFilterMonth) treFilterMonth.addEventListener('change', renderTreasurer);
if (treFilterAvenue) treFilterAvenue.addEventListener('change', renderTreasurer);
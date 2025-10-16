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

let MEMBERS = [];
let EVENTS  = [];
let ATT     = {}; // {memberId: {eventId: boolean}}
let unsubMembers = null;
let unsubEvents  = null;
let unsubAtt     = null; 


/* ---------- Auth guard + role check ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }

  try {
    const snap = await db.collection('roles').doc(user.uid).get();
    const role = snap.exists ? String(snap.data().role).toLowerCase() : null;

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


signOutBtn.addEventListener('click', async () => {
  await auth.signOut();
  location.href = 'login.html';
});

/* ---------- Data load ---------- */
async function loadData(){
  const [mSnap, eSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get()
  ]);

  MEMBERS = mSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  EVENTS  = eSnap.docs.map(d => ({ id:d.id, ...d.data() }));


buildMonthFilterFromEvents();

  // attendance (1 doc per member)
  const attSnap = await db.collection('attendance').get();
  ATT = {};
  attSnap.forEach(d => { ATT[d.id] = d.data() || {}; });

  renderGrid();
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

    const total   = events.length;
    const present = events.filter(e => !!attForMember[e.id]).length;
    const pct     = total ? Math.round((present/total)*100) : 0;

    // GBM-specific percentage
    const gbmIds = events.filter(e => {
      const a = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      return a.includes('GBM');
    }).map(e => e.id);
    const gbmTotal   = gbmIds.length;
    const gbmPresent = gbmIds.filter(id => !!attForMember[id]).length;
    const gbmPct     = gbmTotal ? Math.round((gbmPresent/gbmTotal)*100) : 0;

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
            <button class="icon-btn" title="Delete member" data-del-member="${m.id}">🗑</button>
          </div>
        </div>
      </td>
      ` +
      events.map(e => {
        const on = !!attForMember[e.id];
        return `
          <td data-m="${m.id}" data-e="${e.id}">
            <button class="cell-btn ${on ? 'on' : 'off'}" aria-label="${on?'Present':'Absent'}"></button>
          </td>`;
      }).join('');

    attBody.appendChild(tr);
  });

  countBadge.textContent = `${members.length} members · ${events.length} events`;
}

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

  const isOn = btn.classList.toggle('on');
  btn.classList.toggle('off', !isOn);
  btn.setAttribute('aria-label', isOn ? 'Present' : 'Absent');

  const ref = db.collection('attendance').doc(memberId);
  await ref.set({ [eventId]: isOn }, { merge: true });
  ATT[memberId] = ATT[memberId] || {};
  ATT[memberId][eventId] = isOn;
});

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


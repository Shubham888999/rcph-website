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



async function start(){
await Promise.all([loadAttendance(), loadBOD(), loadFinesOnce(), loadTreasuryOnce()]);
attachListeners();
attachFinesListener();
attachTreasuryListener();
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

  // header
  const h = document.createElement('tr');
  h.innerHTML = `<th class="sticky-col">Member \\ Event</th>` + events.map(e => `
    <th title="${e.date||''}">
      <div class="ev-head">
        <strong>${(e.name||'')}</strong>
        <small>${(e.date||'').slice(0,10)}</small>
      </div>
    </th>`).join('');
  attHead.innerHTML = ''; attHead.appendChild(h);

  // body
  attBody.innerHTML = '';
  let totalSlots = 0, totalPresent = 0;
  const topCounts = [];
  members.forEach(m => {
    const att = ATT[m.id] || {};
    const tr = document.createElement('tr');
    const values = events.map(e => att[e.id]);
    const considered = values.filter(v => v !== 'NA');
    const total = considered.length;
    const present = considered.filter(v => v === true).length;
    totalSlots += total; totalPresent += present;
    topCounts.push({name:m.name||'', c:present});

    tr.innerHTML = `
      <td class="sticky-col">
        <div class="stat-box">
          <span>All: ${present}/${total} · ${total?Math.round(present/total*100):0}%</span>
        </div>
        <div>${(m.name||'').replace(/</g,'&lt;')}</div>
      </td>` + events.map(e=>{
        const v = att[e.id]; // true | false | 'NA' | undefined
let cell = '';
if (v === true)  cell = `<img class="att-icon" src="check.png" alt="Present">`;
else if (v === false) cell = `<img class="att-icon" src="cross.png" alt="Absent">`;
else if (v === 'NA')  cell = `<img class="att-icon" src="Na_Button.png" alt="Not applicable">`;
return `<td>${cell}</td>`;
      }).join('');
    attBody.appendChild(tr);
  });

  evtCount.textContent = events.length;
  avgSpan.textContent  = totalSlots ? `${Math.round(totalPresent/totalSlots*100)}%` : '—';
  const top = topCounts.sort((a,b)=>b.c-a.c).slice(0,3).map(x=>`${x.name.split(' ')[0]}(${x.c})`).join(', ');
  topSpan.textContent = top || '—';
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

  // header
  const h = document.createElement('tr');
  h.innerHTML = `<th class="sticky-col">BOD \\ Meeting<br><small>Position</small></th>` + meetings.map(t => `
    <th title="${t.date||''}">
      <div class="ev-head">
        <strong>${(t.name||'')}</strong>
        <small>${(t.date||'').slice(0,10)}</small>
      </div>
    </th>`).join('');
  bodHead.innerHTML = ''; bodHead.appendChild(h);

  // body
  bodBody.innerHTML = '';
  let totalSlots=0, totalPresent=0;
  const top = [];
  members.forEach(m=>{
    const att = BODATT[m.id] || {};
    const values = meetings.map(t => att[t.id]);
    const total  = values.length;
    const present= values.filter(v => v===true).length; // NA rare here; if you use NA, filter similarly
    totalSlots+= total; totalPresent+= present; top.push({name:m.name||'', c:present});

    const row = `
      <td class="sticky-col">
        <div class="stat-box">
          <span>All: ${present}/${total} · ${total?Math.round(present/total*100):0}%</span>
        </div>
        <div>${(m.name||'').replace(/</g,'&lt;')}<br><small>${(m.position||'')}</small></div>
      </td>` + meetings.map(t=>{
        const v = att[t.id];
let cell = '';
if (v === true)  cell = `<img class="att-icon" src="check.png" alt="Present">`;
else if (v === false) cell = `<img class="att-icon" src="cross.png" alt="Absent">`;
else if (v === 'NA')  cell = `<img class="att-icon" src="Na_Button.png" alt="Not applicable">`;
return `<td>${cell}</td>`;

      }).join('');
    const tr = document.createElement('tr');
    tr.innerHTML = row;
    bodBody.appendChild(tr);
  });

  meetCount.textContent = meetings.length;
  bodAvg.textContent    = totalSlots ? `${Math.round(totalPresent/totalSlots*100)}%` : '—';
  const best = top.sort((a,b)=>b.c-a.c).slice(0,3).map(x=>`${x.name.split(' ')[0]}(${x.c})`).join(', ');
  bodTop.textContent = best || '—';
}
// ▼▼▼ Dynamic arrow toggle for details panels ▼▼▼
// ▼▼▼ Dynamic arrow toggle for details panels ▼▼▼
document.querySelectorAll('details').forEach(det => {
  const summary = det.querySelector('summary');
  if (!summary) return;

  // Add a span arrow at the end of the summary
  const arrow = document.createElement('span');
  arrow.textContent = '▼';
  arrow.style.float = 'right';
  arrow.style.transition = 'transform 0.2s';
  summary.appendChild(arrow);

  // Listen to toggle event to update arrow direction
  det.addEventListener('toggle', () => {
    arrow.textContent = det.open ? '▲' : '▼';

    // NEW: Scroll-to-panel logic
    // Only apply to panels inside our new grid
    if (det.open && det.closest('.panel-grid')) {
      // Use a short timeout to let the DOM reflow after the grid-column changes
      setTimeout(() => {
        det.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50); // 50ms delay
    }
  });
});

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
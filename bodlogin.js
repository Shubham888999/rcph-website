// bodlogin.js — upload-free (stores Drive folder/link only)

// Using compat SDK loaded in the HTML:
const auth = firebase.auth();
const db   = firebase.firestore();

const whoami      = document.getElementById('whoami');
const signOutBtn  = document.getElementById('signOutBtn');

const form        = document.getElementById('bodEventForm');
const evName      = document.getElementById('evName');
const evDesc      = document.getElementById('evDesc');
const evAvenue    = document.getElementById('evAvenue');
const driveInput  = document.getElementById('driveFolder');

const itemsEl      = document.getElementById('items');
const filterAvenue = document.getElementById('filterAvenue');
const countPill    = document.getElementById('countPill');
const statusEl     = document.getElementById('status');

const drivePrev   = document.getElementById('drivePreview');
const driveIdOut  = document.getElementById('driveIdOut');
const driveOpenOut= document.getElementById('driveOpenOut');
const filterMonth = document.getElementById('filterMonth');

const filterMine   = document.getElementById('filterMine');
const filterSearch = document.getElementById('filterSearch');
const toastEl      = document.getElementById('toast');
function toast(msg, ms=1800){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), ms);
}

const exportSubsBtn = document.getElementById('exportSubsBtn');
if (exportSubsBtn) {
  // Keep disabled until XLSX is present
  exportSubsBtn.disabled = !window.XLSX;

  // When the page finishes loading, re-check and enable if ready
  window.addEventListener('load', () => {
    if (window.XLSX) exportSubsBtn.disabled = false;
  });

  // Final safety: try to enable once more after a short delay
  setTimeout(() => { if (window.XLSX) exportSubsBtn.disabled = false; }, 600);

  exportSubsBtn.addEventListener('click', exportSubsToExcel);
}

let FILTERED_SUBS = [];

if (filterAvenue) filterAvenue.addEventListener('change', loadItems);
if (filterMonth)  filterMonth.addEventListener('change', loadItems);
if (filterMine)   filterMine.addEventListener('change', loadItems);
if (filterSearch) filterSearch.addEventListener('input', () => {
  // small debounce
  clearTimeout(window.__bodSearchT);
  window.__bodSearchT = setTimeout(loadItems, 150);
});


/* ---------- Auth guard ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = 'login.html'; return; }

  try {
    const r = await db.collection('roles').doc(user.uid).get();
    const role = r.exists ? String(r.data().role || '').toLowerCase() : '';
if (role !== 'bod' && role !== 'admin') {   // only kick out if neither
  location.href = 'login.html';
  return;
}
    if (whoami) whoami.textContent = `Signed in as ${user.email || 'BOD'}`;
  } catch {
    if (whoami) whoami.textContent = 'Signed in';
  }

  loadItems();
});

if (signOutBtn) {
  signOutBtn.onclick = async () => {
    await auth.signOut();
    location.href = 'login.html';
  };
}

if (driveInput) {
  const updateDrivePreview = () => {
    const v = (driveInput.value || '').trim();
    const m = v.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) {
      const id = m[1];
      if (driveIdOut)  driveIdOut.textContent = id;
      if (driveOpenOut) driveOpenOut.href = `https://drive.google.com/drive/folders/${id}`;
      if (drivePrev) drivePrev.hidden = false;
    } else {
      if (drivePrev) drivePrev.hidden = true;
    }
  };
  driveInput.addEventListener('input', updateDrivePreview);
  driveInput.addEventListener('change', updateDrivePreview);
}


/* ---------- Submit (no uploads) ---------- */
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) { alert('Not signed in.'); return; }

    const name        = evName.value.trim();
    const description = evDesc.value.trim();
    const avenue      = evAvenue.value;
    const driveFolder = (driveInput?.value || '').trim();   // may be blank
    const conductedBy = (document.getElementById('conductedBy')?.value || '').trim();
    const eventDate   = (document.getElementById('eventDate')?.value || '').trim(); // YYYY-MM-DD
    const eventTime   = (document.getElementById('eventTime')?.value || '').trim(); // HH:MM or ""

    if (!name || !description || !avenue || !eventDate || !conductedBy) {
      if (statusEl) statusEl.textContent = 'Please fill all required fields.';
      return;
    }

    // If a full Drive URL was pasted, keep both url and id
    let driveFolderId = '';
    const m = driveFolder.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) driveFolderId = m[1];

const doc = {
  name,
  description,
  avenue,
  conductedBy,           // NEW
  eventDate,             // NEW (YYYY-MM-DD)
  eventTime,             // NEW (HH:MM, optional)
  driveFolder,
  driveFolderId,
  createdBy: user.uid,
  createdByEmail: user.email || '',
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
};
try {
  // prevent double submit
  const submitBtn = form.querySelector('button[type=submit]');
  submitBtn?.setAttribute('disabled','disabled');

  await db.collection('bodEvents').add(doc);

  localStorage.removeItem(DRAFT_KEY);
  form.reset();
  toast('Saved!');
  loadItems();
} catch (err) {
  console.error(err);
  if (statusEl) statusEl.textContent = 'Save failed: ' + err.message;
  toast('Save failed', 2000);
} finally {
  form.querySelector('button[type=submit]')?.removeAttribute('disabled');
}

  });
}


if (exportSubsBtn) {
  exportSubsBtn.addEventListener('click', exportSubsToExcel);
}

// Render the BOD submissions list
async function loadItems() {
  const itemsEl   = document.getElementById('items');
  const countPill = document.getElementById('countPill');
  const user      = auth.currentUser;

  // skeletons
  itemsEl.innerHTML = '';
  for (let i=0;i<3;i++){
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    itemsEl.appendChild(sk);
  }

  // Fetch newest first
  const snap = await db.collection('bodEvents').orderBy('createdAt', 'desc').get();
  const all = snap.docs.map(d => ({
    id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || null
  }));

  buildMonthFilter(all);

  // filters
  let rows = all;
  const av = (filterAvenue?.value || '');
  const ym = (filterMonth?.value   || '');
  const mine = !!(filterMine?.checked);
  const q   = (filterSearch?.value || '').trim().toLowerCase();

  if (av) rows = rows.filter(x => (x.avenue || '') === av);
  if (ym) rows = rows.filter(x => (x.eventDate || '').startsWith(ym));
  if (mine && user) rows = rows.filter(x => (x.createdBy || '') === user.uid);
  if (q) {
    rows = rows.filter(x => (x.name||'').toLowerCase().includes(q) || (x.description||'').toLowerCase().includes(q));
  }

  FILTERED_SUBS = rows.slice();

  // render
  itemsEl.innerHTML = '';
  if (!rows.length){
    itemsEl.innerHTML = `<div class="item" style="text-align:center; opacity:.8">No submissions found.</div>`;
  }

  rows.forEach(r => {
    const createdStr = r.createdAt ? r.createdAt.toLocaleString() : '';
    const driveLink = r.driveFolderId
      ? `https://drive.google.com/drive/folders/${r.driveFolderId}`
      : (r.driveFolder || '');
    const driveHtml = driveLink ? `<div class="drive-preview" style="margin-top:6px">
      <a class="pill" href="${driveLink}" target="_blank" rel="noopener">Open Drive folder</a>
    </div>` : '';

    const niceEventDate = r.eventDate ? new Date(`${r.eventDate}T00:00:00`).toLocaleDateString() : '';
    const niceEventTime = r.eventTime ? ` • ${r.eventTime}` : '';
    const byLine        = r.conductedBy ? ` • by ${escapeHtml(r.conductedBy)}` : '';
    const metaLine = (niceEventDate || r.eventTime || r.conductedBy)
      ? `<div style="opacity:.85;margin:4px 0">${niceEventDate}${niceEventTime}${byLine}</div>`
      : '';

    const canDelete = (user && (user.uid === r.createdBy)) || false; // admin can also delete per rules; leave client-side conservative

    const card = document.createElement('div');
    card.className = 'item';
    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; justify-content:space-between">
        <div class="pill">${escapeHtml(r.avenue || '')}</div>
        <div style="display:flex; gap:8px; align-items:center">
          <span class="badge" title="Created">${createdStr || ''}</span>
          ${canDelete ? `<button class="btn btn-outline" data-del="${r.id}"><i class="fa-regular fa-trash-can"></i></button>` : ''}
        </div>
      </div>
      <h4 style="margin:6px 0 4px">${escapeHtml(r.name || '')}</h4>
      ${metaLine}
      <div style="opacity:.9">${escapeHtml(r.description || '')}</div>
      ${driveHtml}
    `;
    itemsEl.appendChild(card);
  });

  if (countPill) countPill.textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;
  updateBodKpis(rows);  
}


// Simple HTML escaper (keep this if you don't already have one)
function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}


function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function buildMonthFilter(items){
  if (!filterMonth) return;
  const months = new Set();

function updateBodKpis(rows = []) {
  // Totals
  const total = rows.length;

  // This month (YYYY-MM)
  const ymNow = new Date().toISOString().slice(0, 7);
  const thisMonth = rows.filter(r => (r.eventDate || '').startsWith(ymNow)).length;

  // Per-avenue counts
  const ORDER = ['ISD','CMD','CSD','PDD','RRRO','PRO','DEI','GBM'];
  const aveCounts = Object.fromEntries(ORDER.map(a => [a, 0]));
  rows.forEach(r => {
    const a = (r.avenue || '').toUpperCase();
    if (aveCounts[a] !== undefined) aveCounts[a]++;
  });

  // Top conductors
  const who = {};
  rows.forEach(r => {
    const c = (r.conductedBy || '').trim();
    if (c) who[c] = (who[c] || 0) + 1;
  });
  const top = Object.entries(who)
    .sort((a,b) => b[1] - a[1])
    .slice(0,3)
    .map(([name, n]) => `${name} (${n})`)
    .join(', ') || '—';

  // Paint
  const elTotal = document.getElementById('kpiTotal');
  const elMonth = document.getElementById('kpiThisMonth');
  const elTop   = document.getElementById('kpiTopConductors');
  const elAve   = document.getElementById('kpiAvenues');

  if (elTotal) elTotal.textContent = String(total);
  if (elMonth) elMonth.textContent = String(thisMonth);
  if (elTop)   elTop.textContent   = top;

  if (elAve) {
    elAve.innerHTML = ORDER.map(a => {
      return `<span class="pill" style="background:#132224;border-color:#24494d;color:#d7f3f5">
        ${a} <strong style="margin-left:4px">${aveCounts[a]}</strong>
      </span>`;
    }).join('');
  }
}


  items.forEach(e => {
    const dStr = e.eventDate || '';
    if (dStr && dStr.length >= 7) months.add(dStr.slice(0,7)); // YYYY-MM
  });

  const sorted = Array.from(months).sort().reverse();
  const current = filterMonth.value;
  filterMonth.innerHTML = `<option value="">All</option>` +
    sorted.map(ym => {
      const [y,m] = ym.split('-').map(Number);
      const label = new Date(y, m-1).toLocaleString(undefined, { month:'long', year:'numeric' });
      return `<option value="${ym}">${label}</option>`;
    }).join('');

  if (current && sorted.includes(current)) filterMonth.value = current;
}

function exportSubsToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  // Choose the dataset: use the filtered view; fallback to all if empty.
  const data = (FILTERED_SUBS && FILTERED_SUBS.length) ? FILTERED_SUBS : [];

  // Header
  const header = [
    'Event Name',
    'Avenue',
    'Conducted By',
    'Event Date',
    'Event Time',
    'Created At',
    'Description',
    'Drive Folder Link',
    'Drive Folder ID',
    'Created By (email)'
  ];

  // Rows
  const rows = data.map(r => {
    const createdStr = r.createdAt ? new Date(r.createdAt).toLocaleString() : '';
    const driveLink = r.driveFolderId
      ? `https://drive.google.com/drive/folders/${r.driveFolderId}`
      : (r.driveFolder || '');

    return [
      r.name || '',
      r.avenue || '',
      r.conductedBy || '',
      r.eventDate || '',
      r.eventTime || '',
      createdStr,
      r.description || '',
      driveLink,
      r.driveFolderId || '',
      r.createdByEmail || ''
    ];
  });

  const aoa = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Friendly column widths + freeze header row
  ws['!cols'] = [
    {wch:28},{wch:8},{wch:20},{wch:12},{wch:8},{wch:18},{wch:40},{wch:36},{wch:20},{wch:24}
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOD Submissions');

  // Name file with active filters if any
  const av = (filterAvenue?.value || 'all');
  const ym = (filterMonth?.value || 'all'); // YYYY-MM
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `bod_submissions_${av}_${ym}_${stamp}.xlsx`);
}

document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button[data-del]');
  if(!btn) return;
  const id = btn.getAttribute('data-del');
  if (!confirm('Delete this submission?')) return;
  try{
    await db.collection('bodEvents').doc(id).delete();
    toast('Deleted');
    loadItems();
  }catch(err){
    toast('Delete failed'); console.error(err);
  }
});

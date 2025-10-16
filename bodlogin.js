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


/* ---------- Auth guard ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = 'login.html'; return; }

  try {
    const r = await db.collection('roles').doc(user.uid).get();
    if (!r.exists || String(r.data().role || '').toLowerCase() !== 'bod') {
      location.href = 'admin.html';
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
      await db.collection('bodEvents').add(doc);
      if (statusEl) statusEl.textContent = 'Saved!';
      form.reset();
      loadItems();
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = 'Save failed: ' + err.message;
    }
  });
}

if (exportSubsBtn) {
  exportSubsBtn.addEventListener('click', exportSubsToExcel);
}

// Render the BOD submissions list
async function loadItems() {
  // DOM (local refs are fine)
  const itemsEl   = document.getElementById('items');
  const countPill = document.getElementById('countPill');

  // Fetch newest first
  const snap = await db.collection('bodEvents').orderBy('createdAt', 'desc').get();
  const all = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() || null
  }));

  // Build the month dropdown from data
  buildMonthFilter(all);

  // Client-side avenue filter (no composite index needed)
  const av = (filterAvenue?.value || '');
  const ym = (filterMonth?.value || '');

  // Apply filters
  let rows = all;
  if (av) rows = rows.filter(x => (x.avenue || '') === av);
  if (ym) rows = rows.filter(x => (x.eventDate || '').startsWith(ym));

  // ✅ keep a copy of what's currently shown (for Excel export)
  FILTERED_SUBS = rows.slice();

  // Render
  itemsEl.innerHTML = '';
  rows.forEach(r => {
    const createdStr = r.createdAt ? r.createdAt.toLocaleString() : '';

    const driveLink = r.driveFolderId
      ? `https://drive.google.com/drive/folders/${r.driveFolderId}`
      : (r.driveFolder || '');
    const driveHtml = driveLink
      ? `<div style="margin-top:6px"><a href="${driveLink}" target="_blank" rel="noopener">Open Drive folder</a></div>`
      : '';

    const niceEventDate = r.eventDate ? new Date(`${r.eventDate}T00:00:00`).toLocaleDateString() : '';
    const niceEventTime = r.eventTime ? ` • ${r.eventTime}` : '';
    const byLine        = r.conductedBy ? ` • by ${escapeHtml(r.conductedBy)}` : '';
    const metaLine = (niceEventDate || r.eventTime || r.conductedBy)
      ? `<div style="opacity:.85;margin:4px 0">${niceEventDate}${niceEventTime}${byLine}</div>`
      : '';

    const card = document.createElement('div');
    card.className = 'item';
    card.innerHTML = `
      <div class="pill" style="margin-bottom:6px">${escapeHtml(r.avenue || '')}</div>
      <h4>${escapeHtml(r.name || '')}</h4>
      <div style="opacity:.8; font-size:.9rem; margin-bottom:6px">${createdStr}</div>
      ${metaLine}
      <div>${escapeHtml(r.description || '')}</div>
      ${driveHtml}
    `;
    itemsEl.appendChild(card);
  });

  if (countPill) countPill.textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;
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

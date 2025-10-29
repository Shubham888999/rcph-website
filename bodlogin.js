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

let IS_PRESIDENT = false;

// Lock UI helpers
const lockBodEventsBtn   = document.getElementById('lockBodEventsBtn');
const lockBodEventsState = document.getElementById('lockBodEventsState');

function watchLock(panelKey, btnEl, badgeEl, onLockedChange) {
  return db.collection('locks').doc(panelKey).onSnapshot(snap => {
    const locked = snap.exists && !!snap.data().locked;
    if (badgeEl) badgeEl.textContent = locked ? 'Locked' : 'Unlocked';
    if (btnEl) {
      btnEl.disabled   = !IS_PRESIDENT;
      btnEl.textContent = locked ? '🔓' : '🔒';
      btnEl.setAttribute('aria-label', locked ? 'Unlock' : 'Lock');
      btnEl.title = locked ? 'Unlock' : 'Lock';
    }
    onLockedChange?.(locked);
  });
}

async function toggleLock(panelKey) {
  if (!IS_PRESIDENT) return;
  const ref = db.collection('locks').doc(panelKey);
  const snap = await ref.get();
  const cur = snap.exists && !!snap.data().locked;

  // optimistic UI
  lockBodEventsState.textContent = cur ? 'Unlocked' : 'Locked';
  lockBodEventsBtn.textContent   = cur ? '🔒' : '🔓';

  await ref.set({ locked: !cur }, { merge: true });
}
if (lockBodEventsBtn) lockBodEventsBtn.onclick = () => toggleLock('bodEvents');


const goAdminBtn = document.getElementById('goAdminBtn');
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

    // set role flags safely here
    IS_PRESIDENT = (role === 'president');

    // show/hide “Admin Panel” button
    if (role === 'admin' || role === 'president') {
      if (goAdminBtn) {
        goAdminBtn.style.display = 'inline-block';
        goAdminBtn.onclick = () => { location.href = 'admin.html'; };
      }
    } else {
      if (goAdminBtn) goAdminBtn.style.display = 'none';
    }

    // kick non-bod/non-admin users
    if (role !== 'bod' && role !== 'admin' && role !== 'president') {
      location.href = 'login.html';
      return;
    }

    // start the lock watcher *after* we know IS_PRESIDENT
    watchLock('bodEvents', lockBodEventsBtn, lockBodEventsState, (locked) => {
      document
        .querySelectorAll('#bodEventForm input, #bodEventForm select, #bodEventForm textarea, #bodEventForm button[type=submit]')
        .forEach(el => el.disabled = locked);
    });

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
    const avenues = Array.from(evAvenue.selectedOptions).map(o => o.value);
    const driveFolder = (driveInput?.value || '').trim();   // may be blank
    const conductedBy = (document.getElementById('conductedBy')?.value || '').trim();
const eventStart  = (document.getElementById('eventStart')?.value || '').trim();
const eventEnd    = (document.getElementById('eventEnd')?.value || '').trim();
const eventTime   = (document.getElementById('eventTime')?.value || '').trim();

if (!name || !description || !avenues.length || !eventStart || !eventEnd || !conductedBy)
 {
  if (statusEl) statusEl.textContent = 'Please fill all required fields (pick at least one avenue).';
  return;
}

    // If a full Drive URL was pasted, keep both url and id
    let driveFolderId = '';
    const m = driveFolder.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) driveFolderId = m[1];

const doc = {
  name,
  description,
  avenue: avenues,
  conductedBy,
  eventStart,
  eventEnd,
  eventTime,
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

// ---- HTML escape helper (prevents XSS; keeps plain text plain) ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// Render the BOD submissions list
async function loadItems() {
  const itemsEl   = document.getElementById('items');
  const countPill = document.getElementById('countPill');
  const user      = auth.currentUser;

  // show skeletons
  itemsEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    itemsEl.appendChild(sk);
  }

  try {
    // 1) get newest first
    const snap = await db.collection('bodEvents')
      .orderBy('createdAt', 'desc')
      .get();

    const all = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() || null
    }));

    // 2) rebuild month dropdown from ALL rows
    buildMonthFilter(all);

    // 3) apply filters to get visible rows
    const avFilter = (filterAvenue?.value || '').toUpperCase();
    const ymFilter = (filterMonth?.value || '');        // YYYY-MM or ''
    const mineOnly = !!(filterMine?.checked);
    const q = (filterSearch?.value || '').trim().toLowerCase();

    let rows = all.filter(r => {
if (avFilter) {
  const avs = Array.isArray(r.avenue) ? r.avenue : (r.avenue ? [r.avenue] : []);
  const has = avs.map(x => String(x).toUpperCase()).includes(avFilter);
  if (!has) return false;
}
      if (ymFilter && !(r.eventStart || '').startsWith(ymFilter)) return false;
      if (mineOnly && user && r.createdBy !== user.uid)            return false;

      if (q) {
        const hay = [
          r.name, r.description, r.avenue,
          r.conductedBy, r.createdByEmail
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // 4) save filtered for Excel export; update KPI from filtered rows
    FILTERED_SUBS = rows;
    updateBodKpis(rows);

    // 5) paint list
    itemsEl.innerHTML = rows.map(r => {
      const createdStr = r.createdAt
        ? new Date(r.createdAt).toLocaleString()
        : '';
      const driveUrl = r.driveFolderId
        ? `https://drive.google.com/drive/folders/${r.driveFolderId}`
        : (r.driveFolder || '');
const chips = (Array.isArray(r.avenue) ? r.avenue : (r.avenue ? [r.avenue] : []))
  .map(av => `<span class="pill">${String(av).toUpperCase()}</span>`)
  .join(' ');
      return `
        <div class="card">
<div class="card__header">
  <span class="chipset">${chips}</span>
  <span class="timepill">${createdStr}</span>
  <button class="iconbtn" data-del="${r.id}" title="Delete">🗑️</button>
</div>
          <div class="card__title">${escapeHtml(r.name || '')}</div>
<div class="card__meta">
  ${r.eventStart ? escapeHtml(r.eventStart) : ''}
  ${r.eventEnd ? ' → ' + escapeHtml(r.eventEnd) : ''}
  ${r.eventTime ? ' • ' + escapeHtml(r.eventTime) : ''}
  ${r.conductedBy ? ' • by ' + escapeHtml(r.conductedBy) : ''}
</div>
          <div class="card__body">${escapeHtml(r.description || '')}</div>
          ${driveUrl ? `
            <a class="btn btn-outline" href="${driveUrl}" target="_blank">Open Drive folder</a>
          ` : ''}
        </div>
      `;
    }).join('') || '<p style="opacity:.7">No submissions match your filters.</p>';

    if (countPill) countPill.textContent =
      `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`;
  } catch (err) {
    console.error(err);
    itemsEl.innerHTML =
      `<p style="color:#ff6b6b">Failed to load submissions: ${err.message}</p>`;
    if (countPill) countPill.textContent = '0 items';
  }
}


function exportSubsToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  // Use the currently filtered items (populated in loadItems)
  const data = (FILTERED_SUBS && FILTERED_SUBS.length) ? FILTERED_SUBS : [];

  const header = [
    'Event Name','Avenues','Conducted By','Start Date','End Date','Time',
    'Created','Description','Drive Link','Drive Folder ID','Created By'
  ];

  const rows = data.map(r => {
    const createdStr = r.createdAt ? new Date(r.createdAt).toLocaleString() : '';
    const driveLink  = r.driveFolderId
      ? `https://drive.google.com/drive/folders/${r.driveFolderId}`
      : (r.driveFolder || '');

    const avJoined = Array.isArray(r.avenue) ? r.avenue.join(', ') : (r.avenue || '');

    return [
      r.name || '',
      avJoined,
      r.conductedBy || '',
      r.eventStart || '',
      r.eventEnd || '',
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
  ws['!cols'] = [
    {wch:28},{wch:12},{wch:20},{wch:12},{wch:12},{wch:8},
    {wch:18},{wch:40},{wch:36},{wch:24},{wch:26}
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOD Submissions');

  const av = (filterAvenue?.value || 'all');
  const ym = (filterMonth?.value  || 'all'); // YYYY-MM
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `bod_submissions_${av}_${ym}_${stamp}.xlsx`);
}


// Single, clean delete handler for BOD events
document.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('.iconbtn[data-del]');
  if (!delBtn) return;

  const id = delBtn.getAttribute('data-del');
  if (!id) return;

  // simple confirm (or keep your popup UI if you prefer)
  if (!confirm('Delete this submission? This cannot be undone.')) return;

  try {
    await db.collection('bodEvents').doc(id).delete();
    // nice removal animation if you have .fade-out CSS, otherwise just remove
    delBtn.closest('.card')?.classList.add('fade-out');
    setTimeout(() => delBtn.closest('.card')?.remove(), 200);
    toast('Deleted successfully');
  } catch (err) {
    // Show a helpful message when rules block the delete
    const msg = (err && err.code === 'permission-denied')
      ? 'You can only delete your own events, or you must be an admin.'
      : (err?.message || 'Delete failed');
    toast(msg, 2500);
    console.error(err);
  }
});

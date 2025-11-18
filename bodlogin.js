// bodlogin.js — upload-free (stores Drive folder/link only)
// Helper to convert GDrive links to direct image URLs
// Helper to convert GDrive links to direct image URLs
function getGdriveImageUrl(url) {
  if (!url) return '';
  let fileId = null;
  
  // Regex for /file/d/FILE_ID/
  let match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    fileId = match1[1];
  } else {
    // Regex for /open?id=FILE_ID
    let match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) {
      fileId = match2[1];
    }
  }
  
  // If it's a GDrive link, return the THUMBNAIL format
  if (fileId) {
    // This is far more reliable than /uc as it always returns an image
    return `https://drive.google.com/thumbnail?id=${fileId}`;
  }
  
  // Otherwise, assume it's a direct link (e.g., Imgur, etc.)
  return url;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // This is the base64 string
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// bodlogin.js — upload-free (stores Drive folder/link only)
const auth = firebase.auth();
const db   = firebase.firestore();

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxNq8SrZI08kTb-hh9awLlgWufJeW5ReHD4eePcGxS0z6SyOKNG9YseKeNXAzUv9URD/exec"; // ⚠️ PASTE YOUR URL
const imageUploader = document.getElementById('imageUploader');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');

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
const imageLightbox = document.getElementById('imageLightbox'); // NEW
const lightboxImage = document.getElementById('lightboxImage'); // NEW

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

// --- Image selection UI feedback ---
const fileNamesEl       = document.getElementById('file-upload-names');
const selectedCountPill = document.getElementById('selectedCountPill');
const selectedThumbs    = document.getElementById('selectedThumbs');

let __prevObjectUrls = [];

function clearThumbs() {
  // Revoke old object URLs to avoid leaks
  __prevObjectUrls.forEach(u => URL.revokeObjectURL(u));
  __prevObjectUrls = [];
  if (selectedThumbs) selectedThumbs.innerHTML = '';
}

function renderSelection(files) {
  if (!fileNamesEl || !selectedCountPill || !selectedThumbs) return;

  const n = files.length;
  if (n === 0) {
    fileNamesEl.textContent = 'No files selected';
    selectedCountPill.hidden = true;
    selectedThumbs.hidden = true;
    clearThumbs();
    return;
  }

  // Label text (short + accessible)
  if (n === 1) {
    fileNamesEl.textContent = files[0].name;
  } else {
    fileNamesEl.textContent = `${n} images selected`;
  }

  // Count pill
  selectedCountPill.textContent = `${n} selected`;
  selectedCountPill.hidden = false;

  // Tiny previews
  clearThumbs();
  selectedThumbs.hidden = false;
  Array.from(files).forEach(f => {
    const url = URL.createObjectURL(f);
    __prevObjectUrls.push(url);
    const wrap = document.createElement('div');
    wrap.className = 'thumb';
    const img = document.createElement('img');
    img.src = url;
    img.alt = f.name;
    wrap.appendChild(img);
    selectedThumbs.appendChild(wrap);
  });
}

// Fire when the user picks files
if (imageUploader) {
  imageUploader.addEventListener('change', () => {
    renderSelection(imageUploader.files || []);
  });
}

// Clear indicators on form reset
if (form) {
  form.addEventListener('reset', () => {
    // let the reset visually finish, then clear
    setTimeout(() => renderSelection([]), 0);
  });
}

/* ---------- Auth guard ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = 'login.html'; return; }

  try {
    const r = await db.collection('roles').doc(user.uid).get();
    const role = r.exists ? String(r.data().role || '').toLowerCase() : '';

    // set role flags safely here
    IS_PRESIDENT = (role === 'president');
    // Show DZR button only for president
const goDZRBtn = document.getElementById('goDZRBtn');
if (goDZRBtn) {
    if (IS_PRESIDENT) {
        goDZRBtn.style.display = 'inline-block';
        goDZRBtn.onclick = () => location.href = 'dzrvisit.html';
    } else {
        goDZRBtn.style.display = 'none';
    }
}

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
// --- REPLACE THE OLD 'form.addEventListener' WITH THIS NEW ONE ---

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return toast('You must be logged in.', 2000);

    const submitBtn = form.querySelector('button[type="submit"]');
    const files = imageUploader.files;

    // --- 1. Get all text data from form ---
    const name        = (document.getElementById('evName')?.value || '').trim();
    const description = (document.getElementById('evDesc')?.value || '').trim();
    const avenues     = Array.from(document.getElementById('evAvenue').selectedOptions).map(o => o.value);
    const conductedBy = (document.getElementById('conductedBy')?.value || '').trim();
    const eventStart  = (document.getElementById('eventStart')?.value || '').trim();
    const eventEnd    = (document.getElementById('eventEnd')?.value || '').trim();
    const eventTime   = (document.getElementById('eventTime')?.value || '').trim();

    if (!name || !description || !avenues.length || !eventStart || !eventEnd || !conductedBy) {
      return toast('Please fill all required fields.', 2000);
    }
    
    submitBtn?.setAttribute('disabled', 'disabled');
    loader.setAttribute('aria-hidden', 'false');

    try {
      // --- 2. Step 1: Create the folder in Google Drive ---
      loaderText.textContent = 'Creating event folder...';
      
      const folderResponse = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Use text/plain for GAS
        body: JSON.stringify({
          action: 'createFolder',
          eventName: name
        })
      });
      
      const folderResult = await folderResponse.json();
      if (folderResult.status !== 'success') {
        throw new Error(folderResult.message || 'Failed to create folder.');
      }
      
      const newFolderId = folderResult.data.folderId;
      
      // --- 3. Step 2: Upload files (if any) ---
      let uploadedFileUrls = [];
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          loaderText.textContent = `Uploading image ${i + 1} of ${files.length}...`;
          
          // Read the file as a base64 string
          const fileData = await readFileAsBase64(file);
          
          const fileResponse = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'uploadFile',
              folderId: newFolderId,
              fileName: file.name,
              fileData: fileData // Send the base64 string
            })
          });
          
          const fileResult = await fileResponse.json();
          if (fileResult.status === 'success') {
            uploadedFileUrls.push(fileResult.data.url); // Save the URL
          }
        }
      }

      // --- 4. Step 3: Save the final record to Firebase ---
      loaderText.textContent = 'Saving to database...';
      
      const doc = {
        name,
        description,
        avenue: avenues,
        conductedBy,
        eventStart,
        eventEnd,
        eventTime,
        driveFolderId: newFolderId, // Save the new Folder ID
        previewLink: uploadedFileUrls[0] || '', // Use first image as preview
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        createdByNameSearch: (user.displayName || user.email).toLowerCase().split(/\s+/),
      };

      await db.collection('bodEvents').add(doc);
      
      // --- 5. Done ---
      toast('Event submitted successfully!');
      form.reset();
      
    } catch (err) {
      console.error('Submission failed:', err);
      toast('Error: ' + err.message, 3000);
    } finally {
      // --- 6. Hide loader and re-enable button ---
      submitBtn?.removeAttribute('disabled');
      loader.setAttribute('aria-hidden', 'true');
      loaderText.textContent = 'Working...';
    }
  });
}

// --- END OF REPLACEMENT ---


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
// 5) paint list
    itemsEl.innerHTML = rows.map(r => {
      const createdStr = r.createdAt
        ? new Date(r.createdAt).toLocaleString()
        : '';
      const driveUrl = r.driveFolderId
        ? `https://drive.google.com/drive/folders/${r.driveFolderId}`
        : (r.driveFolder || '');

      // NEW: Get image URL
      const imgUrl = getGdriveImageUrl(r.previewLink);

      const chips = (Array.isArray(r.avenue) ? r.avenue : (r.avenue ? [r.avenue] : []))
        .map(av => `<span class="pill">${String(av).toUpperCase()}</span>`)
        .join(' ');
      
      return `
        <div class="card">
${imgUrl ? `<img src="${imgUrl}" class="card__image" alt="Event Preview" data-lightbox-src="${imgUrl}">` : ''}
          <div class="card__header">
            <span class="chipset">${chips}</span>
            <span class="timepill">${createdStr}</span>
            <button class="iconbtn" data-edit="${r.id}" title="Edit">✏️</button>
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
/* ---------- Edit Modal Logic ---------- */

// Get modal elements
const editModal = document.getElementById('editSubModal');
const editForm = document.getElementById('editSubForm');
const editSubId = document.getElementById('editSubId');
const editEvName = document.getElementById('editEvName');
const editConductedBy = document.getElementById('editConductedBy');
const editEventStart = document.getElementById('editEventStart');
const editEventEnd = document.getElementById('editEventEnd');
const editEventTime = document.getElementById('editEventTime');
const editEvDesc = document.getElementById('editEvDesc');
const editEvAvenue = document.getElementById('editEvAvenue');
const editDriveFolder = document.getElementById('editDriveFolder');
const editPreviewLink = document.getElementById('editPreviewLink');

// Helper to open/close modal
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.setAttribute('aria-hidden', 'false');
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.setAttribute('aria-hidden', 'true');
}

// Universal close handler for all modals
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
  }
});

// Listen for "Edit" button clicks
document.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('button[data-edit]');
  if (!editBtn) return;

  const id = editBtn.dataset.edit;
  // Find the data from the already-loaded list
  const sub = FILTERED_SUBS.find(s => s.id === id);
  if (!sub) {
    toast('Could not find submission data.', 2000);
    return;
  }

  // Populate the modal
  editSubId.value = id;
  editEvName.value = sub.name || '';
  editConductedBy.value = sub.conductedBy || '';
  editEventStart.value = sub.eventStart || '';
  editEventEnd.value = sub.eventEnd || '';
  editEventTime.value = sub.eventTime || '';
  editEvDesc.value = sub.description || '';
  editDriveFolder.value = sub.driveFolder || '';
  editPreviewLink.value = sub.previewLink || ''; // The new field

  // Set selected avenues
  const subAvenues = Array.isArray(sub.avenue) ? sub.avenue : (sub.avenue ? [sub.avenue] : []);
  Array.from(editEvAvenue.options).forEach(opt => {
    opt.selected = subAvenues.includes(opt.value);
  });

  // Open the modal
  openModal('editSubModal');
});

// Handle the "Save Changes" form submit
if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editSubId.value;
    if (!id) {
      toast('No ID found, cannot save.', 2000);
      return;
    }

    const submitBtn = editForm.querySelector('button[type=submit]');
    submitBtn?.setAttribute('disabled', 'disabled');

    try {
      // Collect all data from the edit form
      const avenues = Array.from(editEvAvenue.selectedOptions).map(o => o.value);
      
      const updateData = {
        name: editEvName.value.trim(),
        conductedBy: editConductedBy.value.trim(),
        eventStart: editEventStart.value,
        eventEnd: editEventEnd.value,
        eventTime: editEventTime.value,
        description: editEvDesc.value.trim(),
        driveFolder: editDriveFolder.value.trim(),
        previewLink: editPreviewLink.value.trim(), // The new field
        avenue: avenues
      };

      // Extract Drive ID just like in the main form
      const m = (updateData.driveFolder || '').match(/\/folders\/([a-zA-Z0-9_-]+)/);
      updateData.driveFolderId = m ? m[1] : '';

      // Update the doc in Firestore
      await db.collection('bodEvents').doc(id).update(updateData);

      toast('Changes saved!');
      closeModal('editSubModal');
      loadItems(); // Refresh the list to show changes

    } catch (err) {
      toast('Error saving: ' + err.message, 2500);
      console.error(err);
    } finally {
      submitBtn?.removeAttribute('disabled');
    }
  });
}
/* ---------- Image Lightbox Logic ---------- */

// Open the lightbox
document.addEventListener('click', (e) => {
  // Check if the clicked element is an image with the data-lightbox-src attribute
  const img = e.target.closest('img[data-lightbox-src]');
  if (img && imageLightbox && lightboxImage) {
    const src = img.getAttribute('data-lightbox-src');
    lightboxImage.src = src;
    imageLightbox.setAttribute('aria-hidden', 'false');
  }
});

// Close the lightbox
document.addEventListener('click', (e) => {
  // Close if the close button or the dark overlay is clicked
  if (e.target.closest('[data-close-lightbox]') || e.target === imageLightbox) {
    if (imageLightbox && lightboxImage) {
      imageLightbox.setAttribute('aria-hidden', 'true');
      // Clear src after fade out to avoid flash
      setTimeout(() => {
        lightboxImage.src = '';
      }, 300);
    }
  }
});
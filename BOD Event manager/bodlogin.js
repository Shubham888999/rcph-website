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
const functionsClient = firebase.functions();
const submitBodEventFn = functionsClient.httpsCallable('submitBodEvent');
const syncBodEventFn = functionsClient.httpsCallable('syncBodEventToAttendance');
const updateBodEventFn = functionsClient.httpsCallable('updateBodEvent');
const archiveBodEventFn = functionsClient.httpsCallable('archiveBodEvent');
const createBodUploadTicketFn = functionsClient.httpsCallable('createBodUploadTicket');

const BOD_UPLOAD_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby1iqbZHj2LJFz3FZzE7XkjGMZ1Tqi6Y-rCJmH1ZWs5bXBFRGrb--bkNfFh_D7dS0UfKw/exec';
const BOD_UPLOAD_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const BOD_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const imageUploader = document.getElementById('imageUploader');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');

const signOutBtn  = document.getElementById('signOutBtn');

const form        = document.getElementById('bodEventForm');
const evName      = document.getElementById('evName');
const evDesc      = document.getElementById('evDesc');
const evAvenue    = document.getElementById('evAvenue');
const driveInput  = document.getElementById('driveFolder');
const eventRcphRole = document.getElementById('eventRcphRole');
const eventHostClub = document.getElementById('eventHostClub');
const eventCollaboratorsText = document.getElementById('eventCollaboratorsText');
const eventCollaborationNotes = document.getElementById('eventCollaborationNotes');

const itemsEl      = document.getElementById('items');
const filterAvenue = document.getElementById('filterAvenue');
const countPill    = document.getElementById('countPill');
const statusEl     = document.getElementById('status');

const drivePrev   = document.getElementById('drivePreview');
const driveIdOut  = document.getElementById('driveIdOut');
const driveOpenOut= document.getElementById('driveOpenOut');
const filterMonth = document.getElementById('filterMonth');
const filterType = document.getElementById('filterType');

const filterMine   = document.getElementById('filterMine');
const filterSearch = document.getElementById('filterSearch');
const toastEl      = document.getElementById('toast');
const imageLightbox = document.getElementById('imageLightbox'); // NEW
const lightboxImage = document.getElementById('lightboxImage'); // NEW
const previewTitle = document.getElementById('previewTitle');
const previewMeta = document.getElementById('previewMeta');
const previewAvenues = document.getElementById('previewAvenues');
const previewDesc = document.getElementById('previewDesc');
const RCPH_CLUB_NAME = 'Rotaract Club of Pune Heritage';

let IS_PRESIDENT = false;
let IS_ADMIN = false;
let CURRENT_ROLE = '';
let BOD_EVENTS_LOCKED = false;
let CURRENT_DISPLAY_NAME = '';

// Lock UI helpers
const lockBodEventsBtn   = document.getElementById('lockBodEventsBtn');

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
lockBodEventsBtn.textContent = cur ? '🔒' : '🔓';

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

function avenueClassName(av) {
  return 'avenue-' + String(av || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function bodEventType(value) {
  const type = String(value || 'clubEvent');
  return ['clubEvent', 'bodMeeting', 'districtEvent'].includes(type) ? type : 'clubEvent';
}

function bodEventTypeLabel(type) {
  return {
    clubEvent: 'Club Event',
    bodMeeting: 'BOD Meeting',
    districtEvent: 'District Event'
  }[bodEventType(type)];
}

function visibilityLabel(value) {
  return String(value || 'public').toLowerCase() === 'internal' ? 'Internal' : 'Public';
}

function normalizeRcphRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ['host', 'cohost', 'collaborator', 'participant'].includes(role) ? role : 'host';
}

function rcphRoleLabel(value) {
  return {
    host: 'Host Club',
    cohost: 'Co-host',
    collaborator: 'Collaborating Club',
    participant: 'Participating Club'
  }[normalizeRcphRole(value)];
}

function parseCollaborators(text) {
  const seen = new Set();
  return String(text || '')
    .split(/\r?\n/)
    .map(name => name.trim().slice(0, 180))
    .filter(Boolean)
    .filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20)
    .map(name => ({ name, type: 'unspecified' }));
}

function normalizeCollaboratorList(collaborators) {
  if (!Array.isArray(collaborators)) return [];
  const seen = new Set();
  return collaborators
    .map(item => {
      const name = String(typeof item === 'string' ? item : item?.name || '').trim().slice(0, 180);
      const type = String(typeof item === 'object' ? item?.type || 'unspecified' : 'unspecified').trim().slice(0, 60) || 'unspecified';
      return { name, type };
    })
    .filter(item => {
      if (!item.name) return false;
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function formatCollaborators(collaborators) {
  return normalizeCollaboratorList(collaborators).map(c => c.name).join(', ');
}

function collaboratorsToText(collaborators) {
  return normalizeCollaboratorList(collaborators).map(c => c.name).join('\n');
}

function currentCollaborationPayload(prefix = '') {
  const roleEl = prefix ? document.getElementById(`${prefix}EventRcphRole`) : eventRcphRole;
  const hostEl = prefix ? document.getElementById(`${prefix}EventHostClub`) : eventHostClub;
  const collabEl = prefix ? document.getElementById(`${prefix}EventCollaboratorsText`) : eventCollaboratorsText;
  const notesEl = prefix ? document.getElementById(`${prefix}EventCollaborationNotes`) : eventCollaborationNotes;
  const rcphRole = normalizeRcphRole(roleEl?.value);
  const hostClub = (hostEl?.value || '').trim() || RCPH_CLUB_NAME;
  return {
    rcphRole,
    hostClub,
    collaborators: parseCollaborators(collabEl?.value || ''),
    collaborationNotes: (notesEl?.value || '').trim().slice(0, 1000)
  };
}

function syncHostClubDefault(roleEl = eventRcphRole, hostEl = eventHostClub) {
  if (!roleEl || !hostEl) return;
  const role = normalizeRcphRole(roleEl.value);
  if ((role === 'host' || role === 'cohost') && !hostEl.value.trim()) {
    hostEl.value = RCPH_CLUB_NAME;
  }
}

function collaborationBlockHtml(eventData) {
  const role = normalizeRcphRole(eventData.rcphRole);
  const hostClub = eventData.hostClub || RCPH_CLUB_NAME;
  const collaborators = normalizeCollaboratorList(eventData.collaborators);
  return `
    <div class="collab-block">
      <div><strong>RCPH Role:</strong> ${escapeHtml(rcphRoleLabel(role))}</div>
      <div><strong>Host:</strong> ${escapeHtml(hostClub)}</div>
      ${collaborators.length ? `
        <div>
          <strong>Collaborators:</strong>
          <span class="collab-partners">
${collaborators
  .map(c => `<span class="collab-name">${escapeHtml(c.name)}</span>`)
  .join('<span class="collab-separator">•</span>')}          </span>
        </div>
      ` : ''}
    </div>
  `;
}

if (eventRcphRole) {
  eventRcphRole.addEventListener('change', () => syncHostClubDefault(eventRcphRole, eventHostClub));
}
syncHostClubDefault(eventRcphRole, eventHostClub);

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
if (filterType)   filterType.addEventListener('change', loadItems);
if (filterMine)   filterMine.addEventListener('change', loadItems);
if (filterSearch) filterSearch.addEventListener('input', () => {
  // small debounce
  clearTimeout(window.__bodSearchT);
  window.__bodSearchT = setTimeout(loadItems, 150);
});

async function readMyAccess(uid) {
  const [roleSnap, userSnap] = await Promise.all([
    db.collection('roles').doc(uid).get().catch(() => null),
    db.collection('users').doc(uid).get().catch(() => null)
  ]);

  const roleData = roleSnap && roleSnap.exists ? roleSnap.data() : null;
  const roleStatus = String(roleData?.status || 'approved').toLowerCase();
  const activeRole = roleData && roleStatus === 'approved'
    ? String(roleData.role || '').toLowerCase()
    : '';
  const userData = userSnap && userSnap.exists ? userSnap.data() : null;

  return {
    role: activeRole,
    status: String(userData?.status || '').toLowerCase(),
    userData
  };
}

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
    fileNamesEl.textContent = `${n} files selected`;
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
    if (f.type && f.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = f.name;
      wrap.appendChild(img);
    } else {
      wrap.textContent = 'PDF';
      wrap.title = f.name;
    }
    selectedThumbs.appendChild(wrap);
  });
}

function validateBodUploadFile(file) {
  if (!file) throw new Error('Choose a file to upload.');
  if (!BOD_UPLOAD_ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`${file.name} is not an allowed upload type. Use PDF, JPG, PNG, or WebP.`);
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error(`${file.name} is empty or could not be read.`);
  }
  if (file.size > BOD_UPLOAD_MAX_BYTES) {
    throw new Error(`${file.name} is larger than the 15 MB limit.`);
  }
}

function validateBodUploadFiles(files) {
  Array.from(files || []).forEach(validateBodUploadFile);
}

function normalizeManualBodDriveFolder(value) {
  const raw = String(value || '').trim();
  if (!raw) return { driveFolder: '', driveFolderId: '' };

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Manual Drive folder must be a valid Google Drive https URL.');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') {
    throw new Error('Manual Drive folder must be a Google Drive https URL.');
  }

  const folderMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const queryId = url.searchParams.get('id');
  const driveFolderId = folderMatch?.[1] || (/^[a-zA-Z0-9_-]+$/.test(queryId || '') ? queryId : '');

  if (!driveFolderId) {
    throw new Error('Manual Drive URL must point to a Google Drive folder.');
  }

  return {
    driveFolder: raw,
    driveFolderId
  };
}

async function uploadBodFileWithTicket(file, { eventName, eventDate, uploadGroupId }) {
  validateBodUploadFile(file);
  const base64 = await readFileAsBase64(file);
  const ticketResult = await createBodUploadTicketFn({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    eventName,
    eventDate,
    ...(uploadGroupId ? { uploadGroupId } : {})
  });
  const approved = ticketResult?.data || {};
  if (!approved.ticket || !approved.uploadGroupId) {
    throw new Error('Upload ticket response was incomplete.');
  }

  const response = await fetch(BOD_UPLOAD_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'uploadBodFile',
      ticket: approved.ticket,
      uploadGroupId: approved.uploadGroupId,
      fileName: approved.fileName,
      mimeType: approved.mimeType,
      sizeBytes: approved.sizeBytes,
      base64
    })
  });

  if (!response.ok) {
    throw new Error(`File upload failed with status ${response.status}.`);
  }

  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.message || 'File upload failed.');
  }
  if (!json.fileUrl) {
    throw new Error('File upload did not return a Drive file URL.');
  }

  return {
    ...json,
    uploadGroupId: json.uploadGroupId || approved.uploadGroupId
  };
}

// Fire when the user picks files
if (imageUploader) {
  imageUploader.accept = 'application/pdf,image/jpeg,image/png,image/webp';
  imageUploader.addEventListener('change', () => {
    const files = imageUploader.files || [];
    try {
      validateBodUploadFiles(files);
      setStatus('');
    } catch (err) {
      toast(err.message || 'Invalid file selected.', 3000);
      setStatus(err.message || 'Invalid file selected.', 'error');
    }
    renderSelection(files);
  });
}

// Clear indicators on form reset
if (form) {
  form.addEventListener('reset', () => {
    // let the reset visually finish, then clear
    setTimeout(() => {
      renderSelection([]);
      const conductedByInput = document.getElementById('conductedBy');
      if (conductedByInput && CURRENT_DISPLAY_NAME) conductedByInput.value = CURRENT_DISPLAY_NAME;
      if (eventRcphRole) eventRcphRole.value = 'host';
      if (eventHostClub) eventHostClub.value = RCPH_CLUB_NAME;
      if (eventCollaboratorsText) eventCollaboratorsText.value = '';
      if (eventCollaborationNotes) eventCollaborationNotes.value = '';
      updateEventPreview();
    }, 0);
  });
}

function getSelectedAvenues(selectEl = evAvenue) {
  return Array.from(selectEl?.selectedOptions || []).map(o => String(o.value || o.textContent || '').trim()).filter(Boolean);
}

function setStatus(message, tone = '') {
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.dataset.tone = tone;
}

function updateEventPreview() {
  const name = (evName?.value || '').trim() || 'Untitled event';
  const conductedBy = (document.getElementById('conductedBy')?.value || '').trim();
  const start = (document.getElementById('eventStart')?.value || '').trim();
  const end = (document.getElementById('eventEnd')?.value || '').trim();
  const time = (document.getElementById('eventTime')?.value || '').trim();
  const desc = (evDesc?.value || '').trim();
  const avenues = getSelectedAvenues();

  if (previewTitle) previewTitle.textContent = name;
  if (previewMeta) {
    const dateText = start ? `${start}${end && end !== start ? ` to ${end}` : ''}` : 'Choose a date';
    const bits = [dateText, time, conductedBy ? `by ${conductedBy}` : 'add conductor'].filter(Boolean);
    previewMeta.textContent = bits.join(' | ');
  }
  if (previewDesc) previewDesc.textContent = desc || 'Add a short note to preview the event summary.';
  if (previewAvenues) {
    previewAvenues.innerHTML = avenues.length
      ? avenues.map(av => `<span class="pill avenue-chip ${avenueClassName(av)}"><span class="avenue-dot" aria-hidden="true"></span>${escapeHtml(av.toUpperCase())}</span>`).join('')
      : '<span class="pill">No avenue selected</span>';
  }
}

if (evDesc) {
  evDesc.required = false;
  evDesc.placeholder = 'Short description for avenue reporting';
}

[evName, evDesc, evAvenue, document.getElementById('conductedBy'), document.getElementById('eventStart'), document.getElementById('eventEnd'), document.getElementById('eventTime')]
  .filter(Boolean)
  .forEach(el => {
    el.addEventListener('input', updateEventPreview);
    el.addEventListener('change', updateEventPreview);
  });
updateEventPreview();

/* ---------- Auth guard ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = '../login.html'; return; }

  try {
    const access = await readMyAccess(user.uid);
    const role = access.role;

    if (!role && access.status === 'pending') {
      location.href = '../login.html?reason=pending';
      return;
    }

    if (!role && access.status === 'rejected') {
      location.href = '../login.html?reason=rejected';
      return;
    }

    if (!role) {
      location.href = '../login.html?reason=no-role';
      return;
    }

    // set role flags safely here
    CURRENT_ROLE = role;
    IS_PRESIDENT = (role === 'president');
    IS_ADMIN = (role === 'admin' || role === 'president');
    // Show DZR button only for president
const goDZRBtn = document.getElementById('goDZRBtn');
if (goDZRBtn) {
    if (IS_PRESIDENT) {
        goDZRBtn.style.display = 'inline-block';
        goDZRBtn.onclick = () => location.href = '../dzrvisit.html';
    } else {
        goDZRBtn.style.display = 'none';
    }
}

    // show/hide “Admin Panel” button
    if (role === 'admin' || role === 'president') {
      if (goAdminBtn) {
        goAdminBtn.style.display = 'inline-block';
        goAdminBtn.onclick = () => { location.href = '../admin.html'; };
      }
    } else {
      if (goAdminBtn) goAdminBtn.style.display = 'none';
    }

    // kick non-bod/non-admin users
    if (role !== 'bod' && role !== 'admin' && role !== 'president') {
      location.href = '../login.html?reason=bod-denied';
      return;
    }

    const signedInName = access.userData?.name || user.displayName || user.email || 'BOD';
    CURRENT_DISPLAY_NAME = signedInName;
    const conductedByInput = document.getElementById('conductedBy');
    if (conductedByInput && !conductedByInput.value) {
      conductedByInput.value = signedInName;
      updateEventPreview();
    }

    // start the lock watcher *after* we know IS_PRESIDENT
watchLock('bodEvents', lockBodEventsBtn, null, (locked) => {      BOD_EVENTS_LOCKED = !!locked;
      const disableForm = locked && !IS_PRESIDENT;
      document
        .querySelectorAll('#bodEventForm input, #bodEventForm select, #bodEventForm textarea, #bodEventForm button')
        .forEach(el => el.disabled = disableForm);
      setStatus(disableForm ? 'BOD event submissions are locked by the president.' : '', disableForm ? 'locked' : '');
    });
  } catch (err) {
    console.warn('BOD access check failed:', err);
    location.href = '../login.html?reason=no-role';
    return;
  }

  try {
    await loadItems();
  } catch (err) {
    console.error('Initial BOD load failed:', err);
  }
});


if (signOutBtn) {
  signOutBtn.onclick = async () => {
    await auth.signOut();
    location.href = '../login.html';
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
    const originalButtonText = submitBtn?.textContent || 'Submit Event';
    const files = imageUploader?.files || [];

    // --- 1. Get all text data from form ---
    const name        = (evName?.value || '').trim();
    const description = (evDesc?.value || '').trim();
    const avenues     = getSelectedAvenues();
    const conductedBy = (document.getElementById('conductedBy')?.value || '').trim();
    const eventStart  = (document.getElementById('eventStart')?.value || '').trim();
    const eventEnd    = (document.getElementById('eventEnd')?.value || '').trim() || eventStart;
    const eventTime   = (document.getElementById('eventTime')?.value || '').trim();

    if (BOD_EVENTS_LOCKED && !IS_PRESIDENT) {
      return toast('BOD event submissions are locked.', 2500);
    }

    if (!name || !avenues.length || !eventStart || !eventEnd || !conductedBy) {
      return toast('Please fill all required fields.', 2000);
    }

    try {
      validateBodUploadFiles(files);
    } catch (err) {
      toast(err.message || 'Invalid file selected.', 3000);
      setStatus(err.message || 'Invalid file selected.', 'error');
      return;
    }

    let manualDriveMetadata = { driveFolder: '', driveFolderId: '' };
    try {
      if (!files.length) {
        manualDriveMetadata = normalizeManualBodDriveFolder(driveInput?.value || '');
      }
    } catch (err) {
      toast(err.message || 'Invalid Drive folder URL.', 3000);
      setStatus(err.message || 'Invalid Drive folder URL.', 'error');
      return;
    }
    
    submitBtn?.setAttribute('disabled', 'disabled');
    if (submitBtn) submitBtn.textContent = 'Submitting...';
    if (loader) loader.setAttribute('aria-hidden', 'false');
    setStatus('Submitting event...');

    try {
      // --- 2. Upload files through one-use backend tickets ---
      const uploadedFileUrls = [];
      let uploadGroupId = '';
      let uploadedFolderId = '';
      let uploadedFolderUrl = '';
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (loaderText) loaderText.textContent = `Uploading files... ${i + 1} of ${files.length}`;
          setStatus(`Uploading files... ${i + 1} of ${files.length}`);

          const uploadResult = await uploadBodFileWithTicket(file, {
            eventName: name,
            eventDate: eventStart,
            uploadGroupId
          });

          uploadGroupId = uploadResult.uploadGroupId || uploadGroupId;
          if (uploadResult.fileUrl) uploadedFileUrls.push(uploadResult.fileUrl);
          uploadedFolderId = uploadResult.folderId || uploadedFolderId;
          uploadedFolderUrl = uploadResult.folderUrl || uploadedFolderUrl;
        }
      }

      // --- 3. Save through Cloud Functions and sync attendance ---
      if (loaderText) loaderText.textContent = 'Syncing attendance...';
      setStatus('Syncing attendance...');

      const result = await submitBodEventFn({
        name,
        desc: description,
        avenue: avenues,
        conductedBy,
        date: eventStart,
        endDate: eventEnd,
        time: eventTime,
        imageLinks: uploadedFileUrls,
        driveLinks: uploadedFileUrls,
        uploadedFileUrls,
        driveFolder: uploadedFolderUrl || uploadedFolderId || manualDriveMetadata.driveFolder,
        driveFolderId: uploadedFolderId || manualDriveMetadata.driveFolderId,
        ...currentCollaborationPayload()
      });
      
      // --- 4. Done ---
      const rowsUpdated = result?.data?.attendanceRowsUpdated || 0;
      toast('Event submitted and added to Attendance Manager.', 2600);
      setStatus(`Event added to Attendance Manager. Attendance initialized for ${rowsUpdated} member rows.`, 'success');
      form.reset();
      renderSelection([]);
      updateEventPreview();
      await loadItems();
      
    } catch (err) {
      console.error('Submission failed:', err);
      const msg = err?.message || 'Submission failed';
      toast('Error: ' + msg, 3500);
      setStatus(msg, 'error');
    } finally {
      // --- 6. Hide loader and re-enable button ---
      submitBtn?.removeAttribute('disabled');
      if (submitBtn) submitBtn.textContent = originalButtonText;
      if (loader) loader.setAttribute('aria-hidden', 'true');
      if (loaderText) loaderText.textContent = 'Working...';
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
    const typeFilter = filterType?.value || '';
    const mineOnly = !!(filterMine?.checked);
    const q = (filterSearch?.value || '').trim().toLowerCase();

    let rows = all.filter(r => {
      const archived = r.archived === true || r.status === 'deleted';
      const type = bodEventType(r.type);
      if (typeFilter === 'archived') {
        if (!archived) return false;
      } else {
        if (archived) return false;
        if (typeFilter && type !== typeFilter) return false;
      }
if (avFilter) {
  const avs = Array.isArray(r.avenue) ? r.avenue : (r.avenue ? [r.avenue] : []);
  const has = avs.map(x => String(x).toUpperCase()).includes(avFilter);
  if (!has) return false;
}
      if (ymFilter && !((r.eventStart || r.date || '').startsWith(ymFilter))) return false;
      if (mineOnly && user && r.createdBy !== user.uid)            return false;

      if (q) {
        const hay = [
          r.name, r.description, r.desc, r.avenue,
          r.conductedBy, r.createdByEmail, r.createdByName, r.source, r.type, r.visibility,
          r.hostClub, formatCollaborators(r.collaborators), r.collaborationNotes
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
      const type = bodEventType(r.type);
      const visibility = visibilityLabel(r.visibility || (type === 'clubEvent' ? 'public' : 'internal'));
      const isSynced = !!r.syncedEventId || !!r.syncedMeetingId || !!r.syncedDistrictEventId || r.status === 'synced' || !!r.bodEventId;
      const syncLabel = isSynced ? 'Synced to Attendance Manager' : 'Not synced';
      const canSync = IS_ADMIN || IS_PRESIDENT;
      const syncedId = r.syncedEventId || r.syncedMeetingId || r.syncedDistrictEventId || r.id;
      const canEditClubEvent = type === 'clubEvent';
const avenueText = (
  Array.isArray(r.avenue)
    ? r.avenue
    : (r.avenue ? [r.avenue] : [])
)
  .map(av => `
    <span class="event-highlight event-highlight--avenue ${avenueClassName(av)}">
      ${escapeHtml(String(av).toUpperCase())}
    </span>
  `)
  .join('<span class="event-highlight-separator">•</span>');
      
      return `
        <div class="card">
${imgUrl ? `<img src="${imgUrl}" class="card__image" alt="Event Preview" data-lightbox-src="${imgUrl}">` : ''}
<div class="card__header">
  <div class="event-card-highlights">
    <span class="event-avenue-list">${avenueText}</span>

    <span class="event-highlight-separator">•</span>

    <span class="event-highlight event-highlight--type">
      ${escapeHtml(bodEventTypeLabel(type))}
    </span>

    <span class="event-highlight-separator">•</span>

    <span class="event-highlight event-highlight--visibility">
      ${escapeHtml(visibility)}
    </span>

    <span class="event-highlight-separator">•</span>

    <span class="event-highlight ${isSynced ? 'event-highlight--synced' : 'event-highlight--unsynced'}">
      ${escapeHtml(syncLabel)}
    </span>
  </div>

  <div class="event-card-tools">
    ${createdStr ? `
      <span class="event-created-time">
        ${escapeHtml(createdStr)}
      </span>
    ` : ''}

    <button class="iconbtn" data-edit="${r.id}" title="Edit" aria-label="Edit event">✏️</button>
    <button class="iconbtn" data-del="${r.id}" title="Archive" aria-label="Archive event">🗑️</button>
  </div>
</div>
          <div class="card__title">${escapeHtml(r.name || '')}</div>
          <div class="card__meta">
            ${r.eventStart ? escapeHtml(r.eventStart) : ''}
            ${r.eventEnd ? ' → ' + escapeHtml(r.eventEnd) : ''}
            ${r.eventTime ? ' • ' + escapeHtml(r.eventTime) : ''}
            ${r.conductedBy ? ' • by ' + escapeHtml(r.conductedBy) : ''}
          </div>
          <div class="card__body">${escapeHtml(r.description || '')}</div>
          ${collaborationBlockHtml(r)}
          <div class="card-actions">
            ${driveUrl ? `<a class="btn btn-outline" href="${driveUrl}" target="_blank">Open Drive folder</a>` : ''}
${syncedId ? `
  <span class="event-id-text">
    <strong>Event ID:</strong> ${escapeHtml(syncedId)}
  </span>
` : ''}            ${canSync && !isSynced ? `<button class="btn btn-outline" data-sync="${r.id}">Sync to Attendance</button>` : ''}
          </div>
        </div>
      `;
    }).join('') || '<p style="opacity:.7">No submissions match your filters.</p>';

    Array.from(itemsEl.querySelectorAll('.card')).forEach((card, i) => {
      const row = rows[i];
      if (row && bodEventType(row.type) !== 'clubEvent') {
        card.querySelectorAll('[data-edit], [data-del]').forEach(btn => btn.remove());
      }
    });

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
    'RCPH Role','Host Club','Collaborators','Collaboration Notes',
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
      rcphRoleLabel(r.rcphRole),
      r.hostClub || RCPH_CLUB_NAME,
      formatCollaborators(r.collaborators),
      r.collaborationNotes || '',
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
    {wch:20},{wch:30},{wch:40},{wch:42},
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


// Single, clean archive handler for BOD events
document.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('.iconbtn[data-del]');
  if (!delBtn) return;

  const id = delBtn.getAttribute('data-del');
  if (!id) return;
  const sub = FILTERED_SUBS.find(s => s.id === id);
  if (sub && bodEventType(sub.type) !== 'clubEvent') {
    toast('This record is managed from the admin attendance panel.', 2500);
    return;
  }

  // Keep attendance values intact by soft-archiving the submission and synced event.
  if (!confirm('Archive this submission? Attendance values will be preserved.')) return;

  try {
    await archiveBodEventFn({ eventId: id });
    delBtn.closest('.card')?.classList.add('fade-out');
    setTimeout(() => loadItems(), 200);
    toast('Submission archived');
  } catch (err) {
    const msg = err?.message || 'Archive failed';
    toast(msg, 2500);
    console.error(err);
  }
});

document.addEventListener('click', async (e) => {
  const syncBtn = e.target.closest('button[data-sync]');
  if (!syncBtn) return;

  const id = syncBtn.getAttribute('data-sync');
  if (!id) return;

  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';
  try {
    const result = await syncBodEventFn({ bodEventId: id });
    const rows = result?.data?.attendanceRowsUpdated || 0;
    toast(`Synced to Attendance Manager (${rows} rows).`, 2600);
    await loadItems();
  } catch (err) {
    const msg = err?.message || 'Sync failed';
    toast(msg, 3000);
    console.error(err);
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync to Attendance';
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
const editEventRcphRole = document.getElementById('editEventRcphRole');
const editEventHostClub = document.getElementById('editEventHostClub');
const editEventCollaboratorsText = document.getElementById('editEventCollaboratorsText');
const editEventCollaborationNotes = document.getElementById('editEventCollaborationNotes');

if (editEventRcphRole) {
  editEventRcphRole.addEventListener('change', () => syncHostClubDefault(editEventRcphRole, editEventHostClub));
}

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
  if (bodEventType(sub.type) !== 'clubEvent') {
    toast('This record is managed from the admin attendance panel.', 2500);
    return;
  }

  // Populate the modal
  editSubId.value = id;
  editEvName.value = sub.name || '';
  editConductedBy.value = sub.conductedBy || '';
  editEventStart.value = sub.eventStart || '';
  editEventEnd.value = sub.eventEnd || '';
  editEventTime.value = sub.eventTime || '';
  editEvDesc.value = sub.description || sub.desc || '';
  editDriveFolder.value = sub.driveFolder || sub.driveFolderId || '';
  editPreviewLink.value = sub.previewLink || (Array.isArray(sub.imageLinks) ? sub.imageLinks[0] : '') || '';
  if (editEventRcphRole) editEventRcphRole.value = normalizeRcphRole(sub.rcphRole);
  if (editEventHostClub) editEventHostClub.value = sub.hostClub || RCPH_CLUB_NAME;
  if (editEventCollaboratorsText) editEventCollaboratorsText.value = collaboratorsToText(sub.collaborators);
  if (editEventCollaborationNotes) editEventCollaborationNotes.value = sub.collaborationNotes || '';

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
        date: editEventStart.value,
        endDate: editEventEnd.value || editEventStart.value,
        time: editEventTime.value,
        desc: editEvDesc.value.trim(),
        driveFolder: editDriveFolder.value.trim(),
        imageLinks: editPreviewLink.value.trim() ? [editPreviewLink.value.trim()] : [],
        avenue: avenues,
        ...currentCollaborationPayload('edit')
      };

      // Extract Drive ID just like in the main form
      const m = (updateData.driveFolder || '').match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (m) updateData.driveFolderId = m[1];

      if (!updateData.name || !updateData.conductedBy || !updateData.date || !updateData.endDate || !avenues.length) {
        throw new Error('Please fill all required fields.');
      }

      await updateBodEventFn({ eventId: id, ...updateData });

      toast('Changes saved and synced.');
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





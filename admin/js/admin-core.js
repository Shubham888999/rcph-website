/**
 * Auth guard, role/lock handling, initial loads, and realtime subscriptions.
 */

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }

  try {
    const [roleSnap, userSnap] = await Promise.all([
      db.collection('roles').doc(user.uid).get(),
      db.collection('users').doc(user.uid).get().catch(() => null)
    ]);

    const roleData = roleSnap.exists ? roleSnap.data() : null;
    const roleStatus = String(roleData?.status || 'approved').toLowerCase();
    const role = roleData && roleStatus === 'approved'
      ? String(roleData.role || '').toLowerCase()
      : null;
    const profile = userSnap && userSnap.exists ? userSnap.data() : null;
    const profileStatus = String(profile?.status || '').toLowerCase();

    if (!role && profileStatus === 'pending') {
      window.location.href = 'login.html?reason=pending';
      return;
    }
    if (!role && profileStatus === 'rejected') {
      window.location.href = 'login.html?reason=rejected';
      return;
    }

    CURRENT_ROLE = role || '';
    IS_PRESIDENT = (role === 'president');
    IS_ADMIN = (role === 'admin' || role === 'president');
    
    const goDZRBtn = document.getElementById('goDZRBtn');
    if (goDZRBtn) {
        if (IS_PRESIDENT) {
            goDZRBtn.style.display = 'inline-block';
            goDZRBtn.onclick = () => location.href = 'dzrvisit.html';
        } else {
            goDZRBtn.style.display = 'none';
        }
    }
    if (role === 'bod') {
      window.location.href = 'BOD%20Event%20manager/bodlogin.html';
      return;
    }
    if (!IS_ADMIN) {
      window.location.href = 'login.html?reason=unauthorized';
      return;
    }
  } catch (e) {
    console.warn('Role check failed:', e);
    window.location.href = 'login.html?reason=no-role';
    return;
  }

  startLockWatchers();
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

let lockWatchersStarted = false;
function startLockWatchers() {
  if (lockWatchersStarted) return;
  lockWatchersStarted = true;

  watchLock('attendance', lockAttendanceBtn, lockAttendanceState, (locked) => {
    document.querySelectorAll('#attBody .cell-btn, #attHead .icon-btn, #addMemberBtn, #addEventBtn, #distBody .cell-btn, #distHead .icon-btn, #addDistEventBtn')
      .forEach(el => el.disabled = locked);
  });
  watchLock('bodAttendance', lockBodAttBtn, lockBodAttState, (locked) => {
    document.querySelectorAll('#bodBody .cell-btn, #bodHead .icon-btn, #bodAddMemberBtn, #bodAddMeetingBtn')
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
}

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
  goBodBtn.addEventListener('click', () => location.href = 'BOD%20Event%20manager/bodlogin.html');
}

function accountFunction(name) {
  return callableFunction(name);
}

function attachUserRequestListener() {
  if (!IS_ADMIN || !accountRequestsPanel || !accountRequestsBody) return;
  accountRequestsPanel.style.display = 'block';

  unsubUsers = db.collection('users').orderBy('createdAt', 'desc').onSnapshot((snap) => {
    USERS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    PENDING_USERS = USERS.filter(u => String(u.status || '').toLowerCase() === 'pending');
    renderAccountRequests();
  }, (err) => {
    console.error('Account request listener failed:', err);
    accountRequestsBody.innerHTML = `<tr><td colspan="6" style="color:#ff9aa6;">${escapeHtml(err.message || 'Could not load account requests.')}</td></tr>`;
  });
}

function accountRoleOptions(selectedRole) {
  const roles = ['gbm', 'bod', 'admin'];
  const selected = String(selectedRole || '').toLowerCase();
  return roles.map(role => (
    `<option value="${role}" ${role === selected ? 'selected' : ''}>${roleLabel(role)}</option>`
  )).join('');
}

function accountPositionSeed(user, role) {
  const existing = String(user.clubPosition || '').trim();
  if (existing) return existing;
  return defaultClubPositionForRole(role);
}

function accountPositionControl(user, role) {
  const seed = accountPositionSeed(user, role);
  const customValue = customPositionValue(seed);
  const showCustom = !!customValue;

  return `
    <label style="display:grid; gap:4px; min-width:180px;">
      <span style="font-size:12px; color:#9aa;">Club position</span>
      <select data-account-position="${escapeHtml(user.id)}" aria-label="Club position for ${escapeHtml(user.name || user.email || 'user')}">
        ${positionSelectOptions(seed)}
      </select>
      <input
        data-account-position-other="${escapeHtml(user.id)}"
        type="text"
        placeholder="Custom position"
        value="${escapeHtml(customValue)}"
        style="${showCustom ? '' : 'display:none;'}"
      />
    </label>
  `;
}

function accountAddToBodControl(user, role) {
  const r = String(role || '').toLowerCase();
  const checked = r === 'bod' || user.addToBodAttendance === true;
  const disabled = r === 'bod';
  return `
    <label style="display:inline-flex; align-items:center; gap:8px; color:#d8e6e6;">
      <input
        type="checkbox"
        data-account-add-bod="${escapeHtml(user.id)}"
        ${checked ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
      />
      <span>Add to BOD Attendance</span>
    </label>
  `;
}

function accountApprovalActions(user, requested) {
  return `
    <div style="display:flex; flex-direction:column; gap:8px; align-items:stretch;">
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
        <label style="display:grid; gap:4px; min-width:120px;">
          <span style="font-size:12px; color:#9aa;">Access role</span>
          <select data-account-role="${escapeHtml(user.id)}" aria-label="Approve role for ${escapeHtml(user.name || user.email || 'user')}">
            ${accountRoleOptions(requested)}
          </select>
        </label>
        ${accountPositionControl(user, requested)}
      </div>
      ${accountAddToBodControl(user, requested)}
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" data-account-approve="${escapeHtml(user.id)}">Approve</button>
        <button class="btn btn-outline" type="button" data-account-reject="${escapeHtml(user.id)}">Reject</button>
      </div>
    </div>
  `;
}

function readAccountPosition(uid) {
  const select = Array.from(document.querySelectorAll('[data-account-position]'))
    .find(el => el.dataset.accountPosition === uid);
  const other = Array.from(document.querySelectorAll('[data-account-position-other]'))
    .find(el => el.dataset.accountPositionOther === uid);

  if (!select) return '';
  if (select.value === 'Other') return (other?.value || '').trim();
  return select.value || '';
}

function readAccountAddToBod(uid, role) {
  if (String(role || '').toLowerCase() === 'bod') return true;
  const checkbox = Array.from(document.querySelectorAll('[data-account-add-bod]'))
    .find(el => el.dataset.accountAddBod === uid);
  return !!checkbox?.checked;
}

function syncAccountRequestControls(uid, role) {
  const select = Array.from(document.querySelectorAll('[data-account-position]'))
    .find(el => el.dataset.accountPosition === uid);
  const other = Array.from(document.querySelectorAll('[data-account-position-other]'))
    .find(el => el.dataset.accountPositionOther === uid);
  const checkbox = Array.from(document.querySelectorAll('[data-account-add-bod]'))
    .find(el => el.dataset.accountAddBod === uid);

  if (select && other) {
    const fallback = defaultClubPositionForRole(role);
    select.value = fallback || '';
    other.value = '';
    other.style.display = select.value === 'Other' ? '' : 'none';
  }

  if (checkbox) {
    if (role === 'bod') {
      checkbox.checked = true;
      checkbox.disabled = true;
    } else {
      checkbox.disabled = false;
      checkbox.checked = false;
    }
  }
}

function renderAccountRequests() {
  if (!accountRequestsBody) return;

  const pendingCount = PENDING_USERS.length;
  if (accountRequestsBadge) {
    accountRequestsBadge.textContent = `${pendingCount} pending`;
  }

  const filter = accountRequestFilter?.value || 'pending';
  const rows = USERS.filter(user => {
    const status = String(user.status || 'pending').toLowerCase();
    return filter === 'all' ? true : status === filter;
  });

  if (!rows.length) {
    accountRequestsBody.innerHTML = '<tr><td colspan="6">No account requests match this filter.</td></tr>';
    return;
  }

  accountRequestsBody.innerHTML = rows.map(user => {
    const status = String(user.status || 'pending').toLowerCase();
    const requested = String(user.requestedRole || 'gbm').toLowerCase();
    const actions = status === 'pending'
      ? accountApprovalActions(user, requested)
      : (status === 'rejected' && user.rejectReason
        ? `<span title="${escapeHtml(user.rejectReason)}">Rejected</span>`
        : '<span style="color:#9aa;">No action</span>');
    const approvedSummary = status === 'pending'
      ? ''
      : `<div style="color:#9aa;">${escapeHtml(user.clubPosition || '-')} ${user.addToBodAttendance ? '- BOD Attendance' : ''}</div>`;

    return `
      <tr>
        <td>${escapeHtml(user.name || '-')}</td>
        <td>${escapeHtml(user.email || '-')}</td>
        <td>${roleLabel(requested)}</td>
        <td>${formatDate(user.createdAt)}</td>
        <td>${statusBadge(status)}</td>
        <td>${actions}${approvedSummary}</td>
      </tr>
    `;
  }).join('');
}

async function approveAccountRequest(uid) {
  const user = USERS.find(u => u.id === uid);
  if (!user) return;
  const select = Array.from(document.querySelectorAll('[data-account-role]'))
    .find(el => el.dataset.accountRole === uid);
  const approvedRole = select?.value || user.requestedRole;
  if (!['gbm', 'bod', 'admin'].includes(String(approvedRole || '').toLowerCase())) {
    alert('Choose GBM, BOD, or Admin.');
    return;
  }
  const clubPosition = readAccountPosition(uid);
  const positionSelect = Array.from(document.querySelectorAll('[data-account-position]'))
    .find(el => el.dataset.accountPosition === uid);
  if (positionSelect?.value === 'Other' && !clubPosition) {
    alert('Enter the custom club position before approving.');
    return;
  }
  if (!clubPosition) {
    alert('Choose or enter a club position before approving.');
    return;
  }
  if (approvedRole === 'bod' && clubPosition.toLowerCase() === 'member') {
    alert('BOD access cannot use Member as the club position.');
    return;
  }
  const addToBodAttendance = readAccountAddToBod(uid, approvedRole);

  try {
    await accountFunction('approveUserRole')({
      targetUid: uid,
      approvedRole,
      clubPosition,
      addToBodAttendance,
    });
  } catch (err) {
    alert(err.message || 'Could not approve account.');
  }
}

async function rejectAccountRequest(uid) {
  const user = USERS.find(u => u.id === uid);
  if (!user) return;
  const reason = prompt(`Reject ${user.name || user.email || 'this user'}? Optional reason:`);
  if (reason === null) return;

  try {
    await accountFunction('rejectUserRoleRequest')({ targetUid: uid, rejectReason: reason.trim() });
  } catch (err) {
    alert(err.message || 'Could not reject account.');
  }
}

document.addEventListener('click', (event) => {
  const approveBtn = event.target.closest('[data-account-approve]');
  if (approveBtn) {
    approveAccountRequest(approveBtn.dataset.accountApprove);
    return;
  }

  const rejectBtn = event.target.closest('[data-account-reject]');
  if (rejectBtn) {
    rejectAccountRequest(rejectBtn.dataset.accountReject);
  }
});

document.addEventListener('change', (event) => {
  const roleSelect = event.target.closest('[data-account-role]');
  if (roleSelect) {
    syncAccountRequestControls(roleSelect.dataset.accountRole, roleSelect.value);
    return;
  }

  const positionSelect = event.target.closest('[data-account-position]');
  if (positionSelect) {
    const other = Array.from(document.querySelectorAll('[data-account-position-other]'))
      .find(el => el.dataset.accountPositionOther === positionSelect.dataset.accountPosition);
    if (other) other.style.display = positionSelect.value === 'Other' ? '' : 'none';
  }
});



async function loadData(){
  const [mSnap, eSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get()
  ]);

  MEMBERS = mSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  EVENTS  = eSnap.docs.map(d => ({ id:d.id, ...d.data() }))
    .filter(e => e.archived !== true && String(e.type || 'clubEvent') === 'clubEvent');
  
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
    BODMEET = mtSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.archived !== true);
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
  if (unsubUsers)   { unsubUsers();   unsubUsers   = null; }

  attachUserRequestListener();

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
  EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.archived !== true && String(e.type || 'clubEvent') === 'clubEvent');
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
      BODMEET = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.archived !== true);
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
      DIST_EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(ev => ev.archived !== true);
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





/**
 * Auth guard, role/lock handling, initial loads, and realtime subscriptions.
 */

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }

  try {
    const accessCallable = callableFunction('getMyAccess');
    const [roleSnap, userSnap, accessResult] = await Promise.all([
      db.collection('roles').doc(user.uid).get(),
      db.collection('users').doc(user.uid).get().catch(() => null),
      accessCallable({})
    ]);

    const roleData = roleSnap.exists ? roleSnap.data() : null;
    const accessData = accessResult?.data || null;

    if (!accessData) {
      throw new Error('Trusted authority context could not be loaded.');
    }
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

    const trustedRoleData = accessData.role || null;
    const trustedRoleStatus = String(
      trustedRoleData?.status || ''
    ).toLowerCase();

    const trustedRole = trustedRoleStatus === 'approved'
      ? String(trustedRoleData?.role || '').toLowerCase()
      : '';

    if (!trustedRole || trustedRole !== role) {
      throw new Error(
        'Role and trusted authority context do not match.'
      );
    }

    CURRENT_ROLE = trustedRole;
    IS_PRESIDENT = trustedRole === 'president';
    HAS_PRESIDENT_AUTHORITY =
      accessData.authority?.hasPresidentAuthority === true;
    IS_ADMIN =
      trustedRole === 'admin' || HAS_PRESIDENT_AUTHORITY;
    
    const goDZRBtn = document.getElementById('goDZRBtn');
    if (goDZRBtn) {
        if (HAS_PRESIDENT_AUTHORITY) {
            goDZRBtn.style.display = 'inline-block';
            goDZRBtn.onclick = () => location.href = 'dzrvisit.html';
        } else {
            goDZRBtn.style.display = 'none';
        }
    }
    if (
      trustedRole === 'bod'
      && !HAS_PRESIDENT_AUTHORITY
    ) {
      window.location.href = 'BOD%20Event%20manager/bodlogin.html';
      return;
    }
    if (!IS_ADMIN) {
      window.location.href = 'login.html?reason=unauthorized';
      return;
    }
    document.querySelectorAll('[data-admin-quick-nav]').forEach(link => {
      link.hidden = false;
    });
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
      btnEl.disabled = !HAS_PRESIDENT_AUTHORITY;
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
  if (!HAS_PRESIDENT_AUTHORITY) return;
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

function accountAssignableRoles() {
  return HAS_PRESIDENT_AUTHORITY
    ? ['gbm', 'bod', 'admin', 'president']
    : ['gbm', 'bod', 'admin'];
}
let pendingJointSubmission = null;

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
  const selected = String(selectedRole || '').toLowerCase();
  const roles = accountAssignableRoles();

  // An ordinary Admin may see an existing President account,
  // but cannot assign the President role.
  if (
    selected === 'president'
    && !roles.includes('president')
  ) {
    roles.push('president');
  }

  return roles.map(role => (
    `<option
      value="${role}"
      ${role === selected ? 'selected' : ''}
      ${
        role === 'president'
        && !HAS_PRESIDENT_AUTHORITY
          ? 'disabled'
          : ''
      }
    >${roleLabel(role)}</option>`
  )).join('');
}
function isProtectedPresidentAccount(role) {
  return role === 'president'
    && !HAS_PRESIDENT_AUTHORITY;
}
function accountRoleValue(user, fallbackRole) {
  return String(user.role || fallbackRole || user.requestedRole || 'gbm').toLowerCase();
}

function normalizeExplicitPositionKeys(values) {
  const rawValues = Array.isArray(values) ? values : [];
  const known = [];
  const unknownValues = [];
  rawValues.forEach(value => {
    const key = String(value || '').trim();
    if (!key) return;
    if (window.RcphPositions.getPositionByKey(key)) {
      known.push(key);
    } else {
      unknownValues.push(key);
    }
  });
  return {
    positionKeys: window.RcphPositions.sortPositionKeys(known),
    unknownValues
  };
}

function accountPositionState(user, options = {}) {
  if (Array.isArray(user.positionKeys)) {
    const normalized = normalizeExplicitPositionKeys(user.positionKeys);
    return {
      positionKeys: normalized.positionKeys,
      unknownValues: normalized.unknownValues,
      source: 'user.positionKeys',
      warning: normalized.unknownValues.length
        ? `Unknown saved position keys: ${normalized.unknownValues.join(', ')}. Select the correct positions before saving.`
        : ''
    };
  }

  const legacyValue = String(user.clubPosition || user.position || '').trim();
  if (legacyValue) {
    const mapped = window.RcphPositions.mapLegacyPositionText(legacyValue);
    return {
      positionKeys: mapped.positionKeys,
      unknownValues: mapped.unknownValues,
      source: 'legacy',
      warning: mapped.unknownValues.length
        ? 'This account has a legacy position value that could not be mapped safely. Select the correct positions before saving.'
        : ''
    };
  }

  const role = accountRoleValue(user, options.role);
  if (options.defaultPresident && role === 'president') {
    return { positionKeys: ['president'], unknownValues: [], source: 'presidentDefault', warning: '' };
  }

  return { positionKeys: [], unknownValues: [], source: 'empty', warning: '' };
}

function positionOptionHtml(position, uid, selectedKeys, disabled) {
  const checked = selectedKeys.includes(position.key);
  const searchValue = `${position.displayTitle} ${position.avenueCode} ${position.key}`.toLowerCase();
  return `
    <label class="position-multiselect__option" data-position-option="${escapeHtml(uid)}" data-position-search-value="${escapeHtml(searchValue)}">
      <input
        type="checkbox"
        value="${escapeHtml(position.key)}"
        data-position-checkbox="${escapeHtml(uid)}"
        ${checked ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
      >
      <span class="position-multiselect__option-main">
        <span>${escapeHtml(position.displayTitle)}</span>
        <small>${escapeHtml(position.avenueCode)}</small>
      </span>
    </label>
  `;
}

function positionGroupHtml(group, uid, selectedKeys, disabled) {
  const positions = window.RcphPositions.POSITION_CATALOG
    .filter(position => position.group === group.key)
    .map(position => positionOptionHtml(position, uid, selectedKeys, disabled))
    .join('');
  return `
    <div class="position-multiselect__group" data-position-group="${escapeHtml(uid)}">
      <div class="position-multiselect__group-title">${escapeHtml(group.label)}</div>
      ${positions}
    </div>
  `;
}

function positionChipListHtml(uid, selectedKeys) {
  const chips = window.RcphPositions.sortPositionKeys(selectedKeys).map(key => {
    const position = window.RcphPositions.getPositionByKey(key);
    if (!position) return '';
    return `
      <span class="position-chip">
        <span>${escapeHtml(position.displayTitle)}</span>
        <button type="button" data-position-remove="${escapeHtml(uid)}" data-position-key="${escapeHtml(key)}" aria-label="Remove ${escapeHtml(position.displayTitle)}">x</button>
      </span>
    `;
  }).join('');
  return `<div class="position-chip-list" data-position-chips="${escapeHtml(uid)}">${chips}</div>`;
}

function positionTriggerText(selectedKeys) {
  const count = window.RcphPositions.sortPositionKeys(selectedKeys).length;
  if (!count) return 'Select club positions';
  if (count === 1) return '1 position selected';
  return `${count} positions selected`;
}

function accountPositionControl(user, role, options = {}) {
  const state = accountPositionState(user, {
    role,
    defaultPresident: options.defaultPresident
  });
  const disabled = role === 'gbm';
  const selectedKeys = disabled
    ? []
    : window.RcphPositions.sortPositionKeys(state.positionKeys);
  const uid = String(user.id || '');
  const help = disabled
    ? 'GBM does not receive BOD positions.'
    : (role === 'bod' && !selectedKeys.length
      ? 'Select at least one club position for BOD access.'
      : (role === 'admin' || role === 'president' ? 'Positions are optional for this access role.' : ''));

  return `
    <div
      class="position-multiselect"
      data-position-scope="${escapeHtml(uid)}"
      data-current-role="${escapeHtml(role)}"
      data-position-source="${escapeHtml(state.source)}"
      data-legacy-position-warning="${state.warning ? 'true' : 'false'}"
      data-president-default-applied="${state.source === 'presidentDefault' ? 'true' : 'false'}"
    >
      <span class="position-multiselect__label">Club positions</span>
      <button
        class="position-multiselect__trigger"
        type="button"
        data-position-trigger="${escapeHtml(uid)}"
        aria-haspopup="true"
        aria-expanded="false"
        ${disabled ? 'disabled' : ''}
      >${escapeHtml(positionTriggerText(selectedKeys))}</button>
      <div class="position-multiselect__menu" data-position-menu="${escapeHtml(uid)}" hidden>
        <label class="sr-only" for="positionSearch-${escapeHtml(uid)}">Search club positions</label>
        <input
          id="positionSearch-${escapeHtml(uid)}"
          class="position-multiselect__search"
          data-position-search="${escapeHtml(uid)}"
          type="search"
          placeholder="Search positions"
          autocomplete="off"
        >
        <div class="position-multiselect__groups">
          ${window.RcphPositions.POSITION_GROUPS.map(group => positionGroupHtml(group, uid, selectedKeys, disabled)).join('')}
        </div>
      </div>
      ${positionChipListHtml(uid, selectedKeys)}
      <p class="position-multiselect__message" data-position-message="${escapeHtml(uid)}">${escapeHtml(help)}</p>
      ${state.warning ? `<p class="legacy-position-warning" data-legacy-warning="${escapeHtml(uid)}">${escapeHtml(state.warning)}</p>` : ''}
    </div>
  `;
}

function accountApprovalActions(user, requested) {
  const allowedRoles = accountAssignableRoles();

  const role = allowedRoles.includes(requested)
    ? requested
    : 'gbm';

  return `
    <div class="account-access-editor" data-account-editor="${escapeHtml(user.id)}" data-account-mode="approval">
      <div class="account-access-editor__row">
        <label class="account-access-editor__role">
          <span>Access role</span>
          <select data-account-role="${escapeHtml(user.id)}" aria-label="Approve role for ${escapeHtml(user.name || user.email || 'user')}">
            ${accountRoleOptions(role)}
          </select>
        </label>
        ${accountPositionControl(user, role, { defaultPresident: true })}
      </div>
      <p class="account-access-editor__note">BOD attendance now follows assigned club positions.</p>
      <p class="account-access-editor__message" data-account-message="${escapeHtml(user.id)}" role="alert"></p>
      <div class="account-access-editor__actions">
        <button class="btn" type="button" data-account-approve="${escapeHtml(user.id)}">Approve</button>
        <button class="btn btn-outline" type="button" data-account-reject="${escapeHtml(user.id)}">Reject</button>
      </div>
    </div>
  `;
}

function accountMaintenanceActions(user) {
  const currentRole = accountRoleValue(user);
  const allowedRoles = accountAssignableRoles();

  const role = allowedRoles.includes(currentRole)
    ? currentRole
    : (
      currentRole === 'president'
        ? 'president'
        : 'gbm'
    );

  const protectedPresident =
    isProtectedPresidentAccount(role);

  return `
    <div
      class="account-access-editor"
      data-account-editor="${escapeHtml(user.id)}"
      data-account-mode="maintenance"
    >
      <div class="account-access-editor__row">
        <label class="account-access-editor__role">
          <span>Access role</span>
          <select
            data-account-role="${escapeHtml(user.id)}"
            aria-label="Access role for ${escapeHtml(
              user.name || user.email || 'user'
            )}"
            ${protectedPresident ? 'disabled' : ''}
          >
            ${accountRoleOptions(role)}
          </select>
        </label>

        ${accountPositionControl(
          user,
          role,
          { defaultPresident: false }
        )}
      </div>

      ${
        protectedPresident
          ? `<p class="account-access-editor__message">
              President authority is required to modify this account.
            </p>`
          : `<p
              class="account-access-editor__message"
              data-account-message="${escapeHtml(user.id)}"
              role="alert"
            ></p>`
      }

      <div class="account-access-editor__actions">
        <button
          class="btn"
          type="button"
          data-account-save="${escapeHtml(user.id)}"
          ${protectedPresident ? 'disabled' : ''}
        >
          Save access
        </button>
      </div>
    </div>
  `;
}
function accountElementByData(attributeName, uid) {
  return Array.from(document.querySelectorAll(`[${attributeName}]`))
    .find(el => el.getAttribute(attributeName) === uid);
}

function readAccountRole(uid) {
  const select = accountElementByData('data-account-role', uid);
  return String(select?.value || 'gbm').toLowerCase();
}

function readSelectedPositionKeys(uid) {
  const checked = Array.from(document.querySelectorAll(`[data-position-checkbox="${CSS.escape(uid)}"]`))
    .filter(input => input.checked)
    .map(input => input.value);
  return window.RcphPositions.sortPositionKeys(checked);
}

function setSelectedPositionKeys(uid, keys) {
  const selected = new Set(window.RcphPositions.sortPositionKeys(keys));
  document.querySelectorAll(`[data-position-checkbox="${CSS.escape(uid)}"]`).forEach(input => {
    input.checked = selected.has(input.value);
  });
  refreshPositionControl(uid);
}

function setAccountMessage(uid, message, isError = false) {
  const messageEl = accountElementByData('data-account-message', uid);
  if (!messageEl) return;
  messageEl.textContent = message || '';
  messageEl.classList.toggle('is-error', !!isError);
}

function setAccountEditorBusy(uid, isBusy, busyText) {
  const editor = accountElementByData('data-account-editor', uid);
  if (!editor) return;
  editor.classList.toggle('is-saving', !!isBusy);
  editor.querySelectorAll('select, button, input').forEach(el => {
    el.disabled = !!isBusy;
  });
  const actionButton = editor.querySelector('[data-account-approve], [data-account-save]');
  if (actionButton) {
    if (isBusy) {
      actionButton.dataset.originalText = actionButton.textContent;
      actionButton.textContent = busyText || 'Saving...';
    } else if (actionButton.dataset.originalText) {
      actionButton.textContent = actionButton.dataset.originalText;
      delete actionButton.dataset.originalText;
    }
  }
  if (!isBusy) {
    refreshPositionControl(uid);
  }
}

function refreshPositionControl(uid, options = {}) {
  const role = readAccountRole(uid);
  const scope = accountElementByData('data-position-scope', uid);
  if (!scope) return;

  const previousRole = options.roleChanged ? String(scope.dataset.currentRole || '') : role;
  const transition = window.RcphPositions.applyRoleTransition({
    previousRole,
    nextRole: role,
    selectedKeys: readSelectedPositionKeys(uid),
    presidentDefaultApplied: scope.dataset.presidentDefaultApplied === 'true'
  });

  const selected = new Set(transition.positionKeys);
  scope.dataset.currentRole = role;
  scope.dataset.presidentDefaultApplied = transition.presidentDefaultApplied ? 'true' : 'false';

  scope.querySelectorAll('[data-position-checkbox]').forEach(input => {
    input.checked = selected.has(input.value);
    input.disabled = !!transition.disabled;
  });

  const trigger = accountElementByData('data-position-trigger', uid);
  if (trigger) {
    trigger.textContent = positionTriggerText(transition.positionKeys);
    trigger.disabled = !!transition.disabled;
    if (transition.disabled) {
      trigger.setAttribute('aria-expanded', 'false');
      closePositionMenu(uid, false);
    }
  }

  const chips = accountElementByData('data-position-chips', uid);
  if (chips) chips.outerHTML = positionChipListHtml(uid, transition.positionKeys);

  const message = accountElementByData('data-position-message', uid);
  if (message) message.textContent = transition.message || '';
}

function filterPositionMenu(uid, query) {
  const term = String(query || '').trim().toLowerCase();
  document.querySelectorAll(`[data-position-option="${CSS.escape(uid)}"]`).forEach(option => {
    const searchValue = option.dataset.positionSearchValue || '';
    option.hidden = !!term && !searchValue.includes(term);
  });
  document.querySelectorAll(`[data-position-group="${CSS.escape(uid)}"]`).forEach(group => {
    const visible = Array.from(group.querySelectorAll('[data-position-option]')).some(option => !option.hidden);
    group.hidden = !visible;
  });
}

function closePositionMenu(uid, restoreFocus = true) {
  const menu = accountElementByData('data-position-menu', uid);
  const trigger = accountElementByData('data-position-trigger', uid);
  if (menu) menu.hidden = true;
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }
}

function closeAllPositionMenus(exceptUid) {
  document.querySelectorAll('[data-position-menu]').forEach(menu => {
    const uid = menu.getAttribute('data-position-menu');
    if (uid && uid !== exceptUid) closePositionMenu(uid, false);
  });
}

function togglePositionMenu(uid) {
  const menu = accountElementByData('data-position-menu', uid);
  const trigger = accountElementByData('data-position-trigger', uid);
  if (!menu || !trigger || trigger.disabled) return;
  const willOpen = menu.hidden;
  closeAllPositionMenus(uid);
  menu.hidden = !willOpen;
  trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  if (willOpen) {
    const search = accountElementByData('data-position-search', uid);
    if (search) {
      search.value = '';
      filterPositionMenu(uid, '');
      search.focus();
    }
  }
}

function buildAccountAccessPayload(uid, mode) {
  const role = readAccountRole(uid);
  const positionKeys = readSelectedPositionKeys(uid);
  const validation = window.RcphPositions.validateRolePositions(role, positionKeys);
  const scope = accountElementByData('data-position-scope', uid);

  if (!validation.ok) {
    setAccountMessage(uid, validation.message, true);
    return null;
  }

  if (
    mode === 'maintenance'
    && scope?.dataset.legacyPositionWarning === 'true'
    && role !== 'gbm'
    && validation.positionKeys.length === 0
  ) {
    setAccountMessage(uid, 'Select the correct positions before saving this legacy account.', true);
    return null;
  }

  return {
    targetUid: uid,
    role,
    positionKeys: validation.positionKeys,
    confirmJointPositionKeys: [],
    operationSource: mode === 'approval' ? 'accountApproval' : 'roleMaintenance'
  };
}

function extractCallableError(err) {
  const details = err?.details || err?.customData?.details || err?.customData || err?.data || null;
  const code = String(err?.code || details?.code || '').replace(/^functions\//, '');
  return {
    code,
    message: err?.message || details?.message || 'The request could not be completed.',
    details
  };
}

function getJointConflicts(errorInfo) {
  const details = errorInfo?.details || {};
  const conflicts = Array.isArray(details.conflicts) ? details.conflicts : [];
  const isConflict = String(errorInfo?.code || '').includes('failed-precondition')
    && (details.code === 'joint-assignment-conflict' || conflicts.length > 0);
  return isConflict ? conflicts : [];
}

async function submitAccountAccessPayload(payload, options = {}) {
  const uid = payload.targetUid;
  setAccountMessage(uid, '');
  setAccountEditorBusy(uid, true, options.busyText || 'Saving...');

  try {
    await accountFunction('updateUserAccessAndPositions')(payload);
    setAccountMessage(uid, 'Access updated.');
    closeJointConflictDialog();
    return true;
  } catch (err) {
    const errorInfo = extractCallableError(err);
    const conflicts = getJointConflicts(errorInfo);
    if (conflicts.length) {
      showJointConflictDialog(payload, conflicts, options.mode || 'maintenance');
      setAccountMessage(uid, 'Joint position confirmation is required.', true);
    } else {
      setAccountMessage(uid, errorInfo.message, true);
      alert(errorInfo.message);
    }
    return false;
  } finally {
    setAccountEditorBusy(uid, false);
  }
}

async function approveAccountRequest(uid) {
  const payload = buildAccountAccessPayload(uid, 'approval');
  if (!payload) return;
  await submitAccountAccessPayload(payload, { mode: 'approval', busyText: 'Approving...' });
}

async function saveAccountAccess(uid) {
  const payload = buildAccountAccessPayload(uid, 'maintenance');
  if (!payload) return;
  await submitAccountAccessPayload(payload, { mode: 'maintenance', busyText: 'Saving...' });
}

function ensureJointConflictDialog() {
  let dialog = document.getElementById('jointConflictDialog');
  if (dialog) return dialog;
  dialog = document.createElement('div');
  dialog.id = 'jointConflictDialog';
  dialog.className = 'joint-conflict-dialog';
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="joint-conflict-dialog__backdrop" data-joint-cancel></div>
    <section class="joint-conflict-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="jointConflictTitle">
      <h2 id="jointConflictTitle">Confirm joint position assignment</h2>
      <p>The selected position is already assigned. Confirming will retain existing holders and add this user. Both holders may access position-owned systems later.</p>
      <div class="joint-conflict-dialog__list" data-joint-conflict-list></div>
      <p class="joint-conflict-dialog__message" data-joint-conflict-message></p>
      <div class="joint-conflict-dialog__actions">
        <button class="btn btn-outline" type="button" data-joint-cancel>Cancel</button>
        <button class="btn" type="button" data-joint-confirm>Confirm joint assignment</button>
      </div>
    </section>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

function holderText(holder) {
  const name = holder?.name || holder?.displayName || holder?.uid || 'Existing holder';
  const email = holder?.email ? ` (${holder.email})` : '';
  return `${name}${email}`;
}

function showJointConflictDialog(payload, conflicts, mode) {
  const dialog = ensureJointConflictDialog();
  pendingJointSubmission = {
    payload: JSON.parse(JSON.stringify(payload)),
    conflicts: JSON.parse(JSON.stringify(conflicts || [])),
    mode
  };

  const list = dialog.querySelector('[data-joint-conflict-list]');
  if (list) {
    list.innerHTML = conflicts.map(conflict => {
      const holders = Array.isArray(conflict.existingHolders) && conflict.existingHolders.length
        ? conflict.existingHolders.map(holder => `<li>${escapeHtml(holderText(holder))}</li>`).join('')
        : (Array.isArray(conflict.existingHolderUids) ? conflict.existingHolderUids : [])
          .map(uid => `<li>${escapeHtml(uid)}</li>`)
          .join('');
      return `
        <article class="joint-conflict-dialog__item">
          <h3>${escapeHtml(conflict.displayTitle || conflict.positionKey || 'Position')}</h3>
          <ul>${holders || '<li>Existing holder</li>'}</ul>
        </article>
      `;
    }).join('');
  }

  const message = dialog.querySelector('[data-joint-conflict-message]');
  if (message) message.textContent = '';
  const confirmBtn = dialog.querySelector('[data-joint-confirm]');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm joint assignment';
  }
  dialog.hidden = false;
}

function closeJointConflictDialog() {
  const dialog = document.getElementById('jointConflictDialog');
  if (dialog) dialog.hidden = true;
  pendingJointSubmission = null;
}

async function confirmJointConflict() {
  if (!pendingJointSubmission) return;
  const dialog = ensureJointConflictDialog();
  const confirmBtn = dialog.querySelector('[data-joint-confirm]');
  const message = dialog.querySelector('[data-joint-conflict-message]');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirming...';
  }
  if (message) message.textContent = '';

  const conflictKeys = window.RcphPositions.extractConflictKeys({
    conflicts: pendingJointSubmission.conflicts
  });
  const retryPayload = window.RcphPositions.buildJointRetryPayload(pendingJointSubmission.payload, conflictKeys);
  const mode = pendingJointSubmission.mode || 'maintenance';
  const ok = await submitAccountAccessPayload(retryPayload, {
    mode,
    busyText: mode === 'approval' ? 'Approving...' : 'Saving...'
  });

  if (!ok && confirmBtn && !dialog.hidden) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm joint assignment';
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
    const currentRole = accountRoleValue(user, requested);
    const actions = status === 'pending'
      ? accountApprovalActions(user, requested)
      : (status === 'rejected' && user.rejectReason
        ? `<span title="${escapeHtml(user.rejectReason)}">Rejected</span>`
        : accountMaintenanceActions(user));
    const approvedSummary = status === 'pending'
      ? ''
      : `<div class="account-position-summary">Current: ${escapeHtml(window.RcphPositions.formatPositionSummary(user.positionKeys || [], user.clubPosition || '-'))}</div>`;

    return `
      <tr>
        <td>${escapeHtml(user.name || '-')}</td>
        <td>${escapeHtml(user.email || '-')}</td>
        <td>${roleLabel(status === 'pending' ? requested : currentRole)}</td>
        <td>${formatDate(user.createdAt)}</td>
        <td>${statusBadge(status)}</td>
        <td>${actions}${approvedSummary}</td>
      </tr>
    `;
  }).join('');
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
  const positionTrigger = event.target.closest('[data-position-trigger]');
  if (positionTrigger) {
    togglePositionMenu(positionTrigger.dataset.positionTrigger);
    return;
  }

  const positionRemove = event.target.closest('[data-position-remove]');
  if (positionRemove) {
    const uid = positionRemove.dataset.positionRemove;
    const key = positionRemove.dataset.positionKey;
    const selected = readSelectedPositionKeys(uid).filter(item => item !== key);
    setSelectedPositionKeys(uid, selected);
    return;
  }

  const approveBtn = event.target.closest('[data-account-approve]');
  if (approveBtn) {
    approveAccountRequest(approveBtn.dataset.accountApprove);
    return;
  }

  const rejectBtn = event.target.closest('[data-account-reject]');
  if (rejectBtn) {
    rejectAccountRequest(rejectBtn.dataset.accountReject);
    return;
  }

  const saveBtn = event.target.closest('[data-account-save]');
  if (saveBtn) {
    saveAccountAccess(saveBtn.dataset.accountSave);
    return;
  }

  const jointCancel = event.target.closest('[data-joint-cancel]');
  if (jointCancel) {
    closeJointConflictDialog();
    return;
  }

  const jointConfirm = event.target.closest('[data-joint-confirm]');
  if (jointConfirm) {
    confirmJointConflict();
    return;
  }

  if (!event.target.closest('.position-multiselect')) {
    closeAllPositionMenus();
  }
});

document.addEventListener('change', (event) => {
  const roleSelect = event.target.closest('[data-account-role]');
  if (roleSelect) {
    refreshPositionControl(roleSelect.dataset.accountRole, { roleChanged: true });
    return;
  }

  const positionCheckbox = event.target.closest('[data-position-checkbox]');
  if (positionCheckbox) {
    refreshPositionControl(positionCheckbox.dataset.positionCheckbox);
  }
});

document.addEventListener('input', (event) => {
  const search = event.target.closest('[data-position-search]');
  if (search) {
    filterPositionMenu(search.dataset.positionSearch, search.value);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const openMenu = Array.from(document.querySelectorAll('[data-position-menu]')).find(menu => !menu.hidden);
    if (openMenu) {
      closePositionMenu(openMenu.getAttribute('data-position-menu'), true);
    } else if (!document.getElementById('jointConflictDialog')?.hidden) {
      closeJointConflictDialog();
    }
  }
});

function prospectFunction(name) {
  return callableFunction(name);
}

function setProspectManagementMessage(message, isError = false) {
  if (!prospectManagementMessage) return;
  prospectManagementMessage.textContent = message || '';
  prospectManagementMessage.classList.toggle('is-error', isError);
}

function prospectStatusLabel(prospect) {
  if (prospect.status === 'promoted') return 'Promoted';
  if (prospect.ready) return 'Ready for Induction';
  if (prospect.attendanceRequirementMet) return 'Dues Pending';
  if (Number(prospect.currentConsecutiveAttendance || 0) > 0) return 'In Progress';
  return 'Getting Started';
}

function prospectStatusClass(prospect) {
  if (prospect.status === 'promoted') return 'is-promoted';
  if (prospect.ready) return 'is-ready';
  return '';
}

function renderProspectSummary() {
  const summary = PROSPECT_SUMMARY || {};
  if (prospectMembersBadge) {
    prospectMembersBadge.textContent = `${Number(summary.active ?? summary.total ?? 0)} prospects - ${Number(summary.ready || 0)} ready`;
  }
  if (prospectTotalKpi) prospectTotalKpi.textContent = Number(summary.active ?? summary.total ?? 0);
  if (prospectAttendanceCompleteKpi) prospectAttendanceCompleteKpi.textContent = Number(summary.attendanceComplete || 0);
  if (prospectDuesPendingKpi) prospectDuesPendingKpi.textContent = Number(summary.duesPending || 0);
  if (prospectReadyKpi) prospectReadyKpi.textContent = Number(summary.ready || 0);
}

function formatProspectEventDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function prospectDuesStatus(prospect) {
  if (prospect.duesPaid) return 'Paid';
  if (prospect.duesDue || prospect.attendanceRequirementMet) return 'Pending';
  return 'Not yet due';
}

function prospectPromotionHelp(prospect) {
  if (prospect.ready) return 'Attendance and dues are complete. This prospect is ready for induction.';
  if (!prospect.attendanceRequirementMet) {
    return 'Needs 3 consecutive eligible club meetings or events. Missing an eligible activity resets the active streak.';
  }
  if (!prospect.duesPaid) return 'Attendance requirement complete. Dues are pending.';
  return 'Prospect is not ready for induction yet.';
}

function renderProspectQualifyingEvents(prospect) {
  if (!prospect.attendanceRequirementMet) return '';
  const events = Array.isArray(prospect.qualifyingEvents) ? prospect.qualifyingEvents : [];
  if (!events.length) return '<p class="prospect-card__note">Qualifying activities are complete.</p>';
  const items = events.map(event => `
    <li>
      <strong>${escapeHtml(event.name || 'Club activity')}</strong>
      <span>${escapeHtml(formatProspectEventDate(event.date))}</span>
    </li>
  `).join('');
  return `
    <div>
      <p class="prospect-card__note"><strong>Qualifying activities</strong></p>
      <ul class="prospect-card__qualifying">${items}</ul>
    </div>
  `;
}

function getFilteredProspects() {
  const query = String(prospectSearch?.value || '').trim().toLowerCase();
  const filter = prospectFilter?.value || 'all';
  return (PROSPECTS || []).filter(prospect => {
    const matchesSearch = `${prospect.name || ''} ${prospect.email || ''}`.toLowerCase().includes(query);
    if (!matchesSearch) return false;
    if (filter === 'ready') return prospect.ready === true;
    if (filter === 'promoted') return prospect.status === 'promoted';
    if (filter === 'in_progress') return prospect.status !== 'promoted' && prospect.ready !== true;
    return true;
  });
}

function renderProspectCards() {
  if (!prospectCards) return;
  renderProspectSummary();
  const rows = getFilteredProspects();
  if (!PROSPECTS_LOADED) {
    prospectCards.innerHTML = '';
    return;
  }
  if (!rows.length) {
    prospectCards.innerHTML = '<p class="prospect-message">No prospects match this view.</p>';
    return;
  }

  prospectCards.innerHTML = rows.map(prospect => {
    const requiredConsecutive = Math.max(1, Number(prospect.requiredConsecutiveAttendance || prospect.criteria?.requiredConsecutiveAttendance) || 3);
    const currentStreak = Math.max(0, Number(prospect.currentConsecutiveAttendance) || 0);
    const highestStreak = Math.max(0, Number(prospect.maximumConsecutiveAttendance) || 0);
    const attendanceProgressCount = prospect.attendanceRequirementMet
      ? requiredConsecutive
      : Math.min(currentStreak, requiredConsecutive);
    const percent = Math.max(0, Math.min(100, Number(prospect.percent || 0)));
    const promoted = prospect.status === 'promoted';
    const statusClass = prospectStatusClass(prospect);
    const duesStatus = prospectDuesStatus(prospect);
    const promotionHelp = prospectPromotionHelp(prospect);
    const fourthActivityText = prospect.fourthEligibleActivityDate
      ? `Dues payable at the 4th eligible activity (${formatProspectEventDate(prospect.fourthEligibleActivityDate)}).`
      : 'Dues payable at the 4th eligible activity.';
    return `
      <article class="prospect-card ${statusClass}">
        <div class="prospect-card__head">
          <div>
            <h3>${escapeHtml(prospect.name || 'Prospect')}</h3>
            <p class="prospect-card__meta">${escapeHtml(prospect.email || '-')}</p>
            ${prospect.phone ? `<p class="prospect-card__meta">${escapeHtml(prospect.phone)}</p>` : ''}
          </div>
          <span class="prospect-status ${statusClass}">${escapeHtml(prospectStatusLabel(prospect))}</span>
        </div>

        <div class="prospect-card__details">
          <p><strong>Hobbies:</strong> ${escapeHtml(prospect.hobbies || 'N/A')}</p>
          <p><strong>Why RCPH:</strong> ${escapeHtml(prospect.joinReason || 'N/A')}</p>
          <p><strong>Referred by:</strong> ${escapeHtml(prospect.referredBy || 'N/A')}</p>
          <p><strong>Previous Rotaract:</strong> ${escapeHtml(prospect.previousRotaractDetails || 'N/A')}</p>
        </div>

        <div class="prospect-card__progress">
          <div class="prospect-card__progress-row"><span>Current streak</span><strong>${attendanceProgressCount} / ${requiredConsecutive}</strong></div>
          <div class="prospect-card__progress-row"><span>Highest streak</span><strong>${highestStreak}</strong></div>
          <div class="prospect-card__progress-row"><span>Attendance requirement</span><strong>${prospect.attendanceRequirementMet ? 'Complete' : 'In Progress'}</strong></div>
          <div class="prospect-card__progress-row"><span>Dues status</span><strong>${escapeHtml(duesStatus)}</strong></div>
          <div class="prospect-card__progress-row"><span>Ready for induction</span><strong>${prospect.ready ? 'Yes' : 'No'}</strong></div>
          <div class="prospect-progress-track" role="progressbar" aria-label="${escapeHtml(prospect.name || 'Prospect')} onboarding progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
            <div class="prospect-progress-fill" style="width:${percent}%"></div>
          </div>
          <p class="prospect-card__note">${escapeHtml(fourthActivityText)}</p>
          ${renderProspectQualifyingEvents(prospect)}
        </div>

        <label class="prospect-card__dues">
          <input type="checkbox" data-prospect-dues="${escapeHtml(prospect.uid)}" ${prospect.duesPaid ? 'checked' : ''} ${promoted ? 'disabled' : ''}>
          <span>Dues Paid: ${prospect.duesPaid ? 'Yes' : 'No'}</span>
        </label>

        <div class="prospect-card__actions">
          ${promoted ? '<span class="prospect-promotion-help">This prospect has been promoted to GBM.</span>' : `
            <button class="btn" type="button" data-prospect-promote="${escapeHtml(prospect.uid)}" ${prospect.ready ? '' : 'disabled'}>Promote to GBM</button>
            <span class="prospect-promotion-help">${escapeHtml(promotionHelp)}</span>
          `}
        </div>
      </article>
    `;
  }).join('');
}

async function loadProspectManagementData(options = {}) {
  const { showLoading = true, renderAttendance = true } = options;
  if (!IS_ADMIN) return;
  if (showLoading) setProspectManagementMessage('Loading and recalculating prospect progress...');
  if (prospectRefreshBtn) prospectRefreshBtn.disabled = true;

  try {
    const result = await prospectFunction('getProspectManagementData')({});
    const data = result.data || {};
    PROSPECTS = Array.isArray(data.prospects) ? data.prospects : [];
    PROSPECT_SUMMARY = { ...PROSPECT_SUMMARY, ...(data.summary || {}) };
    PROSPECTS_LOADED = true;
    renderProspectCards();
    if (renderAttendance && attHead && attBody) renderGrid();
    setProspectManagementMessage(`Updated ${PROSPECTS.length} prospect record${PROSPECTS.length === 1 ? '' : 's'}.`);
  } catch (err) {
    console.error('Prospect management load failed:', err);
    setProspectManagementMessage(err?.message || 'Could not load prospect management data.', true);
  } finally {
    if (prospectRefreshBtn) prospectRefreshBtn.disabled = false;
  }
}

async function syncProspectProgressAfterAttendance(uids) {
  const prospectUids = Array.from(new Set((uids || []).filter(uid => isProspectAttendancePerson(uid))));
  if (!prospectUids.length) return;
  try {
    await Promise.all(prospectUids.map(uid => prospectFunction('recalculateProspectProgress')({ uid })));
    await loadProspectManagementData({ showLoading: false, renderAttendance: false });
  } catch (err) {
    console.error('Prospect progress recalculation failed:', err);
    setProspectManagementMessage(err?.message || 'Attendance saved, but prospect progress could not be refreshed.', true);
  }
}

async function updateProspectDuesAdmin(uid, duesPaid) {
  setProspectManagementMessage('Updating dues and progress...');
  try {
    await prospectFunction('updateProspectDues')({ uid, duesPaid });
    await loadProspectManagementData({ showLoading: false });
  } catch (err) {
    setProspectManagementMessage(err?.message || 'Could not update prospect dues.', true);
    await loadProspectManagementData({ showLoading: false });
  }
}

async function promoteProspectAdmin(uid) {
  const prospect = PROSPECTS.find(item => item.uid === uid);
  if (!prospect?.ready) return;
  if (!confirm(`Promote ${prospect.name || prospect.email || 'this prospect'} to GBM?`)) return;

  setProspectManagementMessage('Promoting prospect and initializing member records...');
  try {
    await prospectFunction('promoteProspectToGbm')({ uid });
    await loadProspectManagementData({ showLoading: false });
    setProspectManagementMessage(`${prospect.name || 'Prospect'} was promoted to GBM.`);
  } catch (err) {
    setProspectManagementMessage(err?.message || 'Could not promote this prospect.', true);
  }
}



async function loadData(){
  const [mSnap, eSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get()
  ]);

  MEMBERS = mSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  EVENTS  = eSnap.docs.map(d => ({ id:d.id, ...d.data() }))
    .filter(e => e.archived !== true && String(e.type || 'clubEvent') === 'clubEvent');

  await loadProspectManagementData({ showLoading: false, renderAttendance: false });
  
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
    BODM    = bmSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(isActiveBodRosterMember);
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
  renderInsightsPanel();
  buildCollaborationFilters();
  renderCollaborationReports();
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
  buildCollaborationFilters();
  renderGrid();
  renderInsightsPanel();   
  renderCollaborationReports();
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
      BODM = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(isActiveBodRosterMember);
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

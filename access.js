'use strict';

const els = {
  loadingState: document.getElementById('loadingState'),
  messageState: document.getElementById('messageState'),
  messageTitle: document.getElementById('messageTitle'),
  messageText: document.getElementById('messageText'),
  hubContent: document.getElementById('hubContent'),
  accessCards: document.getElementById('accessCards'),
  profileName: document.getElementById('profileName'),
  profileEmail: document.getElementById('profileEmail'),
  roleChip: document.getElementById('roleChip'),
  accessIntro: document.getElementById('accessIntro'),
  signOutBtn: document.getElementById('signOutBtn')
};

const auth = window.auth;
const functionsClient = firebase.functions();
const getMyAccess = functionsClient.httpsCallable('getMyAccess');

const PANEL_DEFS = [
  {
    key: 'dashboard',
    title: 'My Member Dashboard',
    description: 'View your attendance, upcoming events, avenue breakdowns and club-level stats.',
    href: 'my-dashboard.html',
    roles: ['gbm', 'bod', 'admin', 'president']
  },
  {
    key: 'bod',
    title: 'BOD Event Manager',
    description: 'Submit and review avenue event records..',
    href: 'BOD%20Event%20manager/bodlogin.html',
    roles: ['bod', 'admin', 'president']
  },
  {
    key: 'admin',
    title: 'Admin Panel',
    description: 'Manage account approvals, avenue event attendance, BOD attendance, district event attendance and admin workflows.',
    href: 'admin.html',
    roles: ['admin', 'president']
  }
];

function setState(state) {
  els.loadingState.hidden = state !== 'loading';
  els.messageState.hidden = state !== 'message';
  els.hubContent.hidden = state !== 'hub';
}

function roleLabel(role) {
  const labels = {
    gbm: 'GBM',
    bod: 'BOD',
    admin: 'Admin',
    president: 'President'
  };
  return labels[String(role || '').toLowerCase()] || 'Member';
}

function getApprovedRole(access) {
  const roleDoc = access?.role || null;
  const roleStatus = String(roleDoc?.status || 'approved').toLowerCase();
  if (roleDoc?.role && roleStatus === 'approved') {
    return String(roleDoc.role).toLowerCase();
  }

  const userDoc = access?.user || null;
  const userStatus = String(userDoc?.status || '').toLowerCase();
  if (userDoc?.role && userStatus === 'approved') {
    return String(userDoc.role).toLowerCase();
  }

  return '';
}

function getAccountStatus(access) {
  const userStatus = String(access?.user?.status || '').toLowerCase();
  if (userStatus) return userStatus;

  const roleDoc = access?.role || null;
  const roleStatus = String(roleDoc?.status || '').toLowerCase();
  if (roleDoc?.role && (!roleStatus || roleStatus === 'approved')) return 'approved';

  return '';
}

function showMessage(title, message) {
  els.messageTitle.textContent = title;
  els.messageText.textContent = message;
  setState('message');
}

function renderCards(role) {
  const allowed = PANEL_DEFS.filter(panel => panel.roles.includes(role));
  els.accessCards.innerHTML = allowed.map(panel => `
    <article class="panel-card">
      <div>
        <h3>${panel.title}</h3>
        <p>${panel.description}</p>
      </div>
      <a class="btn" href="${panel.href}">Open</a>
    </article>
  `).join('');
}

function renderHub(user, access, role) {
  const profile = access?.user || {};
  els.profileName.textContent = profile.name || user.displayName || user.email || 'RCPH Member';
  els.profileEmail.textContent = profile.email || user.email || '';
  els.roleChip.textContent = roleLabel(role);
  els.accessIntro.textContent = `Approved ${roleLabel(role)} account. Choose an available panel.`;
  renderCards(role);
  setState('hub');
}

els.signOutBtn.addEventListener('click', async () => {
  await auth.signOut();
  location.href = 'login.html';
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }

  setState('loading');

  try {
    const result = await getMyAccess({});
    const access = result.data || {};
    const role = getApprovedRole(access);
    const status = getAccountStatus(access);

    if (!role && status === 'pending') {
      showMessage('Pending approval', 'Your account is pending approval. You will be able to use the access hub after approval.');
      return;
    }

    if (!role && status === 'rejected') {
      const detail = access?.user?.rejectReason ? ` Reason: ${access.user.rejectReason}` : '';
      showMessage('Account rejected', `Your account request was rejected.${detail}`);
      return;
    }

    if (!role) {
      showMessage('No active role', 'No approved role is assigned to this account yet. Please contact an admin or president.');
      return;
    }

    renderHub(user, access, role);
  } catch (err) {
    const code = String(err?.code || '');
    if (code.includes('unauthenticated')) {
      location.href = 'login.html';
      return;
    }
    showMessage('Could not load access', err?.message || 'Please try again or contact an admin.');
  }
});

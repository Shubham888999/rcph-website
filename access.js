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
  signedInAs: document.getElementById('signedInAs'),
  accessIntro: document.getElementById('accessIntro'),
  signOutBtn: document.getElementById('signOutBtn')
};

const auth = window.auth;
const functionsClient = firebase.functions();
const getMyAccess = functionsClient.httpsCallable('getMyAccess');
const PROSPECT_WHATSAPP_URL = 'https://chat.whatsapp.com/PLACEHOLDER';

const PANEL_DEFS = [
  {
    key: 'dashboard',
    title: 'My Member Dashboard',
    description: 'View your attendance, upcoming events and club-level stats.',
    href: 'my-dashboard.html',
    roles: ['prospect', 'gbm', 'bod', 'admin', 'president']
  },
  {
    key: 'whatsapp',
    title: 'Join Our WhatsApp Group',
    description: 'Get updates about meetings, avenue events, projects, and onboarding announcements.',
    href: PROSPECT_WHATSAPP_URL,
    target: '_blank',
    rel: 'noopener',
    actionLabel: 'Join Group',
    roles: ['prospect']
  },
  {
    key: 'membership-progress',
    title: 'Membership Progress',
    description: 'Complete 2 GBMs, 2 avenue events, and dues payment to become an official member.',
    href: 'my-dashboard.html',
    actionLabel: 'View Progress',
    roles: ['prospect']
  },
  {
    key: 'bod',
    title: 'BOD Event Manager',
    description: 'Submit and review avenue event records.',
    href: 'BOD%20Event%20manager/bodlogin.html',
    roles: ['bod', 'admin', 'president']
  },
  {
    key: 'visit-submissions',
    title: 'Club Visits',
    description: 'Prepare and manage documents for Club Assembly, DZR Visit, and DRR Visit.',
    href: 'visit-submissions.html',
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
    prospect: 'Prospect',
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
  els.accessCards.innerHTML = allowed.map(panel => {
    const isProspectDashboard = role === 'prospect' && panel.key === 'dashboard';
    const title = isProspectDashboard ? 'My Dashboard' : panel.title;
    const description = isProspectDashboard
      ? 'Track your onboarding journey and next steps toward becoming an official RCPH member.'
      : panel.description;
    const target = panel.target ? ` target="${panel.target}"` : '';
    const rel = panel.rel ? ` rel="${panel.rel}"` : '';
    return `
    <article class="panel-card panel-card--${panel.key}">
      <div>
        <h3>${title}</h3>
        <p>${description}</p>
      </div>
      <a class="btn" href="${panel.href}"${target}${rel}>${panel.actionLabel || 'Open'}</a>
    </article>
  `;
  }).join('');
}

function renderHub(user, access, role) {
  const profile = access?.user || {};
  els.profileName.textContent = profile.name || user.displayName || user.email || 'RCPH Member';
  els.profileEmail.textContent = profile.email || user.email || '';
  els.signedInAs.textContent = `Signed in as ${roleLabel(role)}`;
  els.accessIntro.textContent = role === 'prospect'
    ? 'Prospect account approved. Complete your onboarding steps to become an official RCPH member.'
    : `Approved ${roleLabel(role)} account. Choose an available panel.`;
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

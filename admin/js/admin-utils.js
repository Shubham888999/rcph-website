/**
 * Cross-feature helper functions used across the admin dashboard.
 */

function getGdriveImageUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com")) {
    const idMatch = url.match(/[-\w]{25,}/);
    if (idMatch) {
      return `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=s1000`;
    }
  }
  return url;
}


const _charts = {};
function drawChart(key, ctx, cfg){
  if (!window.Chart || !ctx) return; 
  if (_charts[key]) { _charts[key].destroy(); }
  _charts[key] = new Chart(ctx, cfg);
}

const fmt = n => Number(n).toLocaleString();
const yyyymm = d => d.slice(0,7);

function membersMap() {
  const map = {};
  MEMBERS.forEach(m => map[m.id] = m.name || '');
  return map;
}

function getAttendanceRoster() {
  const memberIds = new Set(MEMBERS.map(member => member.id));
  const activeProspects = (PROSPECTS || [])
    .filter(prospect => prospect.status !== 'promoted' && !memberIds.has(prospect.uid))
    .map(prospect => ({
      id: prospect.uid,
      name: prospect.name || prospect.email || 'Prospect',
      email: prospect.email || '',
      role: 'prospect',
      position: 'Prospect',
      _isProspect: true,
    }));
  return [...MEMBERS, ...activeProspects];
}

function isProspectAttendancePerson(uid) {
  return (PROSPECTS || []).some(prospect => prospect.uid === uid && prospect.status !== 'promoted');
}


function getFilteredMembersAndEvents(options = {}) {
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value;
  const avenueSel = avenueFilter.value;

  const roster = options.includeProspects ? getAttendanceRoster() : MEMBERS;
  const members = roster.filter(m => (
    `${m.name || ''} ${m.email || ''}`.toLowerCase().includes(memQuery)
  ));

  let events = EVENTS.filter(e => (e.name || '').toLowerCase().includes(evQuery));

  if (monthSel) {
    events = events.filter(e => (e.date || '').startsWith(monthSel));
  }

  if (avenueSel) {
    events = events.filter(e => {
      const eventAvenues = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      if (avenueSel === 'Other') return eventAvenues.length === 0;
      return eventAvenues.includes(avenueSel);
    });
  }

  return { members, events };
}


function escapeMailValue(value) {
  return encodeURIComponent(value || '');
}

function buildMailtoUrl({ to, subject, body, from }) {
  const fullBody = from
    ? `${body}\n\nFrom: ${from}`
    : body;

  return `mailto:${encodeURIComponent(to || '')}?subject=${escapeMailValue(subject)}&body=${escapeMailValue(fullBody)}`;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function callableFunction(name) {
  if (!firebase.functions) throw new Error('Firebase Functions SDK is not loaded.');
  return firebase.functions().httpsCallable(name);
}

function formatDate(value) {
  if (!value) return '-';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function roleLabel(role) {
  const labels = {
    gbm: 'GBM',
    bod: 'BOD',
    admin: 'Admin',
    president: 'President',
    pending: 'Pending'
  };
  return labels[String(role || '').toLowerCase()] || '-';
}

const CLUB_POSITIONS = [
  'Member',
  'President',
  'Immediate Past President',
  'Vice President',
  'Secretary',
  'Joint Secretary',
  'Treasurer',
  'Sergeant-at-Arms',
  'Club Service Director',
  'Community Service Director',
  'International Service Director',
  'Professional Development Director',
  'Public Relations Officer',
  'Rotary Rotaract Relations Officer',
  'DEI Director',
  'Website Director',
  'Editor',
  'Other'
];

function defaultClubPositionForRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'gbm') return 'Member';
  if (r === 'bod') return 'Website Director';
  if (r === 'admin') return 'Website Director';
  return 'Member';
}

function positionSelectOptions(position) {
  const value = String(position || '').trim();
  const selectedKnown = CLUB_POSITIONS.includes(value) ? value : (value ? 'Other' : '');
  const options = [''].concat(CLUB_POSITIONS);
  return options.map(pos => {
    const label = pos || 'Select position...';
    return `<option value="${escapeHtml(pos)}" ${pos === selectedKnown ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function customPositionValue(position) {
  const value = String(position || '').trim();
  return value && !CLUB_POSITIONS.includes(value) ? value : '';
}

function statusBadge(status) {
  const s = String(status || 'pending').toLowerCase();
  const colors = {
    approved: 'background:#163f2a;color:#8ef0ad;border:1px solid #286b43;',
    pending: 'background:#3d3216;color:#f4d35e;border:1px solid #6f5b25;',
    rejected: 'background:#451f24;color:#ff9aa6;border:1px solid #74323b;'
  };
  return `<span class="badge" style="${colors[s] || ''}">${escapeHtml(roleLabel(s) === '-' ? s : roleLabel(s))}</span>`;
}

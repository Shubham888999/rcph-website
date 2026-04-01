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


function getFilteredMembersAndEvents() {
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value;
  const avenueSel = avenueFilter.value;

  const members = MEMBERS.filter(m => (m.name || '').toLowerCase().includes(memQuery));

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




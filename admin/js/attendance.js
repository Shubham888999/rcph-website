/**
 * Attendance manager grid rendering, actions, and export flows.
 */

function buildMonthFilterFromEvents() {
  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  monthFilter.innerHTML = '<option value="">All months</option>';
  Array.from(new Set(EVENTS.map(e => (e.date || '').slice(0, 7))))
    .filter(Boolean)
    .sort()
    .forEach(ym => {
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = monthLabel(ym);
      monthFilter.appendChild(opt);
    });
}
async function bulkSetAttendanceForEvent(eventId, value) {
  const { members } = getFilteredMembersAndEvents();
  if (!members.length) return;

  const batch = db.batch();

  members.forEach(m => {
    const ref = db.collection('attendance').doc(m.id);
    batch.set(ref, { [eventId]: value }, { merge: true });
    ATT[m.id] = ATT[m.id] || {};
    ATT[m.id][eventId] = value;
  });

  await batch.commit();
  renderGrid();
}

async function bulkSetAttendanceForMember(memberId, value) {
  const { events } = getFilteredMembersAndEvents();
  if (!events.length) return;

  const payload = {};
  events.forEach(ev => {
    payload[ev.id] = value;
  });

  await db.collection('attendance').doc(memberId).set(payload, { merge: true });

  ATT[memberId] = ATT[memberId] || {};
  events.forEach(ev => {
    ATT[memberId][ev.id] = value;
  });

  renderGrid();
}



function isWRWEvent(ev) {
  const name = String(ev.name || '').trim().toLowerCase();

  const WRW_EVENT_NAMES = [
    'clean up drive',
    'mahadaan 11.0',
    'rotary-rotaract round table',
    'the luxe carry',
    'rotaract originals',
    'pickleball smashdown',
    'celebrating her'
  ];

  return WRW_EVENT_NAMES.includes(name);
}

function getEventAttendanceCount(eventId, members) {
  let present = 0;
  let considered = 0;

  members.forEach(m => {
    const v = (ATT[m.id] || {})[eventId];
    if (v !== 'NA') {
      considered++;
      if (v === true) present++;
    }
  });

  return { present, considered };
}


function renderGrid(){
  const memQuery = memberSearch.value.trim().toLowerCase();
  const evQuery  = eventSearch.value.trim().toLowerCase();
  const monthSel = monthFilter.value; 
  const avenueSel = avenueFilter.value; 

  const members = MEMBERS.filter(m => (m.name || '').toLowerCase().includes(memQuery));
  let events = EVENTS.filter(e => (e.name || '').toLowerCase().includes(evQuery));
  
  if (monthSel) events = events.filter(e => (e.date || '').startsWith(monthSel));
  
  if (avenueSel) {
    events = events.filter(e => {
      const eventAvenues = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      if (avenueSel === 'Other') return eventAvenues.length === 0;
      return eventAvenues.includes(avenueSel);
    });
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML =
    `<th class="sticky-col">Member \\ Event</th>` +
    events.map(e => { 
      const a = e.avenue || []; 
      const avenues = Array.isArray(a) ? a : (a ? [a] : []); 
      const avenueString = avenues.join(', ');
      const avenueHtml = avenueString
        ? `<small style="color: var(--color-accent, #60C3C4); font-weight: 600;">${avenueString}</small>`
        : '';
            const wrwHtml = isWRWEvent(e)
        ? `<div class="event-mini-tag wrw">WRW</div>`
        : '';

const { present: eventPresent } = getEventAttendanceCount(e.id, members);
const eventCountHtml = `<div class="event-att-count">✓ ${eventPresent}</div>`;

return `
  <th title="${e.date || ''}">
    <div class="bulk-wrap">
      <div class="ev-head">
        <span>${e.name || ''}</span>
        <button class="icon-btn" title="Rename event" data-edit-event="${e.id}">✏️</button>
        <button class="icon-btn" title="Delete event" data-del-event="${e.id}">🗑</button>
      </div>

      ${wrwHtml}
      ${avenueHtml}

      <small>
        ${(e.date || '').slice(0,10)}
        ${e.endDate ? ` → ${e.endDate.slice(0,10)}` : ""}
      </small>

      <select class="bulk-select" data-bulk-event="${e.id}">
        <option value="">All attendance</option>
        <option value="P">✓ Present</option>
        <option value="A">✗ Absent</option>
        <option value="NA">NA</option>
      </select>

      ${eventCountHtml}
    </div>
  </th>
`;
    }).join('');
    
  attHead.innerHTML = '';
  attHead.appendChild(headRow);

  attBody.innerHTML = '';
  members.forEach(m => {
    const tr = document.createElement('tr');
    const attForMember = ATT[m.id] || {};

    const values  = events.map(e => attForMember[e.id]);
    const considered = values.filter(v => v !== 'NA'); 
    const total   = considered.length;
    const present = considered.filter(v => v === true).length;
    const pct     = total ? Math.round((present/total)*100) : 0;

    const gbmIds = events.filter(e => {
      const a = Array.isArray(e.avenue) ? e.avenue : (e.avenue ? [e.avenue] : []);
      return a.includes('GBM');
    }).map(e => e.id);
    
    const gbmValues   = gbmIds.map(id => attForMember[id]);
    const gbmConsider = gbmValues.filter(v => v !== 'NA');
    const gbmTotal    = gbmConsider.length;
    const gbmPresent  = gbmConsider.filter(v => v === true).length;
    const gbmPct      = gbmTotal ? Math.round((gbmPresent/gbmTotal)*100) : 0;

    tr.innerHTML =
      `
<td class="sticky-col">
  <div class="mem-left">
    <div class="stat-box" title="Across visible columns">
      <span class="stat">All: ${present}/${total} · ${pct}%</span>
      <span class="stat">GBM: ${gbmPresent}/${gbmTotal} · ${gbmPct}%</span>
    </div>

    <div class="bulk-wrap" style="align-items:flex-start;">
      <div class="mem-cell">
        <span>${m.name || ''}</span>
        <button class="icon-btn" title="Rename member" data-edit-member="${m.id}">✏️</button>
        <button class="icon-btn" title="Delete member" data-del-member="${m.id}">🗑</button>
      </div>

      <select class="bulk-select" data-bulk-member="${m.id}">
        <option value="">All events</option>
        <option value="P">✓ Present</option>
        <option value="A">✗ Absent</option>
        <option value="NA">NA</option>
      </select>
    </div>
  </div>
</td>
      ` +
      events.map(e => {
        const v = attForMember[e.id]; 
        let cls = 'off', aria = 'Absent';
        if (v === true) { cls = 'on'; aria = 'Present'; }
        else if (v === false) { cls = 'off'; aria = 'Absent'; }
        else if (v === 'NA') { cls = 'na'; aria = 'Not applicable'; }

        return `
          <td data-m="${m.id}" data-e="${e.id}">
            <button class="cell-btn ${cls}" aria-label="${aria}"></button>
          </td>`;
      }).join('');

    attBody.appendChild(tr);
  });

  countBadge.textContent = `${members.length} members · ${events.length} events`;
  renderAttendanceInsights();
}


attHead.addEventListener('click', (e) => {
  const delBtn = e.target.closest('button[data-del-event]');
  if (delBtn) {
    removeEvent(delBtn.dataset.delEvent);
    return; 
  }

  const editBtn = e.target.closest('button[data-edit-event]');
  if (editBtn) {
    const id = editBtn.dataset.editEvent;
    const ev = (EVENTS || []).find(x => x.id === id);
    if (!ev) return;

    document.getElementById('editEvId').value = id;
    document.getElementById('editEvName').value = ev.name || '';
    document.getElementById('editEvDate').value = (ev.date || '').slice(0, 10);
    document.getElementById('editEvDesc').value = ev.desc || '';

    const avenueCheckboxes = document.querySelectorAll('#editEventModal input[type="checkbox"]');
    avenueCheckboxes.forEach(cb => cb.checked = false);
    const eventAvenues = Array.isArray(ev.avenue) ? ev.avenue : (ev.avenue ? [ev.avenue] : []);
    eventAvenues.forEach(avenueValue => {
      const cb = document.querySelector(`#editEventModal input[value="${avenueValue}"]`);
      if (cb) cb.checked = true;
    });

    openModal('editEventModal');
  }
});

attBody.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('button[data-del-member]');
  if (delBtn) {
    removeMember(delBtn.dataset.delMember);
    return;
  }

  const editBtn = e.target.closest('button[data-edit-member]');
  if (editBtn) {
    const id = editBtn.dataset.editMember;
    const m  = (MEMBERS || []).find(x => x.id === id);
    if (!m) return;
    editMemId.value   = id;
    editMemName.value = m.name || '';
    openModal('editMemberModal');
    return;
  }

  const btn = e.target.closest('.cell-btn');
  if (!btn) return;

  const td = btn.closest('td');
  const memberId = td.dataset.m;
  const eventId  = td.dataset.e;
  const cur = (ATT[memberId] || {})[eventId]; 
  let next;
  if (cur === true) next = false;
  else if (cur === false) next = 'NA';
  else next = true;

  btn.classList.remove('on','off','na');
  if (next === true) { btn.classList.add('on');  btn.setAttribute('aria-label','Present'); }
  else if (next === false){ btn.classList.add('off'); btn.setAttribute('aria-label','Absent'); }
  else { btn.classList.add('na'); btn.setAttribute('aria-label','Not applicable'); }

  const ref = db.collection('attendance').doc(memberId);
  await ref.set({ [eventId]: next }, { merge: true });
  ATT[memberId] = ATT[memberId] || {};
  ATT[memberId][eventId] = next;
});
attHead.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-event]');
  if (!sel || !sel.value) return;

  const eventId = sel.dataset.bulkEvent;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all visible members as ${label} for this event?`)) {
    sel.value = '';
    return;
  }

  await bulkSetAttendanceForEvent(eventId, value);
  sel.value = '';
});
attBody.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-member]');
  if (!sel || !sel.value) return;

  const memberId = sel.dataset.bulkMember;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all visible events as ${label} for this member?`)) {
    sel.value = '';
    return;
  }

  await bulkSetAttendanceForMember(memberId, value);
  sel.value = '';
});


function exportAttendanceToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }
  const { members, events } = getFilteredMembersAndEvents();
  const header = ['Member \\ Event', ...events.map(e => {
    const d = (e.date||'').slice(0,10);
    return d ? `${e.name||''} (${d})` : (e.name||'');
  })];
  const rows = members.map(m => {
    const attForMember = ATT[m.id] || {};
    const cells = events.map(e => {
      const v = attForMember[e.id];        
      if (v === true)  return 'P';
      if (v === false) return 'A';
      if (v === 'NA')  return 'NA';
      return ''; 
    });
    return [m.name || '', ...cells];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `attendance_${dateTag}.xlsx`);
}
if (exportXlsxBtn) {
  exportXlsxBtn.addEventListener('click', exportAttendanceToExcel);
}


async function removeMember(memberId){
  const m = MEMBERS.find(x => x.id === memberId);
  if (!confirm(`Delete member "${m?.name || memberId}"? This also deletes their attendance.`)) return;
  try{
    await db.collection('members').doc(memberId).delete();
    await db.collection('attendance').doc(memberId).delete();
  }catch(err){
    alert('Failed to delete member: ' + err.message);
  }
}

async function removeEvent(eventId){
  const ev = EVENTS.find(x => x.id === eventId);
  if (!confirm(`Delete event "${ev?.name || eventId}"? This removes it from all attendance records.`)) return;
  try{
    await db.collection('events').doc(eventId).delete();
    const snap = await db.collection('attendance').get();
    const batch = db.batch();
    snap.forEach(doc => batch.update(doc.ref, { [eventId]: firebase.firestore.FieldValue.delete() }));
    await batch.commit();
  }catch(err){
    alert('Failed to delete event: ' + err.message);
  }
}

[memberSearch, eventSearch, monthFilter, avenueFilter].forEach(el => {
  if (el) el.addEventListener('input', renderGrid);
});

if (editMemberForm) {
  editMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = editMemId.value;
    const name = (editMemName.value || '').trim();
    if (!id || !name) return;
    try {
      await db.collection('members').doc(id).update({ name });
      closeModal('editMemberModal');
    } catch (err) { alert('Failed to save member: ' + err.message); }
  });
}

if (editEventForm) {
  editEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = document.getElementById('editEvId').value;
    const name = (document.getElementById('editEvName').value || '').trim();
    const date = document.getElementById('editEvDate').value;
    const endDate  = document.getElementById('editEvEndDate').value || '';
    const desc = (document.getElementById('editEvDesc').value || '').trim();
    const avenues = Array.from(document.querySelectorAll('#editEventModal input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    if (!id || !name || !date) return;
    try {
      await db.collection('events').doc(id).update({ name, date, endDate, desc, avenue: avenues });
      closeModal('editEventModal');
    } catch (err) { alert('Failed to save event: ' + err.message); }
  });
}



if (addMemberForm) {
  addMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (addMemName?.value || '').trim();
    if (!name) return;
    await db.collection('members').add({ name });
    closeModal('addMemberModal');
  });
}

if (addEventForm) {
  addEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (addEvName?.value || '').trim();
    const date = addEvDate?.value || '';
    const endDate   = addEvEndDate?.value || '';
    const desc = (addEvDesc?.value || '').trim();
    const avenues = Array.from(addEventForm.querySelectorAll('fieldset input[type="checkbox"]:checked'))
      .map(c => c.value);
    if (!name || !date) return;
    await db.collection('events').add({ name, date, endDate, desc, avenue: avenues });
    closeModal('addEventModal');
  });
}





/**
 * District event attendance data loading, grid interactions, and export.
 */

function buildDistMonthFilterFromEvents() {
  if (!distMonthFilter) return;

  distMonthFilter.innerHTML = '<option value="">All months</option>';

  Array.from(new Set(DIST_EVENTS.map(e => (e.date || '').slice(0, 7))))
    .filter(Boolean)
    .sort()
    .forEach(ym => {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m - 1, 1);

      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      distMonthFilter.appendChild(opt);
    });
}

async function loadDistrictData() {
  const [deSnap, daSnap] = await Promise.all([
    db.collection('districtEvents').orderBy('date', 'desc').get(),
    db.collection('districtAttendance').get()
  ]);

  DIST_EVENTS = deSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(ev => ev.archived !== true);

  DIST_ATT = {};
  daSnap.forEach(d => {
    DIST_ATT[d.id] = d.data() || {};
  });

  buildDistMonthFilterFromEvents();
  renderDistrictGrid();
}


function renderDistrictGrid() {
  if (!distHead || !distBody) return;

  const memQuery = (distMemberSearch?.value || '').trim().toLowerCase();
  const evQuery  = (distEventSearch?.value || '').trim().toLowerCase();
  const monthSel = distMonthFilter?.value || '';

  const members = MEMBERS.filter(m =>
    (m.name || '').toLowerCase().includes(memQuery)
  );

  let events = DIST_EVENTS.filter(e =>
    (e.name || '').toLowerCase().includes(evQuery)
  );

  if (monthSel) {
    events = events.filter(e => (e.date || '').startsWith(monthSel));
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML =
    `<th class="sticky-col">Member \\ District Event</th>` +
    events.map(e => `
      <th title="${e.date || ''}">
        <div class="bulk-wrap">
          <div class="ev-head">
            <span>${e.name || ''}</span>
            <button class="icon-btn" title="Edit district event" data-edit-dist-event="${e.id}">Edit</button>
            <button class="icon-btn" title="Delete district event" data-del-dist-event="${e.id}">🗑</button>
          </div>
          <small>
            ${(e.date || '').slice(0,10)}
            ${e.endDate ? ` → ${e.endDate.slice(0,10)}` : ''}
          </small>
        </div>
      </th>
    `).join('');

  distHead.innerHTML = '';
  distHead.appendChild(headRow);

  distBody.innerHTML = '';

  members.forEach(m => {
    const attForMember = DIST_ATT[m.id] || {};

    const values = events.map(e => attForMember[e.id]);
    const considered = values.filter(v => v !== 'NA');
    const total = considered.length;
    const present = considered.filter(v => v === true).length;
    const pct = total ? Math.round((present / total) * 100) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML =
      `
      <td class="sticky-col">
        <div class="mem-left">
          <div class="stat-box" title="Across visible district events">
            <span class="stat">All: ${present}/${total} · ${pct}%</span>
          </div>
          <div class="mem-cell">
            <span>${m.name || ''}</span>
          </div>
        </div>
      </td>
      ` +
      events.map(e => {
        const v = attForMember[e.id];
        let cls = 'off';
        let aria = 'Absent';

        if (v === true) {
          cls = 'on';
          aria = 'Present';
        } else if (v === 'NA') {
          cls = 'na';
          aria = 'Not applicable';
        }

        return `
          <td data-dist-m="${m.id}" data-dist-e="${e.id}">
            <button class="cell-btn ${cls}" aria-label="${aria}"></button>
          </td>
        `;
      }).join('');

    distBody.appendChild(tr);
  });

  if (distCountBadge) {
    distCountBadge.textContent = `${members.length} Members · ${events.length} district events`;
  }

  renderDistrictInsights(members, events);
}
function renderDistrictInsights(members, events) {
  if (distEvtCount) distEvtCount.textContent = events.length || '0';

  let totalSlots = 0;
  let totalPresent = 0;

  const perEventPresent = events.map(ev => {
    let present = 0;
    let considered = 0;

    members.forEach(m => {
      const v = (DIST_ATT[m.id] || {})[ev.id];
      if (v !== 'NA') {
        considered++;
        if (v === true) present++;
      }
    });

    totalSlots += considered;
    totalPresent += present;
    return present;
  });

  const avg = totalSlots ? Math.round((totalPresent / totalSlots) * 100) : 0;
  if (distAvg) distAvg.textContent = `${avg}%`;

  const topMembers = members.map(m => {
    let c = 0;
    events.forEach(ev => {
      if ((DIST_ATT[m.id] || {})[ev.id] === true) c++;
    });
    return { name: m.name || '', c };
  })
  .sort((a, b) => b.c - a.c)
  .slice(0, 3);

  if (distTop) {
    distTop.textContent = topMembers.length
      ? topMembers.map(x => `${x.name.split(' ')[0]}(${x.c})`).join(', ')
      : '–';
  }

  const ctx = document.getElementById('distChart');
  drawChart('dist', ctx, {
    type: 'bar',
    data: {
      labels: events.map(e => e.name || ''),
      datasets: [{
        label: 'Present',
        data: perEventPresent
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
if (distBody) {
  distBody.addEventListener('click', async (e) => {
    const td = e.target.closest('td[data-dist-m][data-dist-e]');
    if (!td) return;

    const memberId = td.dataset.distM;
    const eventId  = td.dataset.distE;

    const current = (DIST_ATT[memberId] || {})[eventId];
    const next = current === true ? false : current === false ? 'NA' : true;

    try {
      await db.collection('districtAttendance').doc(memberId).set(
        { [eventId]: next },
        { merge: true }
      );

      DIST_ATT[memberId] = DIST_ATT[memberId] || {};
      DIST_ATT[memberId][eventId] = next;

      renderDistrictGrid();
    } catch (err) {
      alert('Failed to update district attendance: ' + err.message);
    }
  });
}
if (addDistEventForm) {
  addDistEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (addDistEvName?.value || '').trim();
    const date = addDistEvDate?.value || '';
    const endDate = addDistEvEndDate?.value || '';
    const desc = (addDistEvDesc?.value || '').trim();

    if (!name || !date) {
      alert('Please enter district event name and start date.');
      return;
    }

    try {
      await callableFunction('createDistrictEventSynced')({
        name,
        date,
        endDate: endDate || '',
        desc: desc || '',
        visibility: addDistEvPublic?.checked ? 'public' : 'internal',
        showOnHomepage: !!addDistEvPublic?.checked
      });

      closeModal('addDistEventModal');
    } catch (err) {
      alert('Failed to add district event: ' + err.message);
    }
  });
}
if (exportDistXlsxBtn) {
  exportDistXlsxBtn.addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
      alert('Excel export library not loaded.');
      return;
    }

    const members = MEMBERS.filter(m =>
      (m.name || '').toLowerCase().includes((distMemberSearch?.value || '').trim().toLowerCase())
    );

    let events = DIST_EVENTS.filter(e =>
      (e.name || '').toLowerCase().includes((distEventSearch?.value || '').trim().toLowerCase())
    );

    const monthSel = distMonthFilter?.value || '';
    if (monthSel) {
      events = events.filter(e => (e.date || '').startsWith(monthSel));
    }

    const rows = members.map(m => {
      const row = { Member: m.name || '' };

      events.forEach(ev => {
        const v = (DIST_ATT[m.id] || {})[ev.id];
        row[ev.name || ev.id] = v === true ? 'Present' : v === false ? 'Absent' : 'NA';
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'District Attendance');
    XLSX.writeFile(wb, 'district_attendance.xlsx');
  });
}



document.addEventListener('click', async (e) => {
  const editDistEventBtn = e.target.closest('button[data-edit-dist-event]');
  if (editDistEventBtn) {
    const id = editDistEventBtn.dataset.editDistEvent;
    const ev = DIST_EVENTS.find(x => x.id === id);
    if (!ev) return;
    if (editDistEvId) editDistEvId.value = id;
    if (editDistEvName) editDistEvName.value = ev.name || '';
    if (editDistEvDate) editDistEvDate.value = (ev.date || '').slice(0, 10);
    if (editDistEvEndDate) editDistEvEndDate.value = (ev.endDate || ev.date || '').slice(0, 10);
    if (editDistEvDesc) editDistEvDesc.value = ev.desc || '';
    if (editDistEvPublic) editDistEvPublic.checked = String(ev.visibility || 'internal').toLowerCase() === 'public';
    openModal('editDistEventModal');
    return;
  }

  const delDistEventBtn = e.target.closest('button[data-del-dist-event]');
  if (!delDistEventBtn) return;

  const id = delDistEventBtn.dataset.delDistEvent;
  const ev = DIST_EVENTS.find(x => x.id === id);
  if (!confirm(`Archive district event "${ev?.name || id}"? District attendance values will be preserved.`)) return;

  try {
    await callableFunction('archiveDistrictEventSynced')({ districtEventId: id });
  } catch (err) {
    alert('Failed to archive district event: ' + err.message);
  }
});

if (editDistEventForm) {
  editDistEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const districtEventId = editDistEvId?.value || '';
    const name = (editDistEvName?.value || '').trim();
    const date = editDistEvDate?.value || '';
    const endDate = editDistEvEndDate?.value || '';
    const desc = (editDistEvDesc?.value || '').trim();

    if (!districtEventId || !name || !date) {
      alert('Please enter district event name and start date.');
      return;
    }

    try {
      await callableFunction('updateDistrictEventSynced')({
        districtEventId,
        name,
        date,
        endDate: endDate || '',
        desc,
        visibility: editDistEvPublic?.checked ? 'public' : 'internal',
        showOnHomepage: !!editDistEvPublic?.checked
      });
      closeModal('editDistEventModal');
    } catch (err) {
      alert('Failed to save district event: ' + err.message);
    }
  });
}

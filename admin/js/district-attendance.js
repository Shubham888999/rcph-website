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

  DIST_EVENTS = deSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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
    distCountBadge.textContent = `${members.length} members · ${events.length} district events`;
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
      await db.collection('districtEvents').add({
        name,
        date,
        endDate: endDate || '',
        desc: desc || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.uid || null
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
  const delDistEventBtn = e.target.closest('button[data-del-dist-event]');
  if (!delDistEventBtn) return;

  const id = delDistEventBtn.dataset.delDistEvent;
  const ev = DIST_EVENTS.find(x => x.id === id);
  if (!confirm(`Delete district event "${ev?.name || id}"?`)) return;

  try {
    await db.collection('districtEvents').doc(id).delete();
  } catch (err) {
    alert('Failed to delete district event: ' + err.message);
  }
});

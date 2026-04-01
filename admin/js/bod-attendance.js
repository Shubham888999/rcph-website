/**
 * BOD attendance, mail actions, edits, and exports.
 */

async function bulkSetBodForMeeting(meetingId, value) {
  if (!BODM.length) return;

  const batch = db.batch();

  BODM.forEach(m => {
    const ref = db.collection('bodAttendance').doc(m.id);
    batch.set(ref, { [meetingId]: value }, { merge: true });
    BODATT[m.id] = BODATT[m.id] || {};
    BODATT[m.id][meetingId] = value;
  });

  await batch.commit();
  renderBodGrid();
}

async function bulkSetBodForMember(memberId, value) {
  if (!BODMEET.length) return;

  const payload = {};
  BODMEET.forEach(mt => {
    payload[mt.id] = value;
  });

  await db.collection('bodAttendance').doc(memberId).set(payload, { merge: true });

  BODATT[memberId] = BODATT[memberId] || {};
  BODMEET.forEach(mt => {
    BODATT[memberId][mt.id] = value;
  });

  renderBodGrid();
}


function renderBodGrid(){
  if (!bodHead || !bodBody) return;

  const headRow = document.createElement('tr');
  headRow.innerHTML =
    `<th class="sticky-col">BOD \\ Meeting<br><small>Position</small></th>` +
    BODMEET.map(mt => `
<th title="${mt.date || ''}">
  <div class="bulk-wrap">
    <div class="ev-head">
      <span>${mt.name || ''}</span>
      <button class="icon-btn" title="Rename meeting" data-edit-bod-meeting="${mt.id}">✏️</button>
      <button class="icon-btn" title="Delete meeting" data-del-bod-meeting="${mt.id}">🗑</button>
    </div>

    <small>${(mt.date || '').slice(0,10)}</small>

    <select class="bulk-select" data-bulk-bod-meeting="${mt.id}">
      <option value="">All attendance</option>
      <option value="P">✓ Present</option>
      <option value="A">✗ Absent</option>
      <option value="NA">NA</option>
    </select>
  </div>
</th>
    `).join('');
  bodHead.innerHTML = '';
  bodHead.appendChild(headRow);

  bodBody.innerHTML = '';
  const total = BODMEET.length;

  BODM.forEach(m => {
    const tr = document.createElement('tr');
    const att = BODATT[m.id] || {};

    let present = 0, considered = 0;
    BODMEET.forEach(mt => {
      const v = att[mt.id];
      if (v !== 'NA') { considered++; if (v === true) present++; }
    });
    const pct = considered ? Math.round((present / considered) * 100) : 0;

    tr.innerHTML =
      `
<td class="sticky-col">
  <div class="mem-left">
    <div class="stat-box" title="Across visible BOD meetings">
      <span class="stat">All: ${present}/${total} · ${pct}%</span>
    </div>

    <div class="bulk-wrap" style="align-items:flex-start;">
      <div class="mem-cell">
        <span>${m.name || ''}</span>
        <small style="opacity:.7; display:block">${m.position || ''}</small>
        <button class="icon-btn" title="Edit name/position" data-edit-bod-member="${m.id}">✏️</button>
        <button class="icon-btn" title="Remove BOD" data-del-bod-member="${m.id}">🗑</button>
      </div>

      <select class="bulk-select" data-bulk-bod-member="${m.id}">
        <option value="">All meetings</option>
        <option value="P">✓ Present</option>
        <option value="A">✗ Absent</option>
        <option value="NA">NA</option>
      </select>
    </div>
  </div>
</td>
      ` +
      BODMEET.map(mt => {
        const v = att[mt.id]; 
        let cls = 'off', aria = 'Absent';
        if (v === true) { cls = 'on'; aria = 'Present'; }
        else if (v === false) { cls = 'off'; aria = 'Absent'; }
        else if (v === 'NA') { cls = 'na'; aria = 'Not applicable'; }

        return `
          <td data-bod-m="${m.id}" data-bod-meet="${mt.id}">
            <button class="cell-btn ${cls}" aria-label="${aria}"></button>
          </td>`;
      }).join('');

    bodBody.appendChild(tr);
  });

  if (bodCountBadge) bodCountBadge.textContent = `${BODM.length} BOD · ${BODMEET.length} meetings`;
  renderBodInsights();
}

function renderBodInsights(){
  document.getElementById('bodMeetCount').textContent = BODMEET.length || '0';
  let totalSlots = 0, totalPresent = 0;
  const perMeetingPresent = BODMEET.map(mt => {
    let c = 0, considered = 0;
    BODM.forEach(m => {
      const v = (BODATT[m.id] || {})[mt.id];
      if (v !== 'NA') { considered++; if (v === true) c++; }
    });
    totalSlots += considered;
    totalPresent += c;
    return c;
  });
  const avg = totalSlots ? Math.round((totalPresent/totalSlots)*100) : 0;
  document.getElementById('bodAvg').textContent = `${avg}%`;

  const ctx = document.getElementById('bodChart');
  drawChart('bod', ctx, {
    type:'bar',
    data:{ labels: BODMEET.map(mt=>mt.name||''), datasets:[{label:'Present', data:perMeetingPresent}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}

if (bodAddMemberBtn) {
  bodAddMemberBtn.addEventListener('click', async () => {
    const name = (bodMemName?.value || '').trim();
    const position = (bodMemPos?.value || '').trim();
    if (!name) return;
    try {
      await db.collection('bodMembers').add({ name, position });
      if (bodMemName) bodMemName.value = '';
      if (bodMemPos)  bodMemPos.value  = '';
    } catch (err) { alert('Failed to add BOD: ' + err.message); }
  });
}
if (bodAddMeetingBtn) {
  bodAddMeetingBtn.addEventListener('click', async () => {
    const name = (bodMeetName?.value || '').trim();
    const date = (bodMeetDate?.value || '');
    if (!name || !date) return;
    try {
      await db.collection('bodMeetings').add({ name, date });
      if (bodMeetName) bodMeetName.value = '';
    } catch (err) { alert('Failed to add meeting: ' + err.message); }
  });
}

document.addEventListener('click', async (e) => {
  const delBodMem = e.target.closest('button[data-del-bod-member]');
  if (delBodMem) {
    const id = delBodMem.dataset.delBodMember;
    const m  = BODM.find(x => x.id === id);
    if (!confirm(`Remove BOD "${m?.name || id}"? This also deletes their BOD attendance.`)) return;
    try {
      await db.collection('bodMembers').doc(id).delete();
      await db.collection('bodAttendance').doc(id).delete();
    } catch (err) { alert('Failed to remove BOD: ' + err.message); }
    return;
  }

  const delBodMeet = e.target.closest('button[data-del-bod-meeting]');
  if (delBodMeet) {
    const id = delBodMeet.dataset.delBodMeeting;
    const mt = BODMEET.find(x => x.id === id);
    if (!confirm(`Delete meeting "${mt?.name || id}"? This removes it from all BOD attendance.`)) return;
    try {
      await db.collection('bodMeetings').doc(id).delete();
      const snap = await db.collection('bodAttendance').get();
      const batch = db.batch();
      snap.forEach(doc => batch.update(doc.ref, { [id]: firebase.firestore.FieldValue.delete() }));
      await batch.commit();
    } catch (err) { alert('Failed to delete meeting: ' + err.message); }
    return;
  }

  const ebmBtn = e.target.closest('button[data-edit-bod-member]');
  if (ebmBtn) {
    const id = ebmBtn.dataset.editBodMember;
    const m  = (BODM || []).find(x => x.id === id);
    if (!m) return;
    editBodMemId.value   = id;
    editBodMemName.value = m.name || '';
    editBodMemPos.value  = m.position || '';
    openModal('editBodMemberModal');
    return;
  }

  const ebmtBtn = e.target.closest('button[data-edit-bod-meeting]');
  if (ebmtBtn) {
    const id = ebmtBtn.dataset.editBodMeeting;
    const mt = (BODMEET || []).find(x => x.id === id);
    if (!mt) return;
    editBodMeetId.value   = id;
    editBodMeetName.value = mt.name || '';
    editBodMeetDate.value = (mt.date || '').slice(0,10);
    openModal('editBodMeetingModal');
    return;
  }

  const btn = e.target.closest('td[data-bod-m][data-bod-meet] .cell-btn');
  if (btn) {
    const td = btn.closest('td');
    const bodMemberId = td.dataset.bodM;
    const meetingId   = td.dataset.bodMeet;
    const cur = ((BODATT[bodMemberId] || {})[meetingId]); 
    let next;
    if (cur === true) next = false;
    else if (cur === false) next = 'NA';
    else next = true;

    btn.classList.remove('on','off','na');
    if (next === true) { btn.classList.add('on');  btn.setAttribute('aria-label','Present'); }
    else if (next === false){ btn.classList.add('off'); btn.setAttribute('aria-label','Absent'); }
    else { btn.classList.add('na'); btn.setAttribute('aria-label','Not applicable'); }

    const ref = db.collection('bodAttendance').doc(bodMemberId);
    await ref.set({ [meetingId]: next }, { merge: true });
    BODATT[bodMemberId] = BODATT[bodMemberId] || {};
    BODATT[bodMemberId][meetingId] = next;
  }
  bodHead.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-bod-meeting]');
  if (!sel || !sel.value) return;

  const meetingId = sel.dataset.bulkBodMeeting;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all BOD members as ${label} for this meeting?`)) {
    sel.value = '';
    return;
  }

  await bulkSetBodForMeeting(meetingId, value);
  sel.value = '';
});

bodBody.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-bulk-bod-member]');
  if (!sel || !sel.value) return;

  const memberId = sel.dataset.bulkBodMember;
  const value = sel.value === 'P' ? true : sel.value === 'A' ? false : 'NA';

  const label = value === true ? 'Present' : value === false ? 'Absent' : 'NA';
  if (!confirm(`Mark all meetings as ${label} for this BOD member?`)) {
    sel.value = '';
    return;
  }

  await bulkSetBodForMember(memberId, value);
  sel.value = '';
});
});



function buildWarningTemplate() {
  return `Dear Rtr. [Name],

Greetings from the desk of President and Sergeant At Arms,

This is to formally inform you that you have been absent for three consecutive meetings of the Rotaract Club of Pune Heritage.

As per the club bylaws under:
“Article X – Termination”
a member/BOD who is not present for three consecutive General Body Meetings (GBMs) is liable to receive a formal warning from the President and Sergeant-at-Arms.

This email serves as your official warning notice.

We request you to take this matter seriously and ensure your regular attendance in upcoming meetings. Consistent absence may lead to further action as per the club bylaws, including possible termination from your position.

We value your presence and contributions to the club and hope to see active participation from your end moving forward.

If you have any valid reasons or concerns, feel free to communicate with us.

Regards,  
Rtr. Aneesh Ladkat  
President | RIY 2025–26  
Rotaract Club of Pune Heritage  

Rtr. Riya Chandavale  
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26  
Rotaract Club of Pune Heritage`;
}

function buildTerminationTemplate() {
  return `Dear Rtr. [Name],
Greetings from the desk of President and Sergeant At Arms,
This is to formally inform you that your termination from the position of [Postion Name], effective [Date], has been issued.
This decision has been taken in accordance with the club bylaws under:
“ANNEXURE B – BOD Termination”
Please note that this termination is only from the Board position and does not affect your membership as a
General Body Member of the Rotaract Club of Pune Heritage. You will continue to remain a valued part of
the club as a member.
Please find the official termination letter attached with this email for your reference and necessary action.
You are requested to ensure that all pending handovers (files, data, access, and reports) are completed with the
concerned authority before the effective date.
We truly appreciate your contributions so far, and we would like to assure you that the club will always remain supportive
and available for you whenever needed.
Regards,
Rtr. Aneesh Ladkat
President | RIY 2025–26
Rotaract Club of Pune Heritage
Rtr. Riya Chandavale
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26
Rotaract Club of Pune Heritage`;
}
function buildGbmWarningTemplate() {
  return `Dear Rtr. [Name],

Greetings from the desk of President and Sergeant At Arms,

This is to formally inform you that you have been absent for three consecutive meetings of the Rotaract Club of Pune Heritage.

As per the club bylaws under:
“Article X – Termination”
a member/BOD who is not present for three consecutive General Body Meetings (GBMs) is liable to receive a formal warning from the President and Sergeant-at-Arms.

This email serves as your official warning notice.

We request you to take this matter seriously and ensure your regular attendance in upcoming meetings. Consistent absence may lead to further action as per the club bylaws, including possible termination from your position.

We value your presence and contributions to the club and hope to see active participation from your end moving forward.

If you have any valid reasons or concerns, feel free to communicate with us.

Regards,  
Rtr. Aneesh Ladkat  
President | RIY 2025–26  
Rotaract Club of Pune Heritage  

Rtr. Riya Chandavale  
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26  
Rotaract Club of Pune Heritage`;
}

function buildGbmTerminationTemplate() {
  return `Dear Rtr. [Name],
Greetings from the desk of President and Sergeant At Arms,
This is to formally inform you that your termination as a General Body Member, effective [Date], has been issued.
This decision has been taken in accordance with the club bylaws under:
“Article X – Termination”
which states that if a member remains absent for three consecutive General Body Meetings (GBMs) and continues to remain inactive for a period exceeding 45 days, they shall be liable for termination from the club membership.
Despite prior communication and a formal warning issued from the President and Sergeant-at-Arms, there has been no sufficient improvement in attendance/participation.

Please note that with this termination, you will no longer hold membership in the Rotaract Club of Pune Heritage.

We request you to complete any pending formalities, if applicable, and return any club-related materials or responsibilities.

We sincerely appreciate your association with the club and wish you the very best in your future endeavors.
Regards,
Rtr. Aneesh Ladkat
President | RIY 2025–26
Rotaract Club of Pune Heritage
Rtr. Riya Chandavale
Sergeant-at-Arms & Public Relations Officer | RIY 2025–26
Rotaract Club of Pune Heritage`;
}
function setMailMenuOpen(isOpen) {
  if (!sendMailMenu) return;
  sendMailMenu.hidden = !isOpen;
}

function openBodMailModal(type) {
  const isWarning = type === 'warning';

  if (mailModalTitle) {
    mailModalTitle.textContent = isWarning ? 'Send Warning Mail' : 'Send Termination Mail';
  }

  if (mailTypeChip) {
    mailTypeChip.textContent = isWarning ? 'Warning' : 'Termination';
  }

  if (mailTargetChip) {
    mailTargetChip.textContent = 'Manual recipient';
  }

  if (mailFrom) mailFrom.value = '';
  if (mailTo) mailTo.value = '';
  if (mailSubject) {
    mailSubject.value = isWarning
      ? 'Attendance Warning Notice'
      : 'Termination of Position – [Postion Name] | RIY 25-26';
  }

  if (mailBody) {
    mailBody.value = isWarning
      ? buildWarningTemplate()
      : buildTerminationTemplate();
  }

  openModal('mailModal');
}
function openGbmMailModal(type) {
  const isWarning = type === 'warning';

  if (mailModalTitle) {
    mailModalTitle.textContent = isWarning ? 'Send GBM Warning Mail' : 'Send GBM Termination Mail';
  }

  if (mailTypeChip) {
    mailTypeChip.textContent = isWarning ? 'GBM Warning' : 'GBM Termination';
  }

  if (mailTargetChip) {
    mailTargetChip.textContent = 'Manual recipient';
  }

  if (mailFrom) mailFrom.value = '';
  if (mailTo) mailTo.value = '';
  if (mailSubject) {
    mailSubject.value = isWarning
      ? 'GBM Attendance Warning Notice'
      : 'GBM Attendance Termination Notice';
  }

  if (mailBody) {
    mailBody.value = isWarning
      ? buildGbmWarningTemplate()
      : buildGbmTerminationTemplate();
  }

  openModal('mailModal');
}
if (sendMailBtn && sendMailMenu) {
  sendMailBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const shouldOpen = sendMailMenu.hidden;
    setMailMenuOpen(shouldOpen);
  });

  sendMailMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    const clickedInsideMenu = e.target.closest('.mail-menu');
    if (!clickedInsideMenu) {
      setMailMenuOpen(false);
    }
  });
}

if (sendWarningBtn) {
  sendWarningBtn.addEventListener('click', () => {
    setMailMenuOpen(false);
    openBodMailModal('warning');
  });
}

if (sendTerminationBtn) {
  sendTerminationBtn.addEventListener('click', () => {
    setMailMenuOpen(false);
    openBodMailModal('termination');
  });
}
if (sendGbmMailBtn && sendGbmMailMenu) {
  sendGbmMailBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const shouldOpen = sendGbmMailMenu.hidden;
    sendGbmMailMenu.hidden = !shouldOpen;

    if (sendMailMenu) sendMailMenu.hidden = true;
  });

  sendGbmMailMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    const clickedInsideGbmMenu = e.target.closest('#sendGbmMailBtn, #sendGbmMailMenu');
    if (!clickedInsideGbmMenu) {
      sendGbmMailMenu.hidden = true;
    }
  });
}

if (sendGbmWarningBtn) {
  sendGbmWarningBtn.addEventListener('click', () => {
    if (sendGbmMailMenu) sendGbmMailMenu.hidden = true;
    openGbmMailModal('warning');
  });
}

if (sendGbmTerminationBtn) {
  sendGbmTerminationBtn.addEventListener('click', () => {
    if (sendGbmMailMenu) sendGbmMailMenu.hidden = true;
    openGbmMailModal('termination');
  });
}
if (mailForm) {
  mailForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const to = (mailTo?.value || '').trim();
    const from = (mailFrom?.value || '').trim();
    const subject = (mailSubject?.value || '').trim();
    const body = (mailBody?.value || '').trim();

    if (!to || !subject || !body) {
      alert('Please fill To, Subject, and Message before opening the draft.');
      return;
    }

    const mailtoUrl = buildMailtoUrl({ to, subject, body, from });
    window.location.href = mailtoUrl;
    closeModal('mailModal');
  });
}


function exportBodAttendanceToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }
  const header = [
    'BOD (Name / Position)',
    ...BODMEET.map(mt => {
      const d = (mt.date || '').slice(0,10);
      return d ? `${mt.name || ''} (${d})` : (mt.name || '');
    })
  ];
  const rows = BODM.map(m => {
    const att = BODATT[m.id] || {};
    const cells = BODMEET.map(mt => {
      const v = att[mt.id];
      if (v === true)  return 'P';
      if (v === false) return 'A';
      if (v === 'NA')  return 'NA';
      return '';
    });
    const namePos = `${m.name || ''}${m.position ? ' — ' + m.position : ''}`;
    return [namePos, ...cells];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOD Attendance');
  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `bod_attendance_${dateTag}.xlsx`);
}
if (exportBodXlsxBtn) {
  exportBodXlsxBtn.addEventListener('click', exportBodAttendanceToExcel);
}


if (editBodMemberForm) {
  editBodMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = editBodMemId.value;
    const name = (editBodMemName.value || '').trim();
    const pos  = (editBodMemPos.value || '').trim();
    if (!id || !name) return;
    try {
      await db.collection('bodMembers').doc(id).update({ name, position: pos });
      closeModal('editBodMemberModal');
    } catch (err) { alert('Failed to save BOD member: ' + err.message); }
  });
}

if (editBodMeetingForm) {
  editBodMeetingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = editBodMeetId.value;
    const name = (editBodMeetName.value || '').trim();
    const date = editBodMeetDate.value || '';
    if (!id || !name || !date) return;
    try {
      await db.collection('bodMeetings').doc(id).update({ name, date });
      closeModal('editBodMeetingModal');
    } catch (err) { alert('Failed to save meeting: ' + err.message); }
  });
}



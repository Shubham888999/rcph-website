/**
 * Treasurer panel filters, rendering, Drive upload preparation, and exports.
 */

const TREASURY_GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz243r-jI2vXMVxnIVLPrEJN6Sc9PARxR7-YM-k5FAuHC9nVWT0vvxzXtSMMI-xpnJcsQ/exec";
const TREASURY_GAS_PLACEHOLDER = "PASTE_TREASURY_APPS_SCRIPT_URL_HERE";
const TREASURY_DRIVE_ROOT_FOLDER = "RCPH Treasury Bills";
const TREASURY_ROTARY_YEAR_FOLDER = "RY 2025-26";
const TREASURY_CLUB_NAME = "Rotaract Club of Pune Heritage";

function treasuryText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function treasuryTitle(t) {
  return treasuryText(t?.title || t?.name, '');
}

function treasuryPurpose(t) {
  return treasuryText(t?.purpose || t?.linkedEventName);
}

function treasuryReference(t) {
  return treasuryText(t?.referenceNumber || t?.cheque, '');
}

function treasuryReimbursement(t) {
  return treasuryText(t?.reimbursementStatus || t?.reimburse);
}

function treasuryType(t) {
  return String(t?.type || '').toLowerCase();
}

function treasuryTypeLabel(type) {
  return String(type || '').toLowerCase() === 'income' ? 'Income' : 'Expense';
}

function setTreasuryStatus(el, message = '', tone = '') {
  if (!el) return;
  el.textContent = message;
  el.className = `treasury-upload-status${tone ? ` is-${tone}` : ''}`;
}

function isTreasuryGasConfigured() {
  const url = String(TREASURY_GAS_WEB_APP_URL || '').trim();
  return !!url && url !== TREASURY_GAS_PLACEHOLDER && /^https:\/\/script\.google\.com\/macros\/s\//.test(url);
}

function getFilteredTreasury() {
  const typeVal = treFilterType?.value || '';
  const monthVal = treFilterMonth?.value || '';
  const avenueVal = treFilterAvenue?.value || '';

  return TREAS.filter(t => {
    if (typeVal && treasuryType(t) !== typeVal) return false;

    if (monthVal && (t.date || '').slice(0, 7) !== monthVal) return false;

    if (avenueVal) {
      const av = String(t.avenue || '').trim();
      if (avenueVal === 'Other') {
        if (av && av !== 'No Avenue' && av !== 'Other') return false;
      } else if (av !== avenueVal) {
        return false;
      }
    }
    return true;
  });
}

function buildTreasuryMonthFilter() {
  if (!treFilterMonth) return;

  const existingVal = treFilterMonth.value;
  treFilterMonth.innerHTML = '<option value="">All Months</option>';

  const months = new Set(TREAS.map(t => (t.date || '').slice(0, 7)));
  Array.from(months).filter(Boolean).sort().reverse().forEach(ym => {
    const [y, m] = ym.split('-');
    const dateObj = new Date(y, m - 1, 1);
    const label = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = label;
    treFilterMonth.appendChild(opt);
  });

  if (existingVal) treFilterMonth.value = existingVal;
}

function billButtonHtml(t) {
  const billUrl = treasuryText(t.billUrl, '');
  if (!billUrl) return '-';

  const thumbUrl = getGdriveImageUrl(billUrl);
  const label = treasuryText(t.billFileName, 'Bill');
  return `
    <button type="button" class="treasury-bill-thumb" data-show-bill="${escapeHtml(billUrl)}" title="Open bill">
      <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(label)}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';">
      <span style="display:none;">Bill link</span>
    </button>
  `;
}

function renderTreasurer() {
  if (!treBody) return;

  const data = getFilteredTreasury();
  let inc = 0;
  let exp = 0;

  treBody.innerHTML = data.map(t => {
    const amt = Number(t.amount || 0);
    const type = treasuryType(t);
    if (type === 'income') inc += amt;
    else if (type === 'expense') exp += amt;

    return `
      <tr>
        <td class="treasury-title-cell">${escapeHtml(treasuryTitle(t))}</td>
        <td>${escapeHtml(treasuryTypeLabel(type))}</td>
        <td>INR ${amt.toLocaleString('en-IN')}</td>
        <td>${escapeHtml(treasuryText(t.avenue))}</td>
        <td>${escapeHtml((t.date || '').slice(0, 10) || '-')}</td>
        <td class="treasury-compact-cell">${escapeHtml(treasuryPurpose(t))}</td>
        <td class="treasury-compact-cell">${escapeHtml(treasuryText(t.paidBy))}</td>
        <td class="treasury-compact-cell">${escapeHtml(treasuryText(t.paidTo))}</td>
        <td>${escapeHtml(treasuryText(t.paymentMode))}</td>
        <td>${escapeHtml(treasuryReimbursement(t))}</td>
        <td class="treasury-bill-cell">${billButtonHtml(t)}</td>
        <td>
          <button class="icon-btn" data-edit-tre="${escapeHtml(t.id)}" title="Edit entry">Edit</button>
          <button class="icon-btn" data-del-tre="${escapeHtml(t.id)}" title="Delete entry">Del</button>
        </td>
      </tr>
    `;
  }).join('');

  const net = inc - exp;
  if (treBadge) {
    treBadge.textContent = `${data.length} records | Net INR ${net.toLocaleString('en-IN')}`;
  }

  renderTreasurerInsights(data);
}

window.showBill = (url) => {
  if (!billLightboxImg || !url) return;
  billLightboxImg.src = getGdriveImageUrl(url);
  openModal("billLightbox");
};

function renderTreasurerInsights(data) {
  let inc = 0;
  let exp = 0;
  (data || []).forEach(t => {
    const a = Number(t.amount || 0);
    if (treasuryType(t) === 'income') inc += a;
    else if (treasuryType(t) === 'expense') exp += a;
  });
  const net = inc - exp;

  document.getElementById('treInc').textContent = `INR ${fmt(inc)}`;
  document.getElementById('treExp').textContent = `INR ${fmt(exp)}`;
  document.getElementById('treNet').textContent = `INR ${fmt(net)}`;

  const rows = [...(data || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let running = 0;
  const labels = [];
  const chartData = [];
  rows.forEach(r => {
    const a = Number(r.amount || 0);
    running += treasuryType(r) === 'income' ? a : -a;
    labels.push((r.date || '').slice(5));
    chartData.push(running);
  });

  const ctx = document.getElementById('treBalanceChart');
  if (ctx) {
    drawChart('tre', ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Balance (INR)',
          data: chartData,
          tension: .25,
          fill: false,
          borderColor: '#60C3C4'
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
}

function previewSelectedBill(fileInput, urlInput, previewEl, statusEl) {
  if (!previewEl) return;

  const file = fileInput?.files?.[0] || null;
  const manualUrl = urlInput?.value?.trim() || '';

  if (file) {
    const objectUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    previewEl.innerHTML = `
      <div class="treasury-bill-preview-card">
        ${objectUrl ? `<img src="${escapeHtml(objectUrl)}" alt="${escapeHtml(file.name)}">` : '<span class="treasury-file-icon">File</span>'}
        <div>
          <strong>${escapeHtml(file.name)}</strong>
          <span>${escapeHtml(file.type || 'Unknown file type')}</span>
        </div>
      </div>
    `;
    if (!isTreasuryGasConfigured()) {
      setTreasuryStatus(statusEl, 'Google Drive upload is not configured yet. Paste a Drive URL or configure the Apps Script URL.', 'warning');
    } else {
      setTreasuryStatus(statusEl, 'Selected file will be uploaded to Google Drive when you save.', 'info');
    }
    return;
  }

  if (manualUrl) {
    previewEl.innerHTML = `
      <div class="treasury-bill-preview-card">
        <img src="${escapeHtml(getGdriveImageUrl(manualUrl))}" alt="Bill preview" onerror="this.style.display='none';">
        <div>
          <strong>Drive URL ready</strong>
          <a href="${escapeHtml(manualUrl)}" target="_blank" rel="noopener">Open bill link</a>
        </div>
      </div>
    `;
    setTreasuryStatus(statusEl, 'This pasted Drive URL will be saved with the transaction.', 'info');
    return;
  }

  previewEl.textContent = 'No bill selected.';
  setTreasuryStatus(statusEl, '');
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });
}

function safeFolderPart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'transaction';
}

function buildTreasuryFolderMetadata(transaction) {
  const month = (transaction.date || '').slice(0, 7) || 'undated';
  const titlePart = safeFolderPart(transaction.purpose || transaction.title || transaction.name);
  const typePart = safeFolderPart(transaction.type || 'transaction');
  const amountPart = safeFolderPart(String(transaction.amount || 0));
  return {
    rootFolderName: TREASURY_DRIVE_ROOT_FOLDER,
    rotaryYearFolderName: TREASURY_ROTARY_YEAR_FOLDER,
    monthFolderName: month,
    transactionFolderName: `${transaction.date || 'undated'}_${titlePart}_${typePart}_${amountPart}`
  };
}

function memberDisplayName(member) {
  return treasuryText(member?.name || member?.memberName || member?.email, '');
}

function populateTreasuryMemberSelect(selectEl, selectedId = '', selectedName = '') {
  if (!selectEl) return;

  const previous = selectedId || selectEl.value || '';
  selectEl.innerHTML = '<option value="">Select member</option>';
  MEMBERS
    .slice()
    .sort((a, b) => memberDisplayName(a).localeCompare(memberDisplayName(b)))
    .forEach(member => {
      const opt = document.createElement('option');
      opt.value = member.id;
      opt.textContent = memberDisplayName(member);
      opt.dataset.memberName = memberDisplayName(member);
      selectEl.appendChild(opt);
    });

  if (previous && !Array.from(selectEl.options).some(opt => opt.value === previous)) {
    const opt = document.createElement('option');
    opt.value = previous;
    opt.textContent = selectedName || previous;
    opt.dataset.memberName = selectedName || previous;
    selectEl.appendChild(opt);
  }

  selectEl.value = previous || '';
}

function syncTreasuryPartyControl(party) {
  if (!party?.typeEl) return;
  const type = String(party.typeEl.value || 'other').toLowerCase();
  const isMember = type === 'member';
  const isOther = type === 'other';

  if (party.memberEl) party.memberEl.hidden = !isMember;
  if (party.otherEl) party.otherEl.hidden = !isOther;

  const current = readTreasuryParty(party);
  if (party.hiddenEl) party.hiddenEl.value = current.name;
}

function readTreasuryParty(party) {
  const type = String(party?.typeEl?.value || 'other').toLowerCase();

  if (type === 'member') {
    const memberId = party?.memberEl?.value || '';
    const opt = party?.memberEl?.selectedOptions?.[0] || null;
    const name = treasuryText(opt?.dataset?.memberName || opt?.textContent, '');
    return {
      type: 'member',
      memberId,
      name: memberId ? name : ''
    };
  }

  if (type === 'club') {
    return {
      type: 'club',
      memberId: '',
      name: TREASURY_CLUB_NAME
    };
  }

  return {
    type: 'other',
    memberId: '',
    name: treasuryText(party?.otherEl?.value, '')
  };
}

function setTreasuryPartyControl(party, data) {
  if (!party?.typeEl) return;

  const rawType = String(data?.type || '').toLowerCase();
  const type = ['member', 'club', 'other'].includes(rawType) ? rawType : 'other';
  const memberId = data?.memberId || '';
  const name = treasuryText(data?.name, '');

  populateTreasuryMemberSelect(party.memberEl, memberId, name);
  party.typeEl.value = type;

  if (type === 'other' && party.otherEl) {
    party.otherEl.value = name;
  } else if (party.otherEl) {
    party.otherEl.value = '';
  }

  syncTreasuryPartyControl(party);
}

function resetTreasuryPartyControl(party) {
  setTreasuryPartyControl(party, { type: 'other', memberId: '', name: '' });
}

async function uploadBillToDrive(file, transaction) {
  if (!file) return null;
  if (!isTreasuryGasConfigured()) {
    throw new Error('Google Drive upload is not configured yet. Paste a Drive URL or configure the Apps Script URL.');
  }

  const base64 = await readAsBase64(file);
  const folderMetadata = buildTreasuryFolderMetadata(transaction);
  const payload = {
    action: 'uploadTreasuryBill',
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64,
    transaction: {
      title: transaction.title,
      type: transaction.type,
      amount: transaction.amount,
      date: transaction.date,
      avenue: transaction.avenue,
      purpose: transaction.purpose,
      paymentMode: transaction.paymentMode,
      ...folderMetadata
    }
  };

  const res = await fetch(TREASURY_GAS_WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });

  if (!res.ok) {
    throw new Error(`Bill upload failed with status ${res.status}.`);
  }

  const json = await res.json();
  if (!json.ok && json.status !== 'success') {
    throw new Error(json.message || 'Bill upload failed.');
  }
  if (!json.fileUrl && !json.url) {
    throw new Error('Bill upload did not return a file URL.');
  }

  return {
    billUrl: json.fileUrl || json.url || '',
    billDriveFileId: json.fileId || '',
    billFileName: json.fileName || file.name,
    billFolderUrl: json.folderUrl || '',
    billFolderName: json.folderName || folderMetadata.transactionFolderName,
    billUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function buildTransactionPayload(source) {
  const title = treasuryText(source.nameEl.value, '');
  const amount = Number(source.amountEl.value || 0);
  const purpose = treasuryText(source.purposeEl?.value, '');
  const reimbursementStatus = treasuryText(source.reimburseEl?.value, 'Not Applicable');
  const referenceNumber = treasuryText(source.referenceEl?.value, '');
  const paidByParty = readTreasuryParty(source.paidByParty);
  const paidToParty = readTreasuryParty(source.paidToParty);

  return {
    title,
    name: title,
    type: source.typeEl.value,
    amount,
    date: source.dateEl.value,
    avenue: source.avenueEl.value,

    purpose,
    linkedEventName: purpose,

    paidBy: paidByParty.name,
    paidByType: paidByParty.type,
    paidByMemberId: paidByParty.memberId,
    paidByName: paidByParty.name,
    paidTo: paidToParty.name,
    paidToType: paidToParty.type,
    paidToMemberId: paidToParty.memberId,
    paidToName: paidToParty.name,
    paymentMode: treasuryText(source.paymentModeEl?.value, ''),
    referenceNumber,

    reimbursementStatus,
    reimburse: reimbursementStatus,
    reimbursedTo: treasuryText(source.reimbursedToEl?.value, ''),
    reimbursementDate: treasuryText(source.reimbursementDateEl?.value, ''),

    cheque: referenceNumber,
    billUrl: treasuryText(source.billUrlEl?.value, '')
  };
}

function validateTransactionPayload(payload) {
  if (!payload.title) throw new Error('Enter a transaction title.');
  if (!payload.type) throw new Error('Select income or expense.');
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error('Enter a valid amount.');
  if (!payload.date) throw new Error('Select a transaction date.');
  if (!payload.avenue) throw new Error('Select an avenue.');
  if (payload.paidByType === 'member' && !payload.paidByMemberId) {
    throw new Error('Select a member for Paid By / Received From, or choose Club/Other.');
  }
  if (payload.paidToType === 'member' && !payload.paidToMemberId) {
    throw new Error('Select a member for Paid To, or choose Club/Other.');
  }
}

function addSourceRefs() {
  return {
    nameEl: transName,
    typeEl: transType,
    amountEl: transAmount,
    avenueEl: transAvenue,
    dateEl: transDate,
    purposeEl: transPurpose,
    paidByParty: {
      typeEl: transPaidByType,
      memberEl: transPaidByMember,
      otherEl: transPaidByOther,
      hiddenEl: transPaidBy
    },
    paidToParty: {
      typeEl: transPaidToType,
      memberEl: transPaidToMember,
      otherEl: transPaidToOther,
      hiddenEl: transPaidTo
    },
    paymentModeEl: transPaymentMode,
    referenceEl: transCheque,
    reimburseEl: transReimburse,
    reimbursedToEl: transReimbursedTo,
    reimbursementDateEl: transReimbursementDate,
    billUrlEl: transBillUrl
  };
}

function editSourceRefs() {
  return {
    nameEl: editTransName,
    typeEl: editTransType,
    amountEl: editTransAmount,
    avenueEl: editTransAvenue,
    dateEl: editTransDate,
    purposeEl: editTransPurpose,
    paidByParty: {
      typeEl: editTransPaidByType,
      memberEl: editTransPaidByMember,
      otherEl: editTransPaidByOther,
      hiddenEl: editTransPaidBy
    },
    paidToParty: {
      typeEl: editTransPaidToType,
      memberEl: editTransPaidToMember,
      otherEl: editTransPaidToOther,
      hiddenEl: editTransPaidTo
    },
    paymentModeEl: editTransPaymentMode,
    referenceEl: editTransCheque,
    reimburseEl: editTransReimburse,
    reimbursedToEl: editTransReimbursedTo,
    reimbursementDateEl: editTransReimbursementDate,
    billUrlEl: editTransBillUrl
  };
}

function setButtonLoading(btn, isLoading, text) {
  if (!btn) return () => {};
  const previousText = btn.textContent;
  btn.disabled = !!isLoading;
  if (isLoading && text) btn.textContent = text;
  return () => {
    btn.disabled = false;
    btn.textContent = previousText;
  };
}

function setSelectValue(selectEl, value, fallback = '', allowCustom = false) {
  if (!selectEl) return;
  const normalized = treasuryText(value, fallback);
  const hasOption = Array.from(selectEl.options).some(opt => opt.value === normalized);
  if (hasOption) {
    selectEl.value = normalized;
    return;
  }
  if (allowCustom && normalized) {
    const opt = document.createElement('option');
    opt.value = normalized;
    opt.textContent = normalized;
    selectEl.appendChild(opt);
    selectEl.value = normalized;
    return;
  }
  selectEl.value = fallback;
}

function wireTreasuryPartyControl(party) {
  if (!party?.typeEl) return;
  const update = () => syncTreasuryPartyControl(party);
  party.typeEl.addEventListener('change', update);
  party.memberEl?.addEventListener('change', update);
  party.otherEl?.addEventListener('input', update);
  syncTreasuryPartyControl(party);
}

wireTreasuryPartyControl(addSourceRefs().paidByParty);
wireTreasuryPartyControl(addSourceRefs().paidToParty);
wireTreasuryPartyControl(editSourceRefs().paidByParty);
wireTreasuryPartyControl(editSourceRefs().paidToParty);

if (treAddBtn) {
  treAddBtn.onclick = () => {
    if (addTransForm) addTransForm.reset();
    if (transReimburse) transReimburse.value = 'Not Applicable';
    resetTreasuryPartyControl(addSourceRefs().paidByParty);
    resetTreasuryPartyControl(addSourceRefs().paidToParty);
    previewSelectedBill(transBill, transBillUrl, transBillPreview, transBillStatus);
    openModal('addTransModal');
  };
}

if (transBill) {
  transBill.addEventListener('change', () => {
    previewSelectedBill(transBill, transBillUrl, transBillPreview, transBillStatus);
  });
}

if (transBillUrl) {
  transBillUrl.addEventListener('input', () => {
    if (!transBill?.files?.[0]) previewSelectedBill(transBill, transBillUrl, transBillPreview, transBillStatus);
  });
}

if (transClearBillFile) {
  transClearBillFile.addEventListener('click', () => {
    if (transBill) transBill.value = '';
    previewSelectedBill(transBill, transBillUrl, transBillPreview, transBillStatus);
  });
}

if (addTransForm) {
  addTransForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setTreasuryStatus(transBillStatus, '');

    const file = transBill?.files?.[0] || null;
    const restoreButton = setButtonLoading(addTransSaveBtn || addTransForm.querySelector('button[type="submit"]'), true, 'Saving...');

    try {
      const payload = buildTransactionPayload(addSourceRefs());
      validateTransactionPayload(payload);

      if (file) {
        setTreasuryStatus(transBillStatus, 'Uploading bill to Google Drive...', 'info');
        const uploadMeta = await uploadBillToDrive(file, payload);
        Object.assign(payload, uploadMeta);
      }

      await db.collection('treasury').add({
        ...payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      closeModal('addTransModal');
    } catch (err) {
      setTreasuryStatus(transBillStatus, err.message || 'Failed to save transaction.', 'error');
      alert('Failed to add transaction: ' + (err.message || err));
    } finally {
      restoreButton();
    }
  });
}

document.addEventListener('click', (e) => {
  const billBtn = e.target.closest('[data-show-bill]');
  if (!billBtn) return;
  showBill(billBtn.dataset.showBill);
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-tre]');
  if (!btn) return;

  const id = btn.dataset.editTre;
  const t = TREAS.find(x => x.id === id);
  if (!t) return;

  editTransForm.dataset.clearBill = '';
  editTransId.value = id;

  editTransName.value = treasuryTitle(t);
  editTransType.value = treasuryType(t) || 'income';
  editTransAmount.value = Number(t.amount || 0);
  setSelectValue(editTransAvenue, t.avenue, '', true);
  editTransDate.value = (t.date || '').slice(0, 10);

  editTransPurpose.value = treasuryText(t.purpose || t.linkedEventName, '');
  setTreasuryPartyControl(editSourceRefs().paidByParty, {
    type: t.paidByType || 'other',
    memberId: t.paidByMemberId || '',
    name: t.paidByName || t.paidBy || ''
  });
  setTreasuryPartyControl(editSourceRefs().paidToParty, {
    type: t.paidToType || 'other',
    memberId: t.paidToMemberId || '',
    name: t.paidToName || t.paidTo || ''
  });
  setSelectValue(editTransPaymentMode, t.paymentMode, '', true);
  editTransCheque.value = treasuryReference(t);
  setSelectValue(editTransReimburse, t.reimbursementStatus || t.reimburse, 'Not Applicable', true);
  editTransReimbursedTo.value = treasuryText(t.reimbursedTo, '');
  editTransReimbursementDate.value = treasuryText(t.reimbursementDate, '');
  editTransBillUrl.value = treasuryText(t.billUrl, '');
  if (editTransBill) editTransBill.value = '';

  previewSelectedBill(editTransBill, editTransBillUrl, editTransBillPreview, editTransBillStatus);
  openModal('editTransModal');
});

if (editTransBill) {
  editTransBill.addEventListener('change', () => {
    editTransForm.dataset.clearBill = '';
    previewSelectedBill(editTransBill, editTransBillUrl, editTransBillPreview, editTransBillStatus);
  });
}

if (editTransBillUrl) {
  editTransBillUrl.addEventListener('input', () => {
    editTransForm.dataset.clearBill = '';
    if (!editTransBill?.files?.[0]) previewSelectedBill(editTransBill, editTransBillUrl, editTransBillPreview, editTransBillStatus);
  });
}

if (editTransClearBillFile) {
  editTransClearBillFile.addEventListener('click', () => {
    if (editTransBill) editTransBill.value = '';
    previewSelectedBill(editTransBill, editTransBillUrl, editTransBillPreview, editTransBillStatus);
  });
}

if (editTransClearBill) {
  editTransClearBill.addEventListener('click', () => {
    editTransForm.dataset.clearBill = 'true';
    if (editTransBill) editTransBill.value = '';
    if (editTransBillUrl) editTransBillUrl.value = '';
    editTransBillPreview.textContent = 'Bill link will be cleared when you save.';
    setTreasuryStatus(editTransBillStatus, 'Bill link will be cleared on save.', 'warning');
  });
}

if (editTransForm) {
  editTransForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setTreasuryStatus(editTransBillStatus, '');

    const file = editTransBill?.files?.[0] || null;
    const restoreButton = setButtonLoading(editTransSaveBtn || editTransForm.querySelector('button[type="submit"]'), true, 'Saving...');

    try {
      const id = editTransId.value;
      const payload = buildTransactionPayload(editSourceRefs());
      validateTransactionPayload(payload);

      if (editTransForm.dataset.clearBill === 'true') {
        payload.billUrl = '';
        payload.billDriveFileId = '';
        payload.billFileName = '';
        payload.billFolderUrl = '';
        payload.billFolderName = '';
      }

      if (file) {
        setTreasuryStatus(editTransBillStatus, 'Uploading bill to Google Drive...', 'info');
        const uploadMeta = await uploadBillToDrive(file, payload);
        Object.assign(payload, uploadMeta);
      }

      await db.collection('treasury').doc(id).update({
        ...payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      closeModal('editTransModal');
      alert('Transaction updated!');
    } catch (err) {
      setTreasuryStatus(editTransBillStatus, err.message || 'Failed to save transaction.', 'error');
      alert('Error: ' + (err.message || err));
    } finally {
      restoreButton();
    }
  });
}

document.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('button[data-del-tre]');
  if (!delBtn) return;
  const id = delBtn.dataset.delTre;
  if (!confirm('Delete this entry?')) return;
  try {
    await db.collection('treasury').doc(id).delete();
  } catch (err) {
    alert('Failed to delete entry: ' + err.message);
  }
});

function exportTreasuryToExcel() {
  if (!window.XLSX) {
    alert('Excel exporter not loaded.');
    return;
  }

  const data = getFilteredTreasury();

  const header = [
    'Title',
    'Type',
    'Amount (INR)',
    'Avenue',
    'Date',
    'Purpose / Linked Event',
    'Paid By / Received From',
    'Paid To',
    'Payment Mode',
    'Reference No. / UPI ID / Cheque No.',
    'Reimbursement Status',
    'Reimbursed To',
    'Reimbursement Date',
    'Bill URL'
  ];
  const rows = data.map(t => [
    treasuryTitle(t),
    treasuryTypeLabel(treasuryType(t)),
    Number(t.amount || 0),
    t.avenue || '',
    (t.date || '').slice(0, 10),
    t.purpose || t.linkedEventName || '',
    t.paidBy || '',
    t.paidTo || '',
    t.paymentMode || '',
    t.referenceNumber || t.cheque || '',
    t.reimbursementStatus || t.reimburse || '',
    t.reimbursedTo || '',
    t.reimbursementDate || '',
    t.billUrl || ''
  ]);

  let inc = 0;
  let exp = 0;
  data.forEach(t => {
    const amt = Number(t.amount || 0);
    if (treasuryType(t) === 'income') inc += amt;
    else exp += amt;
  });
  const net = inc - exp;

  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws1['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 26 },
    { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 42 }
  ];

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Summary (Filtered)'],
    ['Total Income (INR)', inc],
    ['Total Expense (INR)', exp],
    ['Net (INR)', net],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Treasury');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `treasury_filtered_${dateTag}.xlsx`);
}

if (exportTreXlsxBtn) {
  exportTreXlsxBtn.addEventListener('click', exportTreasuryToExcel);
}

if (treFilterType) treFilterType.addEventListener('change', renderTreasurer);
if (treFilterMonth) treFilterMonth.addEventListener('change', renderTreasurer);
if (treFilterAvenue) treFilterAvenue.addEventListener('change', renderTreasurer);

/**
 * Treasurer panel filters, rendering, uploads, and exports.
 */

function getFilteredTreasury() {
  const typeVal   = treFilterType.value;
  const monthVal  = treFilterMonth.value;
  const avenueVal = treFilterAvenue.value;

  return TREAS.filter(t => {
    if (typeVal && t.type !== typeVal) return false;
    
    if (monthVal && (t.date || '').slice(0, 7) !== monthVal) return false;

    if (avenueVal) {
      if (avenueVal === 'Other') {
        if (t.avenue && t.avenue !== 'No Avenue' && t.avenue !== 'Other') return false;
      } else {
        if (t.avenue !== avenueVal) return false;
      }
    }
    return true;
  });
}

function buildTreasuryMonthFilter() {
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


function renderTreasurer(){
  if (!treBody) return;

  const data = getFilteredTreasury(); // <--- Use filtered data

  let inc = 0, exp = 0;
  treBody.innerHTML = data.map(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'income') inc += amt;
    else if (t.type === 'expense') exp += amt;

    const dateStr = (t.date || '').slice(0,10);
    const typeLabel = t.type === 'income' ? 'Income' : 'Expense';
    const thumbUrl = getGdriveImageUrl(t.billUrl);

    return `
    <tr>
      <td>${(t.name || '').replace(/</g,'&lt;')}</td>
      <td>${typeLabel}</td>
      <td>₹ ${amt.toLocaleString()}</td>
      <td>${(t.avenue || '-').replace(/</g,'&lt;')}</td>
      <td>${dateStr}</td>
      <td>${(t.paidBy || '-').replace(/</g,'&lt;')}</td>
      <td>${(t.reimburse || '-').replace(/</g,'&lt;')}</td>
      <td>${(t.cheque || '-').replace(/</g,'&lt;')}</td>
      <td>
        ${
          t.billUrl
            ? `<img src="${thumbUrl}" 
                    style="width:60px; height:40px; object-fit:cover; border-radius:6px; cursor:pointer; border:1px solid #333;"
                    onclick="showBill('${t.billUrl}')"
                    alt="Bill"
                    onerror="this.style.display='none';this.parentElement.innerText='🔗'" 
               />`
            : '—'
        }
      </td>
      <td>
         <button class="icon-btn" data-edit-tre="${t.id}" title="Edit entry">✏️</button>
         <button class="icon-btn" data-del-tre="${t.id}" title="Delete entry">🗑</button>
      </td>
    </tr>`;
  }).join('');

  const net = inc - exp;
  if (treBadge) {
    treBadge.textContent = `${data.length} records · Net ₹ ${net.toLocaleString()}`;
  }

  renderTreasurerInsights(data);
}

window.showBill = (url) => {
  billLightboxImg.src = getGdriveImageUrl(url);
  openModal("billLightbox");
};

function renderTreasurerInsights(data){
  let inc=0, exp=0;
  (data||[]).forEach(t => {
    const a = Number(t.amount||0);
    if (t.type==='income') inc+=a; else if (t.type==='expense') exp+=a;
  });
  const net = inc - exp;
  
  document.getElementById('treInc').textContent = `₹ ${fmt(inc)}`;
  document.getElementById('treExp').textContent = `₹ ${fmt(exp)}`;
  document.getElementById('treNet').textContent = `₹ ${fmt(net)}`;

  const rows = [...(data||[])].sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  
  let running = 0;
  const labels = [], chartData = [];
  rows.forEach(r => {
    const a = Number(r.amount||0);
    running += (r.type==='income') ? a : -a;
    labels.push((r.date||'').slice(5)); 
    chartData.push(running);
  });

  const ctx = document.getElementById('treBalanceChart');
  if(ctx) {
    drawChart('tre', ctx, {
      type:'line',
      data:{ labels, datasets:[{ label:'Balance (₹)', data: chartData, tension:.25, fill:false, borderColor: '#60C3C4' }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
  }
}

if (treAddBtn) treAddBtn.onclick = () => {
  openModal("addTransModal");
};

if (transBill) {
  transBill.addEventListener("change", () => {
    const file = transBill.files[0];
    if (!file) {
      transBillPreview.innerHTML = "";
      return;
    }
    const url = URL.createObjectURL(file);
    transBillPreview.innerHTML = `
      <img src="${url}" style="width:120px; border-radius:8px; cursor:pointer;" id="billThumbTemp"/>
    `;
    document.getElementById("billThumbTemp").onclick = () => {
      billLightboxImg.src = url;
      openModal("billLightbox");
    };
  });
}

const TREASURY_GAS_URL = "https://script.google.com/macros/s/AKfycbxhSGPm2HFUxUhZVLS16zKPiTV4Dnmxtz0CWC_OvH9KJobLYQSrSiAr3BcSIWS3-4Qtcg/exec";

function readAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); 
    reader.readAsDataURL(file);
  });
}

async function uploadBillToDrive(file) {
  if (!file) return null;
  
  const base64 = await readAsBase64(file);
  
  const payload = JSON.stringify({
    action: "uploadBill",
    fileName: file.name,
    fileData: base64
  });
  
  try {
    const res = await fetch(TREASURY_GAS_URL, { 
      method: "POST", 
      body: payload,
      headers: { "Content-Type": "text/plain" } 
    });

    if (!res.ok) {
      throw new Error(`Server responded with status: ${res.status}`);
    }

    const json = await res.json();
    if (json.status === "success") {
      return json.fileUrl;
    } else {
      throw new Error(json.message || "Script returned an error.");
    }

  } catch (err) {
    console.error("Upload Error:", err);
    throw new Error("Bill upload failed. (Check: Is the script deployed as 'Anyone'?)");
  }
}
addTransForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: transName.value.trim(),
    type: transType.value,
    amount: Number(transAmount.value),
    avenue: transAvenue.value,
    date: transDate.value,
    paidBy: transPaidBy.value.trim() || "",
    reimburse: transReimburse.value.trim() || "",
    cheque: transCheque.value.trim() || "",
    billUrl: document.getElementById("transBillUrl").value.trim(),   // 👈 NEW
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("treasury").add(payload);
    closeModal("addTransModal");
  } catch (err) {
    alert("Failed to add transaction: " + err.message);
  }
});
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-edit-tre]");
  if (!btn) return;

  const id = btn.dataset.editTre;
  const t = TREAS.find(x => x.id === id);
  if (!t) return;

  document.getElementById("editTransId").value = id;
  
  document.getElementById("editTransName").value = t.name || "";
  document.getElementById("editTransType").value = t.type || "income";
  document.getElementById("editTransAmount").value = t.amount || 0;
  document.getElementById("editTransAvenue").value = t.avenue || "";
  document.getElementById("editTransDate").value = (t.date || "").slice(0,10);
  
  editTransPaidBy.value = t.paidBy || "";
  editTransReimburse.value = t.reimburse || "";
  editTransCheque.value = t.cheque || "";

  if (t.billUrl) {
    editTransBillPreview.innerHTML = `
      <img src="${getGdriveImageUrl(t.billUrl)}"
           style="width:120px; border-radius:8px; cursor:pointer;"
           onclick="showBill('${t.billUrl}')">
    `;
  } else {
    editTransBillPreview.innerHTML = "No bill uploaded";
  }

  openModal("editTransModal");
});

editTransForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = editTransForm.querySelector('button[type="submit"]');
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    const id = editTransId.value;
    const payload = {
      name: editTransName.value.trim(),
      type: editTransType.value,
      amount: Number(editTransAmount.value),
      avenue: editTransAvenue.value.trim(),
      date: editTransDate.value,
      
      paidBy: editTransPaidBy.value.trim(),
      reimburse: editTransReimburse.value.trim(),
      cheque: editTransCheque.value.trim(),
    };

    const newFile = editTransBill.files[0];
    if (newFile) {
      payload.billUrl = await uploadBillToDrive(newFile);
    }

    await db.collection("treasury").doc(id).update(payload);
    closeModal("editTransModal");
    alert("Transaction updated!");
  } catch(err) {
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = prevText;
  }
});

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

function exportTreasuryToExcel(){
  if (!window.XLSX) { alert('Excel exporter not loaded.'); return; }

  const data = getFilteredTreasury(); // <--- Export filtered data

  const header = ['Name', 'Type', 'Amount (₹)', 'Avenue', 'Date', 'Paid By', 'Reimbursement', 'Bank Statement'];
  const rows = data.map(t => [
    t.name || '',
    t.type === 'income' ? 'Income' : 'Expense',
    Number(t.amount || 0),
    t.avenue || '',                                 
    (t.date || '').slice(0,10),
    t.paidBy || '',
    t.reimburse || '',
    t.cheque || ''
  ]);

  let inc = 0, exp = 0;
  data.forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'income') inc += amt; else exp += amt;
  });
  const net = inc - exp;

  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws1['!cols'] = [{wch:30},{wch:12},{wch:14},{wch:12},{wch:12}, {wch:20}, {wch:20}, {wch:15}];

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Summary (Filtered)'],
    ['Total Income (₹)', inc],
    ['Total Expense (₹)', exp],
    ['Net (₹)', net],
  ]);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Treasury');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const dateTag = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `treasury_filtered_${dateTag}.xlsx`);
}
if (exportTreXlsxBtn) {
  exportTreXlsxBtn.addEventListener('click', exportTreasuryToExcel);
}


if (treFilterType) treFilterType.addEventListener('change', renderTreasurer);
if (treFilterMonth) treFilterMonth.addEventListener('change', renderTreasurer);
if (treFilterAvenue) treFilterAvenue.addEventListener('change', renderTreasurer);



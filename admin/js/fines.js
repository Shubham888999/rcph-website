/**
 * Fines panel rendering, calculations, and CRUD handlers.
 */

function renderFines(){
  if (!finesBody) return;
  const mnames = membersMap();
  let total = 0;
  finesBody.innerHTML = FINES.map(f => {
    const reasonLabel = (f.reason === 'missing_badge') ? 'Missing badge'
                      : (f.reason === 'late') ? 'Late to event/meeting'
                      : (f.reason || '');
    const memberName = f.memberName || mnames[f.memberId] || f.memberId;
    const dateStr    = (f.date || '').slice(0,10);
    const amt        = Number(f.amount || 0);
    total += Number.isFinite(amt) ? amt : 0;

    return `
      <tr>
        <td>${(memberName || '').replace(/</g,'&lt;')}</td>
        <td>₹ ${amt.toLocaleString()}</td>
        <td>${reasonLabel}</td>
        <td>${(f.eventName || '').replace(/</g,'&lt;')}</td>
        <td>${dateStr}</td>
        <td>
          <button class="icon-btn" title="Delete fine" data-del-fine="${f.id}">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  if (finesBadge) finesBadge.textContent = `${FINES.length} records · ₹ ${total.toLocaleString()}`;
  renderFinesInsights();
}

function renderFinesInsights(){
  let total = 0, monthTotal = 0;
  const nowYM = new Date().toISOString().slice(0,7);
  const reasonTotals = { missing_badge:0, late:0, other:0 };
  const byMonth = {}; 

  (FINES||[]).forEach(f=>{
    const amt = Number(f.amount || 0);
    total += amt;
    const ym = (f.date||'').slice(0,7);
    if (ym === nowYM) monthTotal += amt;
    if (!byMonth[ym]) byMonth[ym]=0; byMonth[ym]+=amt;

    if (f.reason === 'missing_badge') reasonTotals.missing_badge += amt;
    else if (f.reason === 'late')     reasonTotals.late += amt;
    else                              reasonTotals.other += amt;
  });

  document.getElementById('finesTotal').textContent = `₹ ${fmt(total)}`;
  document.getElementById('finesMonth').textContent = `₹ ${fmt(monthTotal)}`;

  drawChart('finesReason', document.getElementById('finesByReasonChart'), {
    type:'doughnut',
    data:{ labels:['Missing badge','Late','Other'], datasets:[{ data:[
      reasonTotals.missing_badge, reasonTotals.late, reasonTotals.other
    ]}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
  });

  const months = Object.keys(byMonth).filter(Boolean).sort();
  drawChart('finesMonth', document.getElementById('finesByMonthChart'), {
    type:'bar',
    data:{ labels: months, datasets:[{ label:'₹', data: months.map(m=>byMonth[m]) }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}

if (fineForm) {
  fineForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = fineMember.value;
    const reason   = fineReason.value;
    const eventName= fineEvent.value.trim();
    const date     = fineDate.value;
    const amount   = Number((fineAmount && fineAmount.value) || 0);

    if (!memberId || !reason || !eventName || !date) return;
    if (!Number.isFinite(amount) || amount < 0) { alert('Enter a valid amount (₹)'); return; }

    const m = MEMBERS.find(x => x.id === memberId);
    const memberName = m ? (m.name || '') : '';

    const payload = {
      memberId,
      memberName,      
      reason,           
      eventName,
      date,
      amount,             
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: (auth.currentUser && auth.currentUser.uid) || null
    };

    try {
      await db.collection('fines').add(payload);
      fineForm.reset();
      fineDate.value = new Date().toISOString().slice(0,10);
    } catch (err) { alert('Failed to add fine: ' + err.message); }
  });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-del-fine]');
  if (!btn) return;
  const id = btn.dataset.delFine;
  if (!confirm('Delete this fine record?')) return;
  try { await db.collection('fines').doc(id).delete(); } 
  catch (err) { alert('Failed to delete fine: ' + err.message); }
});



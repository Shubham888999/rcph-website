/**
 * Auth guard, role/lock handling, initial loads, and realtime subscriptions.
 */

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }

  try {
    const snap = await db.collection('roles').doc(user.uid).get();
    const role = snap.exists ? String(snap.data().role).toLowerCase() : null;
    IS_PRESIDENT = (role === 'president');
    
    const goDZRBtn = document.getElementById('goDZRBtn');
    if (goDZRBtn) {
        if (IS_PRESIDENT) {
            goDZRBtn.style.display = 'inline-block';
            goDZRBtn.onclick = () => location.href = 'dzrvisit.html';
        } else {
            goDZRBtn.style.display = 'none';
        }
    }
    if (role && role !== 'admin' && role !== 'president') {
      window.location.href = 'bodlogin.html';
      return;
    }
  } catch (e) {
    console.warn('Role check failed; continuing:', e);
  }

  await startAttendancePage();
});

function watchLock(panelKey, btnEl, badgeEl, onLockedChange) {
  db.collection('locks').doc(panelKey).onSnapshot(snap => {
    const locked = snap.exists && !!snap.data().locked;
    if (badgeEl) badgeEl.textContent = locked ? 'Locked' : 'Unlocked';
    if (btnEl) {
      btnEl.disabled = !IS_PRESIDENT;           
      btnEl.textContent = locked ? '🔓' : '🔒'; 
    }
    onLockedChange?.(locked);
  });
}

watchLock('attendance', lockAttendanceBtn, lockAttendanceState, (locked) => {
  document.querySelectorAll('#attBody .cell-btn, #addMemberBtn, #addEventBtn')
    .forEach(el => el.disabled = locked);
});
watchLock('bodAttendance', lockBodAttBtn, lockBodAttState, (locked) => {
  document.querySelectorAll('#bodBody .cell-btn, #bodAddMemberBtn, #bodAddMeetingBtn')
    .forEach(el => el.disabled = locked);
});
watchLock('fines', lockFinesBtn, lockFinesState, (locked) => {
  document.querySelectorAll('#fineForm input, #fineForm select, #fineForm button')
    .forEach(el => el.disabled = locked);
});
watchLock('treasury', lockTreasuryBtn, lockTreasuryState, (locked) => {
  const btns = document.querySelectorAll('#treAddBtn, #treBody .icon-btn');
  btns.forEach(b => b.disabled = locked);
});

async function toggleLock(panelKey) {
  if (!IS_PRESIDENT) return; 
  const ref = db.collection('locks').doc(panelKey);
  const snap = await ref.get();
  const cur = snap.exists && !!snap.data().locked;
  await ref.set({ locked: !cur }, { merge: true });
}

if (lockAttendanceBtn) lockAttendanceBtn.onclick = () => toggleLock('attendance');
if (lockBodAttBtn)     lockBodAttBtn.onclick     = () => toggleLock('bodAttendance');
if (lockFinesBtn)      lockFinesBtn.onclick      = () => toggleLock('fines');
if (lockTreasuryBtn)   lockTreasuryBtn.onclick   = () => toggleLock('treasury');

signOutBtn.addEventListener('click', async () => {
  await auth.signOut();
  location.href = 'login.html';
});
if (goBodBtn) {
  goBodBtn.addEventListener('click', () => location.href = 'bodlogin.html');
}



async function loadData(){
  const [mSnap, eSnap] = await Promise.all([
    db.collection('members').orderBy('name').get(),
    db.collection('events').orderBy('date','desc').get()
  ]);

  MEMBERS = mSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  EVENTS  = eSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  
  if (fineMember) {
    fineMember.innerHTML = '<option value="" disabled selected>Member…</option>' +
      MEMBERS.map(m => `<option value="${m.id}">${(m.name || '').replace(/</g,'&lt;')}</option>`).join('');
  }
  
  if (bodHead && bodBody) {
    const [bmSnap, mtSnap, baSnap] = await Promise.all([
      db.collection('bodMembers').orderBy('name').get(),
      db.collection('bodMeetings').orderBy('date','desc').get(),
      db.collection('bodAttendance').get()
    ]);
    BODM    = bmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    BODMEET = mtSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    BODATT = {};
    baSnap.forEach(d => { BODATT[d.id] = d.data() || {}; });
    renderBodGrid();
  }

  const fSnap = await db.collection('fines').orderBy('date','desc').get();
  FINES = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFines();

  buildMonthFilterFromEvents();
  const attSnap = await db.collection('attendance').get();
  ATT = {};
  attSnap.forEach(d => { ATT[d.id] = d.data() || {}; });
  renderGrid();
  if (distHead && distBody) {
    await loadDistrictData();
  }
if (treBody) {
  if (transDate && !transDate.value) transDate.value = new Date().toISOString().slice(0,10);
  const tSnap = await db.collection('treasury').orderBy('date','desc').get();
  TREAS = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  buildTreasuryMonthFilter(); 
  renderTreasurer();
}
}
async function startAttendancePage() {
  await loadData();
  attachRealtimeListeners();
}

function attachRealtimeListeners() {
  if (unsubDistEvents) { unsubDistEvents(); unsubDistEvents = null; }
  if (unsubDistAtt)    { unsubDistAtt();    unsubDistAtt    = null; }
  if (unsubMembers) { unsubMembers(); unsubMembers = null; }
  if (unsubEvents)  { unsubEvents();  unsubEvents  = null; }
  if (unsubAtt)     { unsubAtt();     unsubAtt     = null; }
  if (unsubFines)   { unsubFines();   unsubFines   = null; }
  if (unsubBodM)    { unsubBodM();    unsubBodM    = null; }
  if (unsubBodMt)   { unsubBodMt();   unsubBodMt   = null; }
  if (unsubBodAt)   { unsubBodAt();   unsubBodAt   = null; }
  if (unsubTre)     { unsubTre();     unsubTre     = null; }

  unsubFines = db.collection('fines').orderBy('date', 'desc').onSnapshot((snap) => {
    FINES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFines();
  });

unsubMembers = db.collection('members').orderBy('name').onSnapshot((snap) => {
  MEMBERS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGrid();
  renderInsightsPanel(); 
});

unsubEvents = db.collection('events').orderBy('date', 'desc').onSnapshot((snap) => {
  EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildMonthFilterFromEvents();
  renderGrid();
  renderInsightsPanel();   
});

unsubAtt = db.collection('attendance').onSnapshot((snap) => {
  const next = {};
  snap.forEach(d => { next[d.id] = d.data() || {}; });
  ATT = next;
  renderGrid();
  renderInsightsPanel();   
});
  if (bodHead) {
    unsubBodM = db.collection('bodMembers').orderBy('name').onSnapshot(snap => {
      BODM = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderBodGrid();
    });
    unsubBodMt = db.collection('bodMeetings').orderBy('date','desc').onSnapshot(snap => {
      BODMEET = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderBodGrid();
    });
    unsubBodAt = db.collection('bodAttendance').onSnapshot(snap => {
      const next = {};
      snap.forEach(d => { next[d.id] = d.data() || {}; });
      BODATT = next;
      renderBodGrid();
    });
  }
  if (distHead && distBody) {
    unsubDistEvents = db.collection('districtEvents').orderBy('date', 'desc').onSnapshot(snap => {
      DIST_EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      buildDistMonthFilterFromEvents();
      renderDistrictGrid();
    });

    unsubDistAtt = db.collection('districtAttendance').onSnapshot(snap => {
      const next = {};
      snap.forEach(d => { next[d.id] = d.data() || {}; });
      DIST_ATT = next;
      renderDistrictGrid();
    });
  }
  if (treBody) {
unsubTre = db.collection('treasury').orderBy('date','desc').onSnapshot(snap => {
  TREAS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildTreasuryMonthFilter(); // <--- Add this
  renderTreasurer();
});
  }
}



// router.js
async function getUserRole(uid) {
  try {
    const snap = await db.collection('roles').doc(uid).get();
    return snap.exists ? (snap.data().role || 'bod') : 'bod';
  } catch {
    return 'bod';
  }
}

function guardPage() {
  const requiredRole = document.body.dataset.role; // "admin" or "bod"
  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = 'login.html'; return; }
    const role = await getUserRole(user.uid);

    if (role !== requiredRole) {
      window.location.href = (role === 'admin') ? 'admin.html' : 'bodlogin.html';
      return;
    }

    document.dispatchEvent(new CustomEvent('role:ready', { detail: { user, role } }));
  });
}
guardPage();

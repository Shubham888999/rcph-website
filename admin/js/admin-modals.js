/**
 * Shared modal open/close helpers and generic close handlers.
 */

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.setAttribute('aria-hidden', 'true');
    const form = modal.querySelector('form');
    if (form) form.reset();
    if (modalId === 'addTransModal') {
      if (transBillPreview) transBillPreview.textContent = 'No bill selected.';
      if (transBillStatus) transBillStatus.textContent = '';
    }
    if (modalId === 'editTransModal') {
      if (editTransBillPreview) editTransBillPreview.textContent = 'No bill uploaded.';
      if (editTransBillStatus) editTransBillStatus.textContent = '';
      if (editTransForm) editTransForm.dataset.clearBill = '';
    }
  }
}

document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
  }
});

if (document.getElementById('bodMemCancel')) document.getElementById('bodMemCancel').onclick = () => closeModal('editBodMemberModal');
if (document.getElementById('bodMeetCancel')) document.getElementById('bodMeetCancel').onclick = () => closeModal('editBodMeetingModal');
if (document.getElementById('memCancel')) document.getElementById('memCancel').onclick = () => closeModal('editMemberModal');
if (document.getElementById('evCancel')) document.getElementById('evCancel').onclick = () => closeModal('editEventModal');

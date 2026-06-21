/**
 * Final bootstrapping hooks and lightweight startup wiring.
 */

if (addMemberBtn) addMemberBtn.onclick = () => openModal('addMemberModal');
if (addEventBtn)  addEventBtn.onclick  = () => openModal('addEventModal');


if (addDistEventBtn) addDistEventBtn.onclick = () => openModal('addDistEventModal');

if (accountRequestFilter) accountRequestFilter.addEventListener('change', renderAccountRequests);

if (prospectMembersToggle && prospectMembersBody) {
  prospectMembersToggle.addEventListener('click', () => {
    const willOpen = prospectMembersBody.hidden;
    prospectMembersBody.hidden = !willOpen;
    prospectMembersToggle.setAttribute('aria-expanded', String(willOpen));
    prospectMembersToggle.textContent = willOpen ? 'Hide Prospects' : 'Show Prospects';
    if (willOpen) renderProspectCards();
  });
}

if (prospectSearch) prospectSearch.addEventListener('input', renderProspectCards);
if (prospectFilter) prospectFilter.addEventListener('change', renderProspectCards);
if (prospectRefreshBtn) {
  prospectRefreshBtn.addEventListener('click', () => loadProspectManagementData({ showLoading: true }));
}

if (prospectCards) {
  prospectCards.addEventListener('change', event => {
    const duesCheckbox = event.target.closest('[data-prospect-dues]');
    if (!duesCheckbox) return;
    duesCheckbox.disabled = true;
    updateProspectDuesAdmin(duesCheckbox.dataset.prospectDues, duesCheckbox.checked);
  });

  prospectCards.addEventListener('click', event => {
    const promoteButton = event.target.closest('[data-prospect-promote]');
    if (!promoteButton || promoteButton.disabled) return;
    promoteButton.disabled = true;
    promoteProspectAdmin(promoteButton.dataset.prospectPromote);
  });
}

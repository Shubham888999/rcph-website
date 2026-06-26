/**
 * Final bootstrapping hooks and lightweight startup wiring.
 */

(function initAdminNavigation() {
  const nav = document.querySelector('.admin-nav');
  const mobileToggle = document.getElementById('adminNavToggle');
  const moreToggle = document.getElementById('adminMoreToggle');
  const moreMenu = document.getElementById('adminMoreMenu');
  const logoutLink = document.getElementById('adminNavLogout');
  if (!nav || !mobileToggle || !moreToggle || !moreMenu) return;

  const mobileQuery = window.matchMedia('(max-width: 900px)');
  const sectionLinks = Array.from(nav.querySelectorAll('[data-admin-section-link]'));
  const sectionEntries = sectionLinks
    .map(link => {
      const targetId = decodeURIComponent(link.hash || '').replace(/^#/, '');
      return { link, section: targetId ? document.getElementById(targetId) : null };
    })
    .filter(entry => entry.section)
    .sort((a, b) => a.section.offsetTop - b.section.offsetTop);

  function closeMore({ restoreFocus = false } = {}) {
    moreToggle.setAttribute('aria-expanded', 'false');
    if (!mobileQuery.matches) moreMenu.hidden = true;
    if (restoreFocus) moreToggle.focus();
  }

  function closeMobileMenu({ restoreFocus = false } = {}) {
    nav.classList.remove('is-menu-open');
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.setAttribute('aria-label', 'Open admin navigation');
    if (restoreFocus) mobileToggle.focus();
  }

  function syncResponsiveState() {
    closeMobileMenu();
    moreToggle.setAttribute('aria-expanded', 'false');
    moreMenu.hidden = !mobileQuery.matches;
  }

  function setActiveSection(activeLink) {
    sectionLinks.forEach(link => {
      const isActive = link === activeLink;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    moreToggle.classList.toggle('is-active', !!activeLink?.closest('.admin-nav__more-menu'));
  }

  let scrollFrame = 0;
  function updateActiveSection() {
    scrollFrame = 0;
    if (!sectionEntries.length) return;

    const marker = window.scrollY + nav.offsetHeight + 110;
    let activeEntry = sectionEntries[0];
    sectionEntries.forEach(entry => {
      if (entry.section.offsetTop <= marker) activeEntry = entry;
    });
    setActiveSection(activeEntry.link);
  }

  function requestActiveSectionUpdate() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(updateActiveSection);
  }

  mobileToggle.addEventListener('click', () => {
    const willOpen = !nav.classList.contains('is-menu-open');
    nav.classList.toggle('is-menu-open', willOpen);
    mobileToggle.setAttribute('aria-expanded', String(willOpen));
    mobileToggle.setAttribute('aria-label', willOpen ? 'Close admin navigation' : 'Open admin navigation');
    if (willOpen) moreMenu.hidden = false;
  });

  moreToggle.addEventListener('click', () => {
    if (mobileQuery.matches) return;
    const willOpen = moreMenu.hidden;
    moreMenu.hidden = !willOpen;
    moreToggle.setAttribute('aria-expanded', String(willOpen));
  });

  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    if (link.matches('[data-admin-section-link]')) setActiveSection(link);
    closeMore();
    closeMobileMenu();
  });

  document.addEventListener('click', event => {
    if (nav.contains(event.target)) return;
    closeMore();
    closeMobileMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (nav.classList.contains('is-menu-open')) {
      closeMobileMenu({ restoreFocus: true });
      return;
    }
    if (!moreMenu.hidden) closeMore({ restoreFocus: true });
  });

  if (logoutLink) {
    logoutLink.addEventListener('click', async event => {
      event.preventDefault();
      try {
        if (typeof auth !== 'undefined' && auth && typeof auth.signOut === 'function') {
          await auth.signOut();
        }
      } catch (error) {
        console.warn('Admin navigation logout failed:', error);
      } finally {
        window.location.href = 'login.html';
      }
    });
  }

  window.addEventListener('scroll', requestActiveSectionUpdate, { passive: true });
  window.addEventListener('resize', requestActiveSectionUpdate, { passive: true });
  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', syncResponsiveState);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(syncResponsiveState);
  }

  syncResponsiveState();
  updateActiveSection();
}());

if (addMemberBtn) addMemberBtn.onclick = () => openModal('addMemberModal');
if (addEventBtn)  addEventBtn.onclick  = () => openModal('addEventModal');


if (addDistEventBtn) addDistEventBtn.onclick = () => openModal('addDistEventModal');

if (accountRequestFilter) accountRequestFilter.addEventListener('change', renderAccountRequests);

if (clubRankingForm) {
  clubRankingForm.addEventListener('submit', saveClubRankingSettings);
}

[clubRankingEnabled, clubRankingValue, clubRankingSubtitle].forEach(el => {
  if (el) el.addEventListener('input', renderClubRankingPreview);
  if (el) el.addEventListener('change', renderClubRankingPreview);
});

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

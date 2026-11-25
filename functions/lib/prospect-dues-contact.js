'use strict';

// Who prospects contact about membership dues. Sent ONLY in the prospect branch of
// getMyDashboardStats, so the number never ships in the public website code and members,
// BOD and admins do not receive it. Change it here when the officer changes.
const PROSPECT_DUES_CONTACT = Object.freeze({
  name: 'Rtr. Anish Joglekar',
  role: 'Membership Development Officer',
  phone: '+91 97651 82208',
});

function prospectDuesContact() {
  return { ...PROSPECT_DUES_CONTACT };
}

module.exports = { prospectDuesContact };

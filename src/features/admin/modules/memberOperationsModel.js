function text(value, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeKey(value) {
  return text(value, 320).toLowerCase().replace(/\s+/g, " ");
}

export function normalizeMemberEmail(value) {
  return text(value, 320).toLowerCase();
}

export function normalizeMemberRid(value) {
  return text(value, 40);
}

export function normalizeMemberName(value) {
  return normalizeKey(value).replace(/^rtr\.?\s+/, "");
}

export function memberInitials(name) {
  return text(name, 160)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "M";
}

function userIsApproved(user) {
  return user?.status === "approved" && user?.active !== false;
}

function buildApprovedAccountMaps(users) {
  const approvedUsers = (Array.isArray(users) ? users : []).filter(userIsApproved);
  const byEmail = new Map();
  const byName = new Map();

  approvedUsers.forEach((user) => {
    const email = normalizeMemberEmail(user.email);
    const name = normalizeMemberName(user.name);

    if (email && !byEmail.has(email)) byEmail.set(email, user);
    if (name) byName.set(name, [...(byName.get(name) || []), user]);
  });

  return { byEmail, byName };
}

function attendanceSummaryFor(memberId, attendance, events) {
  const row = attendance?.[memberId] || {};
  const eventIds = Array.isArray(events) && events.length
    ? events.map((event) => event.id)
    : Object.keys(row);
  const values = eventIds
    .map((eventId) => row[eventId])
    .filter((value) => value === true || value === false);
  const present = values.filter(Boolean).length;

  return {
    present,
    recorded: values.length,
    rate: values.length ? Math.round((present / values.length) * 100) : null,
  };
}

function fineSummaryFor(member, fines) {
  const memberName = normalizeMemberName(member.name);
  const memberFines = (Array.isArray(fines) ? fines : []).filter((fine) => {
    if (fine.memberId && fine.memberId === member.id) return true;
    return memberName && normalizeMemberName(fine.memberName) === memberName;
  });

  return {
    count: memberFines.length,
    total: memberFines.reduce((sum, fine) => sum + (Number(fine.amount) || 0), 0),
  };
}

export function calculateMemberCompleteness(member, linkedAccount) {
  const checks = [
    { key: "name", label: "name", complete: Boolean(text(member?.name, 160)), weight: 1 },
    { key: "email", label: "email", complete: Boolean(normalizeMemberEmail(member?.email)), weight: 1 },
    { key: "rid", label: "RID", complete: Boolean(normalizeMemberRid(member?.rid)), weight: 0.5 },
    { key: "status", label: "active status", complete: typeof member?.active === "boolean", weight: 1 },
    {
      key: "position",
      label: "role or position",
      complete: Boolean(text(member?.role, 80) || text(member?.position, 180)),
      weight: 1,
    },
    { key: "account", label: "approved linked account", complete: Boolean(linkedAccount), weight: 1 },
  ];
  const completeWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earnedWeight = checks.reduce((sum, check) => sum + (check.complete ? check.weight : 0), 0);

  return {
    score: Math.round((earnedWeight / completeWeight) * 100),
    missing: checks.filter((check) => !check.complete).map((check) => check.label),
  };
}

export function buildMemberOperationsRows({
  members = [],
  users = [],
  attendance = {},
  events = [],
  fines = [],
} = {}) {
  const accounts = buildApprovedAccountMaps(users);
  const nameCounts = new Map();
  const emailCounts = new Map();
  const ridCounts = new Map();

  members.forEach((member) => {
    const name = normalizeMemberName(member.name);
    const email = normalizeMemberEmail(member.email);
    const rid = normalizeMemberRid(member.rid);
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    if (rid) ridCounts.set(rid, (ridCounts.get(rid) || 0) + 1);
  });

  return members.map((member) => {
    const email = normalizeMemberEmail(member.email);
    const name = normalizeMemberName(member.name);
    const rid = normalizeMemberRid(member.rid);
    const linkedAccount = email ? accounts.byEmail.get(email) || null : null;
    const possibleNameMatches = !linkedAccount && name ? accounts.byName.get(name) || [] : [];
    const accountEmailMismatch = Boolean(
      email
      && !linkedAccount
      && possibleNameMatches.some((user) => normalizeMemberEmail(user.email) !== email)
    );
    const attendanceSummary = attendanceSummaryFor(member.id, attendance, events);
    const fineSummary = fineSummaryFor(member, fines);
    const completeness = calculateMemberCompleteness(member, linkedAccount);
    const positionLabel = text(member.position, 180) || text(member.role, 80);

    return {
      ...member,
      normalizedName: name,
      normalizedEmail: email,
      normalizedRid: rid,
      initials: memberInitials(member.name),
      positionLabel,
      linkedAccount,
      possibleNameMatches,
      accountLinked: Boolean(linkedAccount),
      accountEmailMismatch,
      attendanceSummary,
      fineSummary,
      completeness,
      duplicateName: Boolean(name && nameCounts.get(name) > 1),
      duplicateEmail: Boolean(email && emailCounts.get(email) > 1),
      duplicateRid: Boolean(rid && ridCounts.get(rid) > 1),
    };
  });
}

export function getMemberAttentionItems(rows) {
  const items = [
    {
      key: "missingEmail",
      label: "Missing email",
      count: rows.filter((row) => !row.normalizedEmail).length,
    },
    {
      key: "missingRid",
      label: "RID not recorded",
      count: rows.filter((row) => !row.normalizedRid).length,
    },
    {
      key: "inactive",
      label: "Inactive record entries",
      count: rows.filter((row) => row.active === false).length,
    },
    {
      key: "missingPosition",
      label: "Missing role or position",
      count: rows.filter((row) => !row.positionLabel).length,
    },
    {
      key: "unlinkedAccount",
      label: "No approved account link",
      count: rows.filter((row) => row.normalizedEmail && !row.accountLinked).length,
    },
    {
      key: "duplicateName",
      label: "Duplicate names",
      count: rows.filter((row) => row.duplicateName).length,
    },
    {
      key: "duplicateEmail",
      label: "Duplicate emails",
      count: rows.filter((row) => row.duplicateEmail).length,
    },
    {
      key: "duplicateRid",
      label: "Duplicate RID",
      count: rows.filter((row) => row.duplicateRid).length,
    },
    {
      key: "accountEmailMismatch",
      label: "Account email mismatch",
      count: rows.filter((row) => row.accountEmailMismatch).length,
    },
  ];

  return items.filter((item) => item.count > 0);
}

export function rowMatchesIssue(row, issueKey) {
  if (!issueKey) return true;
  if (issueKey === "missingEmail") return !row.normalizedEmail;
  if (issueKey === "missingRid") return !row.normalizedRid;
  if (issueKey === "inactive") return row.active === false;
  if (issueKey === "missingPosition") return !row.positionLabel;
  if (issueKey === "unlinkedAccount") return row.normalizedEmail && !row.accountLinked;
  if (issueKey === "duplicateName") return row.duplicateName;
  if (issueKey === "duplicateEmail") return row.duplicateEmail;
  if (issueKey === "duplicateRid") return row.duplicateRid;
  if (issueKey === "accountEmailMismatch") return row.accountEmailMismatch;
  if (issueKey === "incomplete") return row.completeness.score < 100;
  return true;
}

export function filterAndSortMemberRows(rows, {
  search = "",
  status = "all",
  position = "all",
  sort = "nameAsc",
  issue = "",
} = {}) {
  const query = normalizeKey(search);
  const filtered = rows.filter((row) => {
    const haystack = normalizeKey(`${row.name} ${row.email} ${row.normalizedRid} ${row.positionLabel}`);
    if (query && !haystack.includes(query)) return false;
    if (status === "active" && row.active === false) return false;
    if (status === "inactive" && row.active !== false) return false;
    if (position !== "all" && row.positionLabel !== position) return false;
    return rowMatchesIssue(row, issue);
  });

  return [...filtered].sort((a, b) => {
    if (sort === "nameDesc") return b.normalizedName.localeCompare(a.normalizedName);
    if (sort === "activeFirst") return Number(b.active !== false) - Number(a.active !== false) || a.normalizedName.localeCompare(b.normalizedName);
    if (sort === "incompleteFirst") return a.completeness.score - b.completeness.score || a.normalizedName.localeCompare(b.normalizedName);
    return a.normalizedName.localeCompare(b.normalizedName);
  });
}

export function getMemberOperationsModel(input = {}, controls = {}) {
  const rows = buildMemberOperationsRows(input);
  const attentionItems = getMemberAttentionItems(rows);
  const filteredRows = filterAndSortMemberRows(rows, controls);
  const activeMembers = rows.filter((row) => row.active !== false).length;
  const linkedCount = rows.filter((row) => row.accountLinked).length;
  const withFineRecords = rows.filter((row) => row.fineSummary.count > 0).length;
  const noAttendanceResponses = rows.filter((row) => row.attendanceSummary.recorded === 0).length;

  return {
    rows,
    filteredRows,
    attentionItems,
    metrics: {
      total: rows.length,
      active: activeMembers,
      inactive: rows.length - activeMembers,
      activePercent: rows.length ? Math.round((activeMembers / rows.length) * 100) : 0,
      linkedPercent: rows.length ? Math.round((linkedCount / rows.length) * 100) : 0,
      missingEmail: rows.filter((row) => !row.normalizedEmail).length,
      missingRid: rows.filter((row) => !row.normalizedRid).length,
      missingPosition: rows.filter((row) => !row.positionLabel).length,
      duplicateRid: rows.filter((row) => row.duplicateRid).length,
      accountEmailMismatch: rows.filter((row) => row.accountEmailMismatch).length,
      withFineRecords,
      noAttendanceResponses,
    },
    positionOptions: [...new Set(rows.map((row) => row.positionLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  };
}

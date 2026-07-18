const DEFAULT_COLUMNS = 3;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function slug(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableIdentifier(value) {
  const text = cleanText(value);
  return text && !/[\s/]/.test(text) ? text : "";
}

export function getBodMemberId(member = {}) {
  return stableIdentifier(member.profileId)
    || stableIdentifier(member.id)
    || slug(`${cleanText(member.name)}-${cleanText(member.role)}`);
}

export function getBodColumnCount() {
  return DEFAULT_COLUMNS;
}

export function createBodDisclosureState() {
  return { activeMemberId: null, queuedMemberId: null, closing: false };
}

export function toggleBodDisclosure(state, memberId) {
  const current = state || createBodDisclosureState();
  const nextId = cleanText(memberId) || null;
  if (!nextId) return current;

  if (current.closing) {
    return {
      ...current,
      queuedMemberId: current.queuedMemberId === nextId ? null : nextId,
    };
  }

  if (current.activeMemberId === nextId) {
    return { activeMemberId: null, queuedMemberId: null, closing: true };
  }

  if (current.activeMemberId) {
    return { activeMemberId: null, queuedMemberId: nextId, closing: true };
  }

  return { activeMemberId: nextId, queuedMemberId: null, closing: false };
}

export function finishBodDisclosureClose(state) {
  const queuedMemberId = cleanText(state?.queuedMemberId) || null;
  return { activeMemberId: queuedMemberId, queuedMemberId: null, closing: false };
}

export function cancelQueuedBodDisclosure(state) {
  return { ...(state || createBodDisclosureState()), queuedMemberId: null };
}

export function chunkBodMembers(members, columnCount) {
  const source = Array.isArray(members) ? members : [];
  const size = [1, 2, 3].includes(columnCount) ? columnCount : DEFAULT_COLUMNS;
  const rows = [];

  for (let index = 0; index < source.length; index += size) {
    rows.push(source.slice(index, index + size));
  }

  return rows;
}

export function getBodDetailRowIndex(rows, activeMemberId) {
  if (!activeMemberId || !Array.isArray(rows)) return -1;
  return rows.findIndex((row) => row.some((member) => getBodMemberId(member) === activeMemberId));
}

export function getBodMemberAvenue(member = {}) {
  if (Array.isArray(member.avenue)) {
    const values = member.avenue.map(cleanText).filter(Boolean);
    return values.length ? values.join(" · ") : null;
  }

  return cleanText(member.avenue) || null;
}

export function getBodAccentCategory(role = "") {
  const normalizedRole = cleanText(role).toLowerCase();
  if (normalizedRole === "president") return "president";
  if (/vice president|secretary|treasurer|immediate past president/.test(normalizedRole)) return "executive";
  if (/website|editor|public relations/.test(normalizedRole)) return "digital";
  if (/service director|development director|diversity/.test(normalizedRole)) return "service";
  return "specialist";
}

export function getInstagramProfile(member = {}) {
  const handle = cleanText(member.handle);
  const instagram = cleanText(member.instagram);

  if (instagram) {
    try {
      const url = new URL(instagram);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return { href: url.href, label: handle || url.hostname };
      }
    } catch {
      // A verified handle can still provide the safe fallback below.
    }
  }

  if (/^@[a-z0-9._]+$/i.test(handle)) {
    return {
      href: `https://www.instagram.com/${handle.slice(1)}/`,
      label: handle,
    };
  }

  return null;
}

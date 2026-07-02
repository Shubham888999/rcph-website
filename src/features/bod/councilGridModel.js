import {
  cancelQueuedBodDisclosure,
  chunkBodMembers,
  createBodDisclosureState,
  finishBodDisclosureClose,
  getBodColumnCount,
  getBodMemberId,
  getInstagramProfile,
  toggleBodDisclosure,
} from "./bodGridModel.js";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getCouncilMembers(groups) {
  if (!Array.isArray(groups)) return [];

  return groups.flatMap((group) => {
    const councilGroup = cleanText(group?.title);
    const members = Array.isArray(group?.members) ? group.members : [];
    return members.map((member) => ({ ...member, councilGroup }));
  });
}

export function getCouncilMemberId(member) {
  return `council-${getBodMemberId(member)}`;
}

export function getCouncilColumnCount() {
  return getBodColumnCount();
}

export function chunkCouncilMembers(members) {
  return chunkBodMembers(members, getCouncilColumnCount());
}

export function getCouncilDetailRowIndex(rows, activeMemberId) {
  if (!activeMemberId || !Array.isArray(rows)) return -1;
  return rows.findIndex((row) => row.some((member) => getCouncilMemberId(member) === activeMemberId));
}

export function isCouncilMemberExpandable(member = {}) {
  return Boolean(
    cleanText(member.responsibility)
    || cleanText(member.bio)
    || cleanText(member.context)
    || cleanText(member.councilGroup)
    || getInstagramProfile(member),
  );
}

export function getCouncilInstagramProfile(member) {
  return getInstagramProfile(member);
}

export const createCouncilDisclosureState = createBodDisclosureState;
export const toggleCouncilDisclosure = toggleBodDisclosure;
export const finishCouncilDisclosureClose = finishBodDisclosureClose;
export const cancelQueuedCouncilDisclosure = cancelQueuedBodDisclosure;

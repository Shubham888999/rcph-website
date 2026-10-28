import { getBodMemberId } from "./bodGridModel.js";

export function createBookState() {
  return { openId: null, closingId: null, queuedId: null };
}

// Keep the old spread in the grid until its leaf has finished folding shut.
export function selectBook(state, id) {
  if (!id) return state;
  if (state.closingId) return { ...state, queuedId: state.queuedId === id ? null : id };
  if (state.openId) return { openId: null, closingId: state.openId, queuedId: state.openId === id ? null : id };
  return { openId: id, closingId: null, queuedId: null };
}

export function finishBookClose(state, id) {
  if (state.closingId !== id) return state;
  return { openId: state.queuedId, closingId: null, queuedId: null };
}

export function getBookIdentity(member, section) {
  return `${section}-${getBodMemberId(member)}`;
}

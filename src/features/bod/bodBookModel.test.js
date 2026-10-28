import assert from "node:assert/strict";
import test from "node:test";
import { createBookState, finishBookClose, selectBook } from "./bodBookModel.js";

test("switching books keeps the old spread reserved until its leaf closes", () => {
  const open = selectBook(createBookState(), "a");
  assert.deepEqual(open, { openId: "a", closingId: null, queuedId: null });
  const closing = selectBook(open, "b");
  assert.deepEqual(closing, { openId: null, closingId: "a", queuedId: "b" });
  assert.equal(finishBookClose(closing, "unrelated"), closing);
  assert.deepEqual(finishBookClose(closing, "a"), { openId: "b", closingId: null, queuedId: null });
});

test("rapid selections replace or cancel the queued book without losing the closing leaf", () => {
  let state = selectBook(selectBook(createBookState(), "a"), "b");
  state = selectBook(state, "c");
  assert.equal(state.closingId, "a");
  assert.equal(state.queuedId, "c");
  state = selectBook(state, "c");
  assert.deepEqual(finishBookClose(state, "a"), createBookState());
  state = selectBook(selectBook(createBookState(), "a"), "a");
  assert.deepEqual(finishBookClose(state, "a"), createBookState());
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getMagazineNavigation, magazinePointerPosition } from "./bodMagazineModel.js";

test("magazine navigation follows current member order, wraps and skips unavailable profiles", () => {
  const members = [{ id: "a", ready: true }, { id: "b", ready: false }, { id: "c", ready: true }];
  const getId = member => member.id;
  const ready = member => member.ready;
  let navigation = getMagazineNavigation(members, "a", getId, ready);
  assert.equal(navigation.index, 0);
  assert.equal(navigation.count, 2);
  assert.equal(navigation.previous.id, "c");
  assert.equal(navigation.next.id, "c");
  navigation = getMagazineNavigation([...members].reverse(), "c", getId);
  assert.equal(navigation.next.id, "b");
  assert.equal(navigation.previous.id, "a");
  for (const input of [[], [{ id: "a" }]]) {
    const result = getMagazineNavigation(input, "a", getId);
    assert.equal(result.next, null);
    assert.equal(result.previous, null);
  }
  assert.equal(getMagazineNavigation(members, "removed", getId).index, -1);
});

test("cover tilt normalizes local pointer coordinates and stays bounded off the card", () => {
  const element = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 400 }) };
  assert.deepEqual(magazinePointerPosition({ clientX: 110, clientY: 220 }, element), { x: 0, y: 0 });
  assert.deepEqual(magazinePointerPosition({ clientX: -100, clientY: 1000 }, element), { x: -0.5, y: 0.5 });
  assert.deepEqual(magazinePointerPosition({ clientX: 0, clientY: 0 }, { getBoundingClientRect: () => ({ width: 0, height: 0 }) }), { x: 0, y: 0 });
});

test("public BOD themes stay scoped and include light and reduced-motion variants", () => {
  for (const theme of ["magazine", "blueprint", "books"]) {
    const css = readFileSync(new URL(`../../styles/components/bod-${theme}.css`, import.meta.url), "utf8");
    const selectors = [...css.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map(match => match[1].trim());
    for (const selector of selectors) {
      if (selector.startsWith("@") || selector === "to" || selector.startsWith("/*")) continue;
      assert.ok(selector.split("\n").every(part => part.includes(`.bod-page-react--${theme}`)), selector);
    }
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /data-theme="light"/);
  }
});

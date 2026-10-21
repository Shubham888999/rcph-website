import assert from "node:assert/strict";
import test from "node:test";
import {
  CARROT_FIELD,
  angleDelta,
  bounceCarrot,
  carrotCountForWidth,
  carrotTransform,
  createCarrot,
  pickCarrotHeading,
  steerVelocity,
  stepCarrot,
  turnToward,
} from "./carrotFieldModel.js";

// Deterministic mulberry32 so every run sees the same "random" sequence.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const constant = (value) => () => value;
const BOUNDS = { width: 1280, height: 800 };

test("carrot count follows the viewport width", () => {
  assert.equal(carrotCountForWidth(375), 3);
  assert.equal(carrotCountForWidth(759), 3);
  assert.equal(carrotCountForWidth(760), 5);
  assert.equal(carrotCountForWidth(1023), 5);
  assert.equal(carrotCountForWidth(1024), 8);
  assert.equal(carrotCountForWidth(1920), 8);
});

test("every carrot uses the single small, faint config", () => {
  const random = seeded(7);
  const within = (value, min, max) => value >= min - 1e-9 && value <= max + 1e-9;
  for (let index = 0; index < 500; index += 1) {
    const carrot = createCarrot(BOUNDS, random);
    assert.equal(carrot.opacity, 0.15);
    assert.ok(within(carrot.height, 50, 75), `height ${carrot.height}`);
    assert.equal(carrot.width, Math.round(carrot.height * 0.4));
    assert.ok(carrot.x >= 0 && carrot.x <= BOUNDS.width - carrot.width);
    assert.ok(carrot.y >= 0 && carrot.y <= BOUNDS.height - carrot.height);
    assert.ok(carrot.angle >= -180 && carrot.angle <= 180);
    assert.ok(carrot.flip === 1 || carrot.flip === -1);
    assert.ok(carrot.turnIn >= 2 && carrot.turnIn <= 6);
    assert.ok(within(Math.hypot(carrot.vx, carrot.vy), 12, 22), "speed");
    assert.ok(within(Math.hypot(carrot.targetVx, carrot.targetVy), 12, 22), "target speed");
    const later = stepCarrot({ ...carrot, turnIn: 0 }, 0.05, BOUNDS, random);
    assert.ok(within(Math.hypot(later.targetVx, later.targetVy), 12, 22), "new heading speed");
  }
  assert.equal(createCarrot(BOUNDS, constant(0.2)).flip, -1);
  assert.equal(createCarrot(BOUNDS, constant(0.8)).flip, 1);
  assert.deepEqual(
    [CARROT_FIELD.opacity, CARROT_FIELD.minHeight, CARROT_FIELD.maxHeight, CARROT_FIELD.minSpeed, CARROT_FIELD.maxSpeed, CARROT_FIELD.maxTurnDegrees, CARROT_FIELD.wobbleDegrees],
    [0.15, 50, 75, 12, 22, 30, 8],
  );
});

test("headings cover the 12-22 px/s speed range at the extremes", () => {
  assert.ok(Math.abs(Math.hypot(...Object.values(pickCarrotHeading(constant(0)))) - 12) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...Object.values(pickCarrotHeading(constant(0.999999)))) - 22) < 0.001);
});

test("steering eases toward the target without overshooting", () => {
  const target = { vx: 40, vy: -20 };
  let velocity = { vx: -30, vy: 10 };
  let previousGap = Infinity;
  for (let frame = 0; frame < 400; frame += 1) {
    const next = steerVelocity(velocity, target, 0.05);
    assert.ok(next.vx >= velocity.vx && next.vx <= target.vx, "x moves toward the target and never past it");
    assert.ok(next.vy <= velocity.vy && next.vy >= target.vy, "y moves toward the target and never past it");
    const gap = Math.hypot(target.vx - next.vx, target.vy - next.vy);
    assert.ok(gap < previousGap || gap === 0);
    previousGap = gap;
    velocity = next;
  }
  assert.ok(previousGap < 0.01, "it arrives");
  assert.deepEqual(steerVelocity({ vx: 5, vy: 5 }, target, 0), { vx: 5, vy: 5 }, "zero dt changes nothing");
  const first = steerVelocity({ vx: 0, vy: 0 }, { vx: 10, vy: 0 }, 0.05);
  assert.ok(first.vx > 0 && first.vx < 10, "a single step never snaps");
});

test("bounce keeps the carrot box inside the viewport and reflects the heading", () => {
  const base = { width: 40, height: 100, vx: -30, vy: 25, targetVx: -20, targetVy: 15 };
  const left = bounceCarrot({ ...base, x: -12, y: 300 }, BOUNDS);
  assert.equal(left.x, 0);
  assert.ok(left.vx > 0 && left.targetVx > 0);
  assert.equal(left.vy, 25, "the other axis is untouched");
  const bottomRight = bounceCarrot({ ...base, vx: 30, targetVx: 20, x: 1300, y: 760 }, BOUNDS);
  assert.equal(bottomRight.x, BOUNDS.width - 40);
  assert.equal(bottomRight.y, BOUNDS.height - 100);
  assert.ok(bottomRight.vx < 0 && bottomRight.vy < 0 && bottomRight.targetVy < 0);
  const inside = { ...base, x: 300, y: 300 };
  assert.deepEqual(bounceCarrot(inside, BOUNDS), inside);
});

test("stepping keeps every carrot on screen, turns at most 30°/s and clamps dt", () => {
  const random = seeded(42);
  let carrots = Array.from({ length: carrotCountForWidth(1280) }, () => createCarrot(BOUNDS, random));
  let maxTurnSeen = 0;
  for (let frame = 0; frame < 3000; frame += 1) {
    carrots = carrots.map((carrot) => {
      const next = stepCarrot(carrot, 1 / 60, BOUNDS, random);
      assert.ok(next.x >= 0 && next.x <= BOUNDS.width - next.width);
      assert.ok(next.y >= 0 && next.y <= BOUNDS.height - next.height);
      const turnRate = Math.abs(angleDelta(carrot.angle, next.angle)) * 60;
      assert.ok(turnRate <= 30 + 1e-6, `turned ${turnRate}°/s`);
      maxTurnSeen = Math.max(maxTurnSeen, turnRate);
      return next;
    });
  }
  assert.ok(maxTurnSeen > 20, "the cap is actually reached in practice");
  const carrot = { ...createCarrot(BOUNDS, seeded(3)), x: 600, y: 300, vx: 20, vy: 0, targetVx: 20, targetVy: 0, turnIn: 5 };
  const longFrame = stepCarrot(carrot, 2, BOUNDS, seeded(3));
  assert.ok(Math.abs(longFrame.x - 600) <= 20 * 0.05 + 1e-9, "a 2 s frame moves like 50 ms");
  const retarget = stepCarrot({ ...carrot, turnIn: 0.01 }, 0.05, BOUNDS, seeded(9));
  assert.ok(retarget.turnIn >= 2 && retarget.turnIn <= 6, "a new heading every 2-6 s");
});

test("angle helpers take the short way round", () => {
  assert.equal(angleDelta(170, -170), 20);
  assert.equal(angleDelta(-170, 170), -20);
  assert.equal(angleDelta(0, 180), 180);
  assert.equal(turnToward(0, 90, 10), 10);
  assert.equal(turnToward(0, -90, 10), -10);
  assert.equal(turnToward(0, 5, 10), 5);
});

test("transforms are translate3d, rotate, then the horizontal flip", () => {
  assert.equal(
    carrotTransform({ x: 10, y: 20.25, angle: -12.5, flip: -1 }),
    "translate3d(10.0px, 20.3px, 0) rotate(-12.50deg) scaleX(-1)",
  );
});

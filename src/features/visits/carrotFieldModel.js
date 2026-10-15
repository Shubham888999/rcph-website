// Background carrots for the DZR carrot theme. Pure maths only: every
// function takes the random source as an argument so tests can seed it.

export const CARROT_FIELD = Object.freeze({
  widthRatio: 0.4,
  minTurnSeconds: 2,
  maxTurnSeconds: 6,
  steerRate: 1.6,
  wobbleDegrees: 8,
  maxStepSeconds: 0.05,
});

// Three depth layers, the same in light and dark. Far carrots are small,
// faint, slow and turn a little slower so they read as distant.
export const CARROT_LAYERS = Object.freeze({
  near: Object.freeze({ opacity: [1, 1], height: [120, 150], speed: [30, 45], maxTurnDegrees: 40 }),
  mid: Object.freeze({ opacity: [0.5, 0.5], height: [85, 110], speed: [20, 30], maxTurnDegrees: 40 }),
  far: Object.freeze({ opacity: [0.1, 0.2], height: [50, 75], speed: [10, 18], maxTurnDegrees: 30 }),
});

export function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

export function carrotCountForWidth(width) {
  if (width >= 1024) return 8;
  if (width >= 760) return 5;
  return 3;
}

// near = min(2, total) (1 on a phone), then the rest splits mid/far with
// any odd one going to far.
export function carrotLayerCounts(total, width = Infinity) {
  const count = Math.max(0, Math.floor(Number(total) || 0));
  const near = Math.min(width < 760 ? 1 : 2, count);
  const rest = count - near;
  const mid = Math.floor(rest / 2);
  return { near, mid, far: rest - mid };
}

// The layer of every carrot for a viewport width, nearest first.
export function carrotLayersForWidth(width) {
  const { near, mid, far } = carrotLayerCounts(carrotCountForWidth(width), width);
  return [
    ...Array(near).fill("near"),
    ...Array(mid).fill("mid"),
    ...Array(far).fill("far"),
  ];
}

function layerSettings(layer) {
  return CARROT_LAYERS[layer] || CARROT_LAYERS.mid;
}

// A new travel target: random heading at the layer's speed.
export function pickCarrotHeading(random, layer = "mid") {
  const heading = random() * Math.PI * 2;
  const speed = randomBetween(random, ...layerSettings(layer).speed);
  return { vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed };
}

// Eases velocity toward the target; the factor stays below 1, so it never
// overshoots or snaps.
export function steerVelocity(velocity, target, dt, rate = CARROT_FIELD.steerRate) {
  const factor = 1 - Math.exp(-rate * Math.max(0, dt));
  return {
    vx: velocity.vx + (target.vx - velocity.vx) * factor,
    vy: velocity.vy + (target.vy - velocity.vy) * factor,
  };
}

// Keeps the carrot box inside the viewport and reflects the heading (both
// the current and the target velocity) off the edge it touched.
export function bounceCarrot(carrot, bounds) {
  const maxX = Math.max(0, bounds.width - carrot.width);
  const maxY = Math.max(0, bounds.height - carrot.height);
  const next = { ...carrot };
  if (next.x < 0 || next.x > maxX) {
    const sign = next.x < 0 ? 1 : -1;
    next.x = Math.min(maxX, Math.max(0, next.x));
    next.vx = sign * Math.abs(next.vx);
    next.targetVx = sign * Math.abs(next.targetVx);
  }
  if (next.y < 0 || next.y > maxY) {
    const sign = next.y < 0 ? 1 : -1;
    next.y = Math.min(maxY, Math.max(0, next.y));
    next.vy = sign * Math.abs(next.vy);
    next.targetVy = sign * Math.abs(next.targetVy);
  }
  return next;
}

// Shortest signed difference between two angles, in degrees (-180..180].
export function angleDelta(from, to) {
  const delta = (((to - from) % 360) + 540) % 360 - 180;
  return delta === -180 ? 180 : delta;
}

export function turnToward(angle, target, maxStep) {
  const delta = angleDelta(angle, target);
  return angle + Math.max(-maxStep, Math.min(maxStep, delta));
}

export function createCarrot(bounds, random, layer = "mid") {
  const settings = layerSettings(layer);
  const height = Math.round(randomBetween(random, ...settings.height));
  const width = Math.round(height * CARROT_FIELD.widthRatio);
  const velocity = pickCarrotHeading(random, layer);
  const target = pickCarrotHeading(random, layer);
  return {
    layer,
    height,
    width,
    x: random() * Math.max(0, bounds.width - width),
    y: random() * Math.max(0, bounds.height - height),
    angle: randomBetween(random, -180, 180),
    flip: random() < 0.5 ? -1 : 1,
    opacity: randomBetween(random, ...settings.opacity),
    vx: velocity.vx,
    vy: velocity.vy,
    targetVx: target.vx,
    targetVy: target.vy,
    turnIn: randomBetween(random, CARROT_FIELD.minTurnSeconds, CARROT_FIELD.maxTurnSeconds),
    wobblePhase: random() * Math.PI * 2,
    wobbleSpeed: randomBetween(random, 0.3, 0.7),
  };
}

// One animation step. dt is in seconds and clamped to 50 ms.
export function stepCarrot(carrot, rawDt, bounds, random) {
  const dt = Math.min(CARROT_FIELD.maxStepSeconds, Math.max(0, rawDt));
  let next = { ...carrot, turnIn: carrot.turnIn - dt };
  if (next.turnIn <= 0) {
    const target = pickCarrotHeading(random, next.layer);
    next.targetVx = target.vx;
    next.targetVy = target.vy;
    next.turnIn = randomBetween(random, CARROT_FIELD.minTurnSeconds, CARROT_FIELD.maxTurnSeconds);
  }
  const velocity = steerVelocity(next, { vx: next.targetVx, vy: next.targetVy }, dt);
  next.vx = velocity.vx;
  next.vy = velocity.vy;
  next.x += next.vx * dt;
  next.y += next.vy * dt;
  next = bounceCarrot(next, bounds);
  // The image points its tip down (+90°), so travel angle - 90° faces the tip forward.
  next.wobblePhase += next.wobbleSpeed * dt;
  const travel = (Math.atan2(next.vy, next.vx) * 180) / Math.PI - 90;
  const desired = travel + Math.sin(next.wobblePhase) * CARROT_FIELD.wobbleDegrees;
  next.angle = turnToward(next.angle, desired, layerSettings(next.layer).maxTurnDegrees * dt);
  return next;
}

export function carrotTransform(carrot) {
  const x = carrot.x.toFixed(1);
  const y = carrot.y.toFixed(1);
  return `translate3d(${x}px, ${y}px, 0) rotate(${carrot.angle.toFixed(2)}deg) scaleX(${carrot.flip})`;
}

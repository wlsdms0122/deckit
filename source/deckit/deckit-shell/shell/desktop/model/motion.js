import { SPRING, lengthOf } from '../../../../deckit-sdk/shell/ui/token/index.js';

// MARK: - Property
// What a window's frame is drawn with: its rect and its opacity.
const PARTS = Object.freeze(['x', 'y', 'width', 'height', 'opacity']);
// What a travel of known px settles to, as the token module's `over` has it: half a px of it, within these.
const REST = Object.freeze({ least: 0.0005, most: 0.05 });
// How much of its rect a window opens from and closes to, about its middle.
const SCALE = 0.96;

// MARK: - Initializer
// MARK: - Public
// A motion of what is drawn from `from`, `{ x, y, width, height, opacity }`, to `to`, by the spring of the role `role`
// of the token module (enter, exit, move), started at `now` ms with the speed `velocity` per part in units per s, as a
// motion it cuts short left it: each part is a spring with damping 1, so it comes to rest without passing `to`, its
// speed towards it held at what that leaves. It lasts as `MOTION.over(role, px)` does for the longest way a part of
// the rect goes, or for the role's own rest where nothing of the rect moves.
function motionOf({ from, to, role, now, velocity = {} }) {
    const spring = SPRING[role];
    const w = (2 * Math.PI) / spring.response;
    const way = Math.max(...PARTS.slice(0, 4).map((part) => Math.abs(to[part] - from[part])));
    const rest = way > 0 ? Math.min(REST.most, Math.max(REST.least, 0.5 / way)) : spring.rest;
    const parts = Object.fromEntries(
        PARTS.map((part) => {
            const away = from[part] - to[part];
            const toward = -Math.sign(away) * (velocity[part] ?? 0);
            const speed = away === 0 ? 0 : -Math.sign(away) * Math.min(toward, w * Math.abs(away));
            return [part, { away, slope: speed + w * away }];
        })
    );
    return Object.freeze({ from, to, w, start: now, length: lengthOf({ ...spring, rest }), parts });
}

// Where `motion` has what is drawn at `now`: `{ value, velocity, done }`, `value` and `velocity` per part, `done` once
// it lasted its length, `value` then its `to`.
function motionAt(motion, now) {
    const t = Math.max(0, now - motion.start) / 1000;
    if (t * 1000 >= motion.length)
        return { value: { ...motion.to }, velocity: Object.fromEntries(PARTS.map((part) => [part, 0])), done: true };
    const fall = Math.exp(-motion.w * t);
    const value = {};
    const velocity = {};
    for (const part of PARTS) {
        const { away, slope } = motion.parts[part];
        value[part] = motion.to[part] + (away + slope * t) * fall;
        velocity[part] = (slope - motion.w * (away + slope * t)) * fall;
    }
    return { value, velocity, done: false };
}

// The rect `rect` grown or shrunk by `scale` about its middle.
function scaled(rect, scale = SCALE) {
    const width = rect.width * scale;
    const height = rect.height * scale;
    return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
}

// What is drawn of a window going into its Dock tile, or coming out of it, at `opacity` of the way from the tile: it
// shows whole until the last third of its way in, and fades through that third.
function lateOpacity(opacity) {
    return Math.min(1, Math.max(0, 3 * opacity));
}

// MARK: - Private

export { PARTS, SCALE, motionOf, motionAt, scaled, lateOpacity };

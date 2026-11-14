// The game the load-failure page plays (load-failure.js), as a model with no drawing: an envelope on a cable that keeps
// travelling, a press making it hop over the plugs pulled out of the line and the stop signs on it, faster as it goes,
// a point for each 10px it travels. Units are CSS px and seconds; `random()` answers a number from 0 up to 1.

// The game's height, and where the line runs across it, from its top.
const HEIGHT = 140;
const LINE = 112;
// The envelope, at its place from the game's start.
const FIGURE = { x: 44, width: 26, height: 18 };
const SPEED = { start: 300, gain: 9, most: 640 };
const GRAVITY = 2800;
const JUMP = 700;
// How long a press in the air is kept, to jump as the envelope lands.
const BUFFER = 0.12;
// The gap after an obstacle, in seconds at the speed then; never under the time in the air with room to land.
const GAP = { least: 0.7, most: 1.55, floor: 0.62 };
// How long a run that has ended takes no press, so the press that struck does not start another.
const REST = 0.5;
// What hits is a box inset this much on each side.
const INSET = 3;
// What comes along the line: its width and height, and the score from which it comes.
const KINDS = {
    plug: { width: 14, height: 22, from: 0 },
    sign: { width: 18, height: 34, from: 120 },
    plugs: { width: 36, height: 22, from: 250 },
};
const POINT = 10;

// A run at rest, `phase` 'rest', until the first press; 'running'; then 'over' once the envelope strikes.
function createRun({ random = Math.random, width = 600 } = {}) {
    let phase = 'rest';
    let time = 0;
    let speed = SPEED.start;
    let distance = 0;
    let since = 0; // since the run ended
    let air = 0; // the envelope's height over the line
    let climb = 0; // and how fast it rises
    let kept = null; // when a press in the air was made
    let obstacles = [];
    let next = 0; // the distance at which the next obstacle comes in at the game's end
    let view = width;
    standFirst();

    return { press, step, resize, state };

    // A press starts a run at rest and jumps; one on the line jumps, one in the air is kept a moment; once a run has
    // ended and rested, it starts another.
    function press() {
        if (phase === 'over') {
            if (since < REST) return;
            reset();
        }
        if (phase === 'rest') phase = 'running';
        if (air === 0 && climb === 0) climb = JUMP;
        else kept = time;
    }

    // The run `seconds` on: the envelope rises and falls, what is on the line comes by, and a strike ends the run.
    function step(seconds) {
        if (phase === 'over') since += seconds;
        if (phase !== 'running' || seconds <= 0) return;
        time += seconds;
        speed = Math.min(SPEED.most, SPEED.start + SPEED.gain * time);
        distance += speed * seconds;
        climb -= GRAVITY * seconds;
        air += climb * seconds;
        if (air <= 0) {
            air = 0;
            climb = kept !== null && time - kept <= BUFFER ? JUMP : 0;
            kept = null;
        }
        for (const one of obstacles) one.x -= speed * seconds;
        obstacles = obstacles.filter((one) => one.x + one.width > -FIGURE.x);
        while (distance >= next) spawn();
        if (obstacles.some(strikes)) {
            phase = 'over';
            since = 0;
        }
    }

    // A wider game shows more of the line ahead.
    function resize(wide) {
        view = Math.max(1, wide);
        if (phase === 'rest') standFirst();
    }

    function state() {
        return {
            phase,
            // whether a press is taken: but in the rest after a run ended
            ready: phase !== 'over' || since >= REST,
            time,
            speed,
            distance,
            score: Math.floor(distance / POINT),
            figure: { ...FIGURE, y: LINE - FIGURE.height - air, climb },
            obstacles: obstacles.map((one) => ({ ...one, y: LINE - one.height })),
            width: view,
            height: HEIGHT,
            line: LINE,
        };
    }

    function reset() {
        phase = 'rest';
        time = distance = since = air = climb = 0;
        speed = SPEED.start;
        kept = null;
        standFirst();
    }

    // A run at rest shows the first plug it will meet, standing still ahead on the line.
    function standFirst() {
        const { width: wide, height } = KINDS.plug;
        const x = Math.max(FIGURE.x + 200, Math.round(view * 0.62));
        obstacles = [{ kind: 'plug', x, width: wide, height }];
        next = x + wide + speed * gapOf() - view;
    }

    function gapOf() {
        return Math.max(GAP.floor, GAP.least + random() * (GAP.most - GAP.least));
    }

    // One obstacle in at the game's end, a kind the score has reached, and the gap after it.
    function spawn() {
        const score = Math.floor(distance / POINT);
        const open = Object.keys(KINDS).filter((kind) => KINDS[kind].from <= score);
        const kind = open[Math.min(open.length - 1, Math.floor(random() * open.length))];
        const { width: wide, height } = KINDS[kind];
        obstacles.push({ kind, x: view + (distance - next), width: wide, height });
        next += wide + speed * gapOf();
    }

    function strikes(one) {
        const top = LINE - FIGURE.height - air;
        return (
            FIGURE.x + INSET < one.x + one.width - INSET &&
            one.x + INSET < FIGURE.x + FIGURE.width - INSET &&
            top + FIGURE.height - INSET > LINE - one.height + INSET
        );
    }
}

module.exports = { createRun, HEIGHT, LINE, FIGURE, SPEED, GRAVITY, JUMP, GAP, REST, KINDS, POINT };

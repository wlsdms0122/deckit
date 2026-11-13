// The game of the Browser's load-failure page (mods/browser/src/game/run.js), as a model: it rests until a press, a
// press jumps and lands, a press in the air jumps on landing, what is on the line strikes the envelope on it and is
// cleared over the top of a jump, the pace rises to its most, the score counts the distance, and a run that ended
// rests before a press starts another. Exits 1 with a line for each check that failed.
const path = require('path');

const GAME = require(path.join(__dirname, '..', '..', 'deckit', 'mods', 'browser', 'src', 'game', 'run.js'));

function main() {
    const { createRun, FIGURE, LINE, SPEED, GRAVITY, JUMP, REST, POINT } = GAME;
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const FRAME = 1 / 60;
    const run = (seconds, game) => {
        for (let at = 0; at < seconds; at += FRAME) game.step(FRAME);
    };
    // A run whose first obstacle is past what a check of under a second reaches.
    const fresh = () => createRun({ random: () => 0.5, width: 600 });
    const rise = (game) => LINE - FIGURE.height - game.state().figure.y;
    // `seconds` of a run played: a press as each obstacle comes near.
    const play = (seconds, game) => {
        for (let at = 0; at < seconds; at += FRAME) {
            const { obstacles, figure, speed } = game.state();
            const near = obstacles.find((one) => one.x + one.width > figure.x);
            if (near && near.x - (figure.x + figure.width) < speed * 0.22 && rise(game) === 0) game.press();
            game.step(FRAME);
        }
    };

    {
        const game = fresh();
        run(2, game);
        const { phase, distance, obstacles } = game.state();
        check(
            'a run rests until a press, its first plug standing ahead',
            phase === 'rest' && distance === 0 && obstacles.length === 1 && obstacles[0].x === 372,
            game.state()
        );
    }
    {
        const game = fresh();
        game.press();
        check('the first press starts the run', game.state().phase === 'running', game.state().phase);
        run(0.2, game);
        const up = rise(game);
        check('a press jumps', up > 40, up);
        let top = 0;
        for (let at = 0; at < 0.6; at += FRAME) {
            game.step(FRAME);
            top = Math.max(top, rise(game));
        }
        const apex = (JUMP * JUMP) / (2 * GRAVITY);
        check('a jump rises as high as its speed takes it, and lands', Math.abs(top - apex) < 10 && rise(game) === 0, {
            top,
            apex,
            now: rise(game),
        });
    }
    {
        const game = fresh();
        game.press();
        run(0.42, game);
        game.press();
        run(0.12, game);
        const again = rise(game);
        check('a press just before landing jumps as the envelope lands', again > 10, again);
        const game2 = fresh();
        game2.press();
        run(0.1, game2);
        game2.press();
        run(0.5, game2);
        check('a press early in a jump is dropped', rise(game2) === 0, rise(game2));
    }
    {
        // Every obstacle a plug, one after another: standing still on the line, the envelope strikes the first.
        const game = createRun({ random: () => 0, width: 600 });
        game.press();
        run(3, game);
        const { phase, obstacles } = game.state();
        check('what is on the line strikes the envelope on it', phase === 'over', { phase, obstacles });
        const at = game.state().distance;
        run(1, game);
        check('a run that has ended stays where it is', game.state().distance === at, game.state().distance);
    }
    {
        // The same line, jumped as each plug comes near: the run goes on.
        const game = createRun({ random: () => 0, width: 600 });
        game.press();
        play(6, game);
        check('an obstacle is cleared over the top of a jump', game.state().phase === 'running', game.state());
    }
    {
        const game = fresh();
        game.press();
        const start = game.state().speed;
        play(5, game);
        const later = game.state().speed;
        check('the pace rises as the run goes on', start === SPEED.start && later > start + 30, { start, later });
        play(60, game);
        check('the pace stops at its most', game.state().speed === SPEED.most, game.state());
    }
    {
        const game = fresh();
        game.press();
        play(1, game);
        const { score, distance } = game.state();
        check('the score is the distance in points', score === Math.floor(distance / POINT) && score > 0, {
            score,
            distance,
        });
    }
    {
        const game = createRun({ random: () => 0, width: 600 });
        game.press();
        for (let at = 0; at < 10 && game.state().phase === 'running'; at += FRAME) game.step(FRAME);
        game.press();
        check('a press just after a strike starts nothing', game.state().phase === 'over', game.state().phase);
        run(REST, game);
        game.press();
        const { phase, score, obstacles } = game.state();
        check(
            'a press once it has rested starts a new run',
            phase === 'running' && score === 0 && obstacles.length === 1,
            {
                phase,
                score,
            }
        );
    }

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} browser game checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} browser game checks`);
}

main();

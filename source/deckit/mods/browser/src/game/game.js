const { createRun, JUMP } = require('./run.js');

// The CSS px between two cable ties on the line, and between two poles behind it, which drift at a quarter of the
// pace.
const TIE = 64;
const MAST = 220;
const DRIFT = 0.25;
// The most the envelope tilts with its climb, in radians (12 degrees).
const TILT = 0.21;
// The longest frame the run is stepped by, so a pause or a slow frame never jumps it on.
const FRAME = 1 / 30;
const BEST = 'game-best';

// The game the load-failure page plays (run.js), drawn on a canvas as wide as its place and crisp at any pixel ratio,
// in the theme's colours, the score and the best in the page's type under it. A press of Space or Up while it has the
// keyboard, or of the pointer on it, starts a run and jumps; it never starts by itself, and runs only while
// `setActive(true)` holds. The best score is kept in `values`.
function game({ ui, theme, values }) {
    ui.addStyle(`
        .browser-game {
            box-sizing: border-box;
            width: 100%;
            padding: 8px 12px;
            border-radius: var(--deckit-radius-medium);
        }
        .browser-game canvas { display: block; width: 100%; touch-action: none; }
        .browser-game-line {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 6px;
            padding: 0 2px;
            color: var(--deckit-muted);
            font: var(--deckit-type-small);
            font-variant-numeric: tabular-nums;
        }
        .browser-game-best { color: var(--deckit-tertiary); }
    `);
    const element = ui.element('div', { className: 'browser-game' });
    element.tabIndex = 0;
    element.setAttribute('role', 'application');
    element.setAttribute('aria-label', 'Game: press Space to jump');
    const canvas = ui.element('canvas');
    const line = ui.element('div', { className: 'browser-game-line' });
    const said = ui.element('span');
    const best = ui.element('span', { className: 'browser-game-best' });
    line.append(said, best);
    element.append(canvas, line);

    let run = createRun({ width: 600 });
    let active = false;
    let frame = 0;
    let last = null;
    let width = 0;
    const offTheme = theme.onChange(draw);
    const sizes = new ResizeObserver(() => fit());
    sizes.observe(element);

    element.addEventListener('keydown', (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key !== ' ' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) press();
    });
    canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        element.focus();
        press();
    });
    fit();

    return { element, setActive, focus: () => element.focus(), release };

    function setActive(on) {
        if (active === on) return;
        active = on;
        last = null;
        if (on) loop();
        else cancelAnimationFrame(frame);
    }

    function release() {
        setActive(false);
        offTheme?.();
        sizes.disconnect();
    }

    function press() {
        if (!active) return;
        run.press();
        loop();
        draw();
    }

    // Steps the run each frame while it moves, and while a run that ended is resting.
    function loop() {
        cancelAnimationFrame(frame);
        const { phase, ready } = run.state();
        if (!active || phase === 'rest' || (phase === 'over' && ready)) return;
        frame = requestAnimationFrame((now) => {
            const seconds = last === null ? 0 : Math.min(FRAME, (now - last) / 1000);
            last = now;
            const was = run.state().phase;
            run.step(seconds);
            if (was === 'running' && run.state().phase === 'over') keep(run.state().score);
            draw();
            loop();
        });
    }

    function keep(score) {
        if (score > values.get(BEST, 0)) values.set(BEST, score);
    }

    // The canvas as wide as its place, its pixels the screen's.
    function fit() {
        const next = Math.round(element.clientWidth) || 600;
        if (next === width && canvas.width) return draw();
        width = next;
        run.resize(width);
        draw();
    }

    function draw() {
        const state = run.state();
        const scale = window.devicePixelRatio || 1;
        const height = state.height;
        if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
        }
        canvas.style.height = height + 'px';
        const context = canvas.getContext('2d');
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.clearRect(0, 0, width, height);
        const { color, motion } = theme;
        const still = motion.move.base === 0;
        drawMasts(context, state, color.divider, still);
        drawLine(context, state, color.tertiary);
        for (const one of state.obstacles) drawObstacle(context, one, state.line, color);
        drawFigure(context, state, color, still);
        const shown = values.get(BEST, 0);
        best.textContent = `Best ${Math.max(shown, state.phase === 'running' ? state.score : 0)}`;
        said.textContent =
            state.phase === 'rest'
                ? 'Press Space to start'
                : state.phase === 'running'
                  ? `Score ${state.score}`
                  : `Score ${state.score}. Press Space to play again.`;
    }

    // Poles far behind the line with a wire sagging between them, which hold still with reduced motion.
    function drawMasts(context, { distance, line }, ink, still) {
        const offset = still ? 0 : (distance * DRIFT) % MAST;
        const top = line - 40;
        context.fillStyle = ink;
        context.strokeStyle = ink;
        context.lineWidth = 1;
        context.beginPath();
        for (let x = MAST / 2 - offset - MAST; x < width + MAST; x += MAST) {
            context.fillRect(x, top, 2, 40);
            context.moveTo(x + 1, top + 4);
            context.quadraticCurveTo(x + 1 + MAST / 2, top + 18, x + 1 + MAST, top + 4);
        }
        context.stroke();
    }

    // The cable, with a tie every TIE px going by.
    function drawLine(context, { distance, line }, fill) {
        context.fillStyle = fill;
        context.fillRect(0, line, width, 2);
        for (let x = -(distance % TIE); x < width; x += TIE) context.fillRect(x, line - 2, 2, 6);
    }

    function drawObstacle(context, { kind, x }, line, color) {
        context.fillStyle = color.muted;
        if (kind === 'sign') {
            context.fillRect(x + 7.5, line - 18, 3, 18);
            context.beginPath();
            context.arc(x + 9, line - 25, 9, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = color.background;
            context.fillRect(x + 4, line - 26.25, 10, 2.5);
            return;
        }
        const plug = (at) => {
            context.beginPath();
            context.roundRect(at, line - 16, 14, 16, 3);
            context.fill();
            context.fillRect(at + 3, line - 22, 3, 6);
            context.fillRect(at + 8, line - 22, 3, 6);
        };
        plug(x);
        if (kind === 'plugs') plug(x + 22);
    }

    // The envelope, tilted with its climb while motion is not reduced; struck, its flap opens.
    function drawFigure(context, { figure, phase }, color, still) {
        const { x, y, width: wide, height: high, climb } = figure;
        context.save();
        context.translate(x + wide / 2, y + high / 2);
        if (!still && phase !== 'over') context.rotate(-TILT * Math.max(-1, Math.min(1, climb / JUMP)));
        context.fillStyle = color.accentFill;
        context.beginPath();
        context.roundRect(-wide / 2, -high / 2, wide, high, 3);
        context.fill();
        context.strokeStyle = color.onAccent;
        context.lineWidth = 1.5;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.beginPath();
        if (phase === 'over') {
            context.moveTo(-wide / 2 + 3, -1);
            context.lineTo(0, -high / 2 + 2);
            context.lineTo(wide / 2 - 3, -1);
        } else {
            context.moveTo(-wide / 2 + 3, -high / 2 + 3);
            context.lineTo(0, 1);
            context.lineTo(wide / 2 - 3, -high / 2 + 3);
        }
        context.stroke();
        context.restore();
    }
}

module.exports = { game };

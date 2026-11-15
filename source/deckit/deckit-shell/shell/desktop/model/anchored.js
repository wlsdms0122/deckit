// MARK: - Property
// A view under an anchor is a panel window that stands under a rect another window's mod named in its content
// (deckit-sdk shell/window/model/anchor.js). Plain data in and out: every rect is given, none is measured here.
// How far a view stays inside the stage and the desktop and under its anchor, the widths it is held between, the least
// it is high, and its corners.
const VIEW = Object.freeze({ margin: 8, narrowest: 240, widest: 480, lowest: 80, radius: 12 });

// MARK: - Initializer
// MARK: - Public
// Every anchor the windows tell, `[{ window, owner, id, rect, mod }]`. `windows` is `[{ id, mod, anchors }]` in the
// order they opened, `anchors` what each one's mod told (heldTo). `owner` is the mod that told the anchor, `rect` is in
// its window's content and `mod` is the one mod that may bind to it. Where a mod names one id in two windows, the one
// of the window opened first stands.
function toldBy(windows) {
    const told = [];
    for (const { id: window, mod: owner, anchors } of windows)
        for (const { id, rect, mod } of anchors)
            if (!find(told, { mod: owner, id })) told.push({ window, owner, id, rect, mod });
    return told;
}

// Whether a view of the mod `asker` is refused the anchor `name`, `{ mod, id }`: the one told by that name is given to
// another mod. A name no window tells is refused nobody.
function isForeign(told, name, asker) {
    const anchor = find(told, name);
    return !!anchor && anchor.mod !== asker;
}

// How big a view asked `size` big is, on `stage` with `desktop` under the host's bar: as wide as asked between
// VIEW.narrowest and VIEW.widest, as high as asked from VIEW.lowest up, and never past VIEW.margin from the stage's
// sides and the desktop's top and bottom.
function sizeOf({ stage, desktop }, size) {
    const { margin, narrowest, widest, lowest } = VIEW;
    const wide = Math.max(0, stage.width - 2 * margin);
    const high = Math.max(0, desktop.height - 2 * margin);
    return {
        width: Math.min(Math.max(Math.round(size.width), narrowest), widest, wide),
        height: Math.min(Math.max(Math.round(size.height), lowest), high),
    };
}

// Where a view asked `size` big stands under `anchor`, a rect on the stage: its right edge in line with the anchor's,
// VIEW.margin under it and no higher than VIEW.margin under the desktop's top, then moved as far as keeps it
// VIEW.margin inside the stage's sides and above the desktop's bottom.
function placeOf(bounds, anchor, size) {
    const { stage, desktop } = bounds;
    const { margin } = VIEW;
    const { width, height } = sizeOf(bounds, size);
    const right = Math.round(anchor.x + anchor.width);
    const under = Math.round(anchor.y + anchor.height) + margin;
    const lowest = desktop.y + desktop.height - margin - height;
    return {
        x: Math.max(margin, Math.min(right - width, stage.width - margin - width)),
        y: Math.max(desktop.y + margin, Math.min(under, lowest)),
        width,
        height,
    };
}

// What stands by anchors, `{ anchors, frames }`. `windows` is `[{ id, mod, anchors, content, anchor, size }]` in the
// order they opened: `content` where the content of a window that stands by itself is on the stage, or null while it
// is not there; `anchor` the name a view binds by, null for a window that stands by itself; `size` what a view asks.
// `anchors` is every anchor that stands, `[{ window, owner, id, rect, mod }]`, `rect` on the stage: one of a window
// whose content is there. `frames` is a Map of each view that stands to its frame (placeOf): one whose anchor stands
// and is given to its mod. A view left out stands nowhere, its anchor gone or another mod's; its own anchors stand
// once it does.
function standingOf(bounds, windows) {
    const told = toldBy(windows);
    const contents = new Map(windows.filter(({ anchor }) => !anchor).map(({ id, content }) => [id, content]));
    const frames = new Map();
    const onStage = (anchor) => {
        const content = contents.get(anchor.window);
        const { x, y, width, height } = anchor.rect;
        return content ? { ...anchor, rect: { x: content.x + x, y: content.y + y, width, height } } : null;
    };
    let waiting = windows.filter(({ anchor }) => anchor);
    for (;;) {
        const still = waiting.filter(({ id, mod, anchor: name, size }) => {
            const anchor = find(told, name);
            const standing = anchor && anchor.mod === mod ? onStage(anchor) : null;
            if (!standing) return true;
            frames.set(id, placeOf(bounds, standing.rect, size));
            contents.set(id, frames.get(id));
            return false;
        });
        if (still.length === waiting.length) break;
        waiting = still;
    }
    return { anchors: told.map(onStage).filter(Boolean), frames };
}

// MARK: - Private
// The anchor told by the name `{ mod, id }`, or undefined.
function find(told, { mod, id }) {
    return told.find((anchor) => anchor.owner === mod && anchor.id === id);
}

export { VIEW, toldBy, isForeign, sizeOf, placeOf, standingOf };

// Where the person has been, as places ({ kind: 'folder' | 'note', path }). `enter(place)` answers "ok", "blocked" (a
// question or unsaved typing holds the open note: nothing moves and the history stays) or "gone"; `land(place)` makes
// it the current one. `onChange()` hears that what is left to go back or forward to changed with no place landed on.
function navigationHistory({ movePath, current, enter, land, onChange }) {
    const LIMIT = 50;
    const back = [];
    const forward = [];
    let moving = Promise.resolve();

    return {
        go,
        goBack: () => step(back, forward),
        goForward: () => step(forward, back),
        canGoBack: () => back.length > 0,
        canGoForward: () => forward.length > 0,
        relocate,
    };

    function go(to, { record = true, focus = false } = {}) {
        return inTurn(async () => {
            const result = await enter(to, { focus });
            if (result !== 'ok') return result;
            const from = current();
            if (record && !isSamePlace(from, to)) {
                back.push(from);
                forward.length = 0;
                if (back.length > LIMIT) back.shift();
            }
            land(to);
            return result;
        });
    }

    // Passes over places that are gone.
    function step(source, destination) {
        return inTurn(async () => {
            while (source.length) {
                const there = source[source.length - 1];
                const result = await enter(there, { quiet: true });
                if (result === 'blocked') return result;
                source.pop();
                if (result === 'gone') continue;
                destination.push(current());
                land(there);
                return result;
            }
            onChange();
            return 'gone';
        });
    }

    // One move at a time, so two Backs pressed together are two steps in order.
    function inTurn(move) {
        moving = moving.catch(() => {}).then(move);
        return moving;
    }

    // `to` null: the path went to the Trash, and the places in it go from the history.
    function relocate(from, to) {
        for (const places of [back, forward]) {
            for (let index = places.length - 1; index >= 0; index--) {
                const moved = movePath(places[index].path, from, to);
                if (moved === null) places.splice(index, 1);
                else places[index].path = moved;
            }
        }
    }

    function isSamePlace(one, other) {
        return one.kind === other.kind && one.path === other.path;
    }
}

module.exports = { navigationHistory };

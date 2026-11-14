// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What one lifecycle of a run made that can call back into its code, by the offs that cut each. `add(off)` keeps one
// and answers it to call instead: once, and no longer kept once called. `cut()` calls those still kept, latest first,
// once. What is added once it is cut is cut at once.
function makeScope() {
    const offs = new Set();
    let cut = false;
    return Object.freeze({
        add(off) {
            if (cut) {
                off();
                return () => {};
            }
            const once = () => {
                if (!offs.delete(once)) return;
                off();
            };
            offs.add(once);
            return once;
        },
        cut() {
            cut = true;
            for (const off of [...offs].reverse()) off();
        },
        get isCut() {
            return cut;
        },
    });
}

// MARK: - Private

export { makeScope };

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What one lifecycle of a run made that can call back into its code, by the offs that cut each: `add(off)` keeps one,
// and `cut()` calls them all, latest first, once. What is added once it is cut is cut at once.
function makeScope() {
    const offs = [];
    let cut = false;
    return Object.freeze({
        add(off) {
            if (cut) off();
            else offs.push(off);
        },
        cut() {
            cut = true;
            for (const off of offs.splice(0).reverse()) off();
        },
        get isCut() {
            return cut;
        },
    });
}

// MARK: - Private

export { makeScope };

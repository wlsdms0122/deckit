// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What Electron's own parts report, `report(level, ...parts)`, told to what listens (deckit-shell/environment:
// reports): what is reported before anything listens is kept and told as it starts listening.
function createReports() {
    const early = []; // [level, parts], reported before anything listened
    let listener = null;

    function report(level, ...parts) {
        if (listener) listener(level, parts);
        else early.push([level, parts]);
    }

    function listen(given) {
        if (listener) throw new Error('[deckit] what the environment reports is listened to once');
        listener = given;
        for (const [level, parts] of early.splice(0)) given(level, parts);
    }

    return { report, listen };
}

// MARK: - Private

export { createReports };

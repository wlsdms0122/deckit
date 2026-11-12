// A main process module runs in the host app's main process. One with no dispose is kept until the host app quits,
// so one whose code changed underneath it keeps running the old code, and one whose dispose failed may have left what
// it made: only a restart finishes those. `mainProcess` says which mods those are, and is nothing under a host that
// runs no main process modules, where the notice shows nothing; `mods` (deckit.mods) restarts the app.
function restartNotice({ ui, mods, mainProcess, appName }) {
    ui.addStyle(`
        .settings-restart {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 8px 0 0;
            padding: 8px 8px 8px 10px;
            border: var(--deckit-border);
            border-radius: var(--deckit-radius-medium);
            font: var(--deckit-type-small);
        }
        .settings-restart[hidden] { display: none; }
        .settings-restart-words { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
        .settings-restart-failure { color: var(--deckit-alert-ink); }
        .settings-restart-failure[hidden] { display: none; }
    `);
    const element = ui.element('div', { className: 'settings-restart' });
    const words = ui.element('div', { className: 'settings-restart-words' });
    const text = ui.element('div');
    const failure = ui.element('div', { className: 'settings-restart-failure' });
    const restart = ui.button({ label: 'Restart ' + appName, size: 'small', onClick: restartApp });

    element.hidden = true;
    failure.hidden = true;
    words.append(text, failure);
    element.append(words, restart.element);
    return { element, draw };

    async function draw(list) {
        if (!mainProcess) return;
        const pending = await mainProcess.restartPending();
        element.hidden = !pending.length;
        if (!pending.length) return;
        const nameOf = (id) => list.find((entry) => entry.id === id)?.mod?.name || id;
        const named = (why) => pending.filter((entry) => entry.why === why).map((entry) => nameOf(entry.id));
        const updated = named('updated');
        const removed = named('removed');
        const reinstalled = named('reinstalled');
        const leftover = named('leftover');
        const sentences = [];
        if (updated.length)
            sentences.push(
                `${updated.join(', ')} updated, but what it started in the main process still runs the old code`
            );
        if (removed.length) sentences.push(`${removed.join(', ')} removed, but what it started is still running`);
        if (reinstalled.length)
            sentences.push(`${reinstalled.join(', ')} reinstalled, but what the earlier copy started is still running`);
        if (leftover.length)
            sentences.push(`${leftover.join(', ')} stopped, but what it started may not all have ended`);
        text.textContent = sentences.join('. ') + '. A restart finishes it.';
    }

    async function restartApp() {
        restart.setEnabled(false);
        restart.setLabel('Restarting…');
        failure.hidden = true;
        try {
            await mods.restart();
        } catch (error) {
            restart.setEnabled(true);
            restart.setLabel('Restart ' + appName);
            failure.textContent = 'Could not restart: ' + error.message;
            failure.hidden = false;
        }
    }
}

module.exports = { restartNotice };

// A main process module runs in the host app's main process. It is started the first time the mod asks for it and
// kept until the host app quits, so one whose code changed underneath it keeps running the old code: only a restart
// finishes the change.
function restartNotice({ ui, mods, appName, onFailure }) {
    ui.addStyle(`
        .settings-restart {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 8px 0 0;
            padding: 8px 8px 8px 10px;
            border: var(--deckit-border);
            border-radius: 7px;
            font: 12.5px var(--deckit-font);
            line-height: 1.5;
        }
        .settings-restart[hidden] { display: none; }
        .settings-restart-text { flex: 1 1 auto; min-width: 0; opacity: 0.85; }
    `);
    const element = ui.element('div', { className: 'settings-restart' });
    const text = ui.element('div', { className: 'settings-restart-text' });
    const restart = ui.button({ label: 'Restart ' + appName, size: 'small', onClick: restartApp });

    element.hidden = true;
    element.append(text, restart.element);
    return { element, draw };

    function draw(found) {
        const pending = mods.restartPending();
        element.hidden = !pending.length;
        if (!pending.length) return;
        const nameOf = (id) => found.find((mod) => mod.id === id)?.name || id;
        const named = (why) => pending.filter((entry) => entry.why === why).map((entry) => nameOf(entry.id));
        const updated = named('updated');
        const removed = named('removed');
        const reinstalled = named('reinstalled');
        const sentences = [];
        if (updated.length)
            sentences.push(
                `${updated.join(', ')} updated, but what it started in the main process still runs the old code`
            );
        if (removed.length) sentences.push(`${removed.join(', ')} removed, but what it started is still running`);
        if (reinstalled.length)
            sentences.push(`${reinstalled.join(', ')} reinstalled, but what the earlier copy started is still running`);
        text.textContent = sentences.join('. ') + '. A restart finishes it.';
    }

    async function restartApp() {
        restart.setEnabled(false);
        restart.setLabel('Restarting…');
        try {
            await mods.restart();
        } catch (error) {
            restart.setEnabled(true);
            restart.setLabel('Restart ' + appName);
            onFailure('Could not restart: ' + error.message);
        }
    }
}

module.exports = { restartNotice };

// A main half runs in the app's main process, which reloading a view does not reach: when its code changed underneath
// it, only a restart finishes the change.
function restartNotice({ ui, host, appName, onFailure }) {
    const element = ui.element('div', { className: 'settings-restart' });
    const text = ui.element('div', { className: 'settings-restart-text' });
    const restart = ui.button({ label: 'Restart ' + appName, size: 'small', onClick: restartApp });

    element.hidden = true;
    element.append(text, restart.element);
    return { element, draw };

    function draw(onDisk) {
        const pending = host.plugins.restartPending();
        element.hidden = !pending.length;
        if (!pending.length) return;
        const nameOf = (id) => onDisk.find((plugin) => plugin.id === id)?.name || id;
        const named = (why) => pending.filter((entry) => entry.why === why).map((entry) => nameOf(entry.id));
        const updated = named('updated');
        const removed = named('removed');
        const reinstalled = named('reinstalled');
        const sentences = [];
        if (updated.length)
            sentences.push(
                `${updated.join(', ')} updated, but the part that runs in the background is still the old one`
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
            await host.plugins.restart();
        } catch (error) {
            restart.setEnabled(true);
            restart.setLabel('Restart ' + appName);
            onFailure('Could not restart: ' + error.message);
        }
    }
}

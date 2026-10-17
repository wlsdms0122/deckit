import * as LOG from './file.js';
import * as LISTENER from '../listener/index.js';
import * as PROTOCOL from './protocol.js';

export function createLog({ CONFIG, HOME }) {
    // MARK: - Property
    const LEVELS = new Set(['info', 'warn', 'error']);
    let file = null;
    let writer = null;

    // MARK: - Initializer
    // MARK: - Public
    function info(...parts) {
        say('main', 'info', parts);
    }

    function warn(...parts) {
        say('main', 'warn', parts);
    }

    function error(...parts) {
        say('main', 'error', parts);
    }

    function guard(emitter, event, listener, options) {
        return LISTENER.guard(emitter, event, listener, options);
    }

    // `nameOf(webContents)` names the page a line came from, as main knows it: no page says who it is.
    function start({ nameOf }) {
        const { app } = require('electron');
        writer = LOG.open({ folder: HOME.logs, name: CONFIG.id });
        file = writer.file;
        LISTENER.reportTo((label, failure) => error(`${label} failed`, failure));
        PROTOCOL.line.on(({ level, parts }, sender) => say(nameOf(sender), LEVELS.has(level) ? level : 'info', parts));
        info(`start, ${app.getName()} ${app.getVersion()}, Electron ${process.versions.electron}`);
    }

    // MARK: - Private
    function say(where, level, parts) {
        const line = ['[deckit]', ...parts];
        if (level === 'error') console.error(...line);
        else if (level === 'warn') console.warn(...line);
        else console.log(...line);
        writer?.write(where, level, parts);
    }

    return { info, warn, error, file: () => file, guard, start };
}

DeckitModule.define(
    'deckit/module/ipc',
    {
        uses: ['deckit/module/listener'],
        provides: ['rendererToMain', 'mainToRenderer'],
        runs: 'electron',
    },
    (LISTENER) => {
        // MARK: - Property
        const electron = require('electron');
        const inMain = process.type === 'browser';
        const pending = new Map(); // channel -> Map(id -> { resolve, reject, webContents, gone })
        let sequence = 0;

        // MARK: - Initializer
        // MARK: - Public
        // A renderer runs code main does not trust, so main holds what arrives to `fields`; nothing else checks.
        function rendererToMain(channel, fields, { reply = false, sync = false } = {}) {
            if (inMain) {
                if (reply) return { handle: (answer) => handle(channel, fields, sync, answer) };
                return { on: (listener) => listen(channel, fields, listener) };
            }
            const { ipcRenderer } = electron;
            if (!reply) return { send: (payload = {}) => ipcRenderer.send(channel, payload) };
            if (sync) return { invoke: (payload = {}) => unwrap(ipcRenderer.sendSync(channel, payload)) };
            return { invoke: (payload = {}) => ipcRenderer.invoke(channel, payload).then(unwrap) };
        }

        function mainToRenderer(channel, { reply = false } = {}) {
            if (inMain) {
                if (reply) return { invoke: (webContents, payload = {}) => ask(webContents, channel, payload) };
                return { send: (webContents, payload = {}) => deliver(webContents, channel, payload) };
            }
            const { ipcRenderer } = electron;
            if (!reply) return { on: (listener) => hear(channel, LISTENER.wrap(listener, channel)) };
            return { handle: (answer) => answerFor(channel, answer) };
        }

        // MARK: - Private
        function problemOf(channel, fields, payload) {
            if (kindOf(payload) !== 'object') return `${channel} carries an object, not ${kindOf(payload)}`;
            for (const key of Object.keys(payload)) {
                if (!Object.hasOwn(fields, key)) return `${channel} has no field ${key}`;
            }
            for (const [key, written] of Object.entries(fields)) {
                const optional = written.endsWith('?');
                const type = optional ? written.slice(0, -1) : written;
                const value = payload[key];
                if (value === undefined || value === null) {
                    if (!optional) return `${channel} needs ${key}`;
                    continue;
                }
                if (type !== 'any' && kindOf(value) !== type)
                    return `${channel}'s ${key} is ${kindOf(value)}, not ${type}`;
            }
            return '';
        }

        function kindOf(value) {
            if (value === null) return 'null';
            if (Array.isArray(value)) return 'array';
            return typeof value;
        }

        // Only a message crosses a process, so an error's kind travels beside it and is put back on the far side.
        function errorOf(error) {
            return { message: String(error?.message ?? error), kind: error?.kind ?? null };
        }

        function failure({ message, kind }) {
            return Object.assign(new Error(message), { kind });
        }

        function unwrap(answer) {
            if (answer?.error) throw failure(answer.error);
            return answer?.value;
        }

        function settle(work) {
            return Promise.resolve()
                .then(work)
                .then(
                    (value) => ({ value }),
                    (error) => ({ error: errorOf(error) })
                );
        }

        function handle(channel, fields, sync, answer) {
            const { ipcMain } = electron;
            if (!sync) {
                ipcMain.handle(channel, (event, payload) => {
                    const problem = problemOf(channel, fields, payload);
                    if (problem) return { error: { message: problem, kind: 'REFUSED' } };
                    return settle(() => answer(payload, event.sender));
                });
                return;
            }
            // A synchronous answer is what the handler returns at once: a promise cannot cross.
            ipcMain.on(channel, (event, payload) => {
                const problem = problemOf(channel, fields, payload);
                if (problem) {
                    event.returnValue = { error: { message: problem, kind: 'REFUSED' } };
                    return;
                }
                try {
                    event.returnValue = { value: answer(payload, event.sender) };
                } catch (error) {
                    event.returnValue = { error: errorOf(error) };
                }
            });
        }

        function listen(channel, fields, listener) {
            const guarded = LISTENER.wrap(listener, channel);
            electron.ipcMain.on(channel, (event, payload) => {
                const problem = problemOf(channel, fields, payload);
                if (problem) {
                    console.error(`[deckit] refused: ${problem}`);
                    return;
                }
                guarded(payload, event.sender);
            });
        }

        function deliver(webContents, channel, payload) {
            if (webContents.isDestroyed()) return;
            webContents.send(channel, payload);
        }

        function ask(webContents, channel, payload) {
            if (!pending.has(channel)) hearAnswers(channel);
            if (webContents.isDestroyed()) return Promise.reject(new Error(`${channel}: the page is gone`));
            const id = ++sequence;
            return new Promise((resolve, reject) => {
                const gone = () => {
                    pending.get(channel).delete(id);
                    reject(new Error(`${channel}: the page is gone`));
                };
                pending.get(channel).set(id, { resolve, reject, webContents, gone });
                webContents.once('destroyed', gone);
                webContents.send(channel, { id, payload });
            });
        }

        function hearAnswers(channel) {
            const waiting = new Map();
            pending.set(channel, waiting);
            electron.ipcMain.on(channel + ':answer', (event, { id, value, error }) => {
                const asked = waiting.get(id);
                if (!asked || asked.webContents !== event.sender) return;
                waiting.delete(id);
                asked.webContents.removeListener('destroyed', asked.gone);
                if (error) asked.reject(failure(error));
                else asked.resolve(value);
            });
        }

        function hear(channel, listener) {
            electron.ipcRenderer.on(channel, (_event, payload) => listener(payload));
        }

        function answerFor(channel, answer) {
            const { ipcRenderer } = electron;
            ipcRenderer.on(channel, (_event, { id, payload }) => {
                settle(() => answer(payload)).then((result) =>
                    ipcRenderer.send(channel + ':answer', { id, ...result })
                );
            });
        }

        return { rendererToMain, mainToRenderer };
    }
);

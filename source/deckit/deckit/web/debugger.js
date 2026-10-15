export function createDebugger({ LOG }) {
    // MARK: - Property
    const listeners = new Map(); // page webContents id -> Set of (method, params, sessionId) listeners

    // MARK: - Initializer
    // MARK: - Public
    // A webContents has one DevTools protocol session, shared by whatever works through it (the user agent, the
    // page script), so one place attaches it and hands every message on.
    function attach(page) {
        const id = page.id;
        if (listeners.has(id)) return true;
        try {
            page.debugger.attach('1.3');
        } catch (error) {
            LOG.error('no DevTools session for a web page', error);
            return false;
        }
        listeners.set(id, new Set());
        page.debugger.on('message', (_event, method, params, sessionId) => {
            for (const listener of listeners.get(id) || []) listener(method, params, sessionId);
        });
        page.once('destroyed', () => listeners.delete(id));
        return true;
    }

    function send(page, method, params = {}, sessionId) {
        return page.debugger.sendCommand(method, params, sessionId);
    }

    function on(page, listener) {
        listeners.get(page.id)?.add(listener);
    }

    // MARK: - Private

    return { attach, send, on };
}

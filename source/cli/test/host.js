// Run in the app under test before its own entry, as a host app that sets its own handlers on every webContents and
// session it is told of does: once as it is told, and again a moment later. What deckit set on its own stays.
if (process.type === 'browser') {
    const { app } = require('electron');
    const LATER = 1000;
    const refuse = (contents) => {
        if (!contents.isDestroyed()) contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    };
    const grant = (session) => {
        session.setPermissionRequestHandler((_contents, _permission, answer) => answer(true));
        session.setPermissionCheckHandler(() => true);
    };
    app.on('web-contents-created', (_event, contents) => {
        refuse(contents);
        setTimeout(() => refuse(contents), LATER);
    });
    app.on('session-created', (session) => {
        grant(session);
        setTimeout(() => grant(session), LATER);
    });
}

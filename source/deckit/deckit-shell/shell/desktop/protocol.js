// Between main and the desktop's page, deckit://desktop/, where the backdrop and the windows' frames are drawn.
import * as CHANNEL from '../../deckit/channel/index.js';

// Answers { glass, state } at once: the page is built in one pass.
export const setup = CHANNEL.pageToMain('deckit-shell:desktop-setup', {}, { reply: true, sync: true });
// `{ windows: [{ id, frame, key, minimum }], strip, down }`: the windows on the screen of the seat at the host window,
// `frame` on the stage, `key` whether it is that seat's key window, `minimum` the size it is never below; `strip` how
// tall the host window's bar is over the page's top, which drags the host window; and `down` `{ name, why }` once
// deckit's core answers nothing more, or null.
export const state = CHANNEL.mainToPage('deckit-shell:desktop-state');
// A press on a window's frame or its buttons.
export const press = CHANNEL.pageToMain('deckit-shell:desktop-press', { id: 'number' });
// One of a window's buttons clicked: `button` 'close', 'minimize' or 'zoom'.
export const button = CHANNEL.pageToMain('deckit-shell:desktop-button', { id: 'number', button: 'string' });
// A window's frame as a drag of its edge draws it: `phase` 'changed', then 'ended' as the drag ends.
export const resize = CHANNEL.pageToMain('deckit-shell:desktop-resize', {
    id: 'number',
    phase: 'string',
    x: 'number',
    y: 'number',
    width: 'number',
    height: 'number',
});
// The person asks for the app to restart, deckit's core having gone down.
export const restart = CHANNEL.pageToMain('deckit-shell:desktop-restart', {});

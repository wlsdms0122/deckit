import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The page's overlay, opened beside it as main lets it: `{ window, document, tell({ shows, layered }) }`. It draws
// nothing of its own: what is in it is drawn from here. One the last document of this page opened is found by its
// name. `channels` binds the overlay's channels in the page.
function open({ channels }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const opened = window.open('', PROTOCOL.open.invoke());
    return Object.freeze({
        window: opened,
        document: opened.document,
        tell: (state) => PROTOCOL.state.send(state),
    });
}

// MARK: - Private

export { open };

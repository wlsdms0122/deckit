import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The page's overlay, opened beside it as main lets it: `{ window, document, tell(state), presents(on), take() }`,
// `state` as the overlay's state channel carries it, `presents` telling whether anything is presented over the page and
// `take` asking for the keyboard the page has. It draws nothing of its own:
// what is in it is drawn from here. One the last document of this page opened is found by its name. `channels` binds
// the overlay's channels in the page.
function open({ channels }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const opened = window.open('', PROTOCOL.open.invoke());
    return Object.freeze({
        window: opened,
        document: opened.document,
        tell: (state) => PROTOCOL.state.send(state),
        presents: (on) => PROTOCOL.presents.send({ on }),
        take: () => PROTOCOL.take.send({}),
    });
}

// MARK: - Private

export { open };

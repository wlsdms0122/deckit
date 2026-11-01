// How what crosses between a page of deckit's and main is carried, `{ channel, body }` as JSON each way: a page tells
// main by posting to the page's message handler (HANDLER), asks it by a POST to the page's own origin, answered there
// as `{ value }`, or with status 500 as `{ error }`, and main tells a page by calling the function the page keeps under
// `Symbol.for(TOLD)` in deckit's world. A post and a POST can reach main out of the order they were sent in, so each
// carries its document's `document`, and a question `after`, how many posts the document sent before it: main hears it
// once it has heard those. Deck's messages go on the three `deck` channels; the rest are the environment's
// own.
export const HANDLER = 'deckit';
export const TOLD = 'deckit-electron:told';
export const CHANNEL = Object.freeze({
    deckTell: 'deck-tell',
    deckAsk: 'deck-ask',
    deckAskSync: 'deck-ask-sync',
    opening: 'opening',
    opened: 'opened',
    drag: 'drag',
    titleBar: 'title-bar',
    consoleError: 'console-error',
    webShow: 'web-show',
    webPlace: 'web-place',
    webFocus: 'web-focus',
    webUnfocus: 'web-unfocus',
    webRemove: 'web-remove',
    webTold: 'web-told',
});

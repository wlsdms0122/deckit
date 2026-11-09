// What Electron gives deck, the web engine and the shell on a page's side (deckit-shell/environment: PAGE, WEB_PAGE,
// SHELL_PAGE): the page is WebKit's, through the module in main, which carries the messages; what runs a mod's code
// runs in deckit's world, which the page's policy on scripts leaves alone; a web page shown in the page, or in a
// surface it opened, is laid over an element that holds its place (web/renderer.js); and the presses in a document's
// drag regions are taken by what draws there (page/renderer.js).
import * as ORIGIN from '../sandbox/model/origin.js';
import { messages } from '../messages/renderer.js';
import { createViews } from '../web/renderer.js';
import { take } from '../page/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
const environment = Object.freeze({
    messages,
    modules: Object.freeze({ evaluate }),
    web: Object.freeze(createViews()),
    drags: Object.freeze({ take }),
});

// MARK: - Private
// Named by its file at the mod's address, as a stack reads it.
function evaluate(source, { mod, file }) {
    const module = { exports: {} };
    new Function('module', 'exports', `${source}\n//# sourceURL=${ORIGIN.SCHEME}://${mod}/${file}`)(
        module,
        module.exports
    );
    return module.exports;
}

export { environment };

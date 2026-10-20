import * as TOKEN from '../ui/token/index.js';
import * as CHANNEL from '../channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The page's theme, worn as the token's custom properties and the page's color scheme, and taken in place
// when the host app gives a new one. Answers the token's members, each read at its use, and
// `onChange(listener)`, which answers its off. `tell(listener)` calls a listener: one's failure is its own, and the
// others still hear the change. `channels` binds the theme's channels in the page.
function start({ channels, tell = told }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const listeners = new Set();
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    let token = wear(PROTOCOL.setup.invoke().theme);
    PROTOCOL.change.on(({ theme }) => {
        token = wear(theme);
        for (const listener of [...listeners]) tell(listener);
    });
    const read = {
        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
    for (const key of Object.keys(token)) Object.defineProperty(read, key, { get: () => token[key], enumerable: true });
    return Object.freeze(read);

    function wear(theme) {
        const worn = TOKEN.tokenOf(theme || TOKEN.FALLBACK_THEME);
        sheet.replaceSync(TOKEN.propertiesOf(worn));
        // So what the browser draws itself (scrollbars, native controls) follows it.
        document.documentElement.style.colorScheme = worn.dark ? 'dark' : 'light';
        return worn;
    }
}

// MARK: - Private
// A listener on a page that runs no mod: what it throws goes to the page's console.
function told(listener) {
    try {
        listener();
    } catch (error) {
        console.error(error);
    }
}

export { start };

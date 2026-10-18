import * as COLOR from '../color/index.js';
import * as ICON from '../icon/index.js';
import * as POINTER from '../pointer/index.js';
import * as OVERLAY from '../overlay/index.js';
import * as SCROLL from '../scroll/index.js';
import * as LISTBOX from '../list/listbox.js';
import * as TREE from '../list/tree.js';
import * as PART from '../part/index.js';
import * as BUTTON from '../button/index.js';
import * as FIELD from '../field/index.js';
import * as MENU from '../menu/index.js';
import * as SECTION from '../section/index.js';
import * as POPOVER from '../popover/index.js';
import * as ROW from '../row/index.js';
import * as INLINE_EDIT from '../inline-edit/index.js';
import * as SORTABLE from '../sortable/index.js';
import * as MARQUEE from '../marquee/index.js';
import * as DRAG from '../drag/index.js';
import * as FILE_TREE from '../file-tree/index.js';
import * as RESIZER from '../resizer/index.js';
import * as EMPTY_STATE from '../empty-state/index.js';
import * as LOADING from '../loading/index.js';
import * as FONTS from '../fonts/index.js';
import * as MODAL from '../modal/index.js';
import * as QUICK_PICK from '../quick-pick/index.js';
import * as COLOR_PICKER from '../color-picker/index.js';
import * as DIALOG from '../dialog/index.js';

const components = [
    BUTTON,
    FIELD,
    MENU,
    SECTION,
    POPOVER,
    ROW,
    INLINE_EDIT,
    SORTABLE,
    MARQUEE,
    DRAG,
    FILE_TREE,
    RESIZER,
    EMPTY_STATE,
    LOADING,
    MODAL,
    QUICK_PICK,
    COLOR_PICKER,
    DIALOG,
];
// MARK: - Property
let installed = false;
// MARK: - Initializer
// MARK: - Public
// The `ui` a page draws with, for `theme`. Frozen all the way down: a mod is handed the very objects its page
// draws with. Components are made in the order of `components`, as one may lend another something through `inner`.
function make(theme) {
    install();
    const ui = {};
    const inner = {};
    for (const component of components) Object.assign(ui, component.make(theme, ui, inner));
    Object.assign(ui, {
        icon: ICON.icon,
        iconOf: ICON.iconOf,
        sanitizeIcon: ICON.sanitize,
        element: PART.element,
        addStyle,
        listbox: LISTBOX.listbox,
        tree: TREE.tree,
        alpha: COLOR.alpha,
        mix: COLOR.mix,
        capturePointer: POINTER.capture,
        edgeFade: SCROLL.edgeFade,
        installedFonts: FONTS.installedFonts,
        isFullyVisible: SCROLL.isFullyVisible,
        pressable: PART.pressable,
        selectable: PART.selectable,
        titleBar: PART.titleBar,
    });
    return deepFreeze(ui);
}

// Rules of a view of deckit's own, drawn with the kit's custom properties.
function addStyle(rules) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(rules);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

// MARK: - Private
// The kit's look, once per page: every part's rules, drawn with the theme's custom properties.
function install() {
    if (installed) return;
    installed = true;
    const rules = [OVERLAY, PART, ...components].map((part) => part.STYLE);
    addStyle(rules.join('\n'));
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if ('value' in descriptor) deepFreeze(descriptor.value);
    }
    return value;
}

export { make, addStyle };

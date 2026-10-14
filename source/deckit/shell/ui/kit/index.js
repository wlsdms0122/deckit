import * as COLOR from '../color/index.js';
import * as ICON from '../icon/index.js';
import * as POINTER from '../pointer/index.js';
import * as OVERLAY from '../overlay/index.js';
import * as SCROLL from '../scroll/index.js';
import * as LISTBOX from '../list/listbox.js';
import * as PART from '../component/part.js';
import * as BUTTON_COMPONENT from '../component/button.js';
import * as FIELD_COMPONENT from '../component/field.js';
import * as MENU_COMPONENT from '../component/menu.js';
import * as SECTION_COMPONENT from '../component/section.js';
import * as POPOVER_COMPONENT from '../component/popover.js';
import * as ROW_COMPONENT from '../component/row.js';
import * as INLINEEDIT_COMPONENT from '../component/inline-edit.js';
import * as SORTABLE_COMPONENT from '../component/sortable.js';
import * as DRAG_COMPONENT from '../component/drag.js';
import * as FILETREE_COMPONENT from '../component/file-tree.js';
import * as RESIZER_COMPONENT from '../component/resizer.js';
import * as EMPTYSTATE_COMPONENT from '../component/empty-state.js';
import * as LOADING_COMPONENT from '../component/loading.js';
import * as FONTS_COMPONENT from '../component/fonts.js';
import * as MODAL_COMPONENT from '../component/modal.js';
import * as QUICKPICK_COMPONENT from '../component/quick-pick.js';
import * as COLORPICKER_COMPONENT from '../component/color-picker.js';
import * as DIALOG_COMPONENT from '../component/dialog.js';

const components = [
    BUTTON_COMPONENT,
    FIELD_COMPONENT,
    MENU_COMPONENT,
    SECTION_COMPONENT,
    POPOVER_COMPONENT,
    ROW_COMPONENT,
    INLINEEDIT_COMPONENT,
    SORTABLE_COMPONENT,
    DRAG_COMPONENT,
    FILETREE_COMPONENT,
    RESIZER_COMPONENT,
    EMPTYSTATE_COMPONENT,
    LOADING_COMPONENT,
    FONTS_COMPONENT,
    MODAL_COMPONENT,
    QUICKPICK_COMPONENT,
    COLORPICKER_COMPONENT,
    DIALOG_COMPONENT,
];
// MARK: - Property
let installed = false;
// MARK: - Initializer
// MARK: - Public
// The `ui` a page draws with, for `theme`. Frozen all the way down: a mod is handed the very objects its page
// draws with. Components are made in the order of `uses`, as one may lend another something through `inner`.
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
        alpha: COLOR.alpha,
        mix: COLOR.mix,
        capturePointer: POINTER.capture,
        edgeFade: SCROLL.edgeFade,
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

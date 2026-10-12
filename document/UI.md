# The kit (`context.ui`)

Every page deckit draws, a plugin's and its own, draws with one kit, so the panel looks like one app. `context.theme` is the look; `context.ui` is the parts drawn in it.

The kit's parts are of five kinds:

- A maker takes one options object and returns `{ element, ...its controls }`. Put `element` where it goes; call the controls to change it.
- A layer takes one options object, floats on the page's one stack and returns `{ close }`: `modal`, `dialog`, `confirmTrash`, `colorPicker`. `menu` and `popover` are layers too, with a few more controls.
- A float its owner places stays out of the stack, so the keyboard stays with the text it acts on: `floatingToolbar`, `autocomplete`.
- A decorator takes `(element, options)` and returns its dispose. `listbox` decorates an element and returns its controls with `dispose` among them; `inlineEdit` is one edit and resolves when it ends.
- A helper returns a value: markup, an element, a function, a number.

A control draws the value it is set to and reports what was asked (`onChange(next)`); its owner keeps the value and calls `set(next)`. Callbacks are `on` and a verb. A control's size is `'small'` or `'medium'`; a glyph's size (`icon`, `spinner`, `folderIcon`) is in px.

## The theme

`context.theme` is derived once from the app's colours:

| Key | What it holds |
|---|---|
| `dark` | whether the background is dark |
| `font`, `mono` | the families |
| `type` | font shorthands: `caption` 11, `small` 12, `body` 13, `medium` 14, `large` 15, `heading` 16, `title` 18 |
| `border` | the border shorthand |
| `color` | `text`, `muted`, `disabled`, `background`, `surface`, `lifted`, `divider`, `fill`, `hover`, `selected`, `pressed`, `accent`, `onAccent`, `ok`, `warn`, `alert`, `focus`, `target`, `scrim`, `folder` |
| `radius` | `small` 4, `control` 6, `medium` 8, `large` 10, `card` 12, `round` 999 |
| `shadow` | `raised`, `nested`, `modal`, `lifted` |
| `motion` | `fast`, `base`, `slow` in ms (0 while the system asks for reduced motion), `easing`, and `entrance`, the transform a panel or a modal arrives from |
| `syntax` | the code palette: `keyword`, `string`, `number`, `comment`, `function`, `type`, `property`, `operator`, `meta`, `invalid` |

For CSS, the token is also custom properties on the page's root: each colour by its name in kebab case (`--deckit-muted`, `--deckit-on-accent`), `--deckit-type-*`, `--deckit-radius-*` in px, `--deckit-shadow-*`, `--deckit-fast`, `--deckit-base` and `--deckit-slow` in ms, `--deckit-easing`, `--deckit-font`, `--deckit-mono` and `--deckit-border`. `dark`, `syntax` and `entrance` are read from `theme`. A plugin adds rules of its own with `ui.addStyle(css)`; its class names start with its id.

## Buttons

- `iconButton({ icon, title, size, muted, onClick })` returns `{ element, setPressed(on), setEnabled(on), setIcon(svg) }`. `muted` rests it a step back until the pointer comes.
- `button({ label, title, icon, size, variant, onClick })` returns `{ element, setLabel(text), setEnabled(on) }`. `variant` is `plain`, `primary` or `destructive`.
- `rowAction({ icon | label, title, onClick })` returns `{ element }`: an action of a row, shown while the row is hovered or holds the focus. Its click is its own.
- `segmented({ items, value, size, accent, fill, onChange })` returns `{ element, set(key), setItems(items), elementOf(key) }`. `items` are `{ key, label, title, lead }`; with `fill` the choices share the width it is given.
- `toggleButton({ icon | label, title, value, onChange })` returns `{ element, set(on), setMarked(on) }`: on or off beside a field that keeps the keyboard.
- `toggle({ value, onChange })` returns `{ element, set(on) }`: a switch.
- `tooltip(element, { text, chord })` is a decorator: `chord()` is read as the pointer comes, so a key changed in Settings shows.

## Text and numbers

- `field({ placeholder, value, icon, inline, trailing, size, clearable, onInput, onSubmit, onCancel })` returns `{ element, input, set(value), focus() }`. Enter calls `onSubmit(value, { shift })`; Escape is the field's only when `onCancel` takes it.
- `stepper({ value, min, max, step, unit, onChange })` returns `{ element, set(value) }`. Enter and leaving the field report what is typed; Escape puts the value back.
- `findBar({ placeholder, options, nav, replace, onChange, onNext, onPrevious, onCancel })` returns `{ element, setQuery(text, options), focus(which), setCount(active, total), setReplaceOpen(on), state(), replacement() }`. `options` are any of `caseSensitive`, `word`, `regex`, and `state()` is `{ query, caseSensitive, word, regex }`, what `onChange` gets too; `setQuery` takes the same keys. `replace` is `{ open, onReplace, onReplaceAll }`.

## What floats

What floats is one stack. The top layer has the keys first; Escape and a press outside put it away, then the next, until one holds the press.

- `menu({ items, anchor | point, onClose })` returns `{ element, close(), isOpen() }`, or null when a second press on its anchor closed it. An item is `'-'` (a separator) or `{ label, icon, hint, checked, disabled, items, font, run }`; `items` makes a submenu. Arrow keys move, Enter or Space takes, Tab and Escape close.
- `select({ options, value, onChange })` returns `{ element, set(value) }`. `options` are `{ value, label, font }`.
- `contextMenu(area, { rowAt, items, keyRow })` is a decorator: the context click, the ContextMenu key or Shift+F10 opens `items(row)` for the row under the pointer or with the focus, and the row is marked while it is open.
- `popover({ width, onClose })` returns `{ element, show(anchor), close(), isOpen() }`.
- `modal({ title, confirmLabel, cancelLabel, destructive, extraLabel, onExtra, chrome, align, width, fill, onKey, onConfirm, onClose })` returns `{ close }`. `fill(card)` puts the content in and returns what takes the focus. With `chrome`, a title and the buttons; Enter in a text field confirms. `onKey(event)` has a key first.
- `dialog({ title, message, content, fields, confirmLabel, cancelLabel, extraLabel, onExtra, destructive, onConfirm, onClose })` returns `{ close }`: a modal that says something and asks for values. `fields` are `{ key, label, type, value, placeholder, options }`, a text field unless `type` is `switch` or `color`. `onConfirm(values)`.
- `confirmTrash({ name, onConfirm })`: asks before a folder and what is in it go to the Trash.
- `colorPicker({ title, value, onPick })`.

Two floats are placed by their owner and are not layers: the keyboard stays with the text they act on.

- `floatingToolbar()` returns `{ element, show(rect), hide() }`: centred above the rect, below when only that fits.
- `autocomplete({ onPick })` returns `{ show(items, rect), place(rect), move(by), pick(), close(), isOpen() }`. An item is `{ label, icon, hint }`, and `onPick(item)` gets it. The owner moves through it with its own keys.

## Lists

- `list({ key, create, update, exit, maxRows, size })` returns `{ element, set(items), elementOf(key), keyOf(element) }`. Rows are drawn by key: the same key keeps the same element, so what the pointer rests on and what has the focus stay put. `create(item)` makes a row; `update(element, item)` refreshes a kept one. A key names one item: a key given twice throws. With `exit`, a removed row folds away along the list's axis. While something in or around the list is held (dragged, renamed), a new set waits and the last one is drawn when it is let go. With `maxRows`, the list is at most that many rows tall and scrolls.
- `row({ size })` returns `{ element, setActive(on), setRevealed(on) }`: washed under the pointer; `setActive` marks it chosen, `setRevealed` keeps its actions shown.
- `listbox(element, { onPick, onActivate })` returns `{ set(options, { active }), move(by), activate(index), active(), dispose() }`: one active option among `options` (`{ element, disabled }`), moved by the keys and by a pointer that travels, picked by a press. `onActivate(index, { pointer })` hears the active option change and `onPick(index, { keyboard })` a pick; the active option is marked `data-active`.

## Sections and paths

- `section({ label, icon, actions, collapsed, onToggle, title, onHeading, onHeadingMenu, headingTitle })` returns `{ element, body, heading, actions, setCurrent(on), setCollapsed(on), isCollapsed() }`. With `collapsed` a boolean the heading folds the body: a press calls `onToggle(next)`, and the owner folds it. `actions` are `{ icon, title, run(button) }`.
- `breadcrumb({ onGo })` returns `{ element, set(parts), partAt(element) }`; `partAt` answers the part an element is in, `{ key, element }`, or null. `parts` are `{ key, label, title, current, icon }`; what does not fit folds into a menu.

## Files and folders

- `folderIcon({ open, size })`: a folder's icon, in the folder colour.
- `treeRow({ depth, folder, folds, open, glyph, name, size })` returns `{ element, setActive(on), setRevealed(on) }`. Its name is marked `data-name`, what a rename types over.
- `inlineEdit(label, { selectStem, onCommit })` renames a label in place; `onCommit(text)` answers nothing or why it refused. Resolves whether it renamed.
- `movesInto(from, folder)`: whether a move changes anything and is possible.
- `treeFolderAt({ row, markOf, top, topMark })` and `folderDrop(zone, { kind, path, folderAt, onDrop })`: a tree as a drop target of moves into folders.

## Dragging and sizing

- `sortable(list, { onReorder })` decorates a keyed list and returns its dispose: the rows put in a new order by a drag. `onReorder(key, toKey)` hears that the item `key` goes where `toKey` is, and the owner draws the new order.
- `dragSource(area, { itemAt, describe })` is a decorator: `describe(item)` is `{ kind, payload, text, icon }`.
- `dropTarget(zone, { kind, placeAt, onDrop })` is a decorator.
- `resizer(handle, { axis, grow, size, min, max, onResize, onCommit, onClick, onDrag, resizable })` is a decorator: `size()` reads the size, `onResize(px)` draws one, `onCommit(px)` keeps the one let go of. Past a limit the edge gives and springs back; a press that does not travel is a click.

## Everything else

- `emptyState({ icon, title, hint, actions })` returns `{ element, set({ title, hint, actions }) }`.
- `spinner({ size })` and `loading({ text })` return `{ element }`.
- `icon(name, { size, fill, color, stroke })`: one of the kit's icons (Lucide), as SVG markup. A name it does not have throws. `iconOf(shapes, { size, stroke })` draws shapes of the plugin's own in the same frame.
- `element(tag, { className, style, text })`.
- `edgeFade(element, { size })`, `pressable(element)`, `selectable(element)` are decorators: the edges of what scrolls fade, something pressed is washed and ringed, text can be selected.
- `isFullyVisible(element)`, `capturePointer(cursor)` (returns the release), `mix(foreground, background, amount)`, `alpha(color, amount)`.
- `installedFonts(faces)`: the faces (`{ font }`) installed on this Mac.

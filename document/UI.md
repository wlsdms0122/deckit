# The kit (`deck.ui`)

Every page deckit's shell draws, a mod's and its own, draws with one kit, so the panel looks like one app. The kit is the shell's (`source/deckit/deckit-shell`), which hands it to every mod: `deck.theme` is the look; `deck.ui` is the parts drawn in it.

The kit's parts are of five kinds:

- A maker takes one options object and returns `{ element, ...its controls }`. Put `element` where it goes; call the controls to change it.
- A layer takes one options object, floats on the page's one stack and returns `{ close }`: `modal`, `dialog`, `confirmTrash`, `colorPicker`. `menu`, `popover` and `quickPick` are layers too, with more controls.
- A float its owner places stays out of the stack, so the keyboard stays with the text it acts on: `floatingToolbar`, `autocomplete`.
- A decorator takes `(element, options)` and returns its dispose. `listbox` decorates an element and returns its controls with `dispose` among them; `inlineEdit` is one edit and resolves when it ends.
- A helper returns a value: markup, an element, a colour, a boolean, a function or a list.

A control draws the value it is set to and reports what was asked (`onChange(next)`); its owner keeps the value and calls `set(next)`. A callback that reports what happened is `on` and a verb (`onChange`, `onPick`); one the kit asks for something is named for what it gives (`create`, `placeAt`, `describe`) or does (`run`). A control's size is `'small'` or `'medium'`; a glyph's size (`icon`, `spinner`, `folderIcon`) is in px.

## The theme

`deck.theme` is derived from the host app's colours, and changes when the host app gives new ones. Each key is read as it is now; `theme.onChange(listener)` hears a new theme and answers its off.

| Key | What it holds |
|---|---|
| `dark` | whether the background is dark |
| `font`, `mono` | the families |
| `type` | font shorthands: `caption` 11, `small` 12, `body` 13, `medium` 14, `large` 15, `heading` 16, `title` 18 |
| `border` | the border shorthand |
| `color` | `text`, `muted`, `disabled`, `background`, `surface`, `lifted`, `divider`, `fill`, `hover`, `selected`, `pressed`, `accent`, `onAccent`, `ok`, `warn`, `alert`, `focus`, `target`, `scrim`, `folder` |
| `radius` | `small` 4, `control` 6, `medium` 8, `large` 10, `card` 12, `round` 999 |
| `shadow` | `raised`, `nested`, `modal`, `lifted`, `drawer` |
| `motion` | `fast`, `base`, `slow` in ms (0 while the system asks for reduced motion), `easing`, and `entrance`, the transform a panel or a modal arrives from |
| `syntax` | the code palette: `keyword`, `string`, `number`, `comment`, `function`, `type`, `property`, `operator`, `meta`, `invalid` |

For CSS, the token is also custom properties on the page's root: each colour by its name in kebab case (`--deckit-muted`, `--deckit-on-accent`), `--deckit-type-*`, `--deckit-radius-*` in px, `--deckit-shadow-*`, `--deckit-fast`, `--deckit-base` and `--deckit-slow` in ms, `--deckit-easing`, `--deckit-font`, `--deckit-mono` and `--deckit-border`. `dark`, `syntax` and `entrance` are read from `theme`. A new theme changes the custom properties and the page's `color-scheme` in place, so whatever is drawn with them (and CSS `light-dark()`) follows by itself; what a mod worked out from `theme` in code it works out again in `onChange`. A mod adds rules of its own with `ui.addStyle(css)`; its class names start with its id. A mod with `deckit.styles` styles other mods' pages with the same names (MOD.md, `deck.styles`).

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
- `findBar({ placeholder, options, nav, replace, onChange, onNext, onPrevious, onCancel })` returns `{ element, setQuery(text, options), focus(which), setCount(active, total), setReplaceOpen(on), state(), replacement() }`. `options` are any of `caseSensitive`, `word`, `regex`, and `state()` is `{ query, caseSensitive, word, regex }`, what `onChange` gets too; `setQuery` takes the same keys. `focus(which)` puts the keyboard in the find field, or with `'replace'` in the replace field. `replace` is `{ open, onReplace, onReplaceAll }`: `onReplaceAll` is required, and without `onReplace` there is no Replace button and Enter in the replace field replaces all.

## What floats

What floats is one stack. The top layer has the keys first; Escape and a press outside put it away, then the next, until one holds the press.

- `menu({ items, anchor | point, onClose })` returns `{ element, close(), isOpen() }`, or null when a second press on its anchor closed it. An item is `'-'` (a separator) or `{ label, icon, hint, checked, disabled, items, font, run }`; `items` makes a submenu. Arrow keys move, Enter or Space takes, Tab and Escape close.
- `select({ options, value, onChange })` returns `{ element, set(value), setOptions(options) }`: a pop-up button. `options` are `{ value, label, font, icon, hint }`, drawn as a menu's items are; the chosen one's icon stands before its label on the button.
- `contextMenu(area, { rowAt, items, keyRow })` is a decorator: the context click, the ContextMenu key or Shift+F10 opens `items(row)` for the row under the pointer or with the focus, and the row is marked while it is open.
- `popover({ width, onClose })` returns `{ element, show(anchor), close(), isOpen() }`. `width` is the widest it grows to.
- `modal({ title, confirmLabel, cancelLabel, destructive, extraLabel, onExtra, chrome, align, width, fill, onKey, onConfirm, onClose })` returns `{ close }`. `fill(card)` puts the content in and returns what takes the focus. With `chrome`, a title and the buttons; Enter in a text field confirms. `onKey(event)` has a key first and answers true when it took it; a key it does not take goes on to Enter and Escape as well.
- `dialog({ title, message, content, fields, confirmLabel, cancelLabel, extraLabel, onExtra, destructive, onConfirm, onClose })` returns `{ close }`: a modal that says something and asks for values. `message` is a paragraph, or a list of them. `fields` are `{ key, label, type, value, placeholder, options }`, a text field unless `type` is `switch` or `color`. `onConfirm(values)`.
- `confirmTrash({ name, onConfirm })`: asks before a folder and what is in it go to the Trash.
- `colorPicker({ title, value, onPick })`.
- `quickPick({ placeholder, value, width, key, create, update, optionOf, onInput, onPick, onEnter, onKey, onActive, onCommandKey, onClose })` returns `{ text(), setText(text), setPlaceholder(text), setScope({ icon, label } | null), focus(), set(items, { active, message, note, loading, alert }), move(by), active(), close() }`: a field over a list to pick from, at the top of the page. The switcher, Open Quickly and Go to Folder are each one. Items are drawn by `key(item)`, `create` and `update`, as a keyed list draws them; `optionOf(item)` is null for an item that is no option (a heading) or `{ disabled }`. The arrows move the active option, which `onActive(item, index, { pointer })` hears, and Enter picks it, which `onPick(item, index)` hears, or `onEnter({ item, text })` hears both. `onKey(event)` has a key first and answers true when it took it, or the arrows, Enter and Escape act on it too; `onCommandKey(held)` hears Command held down or let go. The field keeps the focus. `setScope` shows what the field searches in, before it.

Two floats are placed by their owner and are not layers: the keyboard stays with the text they act on.

- `floatingToolbar()` returns `{ element, show(rect), hide() }`: centred above the rect, below when only that fits.
- `autocomplete({ onPick })` returns `{ show(items, rect), place(rect), move(by), pick(), close(), isOpen() }`. An item is `{ label, icon, hint }`, and `onPick(item)` gets it. The owner moves through it with its own keys.

## Lists

- `list({ key, create, update, animated, maxRows, size })` returns `{ element, set(items), elementOf(key), keyOf(element) }`. Rows are drawn by `key(item)`: the same key keeps the same element, so what the pointer rests on and what has the focus stay put. `create(item)` makes a row; `update(element, item)` refreshes a kept one. A key names one item: a key given twice throws. With `animated`, a row added once the list has shown items unfolds along the list's axis, and a removed one folds away. While something in or around the list is held (dragged, renamed), a new set waits and the last one is drawn when it is let go. With `maxRows`, the list is at most that many rows tall and scrolls.
- `row({ size })` returns `{ element, setActive(on), setActionsShown(on) }`: washed under the pointer; `setActive` marks it chosen, `setActionsShown` keeps its actions shown.
- `listbox(element, { onPick, onActivate })` returns `{ set(options, { active }), move(by), activate(index), active(), dispose() }`: one active option among `options` (`{ element, disabled }`), moved by the keys and by a pointer that travels, picked by a press. `onActivate(index, { pointer })` hears the active option change and `onPick(index, { keyboard })` a pick; the active option is marked `data-active`.
- `tree(element, { items, lead, nameOf, multiple, expanded, parentOf, childrenOf, onSelect, onSelectAll, onToggle, onPreview, onRename, onOpen })` is a decorator: the keys of a list or a tree of items the person selects, as macOS has them, and as ARIA's tree and listbox patterns have them where macOS does not differ. It is named for ARIA's tree, items the person selects that may nest, so a list whose items do not nest is a tree of one level. It is not `listbox`, one active option that the keys and the pointer move and a press picks (a menu's, a quick pick's), with no selection kept; and `treeRow` draws a row of a tree, with no keys. `element` takes the focus and the keys pressed on it; a key typed into something inside it (a rename) is that one's. The owner keeps the selection: `items()` are the keys of the items the arrows move among, in order, and `lead()` is the one they move from, or null. Up and Down go to the item before or after, and Option with them, Home and End to the first or the last: each calls `onSelect(key, { extend })`, and with `multiple`, Shift with any of them asks to `extend` the selection from its anchor to that item. Letters typed close together, a Space among them, go to the first item whose name, `nameOf(key)`, starts with them, Shift or not: `onSelect(key, { extend: false })`. With `multiple`, Command-A calls `onSelectAll()`. In a tree, `expanded(key)` is true, false, or null for an item that does not fold: Right unfolds a folded item (`onToggle(key, true)`) or goes to the first of `childrenOf(key)`, keys or a promise of them, and Left folds an unfolded item (`onToggle(key, false)`) or goes to `parentOf(key)`. Space, while no name is being typed, calls `onPreview(key)`, Return `onRename(key)`, and Command-Down or Command-O `onOpen(key)`, for the lead; a key whose callback is not given is not taken, but for Space, which would scroll the list. These are the list's own keys, as Command-A is a text field's: the keymap does not list them and the person does not rebind them. A mod that offers one as an action of its own binds it with `deck.keys`, as Finder binds Open to Command-Down, and a chord the mod binds is the mod's before the list hears it, so the person's binding holds.

## Sections and paths

- `section({ label, icon, actions, collapsed, onToggle, title, onHeading, onHeadingMenu, headingTitle })` returns `{ element, body, heading, actions, setCurrent(on), setCollapsed(on), isCollapsed() }`. With `collapsed` a boolean the heading folds the body: a press calls `onToggle(next)`, and the owner folds it. `actions` are `{ icon, title, run(button) }`.
- `breadcrumb({ onGo })` returns `{ element, set(parts), partAt(element) }`; `partAt` answers the part an element is in, `{ key, element }`, or null. `parts` are `{ key, label, title, current, icon }`; what does not fit folds into a menu.

## Files and folders

- `folderIcon({ open, size })`: a folder's icon, in the folder colour.
- `treeRow({ depth, folder, folds, open, glyph, name, size })` returns `{ element, setActive(on), setActionsShown(on), setOpen(open) }`. Its name is marked `data-name`, what a rename types over.
- `inlineEdit(label, { value, required, selectStem, onCommit })` renames a label in place, the field holding `value` (the label's text unless given); `onCommit(text)` answers nothing or why it refused. An emptied field gives up unless `required` is false. Resolves whether it renamed.
- `movesInto(from, folder)`: whether a move changes anything and is possible.
- `folderDrop(zone, { kind, paths, folderAt, onDrop })` makes a tree a drop target of moves into folders, as `dropTarget` does: `paths(payload)` is a function that answers where the dragged things are, all in one folder, and `folderAt(element)` answers the folder under the pointer, `{ folder, mark }`, or null. A drop into a dragged folder, or into what it holds, is refused, and one into the folder they are already in stays.
- `treeFolderAt({ row, markOf, top, topMark })` makes a `folderAt` for a tree: `row(element)` answers the row an element is in, `{ path, folder, element }` with `folder` whether it is a folder's, or null; `markOf(folder)` is the element that lights for a folder; `top` is the folder a drop on no row goes into, and `topMark` what lights for it.

## Dragging and sizing

- `sortable(list, { onReorder, depth, movesInto, onMoveInto, describe })` decorates a keyed list and returns its dispose: the rows put in a new order by a drag. `onReorder(key, toKey)` hears that the item `key` goes where `toKey` is, and the owner draws the new order. With `depth: { indent, project(key, toKey, levels), descendants(key) }` the rows nest: a sideways move asks for a level deeper or shallower for each `indent` px, to the nearest, `project` answers the depth the row would take there, the held row stands that far in, and `onReorder(key, toKey, depth)` hears a move to the same place at another depth too. `descendants(key)` answers the keys of the rows that go with the row `key`, a folder's: they are put away while it is held, so it never goes among them, and the owner draws them under it where it lands. With `movesInto(key, toKey)`, a row held over the middle half of a row it answers true for goes into that row rather than beside it, as a folded folder takes what is dropped on it: the row is marked while the held one is over it, and `onMoveInto(key, toKey)` hears the drop. With `describe(key)`, `{ kind, payload, text, icon }` as `dragSource` has it, or null for a row that stays in the list, a row held over a `dropTarget` of that kind that answers a place is carried as `dragSource` carries it, and is sorted again when it leaves it; held anywhere else, it is sorted, and past the list's ends it goes first or last. A row alone in its list is lifted only to be carried.
- `marquee(area, { listAt, selection, onSelect })` is a decorator: selection by a rectangle dragged in `area`, as macOS Finder's. `listAt(element)` answers the keyed list a rectangle started there selects in, `{ list, ... }`, or null where none starts: where a press drags a row, a rectangle does not start. The rows the rectangle crosses are selected: with Shift held at the press they are added to those of that list already selected (`selection()`), with Command they are toggled in that selection, so a selected row it crosses is let go, and with neither they are selected alone. A click in the list but on none of its rows selects nothing; a press on a scroll bar is no click. `onSelect(keys, place)` hears each change: the keys in the list's order, with what `listAt` answered. The rectangle stays inside the box that scrolls the list, and scrolls it at its edges.
- `dragSource(area, { itemAt, describe })` is a decorator: `describe(item)` is `{ kind, payload, text, icon }`.
- `dropTarget(zone, { kind, placeAt, onDrop })` is a decorator: `placeAt(element, payload)` answers the place under the pointer, `{ mark, stays }`, or null where nothing lands. `mark` is the element that lights while the thing is over it, and a place that `stays` is where the thing already is, so a drop there drops nothing. `onDrop(payload, place)` takes any other.
- `resizer(handle, { axis, grow, size, min, max, onResize, onCommit, onClick, onDrag, resizable })` is a decorator: `axis` is `x` or `y`, and `grow` is how much the size changes for each px the pointer moves along it, `1` by default and `-1` for a handle at the start of what it sizes. `size()` reads the size, `onResize(px)` draws one, `onCommit(px)` keeps the one let go of. `min` and `max` are numbers, or functions read at the press. Past a limit the edge gives and springs back; a press that does not travel is a click, `onClick`. `onDrag(on)` hears a drag start and end, and `resizable()`, read at the press, says whether a drag sizes at all.

## Everything else

- `emptyState({ icon, title, hint, actions })` returns `{ element, set({ title, hint, actions }) }`.
- `spinner({ size })` and `loading({ text })` return `{ element }`.
- `icon(name, { size, fill, color, stroke })`: one of the kit's icons (Lucide), as SVG markup. A name it does not have throws. `iconOf(shapes, { size, fill, color, stroke })` draws shapes of the mod's own in the same frame. `sanitizeIcon(svg)` is an icon another mod gave, as an `<svg>` element rebuilt from its shapes alone, so nothing in the text runs, loads or styles the page, and no bigger than 24 by 24, its shape kept: what a mod draws of another's icon goes through it.
- `element(tag, { className, style, text })`.
- `edgeFade(element, { size })`, `pressable(element)`, `selectable(element)`, `titleBar(element)` are decorators: the edges of what scrolls fade, something pressed is washed and ringed, text can be selected, and a bar along the top of the view lies in the window's title bar area (MOD.md, `deck.view`): at least as tall as it, clear of the window's buttons, and dragging the window wherever nothing in it is pressed. Buttons, fields, links and anything with a `tabindex` in it take presses; another control there marks itself `-webkit-app-region: no-drag`.
- `isFullyVisible(element)`, `capturePointer(cursor)` (returns the release), `mix(foreground, background, amount)`, `alpha(color, amount)`.
- `installedFonts(faces)`: the faces (`{ font }`) installed on this Mac.

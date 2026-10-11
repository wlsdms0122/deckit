# The kit (`context.ui`)

What a plugin draws with. Every plugin gets the same kit, so a row, a menu or a drag looks and
answers the same in all of them. A plugin that builds its own is a plugin that looks like
another app. When something you need is missing here, it belongs here, not in the plugin.

The code is `ui/` (in the deckit package, `source/deckit/deckit/ui/`), one file per component in
`kit/component/`. This page is where each one's options are written: first an index by what you
want to do, then each component's call and options.

`context.ui` is one object, the same for every plugin, and it is frozen all the way down: its
members and its constants are the very ones the panel draws with, so they cannot be written to.
Which file a member comes from does not matter to a plugin. Most components return the element
they made, with a few methods added to it; those are listed with each one. A glyph argument
(`svg`, `icon`) is SVG markup, usually `ui.icon(name)`, unless it says it also takes a name.

## Buttons (`component/button.js`)

| You want | Use |
| --- | --- |
| a glyph that does something | `iconBtn(svg, title, onClick, { size, quiet })` |
| words that do something, primary or destructive | `textBtn(text, title, onClick, { size, icon, variant })` |
| a small action on a row, shown while the row is pointed at | `miniBtn(label, title, onClick)` |
| one of a few choices, side by side | `segmented(items, { value, onChange, size, accent })` |
| a button that stays pressed (Aa, .*) | `toggleButton(label, title, { on, onChange })` |
| a setting that is on or off | `toggle({ on, onChange })` |
| a tooltip that says the shortcut, and stays right when it is remapped | `tip(el, text, chord)` |

A plugin does not style a button of its own; when none of these fits, the kit needs another option.

### `iconBtn(svg, title, onClick, { size, quiet })`

- `size`: `"md"` (30px, the default) for a toolbar, `"sm"` (24px) for the thin bar a block carries
  above itself.
- `quiet`: rests in a colour mixed toward the ground and comes up to full under the pointer, for
  controls beside content. Without it the glyph is at full strength, for a toolbar that is the
  point of where it sits.

Returns the button, with:

- `setPressed(on)`: for a toggle. On is drawn in the accent and sets `aria-pressed`.
- `setEnabled(on)`: off, it cannot be pressed and is mixed further down (never faded).
- `setIcon(svg)`: for a button whose glyph is its state.

Each returns the button.

### `textBtn(text, title, onClick, { size, icon, variant })`

An outlined word, for an action a glyph cannot name ("Today", "Sign in").

- `size`: `"md"` (30px) or `"sm"` (24px, for one in a section heading).
- `icon`: a glyph before the word.
- `variant`: `"plain"` (the default); `"primary"`, filled in the accent, for the one answer a
  question expects; `"destructive"`, filled in the alert tone, for that answer when it removes
  something.

Returns the button, with `setText(text)` and `setEnabled(on)`, each returning the button.

### `miniBtn(label, title, onClick)`

A row's own action. `label` is SVG markup or plain text. It is invisible until its row is pointed
at or holds the keyboard; `hoverable` does the showing, and shows only these. It is hidden by
opacity, so Tab still reaches it, and reaching it shows it. Its click does not reach the row.

### `segmented(items, { value, onChange, size, accent })`

One choice among a few, as one control.

- `items`: `[{ key, label, title?, lead? }]`. `lead` is an element before the label (a dot, say).
- `value`: the key chosen at first.
- `onChange(key)`: runs for the person's clicks only, and not for a click on the current choice.
- `size`: `"md"` or `"sm"` (for a control inside a header that already has a title).
- `accent`: a colour of yours to fill the choice in, with white text on it (a calendar's own
  colour). Without it the choice is the cursor wash and full-strength text.

Returns the bar, with `setItems(items)` (keeps the buttons it already has, so the one under the
pointer is not replaced), `setValue(key)` (moves the choice without calling `onChange`) and
`value`.

### `toggleButton(label, title, { on, onChange })`

A small on/off beside a field: match case, whole word, regular expression. `label` is short text or
SVG markup. Lit in the accent when on. Pressing it leaves the keyboard in the field. `onChange(on)`
runs on each click. Returns the button, with `value` (read and set; setting does not call
`onChange`) and `setMarked(on)`: while it is off, the accent without the fill, to say that what it
opens is in effect anyway (a filter folded away with a scope still set).

### `toggle({ on, onChange })`

An on/off setting, a switch (`role="switch"`), in the accent when on. Returns it with `value` to
read and set; `onChange(on)` runs for the person's clicks only.

### `tip(el, text, chord)`

Sets `el`'s tooltip to `text (chord)`. `chord` is a function returning the chord the action is
bound to now (for instance `() => host.chordOf(...)`), read again each time the pointer arrives, so
a key remapped in Settings shows the new one. Returns `el`.

## Text and numbers (`component/field.js`)

| You want | Use |
| --- | --- |
| a text field with an icon and buttons in it | `field({ placeholder, value, icon, inline, trailing, size, clearable, onInput, onEnter, onEscape })` |
| a number with steps | `stepper({ value, min, max, step, unit, onChange })` |
| find (and replace) with case, word and regex | `searchBar({ placeholder, options, nav, replace, onChange, onNext, onPrev, onEscape })` |

### `field({ ... })`

A pill in the hover wash, ringed while it has the keyboard.

| Option | |
| --- | --- |
| `placeholder`, `value` | the input's |
| `icon` | a glyph before the text |
| `inline` | elements right after the text, before the clear button (a match count) |
| `trailing` | elements at the end, inside the pill (for instance `toggleButton`s) |
| `size` | `"md"` (28px) or `"sm"` (26px) |
| `clearable` | a round ✕ at the end while there is text; pressing it empties the field and calls `onInput("")` |
| `onInput(value)` | on every change |
| `onEnter(value, shift)` | on Enter; `shift` says Shift was held, "the other way" in a search |
| `onEscape()` | on Escape, which then goes no further |

Returns the wrapper, with `.input` (the `<input>`) and `setValue(v)`, which sets the text from code
and keeps the ✕ in step with it.

### `stepper({ value, min, max, step, unit, onChange })`

A number with − and + either side. It can be typed or stepped (the buttons, or the up and down
arrows); every value is rounded to `step` and kept inside `min..max`. Enter or leaving the field
takes what was typed; Escape puts back the last value. `unit` is shown after the number.
`onChange(value)` runs whenever the value changes. Returns the box, with `value` to read and set
(setting does not call `onChange`).

### `searchBar({ ... })`

A find bar: one field with its options inside it, the count after the text, and previous and next
after it; under it, when there is replacing to do, a second field with replace and replace all.

| Option | |
| --- | --- |
| `placeholder` | `"Find"` by default |
| `options` | which toggles to show, any of `["case", "word", "regex"]` (all three by default) |
| `nav` | previous and next buttons and the count; Enter goes to the next, Shift+Enter the previous. Without it, Enter calls `onChange` |
| `replace` | `{ onReplace?, onReplaceAll, open? }`: adds a chevron in front of the field that opens and closes the replace row (`open` is its first state). Enter in the replace field runs `onReplace`, or `onReplaceAll` when there is none |
| `onChange(state)` | `{ query, caseSensitive, word, regex }`, on every change |
| `onNext()`, `onPrev()`, `onEscape()` | |

Returns the bar, with:

- `setQuery(text, { caseSensitive?, word?, regex? })`: sets the field and the toggles named, without calling `onChange`.
- `focus(which)`: `"find"` (the default) or `"replace"`, with its text selected.
- `setCount(active, total)`: `"3/12"` on the third of twelve, `"0/0"` when nothing is found,
  nothing while the field is empty. `active` 0 with matches shows `–/12` (the cursor is not on
  one). Never in red: nothing found is an answer, not an error.
- `setReplaceOpen(on, { focus })`: opens or closes the replace row, focusing it unless `focus` is false.
- `state`: a copy of the current `{ query, caseSensitive, word, regex }`.
- `replacement`: the replace field's text.

## Menus (`component/menu.js`)

| You want | Use |
| --- | --- |
| a menu under a button or at the pointer, with submenus | `menu(items, { anchor, at, onClose })` |
| a dropdown | `select(options, { value, onChange })` |
| a right click on a list (and ⇧F10, the menu key) | `contextMenu(area, { rowAt, items, keyRow })` |
| buttons floating over a selection | `floatingBar()` |
| a list under the caret, the keyboard staying in the text | `suggestions({ onPick })` |

### Items

An item is `{ label, icon, hint, checked, font, disabled, run, items }`:

- `icon`: a glyph name or SVG markup, before the label.
- `hint`: quiet text at the end (a shortcut).
- `checked`: when any item has a boolean `checked`, the menu has a column of ticks and these are ticked.
- `font`: a font family for the label (a font menu previewing its faces).
- `disabled`: drawn dim, never highlighted, never run.
- `run()`: what choosing it does.
- `items`: a submenu, opened instead of running. It opens on pointing at the row after a moment
  (so crossing rows on the way to it does not open each), or by → or Enter.

`"-"` between items is a line between groups. A line at either end, or two in a row, is not drawn,
so a list can be built out of groups that may each be empty.

Give the "…" button and the right click the same list function.

### How a menu behaves

While it is open the menu has the keyboard: the arrows walk it, Enter or Space takes an item, →
opens a submenu, ← or Escape puts a submenu away and leaves its parent open, and Escape or Tab
closes it. A press elsewhere, a scroll of the page under it, a resize or the window losing focus
put it away. Taking an item anywhere in it closes it and every menu it hangs from, then runs the
item. It is a layer of the panel's one stack of what floats: an Escape closes the menu rather than
the panel, and one opened inside a modal is drawn above it. It stays on screen, opening up or to the
left near an edge.

### `menu(items, { at, anchor, onClose })`

Opens at `at` (`{ x, y }`, for instance an event's `clientX`/`clientY`) or under `anchor` (an
element). Under an anchor it is that button's menu, one at a time:
pressed again while its menu is open, the button closes it, and `menu` returns `null`. Otherwise it
returns `{ close(), open, el }`. `onClose()` runs when it closes.

### `select(options, { value, onChange })`

A dropdown pill with the kit's menu under it, for a choice too long for `segmented`. `options` are
`{ value, label, font? }` (`font` previews what the label names). It opens on a click, or on Space,
Enter or the arrows while it has the focus. `onChange(value)` runs when the person picks another
value. Returns the pill, with `value` to read and set.

### `contextMenu(area, { rowAt, items, keyRow })`

The right click of a list, a grid or a page.

- `rowAt(element)`: the row an event landed in, or null for the space around the rows.
- `items(row)`: the menu for that row (or for the space, when `row` is null). Null or an empty
  list means no menu here, and the event is left alone.
- `keyRow()`: the row the keyboard is on, for the menu key and ⇧F10. By default the row holding
  the focus (`rowAt(document.activeElement)`); give it for a list that keeps its own cursor. Opened
  from the keyboard, the menu sits under that row, or at the area's top corner when there is none.

While the menu is open its row wears an accent ring, so it is clear which row the menu is for.
Pressing the menu key again closes it. Returns `area`.

### `floatingBar()`

An empty bar in the menu's box, fixed in the page and hidden. You fill it, place it (`left`, `top`)
and show it (`display: "flex"`). Pressing it never takes the keyboard (and so the selection) from
the text. It is not a layer: the text decides when it goes.

### `suggestions({ onPick })`

A list under a caret, drawn as a menu, while the keyboard stays in the text being typed. Returns:

- `show(items, rect)`: opens it, or redraws it, under `rect` (the caret's box; above it when there
  is no room below). `items` are menu items; their `run` is not used.
- `place(rect)`: only moves it.
- `step(by)`: moves the cursor (wrapping), for the text's arrow keys.
- `take(i?)`: takes the row under the cursor (or row `i`): closes the list, then calls `onPick(item)`.
- `close()`, and `open`.

The pointer aims and clicks as in a menu. Your text's key handler decides what steps, takes and
closes. It is not a layer, and it is in the page only while it is open.

## Lists and rows (`component/row.js`, `sortable.js`, `drag.js`, `inline-edit.js`)

| You want | Use |
| --- | --- |
| a row, and a list of them | `row({ dense })`, `list({ most, dense })` |
| a long list drawn without holding up typing | `drawInSteps(list, items, draw, { first, slice })` |
| a row of a tree: stepped in by depth, a chevron that turns while open, a glyph, a name | `treeRow({ depth, folder, folds, open, glyph, name, dense })` |
| a folder's icon, closed or open, as every tree draws it | `folderIcon(open, size)` |
| the hover and current-row wash | `hoverable(row, isActive, { shows })` |
| a row leaving with an animation | `leaveRow(row, then)` |
| to redraw a list without pulling a row out from under the pointer | `whenFree(list, draw)` |
| the person to put rows in their own order | `sortable(list, onReorder)` |
| to move something to another place (a note or a file into a folder): a label of it follows the pointer, the place it would go is lit, and let go where nothing takes it, it goes back | `dragSource(area, { itemAt, what })`, `dropTarget(zone, { kind, placeAt, onDrop })` |
| to move files or notes into folders, by the one rule every list keeps (the folder it is already in is lit quietly and takes it back, never into itself) | `folderDrop(zone, { kind, path, folderAt, onDrop })`, `treeFolderAt({ row, markOf, top, topMark })` for a tree, and `movesInto(from, folder)`, the rule itself, to ask again at the moment of moving |
| to rename in place, Finder-style | `inlineEdit(label, { stem, commit })` |

### `row({ dense })` and `list({ most, dense })`

A row is a flex line 28px tall with 8px side padding and 8px between its parts, in 15px type.
`dense` is for a list of many small things read at a glance (a file tree, search hits): 24px, 13px
type, 6px between parts.

A list is as tall as its rows: the column it sits in scrolls as a whole, the way a sidebar does,
and a long section is folded rather than squeezed. `most` is for a list kept above something else
the person works in, which must not push it away: it shows that many rows and scrolls inside past
them, its edges faded where it goes on. Give it the same `dense` as its rows, so that many rows is
the right height.

### `treeRow({ depth, folder, folds, open, glyph, name, dense })`

A row of a tree, the same in every tree (Notes and the Editor use it).

- `depth`: steps it in 14px a level.
- `folder`: draws a folder's icon (`folderIcon`), open or closed by `open`. Otherwise `glyph`.
- `folds` (`folder` by default): whether it has a chevron. A row without one keeps its place, so
  names line up. The chevron turns while `open`.
- `name`: the label, marked `data-name` (what `inlineEdit` takes). The chevron is marked
  `data-caret`, for a tree whose chevron folds without opening.

The row is only drawn; what pressing it does is the tree's.

### `folderIcon(open, size)`

A folder's glyph, closed or open, in the folder tint every tree uses. Returns SVG markup.
`size` is 15 by default.

### `hoverable(row, isActive, { shows })`

Makes a row answer the pointer: the hover wash under it, the cursor wash while `isActive()` is true,
and its `miniBtn`s shown while it is pointed at, holds the keyboard, or `shows()` is true (a row
opened in place, whose actions are for what is being looked at). Only buttons made by `miniBtn` are
shown and hidden. Call `row.repaint()` when what `isActive()` answers changes. A row drawn under a
resting pointer is lit at once rather than a frame late. Returns the row.

### `leaveRow(row, then)`

A row leaving, before the list is redrawn without it: it folds away, and `then()` runs when it is
gone (usually the redraw). Lists are rebuilt whole, so the exit has to come first. A second call on
a row already leaving does nothing. A row not on screen (in a folded section), or no motion, calls
`then()` at once.

### `drawInSteps(list, items, draw, { first, slice })`

Empties `list` and draws `items` into it, `draw(item)` making each one's element: the first `first`
(80) at once, then `slice` (80) at a time, each step its own task, so a field the list answers takes
the keys typed meanwhile. Drawing into the same list again (with nothing, to clear it) stops what
was still to come of the last. Drawn again where it was scrolled to, the first step goes on until
the list reaches that far, and the place is kept.

### `whenFree(list, draw)`

Redraws a list now, or once no row of it is held (being reordered, dragged or renamed) or leaving.
Only the last `draw` asked for runs, since each draws the whole list. Use it for every redraw of a
list that has any of those.

### `sortable(list, onReorder)`

Rows the person can put in their own order by dragging, within one list. The list's children are its
rows (those laid out). The row itself is lifted and carried along the list, the others stepping
aside. `onReorder(from, to)` is told once it is dropped somewhere else, `to` being where it now
stands; you own the order and redraw or move the row. Returns the list.

### `dragSource(area, { itemAt, what })`

Things in `area` that can be picked up and taken somewhere.

- `itemAt(target)`: the thing under a press, or null (the press is then the area's own).
- `what(item)`: `{ kind, payload, text, icon? }`, or null for a thing that cannot be taken. `kind`
  pairs it with the targets that take it; `payload` is what the target is handed; `text` and `icon`
  (a glyph name or SVG markup) are the label that follows the pointer.

The thing stays where it was, stepped back, while its label is carried. Let go where nothing takes
it, over the place it is already in, or called off, it goes back and nothing is done. Returns `area`.

### `dropTarget(zone, { kind, placeAt, onDrop })`

A place in `zone` that takes things of `kind`.

- `placeAt(element, payload)`: for the element under the pointer, where the thing would land:
  `{ mark, stays?, ... }`, or null when it cannot land there. `mark` is the element lit while the
  thing is held there (in the accent, or quietly when `stays` says it is already there and would
  not move). The rest is yours, handed back in `onDrop`.
- `onDrop(payload, place)`: when it is let go there. Never called for a place that `stays`.

Only the one element under the pointer is asked about, never what lies under it, by the zones it is
in, innermost first. Returns a function that removes the target, for a zone that goes away while the
page stays.

### `folderDrop(zone, { kind, path, folderAt, onDrop })`

A drop target that moves things into folders by `movesInto`. The folder the thing is already in
`stays` (lit quietly, letting go there takes it back); the thing itself and anything inside it is
no place at all.

- `path(payload)`: the held thing's path.
- `folderAt(element)`: the folder the element under the pointer stands for, `{ folder, mark, ... }`, or null.
- `onDrop(payload, place)`: moves it.

Returns what `dropTarget` returns.

### `treeFolderAt({ row, markOf, top, topMark })`

A `folderAt` for a tree of rows: a folder's row is that folder, a file's row is the folder it is in
(as Finder takes a drop on a file), and anywhere else in the zone is the top folder.

- `row(element)`: the row the element is in, as `{ path, folder, el }` (`folder`: whether it is
  one; `el`: the row), or null.
- `markOf(folder)`: that folder's row, lit while a thing is held over it, or null when it is not on screen.
- `top`, `topMark`: the top folder, and what lights for it.

The place it gives also carries `row`, what `row(element)` returned.

### `movesInto(from, folder)`

Whether moving `from` into `folder` moves it at all: not into the folder it is already in, nor into
itself or anything inside it. Paths are `"/"`-separated (a note's `"Release/a.md"`, a file's
absolute path); `""` is the top of a relative tree and `"/"` the root of the disk. Ask it again at
the moment of moving, since something may have moved since the thing was picked up.

### `inlineEdit(label, { stem, commit })`

Renames in place, the way Finder does: `label` (a tree row's `data-name`) becomes a field over the
same spot, in the same type, as wide as the name.

- `stem`: selects the name up to its extension, so typing keeps the kind.
- `commit(text)`: called on Enter or on leaving the field, with the trimmed text. It returns (or
  resolves to) nothing when the name was taken, or a string saying why not; a thrown error's
  message counts as that string. After an Enter the field stays, with the reason under it; after
  the field was left, the label comes back and the reason shows under it for a few seconds.

Escape, an empty name or the name unchanged put the label back. While the field is up the row is
the field's: presses and keys on it are not the row's, and a redraw through `whenFree` waits. An
Enter or Escape gives the keyboard back to where it was, or to the list the row is in. Returns a
promise of whether it was renamed; when it was, the label already shows the new name.

### Reordering and moving

Reordering and moving are different acts and look it. Reordering lifts the row itself and
carries it along its list while the others make room, since where it goes is a place in that
order. Moving takes it out of its list into a place with no order to make room in, so what follows
the pointer is a small label (its icon and name) that leaves the places in sight, and the row
stays where it was, stepped back. Neither uses the browser's drag, whose picture leaves
the panel and cannot be styled.

Both are one gesture underneath, with the same rules:

- a press is a click until the pointer travels 4px;
- a press in a field (an input, a text area, editable text) is the field's;
- the click that ends a drag is the drag's, not the thing's under it;
- Escape, or the system taking the gesture back, puts it back;
- held near the top or bottom edge of what scrolls under it, that scrolls, faster the nearer the
  edge, and the wheel scrolls it too, so a place out of sight can be reached;
- while it is held the list is held, so a redraw through `whenFree` waits for it.

## Layout (`component/section.js`, `popover.js`, `resizer.js`)

| You want | Use |
| --- | --- |
| a headed block in a sidebar, foldable, with action buttons | `section(label, { icon, collapsed, onCollapse, actions, title, onHeading, onHeadingMenu, headingTitle })` |
| a path of places to go back to | `breadcrumb({ onGo })` |
| a floating panel anchored to a control | `popover({ width, onClose })` |
| a handle that resizes something, with a give past its limits | `resizer(handle, { axis, grow, size, min, max, resize, commit, onClick, onDrag, resizable })` |

### `section(label, { ... })`

| Option | |
| --- | --- |
| `icon` | a glyph before the label. A section over a list has one |
| `collapsed` | a boolean makes the section foldable, folded or open at first. The whole heading is the fold control, with a caret, and the rows step in under the heading's icon. Without it the heading is set in by a row's padding, so its icon stands over its rows' icons |
| `onCollapse(folded)` | when the person folds or opens it |
| `actions` | `[{ icon?, title, run(button) }]`, quiet icon buttons at the heading's end, first to last (a plus when `icon` is left out). `run` is handed its button, for an action that opens a menu under it |
| `title` | `true` for the one heading that names the screen: large and heavy, at full strength, with no icon |
| `onHeading()` | makes a heading that does not fold a button of its own (Notes' All Notes opens the whole folder) |
| `onHeadingMenu(event)` | the heading's right click |
| `headingTitle` | the tooltip of an `onHeading` heading (the label by default) |

Returns the section, with:

- `body`: where its rows go.
- `heading`: the heading element, for a caller that marks it as where a drop would land.
- `actions`: the action buttons, for changing their state.
- `setCurrent(on)`: lit as a current row while what the heading opens is on screen.
- `setCollapsed(folded)`, `isCollapsed()`: `setCollapsed` does not call `onCollapse`.

### `breadcrumb({ onGo })`

Where this is, as a path of buttons ("All Notes › Release"), each a way back to that place. Returns
the bar; `setParts([{ key, label, title?, current?, icon? }])` draws it. A `current` part is where you
are and is not a button; every other part calls `onGo(key)`. The same parts again are left as they
are drawn. Each part carries its key as `data-crumb`, so a caller can make the parts take drops.

A path too long for its room keeps its end whole and folds its start into a "…" button, which
lists the folded places in a menu, nearest first (with each part's `icon`). A place is shown whole
or folded, never cut into a fragment of its name; only the current one is shortened, when even it
alone does not fit. The "…" carries the nearest folded place's key as `data-crumb`, so a drop on it
lands one level up from what is shown. It is drawn again as its room changes.

### `popover({ width, onClose })`

A card that floats beside what opened it (an event's details beside the event). `width` is its
largest width (340px by default; never under 230px). Returns the element, for you to fill, with:

- `show(anchor)`: places it under `anchor` (above it near the bottom edge) and brings it in. On
  one already open it moves it.
- `close()`, and `open`.

Escape and a press anywhere but the card and its anchor put it away. It is a layer, drawn above what
is below it in the stack, a modal included. `onClose()` runs once per close, however it closed.
Build it once and reuse it.

### `resizer(handle, { ... })`

Pressing `handle` and dragging it resizes something along one axis: a sidebar's width, a log's
height, the split between two panes. What is resized, and how it is drawn, is yours.

| Option | |
| --- | --- |
| `axis` | `"x"` or `"y"` |
| `grow` | `1` when moving right or down makes it bigger, `-1` when it makes it smaller (a pane under its handle) |
| `size()` | how big it is now |
| `min`, `max` | numbers, or functions read at each move (a window resizes) |
| `resize(px)` | called as it moves |
| `commit(px)` | once it is let go, inside `min..max` |
| `onClick()` | a press that does not travel, and Enter or Space on the handle |
| `onDrag(on)` | when a drag starts and ends, for a handle that stays lit while held |
| `resizable()` | false leaves only the click (a folded sidebar opens by its click): a press that travels is then nothing at all |

Past either limit it gives a little, never more than 40px, and let go it springs back to the limit
through `resize`. Returns `handle`.

## Nothing here yet, or not yet (`component/empty-state.js`, `loading.js`)

### `emptyState({ icon, title, hint, actions })`

What a screen says when it has nothing to show yet: a large quiet glyph, what is missing (`title`),
what to do about it (`hint`), and the buttons that do it (`actions`, elements, usually
`textBtn(..., { size: "sm" })`), centred. It grows to fill the column it is put in; anywhere else
give it its size. Returns it, with `setTitle(text)`, `setHint(text)` and `setActions(elements)`.

### `spinner(size)` and `loading(text)`

`spinner(size)` (14px by default) is a small turning ring in the text's colour, held still when
motion is reduced. `loading(text)` is a spinner and what is being waited for, centred, for the first
load of a pane or a sheet.

## Questions (`component/modal.js`, `dialog.js`, `color-picker.js`)

| You want | Use |
| --- | --- |
| to ask for a yes, or a few values | `dialog({ title, message, content, fields, confirmLabel, cancelLabel, extraLabel, onExtra, destructive, onConfirm, onClose })` |
| a colour | `colorPicker({ title, value, onPick })` |
| a card of your own over the panel (a list to pick from) | `sheet({ title, fill, ... })` |

Each is a card over a scrim, a layer of the stack: Escape and a press on the scrim close it, only the
top one answers keys, and the keyboard goes back where it was when it closes. While one is up, keys
typed into it do not reach a plugin's own listeners on the document.

### `dialog({ ... })`

| Option | |
| --- | --- |
| `title` | |
| `message` | text, or a list of paragraphs. It can be selected and copied |
| `content` | a node of yours between the message and the fields, for what is a list rather than prose |
| `fields` | `[{ key, label, type, value, placeholder, options }]`, `type` one of `"text"` (the default), `"color"` (`options` are the preset colours, and a + opens the colour picker) or `"switch"` (a boolean, its label beside it) |
| `confirmLabel`, `cancelLabel` | `"Save"` and `"Cancel"` by default |
| `destructive` | the confirm button in the alert tone |
| `extraLabel`, `onExtra()` | a third answer, between Cancel and the confirm, never the primary; in the alert tone when `destructive` |
| `onConfirm(values)` | `{ [key]: value }`; text as typed, not trimmed |
| `onClose()` | whenever it closes, answered or not, and before `onConfirm` |

The first text field has the keyboard; Enter in a field confirms. Returns `{ close() }`.

### `colorPicker({ title, value, onPick })`

A saturation field, a hue strip and a hex field. `title` is "Pick a colour" by default, `value` the
colour to start from (`#rrggbb` or `#rgb`). `onPick(hex)` gets `#rrggbb` when the person presses
"Use colour". Returns `{ close() }`.

### `sheet({ ... })`

The shell the other two are built on, for a question their fields cannot ask: a list to pick from,
content that arrives after the sheet is up.

| Option | |
| --- | --- |
| `fill(card)` | draws into the card. It may return an element to give the keyboard to (selected, if it can be) |
| `title` | |
| `confirmLabel`, `cancelLabel`, `destructive`, `extraLabel`, `onExtra` | as in `dialog`. `confirmLabel: null` leaves Cancel the only button, for a sheet answered by what is in it, and Enter then confirms nothing |
| `chrome` | `false` draws no title and no buttons, with little padding, and leaves Enter to you |
| `align` | `"center"` (the default) or `"top"` |
| `width` | CSS width, `min(420px, calc(100vw - 48px))` by default |
| `onConfirm()` | after it closes, on the confirm button or Enter in an input |
| `onClose()` | once, however it closed, before `onConfirm` |

Returns `{ close() }`.

## Fonts (`component/fonts.js`)

`installedFonts(faces)`: which of `faces` (`[{ value, label, font }]`, `font` a CSS family) this Mac
has, for a font choice that offers only what can be drawn. A face with no `font` (the system's own)
is always kept.

## The vocabulary

Not components, but what they are drawn out of, for what a plugin draws itself:

- `icon(name, size, { fill, color })`: the kit's glyphs (Lucide), as SVG markup, 15px by default,
  stroked in the text's colour unless `color` says otherwise. The names: `plus`, `minus`,
  `pencil`, `x`, `check`, `chevronDown`, `chevronUp`, `chevronLeft`, `chevronRight`, `arrowUp`,
  `ellipsis`, `filter`, `search`, `replace`, `replaceAll`, `reload`, `folder`, `folderOpen`,
  `folderPlus`, `folders`, `filePlus`, `fileText`, `trash`, `copy`, `download`, `home`, `grid`,
  `list`, `columns`, `layers`, `tableOfContents`, `layoutDashboard`, `eye`, `eyeOff`, `star`,
  `bookmark`, `link`, `window`, `externalWindow`, `dockWindow`, `panelLeft`, `puzzle`,
  `calendar`, `calendarDays`, `clock`, `bell`, `bellOff`, `info`, `keyboard`, `server`, `globe`,
  `gear`, `sliders`, `play`, `square`, `power`, `mic`, `video`, `monitor`, `volume`, `volumeOff`,
  `messageSquare`, `mapPin`, `door`, `shieldCheck`, `grip`, `wrapText`, `anvil`, `brain`, `rocket`.
  A glyph the kit lacks is added to its table, not drawn by the plugin.
- `accent`: the one colour that means "on" (a switch, a pressed toggle, the primary button).
- `tone` (`ok`, `warn`, `alert`), `wash` (`hover`, `cursor`): colours by meaning, so a plugin says
  a state rather than picking a colour. The washes are see-through on purpose.
- `alpha(colour, a)`, `blend(fg, bg, t)`: colour arithmetic. `alpha` is the colour see-through,
  which is not what `opacity` on an element does: that fades the background too, and over a
  scrolling page the page is then read through the box. `blend` mixes `fg` toward `bg` (`t` 1 is
  all `fg`). Controls are mixed to solid colours, never faded.
- `motion`: `fast`, `base`, `slow` (durations, `"0ms"` when motion is reduced) and `ease`, the one
  easing.
- `play(el, from, to)`: sets the style `from`, makes the browser take it, then sets `to`, so a
  transition plays instead of the element simply arriving. Use it for every transition from a
  start.
- `z`: layer numbers for anything floating: `scrim`, `panel`, `popover`, `modal`.
- `pressable(el, hover?, press?)`: the hover and press every kit button has, and a focus ring for
  the keyboard. Adds `el.setRest(colour)`, what it shows with no pointer on it.
- `selectable(el)`: text meant to be copied (the panel selects nothing by default).
- `scrollFade(el, size)`: fades a scrolling area's edge where there is more beyond it (up to `size`,
  18px).
- `aimOnMove(list, onAim)`: for a list with a keyboard cursor: `onAim(event)` runs on pointer moves
  over the list only when the pointer actually moved, so a list opening or redrawing under a
  resting mouse does not move the cursor.
- `grabPointer(cursor)`: covers the page for the length of a drag, so the pointer is not lost over
  an iframe, with `cursor` showing. Returns the function that ends it.
- `inSight(el)`: whether all of an element is on screen in what scrolls it (a list scrolls to a row only when it is not).

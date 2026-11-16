# DECKIT-40: What a seat reads

Status: draft
Area: shell

## Summary

A seat perceives the desktop by **reading** it: `seat/read` answers the desktop, one window or what is under one name as lines of text, or as the same content in data, what reads otherwise since a count the seat was handed, or a picture. This DECKIT fixes every line a reading prints, whichever DECKIT owns the thing read: the request and its keys, the three readings as a grammar and as data, how an element of a window's content reads, the **refs** by which a reading names what an input may then point at, the **mark** that counts the desktop's changes, and a picture.

## Motivation

[Users and seats](../DECKIT-38/SPEC.md) carries `seat/read` to a layer and says nothing of what it answers, and [seats at the desktop](../DECKIT-39/SPEC.md) takes a pointer event at a `ref` that only a reading hands out. A party that sits at a seat sees no screen: the text it is answered is all it works from. Where one implementation writes `window w1 "Notes" at 283,107` and another `Notes (1) [283, 107]`, a party written against one finds no window on the other, and a ref it kept from one names nothing there. Where one counts a change of the desktop and another does not, a party that asks what changed since its last reading is told nothing happened while a window closed.

## Rules

### The request

`seat/read` takes `of`, one of `desktop`, `window`, `node`, `changes` and `picture`, as [users and seats](../DECKIT-38/SPEC.md) lists the outputs, and beside it the keys of that output's row here. The first three are the **readings**, and take the same keys:

| key | value | read by |
|---|---|---|
| `window` | a string: a window's id as a reading writes it, `w3`, or its digits alone, `3` | `window` |
| `ref` | a string, a ref | `node` |
| `format` | `text` or `json`; `text` where it is left out | each |
| `depth` | an integer: how many levels of elements a document is read down; 30 where it is left out | `window`, `node` |
| `items` | an integer: how many items of one element that holds items are listed; 30 where it is left out | `window`, `node` |
| `roles` | an array of strings: only the elements of these roles are listed, and those that hold them | `window`, `node` |
| `all` | a boolean: the whole of a document is read, and not only what is in view | `window`, `node` |
| `text` | an integer: how many characters of a name are listed; 80 for a `window` and 200 for a `node` where it is left out | `window`, `node` |
| `lines` | an integer: how many lines of text under a node are listed; all of them where it is left out | `node` |

| `of` | keys beside `of` | answers |
|---|---|---|
| a reading | those of the table above | table `{ text, mark }`, or with `format` `json` table `{ data, mark }` |
| `changes` | `since`, an integer | table `{ text, mark }` |
| `picture` | `window`, `ref`, `rect`, `scale`, under *A picture* | table `{ png, width, height, at }` |

`text` is a string, the reading in the grammar its rule gives; `data` is the same content as *The data form* gives it; `mark` is an integer, the desktop's mark as the answer was made. An integer is one as [a party from outside](../DECKIT-37/SPEC.md) fixes an integer. A `depth`, an `items`, a `text`, a `lines` and a `since` are counts: one below 0 is none.

Every reading is **for the seat that asks**: the desktop of that seat, as [seats at the desktop](../DECKIT-39/SPEC.md) gives each seat one, and no key names another.

A `seat/read` is refused at `call` with the first of these that is so, after what [users and seats](../DECKIT-38/SPEC.md) refuses of its `params`:

1. kind `INVALID_ARGUMENT`, where `format` is neither `text` nor `json`; where `of` is `window`, or `picture` with `window`, and `window` is not `w` and digits or digits alone; where `window` is left out of a `window` or `ref` of a `node`; where `depth`, `items`, `text`, `lines` or `since` is below 0; or where a picture is asked as *A picture* refuses it;
2. kind `STALE`, where `since` is above the mark now, under *Changes and the mark*;
3. kind `NOT_FOUND`, where `window` names no normal window open and no panel window on the seat's screen;
4. kind `GONE`, where a `ref` names nothing, under *Refs*.

### The lines

A reading is lines joined by LF, with no LF after the last. A line under another is written two spaces deeper for each level. The notation is ABNF's; these rules are every reading's:

```
count      = 1*DIGIT
integer    = [ "-" ] 1*DIGIT
point      = integer "," integer
size       = count "x" count
quoted     = DQUOTE *( char / escape ) DQUOTE
char       = any code point but DQUOTE, "\" and those below U+0020
escape     = "\" ( DQUOTE / "\" / "b" / "f" / "n" / "r" / "t" / "u" 4HEXDIG )
window-id  = "w" count
seat-id    = a seat's id
mod-id     = a mod's id
states     = "[" state *( ", " state ) "]"
```

A `point` is a point of the desktop from its top left and a `size` a width and a height, each number rounded to the nearest integer. A `quoted` is a string as JSON writes one: `escape` is written only for DQUOTE, `\` and a code point below U+0020, `u` with lower-case digits for those of them that have no letter. A `seat-id` is as [users and seats](../DECKIT-38/SPEC.md) fixes a seat's id and a `mod-id` as [the bundle](../DECKIT-2/SPEC.md) fixes `id`. A `window-id` is `w` and the window's id as [windows](../DECKIT-31/SPEC.md) numbers it.

### The desktop

```
desktop      = desktop-line *( LF seat-line ) LF dock-line *( LF "  " item-line )
               [ LF "  " menu-line *( LF "  " entry-line ) ]
               *( LF window-line ) *( LF panel-line )
desktop-line = "desktop " size " mark " count
seat-line    = "seat " seat-id " " quoted " " colour [ " at " point ] [ " key " window-id ] [ " (you)" ]
dock-line    = "dock (" count " items)"
item-line    = "item " quoted [ " [" item-state *( ", " item-state ) "]" ] " " ref
item-state   = "running" / "active" / "attention"
menu-line    = "menu " quoted
entry-line   = "menuitem " quoted " " ref
window-line  = "window " window-id " " quoted " " mod-id " at " point " " size [ " " states ]
panel-line   = "panel " window-id " " quoted " " mod-id [ " top" ] " at " point " " size [ " " states ]
```

- **`desktop-line`**: the desktop's size, and the mark.
- **`seat-line`**, one for each seat at the desktop, in the order they opened: the seat's id, its user's name, its colour's name as [seats at the desktop](../DECKIT-39/SPEC.md) gives a seat one, `at` and where its pointer is once an event of it had a place, `key` and its key window where it has one, and `(you)` on the line of the seat that asks.
- **`dock-line`**: how many items the Dock has, then a line for each in [the Dock](../DECKIT-33/SPEC.md)'s order: its name, which is its mod's name, or its id where the mod has none; its marks in the order `running`, `active`, `attention`, those that are so for the seat that asks; and its ref.
- **`menu-line`**, while the menu of an item of the Dock is open for the seat that asks: the name of that item, then a line for each choice of the menu in its order, with the words the menu shows for it and its ref.
- **`window-line`**, one for each normal window, front to back in the order of the seat that asks, those it minimized among them: the window's id; its title where its title bar is `titled` and it has one, and its mod's name otherwise, or its mod's id where the mod has no name; its mod's id; where its frame's top left is on the desktop and its frame's size; and its states, in this order: `key` and the id of the seat that holds its keyboard, where one does; `minimized`, where the seat that asks minimized it; `zoomed`; `tile` and the name of the tile it has.
- **`panel-line`**, one for each panel window on the screen of the seat that asks, in the order they opened, after every normal window: as a window's line, with its mod's name for the title, `top` where it stands at that edge, as [windows](../DECKIT-31/SPEC.md) fixes a panel window's `edge`, and for states only `key` and the seat that holds its keyboard.

No other window is listed.

### A window

```
window     = ( window-line / panel-line ) " mark " count
             *( LF "  " element ) *( LF "  " document-line *( LF "    " *"  " element ) )
document-line = "document " count " " part [ " " quoted ] " " size
part       = "content" / "child" / "overlay" / "web"
```

The first line is the window's line of the desktop's reading, with the mark. Under it come the **parts the shell draws** of a normal window, each as an `element` with its ref:

| part | role | name | ref |
|---|---|---|---|
| each button its title bar has, in the bar's order | `button` | `Close`, `Minimize`, `Zoom` | `w<id>.close`, `w<id>.minimize`, `w<id>.zoom` |
| its title bar, where the bar has a height | `titlebar` | the window's title, where it has one | `w<id>.bar` |

A button that is not enabled, as [windows](../DECKIT-31/SPEC.md) fixes when one is, has the state `disabled`. A panel window lists no part.

Then comes each **document** the window shows, from the one that lies lowest to the one on top, and after them those of the web pages shown inside them: its number, the `part` it is, for a `child` the id of the mod whose page it is, and the size of its page. `content` is the window's content, `child` a page another mod lays into [a region](../DECKIT-36/SPEC.md) of it, `overlay` what a page presents over itself, and `web` [a web page](../DECKIT-25/SPEC.md) shown inside one of them. A document's number is a count the shell gives a document as a reading, or an answer of `changes`, first lists it, in the order it lists them: the first document any lists is 1, and each one listed after that has none is given the next. A number once given stays the document's while its page shows that document; a page that loads another document has a new number as that one is next listed, and a page no reading has listed has none. Under each document come its elements, as *What an element reads as* gives them, an element under the element that holds it. A document whose page cannot be read is left out.

### A node

```
node       = element [ " at " point " " size / " " size ] [ " scroll " count " of " count ]
             *( LF 1*"  " element ) [ LF "  ... " count " more" ] [ LF "  " selection ]
selection  = "selection " count [ " to " count ]
           / "selection" [ " " count ":" count ] [ " (" count " selected)" ]
```

A node is what one `ref` names. Its first line is its own `element`, then where it is on the desktop and its size; for an element of a `web` document, its size alone. `scroll` is written for an element that scrolls: how far down it is scrolled, of how high what it holds is.

Under an element of a document come the elements it holds, as in a window's reading, and beside them its **text**: text an element holds itself and that is not the name of a line is a line of the role `text`, named by the text, with no ref. Where `lines` is given, the lines of text past that many are left out and `... n more` counts every line left out. A text field reads its own text so, where a window's reading stops at the field.

`selection` is written for a field: `selection 4` where its caret is at the offset 4 of its value, `selection 4 to 9` where that much is selected, and for editable content that holds its document's selection `selection 2:7 (5 selected)`, the line of text the selection ends in, counted from 1, how far into it, and how many characters are selected where any are.

A part the shell draws reads as its one line and its place: a part of a window as *A window* lists it; `w<id>.edge.<name>` as `edge` named by the edge; an item of the Dock as `item` with its name and its marks as states; and a choice of the Dock's menu as `menuitem`.

### What an element reads as

```
element    = role [ " " quoted ] [ " (" count ")" ] [ " " states ] [ " (" counted *( ", " counted ) ")" ] [ " " ref ]
counted    = count " items" / count " in view" / count " elements below"
```

A document is read as a person meets it: from its elements and the attributes they carry for assistive technology, as HTML and WAI-ARIA name them. An element with a **role** is a line; one with none is no line, and what it holds reads as held by the nearest line above it.

**The role** is the first word of the element's `role` attribute, none where that is `presentation` or `none`; else, by the element:

| element | role |
|---|---|
| `a` with `href` | `link` |
| `button`, `summary`; `input` of type `button`, `submit`, `reset`, `file`, `color`, `image` | `button` |
| `input` of type `checkbox`, `radio`, `range`, `search`, `number` | `checkbox`, `radio`, `slider`, `searchbox`, `spinbutton` |
| `input` of any other type but `hidden`; `textarea`; the outermost element of editable content | `textbox` |
| `select` | `listbox` where it takes several or shows more than one row, else `combobox` |
| `nav`, `main`, `header`, `footer`, `aside`, `article` | `navigation`, `main`, `banner`, `contentinfo`, `complementary`, `article` |
| `form`, `section`, where it has `aria-label` or `aria-labelledby` | `form`, `region` |
| `h1` to `h6` | `heading` |
| `ul`, `ol`; `li` | `list`; `listitem` |
| `table`, `tr`, `td`, `th` | `table`, `row`, `cell`, `columnheader` |
| `img`, unless its `alt` is empty | `img` |
| `dialog`, `progress`, `meter`, `option`, `output`, `iframe` | `dialog`, `progressbar`, `meter`, `option`, `status`, `document` |
| `details`, `fieldset` | `group` |

An element that names a node and has no role reads as `generic`.

**The name** is the first of these that is not empty, its white space runs made one space and its ends trimmed: the text of the elements `aria-labelledby` names; `aria-label`; the text of the element's first label; `alt`; the element's own text, for the roles `button`, `link`, `heading`, `tab`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `treeitem`, `checkbox`, `radio`, `switch`, `cell`, `gridcell`, `columnheader`, `rowheader`, `listitem`, `row`, `tooltip`, `status` and `alert`; `title`, or else `placeholder`. An element with no name writes none. A name longer than `text` characters is cut to that many, ends in `…` (U+2026) inside its quotes, and is followed by its whole length in parentheses.

**The states** are written in this order, each where it is so:

| state | where |
|---|---|
| `disabled` | the element is disabled, or `aria-disabled` is `true` |
| `checked`, `unchecked` or `mixed` | always one of them for the roles `checkbox`, `radio`, `switch` and those that begin `menuitem` |
| `pressed`, `expanded`, `selected`, `current`, `invalid`, `busy`, `haspopup` | the `aria-` attribute of that name is `true`; for another value but `false`, the name, `=` and the value, as `current=page`; `not pressed` and `not expanded` where that attribute is `false` |
| `required`, `readonly` | the element is so |
| `level` and a number | a `heading`: its `aria-level`, or the digit of its element |
| `focused` and a seat's id | the element has its document's focus; the id is that of the seat whose keys go to the document, left out where none's do |
| `value`, a space, and a `quoted` | a `textbox`, `searchbox`, `combobox` or `spinbutton` that holds a value, an empty one too, but for one of those the next row names: the value, flattened as a name is, cut to `text` characters and 40 at most as a name is cut, and escaped as a name is |
| `text` and a count | in place of `value`, such a field that hides what is typed, or editable content: how many characters it holds |
| `not in view` | in what `changes` lists alone: the element changed and is out of sight |

**The counts.** An element that holds **items**, lines of the roles `listitem`, `row`, `option`, `treeitem`, `tab`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `cell`, `gridcell`, `columnheader` and `rowheader` with no line between, writes `n items`, how many it holds that would be read were all of it in view, and, unless `all` is asked, `n in view`, how many of them are in view. Only the first `items` of those are listed, and the counts stay what they are: a seat tells a list that was cut by counting its lines against `n in view`, or against `n items` where `all` is asked. An element at the level `depth` lists nothing under it: it writes neither of those counts, and writes `n elements below` in their place, where it holds any element. That count is of every element it holds at any level, with a role or none, read or not; none of them is listed.

**What is read.** Unless `all` is asked, an element is read only where it is shown and some of it lies in what its document shows of it, inside every element around it that scrolls; an element that draws no box of its own and only passes its children on to its parent's layout is read with them. An element with `aria-hidden` `true` is never read, nor what it holds. With `roles`, a line is listed only where its role is one of them or it holds a line whose role is.

**The ref** of an element is `<document>.<n>`, under *Refs*.

### Refs

```
ref        = window-id "." ( "close" / "minimize" / "zoom" / "bar" / "edge." edge )
           / "dock." mod-id
           / "dock-menu." ( "open" / "keep" / "quit" )
           / count "." count
edge       = "top" / "bottom" / "left" / "right" / "top-left" / "top-right" / "bottom-left" / "bottom-right"
```

A **ref** names one thing a seat can point at, and is the same string for every seat.

| ref | names |
|---|---|
| `w<id>.close`, `.minimize`, `.zoom` | that button of the title bar of the normal window `w<id>` |
| `w<id>.bar` | the title bar of that window |
| `w<id>.edge.<edge>` | the edge or the corner of that window a drag resizes it by, as [windows](../DECKIT-31/SPEC.md) names them; no reading lists it |
| `dock.<mod>` | the item of the Dock of the mod `<mod>` |
| `dock-menu.open`, `.keep`, `.quit` | a choice of the menu of an item of the Dock, while that menu is open for the seat: the one that opens or shows the app, the one that keeps it in the Dock or takes it out, and the one that quits it |
| `<document>.<n>` | an element of the document of that number; `n` counts up from 1 in the document as an element is first listed |

A ref names what it names while that is there: a part of a window while the window is open and has that part, an item while the Dock has it, a choice while its menu is open for the seat, and an element while it is in its document and its page shows that document. A ref an element had is never another element's.

A ref **names nothing** where it is of none of these forms, or names what is not there or is there no more. `seat/read` of such a `node` and [a pointer event](../DECKIT-39/SPEC.md) at such a `ref` are refused at `call` with kind `GONE`.

### Changes and the mark

The **mark** is one count for the desktop, 0 as the host app starts. It goes up by 1:

- as a line of the desktop's reading would read otherwise for some seat, or one is added or leaves, where a seat's pointer is and `(you)` apart: any number of lines that change together raise it once;
- as a document a window shows is first heard of, or tells that what it shows changed.

Every reading and every answer of `changes` carries the mark as it was made.

`seat/read` with `of` `changes` answers what reads otherwise for the seat that asks since the mark `since`:

```
changes    = "changes " count " to " count *( LF change )
change     = "+ " line / "~ " line / "- " gone
line       = "desktop " size / seat-line / item-line / entry-line / window-line / panel-line
           / document-line " in " window-id / element
gone       = "desktop" / seat-id / window-id / ref / "document " count
```

The first line holds `since` and the mark now. `+` is a line that was not there at `since`, `~` a line that was and changed after it, each as it reads now, and `-` what was there and is gone, by its ref, a seat by its id, a window by its `window-id`, and by its number a document that had one whose page loaded another. A window that closed is told gone, and its documents with it by no line. The Dock's line is never told: it changes only as an item comes or goes, which is told. They come in this order: the lines of the desktop's reading that are new or changed, in its order; what is gone of the desktop; then, for each window on the seat's screen and each panel window on it, the documents first read since, each with the window it is in, and the elements that changed, came or went in the others.

With no `since`, the answer is `changes <mark> to <mark>` alone. A `since` above the mark now is a mark the desktop never had, and is refused at `call` with kind `STALE`.

A seat that watches `changes`, as [users and seats](../DECKIT-38/SPEC.md) fixes watching, is told `{ of = "changes", mark }`, `mark` an integer, after the mark goes up: raises that follow one another before it is told are told once, with the mark the desktop is at then.

### A picture

`seat/read` with `of` `picture` answers a picture of the desktop as the seat that asks has it, its windows in that seat's order:

| key | value |
|---|---|
| `window` | a string, as a reading's `window`: the picture is of that window alone, at its frame |
| `ref` | a string, a ref: of what it names, as much of an element as shows in its page |
| `rect` | table `{ x, y, width, height }`, numbers: of that rect of the desktop |
| `scale` | a number above 0 and at most 4: the pixels a point of the desktop is drawn with; 1 where it is left out |

With none of `window`, `ref` and `rect` it is of the whole desktop. It answers `{ png, width, height, at }`: `png` a string, the picture as a PNG in base64; `width` and `height` its size in pixels; `at` table `{ x, y }`, the desktop's point its top left is at.

It is refused at `call` with kind `INVALID_ARGUMENT` where more than one of `window`, `ref` and `rect` is written, where `scale` is not above 0 or is above 4, or where a member of `rect` is no finite number or its `width` or `height` is not above 0; with kind `REFUSED` where `ref` names an element of a `web` document; and as *The request* refuses a `window` and a `ref`.

### The data form

With `format` `json` a reading answers `{ data, mark }`, `data` a table that holds what the text says and the mark again under `mark`.

**The desktop:**

| key | value |
|---|---|
| `desktop` | table `{ width, height }` |
| `seats` | array of `{ id, name, colour, at, key, you }`: `at` table `{ x, y }` or null, `key` a `window-id` or null, `you` a boolean |
| `dock` | array of `{ id, name, running, active, attention, ref }`, the three marks booleans |
| `menu` | null, or table `{ name, entries }`, `entries` an array of `{ id, name, ref, rect }` |
| `windows` | array of a window's table, in the order of its lines |
| `panels` | array of a panel window's table, in the order of its lines |
| `mark` | an integer |

A window's table is `{ kind, id, title, mod, frame, key, minimized, zoomed, tile }`: `kind` `window`, `id` its `window-id`, `frame` table `{ x, y, width, height }`, `key` a seat's id or null, `minimized` and `zoomed` booleans, `tile` a tile's name or null. A panel window's is `{ kind, id, title, mod, edge, frame, key }`, `kind` `panel`, `edge` `top` where it stands at that edge. A `rect` is a table `{ x, y, width, height }` on the desktop.

**A window:** `{ window, parts, documents, mark }`: `window` its table; `parts` an array of `{ role, name, states, ref }`, `name` written where the part has one; `documents` an array of `{ document, part, name, width, height, lines }`, `document` its number, `name` written for a `child`, and `lines` an array of an element's table.

An element's table is `{ depth, role, name, length, states, items, inView, below, ref }`: `depth` an integer, 0 for a line right under its document; `states` an array of strings, each as the text writes it; and each of `name`, `length`, the whole length of a name that was cut, `items`, `inView` and `below` written where the text writes it. A line of `text` has no `states` and no `ref`.

**A node:** `{ node, rect, size, scroll, lines, more, selection, caret, selected, mark }`: `node` an element's table, its `depth` 0; `rect` where it is on the desktop, or, for an element of a `web` document, `size`, table `{ width, height }`, in its place; `scroll` table `{ top, height, left, width }`, written where it scrolls; `lines` an array of an element's table, `depth` 1 for a line right under the node; `more` an integer, written where lines were left out; `selection` table `{ start, end }` or `{ line, column, length }`, written where the text writes one; and, while the field has its document's focus and is in no `web` document, `caret`, the rect its caret is drawn at, and `selected`, an array of the rects what is selected is drawn at, one a line of text. A part the shell draws answers `{ node, rect, mark }`, `node` its table as a window's `parts` holds one, with no `depth`.

`changes` and `picture` have one form each and take no `format`.

## Interactions

- `seat/read`, the table of outputs, watching, `seat/output` and the refusal of `params`: [users and seats](../DECKIT-38/SPEC.md). The shell is the layer that serves a reading.
- Each seat's order, key window, minimized windows and marks, the holder of a window, a seat's colour, and the event that points at a `ref`: [seats at the desktop](../DECKIT-39/SPEC.md).
- A window's id, frame, title, title bar and its buttons, tiles, panel windows and their edges: [windows](../DECKIT-31/SPEC.md). The Dock's items, their order and marks, and its menu: [the Dock](../DECKIT-33/SPEC.md). The key window and the active mod: [activation](../DECKIT-32/SPEC.md).
- A region and the page laid into it: [regions and drops](../DECKIT-36/SPEC.md). A web page: [web pages](../DECKIT-25/SPEC.md).

## Alternatives considered

- **The data form alone, the text left to each party.** A party that reads is most often one that reads text, and two that render the same data differently share no words for what they saw. The text is the contract, and the data says the same.
- **A tree of every element.** A document holds many elements that mean nothing to who uses it. A reading lists what has a role, as a person meets a page, and counts what it leaves out on the line that holds it.
- **Refs by a path or a selector.** A path changes as a page redraws around an element that did not change. A number given once stands while the element does.
- **A stream of every change.** A seat would be sent what it never reads. A seat is told the mark alone and asks for what changed when it wants it.
- **A mark for each seat.** One count lets two seats speak of the same moment; what changed since it is still answered for the seat that asks.

## Notes

**Note.** What this costs an implementation: it keeps for each seat the lines of its desktop and the mark each last changed at, and what went with the mark it went at; numbers each document and each element it lists and keeps the numbers while they stand; hears each document tell that it changed; and reads a document by its elements' roles, names and states, not by how it is drawn.

**Note.** No case holds these, each for its reason. A picture's bytes: a case holds a value whole and no two machines draw the same pixels, so the cases hold a picture's width and its refusals. The lines of the Dock's menu, and a choice of it as a node: a case holds a text whole, and the words of the menu are fixed by no DECKIT, as [the Dock](../DECKIT-33/SPEC.md) leaves them; its refs are held by the cases of [seats at the desktop](../DECKIT-39/SPEC.md) that press them. The mark at 0: a party reads only once it sits, and a seat that opens raised the mark. A `scale` or a member of `rect` that holds a fraction or is no finite number, and a fraction where a key takes an integer: a case writes no number but an integer. `caret` and `selected`, and a selection after a press in a field that holds text: where text is drawn is each machine's fonts. A `web` document, an element of one read as a node with its size alone, and `REFUSED` for a picture of such an element: the base `shell` of [the case format](../DECKIT-1/SPEC.md) shows no web page inside a window's content. `- document <n>`: no page a case lays in a window loads another document while it is shown, as a window's content and a child are each their mod's own page, which loads none while the mod runs. Every element and attribute a row of the tables of roles and states names: a row reads each of them by one rule, so a case holds one of a row for the row. What a seat that watches `changes` is told: a case holds what a party was told whole, one input of a case may raise the mark more than once, and whether two raises close together are told once or twice is the moment's, so the same case would be told one message on one run and two on the next.

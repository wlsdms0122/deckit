# DECKIT-42: Status Bar

Status: draft
Area: mods

## Summary

The **status bar** is the mod of the id `status-bar` an implementation ships: a panel window in the bar across the top of the host app's window, the **capsule**, that holds one item for each mod that gives one. It owns the interface `status-bar/items` and provides its major `2`. This DECKIT fixes what a mod declares of its item in its manifest, the exports `set` and `remove` a running mod gives and takes back its item through, what an item is and how a seat reads it, the two regions items stand in and their order, what a press on an item runs, how an item is kept in the fixed region and taken out of it, and the anchor the status bar tells for each item in view, which the item's own mod stands a view under. Where the capsule stands in the bar is the shell's, and which mods the app ships is the implementation's.

## Motivation

A clock written once for every host shows the time in the bar, and its calendar under its item as the item is pressed:

```toml
[interfaces]
uses = { "status-bar/items" = 2 }

[[contributes."status-bar/items"]]
name = "Clock"
command = "toggle"
```

```js
deckit.dependencies.onConnect("status-bar/items", (bar) => bar.set({ label: "3:04 PM" }));
const view = shell.windows.open({ name: "calendar", level: "panel", anchor: { mod: "status-bar", id: "clock" }, content, width: 320, height: 240 });
```

A mod sees none of the other mods' windows, so a row of items in one band is one mod's to draw, and each of these is something two implementations could answer differently without a rule:

- The clock sets a label of 300 characters. One implementation draws it across the bar, and another refuses it, so the clock cannot tell what it may set.
- A second mod gives an item after the clock. On one implementation it stands left of the clock and on another right of it, and after a restart the two trade places.
- The person keeps the clock where it never scrolls. One implementation forgets it as the app starts again.
- The clock's item is pressed. On one implementation the clock's command runs, launching it where it does not run, and on another nothing runs while the clock is not running.
- The clock opens its calendar under its item, and the item scrolls out of view. On one implementation the calendar stays where the item was, and on another it is shown nowhere until the item is back.
- Another mod opens a view under the clock's item and covers it.

## Rules

### The contribution

A mod declares its item in its manifest, as an entry of `contributes."status-bar/items"`, as [the interfaces](../DECKIT-10/SPEC.md) fix what is declared to an interface. An entry is a table:

| key | takes | required | what it is |
|---|---|---|---|
| `name` | string of 1 to 64 characters, not white space alone | yes | what the item is called |
| `icon` | string of 1 to 64 of the letters `A` to `Z` and `a` to `z`, the digits, `_` and `-` | no | the name of a glyph of the kit, as [the look](../DECKIT-35/SPEC.md) fixes the kit; left out, the item shows none |
| `command` | string, as `icon` | no | the id of a command of the mod's, as [the commands](../DECKIT-15/SPEC.md) fix one, that a press on the item runs; left out, a press runs none |

An entry with a key the table does not give, or with a value that does not fit it, is left out, and so is each entry of a mod after its first. A mod has one item at most.

An item a mod declares stands from the time the status bar first reads what is declared, and while the mod's bundle is taken, whether its mod runs or not. The status bar reads again what is declared as the catalog changes what mods it takes.

### The exports

The status bar opens its exports for `status-bar/items` in its start, for every client, and its exports hold these members on every connection, each a function a call of which is a request, as [calls across a connection](../DECKIT-11/SPEC.md) fix one:

| member | takes | answers |
|---|---|---|
| `set(item)` | `item`, a table, required | nothing, once the item of the client's mod is as `item` gives it |
| `remove()` | nothing | nothing, once what the client's mod set is taken back |

`item` is a table of these keys. A mod that declared an item gives `label`, `count` and `tone` alone, and the rest stays as it declared it; a mod that declared none gives `name`, `icon` and `command` too, and its item stands from its first `set`:

| key | takes | required | what it is |
|---|---|---|---|
| `name`, `icon`, `command` | as in the contribution | `name` yes | as in the contribution |
| `label` | string of 24 characters at most | no | text the item shows; left out, the empty string, none |
| `count` | integer, 0 or more | no | a number the item shows; left out, none |
| `tone` | `"plain"` or `"attention"` | no | whether the item asks for attention; left out, `"plain"` |

Each `set` gives the whole item from then on: what it leaves out is none, and `plain`. A `set` is refused at `call` with kind `INVALID_ARGUMENT`, and changes nothing, where `item` is no table, holds a key the client's mod may not give, holds a value that does not fit, or names an `icon` the kit draws no glyph of.

`remove()` takes back what the mod set: an item that stood from a `set` goes, and a declared one stands as it was declared. What a mod set is taken back the same way as its connection ends, as [the connections](../DECKIT-9/SPEC.md) fix the end of one, and as the mod comes to declare an item where it declared none, or none where it declared one.

### An item

An item is what stands of a mod's: its `name`, `icon`, `command`, `label`, `count` and `tone`, as declared and as set. It is **laid** where it shows something, a glyph, a label or a count; one that shows none of them is not laid, and stands still in its order.

An item is laid 24 high, holding its glyph, 16 wide, then its label, as wide as it is drawn and 160 at most, then its count, as wide as its text is drawn, each that it shows, 4 apart, with 8 on each side. A count's **text** is its number, and `99+` above 99.

A seat reads the capsule's content as [what a seat reads](../DECKIT-40/SPEC.md) reads a document: a `toolbar` named `Status Bar`, holding a `button` for each item laid and in view, named by the item's name, its label, its count's text and `attention` where that is its tone, each that it has, joined by a comma and a space, and `disabled` where the item has no command. The buttons are read in the order they stand, left to right: the region that scrolls, and then the fixed region.

### The two regions and their order

The capsule holds the items laid in two regions, the **fixed region** at its right end and the region that **scrolls** left of it. The capsule is 28 high, its items 2 inside its ends and its top, 4 apart, and the two regions 4 apart where both hold an item; it is as wide as what it holds, no wider than its room in the bar, as [windows](../DECKIT-31/SPEC.md) fix a panel window's room, and no narrower than its fixed region. The capsule closes while it lays no item, and opens again as it lays one.

The **fixed** items are those whose mod's id is in the status bar's fixed list, in that list's order, the first rightmost. Until the list is first changed, as *Keeping an item* says, it is `["clock", "notifications"]`. An id in the list whose mod gives no item keeps its place, and the item stands there as its mod gives it.

Every other item stands in the region that scrolls, in the order items **came**, the first rightmost and the newest leftmost: a declared item comes as the status bar first reads it, in the order [the interfaces](../DECKIT-10/SPEC.md) answer what is declared, and one that stands from a `set` comes as it is first set. The status bar keeps that order in its storage, as [the storage](../DECKIT-13/SPEC.md) fixes a mod's, so an item that goes and comes back, within a run or as the host app starts again, takes its old place, and one that never stood comes at the newest end.

Where the room holds less than every item, the fixed region stays whole and the items that scroll are laid in what is left: a turn of the wheel over them scrolls them sideways, by its sideways part, or by its vertical one where that is the larger; and an item that comes into that region is scrolled into view whole. An item scrolled out of what is left is not **in view**; one partly out is in view by the part of it that is.

### A press

A press on an item, the main button pressed down and let go on it, runs its `command` on its mod, as `run` of [the commands](../DECKIT-15/SPEC.md) runs one for a client granted `deckit.system-services`, with no arguments, which launches the mod where it does not run. The status bar opens and closes nothing of the item's mod. An item with no command takes no press: a press on it runs nothing and reaches the capsule.

### Keeping an item

A press of the second button on an item in view opens a menu of one entry under the capsule, as the kit opens one. Choosing the entry **keeps** the item where its mod's id is not in the fixed list: the id comes last in the list, and the item stands leftmost in the fixed region. Where the id is in the list, choosing it takes the id out, and the item stands in the region that scrolls again, where it came among the others. The other ids keep their order. The status bar keeps the list in its storage from the first time it changes, whole, so it stands as the host app starts again.

A press of the second button on the capsule where no item is in view opens nothing.

### The anchor of an item

The status bar tells, of its capsule, an anchor for each item in view, as [views](../DECKIT-41/SPEC.md) fix an anchor: of the `id` and the `mod` both the item's mod's id, at the part of the item in view. Its name is `{ mod: "status-bar", id }`. An item not laid, and one not in view, has no anchor.

The item's mod stands a view under its item by opening one under that name, as [views](../DECKIT-41/SPEC.md) fix a view under an anchor: it stands while the item is in view, moves as the item does, and stands nowhere while the item has no anchor. Another mod that opens a view under it is refused as [views](../DECKIT-41/SPEC.md) refuse one.

## Interactions

- A mod's id, its manifest and `contributes`: [the bundle](../DECKIT-2/SPEC.md). The mods' order: [the catalog](../DECKIT-4/SPEC.md).
- The interface, its owner and what is declared to it: [the interfaces](../DECKIT-10/SPEC.md). A connection's end: [the connections](../DECKIT-9/SPEC.md). A call of a member of the exports and a refusal: [calls across a connection](../DECKIT-11/SPEC.md).
- Where the status bar keeps its order and its fixed list: [the storage](../DECKIT-13/SPEC.md).
- A command of a mod's, and `run`, which launches its mod: [the commands](../DECKIT-15/SPEC.md).
- A panel window in the bar, its room, `setAnchors`, and where the shell stands the capsule: [windows](../DECKIT-31/SPEC.md). The kit and its glyphs: [the look](../DECKIT-35/SPEC.md).
- A seat's press, of either button: [seats at the desktop](../DECKIT-39/SPEC.md). What a seat reads, and refs: [what a seat reads](../DECKIT-40/SPEC.md).
- An anchor, and a view under one: [views](../DECKIT-41/SPEC.md).
- A host that ships the status bar by its id: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- A mod drawing its own panel window in the bar for its item. Each mod sees none of the others' panel windows, so a row of them is laid by the shell's order alone, and none of them can be kept apart from the others or scrolled; one mod laying every item gives them one row and one order.
- An item that is a view the mod draws. The status bar would hold a page of each mod's in its own, and an item's look and its reading would be each mod's; a mod gives what its item holds, and the status bar draws it.
- An item without a command opening a view of the status bar's. The status bar would know what each mod shows; it runs the item's command, and what stands under the item is its mod's view, under the anchor it is told.
- An anchor for an item scrolled out of view, at its rect past the region's end. A view would stand under a place that shows nothing.
- Several items a mod. A mod's id names its item, its anchor and its place in both lists; one item a mod keeps each of them one name.
- The fixed list named by each mod in its manifest. What stays in view is the person's to choose; a declared item stands in the order it came until the person keeps it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. A label laid, and how wide a label or a count is laid: how wide a text is drawn is each machine's fonts, so the cases set a label only where they read no capsule, and read a capsule that lays a count by a seat's reading, with a stand-in, as [the case format](../DECKIT-1/SPEC.md) gives one, for where it stands and how wide it is. A turn of the wheel, the room, an item scrolled into view or out of it, and the anchor of an item partly in view: what is in view of a room is the machine's widths too, where a label or a count is laid, and the base `shell` of [the case format](../DECKIT-1/SPEC.md) holds no turn of the wheel. The order and the fixed list as the host app starts again, and the reading again of what is declared as the catalog changes: a case's host ships a mod by its id with nothing kept of an earlier run. What a mod set taken back as its connection ends, and as the mod comes to declare an item where it declared none or none where it declared one: the cases take an item back by `remove()` alone, and change no manifest while the host app is started. That a press on an item with no command reaches the capsule: no look reads what a press on the capsule comes to. A glyph's name: which glyphs the kit has is the implementation's, as [the look](../DECKIT-35/SPEC.md) leaves it, so a case that names one holds only against a kit that has it, and the cases name `bell` and `users`. The words of the menu's entry: what the menu shows is the kit's, and no DECKIT fixes its words, as [the Dock](../DECKIT-33/SPEC.md) leaves those of its own menu.

**Note.** What this costs an implementation: it reads what is declared to the interface again as mods come and go, keeps two lists of mods' ids in its own storage and writes them as they change, lays every item again as one is set and as its room changes, and tells the shell the anchors anew as items move.

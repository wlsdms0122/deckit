# Status Bar

A capsule at the top right of the app, in the bar across the top of its window, that holds in a row the items other mods give it: the clock, whose press opens the notification center. A row longer than the bar has room for scrolls sideways, but for the fixed items at its right end. It runs in the background from the start, and is the app's own chrome, not an app: it has no Dock item and is not listed among the apps.

## Giving it an item: `status-bar/items`

Status Bar defines the interface `status-bar/items`, and provides its major 2. A mod has one item, named by the mod's id. The bar draws it: the mod gives what it holds, never a view.

An item that is always there is declared in the manifest. It stands from the start, whether its mod runs or not. Declaring an item does not fix it: what is fixed is the person's to name.

```toml
[interfaces]
uses = { "status-bar/items" = 2 }

[[contributes."status-bar/items"]]
name = "Seats"
icon = "users"
command = "show"
```

| Field | What it is |
|---|---|
| `name` | what the item is called, text of 1 to 64 characters |
| `icon` | a glyph's name of the kit (UI.md). Left out, none |
| `command` | the id of a command the mod declares to `deckit/commands`, run as the item is pressed. Left out, a press does nothing |

An entry of another shape, and a second entry of one mod, is left out and logged.

While it runs, a mod sets what changes of its item on the exports the bar opens in `start`, so from any lifecycle of its own, on screen or not:

```js
deckit.dependencies.onConnect('status-bar/items', (bar) => {
    bar.set({ label: '3:04 PM', count: 2, tone: 'attention' });
});
```

| Export | What it is |
|---|---|
| `set(item)` | the mod's item as it is from now on. A mod that declared one gives `{ label, count, tone }`; a mod that declared none gives `{ name, icon, command, label, count, tone }`, and its item comes as it is first set. `label` is text of 24 characters at most, `count` a whole number from 0 on or null, `tone` `plain` or `attention`; what is left out is none, and `plain`. Another shape, or a glyph the kit does not have, rejects with kind `INVALID_ARGUMENT` |
| `remove()` | takes back what the mod set: an item that came goes, and a declared one stands as declared |

What a mod set goes as its connection ends.

## How items stand

The capsule has two regions. The fixed region, at its right end, holds the fixed items and never scrolls. What is fixed is a list of mod ids the bar keeps (its record `fixed`), in that list's order, the first rightmost; where it keeps none, the clock and the notifications item are. Every other item stands left of the fixed region in the order it came, the first rightmost and the newest leftmost: a declared item comes as the bar first reads it, in the mods' order, and one that comes and goes as it is first set.

The person names what is fixed. A context press on an item opens a menu of one entry under the capsule: Keep in Bar on an item that is not fixed, Don't Keep in Bar on one that is. Keep in Bar puts the item's mod id last in the list, so the item stands leftmost in the fixed region; Don't Keep in Bar takes it out of the list, and the item scrolls with the others again, where it came among them. The list is kept whole from the first time it changes. An id in the list whose mod gives no item keeps its place and shows nothing, and the item stands there again as its mod gives it.

An item is 24px tall: a 16px glyph, the label as wide as it draws, 160px at most, and the count, written `99+` beyond 99, 4px apart with 8px on each side. An item that holds no glyph, no label and no count is not laid.

The capsule is as wide as its items, up to the room the shell tells it has in the bar (`room`, MOD.md). In a room that does not hold them all the fixed region stays whole and the others scroll sideways in what is left: a turn of the wheel over them scrolls them, by its sideways part or by the vertical one where that is the larger, an item that comes is scrolled into view, and what goes on past an end of the region fades there.

Each item is a button named by its `name`, its count and `attention` where that is its tone.

## A press, and the view under an item

A press on an item runs its `command` on its mod through `deckit/commands`, which launches the mod if it does not run. The bar opens and closes nothing. What stands under an item is a view of the item's own mod: the bar tells the shell the rect of each item in view, the part of it in view, as an anchor named by the mod's id and given to that mod (`setAnchors`, MOD.md), and the mod binds a panel window to it, which its command toggles. An item scrolled out of view has no anchor, and a view bound to it is not shown until it is in view again:

```js
const view = shell.windows.open({
    name: 'view',
    level: 'panel',
    anchor: { mod: 'status-bar', id: '<the mod id>' },
    content,
    width: 320,
    height: 200,
});
// in the command the press runs
view.toggle();
```

## The capsule

A panel window (`level: 'panel'`, MOD.md), 28px tall and as wide as its row up to its room, the items and the two regions 4px apart, 2px in from its round ends. The shell stands it in the bar at the top right, on the panel material. It closes while it lays no item.

## Permissions

| Permission | Why |
|---|---|
| `deckit.panel-windows` | stands in the bar across the top of the app's window, holding what other mods show there |
| `deckit.system-services` | runs the command of an item you press, which launches its mod if it does not run |

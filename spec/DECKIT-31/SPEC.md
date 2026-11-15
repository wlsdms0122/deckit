# DECKIT-31: Windows

Status: draft
Area: shell

## Summary

A mod shows what it draws in windows: `windows.open(options)` opens one and answers its handle, and `windows.list()` answers those open, members of [the handle `shell`](../DECKIT-29/SPEC.md). This DECKIT fixes the two members and the window handle with its callbacks; the three levels a window is at, `normal`, on the desktop among every mod's windows, `overlay`, floating over every app, which `system.overlay-windows` guards, and `panel`, standing in the bar across the top of the host app's window, which `deckit.panel-windows` guards, and the permissions the shell defines for them; one window of a name in a run; where a normal window opens, where a panel window stands and the material under it, the frame it is left at, kept by its mod, its name and its level, and what removing a mod with what it stored does to it; the order of the windows, the key window and its callbacks' order; what the person's hand does on a window; a normal window's title bar, its style, its buttons and the safe area a window's content is told; the window a web page apart is shown in; and the windows as the run ends. Which mod may activate, and so whether a window becomes key as it opens, is [activation](../DECKIT-32/SPEC.md)'s.

## Motivation

A mod shows its notes in a window, which the person moves, resizes and closes:

```js
attach(shell) {
    this.window = shell.windows.open({ name: "main", content: this.view(), didBecomeKey: () => this.focus() });
}
```

A window is shown to the person, which is the shell's: a host with no shell has no desktop to lay one on, and a mod sees none of the windows of the other mods its window stands among. Each of these is something two implementations could answer differently without a rule:

- The person drags `main` and quits the app. At the next start one implementation opens `main` where it was left, and another centred.
- The mod's code opens `main` twice. One implementation shows two windows, and another answers the first.
- `shell.windows.open({ name: "main", content, width: 0 })` opens a window 0 wide on one implementation, 720 wide on another, and throws on a third.
- The key window closes. One implementation makes the front window key, and another leaves no window key; and the next window is told `didBecomeKey` before the one closing is told `didResignKey` on one of them.
- A mod granted nothing opens a window at the level `overlay`, over every app, on one implementation, and is refused on another.
- Two mods each open a window at the level `panel`. One implementation stands them from the bar's right end in the order they opened, another stands them where each mod's code asks, the second over the first.
- A mod calls `makeKeyAndOrderFront()` of its window at the level `panel`. One implementation gives it the keyboard, and another leaves the keyboard with the window the person works in.

## Rules

### A window

A **window** is a place on screen in which a mod's run shows an element, its **content**. It has a **name**, a string that is not empty, and a **level**:

| level | where the window is | guarded by |
|---|---|---|
| `normal` | on the **desktop**, the part of the host app's window where the shell lays the normal windows of every mod | none |
| `overlay` | in a window of its own the host app floats over every app | `system.overlay-windows` |
| `panel` | in the **bar**, a band across the top of the host app's window, as high as the host app says, above the desktop, where the shell places it as *Panel windows* says: its **edge** is `top`, the one edge a panel window stands at | `deckit.panel-windows` |

The desktop is the part of the host app's window under the bar, the whole of it where the host app's window has no bar, the bar then 0 high.

A run has one window of a name open at a time, whatever its level, and the name is free again once that window has closed. The windows are the run's: a window opened through the handle `shell` of one lifecycle of the run is the one the handle of another lifecycle of the run opens and lists.

A normal window has a **frame**, `{ x, y, width, height }`, in the coordinates of the screen the desktop is on, `x` to the right and `y` down: its top left, and its **size**, `width` by `height`. Each value of a frame is a whole number, a value a window is opened or set at rounded to the nearest one. A normal window has a **minimum size**, the `minWidth` and `minHeight` its mod gives, and never smaller than its title bar's buttons with 42 past the title bar area's start by its title bar's height, as *The title bar* fixes them: 120 by 48 where `options` give neither; no frame of the window is smaller than it. The **zoom area** is the desktop but a band 6 wide along its left edge, where the Dock comes out, as [the Dock](../DECKIT-33/SPEC.md) fixes it.

A frame is **reachable** where its top is on the desktop and at least 64 of its width and its title bar's height of its height are on it: `x` from the desktop's left plus 64 minus `width` to the desktop's right minus 64, and `y` from the desktop's top to its bottom minus that height, 48 by default. A frame **brought into reach** is moved the least way it takes to be reachable. No frame of a normal window lies over the bar, as a drag goes too: its top is never above the desktop's.

### The order and the key window

The normal windows on screen stand in an **order**, back to front, and at most one of them is the **key window**, the one whose content the keyboard goes to while no overlay window holds it, as [activation](../DECKIT-32/SPEC.md) fixes which window is key. A window comes **in front** at the front of the order. A **minimized** window is off screen and not key.

Whether a mod **may activate**, its window coming in front as the key window, is fixed by [activation](../DECKIT-32/SPEC.md); a press of the person on one of a mod's windows lets it. Where a window is to come in front and its mod may not activate, it comes right behind the key window, not key, or in front where no window is key.

Where a window becomes key, the window that was key is told `didResignKey` before the other is told anything. Where the key window closes or is minimized, the front window on screen becomes key, after the window going is told all it is told.

### windows.open(options)

`windows.open(options)` answers at once, as [the shell](../DECKIT-29/SPEC.md) fixes a member that does, the handle of a window of the run:

| key of `options` | takes | required | what it says |
|---|---|---|---|
| `name` | string, not empty | yes | the window's name |
| `content` | element | yes | what the window shows |
| `level` | `"normal"`, `"overlay"` or `"panel"` | no | the window's level; `"normal"` where it is left out |
| `edge` | `"top"` | no | a panel window's edge; `"top"` where it is left out, and not read at another level |
| `width`, `height` | number above 0 | no | the window's size; 720 by 480 where each is left out |
| `minWidth`, `minHeight` | number above 0 | no | the window's minimum size |
| `activates` | boolean | no | whether the window comes in front as the key window; `true` where it is left out |
| `titleBar` | `"unified"` or `"titled"` | no | a normal window's title bar style, under *The title bar*; `"unified"` where it is left out |
| `titleBarHeight` | number 48 or more | no | a normal window's title bar height; 48 where it is left out |
| `controlsOrigin` | table of `x` and `y`, each a number 0 or more, either left out | no | where a normal window's buttons stand from its frame's top left; each left out where *The title bar* says |
| `closable`, `minimizable`, `resizable` | boolean | no | whether a normal window's button `close`, `minimize` or `zoom` is enabled, and whether the person drags its edges where `resizable`; each `true` where it is left out |
| `title` | string | no | the window's title; `""` where it is left out |
| `didAppear`, `didDisappear`, `didBecomeKey`, `didResignKey`, `didResize`, `didClose` | function | no | the callbacks under *Callbacks* |

It throws, and opens nothing, at `call`: with kind `NOT_PERMITTED` where `level` is `"overlay"` and the mod is not granted `system.overlay-windows`, or `"panel"` and the mod is not granted `deckit.panel-windows`; then with kind `INVALID_ARGUMENT` where `options` is no table or a key it holds does not fit the table; then as [the shell](../DECKIT-29/SPEC.md) refuses a member of a cut handle, with kind `ENDED`. A key of `options` the table does not give is not read, as [the handle](../DECKIT-7/SPEC.md) reads a table.

Where a window of `name` is open in the run, it answers that window's handle, which it brings in front as `makeKeyAndOrderFront()` does, or as `orderFront()` does where `activates` is `false`; it reads nothing else of `options`. Otherwise it opens a window at `level`. A normal window opens at the frame under *Where a window opens* and comes in front as `makeKeyAndOrderFront()` brings a window, or as `orderFront()` does where `activates` is `false`. An overlay window opens as *Overlay windows* says, and a panel window as *Panel windows* says, `activates` not read.

### windows.list()

`windows.list()` answers at once an array of the handle of each window of the run open, in the order they opened. It takes no argument, and one handed is not read. Through a cut handle it throws as [the shell](../DECKIT-29/SPEC.md) refuses a member of one, with kind `ENDED`.

### The window handle

A window's handle holds these members:

| member | shape | what it is |
|---|---|---|
| `name` | value | the window's name |
| `isKey` | value | whether the window is key, as it was last told: `true` from the time it is told `didBecomeKey`, and `false` from the time it is told `didResignKey` or has closed |
| `title` | value | the window's title, as it was last set |
| `setTitle(title)` | answers nothing | sets the window's title, a string, the bar of a titled window holding it |
| `close()` | answers nothing | closes the window |
| `minimize()` | answers nothing | minimizes a normal window |
| `zoom()` | answers nothing | sets a normal window's frame to the zoom area, the window then **zoomed**; of a zoomed window, sets its frame back to the one it had before |
| `orderFront()` | answers nothing | brings the window in front, the key window left key, and a minimized one back on screen |
| `makeKeyAndOrderFront()` | answers nothing | brings the window in front as the key window, and a minimized one back on screen |
| `resize(width, height)` | answers nothing | sets the window's size, each a number above 0, no smaller than its minimum, its top left where it was |

`resize` throws at `call` with kind `INVALID_ARGUMENT` where `width` or `height` is not a number above 0, and `setTitle` where `title` is not a string. Each member that answers nothing throws, once the lifecycle whose handle opened the window has ended, at `call` with kind `ENDED`, after `INVALID_ARGUMENT`. Once the window has closed, each member that answers nothing does nothing and is refused as before.

`minimize()` and `zoom()` do nothing to an overlay window or a panel window, and neither `orderFront()` nor `makeKeyAndOrderFront()` does anything to a panel window, which stands where the shell places it and is never key. A frame set, by `resize` or by the person, ends a zoom: the window is zoomed no more. The flags `closable`, `minimizable` and `resizable` hold back the person's hand alone: each member acts as it does on any window.

### Callbacks

A window calls the callback its mod gave under each name as it is told:

| callback | told as the window |
|---|---|
| `didAppear` | comes on screen: as it opens, and as it is brought back from minimized |
| `didDisappear` | goes off screen: as it is minimized or closed, and as the run ends |
| `didBecomeKey` | becomes key |
| `didResignKey` | is key no more |
| `didResize` | changes size |
| `didClose` | has closed, by `close()` or by the person |

A window is told `didAppear` before `didBecomeKey`, `didResignKey` before `didDisappear`, and `didDisappear` before `didClose`.

### Where a window opens

A normal window opens at its size, no smaller than its minimum, at the first of these places that applies, brought into reach:

1. Where a frame is kept for a window of its mod, its name and its level, under *Frames kept*: at that frame.
2. Where a window is on screen: with its top left 24 right of and 24 down from the key window's, or, where no window is key, from the front window's on screen; and where its frame would then pass the zoom area's right or bottom edge, 24 right of and 24 down from the zoom area's top left.
3. Centred across the zoom area, a third of the height the window leaves in it above it: `x` is the zoom area's `x` plus half of what its width leaves of the zoom area's, and `y` the zoom area's `y` plus a third of what its height leaves, each 0 where the window leaves nothing.

### The person's hand

The person's input on a normal window on screen:

| input | what it does |
|---|---|
| a press in the window | brings it in front as the key window, its mod one that may activate |
| a click of the title bar's button `close`, `minimize` or `zoom` | what `close()`, `minimize()` or `zoom()` does, where the button is enabled; nothing where it is not |
| a drag of the title bar by `dx`, `dy` | moves the frame by `dx`, `dy`, its sides meeting edges as *Edges met* says, brought into reach as it is let go; let go at a side of the zoom area, the window takes the tile there, as *Tiles* says |
| a drag of an edge or a corner by `dx`, `dy`: `top`, `bottom`, `left` or `right`, or `top-left`, `top-right`, `bottom-left` or `bottom-right`, the two sides it joins | of a window that is resizable, moves each side it names by the drag, no further than leaves the window its minimum size, the side opposite where it was, the sides it moves meeting edges as *Edges met* says, the frame brought into reach as it is let go |
| a double click on the title bar | what the person set a double click on a title bar to do: zoom the window, minimize it, or nothing; what a click of the button for it does |

A normal window drawn scaled, as it opens, closes, or goes into the Dock and comes back, takes none of the person's input until it rests at its frame. A window whose size changes by the person's hand is told `didResize`. On an overlay window, a press gives it the keyboard, and a drag moves it as the host app moves the window it floats. On a panel window, a press reaches its mod as the person's input, as [activation](../DECKIT-32/SPEC.md) fixes it, and leaves the keyboard where it is, as *Panel windows* says; a press on a child's view its regions show, as [regions and drops](../DECKIT-36/SPEC.md) fix them, reaches the child's mod the same way, and leaves the keyboard where it is; no other input does anything.

### Tiles

The **tiles** of the zoom area split it flush, with no room between them: `left` and `right`, its halves, `left` as wide as half the zoom area's width rounded to the nearest whole number and `right` as wide as what that leaves, each as high as the zoom area; `top-left`, `top-right`, `bottom-left` and `bottom-right`, its quarters, each as wide as the half it is in, the top ones as high as half the zoom area's height rounded and the bottom ones as high as what that leaves; and `fill`, the zoom area itself. A window that is resizable **takes** a tile: its frame is the tile, no smaller than its minimum size, and the window is **tiled** there, which is not zoomed. It takes one:

1. Where a drag of its title bar is let go with the pointer 8 or less from the zoom area's left or right side, or past it: the half at that side, or the quarter at that side's top or bottom where the pointer is also 64 or less from the zoom area's top or bottom, or past it. With the pointer elsewhere 8 or less from the zoom area's top, or above it: `fill`. While the drag goes with the pointer there, the shell shows the tile it takes.
2. Where one of the shell's keys that tile runs, as [the keys](../DECKIT-34/SPEC.md) fix them: the desktop's key window.

A tiled window keeps the frame it had as it took its first tile, its **frame before**, while it takes others. `zoom()` of a tiled window zooms it to the zoom area; zoomed again, it is back at its tile, tiled still. As the desktop changes size, a tiled window takes its tile again in the zoom area. It is no longer tiled:

1. As a drag of its title bar starts to move it: its frame is its frame before, as wide and high, placed with its top where the tile's was and with the pointer as far across its title bar, of its width, as it pressed across the tile's, rounded to the nearest whole number; the drag goes on from there.
2. As the shell key `restoreWindow` runs on it: its frame is its frame before.
3. As its frame is set any other way: a drag of an edge, or `resize`.

### Edges met

As the person moves a window by a drag of its title bar, or resizes it by a drag of an edge or a corner, a side of its frame the drag moves that comes 8 or less from an edge it can **meet**, from either side, lands on the nearest one: a side of the zoom area, or a side of another window on screen beside it, one whose extent across that side's way overlaps the frame's or is 8 or less from it, the side that faces the frame's or the side alike. A move moves the whole frame by the least way that lands a side, across and down each on its own; a resize moves the side alone, where the window keeps its minimum size. Past 8 from every edge it can meet, the frame follows the drag as it is.

### Frames kept

The frame a window is left at is **kept** by its mod, its name and its level, as the host app quits and starts: where the person lets go a drag of its title bar or of an edge, and where `resize` sets it; and, of an overlay window, where the host app tells the shell the person left it. Of a tiled window the frame kept is its frame before, and of a zoomed window the frame zoom left: a tile and the zoom area are the desktop's, not the window's own. A window with no name keeps no frame, and neither does a panel window, which the shell places.

The frames kept of a mod are what the shell keeps of it, as [the embedding](../DECKIT-22/SPEC.md) fixes what a layer keeps: erased as [the catalog](../DECKIT-4/SPEC.md)'s `remove` erases what the mod stored, with `erase` `true`, and kept with `erase` `false`.

### Overlay windows

The shell asks the host app to show an overlay window in a window of its own, floating over every app, handing it the window's size and the frame kept for it, if any; the host places it, and its frame is the one the host shows it at. It takes the keyboard as it opens, then key, where `activates` is `true` and its mod may activate. `resize` sets its size, its top left where it was. `close()` closes it, and the window the host floats with it.

### Panel windows

A panel window stands in the bar, in front of every normal window, at a frame the shell places it at, in the coordinates of the host app's window, `x` to the right and `y` down: its width the width it is opened or resized at, and its height the height it is opened or resized at, but no higher than the bar. The panel windows open stand right to left in the order they opened: the first with its right edge 8 in from the bar's right end, and each other with its right edge 8 left of the left edge of the one opened before it; each centred on the bar's height, `y` half of what its height leaves of the bar's, rounded.

A panel window that closes or changes size moves those opened after it.

A panel window is on screen as it opens, while the desktop is, and is never minimized or zoomed: it is told `didAppear` as it opens. It is never key, told neither `didBecomeKey` nor `didResignKey`: not as it opens, whatever `activates` says, not by `makeKeyAndOrderFront()`, and not as the person presses on it. The bar holds what the person presses on the way to the window they work in, which keeps the keyboard.

The shell draws no frame around a panel window: under it, its frame rounded by half its height, a capsule, it draws a **material**, through which what lies under it shows, blurred and tinted, and which is opaque where the person asks the machine for less transparency; the window's content is cut to that shape, and what the content presents over it, as a menu, is not.

### The title bar

A normal window has a **title bar** across the top of its frame, `titleBarHeight` high, and in it the **buttons** `close`, `minimize` and `zoom`, each 12 across and 8 apart, in that order from the left: a group 52 across. The group's top left stands at `controlsOrigin` from the frame's top left: where `x` is left out, 18 in from the frame's left, and where `y` is left out, centred on the bar's height, so that in a bar 48 high the buttons stand as far in from the frame's left as from its top. A `y` that would put the group's bottom below the bar's stands it at the bar's bottom, and no frame is narrower than the group with room past it, as *A window* says, so the buttons stay in the bar and in the window. Each is rounded to the nearest whole number. The **title bar area** is the bar from 8 past the group's right end: from 78 where `controlsOrigin` is left out. The shell draws the buttons and takes their presses.

The title bar has a **style**, `titleBar`. In `"unified"`, the content fills the frame under a transparent bar: the shell draws the buttons over the content, and the content's own toolbar, laid in the title bar area, is the bar. In `"titled"`, the shell draws the bar, the window's title centred in it, and lays the content in the frame below it. A window's **title** is `title`, until `setTitle` sets another.

A button is **enabled** as its flag says: `close` where the window is `closable`, `minimize` where it is `minimizable`, and `zoom` where it is `resizable`. A button that is not enabled is drawn disabled in its place, so the group keeps its shape, and the person's hand does nothing with it, as *The person's hand* says.

The options of the title bar are read as the window opens, and hold for its life; its title is the one thing of it that changes. Of an overlay window and a panel window they are not read.

The root element of the document the content is in is told the content's **safe area**, the frame less what the shell lays over it, in custom properties: the attribute `data-deckit-title-bar` where a title bar lies over the content; `--deckit-title-bar-area-height`, the bar's height, and `--deckit-title-bar-area-x`, where the title bar area starts; and `--deckit-safe-area-inset-top`, `--deckit-safe-area-inset-right`, `--deckit-safe-area-inset-bottom` and `--deckit-safe-area-inset-left`, how far in from each side of the frame the shell lays over it: the bar's height at the top, and `0px` at the other sides. Each is in px: those of a normal window opened with none of the title bar's options are `48px`, `78px`, `48px`, `0px`, `0px` and `0px`. The content of a normal window in the style `"titled"`, of an overlay window and of a panel window lies under no bar: the root element has no such attribute, and each of the properties is `0px`. The root element is told them before the content is told `didAppear`, and again each time its window is told what changed.

### A web page's window

A page apart, which `web.window(options)` answers as [web pages](../DECKIT-25/SPEC.md) fix it, is shown in a normal window of the mod whose page shows it, which has no name and is in no `windows.list()`. The window's title bar has the style `"titled"`, with the other options of the title bar as they are where they are left out: the shell draws the bar over the page, holding the page's title as web pages fix it, and the page fills the frame under it, 520 by 700, so the frame is 520 by 748. It opens as a window with no frame kept opens, and comes in front as `makeKeyAndOrderFront()` brings a window. It takes the person's hand as a normal window does, and closing it closes the page.

### The permissions

The shell defines these permissions, as [the permissions](../DECKIT-3/SPEC.md) define one, in this order:

| id | name | description | privileged |
|---|---|---|---|
| `system.overlay-windows` | `Overlay Windows` | `It can show a window of its own over every app's, on every desktop, whichever app is in front.` | `false` |
| `deckit.panel-windows` | `Panel Windows` | `It can show a window of its own along an edge of the app's window, in the bar across its top.` | `false` |

### The run's end

As the shell's lifecycle ends, as [the shell](../DECKIT-29/SPEC.md) fixes it, each window of the run that is key is told `didResignKey`, and each on screen `didDisappear`, before `detach()` is called; then each closes, and is told no `didClose`.

## Interactions

- The handle `shell`, a member that answers at once, a cut handle and its `ENDED`, and the shell's lifecycle and its end: [the shell](../DECKIT-29/SPEC.md).
- A member's refusal, `INVALID_ARGUMENT`, and a key of a table or an argument past those a member takes, which is not read: [the handle](../DECKIT-7/SPEC.md). `NOT_PERMITTED` and a permission a mod is granted: [the permissions](../DECKIT-3/SPEC.md).
- What a layer keeps of a mod, which `mods.usage(id)` names under `kept`: [the embedding](../DECKIT-22/SPEC.md); `remove` and `erase`: [the catalog](../DECKIT-4/SPEC.md).
- A page apart, `web.window`, its title and its delegate told it closed: [web pages](../DECKIT-25/SPEC.md).
- Which window is key while an overlay window holds the keyboard, which mod may activate, and the attention a mod held back asks for: [activation](../DECKIT-32/SPEC.md). The shell's keys that close and minimize the key window: [the shell's keys](../DECKIT-34/SPEC.md). The Dock and its edge: [the Dock](../DECKIT-33/SPEC.md).
- The base `shell`, its desktop, the bar over it and the overlay windows it floats, the input `window` and the look `windows`: [the case format](../DECKIT-1/SPEC.md). A region in a panel window: [regions and drops](../DECKIT-36/SPEC.md).

## Alternatives considered

- A frame a mod sets, its place among the rest. A mod sees none of the other mods' windows, so it would place its own over them; the size is the mod's, which knows its content, and the place the person's and the shell's, kept where the person left it.
- Windows told apart by their handle alone, several of a name. The name is what a frame is kept by across runs, and what lets a lifecycle reach the window another lifecycle of the run opened.
- One frame kept for a name at any level. An overlay window's frame is where the host floats it over every app and a normal one's on the desktop; one kept for both would open one where the other was left.
- A member of a closed window's handle refused. The person closes a window whatever the mod's code holds of it, so every call would have to guard against the person.
- `minimize()` and `zoom()` of an overlay window refused. It is a window like the rest, which has neither, as one with no title bar has neither button.
- A panel window placed by its mod, at a point of the bar. A mod sees none of the other mods' panel windows, so two would stand over each other; the size is the mod's, which knows its content, and the place the shell's, as of a normal window as it opens.
- A panel window that becomes key as the person presses it. A press in the bar is most often on a control that opens something, and the window the person works in keeps the keyboard; the mod still has the press as the person's input, so what it opens comes up as the key window.
- The level named for what a mod shows in it, a status bar. The level serves any mod that stands a window in a band along the edge of the screen, and `panel` is the name such a window goes by.
- The buttons placed by the shell alone, the mod choosing one of a few arrangements. A window system lets an app set its window's style, its title bar and where its buttons stand; the shell still draws the buttons, takes their presses and keeps them in the bar and in the window, and tells the content the safe area that follows, so a mod that moves them lays out against the outcome as any other does.
- A button that is not enabled left out of the group. The group would change shape, and the person would look for a button where it no longer is.
- The flags holding back the handle's members too. A window the person cannot close still closes when its mod is done with it, as a window that cannot be resized still takes the size its mod gives.
- A title bar's options that change during a window's life. A content lays out against its safe area as it opens; the title is what a window's life changes, as a document's name does.
- The safe area on the window handle. The mod's code and its content share the document, so a computed style reads it; and a container in the content tells its children a different area, which one value for the window would misstate.
- An inset for the frame's rounded corners or for a panel window's capsule. A corner of 16 cuts at most 5 on its diagonal, inside what any row or bar pads, and what a panel window lays into its rounded ends is its own.
- A web page's window sized by the web engine. Where a page apart is shown, and how big, is the GUI's, as [web pages](../DECKIT-25/SPEC.md) leave a window to it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The keyboard going to the key window's content, and what a window shows: no look reads either. `ENDED`, of `windows.open`, `windows.list` and a window's handle: no `call` reaches a cut handle, as [the shell](../DECKIT-29/SPEC.md) says of its cases. That the windows are told before `detach()` is called: no look reads when `detach()` is. A press on a minimized window, or a hand's input on a window not on screen: the base `shell` of [the case format](../DECKIT-1/SPEC.md) answers it with nothing, which no expect matches. A double click set to minimize or to nothing: the base's is set to zoom. Where the host floats an overlay window and when it gives it the keyboard: the base floats it as the case format says. The title a web page's window holds: no look reads a title bar. That the frames kept are what `kept` names: the shell keeps more of a mod than its frames, so `kept` names it with or without a frame kept, and the cases read that `erase` forgets them. The frame as a drag goes, before it is let go: the case format's drag is let go whole. A panel window in front of every normal window, the material under it, its content cut to its shape and what it presents not: no look reads what is drawn. That a press on a panel window reaches its mod as the person's input: the cases read that it leaves the key window key, and [activation](../DECKIT-32/SPEC.md)'s cases what input lets a mod do. A press on a child's view in a panel window: the case format's hand presses a window, never a view laid over it. Where the buttons are drawn, that one not enabled is drawn disabled, a titled window's bar and its title, and its content laid below it: no look reads what is drawn, and the look `windows` reads a frame, not where its content lies. That the safe area is told before `didAppear`: the case's mod reads it once the window is open. The tile the shell shows while a drag goes, and how a window's frame is drawn as it opens, closes, moves to a tile or the zoom area and back, and goes into the Dock and out of it: no look reads what is drawn, and the look `windows` reads the frame the window has, which is there at once. A tile taken at a corner along the right side, at the top, and as the desktop changes size, and a tiled window resized by an edge or by `resize`: the cases read the halves, a quarter by key and its way back, and the case format's desktop keeps its size. An edge met by a resize, and the side alike of a window beside: the cases read a move landing on the zoom area's edge and on a facing side.

**Note.** What this costs an implementation: it keeps a frame for each mod, name and level, written as the person leaves a window, and the frame before of each tiled window; it places a window it opens against the key window and the zoom area, and each panel window against those opened before it; and it tells the windows of every mod in an order the callbacks' order holds across them, the window resigning key and the window closing first.

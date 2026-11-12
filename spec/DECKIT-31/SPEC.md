# DECKIT-31: Windows

Status: draft
Area: shell

## Summary

A mod shows what it draws in windows: `windows.open(options)` opens one and answers its handle, and `windows.list()` answers those open, members of [the handle `shell`](../DECKIT-29/SPEC.md). This DECKIT fixes the two members and the window handle with its callbacks; the three levels a window is at, `normal`, on the desktop among every mod's windows, `overlay`, floating over every app, which `system.overlay-windows` guards, and `panel`, standing in the bar across the top of the host app's window, which `deckit.panel-windows` guards, and the permissions the shell defines for them; one window of a name in a run; where a normal window opens, where a panel window stands and the material under it, the frame it is left at, kept by its mod, its name and its level, and what removing a mod with what it stored does to it; the order of the windows, the key window and its callbacks' order; what the person's hand does on a window; the title bar a window's content is told; the window a web page apart is shown in; and the windows as the run ends. Which mod may activate, and so whether a window becomes key as it opens, is [activation](../DECKIT-32/SPEC.md)'s.

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

## Rules

### A window

A **window** is a place on screen in which a mod's run shows an element, its **content**. It has a **name**, a string that is not empty, and a **level**:

| level | where the window is | guarded by |
|---|---|---|
| `normal` | on the **desktop**, the part of the host app's window where the shell lays the normal windows of every mod | none |
| `overlay` | in a window of its own the host app floats over every app | `system.overlay-windows` |
| `panel` | in the **bar**, a band across the top of the host app's window, as high as the host app says, above the desktop, where the shell places it as *Panel windows* says | `deckit.panel-windows` |

The desktop is the part of the host app's window under the bar, the whole of it where the host app's window has no bar, the bar then 0 high.

A run has one window of a name open at a time, whatever its level, and the name is free again once that window has closed. The windows are the run's: a window opened through the handle `shell` of one lifecycle of the run is the one the handle of another lifecycle of the run opens and lists.

A normal window has a **frame**, `{ x, y, width, height }`, in the coordinates of the screen the desktop is on, `x` to the right and `y` down: its top left, and its **size**, `width` by `height`. Each value of a frame is a whole number, a value a window is opened or set at rounded to the nearest one. A normal window has a **minimum size**, the `minWidth` and `minHeight` its mod gives, and never smaller than 120 by 48, the width of its title bar's buttons with room beside them and the height of its title bar; no frame of the window is smaller than it. The **zoom area** is the desktop but a band 6 wide along its left edge, where the Dock comes out, as [the Dock](../DECKIT-33/SPEC.md) fixes it.

A frame is **reachable** where its top is on the desktop and at least 64 of its width and 48 of its height, its title bar, are on it: `x` from the desktop's left plus 64 minus `width` to the desktop's right minus 64, and `y` from the desktop's top to its bottom minus 48. A frame **brought into reach** is moved the least way it takes to be reachable. No frame of a normal window lies over the bar, as a drag goes too: its top is never above the desktop's.

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
| `width`, `height` | number above 0 | no | the window's size; 720 by 480 where each is left out |
| `minWidth`, `minHeight` | number above 0 | no | the window's minimum size |
| `activates` | boolean | no | whether the window comes in front as the key window; `true` where it is left out |
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
| `close()` | answers nothing | closes the window |
| `minimize()` | answers nothing | minimizes a normal window |
| `zoom()` | answers nothing | sets a normal window's frame to the zoom area, the window then **zoomed**; of a zoomed window, sets its frame back to the one it had before |
| `orderFront()` | answers nothing | brings the window in front, the key window left key, and a minimized one back on screen |
| `makeKeyAndOrderFront()` | answers nothing | brings the window in front as the key window, and a minimized one back on screen |
| `resize(width, height)` | answers nothing | sets the window's size, each a number above 0, no smaller than its minimum, its top left where it was |

`resize` throws at `call` with kind `INVALID_ARGUMENT` where `width` or `height` is not a number above 0. Each member that answers nothing throws, once the lifecycle whose handle opened the window has ended, at `call` with kind `ENDED`, after `INVALID_ARGUMENT`. Once the window has closed, each member that answers nothing does nothing and is refused as before.

`minimize()` and `zoom()` do nothing to an overlay window or a panel window, and `orderFront()` and `makeKeyAndOrderFront()` nothing to a panel window, which stands where the shell places it. A frame set, by `resize` or by the person, ends a zoom: the window is zoomed no more.

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
| a click of the title bar's button `close`, `minimize` or `zoom` | what `close()`, `minimize()` or `zoom()` does |
| a drag of the title bar by `dx`, `dy` | moves the frame by `dx`, `dy`, brought into reach as it is let go |
| a drag of an edge or a corner by `dx`, `dy`: `top`, `bottom`, `left` or `right`, or `top-left`, `top-right`, `bottom-left` or `bottom-right`, the two sides it joins | moves each side it names by the drag, no further than leaves the window its minimum size, the side opposite where it was, the frame brought into reach as it is let go |
| a double click on the title bar | what the person set a double click on a title bar to do: zoom the window, minimize it, or nothing |

A window whose size changes by the person's hand is told `didResize`. On an overlay window, a press gives it the keyboard, and a drag moves it as the host app moves the window it floats. On a panel window, a press reaches its mod as the person's input, as [activation](../DECKIT-32/SPEC.md) fixes it, and leaves the key window key; a press on a child's view its regions show, as [regions and drops](../DECKIT-36/SPEC.md) fix them, reaches the child's mod the same way, and leaves the key window key too; no other input does anything.

### Frames kept

The frame a window is left at is **kept** by its mod, its name and its level, as the host app quits and starts: where the person lets go a drag of its title bar or of an edge, and where `resize` sets it; and, of an overlay window, where the host app tells the shell the person left it. A window with no name keeps no frame, and neither does a panel window, which the shell places.

The frames kept of a mod are what the shell keeps of it, as [the embedding](../DECKIT-22/SPEC.md) fixes what a layer keeps: erased as [the catalog](../DECKIT-4/SPEC.md)'s `remove` erases what the mod stored, with `erase` `true`, and kept with `erase` `false`.

### Overlay windows

The shell asks the host app to show an overlay window in a window of its own, floating over every app, handing it the window's size and the frame kept for it, if any; the host places it, and its frame is the one the host shows it at. It takes the keyboard as it opens, then key, where `activates` is `true` and its mod may activate. `resize` sets its size, its top left where it was. `close()` closes it, and the window the host floats with it.

### Panel windows

A panel window stands in the bar, in front of every normal window, at a frame the shell places it at, in the coordinates of the host app's window, `x` to the right and `y` down: its width the width it is opened or resized at, and its height that height but no higher than the bar. The panel windows open stand right to left in the order they opened: the first with its right edge 8 in from the bar's right end, and each other with its right edge 8 left of the left edge of the one opened before it; each centred on the bar's height, `y` half of what its height leaves of the bar's, rounded. A panel window that closes or changes size moves those opened after it.

A panel window is on screen as it opens, while the desktop is, and is never minimized, zoomed or key: it is told `didAppear` as it opens, and neither `didBecomeKey` nor `didResignKey`. The shell draws no frame around it: under it, its frame rounded by half its height, it draws a **material**, through which the material the host app shows the desktop on shows, tinted, and which is opaque where the person asks the machine for less transparency; the window's content is cut to that shape.

### The title bar

A normal window has a **title bar**, 48 high across the top of its frame, whose buttons `close`, `minimize` and `zoom` stand in its first 78 from the left. The shell draws the buttons over the content, and the content lays out the rest. The root element of the document the content is in is told it: it has the attribute `data-deckit-title-bar`, `--deckit-title-bar-area-height` is `48px` and `--deckit-title-bar-area-x` is `78px`. An overlay window and a panel window have no title bar: the root element has no such attribute, and both properties are `0px`.

### A web page's window

A page apart, which `web.window(options)` answers as [web pages](../DECKIT-25/SPEC.md) fix it, is shown in a normal window of the mod whose page shows it, which has no name and is in no `windows.list()`. The window is **titled**: the shell draws its title bar over the page, holding the page's title as web pages fix it, and the page fills the frame under it, 520 by 700, so the frame is 520 by 748. It opens as a window with no frame kept opens, and comes in front as `makeKeyAndOrderFront()` brings a window. It takes the person's hand as a normal window does, and closing it closes the page.

### The permissions

The shell defines these permissions, as [the permissions](../DECKIT-3/SPEC.md) define one, in this order:

| id | name | description | privileged |
|---|---|---|---|
| `system.overlay-windows` | `Overlay Windows` | `It can show a window of its own over every app's, on every desktop, whichever app is in front.` | `false` |
| `deckit.panel-windows` | `Panel Windows` | `It can show a window of its own in the bar across the top of the app's window.` | `false` |

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
- A web page's window sized by the web engine. Where a page apart is shown, and how big, is the GUI's, as [web pages](../DECKIT-25/SPEC.md) leave a window to it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The keyboard going to the key window's content, and what a window shows: no look reads either. `ENDED`, of `windows.open`, `windows.list` and a window's handle: no `call` reaches a cut handle, as [the shell](../DECKIT-29/SPEC.md) says of its cases. That the windows are told before `detach()` is called: no look reads when `detach()` is. A press on a minimized window, or a hand's input on a window not on screen: the base `shell` of [the case format](../DECKIT-1/SPEC.md) answers it with nothing, which no expect matches. A double click set to minimize or to nothing: the base's is set to zoom. Where the host floats an overlay window and when it gives it the keyboard: the base floats it as the case format says. The title a web page's window holds: no look reads a title bar. That the frames kept are what `kept` names: the shell keeps more of a mod than its frames, so `kept` names it with or without a frame kept, and the cases read that `erase` forgets them. The frame as a drag goes, before it is let go: the case format's drag is let go whole. A panel window in front of every normal window, the material under it and its content cut to its shape: no look reads what is drawn. That a press on a panel window reaches its mod as the person's input: the cases read that it leaves the key window key, and [activation](../DECKIT-32/SPEC.md)'s cases what input lets a mod do. A press on a child's view in a panel window: the case format's hand presses a window, never a view laid over it.

**Note.** What this costs an implementation: it keeps a frame for each mod, name and level, written as the person leaves a window; it places a window it opens against the key window and the zoom area, and each panel window against those opened before it; and it tells the windows of every mod in an order the callbacks' order holds across them, the window resigning key and the window closing first.

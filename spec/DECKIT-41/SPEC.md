# DECKIT-41: Views

Status: draft
Area: shell

## Summary

A **view** is a panel window that stands under a rect another window names, an anchor, or at a place the shell names, and not in the bar. This DECKIT fixes the anchors a window's mod tells through `setAnchors`; a view under an anchor and a view at a place, opened through `windows.open` of [windows](../DECKIT-31/SPEC.md); the size a view is held to and where it stands; for which seats of [seats at the desktop](../DECKIT-39/SPEC.md) it is shown, for every seat or by activation for the one seat its mod acts for, and `toggle()`; what puts it away; its keyboard, which one seat holds at a time; and what its callbacks tell its mod.

## Motivation

One mod draws a row of items in the bar, an item for each mod that asked for one. A mod opens its list under its item:

```js
// the mod bar, of its panel window in the bar
bar.setAnchors([{ id: "clock", rect: { x: 40, y: 0, width: 64, height: 32 }, mod: "clock" }]);
// the mod clock, as its item is pressed
list = shell.windows.open({ name: "list", content, level: "panel", anchor: { mod: "bar", id: "clock" }, width: 320, height: 240 });
```

A mod sees no window of another mod, so `clock` cannot place its list under an item `bar` drew, and what a seat sees and where its keys go are the shell's. Each of these is something two implementations could answer differently without a rule:

- `bar` moves the item as another item comes. On one implementation the list stays where it opened, and on another it follows the item.
- The list is asked 2000 wide near the window's right side. One implementation shows it past the window's side, and another holds it inside.
- A seat presses the item. One implementation shows the list on every seat's screen, and another on the screen of the seat that pressed alone.
- A seat presses outside the list, or presses Escape in it. One implementation leaves it there, another puts it away, and a third closes the window, so the mod opens it anew each time.
- Two seats have the list shown and both type. One implementation puts both seats' keys in one field, and another gives the keyboard to one of them.
- A mod opens a view under an item `bar` named for another mod, and covers that mod's item on one implementation, and is refused on another.

## Rules

### Anchors

An **anchor** is a rect in a window's content that the window's mod names, for one mod to stand a view under. `setAnchors(anchors)`, a member of [the window handle](../DECKIT-31/SPEC.md), answers nothing and tells every anchor of its window, in place of those it told before. `anchors` is an array of tables:

| key | takes | required | what it says |
|---|---|---|---|
| `id` | string, not empty, no longer than 128 | yes | the anchor's name among those its mod tells |
| `rect` | table `{ x, y, width, height }`, each a number, `width` and `height` 0 or more | yes | where the anchor is, from the top left of the window's content |
| `mod` | string, not empty, no longer than 128 | yes | the id of the one mod that may open a view under the anchor |

It throws at `call` with kind `INVALID_ARGUMENT` where `anchors` is no array, one of them does not fit the table, or two of them hold one `id`, and then as a member of the window handle that answers nothing is refused, with kind `ENDED`. It does nothing of an overlay window, and nothing once the window has closed.

An anchor has a **name**, `{ mod, id }`: the id of the mod that told it, and its `id`. Where a mod tells one `id` in two of its windows, the anchor of that name is the one of the window opened first. A window that closes tells no anchor.

An anchor **stands** while the content of its window is laid in the host app's window: that of a panel window in the bar, while it is open; that of a normal window, while some seat has the window on screen; and that of a view, while the view stands. It stands at its `rect` moved by the content's top left, in the coordinates of the host app's window, `x` to the right and `y` down.

### A view under an anchor

`windows.open(options)` with `level` `"panel"` and `anchor`, a table `{ mod, id }` that is an anchor's name, opens a **view under an anchor**. After the refusals [windows](../DECKIT-31/SPEC.md) fixes, in the order it fixes them, it throws at `call` with kind `NOT_PERMITTED`, and opens nothing, where an anchor of that name is told as it is called and the `mod` of that anchor is not the mod that calls.

A name no window tells refuses nothing: the view opens. A view under an anchor **stands** while the anchor of its name stands and that anchor's `mod` is the view's mod, at the frame under *Its size and where it stands*, and moves as the anchor does. While the anchor does not stand, or names another mod, the view stands nowhere and is on no seat's screen, open still.

### A view at a place

`windows.open(options)` with `level` `"panel"` and `place` opens a **view at a place**. A place is one of:

| place | where it is |
|---|---|
| `"top-right"` | the top of the desktop, at the right side of the host app's window |
| `"top-left"` | the top of the desktop, at the left side of the host app's window |

After the refusals [windows](../DECKIT-31/SPEC.md) fixes, it throws at `call` with kind `INVALID_ARGUMENT`, and opens nothing, where `place` is a string that is none of them. A view at a place stands while it is open.

### Its size and where it stands

A view has a frame, `{ x, y, width, height }`, in the coordinates of the host app's window, as a panel window in the bar has. Its size is the size it **asks**, the `width` and `height` it is opened at or `resize` set last, held so:

- `width` is the width asked, rounded to the nearest whole number, no less than 240 and no more than 480, and no more than the width of the host app's window less 16;
- `height` is the height asked, rounded, no less than 80, and no more than the desktop's height less 16.

A view under an anchor stands under it, their right edges in line, and inside the host app's window and the desktop: `x` is the anchor's right edge, rounded, less the view's width, no more than the window's width less 8 less the view's width, and no less than 8; `y` is the anchor's bottom edge, rounded, plus 8, no more than the desktop's bottom less 8 less the view's height, and no less than the desktop's top plus 8.

A view at a place stands with `y` at the desktop's top plus 8, and `x` at 8 at the place `"top-left"`, and at the window's width less 8 less the view's width, no less than 8, at the place `"top-right"`.

A view is never minimized or zoomed, keeps no frame, has no title bar and no room: `room` of its handle is `null`, and it is told no `didChangeRoom`. The shell draws no frame around a view: under it, its frame rounded by 12, it draws the material [windows](../DECKIT-31/SPEC.md) fixes under a panel window, and the view's content is cut to that shape.

### Showing a view

A view is open from the `open` that opened it until it closes. It is on a seat's **screen** while it stands and is **shown** for that seat, one of two ways:

- **For every seat.** A view opened with `activates` `false` is shown for every seat, from the time it opens until it closes: nothing ties it to the input of one of them.
- **By activation.** A view is shown by activation for one seat, the seat its mod acts for as [seats at the desktop](../DECKIT-39/SPEC.md) fixes it, and for none where its mod acts for no seat: as it opens with `activates` `true` or left out; as `makeKeyAndOrderFront()` of its handle is called, or `windows.open` with its name again and `activates` not `false`; and as `toggle()` is called while it is not shown for that seat by activation.

A seat has at most one view shown for it by activation: as a view is shown for a seat so, the view that was is put away for that seat. Showing a view for one seat leaves every other seat's screen as it is, and the view's mod is told no seat.

`toggle()`, a member of [the window handle](../DECKIT-31/SPEC.md), answers nothing: of a view, for the seat its mod acts for, it puts the view away for that seat where the view is shown for it by activation, and shows the view for it by activation where it is not. It does nothing where the mod acts for no seat, and nothing of a window that is no view. It is refused as a member of the window handle that answers nothing is. `orderFront()` does nothing to a view.

The views lie over the normal windows and the panel windows in the bar, as the levels of [windows](../DECKIT-31/SPEC.md) fix it. On a seat's screen they lie in the order they opened, but the one shown for that seat by activation over the others.

### Putting a view away

A view **put away** for a seat is shown for it by activation no more, and is open still. A view shown for a seat by activation is put away for that seat:

1. as the seat presses down anywhere but in the view, in a child's view its regions show, in what its content presents over itself, or on the anchor the view stands under;
2. as a window becomes the seat's key window;
3. as the seat presses Escape, with no modifier, in the view, and the page did not handle the key, as [the shell's keys](../DECKIT-34/SPEC.md) fix where a key goes;
4. as the shell key `closeWindow` runs for the seat: the view is put away, and no window closes;
5. as `toggle()` says, and as another view is shown for the seat by activation;
6. as the view stands no more, its anchor standing no more or naming another mod: for every seat it was shown for by activation;
7. as the host app's window begins to follow another seat, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes following: for the seat of the host app's window;
8. as the seat closes.

None of them closes the view, and none takes a view shown for every seat off a seat's screen: that view is on every seat's screen until it closes. `close()`, and the run's end, close a view for every seat.

### The keyboard of a view

A view shown for a seat by activation has a **keyboard**, which one seat **holds** at a time. The seat takes it as the view is shown for it, unless another seat that is not idle holds it, as [users and seats](../DECKIT-38/SPEC.md) fixes when a seat is idle. While a seat holds a view's keyboard, the seat's key and text events go to the view, to the page there [seats at the desktop](../DECKIT-39/SPEC.md) fixes, and not to its key window: the key window stays the seat's key window in its order, is told `didResignKey` as the view takes the keyboard, and `didBecomeKey` as the keyboard is back with it. The keyboard is back with the seat's key window as the view is put away for the seat or closes.

A seat a view is shown for by activation while another seat that is not idle holds its keyboard does not hold it. It takes it at its next press in the view, or its next key or text event, once no seat holds it or the holder is idle. An idle holder gives the keyboard up as another seat takes it, and is told the output `held`, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes it of a window: its `window` the view's id. While the holder is not idle, a key or text event of the seat is refused at `call` with kind `HELD`. A view whose keyboard passes from one seat to another is told nothing.

A press of a seat in a view is input of that seat to the view's mod. A `down` of a seat in a view shown for it by activation answers `key` and `holder` as [seats at the desktop](../DECKIT-39/SPEC.md) fixes them of a `down` on a normal window: `key` where the seat holds the view's keyboard after it, `held` where another seat does, and under `holder` the id of the seat that holds it. A press in a view that is not shown for the seat by activation, one shown for every seat, leaves the seat's keyboard where it is, and its `down` answers neither.

### Callbacks

A view is told the callbacks of [windows](../DECKIT-31/SPEC.md), each as the window is told there, where:

| callback | told as the view |
|---|---|
| `didAppear` | comes on some seat's screen while it was on none |
| `didDisappear` | is on no seat's screen any more, or closes while on one |
| `didBecomeKey` | has its keyboard taken by a seat while none held it |
| `didResignKey` | has its keyboard held by no seat any more |
| `didResize` | changes size, on a screen or on none |
| `didClose` | has closed |

`isKey` of its handle is `true` while a seat holds its keyboard. A view is told in the order every window is: `didAppear` before `didBecomeKey`, `didResignKey` before `didDisappear`, and `didDisappear` before `didClose`. A view put away for one seat and on another's screen still is told no `didDisappear`.

## Interactions

- `windows.open`, its options and the order of its refusals, the window handle and its members' refusal, the levels, a panel window in the bar, the material, the callbacks and their order: [windows](../DECKIT-31/SPEC.md).
- A seat, its key window, the seat a mod acts for, the holder of a window, the output `held`, a pointer, a key and a text event and their answers, `HELD`, and following: [seats at the desktop](../DECKIT-39/SPEC.md). An idle seat, and a seat that closes: [users and seats](../DECKIT-38/SPEC.md).
- Which mod may activate, input and a request: [activation](../DECKIT-32/SPEC.md). The shell key `closeWindow`, and a key a page did not handle: [the shell's keys](../DECKIT-34/SPEC.md).
- A view as a seat reads it, a panel window's line with no edge: [what a seat reads](../DECKIT-40/SPEC.md). A region in a view: [regions and drops](../DECKIT-36/SPEC.md).
- `deckit.panel-windows`, which guards the level `panel` and so a view: [windows](../DECKIT-31/SPEC.md) and [the permissions](../DECKIT-3/SPEC.md).

## Alternatives considered

- A view placed by its mod, at a point. A mod sees no window of another mod, and not where the item it was given stands; the mod that drew the item names its rect, and the shell places the view.
- An anchor any mod may stand a view under. A mod would cover another's item with a view that looks like that mod's; the mod that draws the item names the one mod it drew it for.
- A view closed as it is put away. Its mod would build its content anew at every press; a view put away is open, and shown again as it was.
- A view shown on every seat's screen as one seat asks for it. What one user opens would come up over what every other user is doing; a view comes where the input that asked for it came from.
- The seat told to the view's mod. A mod would act differently for one user than for another; it shows its view, and the shell shows it for the seat whose input reached the mod.
- A view that is a seat's key window. It would enter every seat's order and take the place of the window the seat works in; the view holds the keyboard for the time it is shown and gives it back.
- A keyboard for each seat in one view. The view's content is one document with one focus, so two seats would type in one field; one holds it, and an idle holder gives it up, as of a window.
- A width and a height a view is given whole. A view asked wider than the host app's window, or under an anchor near its side, would stand where no seat reaches it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `ENDED` of `setAnchors` and `toggle()`: no `call` reaches a cut handle, as [the shell](../DECKIT-29/SPEC.md) says of its cases. That `setAnchors` does nothing of an overlay window or of a window that has closed: doing nothing is what no look tells from an anchor no view stands under. An `id` or a `mod` longer than 128: the cases read an anchor that does not fit the table by its `rect`, the same sentence. The material under a view, its corners and its content cut to them: no look reads what is drawn. Which view lies over which on a seat's screen: the look `windows` lists the views in the order they opened. A press in a child's view a view's regions show, or in what its content presents over itself: the case format's hand presses a window, never what is laid over it. A view put away as the host app's window begins to follow another seat: no input of [the case format](../DECKIT-1/SPEC.md) has the host app's window follow. Where a view under an anchor near the bottom of the desktop stands: the case format's bar and the anchors its cases name are at the desktop's top.

**Note.** What this costs an implementation: it keeps the anchors each window told and where each stands, and places every view again as an anchor, a window or the host app's window moves; it keeps, for each seat, the one view shown for it by activation, and for each view the seat that holds its keyboard; and it hears every press of every seat to put a view away.

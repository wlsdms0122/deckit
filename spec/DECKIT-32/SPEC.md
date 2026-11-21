# DECKIT-32: Activation

Status: draft
Area: shell

## Summary

The person works in one window at a time, the one the keyboard goes to. This DECKIT fixes which window is **key** across the levels [windows](../DECKIT-31/SPEC.md) fixes, one at a time; the **active mod**, the mod of the key window; which mod **may activate**, its window coming in front as the key window: the active mod, and a mod that input reached, or that a request from a mod that may activate reached, until the next input reaches another; what happens to a window of a mod that may not, held right behind the key window, and the **attention** that mod asks for; the title of the host app's window; and `active()`, a member of [the handle `shell`](../DECKIT-29/SPEC.md), whether the app is in front.

## Motivation

A mod that runs in the background finishes a long export and opens a window to say so:

```js
shell.windows.open({ name: "done", content: this.view() });
```

The person is typing in another mod's window. Opening a window is a request any mod's code makes at any time, so without a rule the window that opens takes the keyboard, and what the person types next lands in it. What is let to come in front, and when, is the GUI's to decide: it is the shell that knows where the person's input went, and no mod sees the windows of the others. Each of these is something two implementations could answer differently without a rule:

- The person presses on a mod's window, and that mod reaches another by its id, which opens a window. One implementation lets it come in front as key, as the person's press led to it, and another holds it back.
- A mod's window is key, and its mod opens a window at the level `overlay`, which takes the keyboard. One implementation tells the normal window `didResignKey`, and another leaves both windows' `isKey` `true`, so the mod's editor in the normal window draws a caret for keys that go elsewhere.
- A mod held back asks for the person's attention. One implementation marks it until the person comes to it, another until it closes its window, and a third never clears it.
- The person types in the overlay window of one mod. One implementation's title names that mod, another's the mod of the normal window behind it.
- A mod's keys of the scope `app` run only while the app is in front, and a mod asks `active()` to know which of its keys runs. One implementation answers whether the app is in front, another whether that mod's window is key.

## Rules

### The key window and the active mod

At most one window is **key** at a time: the window whose content the keyboard goes to. The keyboard is on the desktop, where it goes to the desktop's key window as [windows](../DECKIT-31/SPEC.md) fixes the order, or held by an overlay window, which takes it as [windows](../DECKIT-31/SPEC.md) fixes, or by a view, which takes it as [views](../DECKIT-41/SPEC.md) fix. While an overlay window or a view holds it, that window is key, and the desktop's key window, which stays the key window of the desktop's order, is not: it is told `didResignKey` as the other window takes the keyboard, before that window is told `didBecomeKey`, and is key again, told `didBecomeKey`, as the keyboard comes back to the desktop. One window holding the keyboard that another takes is told `didResignKey` before the other is told `didBecomeKey`.

The **active mod** is the mod of the key window. Where no window is key, no mod is active.

Where more than one seat is open, each seat has a key window, an active mod and a record of who may activate of its own, and a window is key while it holds the keyboard of any of them, as [seats at the desktop](../DECKIT-39/SPEC.md) reads these rules for each seat.

The host app's window has a **title**, the name the system lists the window by, which is the name the mod of the desktop's key window is listed by, as [the bundle](../DECKIT-2/SPEC.md) fixes `name`, or the host's name, as [the embedding](../DECKIT-22/SPEC.md) fixes it, where the desktop has no key window.

### Who may activate

A mod **may activate** while it is the active mod, and from the time input reaches it until input next reaches another mod or none. **Input** reaches a mod as this table gives:

| input | reaches |
|---|---|
| a press in one of the mod's windows, at any level, as [windows](../DECKIT-31/SPEC.md) fixes the person's hand | the window's mod |
| a key pressed in a page of the mod's: the content of one of its windows, a web page it shows, or its page | that mod |
| a key pressed in a page of the shell's own, such as the desktop's | no mod |
| a chord a mod took pressed in any page, told to that mod, as [the shell's keys](../DECKIT-34/SPEC.md) fix a chord | the page's mod, as a key pressed there, and then the mod that took the chord |
| a click on the mod's item in the Dock, as [the Dock](../DECKIT-33/SPEC.md) fixes it | that mod |

A mod also may activate from the time a request from a mod that may activate reaches it, until input next reaches another mod or none. A **request** of one mod to another is one of these, from the mod whose run makes it to the mod it reaches:

- reaching a mod by its id, `dependencies.reach(id)`, and a call through a connection, of the client to the service or of the service to the client, as [the connections](../DECKIT-9/SPEC.md) fix them;
- a `launch` or `relaunch` request of a mod, as [the lifecycle](../DECKIT-5/SPEC.md) fixes them;
- `mods.open(id)`, as [the Dock](../DECKIT-33/SPEC.md) fixes it.

A request of a mod that may not activate hands nothing. The keyboard an overlay window takes as it opens or comes in front, as its mod may activate, is no input: it is that mod activating.

**Note.** That a request hands activation on is what lets a mod the person works in open another for them: the person presses a mod's button, the mod reaches a viewer, and the viewer's window comes in front. A mod the person did not reach, nor any mod they reached, cannot take the keyboard from them.

### A mod held back

A mod is **held back** where its window is to come in front as the key window, as `makeKeyAndOrderFront()` or `windows.open` with `activates` `true` brings one, and the mod may not activate, so the window comes right behind the key window, or in front where none is, as [windows](../DECKIT-31/SPEC.md) fixes it. A mod held back while the desktop has a key window **asks for attention**: the Dock marks its item, as [the Dock](../DECKIT-33/SPEC.md) fixes it. It asks until it is the active mod, or has no window open. A window brought in front with the key window left key, as `orderFront()` or `activates` `false` brings one, asks for none.

### active()

`active()` is a request, as [the handle](../DECKIT-7/SPEC.md) fixes one: it answers `true` where a page of the app has the keyboard, the app in front of the machine's other apps, and `false` otherwise. It takes no argument, and one handed is not read. Through a cut handle it is refused as [the shell](../DECKIT-29/SPEC.md) refuses a member of one, with kind `ENDED`.

## Interactions

- The desktop, its order, the key window, a window that comes in front, `makeKeyAndOrderFront()`, `orderFront()`, `activates`, the person's hand and the overlay windows the host floats: [windows](../DECKIT-31/SPEC.md).
- The handle `shell`, whose member `active()` is: [the shell](../DECKIT-29/SPEC.md). A request, its promise and the argument past those it takes: [the handle](../DECKIT-7/SPEC.md).
- `name`: [the bundle](../DECKIT-2/SPEC.md). The host's name: [the embedding](../DECKIT-22/SPEC.md).
- Reaching a mod and a call through a connection: [the connections](../DECKIT-9/SPEC.md). `launch` and `relaunch`: [the lifecycle](../DECKIT-5/SPEC.md).
- A chord a mod takes and when it is told, and a key a mod records: [the shell's keys](../DECKIT-34/SPEC.md). The Dock, a click on an item, `mods.open(id)` and the item marked for attention: [the Dock](../DECKIT-33/SPEC.md).
- The desktop of each seat, and the seats whose keyboard a window holds: [seats at the desktop](../DECKIT-39/SPEC.md).
- The input `key`, the look `desktop`, and the base `shell`'s keyboard and the app in front: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- Every mod may activate at any time. A mod in the background would take the keyboard from the person as it opens a window, and what they type would land in a window they did not come to.
- A mod may activate only where input reached it. A mod the person works in could not open another for them: the person presses a button for a viewer, and its window would open behind.
- Activation handed until the next activation, not the next input. Each mod that came in front would end what the person handed the others, so a viewer a mod opened would end the hand of the mod the person works in, whose next window would open behind though the person did nothing.
- A normal window left key while an overlay window holds the keyboard. Its content would be told it has the keyboard while its keys go elsewhere.
- The title naming the mod of an overlay window with the keyboard. The title is the host app's window's, and the overlay window floats over every app outside it; the title would change as the person types in a floating window, though the desktop under it did not.
- `active()` answering whether the asking mod is the active mod. A mod asks it to know whether its keys of the scope `app` or of the scope `global` run, which is whether the app is in front, whatever mod is active.
- The input parted by who gave it: a press of the host's own controls apart from the person's. No rule tells who sent an input, and a host's hand on a window, as [windows](../DECKIT-31/SPEC.md) takes it, is the person's.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The keyboard going to the key window's content: no look reads where a key goes but through what it reaches. A click on the Dock and `mods.open(id)`: [the Dock](../DECKIT-33/SPEC.md) holds them with its inputs. A `launch` and a `relaunch` request handing activation, and a call through a connection of the service to the client: cases hold reaching and a call of the client, and the rest is the same sentence. A key pressed in a page of a mod with no window, and a chord's key pressed in the page of the mod that took it: the base `shell` of [the case format](../DECKIT-1/SPEC.md) presses a key where the keyboard is, which is a window's content or the desktop's page. The Dock's item marked for attention: [the Dock](../DECKIT-33/SPEC.md) holds it with its look. `ENDED` of `active()`: no `call` reaches a cut handle, as [the shell](../DECKIT-29/SPEC.md) says of its cases. `active()` answering `false`: the base `shell` is the only app on its stand-in for a screen, in front from its start.

**Note.** What this costs an implementation: it keeps, for the person, which mods may activate, ended by each input and added to by each request, and tells every request of one mod to another to that record before it goes on; it tells a normal window it is key no more as an overlay window takes the keyboard; and it tells apart the keyboard a host gives an overlay window as asked from the keyboard the person gives it with a press.

# DECKIT-34: The shell's keys

Status: draft
Area: shell

## Summary

The keys of the host app are in one **table of chords**, each chord held by one holder at a time: one of the **shell's keys**, which close, minimize and cycle the desktop's windows, those of the seat that pressed as [seats at the desktop](../DECKIT-39/SPEC.md) reads them for each seat, or a mod that took it. This DECKIT fixes a keystroke's chord; `keys.take(keystroke, run, options)`, members of [the handle `shell`](../DECKIT-29/SPEC.md) through which a mod takes a chord in the scope `app`, every page of the host app, or `global`, every app, with the permissions `deckit.app-keys` and `system.global-keys`, is told each press of it and lets it go; the shell's keys, which hold their chords before any mod, run only after the page did not handle the key, and are listed, set and reset by a mod granted `deckit.shell-keys` through `keys.list()`, `keys.set(id, keystroke)` and `keys.reset(id)`; `keys.record(onKeystroke)`, through which a mod is handed the keys pressed in its own pages; and the order in which a key pressed in a page goes to each of them.

## Motivation

A mod gives the person a chord that works wherever they are in the host app, and one that works in every app:

```js
const { held, release } = await shell.keys.take({ code: 'KeyK', control: true, alt: true }, () => show(), { scope: 'global' });
```

Without this DECKIT, one implementation hands ⌃⌥L to every mod that takes it, another to the last, a third to the first; one takes it from the page before the page has it and another after; one answers `held` false where the machine does not give the chord outside the app and another refuses the take. A mod takes ⌘W, and on one implementation the person can no longer close a window; the person sets Close Window to ⌘J, and on one host the choice is gone as the app starts again. A settings mod records the chord the person presses for a key, and on one implementation it hears nothing pressed in its own window. What a chord is, who holds it and what a press reaches are the shell's to fix, since every page of the app and the machine's keys are the shell's.

## Rules

### A keystroke and its chord

A **keystroke** is a table `{ code, meta, control, alt, shift }`: `code` a string, not empty, the key's code, and each modifier a boolean, `true` where it is held, as [the key bindings](../DECKIT-16/SPEC.md) fix one; one a mod hands may leave out a modifier, which is then not held. Two keystrokes are one **chord** where they have the same `code` and the same modifiers held. A key pressed is a keystroke as the machine names its key, by its code.

The **chord table** holds each chord taken, with its **holder**: one of the shell's keys, or the run of the mod that took it. A chord has at most one holder. A take of a chord that has one is refused, whatever its scope and whoever holds it, the taking mod among them.

### Taking a chord

| member | takes | answers | guarded by |
|---|---|---|---|
| `keys.take(keystroke, run, options)` | `keystroke`, a keystroke, required; `run`, a function, required: what each press runs, called with no arguments; `options`, a table `{ scope }`, not required, `scope` a string, not required | a table `{ held, release }`: `held` a boolean, `release` a function that answers nothing | `system.global-keys` where `options.scope` is `"global"`, and `deckit.app-keys` otherwise |

`keys.take` is a request, as [the shell](../DECKIT-29/SPEC.md) fixes its members' shapes, and it alone takes and answers a function: `run`, and `release` in what it answers; what [the handle](../DECKIT-7/SPEC.md) fixes of values holds for the rest. The **scope** is `options.scope`, and `"app"` where it is left out:

| scope | where the chord works |
|---|---|
| `app` | in every page of the host app, while the host app is in front |
| `global` | in every page of the host app, and in every other app, as the machine gives the host app the chord outside it |

A take puts the chord in the table with the mod's run as its holder and answers once it is there. `held` is whether the chord works where its scope says: `true` for `app`, and for `global` whether the machine gave the host app the chord outside it. A chord of `global` the machine does not give is in the table all the same, and works in the host app.

A take is refused at `call`, and nothing of it is done, with the first of these that is so:

1. with kind `NOT_PERMITTED`, where the mod is not granted the permission that guards it;
2. with kind `INVALID_ARGUMENT`, where an argument does not fit what the member takes, `keystroke.code` is the empty string, or `scope` is neither `"app"` nor `"global"`;
3. with kind `ENDED`, once the lifecycle whose handle it was called through has ended, as [the shell](../DECKIT-29/SPEC.md) cuts a handle;
4. with kind `REFUSED`, where the chord has a holder.

Each press of the chord where its scope says **tells** it to the mod: `run` is called, and what it throws or rejects with is told no one. A chord is **let go**, out of the table, as `release()` is called, as the lifecycle whose handle took it ends, and as the mod's run ends, whichever comes first; a chord let go is told no more, and `release()` called again does nothing.

**Note.** A chord a mod takes is the mod's whatever page the person is in, and a take refused for a chord held is how a mod learns that the person or another mod holds it: the owner of `deckit/keys` reads it as a key **taken**, as [the key bindings](../DECKIT-16/SPEC.md) fix it.

### The permissions

The shell defines these permissions, as [the permissions](../DECKIT-3/SPEC.md) define one, in this order:

| id | name | description | privileged |
|---|---|---|---|
| `deckit.app-keys` | `App Keys` | `Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.` | `false` |
| `system.global-keys` | `Global Keys` | `Its keys work in every app, this one in front or not, and are taken from all of them.` | `false` |
| `deckit.shell-keys` | `Shell Keys` | `It can change the keys of the app's desktop.` | `true` |

### The shell's keys

The shell has these keys, in this order:

| id | name | default | what a press does |
|---|---|---|---|
| `closeWindow` | `Close Window` | `{ code = "KeyW", meta = true }` | closes the desktop's key window, as a click of its button `close` of [windows](../DECKIT-31/SPEC.md) does; where a view is shown by activation for the seat that pressed, puts that view away and closes nothing, as [views](../DECKIT-41/SPEC.md) fix it |
| `minimizeWindow` | `Minimize Window` | `{ code = "KeyM", meta = true }` | minimizes the desktop's key window, as a click of its button `minimize` does |
| `cycleWindows` | `Cycle Through Windows` | `{ code = "Backquote", meta = true }` | brings in front, as the key window, the back-most window on screen of the mod of the desktop's key window, where that mod has two or more on screen |
| `tileLeft` | `Tile Window to Left Half` | `{ code = "ArrowLeft", control = true, alt = true }` | has the desktop's key window take the tile `left`, as *Tiles* of [windows](../DECKIT-31/SPEC.md) says, where it is resizable |
| `tileRight` | `Tile Window to Right Half` | `{ code = "ArrowRight", control = true, alt = true }` | as `tileLeft` does, the tile `right` |
| `tileFill` | `Tile Window to Fill` | `{ code = "ArrowUp", control = true, alt = true }` | as `tileLeft` does, the tile `fill` |
| `tileTopLeft` | `Tile Window to Top Left Quarter` | `{ code = "KeyU", control = true, alt = true }` | as `tileLeft` does, the tile `top-left` |
| `tileTopRight` | `Tile Window to Top Right Quarter` | `{ code = "KeyI", control = true, alt = true }` | as `tileLeft` does, the tile `top-right` |
| `tileBottomLeft` | `Tile Window to Bottom Left Quarter` | `{ code = "KeyJ", control = true, alt = true }` | as `tileLeft` does, the tile `bottom-left` |
| `tileBottomRight` | `Tile Window to Bottom Right Quarter` | `{ code = "KeyK", control = true, alt = true }` | as `tileLeft` does, the tile `bottom-right` |
| `restoreWindow` | `Restore Window` | `{ code = "ArrowDown", control = true, alt = true }` | sets the desktop's key window, where it is tiled, back at its frame before, as *Tiles* says, tiled no more |

The keys that tile hold Control and Option, under one hand: an arrow for a half, the whole zoom area and the way back, and for a quarter the letter at that corner of the square the keys U, I, J and K make.

Each is bound to the keystroke a mod set it to, or to none where one set none, and else to its default. As the host app starts, the shell holds the chord of each key bound to one in the table before any mod's run starts. A shell key **runs** where its chord is pressed while the keyboard is on the desktop, as [activation](../DECKIT-32/SPEC.md) fixes where the keyboard is, and the page it was pressed in did not handle the key; it does what the table says, and nothing where the desktop has no key window. A shell key pressed in an overlay window that holds the keyboard does nothing.

| member | takes | answers | guarded by |
|---|---|---|---|
| `keys.list()` | nothing | an array, one table `{ id, name, defaultKeystroke, keystroke }` for each of the shell's keys, in their order: `defaultKeystroke` its default and `keystroke` what it is bound to, left out where it is bound to none, each keystroke with its five keys | `deckit.shell-keys` |
| `keys.set(id, keystroke)` | `id`, a string, required; `keystroke`, a keystroke, not required: left out, the key is bound to none | the key, as `keys.list()` answers one, once what is set is kept | `deckit.shell-keys` |
| `keys.reset(id)` | `id`, a string, required | the key, as `keys.list()` answers one, bound to its default, once that is kept | `deckit.shell-keys` |

Each is a request. A set or reset lets the key's old chord go and holds the new one in the table. `keys.set` and `keys.reset` are refused at `call`, and nothing of them is done, with the first of these that is so:

1. with kind `NOT_PERMITTED`, where the mod is not granted `deckit.shell-keys`;
2. with kind `INVALID_ARGUMENT`, where an argument does not fit what the member takes, `keystroke.code` is the empty string, or `id` is none of the shell's keys';
3. with kind `ENDED`, once the lifecycle whose handle it was called through has ended;
4. with kind `REFUSED`, where the chord it binds the key to, other than the one it is bound to, has a holder: another of the shell's keys, or a mod.

A key bound by `keys.set` or `keys.reset` stays bound so as the host app starts again; a key bound to its default keeps nothing. `keys.list()` is refused with the first two alone.

**Note.** A shell key binds any keystroke, one with no modifier among them. A key of `deckit/keys` is taken from every page before the page has it, which is why [the key bindings](../DECKIT-16/SPEC.md) refuse one that would take typing from a text field; a shell key runs only after the page did not handle the key, so a text field keeps every key it acts on.

### Recording

| member | takes | answers |
|---|---|---|
| `keys.record(onKeystroke)` | `onKeystroke`, a function, required | `stop`, a function that answers nothing |

`keys.record` answers at once, as [the shell](../DECKIT-29/SPEC.md) fixes the shape, and throws at `call` with kind `INVALID_ARGUMENT` where `onKeystroke` is no function, then with kind `ENDED` once its lifecycle has ended. From then, each key pressed in a page of the mod's run, its own page, the overlay the shell lays over it, or the content of one of its windows, normal or overlay, is handed to `onKeystroke` as a keystroke with its five keys, and **taken**: no chord is told for it, and no shell key runs. A key pressed in a page of another mod's, in the desktop's own page, or in a web page the mod shows, is not handed. The recording ends as `stop()` is called, as the mod records again, as its lifecycle ends, and as its run ends.

### Where a key goes

The pages the keys are heard in are every page of the host app: a mod's page and its overlay, a window's content, a web page a mod shows, and the desktop's own page. A key pressed in one goes, in this order:

1. it is input, as [activation](../DECKIT-32/SPEC.md) fixes what a key pressed in a page reaches;
2. where the run whose page it was pressed in records, it is handed to the recording and taken, and goes no further;
3. where its chord was taken by a mod, it is told to that mod and taken from the page, which does not have it;
4. the page has it;
5. where the page did not handle it, the shell's key whose chord it is, if any, runs.

Escape, with no modifier, that the page of a view did not handle puts that view away, as [views](../DECKIT-41/SPEC.md) fix it.

A key pressed in another app goes to the chord of `global` the machine gave the host app, if one was taken, and is told to its mod. A key is told and runs alike whoever pressed it.

## Interactions

- The handle `shell`, the shapes of its members, a cut handle and `ENDED`: [the shell](../DECKIT-29/SPEC.md). A request, a value, `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md). `NOT_PERMITTED` and how a permission is defined: [the permissions](../DECKIT-3/SPEC.md).
- A keystroke, and the owner of `deckit/keys`, which takes its keys' chords through `keys.take` and reads its refusal and `held`: [the key bindings](../DECKIT-16/SPEC.md).
- The desktop's key window, `close()`, `minimize()`, the order of the windows and an overlay window: [windows](../DECKIT-31/SPEC.md).
- Where the keyboard is, the app in front, and the input a key pressed and a chord told are: [activation](../DECKIT-32/SPEC.md).
- A mod's run and its end: [the lifecycle](../DECKIT-5/SPEC.md). A web page a mod shows: [web pages](../DECKIT-25/SPEC.md).
- A key pressed in the host app or in another app, and the chords the machine does not give: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- A chord held by every mod that takes it, or by the last. A press would run two things, or what started last would take a person's key from another mod.
- A mod's chord after the page, as the shell's keys are. A page would decide whether a key the person set works there, and a key would work in one page and not in the one beside it.
- The shell's keys before the page. ⌘W would close a window while a page that edits text uses it, and a page could not have any chord the shell holds.
- A take of `global` the machine does not give refused. The chord works in the host app all the same, and a mod would have to take it again in `app` to have that.
- `keys.set` held to the fit of [the key bindings](../DECKIT-16/SPEC.md). A shell key runs after the page, so the reason for the fit does not hold, and the refusal would guard nothing.
- The shell's keys acting on an overlay window that holds the keyboard. The person's hand on an overlay window is a press and a move alone, as [windows](../DECKIT-31/SPEC.md) fix it, and its mod closes it; the keys act on the desktop the person arranges.
- A recording that hears every page, or a web page the mod shows. A mod would read what the person types in another mod or in a site; the recording hears the pages of the mod's own run.
- `release` as a member of its own, `keys.release(keystroke)`. A mod would let go of a chord it did not take; the function a take answers lets go of that take alone.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That a page does not have a chord a mod took, and that a shell key runs only where the page did not handle the key: no page of a case handles a key. A chord of `app` while the host app is not in front, and `active()` false: no input of the case format puts another app in front but for one key. A key pressed in a web page, or in a page's overlay: no input of the case format gives either the keyboard. `run` that throws, and `release()` called twice: nothing a case reads tells them apart. `ENDED`: no `call` reaches a cut handle, as [the shell](../DECKIT-29/SPEC.md) says of its cases. A recording that ends as the mod records again or as its lifecycle ends: a case reads what is recorded, and a second recording hears what the first would.

**Note.** What this costs an implementation: it hears every key pressed in every page of the host app before the page has it, and again where the page did not handle it; it holds the chords of `global` with the machine for as long as each is taken, and lets go of each as its mod's run ends; and it keeps the shell's keys as a mod sets them.

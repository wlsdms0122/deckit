# DECKIT-33: The Dock

Status: draft
Area: shell

## Summary

The person finds the apps of the desktop in the **Dock**, along the desktop's left edge. This DECKIT fixes which mod is an **app**, by the manifest fields the shell adds, `activationPolicy`, `icon` and `keywords`; the Dock's **items**, the apps the person keeps there, in the Dock's order, and then the apps that run; the Dock at the first start, as the host names it or as it ships its apps; how keeping an app, taking it out and a drag change that order, which stands as the host app quits and starts; the marks of an item; what a click on an item and the choices of its menu do, the instance's `reopen()` among them; and `mods.list()`, `mods.pinned()`, `mods.setPinned(id, pinned)` and `mods.open(id)`, members of [the handle `shell`](../DECKIT-29/SPEC.md) through which a mod granted `deckit.mods` reads the Dock, keeps an app there or takes it out, and opens an app as the person opens it.

## Motivation

A mod that manages the mods, granted `deckit.mods`, installs an app the person chose, keeps it in the Dock and opens it:

```js
await shell.mods.setPinned("notes", true);
await shell.mods.open("notes");
```

The Dock is the shell's: it is drawn on the desktop, and what it holds is the person's arrangement, which no mod draws. Each of these is something two implementations could answer differently without a rule:

- The person keeps an app, drags it ahead of another, and quits the host app. One implementation's Dock comes back in that order, another's in the catalog's.
- The person takes an app out of the Dock while it runs. One implementation drops its item, another leaves it where it was kept, and a third moves it after the apps kept.
- The person clicks the item of an app that runs with no window open. One implementation does nothing, another launches it again, and a third asks the mod to open a window.
- A mod writes `activationPolicy = "acessory"`, a misspelling. One implementation reads it as an app, another as no app, and a third refuses the bundle.
- The person types in an overlay window. One implementation marks the item of the overlay window's mod active, another the item of the mod whose window is the desktop's key window.
- `mods.open(id)` names a mod that is no app. One implementation launches it, another answers nothing, and a third refuses it at a stage and with a kind of its own.

## Rules

### Apps

The shell adds these fields, among the fields it adds, as [the bundle](../DECKIT-2/SPEC.md) lets a layer add them, and reads each, of a mod the system took, as the table gives. The system judges no value of them, so a value that does not read as the table gives is read as the field left out:

| field | read as | what it says |
|---|---|---|
| `activationPolicy` | the string `"accessory"`; any other value, and the field left out, read as `"regular"` | whether the mod is an app |
| `icon` | a string, an SVG image; any other value read as none | the icon the mod is drawn with |
| `keywords` | an array, of which the strings that are not empty are read, in order; any other value read as none | words the mod is found by beside its name |

An **app** is a mod the system took whose `activationPolicy` reads `"regular"`. A mod whose `activationPolicy` is `"accessory"` is no app, and has no item.

### The Dock and its items

The Dock is on the desktop, along its left edge, and comes out from the band 6 wide there that [windows](../DECKIT-31/SPEC.md) leaves out of the zoom area. The mods **kept** in the Dock stand in one order, the **Dock's order**. The Dock's items are these, each app once, in this order:

1. the apps kept in the Dock, in the Dock's order, whether they run or not;
2. then the apps that run and are not kept, in the order they launched, one that launched again after the others.

An app **runs** while its latest run is `launching`, `running` or `terminating`, as [the lifecycle](../DECKIT-5/SPEC.md) fixes the states, and while it is `notRunning` as a background mod whose run failed and that launches again. An app that is not kept leaves the Dock as it stops running; one kept stays, where it is kept.

The mods kept may name a mod that is no app: one not installed, or one whose `activationPolicy` reads `"accessory"`. It has no item, and is an item, at its place among those kept, once it is an app.

### The first Dock

At the first start of the host app, before anything is kept in the Dock, the mods kept are, in order, the ids the host hands the shell for the Dock at the first start, as it stacks the layer as [the embedding](../DECKIT-22/SPEC.md) fixes it; where the host hands none, they are the apps the host ships, in the catalog's order, as [the catalog](../DECKIT-4/SPEC.md) fixes it. The ids a host hands are kept as it hands them, each whether it names an app or not.

### The Dock's order

- An app kept in the Dock comes after those kept before it.
- An app taken out of the Dock leaves the Dock's order; one that runs is then an item among the apps that run and are not kept.
- A drag of a kept item onto the place of another kept item moves it to that place, and the kept items between move along by one.

What the Dock keeps, its order among it, stands as the host app quits and starts, whatever the host hands at a later start.

The mods kept in the Dock are what the shell keeps of a mod, as [the embedding](../DECKIT-22/SPEC.md) fixes what a layer keeps: a mod kept there is named under `kept`, and a mod never kept is not, whatever the person does to the Dock. Removed as [the catalog](../DECKIT-4/SPEC.md)'s `remove` removes a mod, with `erase` `true`, a mod is taken out of the Dock; with `erase` `false`, it stays kept at its place.

### Marks

Each item is marked as this table gives:

| mark | the item is marked where |
|---|---|
| running | the app runs |
| attention | the app asks for attention, as [activation](../DECKIT-32/SPEC.md) fixes a mod held back |
| active | the app is the mod of the desktop's key window, the mod the strip names, as [activation](../DECKIT-32/SPEC.md) fixes them, whether or not an overlay window holds the keyboard |

### Opening an app

An app is **opened** for the person in these steps:

1. Where the app may activate, as [activation](../DECKIT-32/SPEC.md) fixes it, the host app's window comes in front of the machine's other apps, and the desktop comes up.
2. An app that does not run launches, as [the lifecycle](../DECKIT-5/SPEC.md)'s `launch` launches a mod.
3. An app that runs with a window open has each of its windows brought as `makeKeyAndOrderFront()` brings one, as [windows](../DECKIT-31/SPEC.md) fixes it: its normal windows in the order they stand, back to front, a minimized one back on screen, and then its overlay windows. So where the app may activate, the last of them is the key window, and where it may not, each is held back, as [activation](../DECKIT-32/SPEC.md) fixes it.
4. An app whose run is `running` with no window open has its instance's `reopen()` called.

`reopen()` is a member the shell reads of the run's instance, beside `attach` and `detach`, as [the shell](../DECKIT-29/SPEC.md) fixes them. It is called with no arguments, and what it answers is not read. It is called whatever members of the shell's lifecycle the instance has, of an instance with no `attach` too, as its run runs as one whose lifecycle has started.

### The person's hand

A **click** on an item is input reaching its app, as [activation](../DECKIT-32/SPEC.md) fixes input, and opens the app. Each item has a menu, whose choices are these, each in the implementation's words and offered where the table says:

| choice | offered | what it does |
|---|---|---|
| open | always | what a click does |
| quit | where the app runs | asks the end of its run, as [the lifecycle](../DECKIT-5/SPEC.md)'s `quit` asks it |
| keep in the Dock | where the app is not kept | keeps it in the Dock |
| take out of the Dock | where the app is kept | takes it out of the Dock |

### mods

The handle `shell` has these members, each a request as [the shell](../DECKIT-29/SPEC.md) fixes one, guarded by `deckit.mods`, which [the permissions](../DECKIT-3/SPEC.md) define:

| request | takes | answers |
|---|---|---|
| `mods.list()` | nothing | an array of the apps: those kept in the Dock, in the Dock's order, then every other app, in the catalog's order; each a table `{ id, name, icon, keywords, pinned, running }`, `id` its id, `name` the name it is listed by, as [the bundle](../DECKIT-2/SPEC.md) fixes `name`, `icon` its icon, or `""` where it has none, `keywords` an array of its keywords, empty where it has none, `pinned` whether it is kept in the Dock, and `running` whether it runs |
| `mods.pinned()` | nothing | an array of the ids of the apps kept in the Dock, in the Dock's order |
| `mods.setPinned(id, pinned)` | `id` a string, `pinned` a boolean | nothing, once the app `id` is kept in the Dock where `pinned` is `true`, or taken out where it is `false`, as the choice of the menu that does it does; one kept or not as asked already is left as it is |
| `mods.open(id)` | `id` a string | nothing, once the app `id` is opened, as *Opening an app* says, and where that launches it, once its run is `running` |

Each is refused as [the shell](../DECKIT-29/SPEC.md) refuses a request, first with kind `NOT_PERMITTED` for a mod not granted `deckit.mods`, then with kind `INVALID_ARGUMENT` where its arguments do not fit what it takes; then `mods.setPinned` and `mods.open` are refused at `call` with kind `INVALID_ARGUMENT` where `id` names no app, and nothing of them is done; and `mods.open` is refused as `launch` is refused, where it launches the app. Through a cut handle each is refused as [the shell](../DECKIT-29/SPEC.md) refuses a member of one, with kind `ENDED`.

`mods.open(id)` is a request of the mod that makes it to the app `id`, as [activation](../DECKIT-32/SPEC.md) fixes one: the app may activate as the request reaches it where the mod that makes it may.

## Interactions

- The handle `shell`, a request through it, its cut and `ENDED`, and the instance's `attach` and `detach`: [the shell](../DECKIT-29/SPEC.md).
- A field a layer adds, and `name`: [the bundle](../DECKIT-2/SPEC.md). `deckit.mods`: [the permissions](../DECKIT-3/SPEC.md). The catalog's order, `remove` and `erase`: [the catalog](../DECKIT-4/SPEC.md). A run's states, `launch`, `quit`, a background mod and its run launched again: [the lifecycle](../DECKIT-5/SPEC.md).
- A layer a host stacks, what it is handed, and what a layer keeps of a mod, named under `kept`: [the embedding](../DECKIT-22/SPEC.md).
- The desktop, its zoom area, the order of the windows, `makeKeyAndOrderFront()`, a minimized window and the overlay windows: [windows](../DECKIT-31/SPEC.md).
- Input, a request of one mod to another, who may activate, a mod held back and the attention it asks for, the key window, the active mod and the strip: [activation](../DECKIT-32/SPEC.md).
- The host key `dock`, the input `dock`, the look `dock`, and the base `shell`'s Dock and the person's hand on it: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- Every mod with an item. A mod that runs in the background to serve others, a switcher or a provider of notifications, would stand among the apps the person works in, with nothing to open.
- `activationPolicy` refused where it is neither `"regular"` nor `"accessory"`. The system judges no value of an added field, as [the bundle](../DECKIT-2/SPEC.md) fixes it; a field misspelled reads as left out, and an app is what a mod is unless it says otherwise.
- A mod kept again at the place it held before it was taken out. The Dock would remember a place for each mod it once kept, and the shell would keep, under `kept`, mods that are in no Dock.
- The ids a host hands filtered to the apps as the host app starts. A host may name a mod it installs later, which would then never be kept.
- The apps that run and are not kept in the catalog's order. An app the person opens would come in among the others, not after them, where they look for it.
- The active mark on the mod of an overlay window that has the keyboard. The Dock is drawn on the desktop, as the strip is, and would change as the person types in a window that floats outside the host app's window, though the desktop did not, as [activation](../DECKIT-32/SPEC.md) says of the strip.
- A click on an app that runs with no window open doing nothing, or launching it again. A mod whose windows the person closed would be reached from the Dock only by quitting it; `reopen()` lets the mod open what it opens first.
- `reopen()` called only of an instance with `attach`. A mod whose instance opens a window or a page of another from `reopen()` would need an `attach` that does nothing.
- A click and `mods.open(id)` doing different things. A mod that opens an app for the person would open it otherwise than the person does from the Dock.
- `mods.setPinned` and `mods.open` of a mod that is no app answering nothing. A mod would be told it kept or opened what has no item.

## Notes

**Note.** How the Dock looks is the implementation's: how wide it is out and the sliver of it that shows while it is in, when it comes out under the pointer and how long it waits, the line between the apps kept and the others, how an item, its icon and each mark are drawn, and the words of the menu's choices. The rules fix what the items are, their order, their marks, and what each does.

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. A bundle the system did not take having no item: the cases read the Dock of mods the system took, and [the catalog](../DECKIT-4/SPEC.md) holds what it lists of one. Where the Dock comes out: the look `dock` reads the items and not where they are drawn, and [windows](../DECKIT-31/SPEC.md) holds the zoom area that leaves the band out. An app that runs while its run is `launching` or `terminating`, or `notRunning` as it launches again: a case settles after each input, so no run is between two states as a look reads it, and no case's mod fails. The host app's window coming in front: the base `shell` is the only app on its stand-in for a screen, in front from its start, as [activation](../DECKIT-32/SPEC.md) says of `active()`. The menu's choice open: the input `dock` clicks the item, which the choice does as a click does. That a choice is offered only where the table says: the input `dock` comes to nothing for a choice the menu does not offer, which no expect matches. `mods.open` refused as `launch` is refused: the cases' apps launch, and [the lifecycle](../DECKIT-5/SPEC.md) holds what refuses a `launch`. That `reopen()` is called with no arguments and its answer is not read: no look reads what an instance is handed or answers. `ENDED`: no `call` reaches a cut handle, as [the shell](../DECKIT-29/SPEC.md) says of its cases.

**Note.** What this costs an implementation: it keeps, across starts, the ids of the mods kept in the Dock in one order, which a keep, a take-out, a drag and an erase change; it keeps the order in which the apps that run launched; it reads each app's fields as it draws the Dock; and it tells [activation](../DECKIT-32/SPEC.md) of a click as input and of `mods.open(id)` as a request before it opens the app.

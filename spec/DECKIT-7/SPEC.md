# DECKIT-7: The handle

Status: draft
Area: system

## Summary

A mod's code reaches the system only through its handle, `deckit`, the table [the entry](../DECKIT-6/SPEC.md)'s `start` is handed. This DECKIT fixes what the handle is as a whole: the members it holds, with the permission that guards each and the DECKIT that states it, the two members it states itself, the mod's `id` and `name`, and that every member is on the handle of every mod, whatever the mod is granted. It fixes what a request through the handle is: a promise, fulfilled with the request's answer or rejected with an error that carries the refusal's stage, kind and message, the refusal `INVALID_ARGUMENT` of an argument left out or of another type, and the order a request is refused in.

## Motivation

The DECKITs before this one fix requests, each with what it takes, answers and is refused with, and leave open how a mod's code makes one. A mod author writes one entry for every implementation, so each of these is a call two implementations could answer differently without a rule.

A mod granted nothing makes a request that `deckit.mods` guards:

```js
await deckit.mods.list();
```

On one implementation `deckit.mods` is not on its handle and the call throws with no kind, so the refusal `NOT_PERMITTED` that [the permissions](../DECKIT-3/SPEC.md) fix never reaches the code. On another the call answers a promise rejected with `NOT_PERMITTED`. A mod that tells a missing permission from a broken host by the kind works on the second and not on the first.

A mod granted `deckit.mods` makes these requests:

```js
await deckit.mods.launch(5);
await deckit.mods.remove("mod-b");
```

Where the number is read as the string `"5"`, the launch is refused with `NOT_INSTALLED`; where it is not, it is refused for its argument, with a kind or with none. The remove with `erase` left out removes `mod-b` and keeps what it stored on one implementation, and is refused on another. A mod that catches the error reads `kind` on one, and on another finds the refusal's stage written into its message, or not at all.

A mod written for a mod manager prints why a request failed: `plan` of a folder that is no bundle is refused at `read`, and `install` of a folder whose name is read in place at `call`. Where the error carries the kind alone, the manager cannot say whether the folder or the request was refused.

## Rules

### The handle

`deckit`, the handle `start` is handed, is a table of **members**, through which the run's code reaches the system. A member holds a value, or is a function that the code calls. The handle holds these members:

| member | what it is | guarded by | stated by |
|---|---|---|---|
| `id` | string: the `id` of the bundle the run is of | | here |
| `name` | string: the `name` of the bundle the run is of, as [the bundle](../DECKIT-2/SPEC.md) answers it | | here |
| `quit()` | the request that ends the mod's own run | | [the lifecycle](../DECKIT-5/SPEC.md) |
| `mods.list()`, `mods.plan(folder)`, `mods.install(folder)`, `mods.remove(id, erase)` | the requests `list`, `plan`, `install` and `remove` | `deckit.mods` | [the catalog](../DECKIT-4/SPEC.md) |
| `mods.launch(id)`, `mods.quit(id)`, `mods.relaunch(id)` | the requests `launch`, `quit` and `relaunch` | `deckit.mods` | [the lifecycle](../DECKIT-5/SPEC.md) |
| `mods.onChange(listener)` | being told that what `mods.list()` answers may have changed | `deckit.mods` | [the events](../DECKIT-12/SPEC.md) |
| `mods.pin(interface, mod)` | the owner of an interface, as a person pins it | `deckit.mods` | [the interfaces](../DECKIT-10/SPEC.md) |
| `mods.usage(id)` | what a mod has stored, in each place it is kept | `deckit.mods` | [the storage](../DECKIT-13/SPEC.md) |
| `mods.pick(options)` | a folder a person picks to install | `deckit.mods` | the embedding DECKIT |
| `mods.reveal(id)` | a mod's folder, shown outside the app | `deckit.mods` | the DECKIT of files outside the app |
| `mods.restartPending()`, `mods.restart()` | the mods that only a restart of the app finishes, and the restart | `deckit.mods` | the main process' DECKIT |
| `openExternal(url, options)` | the request that hands the host an address to open outside the app | `system.file-handlers`, for the address of a file | [opening outside the app](../DECKIT-8/SPEC.md) |
| `reveal(path)` | a file, shown outside the app | `system.file-handlers` | the DECKIT of files outside the app |
| `fileURL(path)`, `filePath(url)` | the address of a file, and the file of an address | | the DECKIT of files outside the app |
| `about()`, `active()` | what the host tells a mod of itself, and whether the app is in front | | the embedding DECKIT |
| `storage` | what the mod stores | | [the storage](../DECKIT-13/SPEC.md) |
| `events` | the events the mod sends and hears | | [the events](../DECKIT-12/SPEC.md) |
| `exports.register(exports)` | the exports the mod opens for its id | | [the connections](../DECKIT-9/SPEC.md) |
| `dependencies.reach(id)`, `dependencies.release(id)` | reaching a mod by its id, and letting it go | `deckit.reach-mods`, for `reach` | [the connections](../DECKIT-9/SPEC.md) |
| `exports.register(interface, exports)`, `exports.contributions(interface)`, `dependencies.onConnect(interface, listener)`, `dependencies.onRefuse(interface, listener)` | what the mod provides of an interface, and what it is connected to by one | | [the interfaces](../DECKIT-10/SPEC.md) |
| `keys.take(keystroke, run, options)` | a chord the mod takes | `deckit.app-keys` or `system.global-keys`, by where the chord works | the keys' DECKIT; the keys a mod declares, which the owner of `deckit/keys` takes: [the key bindings](../DECKIT-16/SPEC.md) |
| `clipboard.readText()`, `clipboard.writeText(text)` | what the person copied, read and replaced | `system.clipboard-read`, `system.clipboard-write` | the clipboard's DECKIT |
| `notifications.show(notification)` | a notification of the machine's | `system.notifications` | the notifications' DECKIT |
| `mainProcess(path)` | a module of the mod's started in the host's own process | `system.main-process` | the main process' DECKIT |
| `util` | matching text and moving paths | | the utilities' DECKIT |

A `.` names a member of the member before it, as [the case format](../DECKIT-1/SPEC.md)'s `member` does. A member's DECKIT fixes what it takes, answers and is refused with, and whether it is a request.

`id` and `name` are read as values. The run is of one bundle, as [the lifecycle](../DECKIT-5/SPEC.md) says, so each holds the same value for the whole run.

**Every member is on the handle of every mod**, whatever the mod is granted. A request a permission guards, made by a mod not granted it, is refused as [the permissions](../DECKIT-3/SPEC.md) say, and its member is on the handle all the same.

A layer a host stacks may hand each of its lifecycles a handle of its own with these members, as [the entry](../DECKIT-6/SPEC.md) stacks them. A framework a host stacks hands every lifecycle a handle of its own, in the table `frameworks` by the framework's name, as the entry stacks it. A request through either is the run's, as one through `deckit` is.

### Requests

A **request** is a call of a member that its DECKIT names a request. A request answers at once with a promise, never by throwing. The promise is fulfilled with the request's answer, or rejected with an **error** that carries its refusal:

| key of the error | value |
|---|---|
| `stage` | string: `"read"`, `"launch"` or `"call"`, the stage the request is refused at |
| `kind` | string, `[A-Z][A-Z_]*`: the refusal's kind |
| `message` | string: why, as the implementation says it |

What a request takes and answers are **values**: strings, numbers, booleans, and arrays and tables of values, and a request may answer nothing. A number is an integer or one with a decimal, and is finite. No value is null, and none is any other thing a mod's code holds, such as a function. A request's **signature** is its DECKIT's: the arguments it takes, in order, the type of each, and which it requires. An argument with no value, one not handed or handed as a null, is **left out**. A key of a table that the mod's code binds to no value is left out of the table the same way: the table is the one without the key. A table a request takes is given whole, with its keys and their types, the way a signature gives its arguments. A null anywhere else, in an array or a table of a value, makes it no value, and so does an element of an array with no value.

### How a request is refused

A request is refused with the first of these that is so, and nothing of it is done:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`;
2. at `call` with kind `INVALID_ARGUMENT`, where an argument the signature requires is left out, or an argument that is not left out is of another type than the signature gives, or a key of a table it takes is of another type than the table gives;
3. as the DECKIT that fixes the request refuses it.

An argument the signature does not require may be left out. An argument past those the signature takes, and a key of a table that the table does not give, are not read, and refuse nothing.

**Note.** What the request's own refusals read are its arguments, so they come once the arguments are known to be of their types, and a refusal such as `NOT_INSTALLED` is never the answer to an id handed as a number.

## Interactions

- `start`, which is handed the handle, and the layers a host stacks with their lifecycles: [the entry](../DECKIT-6/SPEC.md).
- The `id` and `name` a bundle answers, and the values of the manifest text: [the bundle](../DECKIT-2/SPEC.md).
- What a mod is granted, which request a permission guards, the refusal `NOT_PERMITTED` and that it is checked before anything else of a request: [the permissions](../DECKIT-3/SPEC.md).
- The requests `list`, `plan`, `install` and `remove`, their signatures and refusals: [the catalog](../DECKIT-4/SPEC.md). The requests `launch`, `quit` and `relaunch`, theirs, and a mod quitting itself: [the lifecycle](../DECKIT-5/SPEC.md).
- The input `call`, which has a case's mod make a request through its handle, and the look `opened`: [the case format](../DECKIT-1/SPEC.md).
- Every other member of the table: the DECKIT the table names for it.
- The handle `shell`, which the shell hands its own lifecycles: the shell's DECKITs.
- The handle `web`, which the web engine hands every lifecycle: the web engine's DECKITs.

## Alternatives considered

- A member left off the handle of a mod not granted the permission that guards it. A call of it would throw with no kind, and the refusal of [the permissions](../DECKIT-3/SPEC.md) could not reach the code, and the handle's shape would say a second time what the mod is granted.
- Integers alone as numbers. A mod keeps a width or a ratio as a number with a decimal, and would write it as a string, which each mod would read back its own way.
- A null as a value. A table that holds one, and one that leaves the key out, would be two values that say the same, and a null handed where an argument may be left out would be read as it on one implementation and refused on another.
- A key bound to no value refused. Code builds a table with a key it has nothing for, and a table written down leaves such a key out; refusing it would have a mod build the table again without the key, to say the same.
- An argument turned into the type the signature gives. A number handed for an id would be read as a string on one implementation and refused on another; refusing it is the answer every implementation can give alike.
- An argument past the signature refused. What a request does is fixed by the arguments it takes, and one past them changes nothing of it; refusing it would be a check of its own beside the call.
- The arguments checked before the permission. A mod not granted a request would learn from its refusals what the request takes, and the answer to a guarded request would depend on what the mod handed it.
- A refusal thrown at the call rather than carried by the promise. Code would handle a refusal in two places, and a request refused at once would be told apart from one refused later.
- An error that carries its kind alone. A request such as `plan` is refused at `read` for its folder and at `call` for the catalog, and a mod manager that tells a person why would read the stage out of the message.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That a request answers a promise and never throws, and that the error is rejected rather than thrown: [the case format](../DECKIT-1/SPEC.md) reads what a request comes to, and not how it came. The `message` of an error: no rule states one. An argument handed with no value: the manifest text has no null, so a case hands one only by leaving it out. That a layer's lifecycles may be handed a handle of their own: no case's host stacks a layer a case writes, so the shell's DECKITs hold it with the shell on. What a framework hands: no case's host stacks a framework, so the web engine's DECKITs hold it with the web engine on. What the members the table leaves to another DECKIT take and answer, and which permission guards each: that DECKIT's cases hold them.

**Note.** What this costs an implementation: every member is on every handle, and a guarded one checks its permission as it is called; every request answers a promise, `mods.list()` among them; the arguments are checked against the signature before the request goes on; and an error carries its `stage` beside its `kind` across every boundary it crosses.

# DECKIT-29: The shell

Status: draft
Area: shell

## Summary

The shell is the layer that gives a mod's run a GUI on the host app: windows, the Dock, the keys, the look, files outside the app. A host stacks it over the system and the web engine, and it stacks one lifecycle of its own over the system's. This DECKIT fixes that lifecycle, the members `attach(shell, deckit, frameworks)` and `detach()` of the instance it calls, when each is called and what each is handed; the handle `shell` as a whole, every member on it with its shape and the shell's DECKIT that fixes it, on the handle of every mod whatever the mod is granted; and the handle cut as its lifecycle ends, its requests and the members that throw refused with `ENDED`. The members themselves are fixed by [files outside the app](../DECKIT-30/SPEC.md), [windows](../DECKIT-31/SPEC.md) and the shell's later DECKITs: activation, the Dock, the shell's keys, the look, and regions and drops.

## Motivation

A mod with a window is written once for every host, and reaches the shell only through what its lifecycle is handed:

```js
class Mod {
    start(deckit) {
        this.deckit = deckit;
    }
    attach(shell) {
        this.window = shell.windows.open({ name: "main", content: this.view() });
    }
    detach() {
        this.window = null;
    }
}
```

The shell is a layer a host may stack or not: a host with no GUI runs mods with no shell, and a mod whose part is in the background has nothing for it to call. So what its lifecycle calls of the instance is the shell's, as [the entry](../DECKIT-6/SPEC.md) leaves a layer's lifecycle to its layer, and not the system's. Each of these is a run two implementations could answer differently without a rule:

- `attach` is called before the promise `start` answered is fulfilled on one implementation, and after it on another; the window opens over a mod whose `start` has not read its storage yet on the first.
- `attach` throws. One implementation fails the run; another leaves it `running` and never calls `detach()`, and what `attach` set going before it threw is never let go; a third calls `detach()`.
- A mod not granted `deckit.fonts` calls `shell.fonts.set({ size: 14 })`. On one implementation `fonts` is not on its handle and the call throws with no kind; on another it is refused with `NOT_PERMITTED`.
- `shell.windows.open(5)` throws a `TypeError` with no kind on one implementation, throws `INVALID_ARGUMENT` on another, and answers a promise rejected on a third.
- `attach` keeps the handle and throws. The run goes on, and code `attach` left calls `shell.active()`. One implementation answers whether the app is in front, for a lifecycle that has ended; another refuses with a kind the mod can tell.

## Rules

### The shell on a host

A host stacks the shell over the system and over [the web engine](../DECKIT-23/SPEC.md), as [the embedding](../DECKIT-22/SPEC.md) hands the layers it stacks, under the name `shell`. The shell stacks one lifecycle, the **shell's lifecycle**, over the system's lifecycle, as [the entry](../DECKIT-6/SPEC.md) stacks a layer's lifecycles. A host that does not stack the shell calls none of the members of the instance below, and hands no lifecycle the handle `shell`.

### The shell's lifecycle

The shell's lifecycle reads two members of the run's instance:

| member | signature | what it is |
|---|---|---|
| `attach` | `attach(shell, deckit, frameworks)`: answers nothing, or a promise fulfilled with nothing | starts the shell's lifecycle; `shell` is the handle under *The handle shell*, `deckit` a handle with the members of [the handle](../DECKIT-7/SPEC.md), and `frameworks` the table of the frameworks' handles, as [the entry](../DECKIT-6/SPEC.md) fixes it, each made for this lifecycle |
| `detach` | `detach()`: answers nothing, or a promise fulfilled with nothing | ends the shell's lifecycle |

Each may be left out, and a member that is not a function is read as one left out. What either answers, or fulfils its promise with, is not read.

The shell's lifecycle starts as [the entry](../DECKIT-6/SPEC.md) starts a layer's lifecycle, once the one under it has started, the system's among them, by calling `attach(shell, deckit, frameworks)`. It has started once `attach` has answered nothing, or once the promise it answered is fulfilled. An instance with no `attach` has started it at once, and its run runs as one with it.

The shell's lifecycle ends as [the entry](../DECKIT-6/SPEC.md) ends a layer's lifecycle, by calling the instance's `detach()`, with no arguments; an instance with no `detach` has ended it at once. So it ends as the run's end is asked, after each lifecycle over it and before the system's, whose `stop()` is called after `detach()` has ended; and it ends at once where `attach` throws or answers a promise that is rejected, while the run goes on, as the entry ends a layer's lifecycle whose start throws: `detach()` is called after an `attach` that failed, and no lifecycle over the shell's starts.

**Note.** `detach()` is called wherever `attach` was, whether it fulfilled or not, as `stop()` is called with no `start`, so that what `attach` set going before it threw is let go in one place. A mod that runs only in the background writes neither, and runs on a host with the shell as on one without it.

### The handle shell

`shell` is a table of **members**, as [the handle](../DECKIT-7/SPEC.md) fixes members, and holds these, each of the shape the table gives:

| member | what it is | shape | fixed by |
|---|---|---|---|
| `dialogs.chooseFolders(options)`, `reveal(path)` | the folders a person chooses, and a file shown where it lies | request | [files outside the app](../DECKIT-30/SPEC.md) |
| `windows.open(options)`, `windows.list()` | the mod's windows | answers at once | [windows](../DECKIT-31/SPEC.md) |
| `web.page(options)`, `web.window(options)` | the web pages the web engine offers the shell, laid in the mod's page and shown apart from it | answers at once | [web pages](../DECKIT-25/SPEC.md), and the window a page apart is shown in, [windows](../DECKIT-31/SPEC.md) |
| `active()` | whether the app is in front | request | [activation](../DECKIT-32/SPEC.md) |
| `mods.list()`, `mods.pinned()`, `mods.setPinned(id, pinned)`, `mods.open(id)` | the mods the Dock shows, and a mod opened as a person opens it | request | [the Dock](../DECKIT-33/SPEC.md) |
| `keys.take(keystroke, run, options)`, `keys.list()`, `keys.set(id, keystroke)`, `keys.reset(id)` | a chord the mod takes, and the shell's own keys | request | the shell's DECKIT of its keys |
| `keys.record(onKeystroke)` | the keys pressed in the mod's pages, as they are pressed | answers at once | the shell's DECKIT of its keys |
| `theme` | the look the shell draws with | value | the shell's DECKIT of the look |
| `theme.onChange(listener)` | being told that `theme` changed | answers at once | the shell's DECKIT of the look |
| `ui` | the components the shell draws with | value | the shell's DECKIT of the look |
| `fonts.set(change)` | the fonts the person reads in | request | the shell's DECKIT of the look |
| `styles.register(styles)` | the styles the mod lays over pages | registration | the shell's DECKIT of the look |
| `region(element, interface)`, `children.onChange(listener)`, `dropDestination(element, options)` | a place a child's view is shown in, being told the children changed, and the files a person drops | answers at once | the shell's DECKIT of regions and drops |
| `children.list(interface)` | the mod's children of an interface | request | the shell's DECKIT of regions and drops |
| `view.register(view)` | the mod's view, shown in a region of its parent's | registration | the shell's DECKIT of regions and drops |

The shapes are these:

- A **request** is one as [the handle](../DECKIT-7/SPEC.md) fixes a request through a layer's handle, and is refused as it says.
- A member that **answers at once** answers what its DECKIT fixes, never a promise, and throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one, at `call`: with kind `NOT_PERMITTED` as [the permissions](../DECKIT-3/SPEC.md) refuse what a permission guards, then with kind `INVALID_ARGUMENT` where what it is handed does not fit what it takes, then as its DECKIT refuses it.
- A **registration** answers nothing and is never refused. One handed what does not fit what it takes, or called by a mod not granted the permission that guards it, registers nothing. `view.register` and `styles.register` register for the shell's lifecycle alone: on the handle of any other lifecycle they register nothing.
- A **value** is read, as [the handle](../DECKIT-7/SPEC.md) reads `id`; what it holds is its DECKIT's, and the member beside it that tells of its change is named in the table.

**Every member is on the handle `shell` of every mod**, whatever the mod is granted. What a permission guards, called by a mod not granted it, is refused as [the permissions](../DECKIT-3/SPEC.md) say, and its member is on the handle all the same.

The shell hands the handle `shell` to `attach`, made for the shell's lifecycle, and to each lifecycle of a layer a host stacks over the shell, made for that lifecycle, as [the handle](../DECKIT-7/SPEC.md) lets a layer hand its lifecycles a handle of its own. A call through either is the run's, as one through the handle `attach` is handed.

**Note.** So what a host's layer over the shell calls is what a mod's own code calls, and the base `shell` of [the case format](../DECKIT-1/SPEC.md) reads the handle `shell` so.

### The handle cut

The handle `shell` is **cut** as the lifecycle ends that it was made for. What it made that calls back into the mod's code is cut with it, as [the entry](../DECKIT-6/SPEC.md) cuts a lifecycle's: what each member made, a window, a chord, a listener, a region, is cut as that member's DECKIT says.

A request through a cut handle, and a call of a member of it that answers at once, is refused with the first of these that is so, and nothing of it is done:

1. as it is refused through a handle that is not cut, at `call` with kind `NOT_PERMITTED` and then `INVALID_ARGUMENT`;
2. at `call` with kind `ENDED`;
3. as its DECKIT refuses it.

A registration through a cut handle registers nothing. A value of a cut handle is read as it is through one that is not cut.

**Note.** `attach` that throws ends the shell's lifecycle while the run goes on, and what its code left, a timer or a promise, may still hold the handle. The refusal tells that code that its lifecycle has gone, as [the web engine](../DECKIT-23/SPEC.md) tells it of a session handle cut.

## Interactions

- The lifecycles a layer stacks, their order, a start that throws or does not settle, the end and its 5 seconds, and when a run with layers has started: [the entry](../DECKIT-6/SPEC.md). The time a launch is given: [the lifecycle](../DECKIT-5/SPEC.md).
- The handle `deckit` and its members, a request and how it is refused, and a layer's handle of its own: [the handle](../DECKIT-7/SPEC.md). `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- The exports `exports.register` opens in the shell's lifecycle, and the lifecycles they reach by their place: [the connections](../DECKIT-9/SPEC.md).
- The layers a host stacks, and what a layer keeps of a mod: [the embedding](../DECKIT-22/SPEC.md).
- The handle `web` in `frameworks`, and a session handle cut: [the web engine](../DECKIT-23/SPEC.md). The pages the web engine offers the shell, which `web.page` and `web.window` answer: [web pages](../DECKIT-25/SPEC.md).
- A chord the owner of `deckit/keys` takes through `keys.take`: [the key bindings](../DECKIT-16/SPEC.md).
- The base `shell`, and the handle `shell` a `call` reads: [the case format](../DECKIT-1/SPEC.md).
- What each member takes, answers and is refused with, the permissions the shell defines and the requests they guard, the manifest fields the shell adds, the instance's `reopen()`, which the Dock calls: [files outside the app](../DECKIT-30/SPEC.md), for `dialogs.chooseFolders` and `reveal`, [windows](../DECKIT-31/SPEC.md), for `windows.open`, `windows.list`, a window's handle and `system.overlay-windows`, [activation](../DECKIT-32/SPEC.md), for `active()`, [the Dock](../DECKIT-33/SPEC.md), for `mods.list`, `mods.pinned`, `mods.setPinned`, `mods.open`, the fields `activationPolicy`, `icon` and `keywords` and `reopen()`, and the shell's later DECKITs, of its keys, the look, and regions and drops.

## Alternatives considered

- The shell's members on the handle `deckit`. A host with no shell would hand every mod members it cannot answer, and the system's handle would hold what one layer defines.
- `attach` and `detach` read only of an instance whose `start` exists, or the shell's lifecycle stacked only for a mod with a view or a window. Whether the shell's lifecycle runs would depend on members the system reads, and a mod that runs only in the background would differ on a host with the shell from one without it.
- No `detach()` after an `attach` that failed. What `attach` set going before it threw, a connection reached or a timer, would have no end of the mod's to let it go, and [the entry](../DECKIT-6/SPEC.md) ends a layer's lifecycle whose start fails as it ends any other.
- A member a permission guards left off the handle of a mod not granted it, as [the handle](../DECKIT-7/SPEC.md) sets aside for `deckit`. A call of it would throw with no kind, and the handle's shape would say a second time what the mod is granted.
- Every member a request, `windows.open` among them. A window's handle is what the mod lays its content in as it opens it, and a promise would leave a frame where the window is open and its handle not yet in hand; a member that answers at once and throws its refusal carries the same stage and kind.
- A cut handle that answers as one not cut. Code a lifecycle left behind would open windows and take chords for a lifecycle that has ended, each cut as it is made.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The handle cut and `ENDED`: the host's layer of [the case format](../DECKIT-1/SPEC.md), whose lifecycle is over the shell's, ends before it, so no `call` reaches a cut handle, and a case's mod that reported what its own call answered would be read in place of the system. That `deckit` and `frameworks` are made for the shell's lifecycle: a case reads no handle's identity, and the cases read that `attach` reaches each. That no lifecycle over the shell's starts where `attach` fails: every `call` of that run comes to nothing, which no expect matches. An `attach` that never settles: the launch it holds times out after 20 seconds, past what a step may take to settle. A value read, and what each member takes, answers and is refused with past the shapes: the shell's later DECKITs' cases read them. A registration that registers nothing: what it registers reaches no handle a case reads. `view.register` and `styles.register` on a lifecycle that is not the shell's: a `call` answers nothing either way.

**Note.** What this costs an implementation: the shell's lifecycle is stacked on every run, and `detach()` is called wherever the lifecycle ends, after an `attach` that failed or with no `attach` at all; every member is on every handle, and a guarded one checks the permission as it is called; each member of the handle knows its lifecycle, to refuse with `ENDED` once it has ended; and a layer over the shell is handed a handle of the same members.

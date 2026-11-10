# DECKIT-22: Embedding

Status: draft
Area: system

## Summary

A host app embeds the system: it hands the system, once and before the start, what the system is made of on that host, and answers what the system asks of it while the app runs. This DECKIT fixes what a host hands before the start and how a refusal of it is answered; that the owner of a standard interface a host ships is the one [the interfaces](../DECKIT-10/SPEC.md) pick, with nothing that holds the place for it; that an interface of a mod a host ships is an interface like any other, whose requests the system guards none of, and that a layer a host stacks names the permission that guards each request it handles; the quit a host hands the system, which the system holds until every run has ended, and the restart it hands the host; `about()`, what the host tells a mod of itself, unguarded; `mods.folders()`, the system's own folders, guarded by `deckit.mods`; and what a layer a host stacks owes of what it keeps of a mod: that `mods.usage(id)` names it under `kept`, and that `remove(id, erase)` erases it.

## Motivation

A mod is written once for every host, as [the specification](../README.md) says, and a host is built once for one system. What passes between the two is the same on every implementation only where it is fixed. Each of these is a place two implementations answer differently without a rule:

- A host ships the owner of `deckit/urls`, marked system, and a person installs another mod that provides it. The shipped one is refused as it is read after an update. On one implementation the installed one owns the interface until a pin says otherwise; on another the place is held for the shipped one, and `deckit/urls` has no owner.
- A host ships a mod that provides `host/accounts`, and a mod granted nothing uses it. One implementation hands the client the provider's exports; another refuses each call with `NOT_PERMITTED` for a permission the host never named.
- A person quits the app while a mod writes what must not be lost in its `stop()`. One implementation ends every run before the app quits; another quits at once, and the write is lost.
- A mod granted nothing calls `deckit.about()` and reads where the system keeps every mod's data. A mod reaches only as far as its permissions say, and on one implementation that is so and on another it is not.
- A person removes a mod with what it stored, and installs it again. One implementation's web engine still holds the mod's signed-in sessions, and the shell its window frames; another erased them, and `mods.usage(id)` named neither.

## Rules

### What a host hands the system

A host hands the system, once and before the start, each of these:

| what | what it is |
|---|---|
| the mod contract | the version, as [the bundle](../DECKIT-2/SPEC.md) writes one, the host runs mods with |
| the host's name | a string: the name a person knows the host app by, which `about()` answers as `name` |
| the system's own folder | one folder, the system's alone, where it keeps what it keeps across starts |
| the bundles it ships | each one's folder, marked system or not |
| a folder read in place | one folder, whose bundles the system reads where they lie |
| fields | the manifest fields the host adds, in order, as [the bundle](../DECKIT-2/SPEC.md) fixes them |
| permissions | the permissions the host defines, in order, as [the bundle](../DECKIT-2/SPEC.md) fixes them |
| layers | the layers it stacks over the system on each mod's run, in order, as [the entry](../DECKIT-6/SPEC.md) stacks them, each by its name; a layer handed under a name already handed is not stacked again |

A host may hand no bundle to ship, no folder read in place, no field, no permission and no layer.

A field or a permission the system does not take is refused as [the bundle](../DECKIT-2/SPEC.md) refuses it, with kind `FIELD` or `PERMISSION`, and the refusal is the answer to the start, at `call`, as [the case format](../DECKIT-1/SPEC.md) reads the step `start`.

**Note.** How a host hands each of these, and what an implementation answers to a host that hands something of another type, are the implementation's: the host is built with the implementation, and a mistake in it is found as the host app is built, not by a mod. What a mod meets of them, a field, a permission, a bundle shipped, is fixed by the DECKITs that read them.

### The owner of a standard interface

A host makes a mod the owner of a standard interface, `deckit/` and a name, by shipping, marked system, a bundle that provides it. From then on the owner is the one [the interfaces](../DECKIT-10/SPEC.md) pick, by the queue and the pin, and nothing holds the place for the bundle shipped: where it is refused at `read`, it provides nothing and leaves the queue, and another mod that provides the interface owns it and keeps its place while the shipped one is taken again.

Any mod may provide a standard interface, whether it is shipped or not and whether it is a system mod or not.

**Note.** A standard interface is one only its DECKIT defines, so what its owner does is fixed whoever provides it. A mod a person installs that provides one may own it: it does so first where the host ships none, and where the one shipped is refused. What the owner of an interface is granted is what [the bundle](../DECKIT-2/SPEC.md) grants any mod, so an owner that needs a privileged permission owns the interface and is refused that permission where it is not a system mod.

### Interfaces and requests of a host's own

An interface a mod a host ships provides is an interface like any other, as [the interfaces](../DECKIT-10/SPEC.md) fix one, and the system guards none of the requests made across it. What the provider does of the permissions its client is granted, which [the connections](../DECKIT-9/SPEC.md) hand it, is the provider's.

A layer a host stacks names the permission that guards each request it handles, where one does, as [the permissions](../DECKIT-3/SPEC.md) fix a guard, and the system refuses such a request, made by a mod not granted that permission, as they say.

### What the system asks of a host

**The quit.** The host hands the system each quit of the app as one the system can hold. The system holds it while any run has not ended, ends each run as [the lifecycle](../DECKIT-5/SPEC.md) ends a run as the app quits, and once every run is `notRunning` asks the host to quit the app again. A quit the host calls off while the system holds it leaves the runs that ended ended: none is launched again for it.

**Note.** A host that cannot hold a quit, such as a page a person closes, cannot keep what [the lifecycle](../DECKIT-5/SPEC.md) says of a quit, that the app quits once each run is `notRunning`: its runs end with the app, their ends not called. A mod writes what must not be lost as it changes, as [the entry](../DECKIT-6/SPEC.md) says, so such a host loses no more than a crash does.

**The restart.** `mods.restart()`, as [the handle](../DECKIT-7/SPEC.md) fixes it, hands the host a restart of the app. What the host does of it is the host's.

**A press.** A press of a notification of the machine is one the host hands the system, as [notifications of the machine](../DECKIT-21/SPEC.md) fix it.

### What the host tells a mod of itself

`about()`, a member of [the handle](../DECKIT-7/SPEC.md), is not a request: it answers at once a table of these keys, each a value as the handle fixes values. No permission guards it, and it is never refused.

| key | value |
|---|---|
| `name` | string: the host's name, as the host hands it |
| `app` | string: the host app's name and version, as the host app says them, or `""` where it says none |
| `version` | string: the version of the implementation |
| `source` | string: what the implementation says of the sources it was built from, or `""` |
| `engines` | array of tables `{ key, name, version }`, each a string: what the implementation runs on, the outermost first, `key` its name in lower case and `version` `""` where it has none |
| `home` | string: the absolute path of the folder of the person who runs the app, or `""` where the host has none |

Each value holds for the whole run.

**Note.** A mod shows these to a person: the app's name in a sentence, a path shortened against `home`, the versions in a report. None of them reaches what a mod is not granted. `about()` answers at once, so that a mod draws with it in one pass.

### The system's own folders

`mods.folders()`, a member of [the handle](../DECKIT-7/SPEC.md), is a request. It takes nothing, and answers a table of three keys, each a string, the absolute path of a place on the machine that the system keeps in its own folder:

| key | value |
|---|---|
| `mods` | the folder the system installs mods in, as [the catalog](../DECKIT-4/SPEC.md)'s `install` installs one |
| `data` | the folder that holds each mod's data folder, as [the storage](../DECKIT-13/SPEC.md) fixes a data folder |
| `log` | the file the system writes its log to |

`deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards it. It is refused at `call` with kind `NOT_PERMITTED`, where the mod is not granted `deckit.mods`, as they refuse a request a permission guards.

**Note.** The system's folders hold every mod's data and bundles, and the log what every mod did, so a mod reaches them only as far as `deckit.mods` lets it, which already reaches every mod. A mod that manages the mods shows a person where they lie.

### What a layer keeps of a mod

A layer a host stacks may keep something of a mod outside the mod's records, values and data folder. A layer that keeps anything of a mod `id` is named in what `mods.usage(id)` answers under `kept`, as [the storage](../DECKIT-13/SPEC.md) fixes it, and what it keeps is erased as [the catalog](../DECKIT-4/SPEC.md)'s `remove` erases what the mod stored, with `erase` true, so that a bundle installed again under `id` finds nothing of it. A layer that keeps something of several mods in one place, such as an order of them, keeps the mod's part of it, which is erased and leaves the rest as it was.

**Note.** Where a layer keeps it, and how it erases it, are the implementation's: in a store the system keeps for each mod, or in a place of the layer's own that it erases as it is told.

## Interactions

- The version of the mod contract, the fields and permissions a host adds, their refusals `FIELD` and `PERMISSION`, what a system mod is and a permission granted: [the bundle](../DECKIT-2/SPEC.md).
- A guard, the refusal `NOT_PERMITTED`, and `deckit.mods`: [the permissions](../DECKIT-3/SPEC.md).
- The bundles shipped, read in place and installed, their order, `install` and `remove` with `erase`: [the catalog](../DECKIT-4/SPEC.md).
- A run, its end as the app quits, and `notRunning`: [the lifecycle](../DECKIT-5/SPEC.md).
- The layers a host stacks and their lifecycles: [the entry](../DECKIT-6/SPEC.md).
- The handle, its members, requests, values and `mods.restart()`: [the handle](../DECKIT-7/SPEC.md).
- An address a host is handed to open outside the app: [opening outside the app](../DECKIT-8/SPEC.md). The clipboard: [the clipboard](../DECKIT-20/SPEC.md). A notification of the machine shown and a press of it: [notifications of the machine](../DECKIT-21/SPEC.md).
- What a provider is told of the permissions its client is granted: [the connections](../DECKIT-9/SPEC.md).
- The queue, the pin and the owner of an interface: [the interfaces](../DECKIT-10/SPEC.md).
- `mods.usage(id)`, `kept`, and what erasing what a mod stored takes away: [the storage](../DECKIT-13/SPEC.md).
- The standard interfaces whose owner a host ships: their DECKITs, from [the addresses](../DECKIT-14/SPEC.md) to [the notifications](../DECKIT-19/SPEC.md).
- The host a case sets up, the keys of `[host]` and what the system gives a host: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- The place of a standard interface's owner held for the bundle a host ships. An interface would have no owner while the bundle is refused, and every client of it would be refused for a bundle no person chose; the queue of [the interfaces](../DECKIT-10/SPEC.md) already answers who owns it then.
- Only a system mod, or only a shipped one, may provide a standard interface. A person could not replace the owner the host ships, and a host that ships none would have no way to gain one; what an owner is granted is already decided by what it is.
- The system guarding the requests of a host's interfaces by a permission the host names. An interface a mod provides is the mod's contract, which another mod may provide on another host; a guard the system holds would be one more place a host's word reaches into every mod, and the provider is told what its client is granted.
- The system's folders in `about()`. Any mod would read where every mod's data lies and what the log holds, which `deckit.mods` alone reaches.
- `about()` as a request. A mod draws a sentence with the app's name in one pass, and a promise would leave it drawing before it knows it.
- A quit the host does not hand the system to hold. The app would quit with runs whose ends were not called, and what [the lifecycle](../DECKIT-5/SPEC.md) says of a quit would hold on no host.
- What a layer keeps of a mod left out of `kept`, or kept after `remove` with `erase`. A person who erases a mod to start it afresh would find it signed in, its windows where they were.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. What a host hands as the host's name, the system's own folder and a layer: the runner sets up its own host, and no key of `[host]` names them. That another provider keeps its place as owner once the bundle shipped is taken again: a case's host is the same at each start, so a bundle shipped that is refused at `read` is refused at every start. The values `about()` and `mods.folders()` answer: each is the host's or the machine's, and no case knows it before it runs. The quit held, asked again and called off: steps settle one at a time, so no step comes while the app quits, and no input calls a quit off. The restart: a case runs in one app, which a restart would end. What a layer keeps of a mod, named under `kept` and erased: the cases of [the web engine](../DECKIT-23/SPEC.md) hold them, on the base `web` of [the case format](../DECKIT-1/SPEC.md), and the base `system` names none under `kept`, as the cases of [the storage](../DECKIT-13/SPEC.md) hold. That a layer names the guard of a request it handles: no case's host stacks a layer a case writes.

**Note.** What this costs an implementation: it holds a quit until every run has ended, as the host hands it; it answers `about()` at once, with nothing of its own folders; and each layer it stacks that keeps something of a mod answers whether it does, and erases it, outside the mod's own storage.

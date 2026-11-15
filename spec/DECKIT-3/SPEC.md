# DECKIT-3: Permissions

Status: draft
Area: system

## Summary

A permission is what a mod is granted so that the system, a layer on it or the host does a request the permission guards. [The bundle](../DECKIT-2/SPEC.md) fixes how a permission is defined, asked for and answered. This DECKIT fixes what a mod is granted, how a request is refused when the mod making it is not granted the permission that guards it, and the permissions the system defines itself: their ids, names, what each one grants, which are privileged, and the order they are defined in.

## Motivation

What a mod is granted decides what it can do, and a mod author writes one bundle for every implementation. Each of these is a bundle or a request two implementations could answer differently without a rule.

A mod read in place asks for a permission the system defines:

```toml
id = "mod-a"
version = "1.0.0"
api = "1.0.0"
main = "main.js"

[permissions]
"deckit.mods" = "Lists the mods and adds one from a folder."
```

Whether `deckit.mods` is usable on every host, what it is listed as, and whether a mod that is not a system mod may ask for it are the system's to say, since the system defines it. Left to each implementation, the mod is taken on one host and refused on another, or listed with what it may do on one and with nothing on the other.

The same mod, granted nothing, asks that another mod launch. The check sits where the request is handled, inside the system, so a host cannot make two implementations agree on it: one could refuse with one kind, another with another, and a third could let it through.

A host that defines `deckit.mods` itself defines an id twice, which [the bundle](../DECKIT-2/SPEC.md) refuses as the host app starts. That holds alike only where every implementation defines the same ids.

## Rules

### What a mod is granted

A mod is granted exactly the permissions that the system answers usable for the bundle it runs of the mod, as [the bundle](../DECKIT-2/SPEC.md) answers them. A permission is granted to a mod only: what a host asks through what the system gives a host is guarded by no permission.

### A request a permission guards

The DECKIT that fixes a request the system or a layer handles names the permission that guards it, where one does, and a layer a host stacks names the permission that guards each request it handles, as [the embedding](../DECKIT-22/SPEC.md) says. A call of a request is guarded by one permission at most. The DECKIT that fixes the request may have its arguments pick which, and a call is guarded by none only for the arguments that DECKIT names unguarded. A permission guards what the DECKIT that defines it names, and nothing else: requests, or what the system or a layer does for a mod's pages, such as a file loaded in them.

A request a permission guards, made by a mod that is not granted that permission, is refused at `call` with kind `NOT_PERMITTED`, whichever of the system, a layer or the host defines the permission, and nothing of the request is done. The permission is checked before anything else of the request but reading the arguments that pick it, so a mod not granted it is refused with `NOT_PERMITTED` whatever else the request would be refused with.

### The system's own permissions

The system defines these permissions, as [the bundle](../DECKIT-2/SPEC.md) defines a permission:

| id | name | description | privileged |
|---|---|---|---|
| `deckit.mods` | `Mods` | `It can see every mod and the system's folders, launch and quit them, add one from a folder and delete installed ones, with what they stored.` | `true` |
| `deckit.reach-mods` | `Reach Mods` | `It connects to any mod by its id, which launches the mod if it does not run.` | `true` |
| `deckit.system-services` | `System Services` | `It can act on other mods through the system's services: run their commands, change their keys and settings, and choose which mod opens an address.` | `true` |

Each `name` and `description` is the text the table gives, every code point of it.

The system's other DECKITs define permissions of their own, each in a table of this shape. The system defines its own before any layer or the host defines a permission: this table's first, in its order, and then each other DECKIT's, by the DECKITs' numbers, each in its table's order.

An id that only a job no bundle gave holds, such as `deckit.seat` of [users and seats](../DECKIT-38/SPEC.md), is in none of these tables: no manifest is read against it, and no mod is granted it.

**Note.** A permission's `name` and `description` are what a person reads before a mod is installed, and they are fixed to the code point so that a mod asks for the same thing on every host.

## Interactions

- How a permission is defined, asked for, refused when privileged, answered usable or not, and ordered in the answer: [the bundle](../DECKIT-2/SPEC.md).
- The requests `deckit.mods` guards: listing, installing and removing mods, in [the catalog](../DECKIT-4/SPEC.md); reading each mod's latest run, and launching and quitting another mod, in [the lifecycle](../DECKIT-5/SPEC.md); reading each interface and pinning its owner, in [the interfaces](../DECKIT-10/SPEC.md); reading the system's own folders, in [the embedding](../DECKIT-22/SPEC.md); and installing a folder once the mods it depends on are installed, in [the packages](../DECKIT-18/SPEC.md).
- The request `deckit.reach-mods` guards, reaching a mod by its id, and what a service is told of the permissions its client is granted: [the connections](../DECKIT-9/SPEC.md).
- Hearing the events of any mod, which `deckit.reach-mods` lets a mod do: [the events](../DECKIT-12/SPEC.md).
- The requests `deckit.system-services` guards: the DECKITs of the standard interfaces, `deckit/*`, such as [the addresses](../DECKIT-14/SPEC.md), [the commands](../DECKIT-15/SPEC.md), [the key bindings](../DECKIT-16/SPEC.md) and [the configuration](../DECKIT-17/SPEC.md).
- The handle a mod makes its requests through: [the handle](../DECKIT-7/SPEC.md). The input that hands a case's request: [the case format](../DECKIT-1/SPEC.md).
- The permission `system.file-handlers` and the request it guards, for the address of a file: [opening outside the app](../DECKIT-8/SPEC.md).
- The permissions the web engine defines and what they guard, a request or what a mod's web pages load: [the web engine](../DECKIT-23/SPEC.md).
- The permissions the shell defines and the requests they guard: the shell's DECKITs, `system.overlay-windows` and `deckit.panel-windows`, which guard a window at the levels `overlay` and `panel`, among them, in [windows](../DECKIT-31/SPEC.md), and `deckit.app-keys`, `system.global-keys` and `deckit.shell-keys`, which guard the chords a mod takes and the shell's keys, in [the shell's keys](../DECKIT-34/SPEC.md), and `deckit.styles` and `deckit.fonts`, which guard the styles a mod lays over the pages of the app and setting the person's fonts, in [the look](../DECKIT-35/SPEC.md).

## Alternatives considered

- A permission's reach, whether what it grants lies past the app or inside it, as a key of its definition and of what is answered. What a permission grants is its `description`, written by whatever defines it, and the system decides nothing by how far a permission reaches. A key beside `description` would say part of `description` a second time, in a few words every definition must fit.
- A permission granted as the request it guards is first made, and asked of a person then. What a mod may do would be known only once it runs, and the bundle read before any of its code runs could no longer say it.
- A prefix of ids kept for the system, `deckit.`, refused to a layer or the host. The start already refuses an id defined twice, which covers every id the system defines, and a kept prefix would be a second rule for the same thing.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That what a host asks is guarded by no permission: every case's host starts the app, quits it and looks, granted nothing. That a call is guarded by one permission at most: each DECKIT's table names one permission for each call, held by reading them, and the cases of [opening outside the app](../DECKIT-8/SPEC.md) hold one its arguments pick. That a layer a host stacks names the guard of each request it handles: no case's host stacks a layer a case writes, as [the embedding](../DECKIT-22/SPEC.md) fixes the layers a host stacks.

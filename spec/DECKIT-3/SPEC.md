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

A host that defines `deckit.mods` itself gives one id two definitions, and which one a mod is granted cannot be left to each implementation either.

## Rules

### What a mod is granted

A mod is granted exactly the permissions that the system answers usable for the bundle it runs of the mod, as [the bundle](../DECKIT-2/SPEC.md) answers them. A permission is granted to a mod only: what a host asks through what the system gives a host is guarded by no permission.

### A request a permission guards

The DECKIT that fixes a request the system or a layer handles names the permission that guards it, where one does. A permission guards the requests named for it and no others.

A request a permission guards, made by a mod that is not granted that permission, is refused at `call` with kind `NOT_PERMITTED`, whichever of the system, a layer or the host defines the permission, and nothing of the request is done.

### The system's own permissions

The system defines these permissions, as [the bundle](../DECKIT-2/SPEC.md) defines a permission:

| id | name | description | privileged |
|---|---|---|---|
| `deckit.mods` | `Mods` | `It can see every installed mod, launch and quit them, add one from a folder, which gets every permission it asks for, and delete installed ones, with what they stored.` | `false` |
| `deckit.reach-mods` | `Reach Mods` | `It connects to any mod by its id, which launches the mod if it does not run.` | `true` |
| `deckit.system-services` | `System Services` | `It can act on other mods through the system's services: run their commands, change their keys and settings, and choose which mod opens an address.` | `true` |

Each `name` and `description` is the text the table gives, every code point of it.

The system's other DECKITs define permissions of their own, each in a table of this shape. The system defines its own before any layer or the host defines a permission: this table's first, in its order, and then each other DECKIT's, by the DECKITs' numbers, each in its table's order.

**Note.** A permission's `name` and `description` are what a person reads before a mod is installed, and they are fixed to the code point so that a mod asks for the same thing on every host.

## Interactions

- How a permission is defined, asked for, refused when privileged, answered usable or not, and ordered in the answer: [the bundle](../DECKIT-2/SPEC.md).
- The requests `deckit.mods` guards: listing, installing and removing mods, in the catalog's DECKIT, and launching and quitting another mod, in the lifecycle's DECKIT.
- The requests `deckit.reach-mods` guards, reaching a mod by its id, and what a mod providing an interface is told of the permissions its client is granted: the connections' DECKIT.
- The requests `deckit.system-services` guards: the DECKITs of the standard interfaces, `deckit/*`.
- The handle a mod makes its requests through, and the input that hands a case's request: the handle's DECKIT.
- The permissions the shell defines and the requests they guard: the shell's DECKITs.

## Alternatives considered

- A permission's reach, whether what it grants lies past the app or inside it, as a key of its definition and of what is answered. What a permission grants is its `description`, written by whatever defines it, and the system decides nothing by how far a permission reaches. A key beside `description` would say part of `description` a second time, in a few words every definition must fit.
- A permission granted as the request it guards is first made, and asked of a person then. What a mod may do would be known only once it runs, and the bundle read before any of its code runs could no longer say it.
- A prefix of ids kept for the system, `deckit.`, refused to a layer or the host. The start already refuses an id defined twice, which covers every id the system defines, and a kept prefix would be a second rule for the same thing.

## Notes

**Note.** Three sentences above are held by no case under `conformance/`, and each waits on what will hold it. That a request a permission guards is refused, and that a host's requests are guarded by none, wait on the handle's DECKIT, which adds to [the case format](../DECKIT-1/SPEC.md) the input that hands a request: no input the format has now is one a permission guards. That the other DECKITs' permissions follow this table's waits on the first of them to define one.

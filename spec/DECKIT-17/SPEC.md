# DECKIT-17: Configuration

Status: draft
Area: system

## Summary

`deckit/configuration` is the standard interface through which a mod keeps its settings. A mod declares each setting in its manifest, as an entry to `deckit/configuration`, with its type, its title, the values it takes and its default. Any client reads, sets and hears the settings of its own mod; a client granted `deckit.system-services` lists every mod's settings and sets one of another mod's. The interface's owner keeps what is set as the host app starts again. This DECKIT fixes what is declared and when an entry is left out, the values a setting takes and what it reads as, the requests `get`, `values`, `set`, `onChange`, `list` and `setOf` with their answers and refusals, and what a listener hears. Which mod ships as the owner is the embedding's.

## Motivation

An editor declares how wide a tab is:

```toml
[[contributes."deckit/configuration"]]
key = "tab-size"
type = "number"
title = "Tab size"
default = 4
minimum = 1
maximum = 8
```

and a settings mod, written once for every mod, shows it to a person, who sets it to 2. Without a rule, the editor reads `2` on one implementation and `"2"` on another, which read the field's text; a set of `9` is kept on one and refused on another; the editor hears the change on one and reads it only as it starts on another; and what was set is gone on a third as the app starts again. A mod could keep its settings in its own storage, and then no settings mod could list them, nor set one while the mod is not running. The entry a mod declares and what each request answers are the system's to fix, not the owner's.

## Rules

### What a mod declares

A mod declares its settings as entries to `deckit/configuration`, under `contributes` as [the bundle](../DECKIT-2/SPEC.md) reads it, and need not use the interface. Each entry is a table:

| key | takes | required | what it is |
|---|---|---|---|
| `key` | string: a `setting-key`, below | yes | the setting's key among the mod's |
| `type` | `"string"`, `"number"` or `"boolean"` | yes | the type of the values it takes |
| `title` | string, not blank | yes | the name a person reads it by |
| `description` | string | no | more about it, for a person |
| `default` | a value it takes | no | what it reads as where nothing is set; left out, it reads as nothing |
| `minimum`, `maximum` | number, beside `"number"` alone | no | the least and the most it takes; left out, no bound |
| `oneOf` | non-empty array of tables `{ const, title }`, `const` a value it takes and `title` a string, not blank | no | the values it takes, each with the name a person reads it by; left out, any of its type within its bounds |

```
setting-key = 1*( ALPHA / DIGIT / "_" / "-" )
```

A string is **blank** where it holds nothing but white space code points. A key of the table that the table above does not name is not read, and is handed on as written in `list`. An entry is **left out** where it is not a table, where a key does not take what the table gives, where its `minimum` is above its `maximum`, or where its mod declared its `key` in an entry before it that is not left out. Entries are read in [the catalog's](../DECKIT-4/SPEC.md) order and then the order written.

A **setting** is an entry not left out. A value **is of** a type where it is a string for `"string"`, a number for `"number"`, and a boolean for `"boolean"`. A setting **takes** a value where it is of its type, is not below its `minimum` nor above its `maximum` where it writes them, and, where it writes `oneOf`, is the `const` of one of them, a value being another as [the case format](../DECKIT-1/SPEC.md) matches values.

### What a setting reads as

A setting **reads as** the value kept for it, where one is kept and the setting takes it, and else its `default`, or nothing where it writes none. A value is kept for a setting by `set` and `setOf`, and a set with no value keeps none.

The owner keeps each value in its own storage, as [the storage](../DECKIT-13/SPEC.md) fixes it, by the mod's id and the setting's key, so that it stands as the host app starts again. A value kept for a key its mod no longer declares is kept, and read again as the key comes back.

### The requests

The owner of `deckit/configuration`, as [the interfaces](../DECKIT-10/SPEC.md) fix one, provides major `1`, opens its exports for every client, in its start, and its exports hold these members on every connection, each a function a call of which is a request, as [calls across a connection](../DECKIT-11/SPEC.md) fix one. The client's **own mod** is the one the credential the connection hands the owner names, and its permissions are the client's:

| member | takes | answers | guarded by |
|---|---|---|---|
| `get(key)` | `key`, a string, required | what the own mod's setting `key` reads as, or nothing where it reads as nothing | |
| `values()` | nothing | a table: each key of a setting the own mod declares, bound to what it reads as, and a key that reads as nothing left out | |
| `set(key, value)` | `key`, a string, required; `value`, a value, not required | `value` kept for the own mod's setting `key`, or none kept where it is left out, and what it reads as now, as `get` answers it | |
| `onChange(listener)` | `listener`, a function, required | nothing, once `listener` hears the own mod's settings, below | |
| `list()` | nothing | a table `{ mods, refused }`, below | `deckit.system-services` |
| `setOf(mod, key, value)` | `mod`, a string, required: a mod's id; `key` and `value` as `set` | as `set`, for the setting `key` of the mod `mod` | `deckit.system-services` |

A request is refused with the first of these that is so, at `call`:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, with kind `NOT_PERMITTED`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, with kind `INVALID_ARGUMENT`;
3. for `get`, `set` and `setOf`, with kind `NOT_DECLARED`, where the mod, the own mod or `mod`, declares no setting `key`;
4. for `set` and `setOf`, with kind `INVALID_ARGUMENT`, where `value` is written and the setting does not take it.

### What a listener hears

Each time what a setting of a mod reads as changes by a `set` or a `setOf`, each listener `onChange` was handed on a connection of a client whose own mod is that mod is called with the setting's key and what it reads as now, left out where it reads as nothing, until that connection ends. A set that leaves what the setting reads as as it was calls no listener. What a listener throws is told no one.

### What list answers

`mods` is an array, one table `{ mod, items }` for each mod that declares a setting, in [the catalog's](../DECKIT-4/SPEC.md) order: `mod` the table `{ id, name }` of its bundle, as [the bundle](../DECKIT-2/SPEC.md) answers them, and `items` an array, one table `{ entry, value }` for each of its settings, in the order written, `entry` the entry as written and `value` what it reads as, left out where it reads as nothing.

`refused` is an array, one table `{ mod, entry, problem }` for each entry left out, in the order read: `mod` the table `{ id, name }` of the declaring mod, `entry` the entry as written, and `problem` a string, why, as the implementation says it.

## Interactions

- `contributes`, an entry as a value, and a bundle's `id` and `name`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.system-services` and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- The catalog's order: [the catalog](../DECKIT-4/SPEC.md).
- `INVALID_ARGUMENT`, and what a value is: [the handle](../DECKIT-7/SPEC.md).
- The owner of an interface, the connection to it and when it ends, and the entries declared to it: [the interfaces](../DECKIT-10/SPEC.md). A call of a member of the exports, a function handed across a connection, and a refusal: [calls across a connection](../DECKIT-11/SPEC.md).
- Where the owner keeps what is set: [the storage](../DECKIT-13/SPEC.md).
- How a case matches values, the owner a case's host ships, the call of what a listener was handed, and what a listener heard: [the case format](../DECKIT-1/SPEC.md).
- Which mod a host ships as the owner: the embedding DECKIT.

## Alternatives considered

- Every mod keeping its settings in its own storage. No settings mod could list them or set one while the mod is not running, and every mod would read its values its own way.
- A client reading and setting every mod's settings. A mod would read what another mod keeps; reading and setting another mod's settings is what `deckit.system-services` guards.
- A value of another type read as one the setting takes, such as `"2"` as `2`. A value is never read as another, as [the handle](../DECKIT-7/SPEC.md) fixes it.
- A value the setting no longer takes, kept from before its entry changed, read as it is. A setting would read as a value its own entry says it does not take; it reads as its default until it is set, and the value stays kept.
- A set to the default keeping nothing. A setting set to what its default is now would move with a later default, which the person did not choose; a set with no value is how a person asks for the default.
- A kind of the interface's own for a key not declared and a value not taken. A kind names what went wrong; a value the setting does not take is an argument that does not fit.
- `null` for a setting with no value, and a set of `null` to unset. A value has no null, as [the handle](../DECKIT-7/SPEC.md) fixes it; a key left out, and a value left out, say the same.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `problem`: no rule states its text. That `get` answers nothing, and that a listener is called with no value, for a setting that reads as nothing: [the case format](../DECKIT-1/SPEC.md) reads an answer of nothing as no answer to compare, and a value left out of what a listener heard as no value; `values` and `list` hold it. A value kept for a key no longer declared, or that the setting no longer takes: no input of the case format changes a bundle. That a listener hears no more once its connection ends, and what it throws: no input of the case format ends one connection alone. `description`, and each way an entry is left out but those the cases write: each is a key a case reads the same way. That the owner opens its exports in its start and for every client: every case reaches it so.

**Note.** What this costs an implementation's owner: it reads the entries declared to `deckit/configuration` on each request, and keeps a listener for each connection that handed one.

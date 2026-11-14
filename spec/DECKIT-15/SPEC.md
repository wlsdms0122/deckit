# DECKIT-15: Commands

Status: draft
Area: system

## Summary

`deckit/commands` is the standard interface through which a mod runs what another mod does on request. A mod declares its commands in its manifest, as entries to `deckit/commands`, each with the args it takes, and runs each one on the exports it opens for its id. A client granted `deckit.system-services` lists every mod's commands, runs one on the mod that declares it, which launches it where it does not run, and asks that mod for the values to offer for an arg as a person types it. This DECKIT fixes what is declared and when an entry is left out, the args a command takes and when they fit, the requests `list`, `run` and `complete` with their answers and refusals, and what the declaring mod is called with. Which mod ships as the owner is the embedding's.

## Motivation

A switcher offers the person every mod's commands, a key map runs one by a key, and a notification runs one as it is pressed; none of them knows the mods it offers. `mod-b` declares a command:

```toml
[[contributes."deckit/commands"]]
id = "open-event"
title = "Open Event"
params = { type = "object", properties = { start = { type = "integer", title = "Start" } }, required = ["start"] }
```

and a switcher runs it:

```js
await commands.run("mod-b", "open-event", { start: 1.5 });
```

One implementation hands `mod-b` a start of `1.5`, another refuses it, a third rounds it. Where `mod-b` is not running, one launches it and another refuses the run. Where `mod-b` throws an error of kind `BUSY`, one hands the switcher that kind and another an error with none. A command written once for every host, and a switcher written once for every mod, each need these answers fixed by the system, not by the owner a host ships.

## Rules

### What a mod declares

A mod declares its commands as entries to `deckit/commands`, under `contributes` as [the bundle](../DECKIT-2/SPEC.md) reads it, and need not use the interface. Each entry is a table:

| key | takes | required | what it is |
|---|---|---|---|
| `id` | string: a `command-id`, below | yes | the command's id among the mod's |
| `title` | string, not blank | yes | the name a person reads it by |
| `keywords` | array of strings | no | more words it is found by; left out, none |
| `params` | table: a `schema`, below, whose `type` is `"object"` | no | the args it takes; left out, it takes none |

```
command-id = 1*( ALPHA / DIGIT / "_" / "-" )
```

A string is **blank** where it holds nothing but white space code points. An entry is **left out** where it is not a table, where a key does not take what the table gives, or where its mod declared its `id` in an entry before it that is not left out. Entries are read in [the catalog's](../DECKIT-4/SPEC.md) order and then the order written. A key the table does not give is not read.

### The args a command takes

A **schema** is a table of these keys, and no others:

| key | takes | what it says of a value that fits |
|---|---|---|
| `type` | `"array"`, `"boolean"`, `"integer"`, `"number"`, `"object"` or `"string"` | it is an array, a boolean, a number with no fraction, a number, a table or a string |
| `properties` | table: a name → a schema | where it is a table, each key of it named here fits that schema |
| `required` | array of strings | where it is a table, it holds each of these keys |
| `items` | a schema | where it is an array, each element fits the schema |
| `enum` | non-empty array of values | it is one of them |
| `oneOf` | non-empty array of tables `{ const, title, description }`, `const` a value and required | it is the `const` of one of them |
| `title`, `description` | any value | nothing: they are for a person |

A value **is** another where they match as [the case format](../DECKIT-1/SPEC.md) matches values. A value fits a schema where it says each of what the keys written say. A key of a table that `properties` does not name is not read.

A command's **args** are a table. The args of a command that declares `params` fit where they fit its `params`, `{}` where they are left out. The args of one that declares none fit where they are left out or hold no key.

### The requests

The owner of `deckit/commands`, as [the interfaces](../DECKIT-10/SPEC.md) fix one, provides major `1`, opens its exports for every client, in its start, and its exports hold these members on every connection, each a function a call of which is a request, as [calls across a connection](../DECKIT-11/SPEC.md) fix one. `deckit.system-services` guards each, as the client is granted it by the credential the connection hands the owner:

| member | takes | answers |
|---|---|---|
| `list()` | nothing | a table `{ commands, refused }`, below |
| `run(mod, id, args)` | `mod`, a string, required: the declaring mod's id; `id`, a string, required: the command's; `args`, a table of values, not required | what the mod's `runCommand` answered, a value, or nothing where it answered nothing |
| `complete(mod, id, param, partial, args)` | `mod`, `id`, as `run`; `param`, a string, required: a key of the command's `params.properties`; `partial`, a string, not required, `""` where left out: what the person typed of it; `args`, a table of values, not required: the args filled so far | what the mod's `completeCommand` answered, an array, or `[]` where the mod opens no `completeCommand` |

A request is refused with the first of these that is so, at `call`:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, with kind `NOT_PERMITTED`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, with kind `INVALID_ARGUMENT`;
3. for `run` and `complete`, with kind `NOT_DECLARED`, where `mod` declares no command `id` that `list` answers;
4. with kind `INVALID_ARGUMENT`: for `run`, where `args` do not fit the command, and for `complete`, where `param` is no key of the command's `params.properties`;
5. for `run` and `complete`, with the kind the reach of `mod` is refused with, as [the connections](../DECKIT-9/SPEC.md) fix them;
6. for `run`, with kind `NOT_EXPORTED`, where the exports `mod` opens for its id have no `runCommand`;
7. as [calls across a connection](../DECKIT-11/SPEC.md) refuse a call of `runCommand` or `completeCommand`: with the kind it threw, or `REFUSED`;
8. with kind `REFUSED`, where `runCommand` answered a function, or one is in what it answered, or `completeCommand` answered what is not an array of values.

### What the declaring mod is called with

`run` and `complete` reach `mod` by its id, as [the connections](../DECKIT-9/SPEC.md) say, which launches it where it does not run, call it on the exports it opens for its id, and let it go once it has answered:

| member of the mod's exports | called with | answers |
|---|---|---|
| `runCommand(id, args)` | the command's id, and `args`, `{}` where they are left out | the command's result, a value, or nothing |
| `completeCommand(id, param, partial, args)` | the command's id, `param`, `partial`, and `args`, `{}` where they are left out | an array of the values to offer, each a table `{ value, title, hint, keywords }`: `value` the arg's value, `title` a string a person reads, `hint` a string and `keywords` an array of strings, each left out where the mod has none |

`complete` answers what `completeCommand` answered, as it answered it.

**Note.** The owner reaches a mod by its id, which [the connections](../DECKIT-9/SPEC.md) guard with `deckit.reach-mods`; an owner is shipped granted what it needs. A mod that runs a command of its own calls its own code.

### What list answers

`commands` is an array, one table for each entry not left out, in the order read:

| key | value |
|---|---|
| `mod` | table `{ id, name }`: the declaring mod's, as [the bundle](../DECKIT-2/SPEC.md) answers them |
| `id`, `title` | as written |
| `keywords` | as written; `[]` where it is not written |
| `params` | as written; left out where it is not written |

`refused` is an array, one table `{ mod, entry, problem }` for each entry left out, in the order read: `mod` the table `{ id, name }` of the declaring mod, `entry` the entry as written, and `problem` a string, why, as the implementation says it.

## Interactions

- `contributes`, an entry as a value, and a bundle's `id` and `name`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.system-services`, `deckit.reach-mods` and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- The catalog's order: [the catalog](../DECKIT-4/SPEC.md).
- `INVALID_ARGUMENT`, and what a value is: [the handle](../DECKIT-7/SPEC.md).
- Reaching a mod by its id, the refusals of a reach, and `NOT_EXPORTED`: [the connections](../DECKIT-9/SPEC.md).
- The owner of an interface, the connection to it, and the entries declared to it: [the interfaces](../DECKIT-10/SPEC.md). A call of a member of the exports, and the kind its refusal crosses with: [calls across a connection](../DECKIT-11/SPEC.md).
- How a case matches values, the owner a case's host ships, and the call of what a listener was handed: [the case format](../DECKIT-1/SPEC.md).
- A key that runs a command as its chord is pressed: [the key bindings](../DECKIT-16/SPEC.md).
- Which mod a host ships as the owner, and that nothing holds its place: [the embedding](../DECKIT-22/SPEC.md).

## Alternatives considered

- Every mod running its own commands on an interface of its own. A switcher would have to know each mod and each interface, and could not list a mod's commands before it launches it.
- Commands listed only from the mods that run. A command would come and go as its mod launches and quits, and a key bound to it would do nothing while the mod is not running.
- The args checked by the declaring mod alone. Every mod would check them its own way, and a client could not tell args that do not fit from a command that failed.
- A kind of the interface's own for args that do not fit, and one for a command not declared. A kind names what went wrong; args that do not fit what the command takes are arguments that do not fit, as [the handle](../DECKIT-7/SPEC.md) names them, and an exports with no `runCommand` is what [the connections](../DECKIT-9/SPEC.md) name `NOT_EXPORTED`.
- `complete` answering `[]` for a mod it does not reach. A client could not tell a mod that offers nothing from one that cannot run, which `run` tells it.
- The whole of JSON Schema for `params`. Two owners would read the keywords they do not share differently; the subset is what a person fills in, and each of its keys says one thing.
- A client not granted `deckit.system-services` left without the interface's exports. Its members would not be on the exports, and the refusal of [the permissions](../DECKIT-3/SPEC.md) could not reach its code, as [the handle](../DECKIT-7/SPEC.md) sets aside for a member of the handle.
- `null` for no params and for a command that answers nothing. A value has no null, as [the handle](../DECKIT-7/SPEC.md) fixes it; a key left out, and an answer of nothing, say the same.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `problem`: no rule states its text. That `run` answers nothing where `runCommand` answered nothing, and the refusal `REFUSED` of what holds a function: [the case format](../DECKIT-1/SPEC.md) reads an answer of nothing as no answer to compare, and a case's command answers values. That `complete` is refused each refusal of a reach: one of them, `NOT_LAUNCHED`, is held for `run` and for `complete`, and the rest by [the connections](../DECKIT-9/SPEC.md)'s cases. That the mod is let go once it has answered: what is held is no answer a case reads. Each keyword of a schema but `type` and `required`: each is a key a case reads the same way, and one case of each fit is no more than the table.

**Note.** What this costs an implementation's owner: it reads the entries declared to `deckit/commands` again as they change, checks args against a command's `params` before it reaches the mod, and reaches a mod for each run and each completion.

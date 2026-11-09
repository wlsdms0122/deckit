# DECKIT-13: Storage

Status: draft
Area: system

## Summary

A mod stores what it keeps between runs through `storage`, a member of [the handle](../DECKIT-7/SPEC.md): **records**, what must not be lost, kept by the system under keys of a fixed grammar, and **values**, small state that costs little to lose, kept beside the mod's page. This DECKIT fixes what each takes, answers and is refused with, that what one mod stores no other mod reads, that records are kept as the host app starts again, what `mods.usage` answers of what a mod has stored in each place it is kept, and that what a mod stored is erased as it is removed with `erase` and kept as it is removed without it.

## Motivation

[The handle](../DECKIT-7/SPEC.md) lists `storage` and `mods.usage` and leaves them here, and [the catalog](../DECKIT-4/SPEC.md)'s `remove` takes `erase` and leaves what it takes away here. A mod author writes one entry for every implementation, so each of these is a call two implementations could answer differently without a rule.

A mod keeps its notes:

```js
await deckit.storage.records.set("Notes", { text: "a" });
deckit.storage.records.get(1, []);
```

On one implementation `Notes` is a file name and is kept, and on another it is refused for its capital, or kept as a file that a file system that ignores case confuses with `notes`. The key `1` is read as the string `"1"` on one and refused on another.

A mod manager shows a person what a mod has stored before they remove it with `erase`:

```js
const usage = await deckit.mods.usage("mod-b");
await deckit.mods.remove("mod-b", true);
```

Where `usage` answers a size on one implementation and a count of files on another, the manager prints one of them wrong. Where `erase` takes the records and leaves the values, `mod-b` installed again finds what it stored before, on one implementation and not on another.

## Rules

### Storage

`storage`, a member of [the handle](../DECKIT-7/SPEC.md), is a table of two members, `records` and `values`. No permission guards either. What a mod stores through either is its own: a mod reads only what its own runs stored, and no other mod reads it.

A stored **value** is a value as [the handle](../DECKIT-7/SPEC.md) fixes values, and storage takes nothing else: neither a null, nor anything else a mod's code holds, in an array or a table of it or as the value itself. A key of a table bound to no value is left out of it, as [the handle](../DECKIT-7/SPEC.md) fixes, and is not read back. It is read back as a copy: what a run does with what it read changes nothing of what is stored.

A member of either that stores something is refused at `call` with kind `QUOTA_EXCEEDED`, and nothing of it is done, where the place it is kept has no room for it. A write the system does not make is told only as its refusal, and is no problem of the run, as [the lifecycle](../DECKIT-5/SPEC.md) fixes one.

### Records

`storage.records` holds these members:

| member | takes | answers | refused with |
|---|---|---|---|
| `get(key, fallback)` | `key`, a string; `fallback`, any, not required | at once: a copy of the record under `key`, or `fallback` where there is none | at `call` `INVALID_ARGUMENT` |
| `set(key, value)` | `key`, a string; `value`, a value | a request: nothing, once the record under `key` is kept as `value` | at `call` `INVALID_ARGUMENT`, `QUOTA_EXCEEDED` |
| `remove(key)` | `key`, a string | a request: nothing, once no record is kept under `key` | at `call` `INVALID_ARGUMENT` |
| `keys()` | nothing | at once: an array of the key of each record kept, in the order of their code points | |

A record's key is a `key`, the grammar [the bundle](../DECKIT-2/SPEC.md) names a `name-part` by:

```
key = name-part        ; as the bundle gives it
```

`set` and `remove` are requests, as [the handle](../DECKIT-7/SPEC.md) fixes them. `get` and `keys` are not: each answers at once, and `get` throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one. A member is refused with the first of these that is so, and nothing of it is done:

1. at `call` with kind `INVALID_ARGUMENT`, where `key` is not a string or not a `key`, or `value` is left out or is not a value, as [the handle](../DECKIT-7/SPEC.md) fixes an argument left out;
2. at `call` with kind `QUOTA_EXCEEDED`, as *Storage* says.

Records are kept as the host app quits and starts again.

### Values

`storage.values` holds these members, none of them a request: each answers at once, and throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one.

| member | takes | answers | refused with |
|---|---|---|---|
| `get(key, fallback)` | `key`, a string; `fallback`, any, not required | a copy of the value under `key`, or `fallback` where there is none | at `call` `INVALID_ARGUMENT` |
| `set(key, value)` | `key`, a string; `value`, a value | nothing, once the value under `key` is `value` | at `call` `INVALID_ARGUMENT`, `QUOTA_EXCEEDED` |
| `remove(key)` | `key`, a string | nothing, once no value is under `key` | at `call` `INVALID_ARGUMENT` |

A value's key is any string. A member is refused with the first of these that is so, and nothing of it is done:

1. at `call` with kind `INVALID_ARGUMENT`, where `key` is not a string, or `value` is left out or is not a value;
2. at `call` with kind `QUOTA_EXCEEDED`, as *Storage* says.

**Note.** Values are kept beside the mod's page, and may be lost where the host's pages lose what they keep. What a mod cannot afford to lose is a record.

### What a mod has stored

`mods.usage(id)`, a member of [the handle](../DECKIT-7/SPEC.md), is a request:

| takes | type | required | what it is |
|---|---|---|---|
| `id` | string | yes | the id of the mod whose storage is read, as [the bundle](../DECKIT-2/SPEC.md) names one |

It answers what the mod `id` has stored, in each place it is kept:

| key | value |
|---|---|
| `data` | table `{ count, capped, hidden }`: `count`, an integer, how many files the mod's data folder holds, at most 1000; `capped`, a boolean, whether it holds more; `hidden`, a boolean, whether it holds a file or folder whose name starts with `.`, which is not counted |
| `records` | table `{ count, hidden }`: `count`, an integer, how many records the mod keeps; `hidden`, a boolean, whether its records' place holds a file whose name starts with `.` |
| `values` | table `{ count }`: `count`, an integer, how many values the mod keeps beside its page |
| `kept` | array of strings: the name of each layer a host stacks that keeps anything of the mod, in the order the layers were stacked |

`deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards it. It is refused with the first of these that is so:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`;
3. at `call` with kind `NOT_INSTALLED`, where no bundle is listed under `id`, as [the catalog](../DECKIT-4/SPEC.md) lists them.

### Erasing what a mod stored

What a mod stored is its records, its values, its data folder and what each layer keeps of it. [The catalog](../DECKIT-4/SPEC.md)'s `remove` with `erase` true erases all of it, once the mod's run has ended, so that a bundle installed again under its `id` finds nothing of it. With `erase` false, all of it is kept, and a bundle installed again under its `id` reads it as it was.

## Interactions

- The `id` and the `name-part` grammars, and the values of the manifest text: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods`, what a mod is granted and the refusal `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- `install` and `remove`, what `remove` answers of what it erased, the bundles listed and `NOT_INSTALLED`: [the catalog](../DECKIT-4/SPEC.md).
- A problem of a run: [the lifecycle](../DECKIT-5/SPEC.md).
- The handle, requests, values, an argument left out, an error and `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md). `QUOTA_EXCEEDED`: here.
- The mod's data folder, which a module of the mod's started in the host's own process writes: a framework a host stacks, outside this spec.
- A layer a host stacks, and what it keeps of a mod: the embedding DECKIT.

## Alternatives considered

- One kind of storage. What must not be lost would wait on the system for every read, or what costs little to lose would be kept as carefully as what does not; a mod chooses which by the member it calls.
- A record's key as any string. A key is a file name on an implementation that keeps a record as a file, and a key that names two files on one file system and one on another would be kept apart on one and confused on the other. A key of one grammar is the same on every implementation.
- A key of another type read as a string. As [the handle](../DECKIT-7/SPEC.md) sets aside an argument turned into the type its signature gives: `1` would name the record `"1"` on one implementation and be refused on another.
- `get` as a request. A mod reads its state as it draws, and a promise would leave it drawing before it knows what it stored; what a run has written it reads back at once.
- A key that is not a `key` refused with a kind of its own. A mod would tell it apart from a key that is no string, which is as much an argument that does not fit what the member takes.
- A write that fails told also as a problem of the run. The run did not fail, the write did, and the mod that made it is told by its refusal; a person would read one failure twice.
- Usage of an id no bundle is listed under answered as nothing stored. A mod manager could not tell an id it misspelled from a mod that stored nothing, and what a removed mod kept is read by installing it again.
- Usage that leaves out values. A person who removes a mod with `erase` would not be told of what its page kept, which `erase` takes too.
- Usage as a size in bytes. A size depends on how an implementation lays out what it keeps; counts of files and records are the same on every implementation that keeps the same things.
- Erasing what a mod stored as it is removed, always. A person who removes a mod to install a newer one from a folder would lose what it stored; `erase` is theirs to choose.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `QUOTA_EXCEEDED`: a case cannot fill the disk or the page's storage. That what a run does with what it read changes nothing of what is stored: a case reads no value in place. A mod's data folder and `capped`: no member of the handle a case's request reaches writes it, and what writes it is a framework a host stacks, outside this spec. `hidden`, and `kept` of a layer that keeps anything: a case writes no file into what the system keeps, and stacks no layer of its own. That values may be lost: no rule fixes when.

**Note.** What this costs an implementation: it keeps records apart for each mod in a place that survives the host app's start, reads a record back at once, judges a key by the bundle's grammar and a value by the handle's, counts what each mod has in each place it is kept, its values beside its page among them, and erases every place as a mod is removed with `erase`.

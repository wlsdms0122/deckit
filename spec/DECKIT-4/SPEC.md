# DECKIT-4: The catalog

Status: draft
Area: system

## Summary

The catalog is every bundle the system has found, one for each name, in one order. This DECKIT fixes where the system finds bundles, which one it reads where two are listed under one name, the order it lists them in, what it does with the bundles a host ships each time the app starts, and the requests a mod granted `deckit.mods` makes of it: listing the mods, planning and making an install from a folder, and removing an installed mod, with what each answers and how each is refused.

## Motivation

[The bundle](../DECKIT-2/SPEC.md) fixes what one bundle is and what the system answers of it. A host hands the system more than one place to find bundles, and the same mod can lie in two of them. Each of these is a host two implementations could answer differently without a rule.

A host ships `mod-a` at `1.0.0` and reads a folder in place that holds a newer copy of it while its author works on it:

```toml
id = "mod-a"
version = "2.0.0"
api = "1.0.0"
main = "main.js"
```

Which of the two runs, and whether the other is listed too, decides what the author sees. The same host ships `mod-c` and then `mod-b`, in that order: whether `mods` lists them as shipped, by id, or in the order the folders' names sort decides which background mod launches first and where each is listed.

A host ships a mod, the person removes it, and the app starts again. Whether the mod comes back at the next start, and whether a mod the host stops shipping stays installed, cannot be left to each implementation: the mod would come back on one and stay out on the other.

A mod granted `deckit.mods` installs a folder whose id is read in place. Where one implementation installs it and lists the copy, and another refuses, the same mod manager works on one and fails on the other.

## Rules

### Where bundles are found

The system finds bundles in three places:

| place | what it holds | what the system does with it |
|---|---|---|
| read in place | the folder of bundles the host reads in place | reads each bundle in it where it lies, each time the catalog is read |
| shipped | each folder of a bundle the host ships, in the order it ships them | installs it as the app starts, under *What a host ships* |
| installed | the bundles the system keeps in its own folder | reads each one there |

A bundle is **installed** when the system keeps a copy of it in its own folder. An installed bundle is read from that copy, never from the folder it was installed from, and a change to that folder changes nothing installed. How the system lays out its own folder is not the specification's.

### One bundle for each name

Each bundle found is listed under the name [the bundle](../DECKIT-2/SPEC.md) gives it, taken or refused. The catalog holds one bundle for each name. Where more than one bundle is listed under one name, the first found is the one the catalog holds, and it **hides** the others: none of them is read further, runs or is listed. The bundles are found in this order:

1. The bundles read in place, by their folders' names compared as Unicode scalar values, as [the bundle](../DECKIT-2/SPEC.md) compares ids.
2. The installed bundles.

A bundle hides the others under its name whether or not it is taken.

### The order

The catalog lists its bundles in one order, the order `mods` answers in and every DECKIT means by the catalog's order:

1. The names of the installed bundles, in the order each was first installed. A bundle installed again under a name already installed keeps that name's place, a name removed loses its place, and a bundle read in place that hides an installed one is listed in the installed one's place.
2. Then every other name, by the names compared as Unicode scalar values.

### What a host ships

As the app starts, before any bundle is listed, the system installs what the host ships, as one step:

- A folder shipped under a name that a folder shipped before it in the same start is listed under is passed over.
- A name shipped at an earlier start, and not installed now, stays out: the bundle shipped under it is not installed and is not listed.
- An installed bundle whose name was shipped at the last start, and is not shipped now, is removed, as *remove* removes it with `erase` false.
- Every other bundle shipped is installed from its folder, in the order shipped, as *install* installs one, but marked system where the host marks it system.

A bundle shipped that does not install is listed under its name, refused as it was, unless an installed bundle is listed under that name, which is then held as it was. Its name is not one shipped at this start, so the next start tries it again.

A bundle installed by *install* in the place of a system mod is not a system mod.

### What a mod granted deckit.mods asks

`deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards each of these requests:

| request | takes | answers | refused at `call` with |
|---|---|---|---|
| `list` | nothing | an array of entries, one for each name in the catalog, in the catalog's order | |
| `plan` | `folder`, a string: a folder's path | what installing `folder` would come to | `NESTED`, `READ_IN_PLACE` |
| `install` | `folder`, a string: a folder's path | the bundle installed | `NESTED`, `READ_IN_PLACE` |
| `remove` | `id`, a string; `erase`, a boolean | whether what the mod stored was erased | `NOT_INSTALLED`, `READ_IN_PLACE` |

#### list

Each entry is a table:

| key | value |
|---|---|
| `id` | string: the name the bundle is listed under |
| `mod` | table: the bundle as [the bundle](../DECKIT-2/SPEC.md) answers it; absent where it is refused |
| `refusal` | table `{ stage, kind }`: `stage` the string `"read"`, `kind` the refusal's kind; absent where the bundle is taken |
| `folder` | string: the path of the folder the bundle is read from |
| `installed` | boolean: whether the bundle is installed |
| `shipped` | boolean: whether the bundle is one the host ships |
| `system` | boolean: whether the bundle is a system mod |
| `hides` | array of strings: the paths of the folders of the bundles it hides, in the order found |

#### plan and install

`folder` is read as a bundle that is not a system mod's, as [the bundle](../DECKIT-2/SPEC.md) reads one folder. A folder the bundle refuses, and a folder that is not a bundle, refuse the request at `read` with kind `NOT_LOADABLE`. Then the request is refused at `call`:

- with `NESTED` where `folder` lies inside the system's own folder, or holds it;
- with `READ_IN_PLACE` where a bundle read in place is listed under the same name, which would hide the bundle installed.

`plan` changes nothing. It answers the bundle as [the bundle](../DECKIT-2/SPEC.md) answers it, with one more key, `replaces`, a boolean: whether an installed bundle is listed under the same name.

`install` installs a copy of the bundle as `folder` holds it. Where a bundle is installed under the same name, the copy takes its place whole, and nothing of the bundle before is read again. What the mod stored stays. It answers the bundle installed, as [the bundle](../DECKIT-2/SPEC.md) answers it.

#### remove

`remove` takes the installed bundle listed under `id` away. It is refused with `READ_IN_PLACE` where a bundle read in place is listed under `id`, and with `NOT_INSTALLED` where no installed bundle is. Where `erase` is true, what the mod stored is erased with it. It answers a table `{ erased }`, `erased` a boolean: whether anything the mod stored was erased.

A name shipped and removed stays out at each later start, under *What a host ships*, until the host stops shipping it.

## Interactions

- What a bundle is, the name it is listed under, what it is answered and when it is refused, and which mod is a system mod: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods`, and the refusal of a request made by a mod not granted it: [the permissions](../DECKIT-3/SPEC.md).
- What runs of a mod installed, replaced or removed while it runs, and which background mods launch in the catalog's order: the lifecycle's DECKIT.
- What a mod stores, and what erasing it takes away: the storage DECKIT.
- The handle a mod makes these requests through, and the input that hands a case's request: the handle's DECKIT.
- Being told that what `list` answers has changed: the events' DECKIT.
- What a host hands as the folder read in place and the bundles it ships, and what it marks system: the embedding DECKIT.

## Alternatives considered

- An installed bundle that hides a bundle read in place of its name. A bundle read in place is one its author is changing, and is read in place so that the change is seen: installed first, every change would wait for an install.
- The catalog listed by name alone. A host orders what it ships, and a person's installs come after what the host shipped. Listed by name, what a host ships could not say which of its background mods launches first.
- A host that ships nothing leaving installed what it shipped before. That would be a second rule for one list of shipped names, and an empty list would mean what no other list means.
- Installing what a host ships only when its version is newer than the copy installed. Versions say what a mod's author released, and the system compares them only against `api`: a host that ships an older version means that version.

## Notes

**Note.** The sentences of *What a mod granted deckit.mods asks* are held by no case under `conformance/`, and neither are the sentences of *What a host ships* that need a name removed or a host that changes between starts. They wait on the handle's DECKIT, which adds to [the case format](../DECKIT-1/SPEC.md) the input that hands a request, and on a case format that changes the host between starts. That an installed bundle is read from its copy waits on the same input, since only `install` installs from a folder that can then change.

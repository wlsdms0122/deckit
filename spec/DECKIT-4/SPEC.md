# DECKIT-4: The catalog

Status: draft
Area: system

## Summary

The catalog is every bundle the system has found, one for each name, in one order. This DECKIT fixes where the system finds bundles, which one it reads where two are listed under one name, the order it lists them in, what it does with the bundles a host ships each time the host app starts, and the requests a mod granted `deckit.mods` makes of it: listing the mods, installing from a folder or making a dry run of the install, and removing an installed mod, with what each answers and how each is refused.

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

A mod granted `deckit.mods` installs a folder whose id is read in place. Where one implementation installs it and lists the copy, and another refuses, the same mod manager works on one and fails on the other. So does each other request such a mod makes, on an input like these:

- A dry run of `install` of a folder holding `mod-a` 1.1.0, where `mod-a` 1.0.0 is installed: whether it says the install would take the place of 1.0.0, which a mod manager tells the person before it installs.
- `install` of a folder inside the system's own folder: copied into itself, or refused.
- `remove` of `mod-a` read in place: its author's working folder deleted, or refused.
- `remove` of an installed `mod-a` with `erase` true: what `mod-a` stored kept, or taken with it.
- `list`: whether each entry says it is installed, shipped and a system mod, and which folders it hides, or leaves a mod manager to guess.

## Rules

### Where bundles are found

The system finds bundles in three places:

| place | what it holds | what the system does with it |
|---|---|---|
| read in place | the folder of bundles the host reads in place | reads each bundle in it where it lies, each time the catalog is read |
| shipped | each folder of a bundle the host ships, in the order it ships them | installs it as the host app starts, under *What a host ships* |
| installed | the bundles the system keeps in its own folder | reads each one there |

A bundle is **installed** when the system keeps a copy of it in its own folder. An installed bundle is read from that copy, never from the folder it was installed from, and a change to that folder changes nothing installed. How the system lays out its own folder is not the specification's.

The catalog is **read** as the host app starts, once what the host ships is installed, and again as each request under *What a mod granted deckit.mods asks* is answered. A change to a folder read in place is seen from the next read on.

### One bundle for each name

Each bundle found is listed under the name [the bundle](../DECKIT-2/SPEC.md) gives it, taken or refused. The catalog holds one bundle for each name. Where more than one bundle is listed under one name, the first found is the one the catalog holds, and it **hides** the others: none of them is read further, runs or is listed. The bundles are found in this order:

1. The bundles read in place, by their folders' names compared as Unicode scalar values, as [the bundle](../DECKIT-2/SPEC.md) compares ids.
2. The installed bundles.
3. The bundles shipped that did not install at this start, each at the folder it is shipped in, refused as it was.

A bundle hides the others under its name whether or not it is taken.

### The order

The catalog lists its bundles in one order, the order `mods` answers in and every DECKIT means by the catalog's order:

1. The names of the installed bundles, in the order each was first installed. A bundle installed again under a name already installed keeps that name's place, a name removed loses its place, and a bundle read in place that hides an installed one is listed in the installed one's place.
2. Then every other name, by the names compared as Unicode scalar values.

### What a host ships

The system keeps the **shipped names** across starts: the names whose installed bundle it installed from what the host ships. Before the first start there are none.

As the host app starts, before any bundle is listed, the system takes what the host ships as one step:

- A folder shipped under a name that a folder shipped before it in the same start is listed under is passed over.
- A name among the shipped names that no installed bundle is listed under stays out: the bundle shipped under it is not installed.
- A name that an installed bundle is listed under, and that is not among the shipped names, stays as it is installed: the bundle shipped under it is not installed.
- Every other bundle shipped is installed from its folder, in the order shipped, as *install* installs one, refused only as [the bundle](../DECKIT-2/SPEC.md) refuses it, at `read`, and marked system where the host marks it system. Its name joins the shipped names.
- Each name among the shipped names that is not shipped at this start leaves them, and the installed bundle listed under it, if any, is removed, as *remove* removes it with `erase` false.

A name also leaves the shipped names as *install* installs a bundle under it, so a mod installed from a folder in the place of a shipped one stays at each later start. A bundle shipped that does not install does not join the shipped names, so the next start tries it again. A start that is refused at `call` takes nothing the host ships.

A bundle installed by *install* in the place of a system mod is not a system mod.

### What a mod granted deckit.mods asks

`deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards each of these requests:

| request | takes | answers | refused with |
|---|---|---|---|
| `list` | nothing | an array of entries, one for each name in the catalog, in the catalog's order | |
| `install` | `folder`, a string: a folder's path; `options`, a table that may be left out, with `dryRun`, a boolean that may be left out, `false` where it is | the bundle installed, or with `dryRun` true the bundle it would install | at `read` `NOT_LOADABLE`; at `call` `NESTED`, `READ_IN_PLACE` |
| `remove` | `id`, a string; `erase`, a boolean | whether what the mod stored was erased | at `call` `READ_IN_PLACE`, `NOT_INSTALLED` |

A request is refused first as [the permissions](../DECKIT-3/SPEC.md) refuse one, then as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, and then with the first refusal of its row that holds, in the row's order.

#### list

Each entry is a table:

| key | value |
|---|---|
| `id` | string: the name the bundle is listed under |
| `mod` | table: the bundle as [the bundle](../DECKIT-2/SPEC.md) answers it; absent where it is refused |
| `refusal` | table `{ stage, kind, message }`: `stage` the string `"read"`, `kind` the refusal's kind, `message` why, as [the handle](../DECKIT-7/SPEC.md)'s errors carry it; absent where the bundle is taken |
| `folder` | string: the path of the folder the bundle is read from |
| `installed` | boolean: whether the bundle is installed |
| `shipped` | boolean: whether the bundle is one the host ships |
| `system` | boolean: whether the bundle is a system mod |
| `hides` | array of strings: the paths of the folders of the bundles it hides, in the order found |

#### install

`folder` is an absolute path: `/` followed by the names of the folders on the way from the root, apart at `/`. A string that is not one names no folder. `folder` is read as a bundle that is not a system mod's, as [the bundle](../DECKIT-2/SPEC.md) reads one folder. A folder the bundle refuses, a folder that is not a bundle, and a string that names no folder refuse the request at `read` with kind `NOT_LOADABLE`. Then the request is refused at `call`:

- with `NESTED` where the place `folder` leads to, every link followed, lies inside the system's own folder, or holds it;
- with `READ_IN_PLACE` where a bundle read in place is listed under the same name, which would hide the bundle installed.

`install` installs a copy of the bundle as `folder` holds it. Where a bundle is installed under the same name, the copy takes its place whole, and nothing of the bundle before is read again. What the mod stored stays.

With `dryRun` true, `install` changes nothing and answers what it would install, refused as the install would be.

Either way it answers the bundle as [the bundle](../DECKIT-2/SPEC.md) answers it, with one more key, `replaces`, a boolean: whether an installed bundle is listed under the same name before the install.

#### remove

`remove` takes the installed bundle listed under `id` away. It is refused with `READ_IN_PLACE` where a bundle read in place is listed under `id`, and with `NOT_INSTALLED` where no installed bundle is listed under it. Where `erase` is true, what the mod stored is erased with it. It answers a table `{ erased }`, `erased` a boolean: whether anything the mod stored was erased.

A name shipped and removed stays out at each later start, under *What a host ships*, until the host stops shipping it.

## Interactions

- What a bundle is, the name it is listed under, what it is answered and when it is refused, and which mod is a system mod: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods`, and the refusal of a request made by a mod not granted it: [the permissions](../DECKIT-3/SPEC.md).
- What runs of a mod installed, replaced or removed while it runs, and which background mods launch in the catalog's order: the lifecycle's DECKIT.
- What a mod stores, and what erasing it takes away: [the storage](../DECKIT-13/SPEC.md).
- The handle a mod makes these requests through: [the handle](../DECKIT-7/SPEC.md). The input that hands a case's request: [the case format](../DECKIT-1/SPEC.md).
- Each mod's latest run, which `runs` answers: [the lifecycle](../DECKIT-5/SPEC.md). Each interface with its providers, owner and clients, which `mods.interfaces()` answers: [the interfaces](../DECKIT-10/SPEC.md).
- Being told that what `list` answers may have changed: [the events](../DECKIT-12/SPEC.md).
- What a host hands as the folder read in place and the bundles it ships, and what it marks system: the embedding DECKIT.

## Alternatives considered

- An installed bundle that hides a bundle read in place of its name. A bundle read in place is one its author is changing, and is read in place so that the change is seen: installed first, every change would wait for an install.
- The catalog listed by name alone. A host orders what it ships, and a person's installs come after what the host shipped. Listed by name, what a host ships could not say which of its background mods launches first.
- A host that ships nothing leaving installed what it shipped before. That would be a second rule for one list of shipped names, and an empty list would mean what no other list means.
- Installing what a host ships only when its version is newer than the copy installed. Versions say what a mod's author released, and the system compares them only against `api`: a host that ships an older version means that version.
- A request of its own for what an install would come to. It would take the same folder, be read and refused the same way and answer the same bundle, a second name for one act; a dry run is that act changing nothing.
- `list` answering a table that holds the entries beside each running mod's summary and each interface's providers and owner, each entry the bundle's keys beside the catalog's and its run's. A bundle's keys would share one table with the catalog's, so a field a layer adds could take a catalog key's name, and a mod that reads only the bundles would be handed every run and interface. Each is its own request: `list` here, `runs` in [the lifecycle](../DECKIT-5/SPEC.md), `mods.interfaces()` in [the interfaces](../DECKIT-10/SPEC.md).
- `install` answering beside the bundle the folder it was handed, or whether a restart of the app is left to finish the install. The folder is the asking mod's own, and what only a restart finishes is the host app's, not the catalog's.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. Of what `list` answers, `folder` and `hides`: they are paths of folders the runner lays out where it keeps its run, which no case writes. `refusal`: a table is matched whole, and its `message` is one no rule states. `mod`, and that `install` answers the bundle as [the bundle](../DECKIT-2/SPEC.md) answers it: [the bundle](../DECKIT-2/SPEC.md)'s cases hold what a bundle is answered. That a bundle installed in the place of a system mod is not one, which only `list` shows: no case here installs in the place of a system mod. That an installed bundle is read from its copy and not from the folder it was installed from, and that a change to a folder read in place is seen from the next read on, wait on an input that changes a folder. `NESTED`: a case cannot write a folder inside the system's own folder, whose layout is not the specification's, nor a bundle that holds it. The sentences of *What a host ships* that need a host that changes between starts wait on a case format that changes the host between starts. That a refused start takes nothing waits on a look at the system's own folder, which no format has.

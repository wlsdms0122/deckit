# DECKIT-14: Addresses

Status: draft
Area: system

## Summary

`deckit/urls` is the standard interface through which a mod opens an address with the mod that opens it. A mod declares the addresses it opens in its manifest, as entries to `deckit/urls`, and takes each one offered to it on the exports it opens for its id. A client hands the interface's owner an address; the owner offers it to the mods whose patterns take it, in an order this DECKIT fixes, and hands it to the host to open outside the app when none takes it. A client granted `deckit.system-services` lists the schemes with the mods that open each, and chooses what opens a scheme, a choice the owner keeps as the host app starts again. This DECKIT fixes what is declared, the order an address is offered in, the requests `open`, `list` and `choose` with their answers and refusals, and the permissions they read. Which mod ships as the owner is the embedding's.

## Motivation

[Opening outside the app](../DECKIT-8/SPEC.md) hands the host an address of the web or a file, and leaves to the standard interfaces an address a mod opens. `mod-b` opens boards, and `mod-c` the pages of one site:

```toml
[[contributes."deckit/urls"]]
scheme = "board"
```

```toml
[[contributes."deckit/urls"]]
scheme = "https"
patterns = ["https://example.com/docs*"]
```

and `mod-a`, which shows a note with links in it, opens one:

```js
const opened = await urls.open("https://example.com/docs/1");
```

One implementation offers the address to `mod-c`, another opens it in the browser, a third offers it to whichever of the two launched first. What `board:1` comes to where `mod-b` is not running, whether `open` answers anything where no mod takes an address, and whether `mod-a`, granted nothing, opens `file:///etc/hosts` through a mod that is granted files, are each a call two implementations answer differently without a rule. A person who wants `https` addresses to open outside the app cannot say so on one, and on another what they chose is gone once the app starts again. A mod written against `deckit/urls` runs on every host that ships an owner of it, so the entry a mod declares and what each request answers are the system's to fix, not the owner's.

## Rules

### What a mod declares

A mod declares the addresses it opens as entries to `deckit/urls`, under `contributes` as [the bundle](../DECKIT-2/SPEC.md) reads it, and need not use the interface. Each entry is a table:

| key | takes | required | what it is |
|---|---|---|---|
| `scheme` | string: a `scheme`, below, or `"*"` | yes | the scheme of the addresses it opens, `*` for every scheme |
| `patterns` | non-empty array of `pattern`, each of the entry's scheme | no, and never beside `"*"` | which addresses of the scheme; left out, `<scheme>:*`, and `*` for `"*"` |

```
scheme  = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
pattern = scheme ":*" / scheme "://" host path "*"
host    = 1*( any code point but "/" and "*" )
path    = "/" *( any code point but "*" )
```

A scheme and a host are compared in lower case. A scheme is **no place** where it is `javascript`, `data`, `blob` or `about`, in lower case. The entries of a mod are read in the order written, and an entry is **left out** where it is not a table, its `scheme` is neither a `scheme` nor `"*"`, its scheme is no place, it writes `patterns` beside `"*"`, its `patterns` is not a non-empty array of patterns of its scheme, or its mod wrote, in an entry before it that is not left out, its scheme or `"*"`, or, where it is a `"*"`, any scheme. An entry left out takes no address. A pattern written twice in one entry is read once.

A **handler** is a mod with an entry not left out: it opens the addresses of the entry's scheme that a pattern of the entry takes, and, for `*`, every address.

### What a pattern takes

An address is a string. Its **scheme** is what comes before its first `:`, where that is a `scheme`, in lower case; an address with nothing before its first `:`, with no `:`, or with what is no `scheme` before it, has no scheme.

| pattern | takes |
|---|---|
| `*` | every address |
| `<scheme>:*` | every address of that scheme |
| `<scheme>://<host><path>*` | an address of that scheme whose text after `<scheme>:` starts with `//`, whose host, the text after `//` up to the first `/`, `?` or `#` or to its end, is `<host>`, and whose path, the text after the host up to the first `?` or `#` or to its end, starts with `<path>`, or is empty where `<path>` is `/` |

A pattern's **width** is `0` for `*`, `1` for `<scheme>:*`, and `2` and the number of code points of `<path>` for a pattern of a host: the greater the width, the narrower the pattern.

### The list of a scheme

Each scheme has a **list**: `http`, `https` and `file`, then each scheme a handler declares, in [the catalog's](../DECKIT-4/SPEC.md) order and then the order written, and then `*` where a handler declares it. The list of a scheme holds the handlers of that scheme and those of `*`; the list of `*` holds those of `*`. What **opens a scheme outside the app** is `browser` for `http` and `https`, `file` for `file`, and nothing for any other.

A list may have a **choice**: a mod, or outside the app, as `choose` sets it. The choice of a mod stands while the mod is in the list, and the choice of outside the app while something opens the scheme outside the app; a choice that does not stand is kept, and stands again once its condition holds.

### Where an address goes

An address with no scheme, or whose scheme is no place, goes to no handler and opens nowhere. Any other address goes to the list of its scheme, where its scheme has one, and else to the list of `*`:

1. Where the list's choice is outside the app, it is offered to no handler.
2. Else it is offered, in turn, to each handler of the list with a pattern that takes it: the chosen mod first, then by the widest of its patterns that take the address, the narrowest first, then by id, each id compared code unit by code unit. The catalog's order does not decide it.

A handler is offered an address by reaching it by its id, as [the connections](../DECKIT-9/SPEC.md) say, which launches it where it does not run, and calling `openURL(url, options)` on the exports it opens for its id, `url` the address and `options` the table `{ activates }`, and is let go once it has answered. The handler **takes** the address where `openURL` answers `true`. A handler that answers anything else, throws, is refused the reach or has no `openURL` passes the address on to the next. The first that takes it ends it.

Where no handler takes it, an address of a scheme that something opens outside the app is handed to the host as [opening outside the app](../DECKIT-8/SPEC.md) says, with `activates`, and one of another scheme opens nowhere.

**Note.** A handler that never answers holds the address it was offered, and no other. The owner reaches a handler by its id, which [the connections](../DECKIT-9/SPEC.md) guard with `deckit.reach-mods`; an owner is shipped granted what it needs.

### The requests

The owner of `deckit/urls`, as [the interfaces](../DECKIT-10/SPEC.md) fix one, provides major `1`, opens its exports for every client, in its start, and its exports hold these members on every connection, each a function a call of which is a request, as [calls across a connection](../DECKIT-11/SPEC.md) fix one:

| member | takes | answers | guarded by |
|---|---|---|---|
| `open(url, options)` | `url`, a string, required; `options`, a table `{ activates }`, `activates` a boolean, `true` where it is left out | `true` where a handler took the address or it was handed to the host to open outside the app, and `false` where it opened nowhere | `system.file-handlers`, for an address whose scheme is `file` |
| `list()` | nothing | a table `{ schemes, refused }`, below | `deckit.system-services` |
| `choose(scheme, choice)` | `scheme`, a string, required; `choice`, a table `{ mod }`, `mod` a string, or `{ system }`, `system` `true`, and no other key; left out, the choice is cleared | the list of `scheme`, in lower case, as `list` answers it, once the choice is kept | `deckit.system-services` |

The permission is the client's, as the connection hands its credential to the owner, and a request is refused as [the permissions](../DECKIT-3/SPEC.md) refuse one a permission guards, at `call` with kind `NOT_PERMITTED`, before anything else of it. A request is then refused as [the handle](../DECKIT-7/SPEC.md) refuses one whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`, and a `choice` of any other shape is refused so. `open` reads `url` with the white space code points at its ends dropped, and is refused nothing for an address that opens nowhere, nor where the host refuses it.

`choose` is refused, after those, with the first of these that is so, at `call`:

1. kind `SCHEME`, where `scheme`, in lower case, has no list;
2. kind `MOD`, where `choice` is `{ mod }` and that mod is not in the list;
3. kind `SYSTEM`, where `choice` is `{ system }` and nothing opens the scheme outside the app.

The owner keeps each choice in its own storage, as [the storage](../DECKIT-13/SPEC.md) fixes it, so that it stands as the host app starts again.

### What list answers

`schemes` is an array, one table for each list in the order above:

| key | value |
|---|---|
| `scheme` | string: the scheme, in lower case, or `*` |
| `system` | string, `browser` or `file`: what opens it outside the app; left out where nothing does |
| `chosen` | table `{ mod }` or `{ system = true }`: its choice, where one stands; left out where none does |
| `mods` | array of tables `{ mod, patterns }`, one for each handler in the list: `mod` the table `{ id, name }` of its bundle, as [the bundle](../DECKIT-2/SPEC.md) answers them, and `patterns` the patterns of its entry as written, `<scheme>:*` where it writes none and `*` for `*`. The chosen first, then by the widest of its patterns, the narrowest first, then by id |

`refused` is an array, one table `{ mod, entry, problem }` for each entry left out, in the order read: `mod` the table `{ id, name }` of the declaring mod, `entry` the entry as written, and `problem` a string, why, as the implementation says it.

## Interactions

- `contributes`, an entry as a value, and a bundle's `id` and `name`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.system-services`, `deckit.reach-mods` and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md). `system.file-handlers`, and what the host is handed of an address it opens outside the app: [opening outside the app](../DECKIT-8/SPEC.md).
- The catalog's order: [the catalog](../DECKIT-4/SPEC.md).
- `INVALID_ARGUMENT`, and what a value is: [the handle](../DECKIT-7/SPEC.md).
- Reaching a handler by its id, and the credential a connection hands its service: [the connections](../DECKIT-9/SPEC.md).
- The owner of an interface, the connection to it, and the entries declared to it: [the interfaces](../DECKIT-10/SPEC.md). A call of a member of the exports and its refusal: [calls across a connection](../DECKIT-11/SPEC.md).
- Where the owner keeps a choice: [the storage](../DECKIT-13/SPEC.md).
- The owner a case's host ships, and the call of what a listener was handed: [the case format](../DECKIT-1/SPEC.md).
- Which mod a host ships as the owner: the embedding DECKIT.

## Alternatives considered

- Every scheme handed to the host when no mod takes it. A scheme other than the web's and `file` names a program the system knows nothing of, as [opening outside the app](../DECKIT-8/SPEC.md) sets aside; it opens nowhere instead.
- The catalog's order, or the order mods launched, deciding who is offered an address first. Which mod opens an address would change with what was installed when; the width of a pattern and an id are facts of the bundles.
- One handler for each scheme, the first that declares it. A mod that opens one site's pages could not stand beside one that opens every web address, and a person could not put either first.
- A choice by the name of what opens a scheme, a mod's id or `system`. A mod with the id `system` would read as outside the app; `{ mod }` and `{ system }` are two shapes that no id confuses.
- An address handed to a handler only where it runs. A handler that has no view and launches on demand would never be offered one.
- A file address for a client not granted `system.file-handlers` opening nowhere, answered `false`. The client could not tell a permission it lacks from an address no mod took, and a mod granted files would open what the client may not.
- `null` for no choice and nothing outside the app. A value has no null, as [the handle](../DECKIT-7/SPEC.md) fixes it; a key left out says the same.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `problem`: no rule states its text. A handler that never answers: the step that offers it would not settle. A handler refused the reach or with no `openURL`, and one that throws: a handler that answers `false` holds the same passing on. A choice of a mod that leaves the list and stands again as it returns: a mod leaves a list only as its bundle is installed, removed or changed, which no input of the case format does. That the owner opens its exports in its start and for every client: every case reaches it so.

**Note.** What this costs an implementation's owner: it reads the entries declared to `deckit/urls` again as they change, reaches handlers one at a time and lets each go, and keeps the choices in its storage, a choice of a mod that is gone among them.

# URLs

Which mod opens an address, in one place: the addresses each mod declares in its manifest, an address a mod asks to open offered to the mods that open it, each launched if it does not run, and opened outside the app when none takes it. It keeps what you choose to open a scheme: a mod, or outside the app. It has no view, and launches as a client connects to it.

## Declaring addresses

A mod declares the addresses it opens in its manifest, one `[[contributes."deckit/urls"]]` table for each scheme, and need not use the interface. They are there whether the mod runs or not. URLs reads what is declared as it starts and again as `deckit/urls` sends `contributions-changed` or `owner-changed`.

```toml
[[contributes."deckit/urls"]]
scheme = "https"
patterns = ["https://github.com/*"]

[[contributes."deckit/urls"]]
scheme = "board"
```

| Field      | What it is                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scheme`   | the scheme of the addresses it opens, a letter and then letters, digits, `+`, `-` and `.`, case as you like, or `*` for every scheme                                                                            |
| `patterns` | which addresses of the scheme, a list of patterns: `<scheme>:*` every one, and `<scheme>://<host>/<path>*` those of a host whose path starts so, its `*` only at the end. Left out, every address of the scheme |

Scheme and host are compared in lower case. `https://github.com/*` takes `https://GitHub.com/deckit` and `https://github.com`, not `https://example.com/github.com/`; `https://github.com/deckit/issues*` takes `https://github.com/deckit/issues/1`, not `https://github.com/deckit?issues`.

An entry that cannot be used (no scheme, a scheme that is no scheme or that is no place, `javascript`, `data`, `blob` and `about`, patterns not of its scheme or that are no patterns, patterns beside `*`) is left out and logged once, as is a second entry of one scheme from one mod, and any entry beside a mod's `*`, which already takes every address. Each is answered in `list()`'s `refused`. The others of that mod are read.

## Where an address goes

Each scheme has a list of mods: those that declare it, and those that declare `*`. An address goes to its scheme's list, or to the list of `*` when no mod declares its scheme. It is offered to the mods of that list whose patterns take it, in turn, the first to take it ending it:

- The mod you chose for the scheme first, where its patterns take the address.
- Then the others, by the narrowest of their patterns that takes the address: a host and a path first, the longer path first, then a scheme, then `*`. Of two as narrow, the one of the lower id first. The order mods are installed in says nothing of who opens what.

A mod is reached by its id as its turn comes, which launches it if it does not run, and let go as it answers. One that passes, is not reached (it does not launch, or opens no exports for its id), has no `openURL` or throws passes the address on to the next, which is logged. One that never answers holds that address only.

A scheme you chose to open outside the app offers its addresses to no mod: each opens outside the app at once.

When no mod takes it, an address of `http` or `https` opens in the system browser, and one of `file` in the app for that file, through `deckit.openExternal`. An address of another scheme opens nowhere.

An address with no scheme, or of one that is no place, goes nowhere. A `file` address goes nowhere for a client that does not hold `system.file-handlers`, whoever would open it.

## Providing `deckit/urls`

URLs provides `deckit/urls` major 1, an interface of the mod contract's own. The exports open in `start`, so a client opens an address with no screen too. Any client opens an address. A client lists the schemes and chooses what opens one (Settings) when it holds `deckit.system-services`, which only a system mod is granted:

```toml
[interfaces]
uses = { "deckit/urls" = 1 }

[permissions]
"deckit.system-services" = "Lists the schemes with the mods that open them, and sets the one you choose."
```

```js
deckit.dependencies.onConnect('deckit/urls', (urls) => {
    this.urls = urls;
    return () => (this.urls = null);
});
const opened = await this.urls.open('https://github.com/deckit', { activates: false });
const { schemes, refused } = await this.urls.list();
await this.urls.choose('https', { mod: 'browser' });
await this.urls.choose('http', { system: true });
```

## What a client calls

| Export                   | Who                      | What it is                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open(url, options)`     | any client               | offers `url` as Where an address goes says, and resolves to whether a mod took it or it opened outside the app. `options.activates` false asks the mod, or the system, to leave the app where it is                                                                                         |
| `list()`                 | `deckit.system-services` | `{ schemes, refused }`: `schemes` every scheme with a list, `[{ scheme, system, chosen, mods }]`, `http`, `https` and `file`, then each one a mod declares, then `*` if a mod declares it; `refused` `[{ mod, entry, problem }]` the entries left out, `entry` as written and `problem` why |
| `choose(scheme, choice)` | `deckit.system-services` | chooses what opens `scheme`, `choice` one of the three in Choices, and answers the scheme as `list()` answers one                                                                                                                                                                           |

A scheme as `list()` answers it:

| Field    | What it is                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scheme` | the scheme, lower case, or `*`: the list of an address whose scheme no mod declares                                                                                                                          |
| `system` | what opens it outside the app when no mod takes it, `browser` or `file`, or null for nothing                                                                                                                 |
| `chosen` | what you chose to open it, as Choices says                                                                                                                                                                   |
| `mods`   | `[{ mod, patterns }]`, `mod` its `{ id, name }` and `patterns` as it wrote them (`<scheme>:*` for none, `*` for every scheme): the chosen first, then by its widest pattern, the narrowest first, then by id |

### Choices

What opens a scheme is one of three, of shapes that differ so no mod id reads as outside the app:

| Choice             | What it is                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `{ mod: id }`      | the mod of that id first, where its patterns take the address, then the others           |
| `{ system: true }` | outside the app at once, offered to no mod: only for a scheme whose `system` is not null |
| null               | none: the mods in turn, then outside the app                                             |

What you chose is kept in URLs' storage across runs. A mod chosen is kept while it is gone, so it is chosen again as it comes back, and `list()` answers null for it meanwhile. A kept value of another shape is left out.

A call that does not hold `deckit.system-services` rejects with kind `REFUSED`. `choose` rejects with why, the `kind` saying which:

| Kind     | Why                                                                              |
| -------- | -------------------------------------------------------------------------------- |
| `SCHEME` | no mod opens an address of `scheme`                                              |
| `CHOICE` | `choice` is none of the three                                                    |
| `MOD`    | the mod of `{ mod: id }` is not in the scheme's list                             |
| `SYSTEM` | `{ system: true }` for a scheme nothing opens outside the app, its `system` null |

`open` does not reject for an address no one took: it resolves to false. It rejects only as `deckit.openExternal` does.

## What a mod answers

A mod that declares addresses opens them on the exports it opens for its id (`deckit.exports.register(exports)`, with no interface), in `start`, so URLs reaches them with no screen too. They hold one function for this:

| Export                  | What it is                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openURL(url, options)` | opens `url`, one its patterns take, and answers true when it took it. Anything else passes it on to the next mod. `options` is `{ activates }`, false when the client asked to leave the app where it is |

```js
start(deckit) {
    deckit.exports.register({
        connect: () => ({
            openURL: (url, { activates }) => {
                const board = boardOf(url);
                if (!board) return false;
                this.open(board, { activates });
                return true;
            },
        }),
    });
}
```

A mod is reached by id only by a mod granted `deckit.reach-mods`, which only a system mod is; `connection.credential` says which one asks.

## Permissions

| Permission             | Why                                                                         |
| ---------------------- | --------------------------------------------------------------------------- |
| `deckit.reach-mods`    | reaches the mod that opens an address, which launches it if it does not run |
| `system.file-handlers` | opens a file no mod opens in the app for it, for a mod that may open files  |

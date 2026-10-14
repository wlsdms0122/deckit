# How deckit is built

Deckit is a library a host app embeds to take mods. A mod is what a person adds to the host app, as to a game: a view, a command, a few keys, a way to open an address, a library for other mods, more for another mod to do, a new look, or work done in the app's main process, in any mix.

Deckit is three layers, each built on the one under it:

| Layer | What it is | As an operating system has it |
|---|---|---|
| deck | the engine: what a mod is, running each in a sandbox of its own, what mods give each other (requires and exports, extension points, events), their storage and settings, and the permissions a person grants | the kernel |
| deckit | the platform on deck: the web, windows, keys, commands, opening addresses, the clipboard, notices and main process modules, and `connect`, which a host app starts it with | the system and its services |
| the shell | the surface a person uses deckit through. Deckit's own shell is the panel that shows the mods with a view, the quick switcher, the kit they draw with, and styles; a host app may put its own on deckit instead | a shell, bash or zsh |

The host app is the process and its windows: it starts deckit, puts a shell on it, and says where the shell is shown, as a terminal runs a shell. Deck knows nothing of a screen: to deck a mod's page is where the mod runs. Deckit knows no shell: the shell is built on what `connect` answers, as a host app's own would be. A mod runs whether or not the panel is shown.

This document is why deckit is split the way it is, and the rules that keep it so. The contract a mod is written against is [MOD.md](MOD.md); how a host app embeds deckit is [EMBEDDING.md](EMBEDDING.md); the kit mods draw with is [UI.md](UI.md).

## 1. Principles

1. Deckit is whole by itself. `source/deckit` and the documents it ships (EMBEDDING, MOD, UI) are all of it, and name nothing outside it. The package around it is for convenience: its commands check, build, run and ship deckit, with whatever tools serve.
2. A mod can do what the host app can. Permissions say what a mod reaches, and the person agrees to them; none is a dead end, and a main process module has the app's full power. A mod draws its view as it likes; the kit is the quick way, not the only one.
3. Deckit owns only what it makes. The process, its menus and its windows are the host app's; deckit is handed what it needs through `host/config`, `host/folders`, `connect()` and `host/exports`.
4. A check happens once, where trust changes: main receiving from a page, deck receiving from a mod's code, input from the disk or the network. Inside, each step trusts what the step before it made.
5. A fact has one owner. Everyone else asks it.
6. A layer adds to the one under it and is not known by it: what it gives a mod, what a mod registers with it, the permissions that grant it and the manifest fields it reads, it adds there.
7. A folder is a module or a group. A name is the standard term of its field.

## 2. The libraries, the mods, the host app

```
source/deckit/deck         the engine. Names nothing of deckit
source/deckit/deckit       the platform on deck, and connect. Names nothing of a shell
source/deckit/shell        deckit's own shell: the panel, the switcher, the kit, styles. Reaches deckit through what connect answers
source/deckit/mod          deckit's own mods, Settings among them
source/deckit/deckit-app   Deckit.app: deckit embedded by itself, its own host answers framing every window
```

The package around deckit, `manifest.toml` and `source/cli`, is the commands that check, build, run and ship it (README.md). Deckit names none of it.

A new mod needs no change to deck. A new place to show the panel in needs no change to deckit, and a shell of the host app's own needs no change to deckit.

## 3. Processes and pages

| Where | What runs there |
|---|---|
| main | deck: mod folders, storage, and what a page asks of deck. Deckit: main process modules, the keymap, opening addresses, commands, windows. The shell: the panel and the switcher, the views it puts in the host app's windows |
| a mod's sandbox | where one mod's entry runs, headless or not: a page in a `WebContentsView` of its own at `deckit://<id>.mod/`; with deckit's shell on deckit, a mod with a view has the panel's frame around it there |
| a page that runs no mod | made for the shell, at `deckit://<name>/`: the quick switcher's list, at `deckit://switcher/` |

A mod's sandbox is a renderer and deck is in main. Each mod's sandbox has its own origin, its own sessions and its own storage, so one mod cannot reach another's page, data, cookies or what it was allowed; a mod with `deckit.styles` styles another's page, and that is all. Main knows which mod is asking by the page that asks (`deck/service/deck/identity.js`): no page says who it is. A mod's page is held to its origin; a link out of it is offered to its scheme's handlers.

The pages never speak to each other. Main carries everything between them, and every word is a channel declared once in its concept's `protocol.js` (`deck/module/ipc`), named for its library (`deck:`, `deckit:`, `shell:`): `rendererToMain` for what a page asks or tells main, `mainToRenderer` for what main tells or asks a page. Main holds what arrives to the channel's fields; nothing else checks it. A question main asks a page ends when it is answered, when the page goes away, or when its time runs out. An error crosses with its kind.

## 4. One owner for each fact

| Fact | Owner |
|---|---|
| what a mod's run is: its states, its transitions and what each tells | `deck/service/mod/lifecycle.js` |
| what a manifest may say, and what may be asked for in it | `deck/service/mod/manifest.js` and `permission.js`, with what each layer defines |
| the mods found, and their order | `deck/service/deck/catalog.js` |
| which mods run, each in its sandbox, and where each run is in its lifecycle | `deck/service/deck/runner.js` |
| what a mod exports, its settings | `deck/service/deck/export.js`, `setting.js` |
| which mods extend each extension point | `deck/service/deck/extension.js` |
| which page is which mod, or which page runs none | `deck/service/deck/identity.js` |
| a mod's main process modules | `deckit/service/main-process/main.js` |
| what a keystroke means | `deckit/service/keymap/main.js`; a page only hears the chords it may act on |
| who opens an address | `deckit/service/open/main.js`, in the order the person set |
| what mods offer to be run | `deckit/service/command/main.js`, from what each mod's page supplies, to each caller in a session of its own |
| whether the panel is on screen, and where | the host app, asked through `shell/feature/panel/main.js` |
| which mod is in front, and back and forward | `shell/feature/panel/main.js` |
| what the switcher lists, and what was picked before | `shell/feature/switcher/main.js` |
| which styles each page wears, in what order | `shell/service/style/main.js` |
| a mod's data, records and settings | main, under deckit's folder (below) |
| a mod's web sign-ins | its own sessions, `persist:<id>:<mod>:<name>` |
| what the person arranged (mod order, key overrides, each scheme's handlers) | `state/` |
| what the host app and its shell keep (the panel's frame, what was picked in the switcher before) | `state/host/` |

What a mod is, `deck/service/mod` says: its manifest, its folder, its permissions, its entry and its lifecycle. Deck, `deck/service/deck`, runs mods by it, and `deck/service/mod` names nothing of running them. The runner tells each transition of a run (`willLaunch`, `didLaunch`, `didFailToLaunch`, `willTerminate`, `didTerminate`); what follows a mod's run (its exports, its extensions, its settings, its events, and above deck its main process modules, its keys, its styles and its place in the panel) listens to those, or asks the run, and changes none of it but to record a problem.

Deckit's folder is `host/folders`' `home`, or `~/.config/<id>`:

```
mods/           installed mods, a folder each, named by id
data/<id>/      a mod's own files (a main process module's notes, its workspaces)
records/<id>/   a mod's records, one JSON file a key
settings/<id>.json
state/          what the person arranged, one JSON file a key
state/host/     what the host app and its shell keep, one JSON file a key
logs/
```

Everything deckit keeps is named from its configured id, so two host apps that embed deckit keep their data apart.

## 5. What a mod is handed

A mod reaches deckit only through `deck`, what its `start` is handed (MOD.md). Before a mod runs, its sandbox's boot takes away every global the bundles added, and its entry runs with only `module` and `exports` in reach.

`deck` is put together by the layers, each adding to it. Deck gives a mod its id and name, its settings and storage, what it requires, `exports`, `extend` and `extensionPoint`, events, and with their permissions `mods` and `modSettings`. Deckit adds the web, opening addresses, the clipboard, notices, keys, commands and main process modules, and reads the entry's `icon` and `keywords`. The shell on deckit adds the theme, the kit, `show()`, and the registrations `view` and `styles`. A layer's registrations are kinds deck does not know, and what a layer says of a mod (its summary and contributions) deck carries to main and does not read. What a layer gives a mod is never replaced by what a layer above it gives.

Between mods there are two ways, and one question picks: could the host app do this if the other mod were not there?

- If it could not, it is a dependency. A mod names another in `requires` and calls what that one `exports`, through main. A dependency nobody wrote down cannot exist. The other way round, a mod opens an extension point and one that requires it extends the point: what extends it stays in the extending mod's page, and the point's mod calls it through main, never naming it. What the host app offers (`host/exports`) is handed to the host app's own mod, whose id is the host app's, and another mod reaches it by requiring that one.
- If it could, it is a URL scheme handler. A mod asks for an address to be opened (`deck.open(url)`) without knowing who answers. The mods whose manifest names the scheme are its handlers and are asked in the order the person set, ahead of deckit's own answer, which is always last.

Apart from both, a mod says what happened to it through deck's events (`deck/service/event`): `deck.emit(name)` is heard as `<its id>:<name>` by any mod that listens, and no mod speaks for another. Listening takes no dependency. The bus itself, listeners by name, is `deck/module/event-bus`.

A mod changes how another's pages look with styles, which the shell puts last on each page they style, and nothing else of another mod.

What reaches past a mod's own sandbox (the clipboard, notices, any web address, another mod's settings, the keymap, other mods' looks, a main process module) is asked for by name in `permissions`, with a reason the person reads when installing. Deck keeps what was granted; each permission is defined by the layer that adds what it grants, and checked there, where the mod asks, by the page it asks from. A permission no layer on deck defines is refused.

## 6. Modules

Every file of the three libraries is one module: `DeckitModule.define(name, { uses, provides, runs }, make)`. Its name is its path under `source/deckit`, its library first. It names what it uses and what it provides; the registry hands each module a view of its uses that throws on any other name, and refuses a `make` that returns other names than it provides. A module does nothing until whoever starts it calls `start`.

Each library is in layers, and names go one way:

| Layer | What it is | May name |
|---|---|---|
| `deck/service/` | what deck does | deck's service, module, config |
| `deck/module/` | what it is built from, with no deckit in it | module |
| `deckit/feature/` | what the outside meets: the host app's entries, what connect answers (`feature/api`), what deckit gives a mod (`feature/mod`) | its feature, service, module, config, and deck's |
| `deckit/service/` | what deckit does | its service, module, config, and deck's |
| `deckit/module/` | what it is built from, with no deckit in it | module |
| `shell/feature/` | the shell's entries, the panel, the switcher | its feature, service and ui, and deck's and deckit's module |
| `shell/service/` | what the shell does: styles | its service, and deck's and deckit's module |
| `shell/ui/` | how it draws: the kit | ui |

`deck/config/` and `deckit/config/` are the host app's configuration (EMBEDDING.md), each what its library reads. Deck names nothing of deckit, and deckit nothing of the shell. The shell names nothing of the libraries under it but their modules, which have no deckit in them; the rest it reaches through what connect answers, handed to `attach` in main and to its page side by `boot`.

A concept's sides are `main.js` and `page.js`; a one-sided concept is `index.js`; `protocol.js` is how its own sides reach each other and nobody else's, and what its sides share otherwise is `model/`. A folder is a module (its files and `model/`) or a group (folders only).

Bundles are worked out from their entries: the main bundle from `deckit/feature/app/main`, the page bundle from `deckit/feature/app/page`, both carrying deck and deckit, the chord bundle, and the shell's `shell-main` and `shell-page` from `shell/feature/app/main` and `shell/feature/app/page`. A bundle carries what its entry names and what those name, each after what it names; a shell bundle leaves out what the bundle of the same process under it carries. `deckit check`, which the build runs first, holds every file to the rules above: one module a file, named for its path, the layers' direction, no channel named outside its concept and every channel its library's and declared once, where each file runs, every folder a module or a group.

## 7. One design system

The kit is the shell's, and the one way things look and behave in every page it draws (UI.md):

- One token, derived from the host app's theme: colours, type, radius, shadow, motion, and a code palette. The kit's stylesheet and every mod read it.
- One stylesheet: hover, press, focus and selection are the platform's states, drawn by rules.
- One overlay: what floats (a menu, a popover, a modal, a drag) is one stack that owns its order, the press outside, Escape and placement.
- One list: rows drawn by key, so what the pointer rests on and what has the focus stay put; one listbox for a list with a cursor.
- One shape for each kind of part: a maker takes one options object and returns `{ element, ...its controls }`, a decorator takes an element and returns its dispose, and a control draws the value it is set to and reports what was asked.

## 8. Data

- A rename renames everything, stored keys and channels included. Data written in an old shape is written again in the new one.
- A file of a mod's data edited by hand is read at the next start.

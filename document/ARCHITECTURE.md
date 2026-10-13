# How deckit is built

Deckit is a library a host app embeds. Its core is deck, which runs plugins and composes them. A plugin is what a person adds to the host app, the way a mod is added to a game: a view, a command, a few keys, a way to open an address, a library for other plugins, or work done in the app's main process, in any mix. deck runs each plugin from its entry and joins what it registers: its keys to the keymap, its commands to the switcher, its URL scheme handler to opening addresses, its exports to the plugins that require it. On deck, deckit gives basic views: the panel that shows the plugins with a view, the switcher, and the kit they draw with. They are built on deck and deck does not depend on them; a plugin runs whether or not the panel is shown. Where the panel is shown is the host app's, and every host app brings a shell to say so.

This document is why deckit is split the way it is, and the rules that keep it so. The contract a plugin is written against is [PLUGIN.md](PLUGIN.md); how a host app embeds deckit is [EMBEDDING.md](EMBEDDING.md); the kit plugins draw with is [UI.md](UI.md).

## 1. Principles

1. Deckit is whole by itself. `source/deckit` and the documents it ships (EMBEDDING, PLUGIN, UI) are all of it, and name nothing outside it. The package around it is for convenience: its commands check, build, run and ship deckit, with whatever tools serve.
2. A plugin can do what the host app can. Permissions say what a plugin reaches, and the person agrees to them; none is a dead end, and a main process module has the app's full power. A plugin draws its view as it likes; the kit is the quick way, not the only one.
3. Deckit owns only what it makes. The process, its menus and its windows are the host app's; deckit is handed what it needs through `host/config`, `host/folders`, `connect()` and `host/exports`.
4. A check happens once, where trust changes: main receiving from a page, deck receiving from a plugin's code, input from the disk or the network. Inside, each step trusts what the step before it made.
5. A fact has one owner. Everyone else asks it.
6. A folder is a module or a group. A name is the standard term of its field.

## 2. The library, the plugins, the host app

```
source/deckit/deckit       the library: deck, its views and the kit. Names no host app, not even its own
source/deckit/plugin       deckit's own plugins, Settings among them
source/deckit/deckit-app   Deckit.app: deckit embedded by itself, its shell framing every window
```

The package around deckit, `manifest.toml` and `source/cli`, is the commands that check, build, run and ship it (README.md). Deckit names none of it.

A new plugin needs no change to deck. A new shell to show the panel in needs no change to deckit.

## 3. Processes and pages

| Where | What runs there |
|---|---|
| main | deck: plugin folders and their main process modules, storage, the keymap, open, the switcher's relay, the views it puts in the host app's windows, every check of what a page asks |
| a plugin's sandbox | where one plugin's entry runs, headless or not: a page in a `WebContentsView` of its own at `deckit://<id>.plugin/`; a plugin with a view has the panel's frame around it there |
| the switcher's page | the quick switcher's list, at `deckit://switcher` |

A plugin's sandbox is a renderer and deck is in main. Each plugin's sandbox has its own origin, its own sessions and its own storage, so one plugin cannot reach another's page, data, cookies or what it was allowed. Main knows which plugin is asking by the page that asks (`service/deck/identity.js`): no page says who it is. A plugin's page is held to its origin; a link out of it is offered to its scheme's handlers.

The pages never speak to each other. Main carries everything between them, and every word is a channel declared once in its concept's `protocol.js` (`module/ipc`): `rendererToMain` for what a page asks or tells main, `mainToRenderer` for what main tells or asks a page. Main holds what arrives to the channel's fields; nothing else checks it. A question main asks a page ends when it is answered, when the page goes away, or when its time runs out. An error crosses with its kind.

## 4. One owner for each fact

| Fact | Owner |
|---|---|
| whether the panel is on screen, and where | the app's shell, asked through `feature/panel/main.js` |
| what a plugin's run is: its states, its transitions and what each tells | `service/plugin/lifecycle.js` |
| the plugins found, and their order | `service/deck/catalog.js` |
| which plugins run, each in its sandbox, and where each run is in its lifecycle | `service/deck/runner.js` |
| which plugin is on screen, and back and forward | `feature/panel/main.js` |
| what a plugin exports, its settings, its main process modules | `service/deck/export.js`, `setting.js`, `main-process.js` |
| which page is which plugin | `service/deck/identity.js` |
| what a keystroke means | `service/keymap/main.js`; a page only hears the chords it may act on |
| who opens an address | `service/open/main.js`, in the order the person set |
| what the switcher lists | `service/switcher/main.js`, from what each plugin's page supplies |
| a plugin's data, records and settings | main, under deckit's folder (below) |
| a plugin's web sign-ins | its own sessions, `persist:<id>:<plugin>:<name>` |
| what the person arranged (plugin order, key overrides, each scheme's handlers) | `state/` |

What a plugin is, `service/plugin` says: its manifest, its folder, its permissions, its entry and its lifecycle. deck, `service/deck`, runs plugins by it, and `service/plugin` names nothing of deck. The runner tells each transition of a run (`willLaunch`, `didLaunch`, `didFailToLaunch`, `willTerminate`, `didTerminate`); what follows a plugin's run (its exports, its settings, its main process modules, its events, its place in the panel) listens to those, or asks the run, and changes none of it.

Deckit's folder is `host/folders`' `home`, or `~/.config/<id>`:

```
plugins/        installed plugins, a folder each, named by id
data/<id>/      a plugin's own files (a main process module's notes, its workspaces)
records/<id>/   a plugin's records, one JSON file a key
settings/<id>.json
state/          what the person arranged, one JSON file a key
logs/
```

Everything deckit keeps is named from its configured id, so two host apps that embed deckit keep their data apart.

## 5. What a plugin is handed

A plugin reaches deck only through `deck`, what its `start` is handed (PLUGIN.md). Before a plugin runs, its sandbox's boot takes away every global the bundle added, and its entry runs with only `module` and `exports` in reach.

Between plugins there are two ways, and one question picks: could the host app do this if the other plugin were not there?

- If it could not, it is a dependency. A plugin names another in `requires` and calls what that one `exports`, through main. A dependency nobody wrote down cannot exist. What the host app offers (`host/exports`) is handed to the host app's own plugin, whose id is the host app's, and another plugin reaches it by requiring that one.
- If it could, it is a URL scheme handler. A plugin asks for an address to be opened (`deck.open(url)`) without knowing who answers. The plugins whose manifest names the scheme are its handlers and are asked in the order the person set, ahead of deck's own answer, which is always last.

Apart from both, a plugin says what happened to it through deck's events (`service/event`): `deck.emit(name)` is heard as `<its id>:<name>` by any plugin that listens, and no plugin speaks for another. Listening takes no dependency. The bus itself, listeners by name, is `module/event-bus`.

What reaches past a plugin's own sandbox (the clipboard, notices, any web address, another plugin's settings, the keymap, a main process module) is asked for by name in `permissions`, with a reason the person reads when installing. Main checks each one where the plugin asks, by the page it asks from.

## 6. Modules

Every file of the library is one module: `DeckitModule.define(name, { uses, provides, runs }, make)`. Its name is `deckit/` and its path. It names what it uses and what it provides; the registry hands each module a view of its uses that throws on any other name, and refuses a `make` that returns other names than it provides. A module does nothing until whoever starts it calls `start`.

The library is in four layers, and names go one way:

| Layer | What it is | May name |
|---|---|---|
| `feature/` | what the outside meets: the host app's entries, the panel, the switcher | feature, service, module, ui, config |
| `service/` | what deckit does | service, module, config |
| `module/` | what it is built from, with no deckit in it | module |
| `ui/` | how it draws | ui |

`config/` is the host app's configuration (EMBEDDING.md), which `feature/` and `service/` read.

A concept's sides are `main.js` and `page.js`; a one-sided concept is `index.js`; `protocol.js` is how its own sides reach each other and nobody else's, and what its sides share otherwise is `model/`. A folder is a module (its files and `model/`) or a group (folders only).

Bundles are worked out from their entries: the main bundle from `feature/app/main`, the page bundle from `feature/app/page`, the chord bundle. A bundle carries what its entry names and what those name, each after what it names. `deckit check`, which the build runs first, holds every file to the rules above: one module a file, named for its path, the layers' direction, no channel named outside its concept, where each file runs, every folder a module or a group.

## 7. One design system

The kit is the one way things look and behave in every page (UI.md):

- One token, derived from the host app's theme: colours, type, radius, shadow, motion, and a code palette. The kit's stylesheet and every plugin read it.
- One stylesheet: hover, press, focus and selection are the platform's states, drawn by rules.
- One overlay: what floats (a menu, a popover, a modal, a drag) is one stack that owns its order, the press outside, Escape and placement.
- One list: rows drawn by key, so what the pointer rests on and what has the focus stay put; one listbox for a list with a cursor.
- One shape for each kind of part: a maker takes one options object and returns `{ element, ...its controls }`, a decorator takes an element and returns its dispose, and a control draws the value it is set to and reports what was asked.

## 8. Data

- A rename renames everything, stored keys and channels included. Data written in an old shape is written again in the new one.
- A file of a plugin's data edited by hand is read at the next start.

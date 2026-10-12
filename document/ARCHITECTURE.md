# How deckit is built

Deckit is a library an app embeds, UI included: a host and the plugins it holds. The host finds plugin folders, gives each one its own page and what it may use, and owns the few things there can only be one of: the panel, the keyboard, the switcher. Everything a person uses is a plugin. Where the panel is shown is the app's, and every app brings a shell to say so.

This document is why deckit is split the way it is, and the rules that keep it so. The contract a plugin is written against is [PLUGIN.md](PLUGIN.md); how an app embeds deckit is [EMBEDDING.md](EMBEDDING.md); the kit plugins draw with is [UI.md](UI.md).

## 1. Principles

1. Deckit runs by itself. The package builds, checks and runs from its own sources; nothing outside it is named.
2. Deckit owns only what it makes. The process, its menus and its windows are the app's; deckit is handed what it needs through `app/config`, `app/folders`, `connect()` and `app/exports`.
3. A check happens once, where trust changes: main receiving from a page, the host receiving from a plugin's code, input from the disk or the network. Inside, each step trusts what the step before it made.
4. A fact has one owner. Everyone else asks it.
5. A folder is a module or a group. A name is the standard term of its field.

## 2. The library, the plugins, the app

```
source/deckit/deckit       the library: the host and the kit. Names no app, not even its own
source/deckit/plugin       deckit's own plugins, Settings among them
source/deckit/deckit-app   Deckit.app: deckit embedded by itself, its shell framing every window
source/deckit/deckit-cli   the command line an embedding app ships for its plugins
source/cli                 what builds, checks and runs deckit
```

A new plugin needs no change to the host. A new shell to show the panel in needs no change to deckit.

## 3. Processes and pages

| Where | What runs there |
|---|---|
| main | the host: plugin folders and their main halves, storage, the keymap, open, the switcher's relay, the views it puts in the app's windows, every check of what a page asks |
| a plugin's page | where one plugin's page half runs, headless or not, in a `WebContentsView` of its own at `deckit://<id>.plugin/`; a plugin with something to show has the panel's frame around it there |
| the switcher's page | the quick switcher's list, at `deckit://switcher` |

A plugin is a renderer and main is the host. Each plugin's page has its own origin, its own sessions and its own storage, so one plugin cannot reach another's page, data, cookies or what it was allowed. Main knows which plugin is asking by the page that asks (`service/plugin/identity`): no page says who it is. A plugin's page is held to its origin; a link out of it is handed to Open With.

The pages never speak to each other. Main carries everything between them, and every word is a channel declared once in its concept's `protocol.js` (`module/ipc`): `rendererToMain` for what a page asks or tells main, `mainToRenderer` for what main tells or asks a page. Main holds what arrives to the channel's fields; nothing else checks it. A question main asks a page ends when it is answered, when the page goes away, or when its time runs out. An error crosses with its kind.

## 4. One owner for each fact

| Fact | Owner |
|---|---|
| whether the panel is on screen, and where | the app's shell, asked through `feature/panel/main.js` |
| which plugins run, each in its page | `service/plugin/host/lifecycle.js` |
| which plugin is on screen, and back and forward | `feature/panel/main.js` |
| the plugins found, their order, their main halves, their settings and exports | `service/plugin/host` |
| which page is which plugin | `service/plugin/identity` |
| what a keystroke means | `service/keymap/main.js`; a page only hears the chords it may act on |
| who opens an address | `service/open/main.js`, in the order the person set |
| what the switcher lists | `service/switcher/main.js`, from what each plugin's page supplies |
| a plugin's data, records and settings | main, under deckit's folder (below) |
| a plugin's web sign-ins | its own sessions, `persist:<id>:<plugin>:<name>` |
| what the person arranged (plugin order, key overrides, Open With) | `state/` |

Deckit's folder is `app/folders`' `home`, or `~/.config/<id>`:

```
plugins/        installed plugins, a folder each
data/<id>/      a plugin's own files (a main half's notes, its workspaces)
records/<id>/   a plugin's records, one JSON file a key
settings/<id>.json
state/          what the person arranged, one JSON file a key
logs/
```

Everything deckit keeps is named from its configured id, so two apps that embed deckit keep their data apart.

## 5. What a plugin is handed

A plugin reaches the host only through `context` (PLUGIN.md). Before a plugin runs, its page's boot takes away every global the bundle added, so a plugin reaches deckit only through what it is handed.

Between plugins there are two ways, and one question picks: could the app do this if the other plugin were not there?

- If it could not, it is a dependency. A plugin names another in `requires` and calls what that one `exports`, through main. A dependency nobody wrote down cannot exist. What the app offers (`app/exports`) is handed to the app's own plugin, whose id is the app's, and another plugin reaches it by requiring that one.
- If it could, it is Open With. A plugin asks for an address to be opened (`host.open(url)`) without knowing who answers. The plugins whose manifest names the scheme answer in the order the person set, ahead of the host's own answer, which is always last.

What reaches past a plugin's own page (the clipboard, notices, any web address, another plugin's settings, the keymap, a main half) is asked for by name in `permissions`, with a reason the person reads when installing. Main checks each one where the plugin asks, by the page it asks from.

## 6. Modules

Every file of the library is one module: `DeckitModule.define(name, { uses, provides, runs }, make)`. Its name is `deckit/` and its path. It names what it uses and what it provides; the registry hands each module a view of its uses that throws on any other name, and refuses a `make` that returns other names than it provides. A module does nothing until whoever starts it calls `start`.

The library is in four layers, and names go one way:

| Layer | What it is | May name |
|---|---|---|
| `feature/` | what the outside meets: the app's entries, the panel, the switcher | feature, service, module, ui, config |
| `service/` | what deckit does | service, module, config |
| `module/` | what it is built from, with no deckit in it | module |
| `ui/` | how it draws | ui |

`config/` is the app's configuration (EMBEDDING.md), which `feature/` and `service/` read.

A concept's sides are `main.js` and `page.js` (the shape a plugin has); a one-sided concept is `index.js`; `protocol.js` is how its own sides reach each other and nobody else's, and what its sides share otherwise is `model/`. A folder is a module (its files and `model/`) or a group (folders only).

Bundles are worked out from their entries: the main bundle from `feature/app/main`, the page bundle from `feature/app/page`, the chord bundle, the command line's. A bundle carries what its entry names and what those name, each after what it names. `deckit check`, which the build runs first, holds every file to the rules above: one module a file, named for its path, the layers' direction, no channel named outside its concept, where each file runs, every folder a module or a group.

## 7. One design system

The kit is the one way things look and behave in every page (UI.md):

- One token, derived from the app's theme: colours, type, radius, shadow, motion, and a code palette. The kit's stylesheet and every plugin read it.
- One stylesheet: hover, press, focus and selection are the platform's states, drawn by rules.
- One overlay: what floats (a menu, a popover, a modal, a drag) is one stack that owns its order, the press outside, Escape and placement.
- One list: rows drawn by key, so what the pointer rests on and what has the focus stay put; one listbox for a list with a cursor.
- One shape for each kind of part: a maker takes one options object and returns `{ element, ...its controls }`, a decorator takes an element and returns its dispose, and a control draws the value it is set to and reports what was asked.

## 8. Data

- A rename renames everything, stored keys and channels included. Data written in an old shape is written again in the new one.
- A file of a plugin's data edited by hand is read at the next start.

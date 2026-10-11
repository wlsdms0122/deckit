# What deckit builds, and what it is made of

A design, not a description: the target the package is moved to in the steps of section 8. It
says what deckit hands out (a library, a command line and an app), how an app carries it (one
versioned archive), where deckit is in the package (one folder), and how the library inside is
cut (by layer: what a person and a plugin meet, what deckit does, what it is built from).
[CORE.md](CORE.md) stays the design of the contribution points, storage and web; what it says of
folders, files and layers is replaced by this.

## 1. Products

| product | what it is | made of | who takes it |
|---|---|---|---|
| **deckit-lib** | deckit for an app to embed: the library, its command line, and deckit's own plugins as a catalog | the registry; the bundles for each place it runs (main, the page, how a chord is spelled); the page; `deckit.json`; the command line (section 6); the documents whoever builds on it reads (EMBEDDING, PLUGIN, UI); `plugin/`, deckit's own plugins as the folders they are | an app that embeds deckit: SlacKit, and Deckit.app |
| **Deckit.app** | deckit on its own | deckit-lib, embedded by an app of deckit's own (a shell, a configuration), in Electron | a person |

Embedding needs nothing the library does not already have (the bundles, the load order,
`deckit.json`, EMBEDDING), so there is no second archive for it. The plugins are in the same
archive, beside the library and not in it: a plugin is a composition on the library, and which of
them an app ships is the app's pick, so an app that picks none has the library alone.

Deckit.app is built from the deckit-lib archive, unpacked and loaded exactly as SlacKit loads it.
So the embedding contract (the archive, the load order, `deckit.json`) has two takers, and one of
them is in this package: a Deckit.app that works is a deckit-lib that is enough on its own, and a
change that leans on something the archive does not carry fails here first.

Built into the package's `.build/`, the archive by `deckit build` and the app from it by `deckit
app`: an app is one taker of the archive, so making one is not a condition of the archive being
built.

```
.build/
  deckit-lib-<version>.tgz         and its .sha256
  Deckit.app
```

## 2. The package

`deckit` is the package's name, the project. Deckit itself is one folder in it, `source/deckit/`,
and everything else in the package is what makes the products out of that folder:

```
source/
  deckit/          deckit: copied anywhere, it is all of deckit
    deckit/        the library (section 3)
    deckit-app/    Deckit.app's own: its configuration, its shell, its Electron entry, its files' order
    deckit-cli/    the command line deckit offers: plugins installed, removed, listed, started (section 6)
    plugin/        deckit's own plugins: settings, note, editor, finder, browser
  cli/             the project's tools: build, app, check, dev, install, engine
    engine/        how the Editor's and the Notes' engine.js are built (npm, a lock, an entry each)
document/
```

The four folders under `source/deckit/` are not parallel to `source/cli/`: they are what deckit
is, and `cli/` is what builds, checks and runs it. So nothing in `source/deckit/` names a path
outside it, and `deckit check` refuses one that does: the folder is whole on its own. The engines'
recipes are in `cli/engine/`, not beside their plugins, because they are how a checked-in file is
made again (a plugin carries the `engine.js` it runs, and nothing of npm).

`plugin/` is beside the library, not in it: a plugin is a composition on the library (none names a
module of it, and the library names no plugin's id). `deckit-app/` and `deckit-cli/` are surfaces
over the library, each as thin as what it does, so neither is cut into layers inside: each names
the library's entries and the faces it needs, as any app that embeds deckit does.

Calendar is not deckit's: what it reads is a company's calendar, through a bridge deployed for it.
It is a plugin of SlacKit's own (`slackit/source/plugin/calendar/`, its Apps Script in `bridge/`).

## 3. Inside the library

### 3.1 Four layers

```
source/deckit/deckit/
  feature/       deckit's screens, and its entries
  service/       what deckit does
  module/        what deckit is built from
  ui/            how deckit draws: the token and the kit
```

The layers are the ones every package of ours is cut by (`package-layering-tiers`): Feature is
what the package shows on its surface, Service what it actually does, Module what that is built
from. Deckit is embedded, but it has its own screens, and what starts each process of it is a
screen: so feature is the screens and the entries, and everything else deckit does is a service
under them.

| layer | what is in it | in deckit |
|---|---|---|
| **feature** | the screens, and the entries that start them | `app` (deckit as an app: `main.js`, connect, the entry in an app's main process; `view.js`, the entry in a page, where the panel's or the switcher's page is put together), `panel` (the panel's screen, its view, putting it in a window), `switcher` (the switcher's screen, its view, summoning it), `window` (a deckit window: frame, bar, place remembered, a view placed in any window) |
| **service** | a mechanism deckit has, whatever shows it: what it does, and how it is reached across processes | `plugin` (the plugin system: folders, manifests, installing and removing, loading a plugin and its main half, what a plugin is handed, registering what it contributes), `keymap` (registering keys, keeping the person's changes, running a keystroke where it belongs, recording a chord; its screen is Settings, a plugin's), `open` (Open With), `web` (the pages a plugin shows: sessions, permissions, certificates, the windows a page opens), `switcher` (what can be jumped to, and carrying it to the switcher's screen), `notify` (a desktop notice and its click coming home), `runtime` (what this build is, restarting it), `storage`, `home` (deckit's configuration and folder), `log` (what deckit keeps of what it says) |
| **module** | what a service is built from, with no deckit in it | `registry`, `ipc`, `store`, `log`, `file`, `clipboard`, `query`, `chord` |
| **ui** | how a screen draws | `token` (the vocabulary of the look), `kit` (the components, drawn with it) |

A feature names services, modules, the kit and other features, and never knows how a service does
what it is asked: whether a call crosses to another process, and over which channel, is composed
inside the service. A service names services and modules, never a feature and never the kit: it
draws nothing. What a service needs of a screen it is handed by the feature that has one, the way
feature/app hands web and the plugin system deckit's window frame (`WEB.connect({ frame })`,
`PLUGINS.start({ frame })`) and hands the plugin system the panel each plugin's screen goes in
(`PLUGINS.build(…, { panel })`). A module names modules; the kit names the kit. Nothing names
feature/app: only an app does. `deckit check` holds all of it, and a screen file (`view.js`,
`view/`) anywhere but a feature.

### 3.2 A module says what it provides, and nothing else is there

A module names what it uses and declares what it provides:

```js
DeckitModule.define("deckit/service/keymap/server",
  { uses: ["deckit/module/log", ...], provides: ["globalSpec", "connect"] },
  (log, ...) => ({ globalSpec, connect }));
```

The registry holds both sides to it. What `make` returns is refused when its names are not
exactly `provides`, so the declaration cannot drift from the code. And what a user is handed is
not the object but a view of it that throws on any other name ("keymap/server provides no
`globalChrod`"), so a misspelled or stale member fails where it is read, the first time, by name,
rather than as an `undefined` called later. Names, not signatures: what each takes is said in the
comment above it.

### 3.3 A concept's channels are its protocol, and the only way across

A channel belongs to the concept whose fact it carries, and whoever speaks on it names that
concept's protocol. A protocol gives endpoints, not names. Each channel is declared once, with
which way it goes and what it carries, and the protocol module hands each side the end that side
may use:

```js
DeckitModule.define("deckit/service/notify/model/protocol", { uses: ["deckit/module/ipc"], provides: ["notify", "clicked"] },
  (IPC) => ({
    // page -> main, asked and answered: { id, title, body, silent } -> whether it was shown
    notify: IPC.ask("deckit:notify", { id: "string", title: "string", body: "string", silent: "boolean" }),
    // main -> the page that asked
    clicked: IPC.tell("deckit:notify-click", { id: "string" }),
  }));
```

In main, `notify.answer(fn)` and `clicked.send(webContents, payload)`; in a page, `notify.ask(payload)`
and `clicked.hear(fn)`; a page telling main is a `report` (`send` in a page, `hear` in main), and
an ask a page needs answered in the same pass is asked `now`. The end a side is not given does
not exist there. What crosses is checked against the declared fields at both ends, so a field
renamed on one side fails at the first message, by channel and field. `deckit check` refuses
`ipcMain` and `ipcRenderer` anywhere but the module that wraps them, and a `"deckit:` string
anywhere but a protocol, which is in its concept's `model/`. A feature's own protocol carries
only its screen's two halves (the panel coming up, the switcher put away); what a service carries
is the service's, and a feature never names it.

### 3.4 A concept: a core file, what supports it in folders

A concept is a folder, and the file another concept reaches it by is at its root, named for what
it is to the rest; what that file is made of is in folders under it, named for what they hold.
Where a file runs follows from its name where its name says it; where it does not, its define
declares it (`runs`: `"main"`, `"page"`, `"node"` for plain Node, main and the command line,
`"electron"` for main and a page, `"any"`), and the check holds both to the bundles that carry it
and to what it requires:

| | runs in | what it is |
|---|---|---|
| `server.js` | main | the side in main of a concept that crosses processes (a service; a module such as the clipboard), which keeps its state and answers |
| `client.js` | a page | its side in a page, which asks it: what a screen or a plugin calls |
| `main.js`, `view.js` | main, a page | a feature's two halves: its view in main, its screen in a page; no other layer has them |
| `index.js` | declared | a concept of one side: the folder is the module (`deckit/module/chord`, `deckit/service/storage`) |
| `model/` | declared | what the sides share: `protocol.js` (the channels between them), and the rules and shapes both hold (`storage/model/space.js`, `plugin/model/manifest.js`, `keymap/model/global.js`) |
| `server/`, `client/`, `main/`, `view/` | as the file they make up | the parts of that file, the concept's own |

A concept's face is its root files and its `model/`: what another concept may name. Its
`model/protocol.js` is not: its channels are how its own sides reach each other, and a concept
that names another's knows how that one is reached, which is the other's to hide (the app's
entries, which put the pages together, are the one exception). A file in any other folder of it is
the concept's own, and `deckit check` refuses another concept naming one, so the face is a boundary
and not a pass-through. A file at the root named for what it does (`plugin/install.js`,
`plugin/folder.js`, `query/ranker.js`) is face too, and declares where it runs.

What is still one file holding a concept whole is split by what is in it:

| file | becomes |
|---|---|
| `feature/panel/view.js` (884 lines) | `view/screens.js` (the screens and which is on show), `view/history.js` (back and forward), `view/chrome.js` (how it is presented, the bar's inset, the glass), `view/sidebar.js`; the contract in its header goes to PLUGIN.md (CORE step 6) |
| `service/plugin/client.js` (822) | `client/load.js` (reading and compiling a plugin), `client/order.js`, `client/context.js` (what make() is handed), `client/grants.js` (what each permission hands over), `client/sessions.js`, `client/half.js` (the way to a plugin's main half), `client/settings.js`, `client/contribute.js` (registering with the panel, the switcher, the keymap and open) |
| `service/plugin/server.js` (600) | `server/folders.js` (finding them, which one wins), `server/data.js`, `server/half.js` (loading a main half); `install.js`, `remove.js` and `model/manifest.js` as they are |
| `feature/window/main.js` (505) | `main/frame.js` (a deckit window: glass, bar, place remembered), `main/place.js` (a view in any window) |

The exact cut is made reading each file, and where a responsibility turns out to be one with
another the two stay one file; the table is what each is expected to hold.

### 3.5 The order of a bundle is worked out, not written

Every module names what it uses, so the order a bundle's files go in is already said: each after
what it names. The build reads it from there, starting at the entries (`feature/app/main.js`
for main, `feature/app/view.js` for the page, what deckit-cli's commands name for its bundle), and
a module started for what it does rather than for what it provides (the clipboard's server) is
named by the entry that starts it. There is no list of files to keep in step with the files, and no `bundle.js`: the
library says what it is by its entries.

## 4. deckit-lib

One archive, `deckit-lib-<version>.tgz`, with its sha256 beside it. What its `deckit.json` says:

| | |
|---|---|
| `version` | the package's |
| `api` | the plugin contract it speaks |
| `source` | a hash of the sources it was built from (no time: the same sources make the same bytes) |
| `bundles` | per bundle: its file, and the modules it `defines`, each with what it `provides` and its `face` |
| `page` | the panel's page |
| `cli` | the command line, `deckit-cli/deckit-cli` |
| `plugins` | the ids in the catalog |

The bundles (`registry`, `chord`, `cli`, `main`, `page`) are joined from the library only. An app
loads them as EMBEDDING.md section 1 says, and runs `deckit-cli/` beside them for its plugins. Its `document/` is what whoever builds on the library reads:
EMBEDDING (how to load it and what to hand it), PLUGIN (the contract the plugin system holds
plugins to), and UI (the kit).

`plugin/` is deckit's own plugins, each the folder it is, as a catalog. Which of them an app ships
is the app's: its `bundle.js` names them (`deckitPlugins`), and an app that names none ships none.
SlacKit and Deckit.app name all five.

An app keeps the archive and nothing else of deckit's:

```
slackit/source/deckit/deckit-lib-1.0.0.tgz
```

It takes a new one with a command of its own (`slackit deckit <archive>`): the archive's sha256
is checked against the one beside it where it was built, and the archive is copied in, replacing
the one before. Its build and its development shell unpack it into a cache keyed by its hash and
the pick (`.build/deckit/<key>/`) and read it from there, so the tree holds one file that changes
as a whole. A bundle SlacKit hands on carries the archive as it is. The development shell watches
the archive and says when a new one needs it started again.

## 5. Deckit.app

`source/deckit/deckit-app/`, an app like any embedding one, with nothing of another app in it,
built from the deckit-lib archive as SlacKit is (section 1):

- `config.js`: `app/config` with `id: "deckit"`, `name: "Deckit"` (data in `~/.config/deckit`),
  `restore` saying the app's own way back for a removed plugin.
- `shell.js`: the shell of EMBEDDING.md section 2, for a panel that is always in a window of its
  own. `start` puts the panel in its window (`presentInWindow`); closing the window hides the
  panel and the Dock icon brings it back (`activate`); the switcher comes up in front of that
  window; `showsPanel` is whether the keystroke landed in it; `noticeClicked` brings it forward;
  `restart` relaunches. The window is the glass one decided for a deckit of its own: `hud`
  material, the panel's glass at 0.68. There is no panel key: the panel is the app, so there is
  nothing for one to bring up, and a key that brings up a panel laid over another app is that
  app's to offer, through its own plugin (SlacKit's, `global`, PLUGIN.md).
- `main.js`: the Electron entry: the registry, the configuration, deckit's main bundle, the shell,
  `connect`. At launch it installs the plugins it ships (all of the catalog) through the plugin
  system's rule for what a product ships.
- `assets`: the page loaded over a scheme of the app's own (`deckit://`), registered as standard
  and secure before the app is ready, so the page has an origin and its storage persists.

Made by `deckit app` from the archive: Electron 44.4.5 (the version SlacKit runs on, so a plugin
meets one Electron, fetched once by npx), its app copied, the app's folder put together from the
archive in `Contents/Resources/app`, named (bundle name and display name Deckit, identifier
`dev.deckit.app`; the executable keeps Electron's name, which its helpers are found by), and signed
ad hoc. `deckit dev` runs the same folder the same way: it builds deckit-lib from the sources, puts
the folder together from it, runs Electron on it, and does it again when a source changes, so deckit
has a development loop of its own and the loop goes through the archive like everything else.
Which of the two ways the app runs is decided once, in `main.js`: started by Electron's default app
(`deckit dev`) it keeps its data in the package's `.dev/`, reads the plugins where they were
unpacked and is restarted by the loop; as Deckit.app it installs the plugins it ships and restarts
itself.

## 6. deckit-cli

Installing a plugin folder into deckit's folder is something deckit does, whichever app it is in:
so the command line for it is deckit's, and it ships in the archive (`deckit-cli/`). It is run with
the configuration of the app it is for (`--config`: its id decides the folder) and the plugin
folders that app ships (`--ship`):

| | |
|---|---|
| `where` | deckit's folder, and where plugins are installed |
| `list` | what is installed, and what each would be refused for |
| `install <folder>…` | a plugin folder, held to what the app loads, installed |
| `remove <id> [--data]` | taken away, and what it stored only when asked (`service/plugin/remove.js`, the rule Settings removes by) |
| `ship` | the plugins the app ships, by the rule: updated, new ones installed, a removed one left out |
| `restore <id>…` | a plugin the app ships brought back after it was removed |
| `new <id> --in <folder> [--main]` | a plugin started: the folder, the manifest and a view that runs, from `deckit-cli/template/` |
| `manifest <folder> [<field>]` | what a folder's manifest says, held to what the app loads |
| `data [<folder>]` | what is stored, counted as the app counts it |

Its commands are a module of their own (`cli/commands`) naming the library's faces, and the
`cli` bundle is what they name, worked out like the others (3.5). An app's own command line names
it rather than doing its jobs again: `slackit plugins` is `deckit-cli ship` (or `restore`) with
SlacKit's configuration and plugin folders, `slackit new` is `deckit-cli new`, and
`deckit plugins` is the installed Deckit.app's own `deckit-cli restore`.

## 7. What does not change

The plugin contract (folder, manifest, `context`, permissions), the shell contract, the load order
an embedding app follows, and what a person sees in the panel.

## 8. Order

Done: the package and its archive; things where they belong (the page's keys into the keymap, the
channels in the wrong concept, the shipped-plugin rule into the plugin system); modules that
declare (`provides`, a protocol for every concept that speaks across, a concept named only by its
face); Deckit.app (the shell, the configuration, the page's scheme, `deckit dev`, packaging,
`deckit install`); Calendar out to SlacKit, and the panel key out to SlacKit's plugin.

5. **Deckit in one folder, by layer** (2, 3.1, 3.5) (done). `source/deckit/` with the library,
   the app and the plugins in it; every module renamed by its layer; what went the wrong way
   turned around (3.1); `deckit check` holding the direction and the folder's edge; the bundles'
   order worked out from `uses`, and `bundle.js` gone; SlacKit naming the new names.
6. **deckit-cli** (6), and SlacKit's command line naming it (done).
7. **The layers as they are meant, and the names** (3.1, 3.4) (done). Feature is the screens
   and the entries (`feature/app` for what was the way in); the plugin system, notices and what
   was `app` are services (`runtime`); a service's sides are `server.js` and `client.js`, a
   one-sided concept's face is `index.js`, what the sides share is in `model/`; the kit is
   `ui/kit` over `ui/token`; the switcher's entries are the service's to carry, and its screen
   knows none of the channels.
8. **Files by responsibility** (3.4), with CORE step 6 (the contract in PLUGIN.md, the comments,
   the names), since both rewrite the same files.

Then the rest of CORE step 1 (a plugin's storage as `values` and `records`).

Each step ends measured: check, the node loads, SlacKit's development shell and deckit's own, and
the screens counted as before.

## 9. Taken as the default, open to change

- deckit's own plugins are a catalog an app picks from; SlacKit and Deckit.app ship all five.
- An embedding app keeps the archive alone, with no lock beside it: what a lock would say (the
  version, the contract, the hash) the archive already does.
- Deckit.app's identifier is `dev.deckit.app`, its icon is Electron's until there is one, and it is
  signed ad hoc like SlacKit.
- Deckit.app installs the plugins it ships at launch, by the same rule an embedding app's installer
  follows, so a plugin removed in Settings stays removed.
- Deckit.app sets no theme: the page draws in deckit's own dark colours, which the `hud` window
  under it always is.
- Deckit.app runs once: a second launch brings the panel forward, and closing the window leaves the
  app running until it is quit.
- There is no core layer under module: nothing in deckit is so general that it would be used as it
  is by a package that is not deckit's, the registry and the channels included.
- A concept cut across two layers keeps its name in both (`feature/switcher`, `service/switcher`):
  its screen in one, what it lists in the other.

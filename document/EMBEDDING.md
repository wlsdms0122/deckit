# How a host app embeds deckit

Deckit is a library a host app embeds, in three layers: deck, the engine that runs mods, deckit, the platform on deck, and a shell, the surface a person uses it through. A host app connects deckit and puts deckit's own shell on it (the panel, the switcher and the kit), or a shell of its own built on what connect answers. It brings what deckit cannot know: its configuration, its folders, its answers about the process and where the shell is shown, and the mods it ships. This is the line between them.

## 1. The archive

A host app embeds one archive, `deckit-<version>.tgz`, with its sha256 beside it, in an Electron of its own: deckit is made against Electron 44. It keeps the archive as built and unpacks it where it builds and runs. The same sources, built with the same Swift, make the same archive, byte for byte, so its hash says which deckit it is.

| In the archive | |
|---|---|
| `deckit.json` | the version, the mod contract it speaks (`api`), the hash of its sources, the scheme deckit's pages load from (`scheme`, as `SCHEME` of `main.js` is), each bundle's file and, for a renderer's, the global it leaves, the core's executable (`core`), the mods |
| `deckit` | the core: deckit's own process, an executable for Macs of either kind (macOS 13 or later). Deckit starts it as the host app is ready and it ends with the host app's process |
| `main.js` | deck and deckit in main, a CommonJS module: `{ SCHEME, connect }` |
| `shell-main.js` | deckit's shell in main, a CommonJS module: `{ attach }` |
| `renderer.js` | deck and deckit in the renderer of every deckit page, each mod's and each that runs no mod. It leaves one global, `DeckitRenderer`: `{ boot }` |
| `shell-renderer.js` | deckit's shell in a renderer. It leaves one global, `DeckitShellRenderer`: `{ page, mod }` |
| `mods/<id>/` | deckit's own mods, each with its entry bundled, a catalog the host app picks from |
| `document/` | this, MOD.md and UI.md |

In main the host app requires `main.js` and, to put deckit's shell on deckit, `shell-main.js`. A deckit page loads, as its preload, a file the host app puts together:

```js
const before = new Set(Object.keys(globalThis));
// renderer.js, then shell-renderer.js, as they are
DeckitRenderer.boot({ before, shell: DeckitShellRenderer });
```

`before` is the Set of the names the page's global object had before the bundles ran, so boot takes away every global they added. A host app with a shell of its own puts its renderer side in place of `shell-renderer.js` and hands it to `boot` as `shell` (section 4); with no shell on deckit, it leaves `shell` out.

## 2. The configuration

`connect` takes the host app's configuration in two objects. `config`, read by deck and deckit:

| Key | What it is | Deckit's own |
|---|---|---|
| `id` | what everything deckit keeps is named from: its folder, its sessions and its state | `deckit` |
| `name` | what a person reads | `Deckit` |
| `agent` | names the host app adds to its user agent, taken out of the agent of a page a mod shows | none |
| `schemeHandlers` | by scheme, the mods asked first to open an address, until the person orders them | none |

`folders`, deck's:

| Key | What it is | Deckit's own |
|---|---|---|
| `home` | deckit's folder | `~/.config/<id>` |
| `ship` | the mod folders the host app ships, deckit's own it picks and its own, each a mod like any other; installed at every start, and a removed one stays removed. One that does not install fails alone and the next start tries it again: with no copy of it installed it does not load and Settings shows why, and an installed copy goes on running | none |
| `sources` | folders that hold mod folders, read in place ahead of installed ones (for a development build) | none |

A key deckit does not read stops `connect` with its name. A page holds none of it: what a page needs of it, main answers.

## 3. The host and the shell

Deck runs mods; deckit's shell makes the views they are seen in. Where those are shown is the host app's, the way a browser decides whether a page goes in a tab or a window while the page stays the same. There is one panel, wherever the host app puts it. Mods live in it: the host app is there before the panel.

Every window is the host app's: its frame, its bar, where it opens. Deckit makes none; a window it needs is asked of the host app. The panel is drawn as glass, clear where nothing is drawn, so the host app puts it over something that blurs: a window with vibrancy, or a surface of its own.

In main, before the host app is ready:

```js
const DECKIT = require('<deckit>/main.js');
const SHELL = require('<deckit>/shell-main.js');
protocol.registerSchemesAsPrivileged([DECKIT.SCHEME, ...theAppsOwn]);
const deckit = DECKIT.connect({ preload, core, host, config, folders });
SHELL.attach(deckit, { host });
```

`SCHEME` is the entry for the scheme deckit's pages load from, with its privileges. Electron takes privileged schemes in one call to `registerSchemesAsPrivileged`, and a later call replaces an earlier one, so deckit's scheme is in the host app's call, beside its own; a host app that registers before it loads deckit's bundles reads the scheme from `deckit.json`. `preload` is the file the host app put together for deckit's pages (section 1), and `core` the archive's `deckit` where the host app unpacked it, executable. A host app that signs what it ships signs `deckit` with it, as any executable of its own; one in the App Sandbox gives it `com.apple.security.inherit`. Deckit's bundles hold all they read: they may be loaded from anywhere, joined to the host app's own code or not.

`connect` is called once, with `preload` and `core`, the host app's answers about what of deckit is its own and its configuration (section 2); `attach`, once, with what connect answered and the host app's answers about where the shell is shown. One object may answer both. Either throws and names what is missing.

What the host app answers deckit:

| | |
|---|---|
| `openWindow({ view, title, size, key, place })` | a window deckit needs for a view: a mod's window, a web page in a window, a page's popup. The host app makes it, frames it, puts `view` in it by calling `place(window, { bounds })`, and returns it at once. `size` is the view's. `key` names a window that is the same one each time it opens (a mod's), so the host app can open it where it was left |
| `notificationClicked()` | a notification a mod raised was clicked |
| `restart()` | the host app restarts: the process is its own |

What the host app answers deckit's shell:

| | |
|---|---|
| `start(controls)` | once the host app is ready, before any mod launches, with what of the shell the host app drives: its views and their windows. A mod's `deck` is another object |
| `showsPanel(webContents)` | whether the panel is what is in front where a keystroke landed |
| `show()` | "show me": a mod's `deck.show()`, a switcher choice |
| `dismiss()` | "put it away": Escape with nothing else to close |
| `summonSwitcher(webContents)` | the switcher's chord, pressed in that page |
| `panelTitled(title)` | the panel's title changed: the name of the mod in front, or the host app's name when none is |

When the host app quits, once every window has closed, deck holds the quit at `will-quit` until every mod's `stop()` has answered, two seconds at most each, and deckit until the main process modules of those runs have ended (`dispose`, two seconds at most each), and then asks for the quit again: it goes on as any quit does, `quit` and all. The host app's `before-quit` and `will-quit` listeners hear both. While a mod runs, the first `will-quit` is deck's hold, and while a main process module is still ending, the next one is deckit's: the host app calls the quit off at the first `before-quit` or at a later pass, and with nothing running there is one pass. A quit the host app calls off leaves the mods that stopped for it stopped, and the next quit stops the runs that started since. A core that has ended holds no quit. A restart the host app makes is a quit too, `app.relaunch()` and then `app.quit()`; `app.exit()` skips every `stop()`. The process ends with code 0; a host app that ends it with another calls `app.exit(code)` from its `quit` listener. `openWindow` can be asked as mods load, and `panelTitled` before `start`.

The keyboard in a window is the host app's to give. macOS hands it to a window's own page each time the window comes forward, so a host app whose views are not that page gives it to the view: the switcher's page while it is open, else `controls.panel.focus()` for the panel, and the view's page for a window it opened.

What `controls` holds:

| | |
|---|---|
| `controls.panel` | `glass`, the strength the panel lays its colour over the blur at, for a surface beside it to match; `place(window, { bounds, onClose })`, which puts it in one of the host app's windows as deckit's `window.place` does (so a mod's main process module can find the window its view is in); `contains(webContents)`, whether a webContents is a page the panel shows or a web page in one; `show()`, `hide()`, `shown()`, `focus()`; `leave()` and `arrive()`, the exit and the entrance around a move the host app makes; `present({ floating, dismissible, titleBar })`. `hide()` resolves whether the panel had the keyboard, `leave()` false when the move was given up: the panel was put away on the way, or a newer move replaced it |
| `controls.setTheme(theme)` | the host app's colours, for every page the shell draws. Each page takes a new one in place: no mod launches again |
| `controls.switcher` | `place(window, { front, onClose })`, which the host app calls with `front` where it was summoned; `contains(webContents)`, whether a webContents is the switcher's page; `focus()`; `open()`, resolving true when it was put away; `close()`, `shown()`; `chord()`, the chord that summons it now as a person reads it, or `''` |

Moving the panel is a re-parent: mods keep their sandboxes and what they hold, and none is told where the panel is. `present` is all the panel learns of where it is: whether it floats over something (rounded and ringed) or fills a window, whether Escape with nothing else to close puts it away, and, filling a window whose title bar lies over the panel's top, `titleBar: { height, controlsWidth }`: the bar's height and the width the window's buttons take at its start. The sidebar and the content then reach up under the bar: the sidebar's top drags the window, and the content's is the mod's title bar area (MOD.md, `deck.view`).

`setTheme` gives the shell the host app's colours: `{ contentBg, contentColor, border, font }`. Every page the shell draws derives its look from it (UI.md) and takes a new one in place: no mod launches again and no page loads again. Deckit.app gives a light or a dark theme as the system's appearance is, and gives it again as that changes.

## 4. What connect answers

What connect answers is all a host app, or the shell on deckit, reaches of deckit in main; deckit's shell is built with nothing else. It is the same object for a host app with a shell of its own. Every fact it hands out (a manifest, a run, its summary) is a frozen copy.

| | |
|---|---|
| `config` | `{ id, name }` |
| `onStart(listener)` | told once as deckit starts, before any mod launches; handed over before the host app is ready. One that throws is logged, and the mods run anyway |
| `permissions` | `define({ id, name, means, reach })`: a permission that grants what the shell adds, which a mod's manifest may then ask for. `reach` is `system` for what reaches past the app and `app` for what stays inside it; a person reads the first before the second. Defined before the host app is ready, when deckit's core starts and reads the manifests against them; after, it throws. One defined twice, or with another `reach`, is refused as the core starts: deckit logs why, and the core, not started, refuses all that is asked of it |
| `mods` | `list()`, every loaded mod's manifest in the person's order, `onChange(listener)`, which answers its off, `arrange(ids)`, the mods named taking, in the order given, the places they held among themselves while the rest stay put, answering a promise settled once `list()` has the new order; `runs()`, each mod's latest run with the view its page is in (deck sets nothing of how the view looks: whoever puts it in a window sets its background and whether it is visible), `runOf(id)`; `listingOf(id)`, how a mod is listed (`{ icon, keywords }`) as its latest run that launched said, kept while it launches again, or null; `observe(name, observer)` for a lifecycle notification (`notifications` lists them) of every run, answering its off; `modOf(webContents)`, the id of the mod a page is, or null; `managerFrom(webContents)`, the id of that mod if it has `deckit.mods`, and otherwise it throws; `relaunchAll()`, every running mod terminated and launched again; `restartPending()`, `[{ id, why }]`, the mods whose main process modules only a restart of the app finishes (MOD.md, A main process module), whose change `onChange` hears too. A run is `{ mod, number, state, summary, contributions, problem, relaunches }` (MOD.md, Lifecycle) |
| `pages` | `make(name)`, a view at `deckit://<name>/` for a page that runs no mod, which the shell draws (`page(name, context)` on its renderer side); `nameOf(webContents)`; `whenEnds(webContents, undo)`, `undo` called once as that page navigates away, crashes or goes, answering its off; it takes a deckit page's webContents (a mod's, or one `make` made), and throws for any other; `isPressing(webContents)`, whether a person is pressing in that page now or just pressed, so what it tells is theirs and not its code's; `isPointing(webContents)`, the same of the mouse alone |
| `keymap` | `register({ action, key, label, global, run })`, a key of the shell's own, which works once deckit's core has taken it; `chordOf(action)`, the chord one of those is bound to now, as a person reads it, or `''`; `listen(webContents, { keys })`, so a page of the host app's own hears deckit's keys, and `keys`, `[{ key, run }]`, are that page's own chords, taken there first once deckit's core has read them; `delegate({ isActive, monitor })`: `isActive(page)`, whether a deckit page is the one in front, where a mod's own keys and the shell's run, and `monitor(page, input)`, which sees a keystroke in it before any key and takes it by answering true |
| `commands` | what mods offer to be run. `session()` answers a promise of one caller's session, which asks the mods that offered it as the session began: `list()`, a promise of their commands in the mods' order, `now()` and `resolve(raw)`, a promise for each mod, as each answers, `search(entryId, raw)` for the entries an entry opens, `run(entryId)`, and `end()`, after which its entries are gone; another session never touches them. An entry is the mod's with `id`, `kind` (`command`, `now`, `resolved`, or `submenu` from `search`) and `mod: { id, name }`. `tones` is how a readout says its state |
| `state` | `read(key, fallback)`, `write(key, value)`: what the host app and its shell keep of the person's, in `state/host/`, apart from deckit's own, from `onStart` on. `read` answers at once; `write` answers a promise, kept once deckit's core has the value. A key is lower case letters, digits, `.`, `_` and `-`, starting with a letter or a digit, at most 64, and a write of another is refused and logged. The host app and its shell share the keys: deckit's shell keeps `panel-frame`, `panel-pinned` and `switcher-use`, so a host app with it keeps keys of other names |
| `web` | `pageFor(webContents)`, the deckit page a web page answers to; `holdsKeyboard(page)`, whether the keyboard is in that deckit page or a web page in it |
| `window` | `place(view, window, { bounds, front, onClose })`, which puts a view in one window at a time and takes it out alive before the window closes; `bounds` is a rect, or a function of the window's content size that the view follows |
| `log` | `info`, `warn`, `error`, `guard(emitter, event, listener)` |
| `channels` | `bind(declared)`: a channel of the shell's own between main and its pages. `declared` is `{ channel, to, fields, reply, sync }`: `channel` its name; `to`, `main` for what a page asks or tells main, `page` for what main asks or tells a page; for `main`, `fields`, what a page may send, each `string`, `number`, `boolean`, `object`, `array` or `any`, ending in `?` when it may be absent; `reply`, whether it is answered; `sync`, for `main` with `reply`, whether the page waits for the answer at once. In main it answers `handle(answer)` or `on(listener)` for what a page asks or tells, and `invoke(page, payload, { timeout })` or `send(page, payload)` for what main asks or tells a page; main holds what a page sends to `fields`. A channel is declared once: one of deckit's own, one ending `:answer`, or one bound to another declaration, is refused. A question main asks a page is heard from the page's start and waits for its answer; what main tells a page before it listens is not kept. What a listener throws goes to deckit's log |

On a page, the shell is what the host app hands `boot` as `shell`: `page(name, { channels })` draws a page it made, and `mod(context)` is what it gives each mod as deckit runs it. `channels` binds the shell's channels in the page, as `channels` does in main, the other way round: `invoke(payload)` or `send(payload)` toward main, `handle(answer)` or `on(listener)` for what main asks or tells. `context` is `{ mod, chordOf, deliver, fail, channels }`: the mod's manifest; `chordOf(action)`, the chord a key registered with `keymap.register` is bound to now, by its action; `deliver(what, listener, ...args)`, which calls a function of the mod's and records a throw or a rejection on the mod's row; and `fail(problem)`, which records a problem there. `mod(context)` answers:

| | |
|---|---|
| `members` | the members of the entry it reads, besides deckit's `icon` and `keywords`; an entry with a member no layer reads does not start |
| `deck` | the members it adds to `deck` |
| `registrations` | the registrations it adds, by name, each a check that answers why a value is refused, or `''` |
| `mods` | what it adds to `deck.mods` for a mod with `deckit.mods` |
| `blocksKeys()` | whether a key pressed now is dropped, as while something floats over the page |
| `keyProblem(key, parts)` | why a key would never run, or `''`, with `parts` what `start` registered |
| `contribute(parts, entry)` | called once `start` has ended, with what it registered and the entry: mounts what the shell shows and answers `{ summary, contributions }`, what main is told of the mod, which a run carries as its `summary` and `contributions`. One that throws leaves the mod unstarted |

That is how deckit's shell hands a mod `theme`, `ui`, `show`, `region`, `children`, the registrations `view` and `styles`, and the pins on `mods`, and how a view is laid in its page where the panel's frame leaves it room. What deckit gives a mod is never replaced by what the shell gives.

The host app and its shell reach deckit through these, and nothing else of deckit's: their own listeners and their own files are their own.

## 5. Deckit.app

Deckit.app is deckit embedded by itself, the way any host app embeds it: its own configuration, answers that keep the panel in one window of its own with the switcher in front of it, and an Electron entry that calls `connect` and puts deckit's shell on deckit. It ships deckit's own mods. Its windows carry a bar that is always there: the window's own page, across the top and under the views, in the panel's colour at the panel's `glass` so the two read as one surface. To macOS it is the title bar, so it drags, snaps and answers a double click as the person set. The panel's window is the exception: the panel fills it, the bar's height included, so the page under it is the colour alone, and the panel drags the window from the top of its sidebar, from where the window's buttons stand, and from the bars mods lay there. Run unpackaged, from a folder Electron's default app loads, it keeps all its data in the folder `DECKIT_DATA` names and asks for a restart by exiting with 75, for whoever started it to start it again.

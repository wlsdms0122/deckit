# How a host app embeds deckit

Deckit is a library a host app embeds, in three layers: deck, the engine that runs mods, deckit, the platform on deck, and a shell, the surface a person uses it through. A host app makes the environment deckit runs on, Electron's, connects deckit to it and puts deckit's own shell on it (the panel and the kit). It brings what deckit cannot know: its configuration, its folders, its answers about the process and where the shell is shown, and the mods it ships. This is the line between them.

## 1. The archive

A host app embeds one archive, `deckit-<version>.tgz`, with its sha256 beside it, in an Electron of its own: deckit is made against Electron 44. It keeps the archive as built and unpacks it where it builds and runs. Its sha256 checks that the archive is the one sent. Which deckit it is, `deckit.json` says, by its version and the hash of its sources (`source`), and deckit's log says the same as it starts, and the core's first line, `core: started, pid <pid>`, that the core is running.

| In the archive | |
|---|---|
| `deckit.json` | the version, the mod contract it speaks (`api`), the hash of its sources, the Swift that built the core (`swift`), the scheme deckit's pages load from (`scheme`, as `SCHEME` of `main.js` is), each bundle's file and, for a renderer's, the global it leaves, the core's executable (`core`), the mods |
| `deckit` | the core: deckit's own process, an executable for Macs of either kind (macOS 13 or later). Deckit starts it as the host app is ready and it ends with the host app's process |
| `main.js` | the environment deckit runs on in main, Electron's, a CommonJS module: `{ SCHEME, environment }` |
| `shell-main.js` | deckit in main: deck, deckit and its shell, a CommonJS module: `{ connect, attach }` |
| `renderer.js` | what Electron gives every deckit page, each mod's and each that runs no mod. It leaves one global, `DeckitRenderer`: `{ boot }` |
| `shell-renderer.js` | deckit on a page: deck and deckit, and the shell's pages and what it gives a mod. It leaves one global, `DeckitShellRenderer`: `{ start }` |
| `mods/<id>/` | deckit's own mods, each with its entry bundled, a catalog the host app picks from |
| `document/` | this, MOD.md, UI.md and GUIDELINES.md |

In main the host app requires `main.js`, the environment, and `shell-main.js`, deckit. A deckit page loads, as its preload, a file the host app puts together:

```js
const before = new Set(Object.keys(globalThis));
// renderer.js, then shell-renderer.js, as they are
const environment = DeckitRenderer.boot({ before });
if (environment) DeckitShellRenderer.start(environment);
```

`before` is the Set of the names the page's global object had before the bundles ran, so boot takes away every global they added. `boot` answers what Electron gives the page, or null on a page off deckit's scheme, and `start` runs deckit on the page with it.

## 2. The configuration

`connect` takes the host app's configuration in two objects. `config`, read by deck and deckit:

| Key | What it is | Deckit's own |
|---|---|---|
| `id` | what everything deckit keeps is named from: its folder, its sessions and its state | `deckit` |
| `name` | what a person reads | `Deckit` |
| `agent` | names the host app adds to its user agent, taken out of the agent of a page a mod shows | none |
| `schemeHandlers` | by scheme, the mods the host app places in that scheme's handler list, in order, until the person orders them (MOD.md, `urls`) | none |

`folders`, deck's:

| Key | What it is | Deckit's own |
|---|---|---|
| `home` | deckit's folder | `~/.config/<id>` |
| `ship` | the mod folders the host app ships, deckit's own it picks and its own, each a mod like any other; installed at every start, and a removed one stays removed. One that does not install fails alone and the next start tries it again: with no copy of it installed it does not load and Settings shows why, and an installed copy goes on running | none |
| `sources` | folders that hold mod folders, read in place ahead of installed ones (for a development build) | none |

A key deckit does not read stops `connect` with its name. A page holds none of it: what a page needs of it, main answers.

## 3. The host and the shell

Deck runs mods; deckit's shell makes the views they are seen in. Where those are shown is the host app's, the way a browser decides whether a page goes in a tab or a window while the page stays the same. There is one panel, wherever the host app puts it. Mods live in it: the host app is there before the panel.

Every window is the host app's: its frame, its bar, where it opens. Deckit makes none; a window it needs is asked of the host app. The panel is drawn as glass, clear where nothing is drawn, so the host app puts it over something that blurs: a window with vibrancy, or a surface of its own. A mod's window is the host app's too, shown and put away through the shell's `showWindow` and `hideWindow`; its page may draw as glass, as the Switcher's does, so an overlay window blurs what is behind it (Deckit.app: `openFloating`, vibrancy `hud`).

In main, before the host app is ready:

```js
const ELECTRON = require('<deckit>/main.js');
const DECKIT = require('<deckit>/shell-main.js');
protocol.registerSchemesAsPrivileged([ELECTRON.SCHEME, ...theAppsOwn]);
const environment = ELECTRON.environment({ preload, core, host });
const deckit = DECKIT.connect(environment, { host, config, folders });
DECKIT.attach(deckit, { host });
```

`SCHEME` is the entry for the scheme deckit's pages load from, with its privileges. Electron takes privileged schemes in one call to `registerSchemesAsPrivileged`, and a later call replaces an earlier one, so deckit's scheme is in the host app's call, beside its own; a host app that registers before it loads deckit's bundles reads the scheme from `deckit.json`. `preload` is the file the host app put together for deckit's pages (section 1), and `core` the archive's `deckit` where the host app unpacked it, executable. A host app that signs what it ships signs `deckit` with it, as any executable of its own; one in the App Sandbox gives it the two keys of a child, `com.apple.security.app-sandbox` and `com.apple.security.inherit`. Under the hardened runtime it needs no entitlement. Deckit's bundles hold all they read: they may be loaded from anywhere, joined to the host app's own code or not.

`environment` is called once, with `preload`, `core` and the host app's answer for a window; `connect`, once, with what `environment` answered, the host app's answers about what of deckit is its own and its configuration (section 2), which it hands the environment what it needs of; `attach`, once, with what connect answered and the host app's answers about where the shell is shown. One object may answer all three. Each throws and names what is missing: `connect` holds what it is handed to what deckit needs of an environment (`deckit-shell/environment`).

What the host app answers the environment:

| | |
|---|---|
| `openWindow({ view, title, size, key, place })` | a window deckit needs for a view: a mod's window, a web page in a window, a page's popup. The host app makes it, frames it, puts `view` in it by calling `place(window, { bounds })`, and returns it at once. `size` is the view's. `key` names a window that is the same one each time it opens (a mod's), so the host app can open it where it was left |

What the host app answers deckit:

| | |
|---|---|
| `notificationClicked()` | a notification a mod raised was clicked |
| `restart()` | the host app restarts: the process is its own |

What the host app answers deckit's shell. A page is a page token, which the environment hands out and the host app hands back: in Electron's, a webContents.

| | |
|---|---|
| `start(controls)` | once the host app is ready, before any mod launches, with what of the shell the host app drives: its views and their windows. A mod's `shell` is another object |
| `showsPanel(page)` | whether the panel is what is in front where a keystroke landed |
| `show()` | "show me": a mod's `shell.show()`, the shell's `show` command |
| `dismiss()` | "put it away": Escape with nothing else to close |
| `panelTitled(title)` | the panel's title changed: the name of the mod in front, or the host app's name when none is |
| `showWindow(control)` | a mod's window comes on screen: the host app makes or brings forward a window for it and puts the mod's page in it with `control.place`, the page `width` by `height` and the window that and any bar the host app draws |
| `hideWindow(control)` | a mod's window goes away |

A mod's window control is the same object from run to run: `{ mod, name, width, height, overlay, place(window, { front, bounds, onClose }), contains(page), focus(), didResignKey() }`. `overlay` asks for a window over every app's; `didResignKey()` is the host app telling the mod the keyboard left the window. A window the host app closes puts the mod's away.

When the host app quits, once every window has closed, deck holds the quit at `will-quit` until every mod's run has ended, `detach()` and `stop()` two seconds at most each, and deckit until the main process modules of those runs have ended (`dispose`, two seconds at most each), and then asks for the quit again: it goes on as any quit does, `quit` and all. The host app's `before-quit` and `will-quit` listeners hear both. While a mod runs, the first `will-quit` is deck's hold, and while a main process module is still ending, the next one is deckit's: the host app calls the quit off at the first `before-quit` or at a later pass, and with nothing running there is one pass. A quit the host app calls off leaves the mods that stopped for it stopped, and the next quit stops the runs that started since. A core that has ended holds no quit. A restart the host app makes is a quit too, `app.relaunch()` and then `app.quit()`; `app.exit()` skips every end. The process ends with code 0; a host app that ends it with another calls `app.exit(code)` from its `quit` listener. `openWindow` can be asked as mods load, and `panelTitled` before `start`.

The keyboard in a window is the host app's to give. macOS hands it to a window's own page each time the window comes forward, so a host app whose views are not that page gives it to the view: `controls.panel.focus()` for the panel, `control.focus()` for a mod's window, and the view's page for a window it opened.

What `controls` holds, `{ setTheme, panel }`:

| | |
|---|---|
| `controls.panel` | `glass`, the strength the panel lays its colour over the blur at, for a surface beside it to match, and the panel lays it under itself too, so a page of the host app's under it lays none; `place(window, { bounds, onClose })`, which puts it in one of the host app's windows as the environment's `window.place` does (so a mod's main process module can find the window its view is in); `contains(page)`, whether a page is one the panel shows or a web page in one; `show()`, `hide()`, `shown()`, `focus()`; `leave()` and `arrive()`, the exit and the entrance around a move the host app makes; `present({ floating, dismissible, titleBar })`. `hide()` resolves whether the panel had the keyboard, `leave()` false when the move was given up: the panel was put away on the way, or a newer move replaced it |
| `controls.setTheme(theme)` | the host app's colours, for every page the shell draws. Each page takes a new one in place: no mod launches again |

Moving the panel is a re-parent: mods keep their sandboxes and what they hold, and none is told where the panel is. `present` is all the panel learns of where it is: whether it floats over something (rounded and ringed) or fills a window, whether Escape with nothing else to close puts it away, and, filling a window whose title bar lies over the panel's top, `titleBar: { height, controlsWidth }`: the bar's height and the width the window's buttons take at its start. The sidebar and the content then reach up under the bar: the sidebar's top drags the window, and the content's is the mod's title bar area (MOD.md, `shell.view.register`).

`setTheme` gives the shell the host app's colours: `{ contentBg, contentColor, border, font }`. Every page the shell draws derives its look from it (UI.md) and takes a new one in place: no mod launches again and no page loads again. Deckit.app gives a light or a dark theme as the system's appearance is, and gives it again as that changes.

## 4. What connect answers

What connect answers is all a host app, or the shell on deckit, reaches of deckit in main; deckit's shell is built with nothing else. Every fact it hands out (a manifest, a run, its summary) is a frozen copy. Nothing of Electron's is in it: what hands out or takes Electron's views and objects is the environment's, for a host app alone (below).

| | |
|---|---|
| `config` | `{ id, name }` |
| `onStart(listener)` | told once as deckit starts, before any mod launches; handed over before the host app is ready. One that throws is logged, and the mods run anyway |
| `core` | `onDown(listener)`: `listener(why)` told once deckit's core answers nothing more, as it ended or did not start, and at once when that is so already, answering its off. Deckit's shell then covers the panel and asks the person to restart the app |
| `restart()` | the host app restarts, as `restart` it answered deckit |
| `attach()` | the shell's, once, as it is attached: each mod's run that starts from then on has the shell's screen lifecycle stacked on deckit's, its `attach(shell, deckit)` called with the theme, the kit and its view laid by the panel. Without it the mods run with deckit's lifecycle alone, and nothing calls `attach` |
| `permissions` | `define({ id })`: the shell gives a permission the mod contract names (MOD.md, permissions), which guards what it adds; one the contract does not name throws. Defined before the host app is ready, when deckit's core starts and reads the manifests against them; after, it throws. A permission the contract names that no layer on the host defines is not usable there, and a mod that asks for it runs without what it guards. Deckit's shell defines `system.overlay-windows`, `deckit.styles` and `deckit.fonts` |
| `mods` | `list()`, every loaded mod's manifest in the load order (MOD.md, Load order), `onChange(listener)`, which answers its off, `arrange(ids)`, the mods named taking, in the order given, the places they held among themselves in the load order while the rest stay put, answering a promise settled once `list()` has the new order, and refused for an order that puts a mod that loads before one it requires or while `deck.json` does not read; `runs()`, each mod's latest run with its `page`, `runOf(id)`; `listingOf(id)`, the frozen summary of its latest run once that run has read the mod's class, or else of its latest run that launched, kept while it launches again, or null: deckit's `keywords`, `commands` and `urls` (the manifest's patterns, once a lifecycle registered a URL handler), and the shell's `icon`, `form`, `view`, `sidebar`, `parent`, `styles` and `window`, `view` absent until the screen lifecycle has joined; `observe(name, observer)` for a lifecycle notification (`notifications` lists them) of every run, answering its off; `modOf(page)`, the id of the mod a page is, or null; `managerFrom(page)`, the id of that mod if it has `deckit.mods`, and otherwise it throws; `relaunch(id)`, the mod terminated and launched again, or launched when it is not running, and the mods that require it loaded again with it, answering a promise settled once each has launched or failed to, one launched while a mod it requires is not running failing as it launches; `relaunchAll()`, every mod that loads terminated and loaded again, answering a promise settled once each has launched or failed to; a mod launched again loads its page anew from its folder, and its manifest and main process modules as deckit last read them; `restartPending()`, `[{ id, why }]`, the mods whose main process modules only a restart of the app finishes (MOD.md, A main process module), whose change `onChange` hears too. A run is `{ mod, number, state, summary, contributions, problem, relaunches }` (MOD.md, The run), and `didJoin` tells of one whose summary changed as a lifecycle joined or ended |
| `pages` | `stage()`, a stage to lay pages on (below). A page is a token: whatever answers or takes one hands it back and never reads it. Each of the rest takes a page of deck's (a mod's, or one that runs none) or a surface one opened, and throws for any other. `open(name, { keepsDrawing, reloadsOnCrash, surfaces })`, a page at `deckit://<name>/` that runs no mod, which the shell draws on the page (`shell-renderer.js`), what its console says as an error logged under its name: `keepsDrawing`, it lays out while hidden too; `reloadsOnCrash`, a renderer that crashed is loaded again; `surfaces`, `{ names, onOpen(name, page) }`, the documents it may open with `window.open('', name)`, each once at a time, each a page of its own that runs no code and goes nowhere, which a document loaded again in its place finds open by its name; it opens nothing else. `close(page)`; `focus(page)`; `isAlive(page)`, whether it is still there; `whenFocused(page, listener)`, heard each time it takes the keyboard, answering its off; `nameOf(page)`; `whenEnds(page, undo)`, `undo` called once as that page navigates away, crashes or goes, answering its off; `isPressing(page)`, whether a person is pressing in that page now or just pressed, so what it tells is theirs and not its code's; `isPointing(page)`, the same of the mouse alone |
| `keymap` | `register(provider, { name: { label, key, scope, run } })`, keys of the host app's or the shell's own under an `@` name, `run()` what pressing one does, answering a promise settled once deckit's core has taken them and rejected with why it did not (no label, no `run`, a scope there is not). Each works by its `scope`, `local` (the default) in the page in front, `app` anywhere in the app, and `global` in every app too, where the system gives the app its chord, run in the page that has the keyboard or, in another app, with no page; on one chord the narrowest scope runs where it works, a mod's own key in its page before the shell's; `chordOf(provider, name)`, the chord one of those is bound to now, as a person reads it, or `''`; `listen(page, { keys })`, so a page (one of deckit's, or one of the host app's own) hears deckit's keys, and `keys`, `[{ key, run }]`, are that page's own chords, taken there first once deckit's core has read them; `delegate({ isActive, monitor })`: `isActive(page)`, whether a deckit page is the one in front, where a mod's own keys and the shell's run, and `monitor(page, keystroke)`, which sees a key pressed in it before any key and takes it by answering true: `keystroke` is `{ code, meta, control, alt, shift }`, copied as it lands |
| `commands` | `register(provider, commands)`, the commands of the host app or its shell, under an `@` name (`@app` the host app, `@shell` the shell), as a mod's are (MOD.md, `deckit.commands.register`), answering a promise settled once deckit's core has them; `list()`, every command, the app's first, then the mods' in the load order; `run({ provider, command }, args)`, resolving to the command's result; `complete({ provider, command }, param, partial, { args, signal })`; `onChange(listener)`, which answers its off. The shell's is `@shell.show({ mod })`, which puts the mod on screen and completes `mod`; its keys are `toggleSidebar`, `back` and `forward` |
| `provider` | `provider(id)`, who declares keys or commands as `id`, `{ id, name, host }`: a host that registered a command or a key, by the name it gives, or a mod deck loads; null for neither |
| `state` | `read(key, fallback)`, `write(key, value)`: what the host app and its shell keep of the person's, in `state/host/`, apart from deckit's own, from `onStart` on. `read` answers at once; `write` answers a promise, kept once deckit's core has the value. A key is lower case letters, digits, `.`, `_` and `-`, starting with a letter or a digit, at most 64, and a write of another is refused and logged. The host app and its shell share the keys: deckit's shell keeps `panel-frame`, `panel-pinned` and `panel-order`, so a host app with it keeps keys of other names |
| `web` | `pageFor(page)`, the deckit page a page answers to: itself, or the one a web page it is in is shown in; `holdsKeyboard(page)`, whether the keyboard is in that deckit page or a web page in it |
| `log` | `info`, `warn`, `error` |
| `channels` | `bind(declared)`: a channel of the shell's own between main and its pages. `declared` is `{ channel, to, fields, reply, sync }`: `channel` its name; `to`, `main` for what a page asks or tells main, `page` for what main asks or tells a page; for `main`, `fields`, what a page may send, each `string`, `number`, `boolean`, `object`, `array` or `any`, ending in `?` when it may be absent; `reply`, whether it is answered; `sync`, for `main` with `reply`, whether the page waits for the answer at once. In main it answers `handle(answer)` or `on(listener)` for what a page asks or tells, and `invoke(page, payload, { timeout })` or `send(page, payload)` for what main asks or tells a page; main holds what a page sends to `fields`. A channel is declared once: binding the same declaration again binds the same channel, and one deckit binds as its own, or another declaration of a name bound already, is refused; each is answered once. A question main asks a page is heard from the page's start and waits for its answer for as long as main waits; what main tells a page before it listens is not kept. What a listener throws goes to deckit's log, in main and on a page |

What the environment answers beside what deckit is handed, for a host app alone:

| | |
|---|---|
| `viewOf(page)` | the Electron view a page of deck's, or a surface, is in: `viewOf(run.page)` for a mod's page from `mods.runs()`, and `viewOf(deckit.pages.open(name))` for a page that runs no mod. Deck sets nothing of how the view looks: whoever puts it in a window sets its background and whether it is visible |
| `owns(webContents)` | whether a webContents is one of deckit's: a page of deck's, a surface, or a web page a mod shows and the ones it opens |
| `window.place(view, window, { bounds, front, onClose })` | puts a view in one window at a time and takes it out alive before the window closes; `bounds` is a rect, or a function of the window's content size that the view follows |
| `guard(emitter, event, listener)` | an Electron emitter's listener whose throw is logged |

What Electron lets one set per webContents, deckit sets on its own and keeps: what a `window.open` becomes (`setWindowOpenHandler`), and what its sessions grant (`setPermissionRequestHandler`, `setPermissionCheckHandler`). A host app that sets these on every webContents or session it is told of needs no exception for deckit's: what it set before deckit is replaced, and a call after is left out, and the first of each logged as a warning. Where they may navigate deckit guards with listeners of its own, beside any of the host app's. Its webContents are its to load as well: a host app that reloads every webContents, as a watcher may in development, leaves out those `owns` answers true for, since a mod whose page anyone but deckit loads again has ended, its page gone. `owns` answers from the moment Electron tells of a webContents (`app`'s `web-contents-created`), in that event too.

A stage, made by `pages.stage()`, is where the shell lays pages in a host app's window, each a page of deck's or a surface one opened:

| | |
|---|---|
| `place(window, { bounds, front, onClose })` | puts the stage in one of the host app's windows, one window at a time: `bounds` a rect, or a function of the window's content size that it follows; `front`, over what is in the window already; `onClose()`, called once it is out of a closing window |
| `size()` | `{ width, height }`, as it is laid in its window |
| `whenResized(listener)` | heard each time its size changes, answering its off |
| `show(on)` | whether it is on screen |
| `lay(layers)` | the pages on it, each `{ page, rect }`, laid at `rect` (`{ x, y, width, height }` on the stage), or `{ page, hidden: true }`, unseen. The pages laid are in the order given, bottom to top; a hidden one keeps the place it has, and a new one goes in over the layer before it. A page left out, or whose page is gone, is taken off; each is clear where it draws nothing. A layer with both a rect and `hidden`, or neither, and a page that is not one of deck's, are refused |

On a page, deckit's shell is part of deckit: `shell-renderer.js` draws the pages the shell made, reads each mod's `icon` and `form`, and stacks its screen lifecycle on deckit's, calling `attach` with the handle `shell` (MOD.md, shell); a view is laid in its page where the panel's frame leaves it room. What deckit gives a mod is never replaced by what the shell gives.

The host app and its shell reach deckit through these, and nothing else of deckit's: their own listeners and their own files are their own.

## 5. Deckit.app

Deckit.app is deckit embedded by itself, the way any host app embeds it: its own configuration, answers that keep the panel in one window of its own and each mod's window in one of its own, and an Electron entry that makes the environment, `ELECTRON.environment({ preload, core, host })`, calls `connect` with it and puts deckit's shell on deckit. It ships deckit's own mods. The switcher is the Switcher mod, in an overlay window over every app, kept where it was moved to and opened from any app by its own global key (`alt+space`), or by its command `show`, which a button of the host app's runs with `commands.run({ provider: 'switcher', command: 'show' })`. Its windows carry a bar that is always there: the window's own page, across the top and under the views, in the panel's colour at the panel's `glass` so the two read as one surface. To macOS it is the title bar, so it drags, snaps and answers a double click as the person set. The panel's window is the exception: the panel fills it, the bar's height included, so the page under it is clear and the panel's glass the window's only colour, and the panel drags the window from the top of its sidebar, from where the window's buttons stand, and from the bars mods lay there. Run unpackaged, from a folder Electron's default app loads, it keeps all its data in the folder `DECKIT_DATA` names and asks for a restart by exiting with 75, for whoever started it to start it again.

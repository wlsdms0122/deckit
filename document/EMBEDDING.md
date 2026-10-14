# How a host app embeds deckit

Deckit is a library a host app embeds, UI included: deck, its core, which runs mods and composes what they contribute, and the basic views built on it. The host app brings what deckit cannot know: its configuration, its folders, a shell that says where deckit is shown, and, if it wants, what it offers its own mod. This is the line between the two.

## 1. The archive

A host app embeds one archive, `deckit-<version>.tgz`, with its sha256 beside it, in an Electron of its own: deckit is made against Electron 44. It keeps the archive as built and unpacks it where it builds and runs. The same sources make the same archive, byte for byte, so its hash says which deckit it is.

| In the archive | |
|---|---|
| `deckit.json` | the version, the mod contract it speaks (`api`), the hash of its sources, the scheme deckit's pages load from (`scheme`, as `DECKIT.SCHEME` is), each bundle's file and the modules it defines, the mods |
| `registry.js` | the module registry: first wherever deckit runs, and the one global deckit adds |
| `main.js` | the main process bundle |
| `page.js` | the bundle of every deckit page: each mod's, and the switcher's |
| `chord.js` | how a chord is spelled and matched, for a page of the host app's that shows one of deckit's chords |
| `mod/<id>/` | deckit's own mods, each with its entry bundled, a catalog the host app picks from |
| `document/` | this, MOD.md and UI.md |

In main the host app loads `registry.js`, its own `host/config` and `host/folders`, `main.js`, then its shell. A deckit page loads, as its preload, a file the host app puts together: `registry.js`, the host app's `host/config` (and `host/exports`, if it has one), `page.js`, and the start of deckit: `DeckitModule.use(['deckit/feature/app/page'], (APP) => APP.boot(before))`, where `before` is the names the page's global object had before `registry.js` ran, so boot takes away every global the bundles added.

The host app's own files are modules too: `DeckitModule.define(name, { uses, provides, runs }, make)`. What `host/config` and `host/folders` set is held to what deckit reads: a key deckit does not read stops the bundle with its name.

## 2. The configuration

`host/config`, read in every process:

| Key | What it is | Deckit's own |
|---|---|---|
| `id` | what everything deckit keeps is named from: its folder, its sessions, its state, and the id of the host app's own mod | `deckit` |
| `name` | what a person reads | `Deckit` |
| `agent` | names the host app adds to its user agent, taken out of the agent of a page a mod shows | none |
| `schemeHandlers` | by scheme, the mods asked first to open an address, until the person orders them | none |

`host/folders`, read where there is a disk:

| Key | What it is | Deckit's own |
|---|---|---|
| `home` | deckit's folder | `~/.config/<id>` |
| `ship` | the mod folders the host app ships; installed at every start, and a removed one stays removed. One that does not install fails alone and the next start tries it again: with no copy of it installed it does not load and Settings shows why, and an installed copy goes on running | none |
| `sources` | folders that hold mod folders, read in place ahead of installed ones (for a development build) | none |

## 3. The shell

Deckit makes its views. Where they are shown is the host app's shell's, the way a browser decides whether a page goes in a tab or a window while the page stays the same. Every host app brings its own shell, and there is one panel, wherever the shell puts it. Mods live in it: the shell is there before the panel.

Every window is the host app's: its frame, its bar, where it opens. Deckit makes none; a window it needs for a view of its own is asked of the shell. The panel is drawn as glass, clear where nothing is drawn, so the shell puts it over something that blurs: a window with vibrancy, or a surface of the host app's.

In main, before the host app is ready:

```js
protocol.registerSchemesAsPrivileged([DECKIT.SCHEME, ...theAppsOwn]);
DECKIT.connect({ preload, shell });
```

`SCHEME` is the entry for the scheme deckit's pages load from, with its privileges. Electron takes privileged schemes in one call to `registerSchemesAsPrivileged`, and a later call replaces an earlier one, so deckit's scheme is in the host app's call, beside its own; a host app that registers before it loads deckit's bundles reads the scheme from `deckit.json`. `preload` is the file the host app put together for deckit's pages (section 1). Deckit's bundles hold all they read: they may be loaded from anywhere, joined to the host app's own code or not.

What a shell answers:

| | |
|---|---|
| `start(deckit)` | once the host app is ready, with what of deckit the shell drives: its views and their windows. A mod's `deck` is another object |
| `showsPanel(webContents)` | whether the panel is what is on screen where a keystroke landed |
| `reveal()` | "show me": a mod's `deck.show()`, a switcher choice |
| `dismiss()` | "put it away": Escape with nothing else to close |
| `summonSwitcher(webContents)` | the switcher's chord, pressed in that page |
| `openWindow({ view, title, size, key, place })` | a window deckit needs for a view of its own: a mod's window, a web page in a window, a page's popup. The shell makes it, frames it, puts `view` in it by calling `place(window, { bounds })`, and returns it at once. `size` is the view's. `key` names a window that is the same one each time it opens (a mod's), so the shell can open it where it was left |
| `panelTitled(title)` | the panel's title changed: the name of the mod in front, or the host app's name when none is |
| `noticeClicked()` | a notice deckit raised was clicked |
| `restart()` | the host app restarts: the process is the host app's |

`connect` is called once, with `preload` and a shell that answers every one of these; otherwise it throws and names what is missing. When the host app quits, once every window has closed, deck holds the quit at `will-quit` until every mod's `stop()` has answered, two seconds at most each, and then asks for the quit again: it goes on as any quit does, `quit` and all. The host app's `before-quit` and `will-quit` listeners hear both. While a mod runs, the first `will-quit` is deck's hold: the host app calls the quit off at the first `before-quit` or at the second pass, and with no mod running there is one pass. A quit the host app calls off leaves the mods that stopped for it stopped, and the next quit stops the runs that started since. A restart the shell makes is a quit too, `app.relaunch()` and then `app.quit()`; `app.exit()` skips every `stop()`. The process ends with code 0; a host app that ends it with another calls `app.exit(code)` from its `quit` listener. `openWindow` and `panelTitled` can be asked as mods load, before `start`.

The keyboard in a window is the shell's to give. macOS hands it to a window's own page each time the window comes forward, so a shell whose views are not that page gives it to the view: the switcher's page while it is open, else `deckit.panel.focus()` for the panel, and the view's page for a window it opened.

What `deckit` holds:

| | |
|---|---|
| `deckit.panel` | `glass`, the strength the panel lays its colour over the blur at, for a surface beside it to match; `view()`, the panel's container, which the shell places in a window with `deckit.window.place` (so a mod's main process module can find the window its view is in); `contains(webContents)`, whether a webContents is a page the panel shows or a web page in one; `show()`, `hide()`, `shown()`, `focus()`; `leave()` and `arrive()`, the exit and the entrance around a move the shell makes; `present({ floating, dismissible, titleBar })`. `hide()` resolves whether the panel had the keyboard, `leave()` false when the move was given up: the panel was put away on the way, or a newer move replaced it |
| `deckit.setTheme(theme)` | the host app's colours, for every deckit page |
| `deckit.switcher` | `view()`, which the shell puts in front where it was summoned; `open()`, resolving true when it was put away; `close()`, `shown()`; `chord()`, the chord that summons it now as a person reads it, or `''` |
| `deckit.window` | `place(view, window, { bounds, front, onClose })`, which puts a view in one window at a time and takes it out alive before the window closes; `bounds` is a rect, or a function of the window's content size that the view follows |
| `deckit.keymap` | `listen(webContents)`: a page of the host app's own that should hear deckit's global keys |

Moving the panel is a re-parent: mods keep their sandboxes and what they hold, and none is told where the panel is. `present` is all the panel learns of where it is: whether it floats over something (rounded and ringed) or fills a window, whether Escape with nothing else to close puts it away, and, filling a window whose title bar lies over the panel's top, `titleBar: { height, controlsWidth }`: the bar's height and the width the window's buttons take at its start. The sidebar and the content then reach up under the bar: the sidebar's top drags the window, and the content's is the mod's title bar area (MOD.md, `deck.view`).

The shell reaches deckit through `connect` and the `deckit` it is handed, and nothing else of deckit's: its own listeners and its own files are its own.

`setTheme` gives deckit the host app's colours: `{ sidebarBg, sidebarColor, border, contentBg, contentColor, font }`. Every deckit page derives its look from it (UI.md) and is made again when it changes, headless mods' sandboxes included.

## 4. The host app's own mod, and what the host app offers

What a person does with the host app from the panel is the host app's own mod: the one whose id is the host app's. It ships with the host app and can be removed like any other. That is all that sets it apart: it alone is handed what the host app offers, the page module `host/exports`, as `deck.host`, and it may export that on. A mod that wants the host app requires that mod like any other. In another host app a mod with that id is handed nothing.

It may stand first among a scheme's handlers (`schemeHandlers`, and the scheme in its manifest's `url-schemes`): it opens the addresses it knows and passes the rest on. Deckit never asks whose an address is.

## 5. Deckit.app

`source/deckit/deckit-app` is deckit embedded by itself, the way any host app embeds it: its own `host/config` and `host/folders`, a shell that keeps the panel in one window of its own with the switcher in front of it, and an Electron entry that calls `connect`. It ships deckit's own mods, `deckit` among them, which is therefore its own mod (section 4): what a person does with Deckit.app is what they ask of deck. Its windows carry a bar that is always there: the window's own page, across the top and under the views, in the panel's colour at the panel's `glass` so the two read as one surface. To macOS it is the title bar, so it drags, snaps and answers a double click as the person set. The panel's window is the exception: the panel fills it, the bar's height included, so the page under it is the colour alone, and the panel drags the window from the top of its sidebar, from where the window's buttons stand, and from the bars mods lay there. Run unpackaged, from a folder Electron's default app loads, it keeps all its data in the folder `DECKIT_DATA` names and asks for a restart by exiting with 75, for whoever started it to start it again.

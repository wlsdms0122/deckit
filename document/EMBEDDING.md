# How a host app embeds deckit

Deckit is a library a host app embeds, UI included: deck, its core, which runs plugins and composes what they contribute, and the basic views built on it. The host app brings what deckit cannot know: its configuration, its folders, a shell that says where deckit is shown, and, if it wants, what it offers its own plugin. This is the line between the two.

## 1. The archive

A host app embeds one archive, `deckit-lib-<version>.tgz`, with its sha256 beside it. It keeps the archive as built and unpacks it where it builds and runs. The same sources make the same archive, byte for byte, so its hash says which deckit it is.

| In the archive | |
|---|---|
| `deckit.json` | the version, the plugin contract it speaks (`api`), the hash of its sources, each bundle's file and the modules it defines, the page, the command line, the plugins |
| `registry.js` | the module registry: first wherever deckit runs, and the one global deckit adds |
| `main.js` | the main process bundle |
| `page.js`, `page.html` | every deckit page: each plugin's, and the switcher's. `page.js` is the page bundle |
| `chord.js` | how a chord is spelled and matched, for a page of the host app's that shows one of deckit's chords |
| `cli.js` | what deckit's command line asks of the library, in Node |
| `deckit-cli/` | the command line for the plugins in deckit's folder |
| `plugin/<id>/` | deckit's own plugins, each with its entry bundled, a catalog the host app picks from |
| `document/` | this, PLUGIN.md and UI.md |

In main the host app loads `registry.js`, its own `host/config` and `host/folders`, `main.js`, then its shell. A deckit page loads, as its preload, a file the host app puts together: `registry.js`, the host app's `host/config` (and `host/exports`, if it has one), `page.js`, and the start of deckit: `DeckitModule.use(['deckit/feature/app/page'], (APP) => APP.boot(before))`, where `before` is the names the page's global object had before `registry.js` ran, so boot takes away every global the bundles added.

The host app's own files are modules too: `DeckitModule.define(name, { uses, provides, runs }, make)`. What `host/config` and `host/folders` set is held to what deckit reads: a key deckit does not read stops the bundle with its name.

## 2. The configuration

`host/config`, read in every process:

| Key | What it is | Deckit's own |
|---|---|---|
| `id` | what everything deckit keeps is named from: its folder, its sessions, its state, and the id of the host app's own plugin | `deckit` |
| `name` | what a person reads | `Deckit` |
| `agent` | names the host app adds to its user agent, taken out of the agent of a page a plugin shows | none |
| `schemeHandlers` | by scheme, the plugins asked first to open an address, until the person orders them | none |

`host/folders`, read where there is a disk:

| Key | What it is | Deckit's own |
|---|---|---|
| `home` | deckit's folder | `~/.config/<id>` |
| `ship` | the plugin folders the host app ships; installed at every start, and a removed one stays removed | none |
| `sources` | folders that hold plugin folders, read in place ahead of installed ones (for a development build) | none |

## 3. The shell

Deckit makes its views. Where they are shown is the host app's shell's, the way a browser decides whether a page goes in a tab or a window while the page stays the same. Every host app brings its own shell, and there is one panel, wherever the shell puts it. Plugins live in it: the shell is there before the panel.

Every window is the host app's: its frame, its bar, where it opens. Deckit makes none; a window it needs for a view of its own is asked of the shell. The panel is drawn as glass, clear where nothing is drawn, so the shell puts it over something that blurs: a window with vibrancy, or a surface of the host app's.

In main, before the host app is ready:

```js
protocol.registerSchemesAsPrivileged([DECKIT.SCHEME, ...theAppsOwn]);
DECKIT.connect({ preload, shell });
```

`SCHEME` is the entry for the scheme deckit's pages load from, with its privileges; Electron takes privileged schemes in one call, which the host app makes. `preload` is the file the host app put together for deckit's pages (section 1).

What a shell answers:

| | |
|---|---|
| `start(deck)` | once the host app is ready, with what of deck the shell drives |
| `showsPanel(webContents)` | whether the panel is what is on screen where a keystroke landed |
| `reveal()` | "show me": a plugin's `deck.show()`, a switcher choice |
| `dismiss()` | "put it away": Escape with nothing else to close |
| `summonSwitcher(webContents)` | the switcher's chord, pressed in that page |
| `openWindow({ view, title, size, key, place })` | a window deckit needs for a view of its own: a plugin's window, a web page in a window, a page's popup. The shell makes it, frames it, puts `view` in it by calling `place(window, { bounds })`, and returns it at once. `size` is the view's. `key` names a window that is the same one each time it opens (a plugin's), so the shell can open it where it was left |
| `panelTitled(title)` | the panel's title changed: the name of the plugin in front, or the host app's name when none is |
| `noticeClicked()` | a notice deckit raised was clicked |
| `restart()` | the host app restarts: the process is the host app's |

`connect` is called once, with `preload` and a shell that answers every one of these; otherwise it throws and names what is missing. `openWindow` and `panelTitled` can be asked as plugins load, before `start`.

The keyboard in a window is the shell's to give. macOS hands it to a window's own page each time the window comes forward, so a shell whose views are not that page gives it to the view: the switcher's page while it is open, else `deck.panel.focus()` for the panel, and the view's page for a window it opened.

What `deck` holds:

| | |
|---|---|
| `deck.panel` | `view()`, the panel's container, which the shell places in a window with `deck.window.place` (so a plugin's main process module can find the window its view is in); `contains(webContents)`, whether a webContents is a page the panel shows or a web page in one; `show()`, `hide()`, `shown()`, `focus()`; `leave()` and `arrive()`, the exit and the entrance around a move the shell makes; `present({ floating, dismissible })`. `hide()` resolves whether the panel had the keyboard, `leave()` false when the move was given up: the panel was put away on the way, or a newer move replaced it |
| `deck.setTheme(theme)` | the host app's colours, for every deckit page |
| `deck.switcher` | `view()`, which the shell puts in front where it was summoned; `open()`, resolving true when it was put away; `close()`, `shown()` |
| `deck.window` | `place(view, window, { bounds, front, onClose })`, which puts a view in one window at a time and takes it out alive before the window closes; `bounds` is a rect, or a function of the window's content size that the view follows |
| `deck.keymap` | `listen(webContents)`: a page of the host app's own that should hear deckit's global keys |

Moving the panel is a re-parent: plugins keep their sandboxes and what they hold, and none is told where the panel is. `present` is all the panel learns of where it is: whether it floats over something (rounded and ringed) or fills a window, and whether Escape with nothing else to close puts it away.

`setTheme` gives deckit the host app's colours: `{ sidebarBg, sidebarColor, border, contentBg, contentColor, font }`. Every deckit page derives its look from it (UI.md) and is made again when it changes, headless plugins' sandboxes included.

## 4. The host app's own plugin, and what the host app offers

What a person does with the host app from the panel is the host app's own plugin: the one whose id is the host app's. It ships with the host app and can be removed like any other. That is all that sets it apart: it alone is handed what the host app offers, the page module `host/exports`, as `deck.host`, and it may export that on. A plugin that wants the host app requires that plugin like any other. In another host app a plugin with that id is handed nothing.

It may stand first among a scheme's handlers (`schemeHandlers`, and the scheme in its manifest's `url-schemes`): it opens the addresses it knows and passes the rest on. Deckit never asks whose an address is.

## 5. Deckit.app

`source/deckit/deckit-app` is deckit embedded by itself, the way any host app embeds it: its own `host/config` and `host/folders`, a shell that keeps the panel in one window of its own with the switcher in front of it, and an Electron entry that calls `connect`. Its windows carry a bar that is always there: the window's own page, across the top and under the views, clear over the panel's glass so the two read as one surface. To macOS it is the title bar, so it drags, snaps and answers a double click as the person set. `deckit app` builds it from the archive the last build made.

# How a host app embeds deckit

Deckit is a library a host app embeds, in three layers: deck, the core that manages mods, deckit, the operating system's concepts and the platform's APIs on deck, and a shell, the passage from mods to them and the surface a person uses deckit through. A host app makes the environment deckit runs on, Electron's, connects deckit to it and puts deckit's own shell on it (the panel and the kit). It brings what deckit cannot know: its configuration, its folders, its answers about the process and where the shell is shown, and the mods it ships. This is the line between them.

## 1. The archive

A host app embeds one archive, `deckit-<version>.tgz`, with its sha256 beside it, in an Electron of its own: deckit is made against Electron 44. It keeps the archive as built and unpacks it where it builds and runs. Its sha256 checks that the archive is the one sent. Which deckit it is, `deckit.json` says, by its version and the hash of its sources (`source`), and deckit's log says the same as it starts, and the core's first line, `core: started, pid <pid>`, that the core is running.

| In the archive | |
|---|---|
| `deckit.json` | the version, the mod contract it speaks (`api`), the hash of its sources, the Swift that built the core (`swift`), each bundle's file and, for a renderer's, the global it leaves, the core's executable (`core`), the mods |
| `deckit` | the core: deckit's own process, an executable for Macs of either kind (macOS 13 or later). Deckit starts it as the host app is ready and it ends with the host app's process |
| `deckit-web.node` | every page deckit shows, on the Mac's WebKit, and the windows they are laid in: a module Node loads in main, for Macs of either kind (macOS 14 or later), which deckit finds beside `deckit` |
| `main.js` | the environment deckit runs on in main, Electron's, and what runs a mod's main process modules, a CommonJS module: `{ API, environment, attachMainProcess }`, `API` the version of the mod contract |
| `shell-main.js` | deckit in main: deck, deckit, its web engine and its shell, a CommonJS module: `{ connect, attachWeb, attach }` |
| `renderer.js` | what the environment gives every deckit page, each mod's and each that runs no mod. It leaves one global, `DeckitRenderer`: `{ boot, LAYERS }`, `LAYERS` the main process modules' layer on a mod's page |
| `shell-renderer.js` | deckit on a page: deck and deckit, what the web engine gives a mod, and the shell's pages and what it gives a mod. It leaves one global, `DeckitShellRenderer`: `{ start }` |
| `mods/<id>/` | deckit's own mods, each with its entry bundled, a catalog the host app picks from |
| `document/` | this, MOD.md, UI.md and GUIDELINES.md |

In main the host app requires `main.js`, the environment, and `shell-main.js`, deckit. Every deckit page runs a file the host app puts together, its preload, in a world of its own as each of its documents starts, before any code of the page's:

```js
const before = new Set(Object.keys(globalThis));
// renderer.js, then shell-renderer.js, as they are
const environment = DeckitRenderer.boot({ before });
if (environment) DeckitShellRenderer.start(environment, { layers: DeckitRenderer.LAYERS });
```

`before` is the Set of the names the page's global object had before the bundles ran, so boot takes away every global they added. `boot` answers what the environment gives the page, or null on a page off deckit's scheme, and `start` runs deckit on the page with it and with `layers`, by name, the layers the host app stacks: the main process modules' where it attaches them (section 3).

## 2. The configuration

`connect` takes the host app's configuration in two objects. `config`, read by deck and deckit:

| Key | What it is | Deckit's own |
|---|---|---|
| `id` | what everything deckit keeps is named from: its folder, its sessions and its state | `deckit` |
| `name` | what a person reads | `Deckit` |
| `schemeHandlers` | by scheme, the mods the host app places in that scheme's handler list, in order, until the person orders them (MOD.md, `urls`) | none |

`folders`, deck's:

| Key | What it is | Deckit's own |
|---|---|---|
| `home` | deckit's folder | `~/.config/<id>` |
| `ship` | the mod folders the host app ships, deckit's own it picks and its own, each a mod like any other; installed at every start, and a removed one stays removed. Installed first, they come first in the queue of each interface they provide, so they own it unless the person pins another (MOD.md, Interfaces). One that does not install fails alone and the next start tries it again: with no copy of it installed it does not load and its problem says why, and an installed copy goes on running | none |
| `sources` | folders that hold mod folders, read in place ahead of installed ones (for a development build) | none |

A key deckit does not read stops `connect` with its name. A page holds none of it: what a page needs of it, main answers.

## 3. The host and the shell

Deck runs mods; deckit's shell makes the views they are seen in. Where those are shown is the host app's, the way a browser decides whether a page goes in a tab or a window while the page stays the same. There is one desktop, wherever the host app puts it: the shell's windows and the Dock. Mods live in it: the host app is there before the desktop.

Every window on the screen is the host app's: its frame, its bar, where it opens. The host app opens them with the environment's `windows` (section 4), the module's, the only windows deckit's pages are laid in, and a window deckit needs is asked of it. The one exception is a window of Electron's own that a mod's main process module opens for a view of Electron's it made (MOD.md, `window`), which the environment opens. The desktop is drawn as glass, clear where nothing is drawn, so the host app puts it over something that blurs: a window with a `material`, or a surface of its own. A mod's normal window is the shell's, on the desktop; an overlay window is the host app's, shown and closed through the shell's `showWindow` and `closeWindow`; its content may draw as glass, and the window then blurs what is behind it.

In main, before the host app is ready:

```js
const ELECTRON = require('<deckit>/main.js');
const DECKIT = require('<deckit>/shell-main.js');
const environment = ELECTRON.environment({ preload, core, host });
const deckit = DECKIT.connect(environment, { host, config, folders });
ELECTRON.attachMainProcess(deckit, environment);
const web = DECKIT.attachWeb(deckit, environment);
DECKIT.attach(deckit, environment, { host, web });
```

`preload` is the file the host app put together for deckit's pages (section 1), and `core` the archive's `deckit` where the host app unpacked it, executable. A host app that signs what it ships signs `deckit` with it, as any executable of its own; one in the App Sandbox gives it the two keys of a child, `com.apple.security.app-sandbox` and `com.apple.security.inherit`. Under the hardened runtime it needs no entitlement. It signs `deckit-web.node` beside it with the same identity, as a library its main process loads. A site's passkeys work in the web pages only in a host app that has the entitlement `com.apple.developer.web-browser.public-key-credential`, which Apple grants a browser on request; without it a site signs the person in another way. Deckit's bundles hold all they read: they may be loaded from anywhere, joined to the host app's own code or not.

`environment` is called once, with `preload`, `core` and the host app's answer for a window; `connect`, once, with what `environment` answered, the host app's answers about what of deckit is its own and its configuration (section 2), which it hands the environment what it needs of; `attachMainProcess`, once, with what connect answered and the environment again, which puts the main process modules on deckit (below); `attachWeb`, once, with what connect answered and the environment again, which puts the web engine on deckit (below); `attach`, once, with what connect answered, the environment again, the host app's answers about where the shell is shown, `web`, what `attachWeb` answered, which the shell lays the web pages mods show with, and the shell's configuration, `config`: `dock`, the ids of the mods the Dock in the panel's sidebar keeps at the first start, in order, before the person keeps or removes any; left out, the mods the host app ships whose view names no parent. A key the shell does not read stops `attach` with its name. One object may answer all three. Each throws and names what is missing: `connect` holds what it is handed to what deck and deckit need of an environment, `attachWeb` to what the web engine needs of one, and `attach` to what the shell needs of one (`deckit-shell/environment`: `MAIN`, `WEB`, `SHELL`).

What the host app answers the environment:

| | |
|---|---|
| `openWindow({ title, size, place, focus })` | a window deckit needs for a web page it shows on its own: one a mod opens in a window, or a site's popup. The host app opens it with `windows.open`, frames it, puts the page in it by calling `place(window, { bounds })`, calls `focus()` each time the window takes the keyboard, and returns it at once. `size` is the page's |

What the host app answers deckit:

| | |
|---|---|
| `notificationClicked()` | a notification of the system's that a mod showed was pressed |
| `restart()` | the host app restarts: the process is its own |

What the host app answers deckit's shell. A page is a page token, which the environment hands out and the host app hands back: in Electron's, the module's page.

| | |
|---|---|
| `start(controls)` | once the host app is ready, before any mod launches, with what of the shell the host app drives: the desktop and the windows of web pages. A mod's `shell` is another object |
| `show()` | "show me": the desktop comes up, as a mod orders one of its windows front or the Dock opens a mod |
| `desktopTitled(title)` | the desktop's title changed: the name of the active mod, the key window's, or the host app's name when none is |
| `showWindow(control, { activates })` | an overlay window comes on screen: the host app makes or brings forward a window for it and puts its content in it with `control.place`, the content `width` by `height`; it takes the keyboard unless `activates` is false |
| `closeWindow(control)` | the overlay window closed: the host app's window for it closes, and the control is not handed again |

An overlay window's control is one object while the window is open: `{ mod, name, width, height, place(window, { front, bounds, onClose }), contains(page), focus(), didResignKey() }`, `name` the mod's name for the window, `place` putting its content in a window as a stage's `place` does. An overlay window is over every app's; `didResignKey()` is the host app telling the mod the keyboard left the window. A window the host app closes closes the mod's.

When the host app quits, once every window has closed, deck holds the quit at `will-quit` until every mod's run has ended, `detach()` and `stop()` two seconds at most each, and deckit until the main process modules of those runs have ended (`dispose`, two seconds at most each), and then asks for the quit again: it goes on as any quit does, `quit` and all. The host app's `before-quit` and `will-quit` listeners hear both. While a mod runs, the first `will-quit` is deck's hold, and while a main process module is still ending, the next one is deckit's: the host app calls the quit off at the first `before-quit` or at a later pass, and with nothing running there is one pass. A quit the host app calls off leaves the mods that stopped for it stopped, and the next quit stops the runs that started since. A core that has ended holds no quit. A restart the host app makes is a quit too, `app.relaunch()` and then `app.quit()`; `app.exit()` skips every end. The process ends with code 0; a host app that ends it with another calls `app.exit(code)` from its `quit` listener. `openWindow` can be asked as mods load, and `desktopTitled` before `start`.

The keyboard in a window is the host app's to give. macOS hands it to the window each time the window comes forward, not to a page in it, so the host app gives it to the page as the window takes it (the window's `key`): `controls.desktop.focus()` for the desktop, `control.focus()` for an overlay window, and `focus()` for a window `openWindow` asked for.

What `controls` holds, `{ setTheme, desktop, openWindow }`:

| | |
|---|---|
| `controls.desktop` | `glass`, the strength the desktop lays its colour over the blur at, for a surface beside it to match, and the desktop lays it under itself too, so a page of the host app's under it lays none; `place(window, { bounds, onClose })`, which puts it in one of the host app's windows as a stage's `place` does (so a mod's main process module can find the window its page is shown in); `contains(page)`, whether a page is one the desktop shows, a web page in one or the overlay over one; `show()`, `hide()`, `shown()`, `focus()`; `present({ titleBar })` |
| `controls.setTheme(theme)` | the host app's colours, for every page the shell draws. Each page takes a new one in place: no mod launches again |
| `controls.openWindow({ title, size, page })` | a web page in a window, as the environment asks the host app's `openWindow` for one: a window on the desktop of the mod whose page shows `page`, its content, under a title bar the shell draws holding `title`, `size` the content's. Answers `{ setTitle(text), close(), on('close', listener) }`, `on` answering its off. The host app answers its `openWindow` with it |

Placing the desktop in another window is a re-parent: mods keep their sandboxes and what they hold, and none is told where the desktop is. `present` is all the desktop learns of where it is: filling a window whose title bar lies over its top, `titleBar: { height, controlsWidth }`, the bar's height and the width the window's buttons take at its start. The desktop draws its strip there, the active mod's name and a drag of the window, and lays its windows below it.

`setTheme` gives the shell the host app's colours: `{ contentBg, contentColor, border, font }`. Every page the shell draws derives its look from it (UI.md) and takes a new one in place: no mod launches again and no page loads again. Deckit.app gives a light or a dark theme as the system's appearance is, and gives it again as that changes.

## 4. What connect answers

What connect answers is all a host app, or the shell on deckit, reaches of deckit in main; deckit's shell is built with nothing else. Every fact it hands out (a manifest, a run, its summary) is a frozen copy. Nothing of Electron's is in it: what hands out the windows pages are laid in is the environment's, for a host app alone (below).

| | |
|---|---|
| `config` | `{ id, name }` |
| `onStart(listener)` | told once as deckit starts, before any mod launches; handed over before the host app is ready. One that throws is logged, and the mods run anyway |
| `core` | `onDown(listener)`: `listener(why)` told once deckit's core answers nothing more, as it ended or did not start, and at once when that is so already, answering its off |
| `restart()` | the host app restarts, as `restart` it answered deckit |
| `stack(name, { setup })` | a layer over deckit, by its name, stacked on each mod's page that starts from then on, which the page puts together; `setup(id)`, where given, answers what the layer is handed on the page of the mod `id`. The web engine stacks itself as it is attached, a layer with no lifecycle of its own: each lifecycle of a run that starts from then on is handed its handle `web` in the table of frameworks, `start(deckit, { web })` and `attach(shell, deckit, { web })`. The shell stacks itself as it is attached, over the web engine: each mod's run that starts from then on has the shell's screen lifecycle stacked on deckit's, its `attach(shell, deckit, frameworks)` called with the theme, the kit and its view laid by the panel. Without it the mods run with deckit's lifecycle alone, and nothing calls `attach` |
| `permissions` | `define({ id, name, description })`: the shell defines a permission (MOD.md, permissions), which guards what it adds and which it checks; `name` and `description` are what a person reads before installing. Defined once, before the host app is ready, when deckit's core starts and reads the manifests against them; after, or a second time, it throws, and one deckit defines itself (`system.clipboard-read`) stops the core from starting. A permission no layer on the host defines is not usable there, and a mod that asks for it runs without what it guards. Deckit's shell defines `system.overlay-windows`, `deckit.styles`, `deckit.fonts`, `deckit.app-keys`, `system.global-keys` and `deckit.shell-keys` |
| `mods` | `notifications`, the names of the lifecycle's notifications; `list()`, every mod found in the mods' order (MOD.md, Order), one that loads as its manifest and one that does not as `{ id, refusal: { stage, kind, message } }`, refused at `read`, `kind` null for a problem that is no refusal; `shipped()`, the ids of the mods that load that the host app ships; `onChange(listener)`, told of a mod found or gone, which answers its off; `ownerOf(interface, dependent)`, the id of the mod that owns an interface (MOD.md, Interfaces), or null, and with `dependent`, a mod's id, null too where that mod does not reach it: it uses no such interface, owns it itself, or the owner does not provide the major it uses; `runs()`, each mod's latest run with its `page`, `[{ run, page }]`, and `runOf(id)`, the mod's latest run or null; `fieldsOf(id)`, the manifest fields the UI named (`fields.define`) that the mod's manifest writes, by key, each as written, or null for no mod that loads; `grantedOf(id)`, the ids of the permissions the mod is granted, or null for no mod that loads; `readFile(id, path)`, the text of a file inside the mod's folder by its `/` separated path there, as a manifest names one, or null for none, a link followed only to a file inside the folder; `observe(name, observer)` for a lifecycle notification (`notifications` lists them) of every run, answering its off; `onRequest(listener)`, told `{ from, to }`, the ids of the mods, of each request one mod makes of another, a call on a connection, a reach or a launch, answering its off; `modOf(page)`, the id of the mod a page is, or null; `onInstalled(listener)`, told the id of a mod installed, once the one it replaced, if that ran, has launched again, and `onRemoved(listener)`, the id of a mod removed, before what runs in its place launches, each answering its off; `onErase(eraser)`, what an owner keeps of a mod removed with its data, erased as `eraser(id)` asks, answering a promise whose rejection leaves the erasure to the next start, and answering its off; `timeout()`, `{ launch, end }`, how long a run is given in milliseconds, its code `launch` to start once it launched and each of its lifecycles `end` to end; `launch(id)`, the mod launched, answering a promise settled once it has launched, and rejected with why where it did not; `quit(id)`, its run ended, answering a promise settled once it has ended (MOD.md, Running and quitting); `relaunch(id)`, its run ended and the mod launched again, or launched when it is not running, as `launch` answers; `relaunchAll()`, every mod with a sandbox ended and launched again, answering a promise settled once each has launched or failed to; a mod launched again loads its page anew from its folder, and its manifest and main process modules as deckit last read them; `openExternal(id, url, { activates })`, `url` opened outside the app for the mod `id` as the mod's own `openExternal` opens it, refused `NOT_PERMITTED` for the address of a file where the mod's run does not hold `system.file-handlers`, and `UNSUPPORTED_URL` for one that is neither a file's nor the web's. A run is `{ mod, folder, data, granted, number, state, summary, contributions, problem, failed, refusal, relaunches }` (MOD.md, The run, Running and quitting), `mod` its manifest, `folder` its mod's folder, `data` its mod's data folder, `granted` the ids of the permissions its mod is granted, its `summary` deckit's `commands` and `urls` (the manifest's patterns, once a lifecycle registered a URL handler) and the shell's `view`, `styles` and `window`, `view` absent until the screen lifecycle has joined |
| `pages` | A page is a token: whatever answers or takes one hands it back and never reads it. `add(page, name)`, a page the host app or its shell made that runs no mod (the environment's `pages.make({ name })`), known as theirs by `name` from then on, added before it loads: what it sends is theirs, never a mod's; `nameOf(page)`, the name it was added by, or null; `whenEnds(page, undo)`, `undo` called once as a page of deck's (a mod's, or one that runs none) navigates away, crashes or goes, answering its off, and it throws for any other page |
| `commands` | `register({ id, name }, commands)`, the commands of the host app or its shell, under an `@` name, `id` (`@app` the host app, `@shell` the shell), and its `name` as a person reads it, each with its `description` and `params` beside `run`, as a mod's run registers one its `contributes` does not declare (MOD.md, `deckit.commands.register`), answering a promise settled once deckit's core has them; `list()`, every command, the app's first, then each mod's in the mods' order, those its `contributes` declares whether it runs or not, then those its run registers beside them; `run({ provider, command }, args)`, resolving to the command's result; `complete({ provider, command }, param, partial, { args, signal })`; `onChange(listener)`, which answers its off. The shell's is `@shell.show({ mod })`, which puts the mod on screen and completes `mod`; its keys are `toggleSidebar`, `back` and `forward` |
| `provider` | `provider(id)`, who declares keys or commands as `id`, `{ id, name, host }`: a host that registered a command or a key, by the name it gives, or a mod deck loads; null for neither |
| `state` | `read(key, fallback)`, `write(key, value)`: what the host app and its shell keep of the person's, in `state/host/`, apart from deckit's own, from `onStart` on. `read` answers at once; `write` answers a promise, kept once deckit's core has the value. A key is lower case letters, digits, `.`, `_` and `-`, starting with a letter or a digit, at most 64, and a write of another is refused and logged. The host app and its shell share the keys: deckit's shell keeps `panel-frame`, `panel-pinned` (the mods kept in the Dock) and `panel-order`, so a host app with it keeps keys of other names |
| `log` | `info`, `warn`, `error` |
| `channels` | `bind(declared)`: a channel of the shell's own between main and its pages. `declared` is `{ channel, to, fields, reply, sync, guard }`: `channel` its name; `to`, `main` for what a page asks or tells main, `page` for what main asks or tells a page; for `main`, `fields`, what a page may send, each `string`, `number`, `boolean`, `object`, `array` or `any`, ending in `?` when it may be absent; `reply`, whether it is answered; `sync`, for `main` with `reply`, whether the page waits for the answer at once; `guard`, which page may send it: `GUARD.ANY` (deckit-sdk/deckit/channel), any page; `GUARD.MOD`, a mod's page; a permission's id, a mod's page granted it; or a function of the payload as sent that answers the id of the permission guarding that call, or null for none, a mod's page, for any payload it is handed, never throwing. In main it answers `handle(answer)` or `on(listener)` for what a page asks or tells, and `invoke(page, payload, { timeout })` or `send(page, payload)` for what main asks or tells a page; main holds what a page sends to `guard`, refused at call `REFUSED` for a page that runs no mod where one must and `NOT_PERMITTED` for a mod not granted the permission, then to `fields`; a tell it refuses is dropped. A channel is declared once: binding the same declaration again binds the same channel, and one deckit binds as its own, or another declaration of a name bound already, is refused; each is answered once. A question main asks a page is heard from the page's start and waits for its answer for as long as main waits; what main tells a page before it listens is not kept. What a listener throws goes to deckit's log, in main and on a page |

`attachWeb` defines the permissions of the web (MOD.md, permissions), keeps the web engine's state in `state/web/`, stacks the web engine on each mod's page with the names of the mod's web sessions there, and starts it with deckit, before any mod launches. It answers what a UI on deckit reads of the web pages mods show, which the shell's `attach` takes as `web`:

| | |
|---|---|
| `pageFor(page)` | the deckit page a page answers to: itself, or the one a web page it is in is shown in |
| `holdsKeyboard(page)` | whether the keyboard is in that deckit page or a web page in it |
| `onPage(listener)` | `listener(page)` told of each web page as the web engine adopts it, before it watches the page's input, answering its off; the shell takes the keys pressed in each |

`attachMainProcess` defines `system.main-process` (MOD.md, permissions), stacks the main process modules on each mod's page, a layer with no lifecycle of its own that hands each lifecycle of a run its handle `mainProcess` in the table of frameworks (MOD.md, mainProcess), and starts them with deckit, before any mod launches. What runs the modules is the environment's `mainProcess`, which it alone reads. It answers nothing.

What the environment answers beside what deckit is handed, for a host app alone, `windows`:

| | |
|---|---|
| `windows.open({ kind, size, frame, title, showsTitle, color, material, buttons })` | a window of the module's, hidden until shown. `kind` is `titled`, with macOS's title bar, its buttons where `buttons` (`{ x, y }`) puts the first one's top left and its title shown with `showsTitle`, or `floating`, with no bar, over every app and on every Space, taking the keyboard without bringing the app forward. `size` is its content's; `frame`, `{ x, y, width, height }` from the top left of the main display, where it is on screen; `color`, `{ red, green, blue }`, what it draws under its pages, or `material` (`hud`, `sidebar`, `menu`, `popover`), what behind it it blurs instead |
| `windows.focused()` | the window with the keyboard, or null while none of the app's has it |

A window answers `show({ focus })`, `hide()`, `close()`, `isClosed()`, `isKey()`, `isFullScreen()`, `isZoomed()`, `frame()`, `setFrame(rect)`, `size()`, `setSize(size)`, `setTitle(text)`, `setColor(color)`, Quick Look's panel over it (`previewFile(file, title)`, `closeFilePreview()`), a dialog as a sheet on it, taking and answering as Electron's `dialog` does (`showOpenDialog(options)`, `showSaveDialog(options)`), and `on(event, listener)`, answering its off, for `resize` (its content's size), `moving` (before the person moves it), `moved`, `key` and `resign` (as it takes and loses the keyboard) and `close` (once, as it closes). Pages are laid in it on a stage (below), which the host app places through the `place` it is handed.

A stage, made by the environment's `stage()`, is where the shell lays pages in a host app's window, each a page of deck's or a surface one opened:

| | |
|---|---|
| `place(window, { bounds, front, onClose })` | puts the stage in one of the host app's windows, `windows.open`'s, one window at a time: `bounds` a rect, or a function of the window's content size that it follows; `front`, over what is in the window already; `onClose()`, called once it is out of a closing window |
| `size()` | `{ width, height }`, as it is laid in its window |
| `whenResized(listener)` | heard each time its size changes, answering its off |
| `show(on)` | whether it is on screen |
| `lay(layers)` | the pages on it, each `{ page, rect, input }`, laid at `rect` (`{ x, y, width, height }` on the stage) and taking the pointer only inside the rects `input` names in it, from its top left, where it names any, or `{ page, hidden: true }`, kept on the stage out of the window, where it would slow the window's resizing. The pages laid are in the order given, bottom to top. A page left out, or whose page is gone, is taken off; each is clear where it draws nothing. A layer with both a rect and `hidden`, or neither, and a page that is not one of deck's, are refused |

On a page, deckit's shell is part of deckit: `shell-renderer.js` draws the pages the shell made, reads each mod's `icon` and `form`, and stacks its screen lifecycle on deckit's, calling `attach` with the handle `shell` (MOD.md, shell), over the web engine's layer, which hands every lifecycle the handle `web` (MOD.md, web); a view is laid in its page where the panel's frame leaves it room. What deckit gives a mod is never replaced by what the shell gives. Once deckit's core answers nothing more (`core.onDown`), the shell covers the panel and asks the person to restart the app.

The host app and its shell reach deckit through these, and nothing else of deckit's: their own listeners and their own files are their own.

## 5. Deckit.app

Deckit.app is deckit embedded by itself, the way any host app embeds it: its own configuration, answers that keep the desktop in one window of its own, the host window, and each overlay window of a mod in one of its own, and an Electron entry that makes the environment, `ELECTRON.environment({ preload, core, host })`, calls `connect` with it and puts the main process modules, the web engine and deckit's shell on deckit. It ships deckit's own mods. The switcher is the Switcher mod, in an overlay window over every app, kept where it was moved to and opened from any app by its own global key (`alt+space`) or by its command `show`. Its content draws as glass, in a `floating` window with the material `hud` (`openFloating`), so the window blurs what is behind it. The host window is `titled`, and the desktop fills it, the bar's height included, over the material `hud`, so the desktop's glass is the window's only colour, the title is not drawn, the window's buttons stand in the desktop's strip, and the strip drags the window. A mod's normal windows, a web page's among them, are on the desktop, never windows of the app's own. The host window opens where it was last left; closing it leaves the app running, and the Dock icon, a second launch and a notification's click bring it back. Run unpackaged, from a folder Electron's default app loads, it keeps its data in the folder `DECKIT_DATA` names, and what WebKit keeps of its pages, where WebKit keeps it for the app that runs it, under an id that folder's own, so one run never reads another's or the person's; it asks for a restart by exiting with 75, for whoever started it to start it again.

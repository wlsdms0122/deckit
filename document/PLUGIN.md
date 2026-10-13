# Writing a plugin

A plugin is a manifest and one entry. deck reads the manifest, runs the entry in a sandbox of the plugin's own, and calls its `start(deck)`; in `start` the plugin registers what it contributes: a view, keys, commands, a URL scheme handler, exports for other plugins, in any mix. A view is one of these abilities, and a plugin with none is headless. Code that needs the app's main process (files, the network, programs) goes in a main process module the plugin starts when it needs it.

How the folder is laid out is the plugin's own. The folder's name says nothing; the manifest says who the plugin is, and its `main` names the entry:

```
dashboard/
  manifest.toml       main = "dist/main.js"
  dist/main.js        the entry: what deck runs in the sandbox
  dist/daemon.js      a main process module, started with deck.mainProcess('dist/daemon.js')
  src/ …              the author's sources, if the entry is bundled from them
```

The entry is one file, run as a CommonJS module with nothing else in reach: the sandbox has no `require`. A plugin written as many files is bundled into one, by any bundler that writes CommonJS (esbuild, Rollup, webpack). What deck reads is `module.exports` itself, so the entry sets it, or exports `start` and the rest by name; a bundled `export default` arrives as `module.exports.default` and is refused. A main process module is a plain Node module and may require what it likes.

Each plugin runs at the origin `deckit://<id>.plugin/`, with its own storage and its own web sessions. Its folder is served at that origin, `deckit://<id>.plugin/<path>`, for its view to use: images, styles, fonts, data, and scripts or modules its document loads. Only what is in the folder is served, and a link out of it is not. A script the document loads runs in the page's own world, apart from the entry, so it has no `deck`; it is for what the view shows (a framework's runtime, a worker) and reaches the entry through the document.

## manifest.toml

```toml
id = "dashboard"
name = "Dashboard"
version = "1.0.0"
api = "1.0.0"
main = "dist/main.js"
url-schemes = ["https"]

[requires]
bot = "1.0.0"

[permissions]
"system.main-process" = "Starts the daemons the dashboard shows."
```

| Field | Required | What it says |
|---|---|---|
| `id` | yes | who the plugin is, to deck and to every other plugin |
| `name` | no | what a person reads; the id when left out |
| `version` | yes | the plugin's own version, `MAJOR.MINOR.PATCH`, compared with what other plugins require |
| `api` | yes | the version of deck's plugin contract it is written against |
| `main` | yes | the entry, a path inside the folder, `/` separated |
| `url-schemes` | no | the schemes of the addresses it opens: it is one of their handlers (below) |
| `requires` | no | plugin id = the lowest version it needs |
| `permissions` | no | permission = why it is needed, in words the person reads |

Any other field stops the plugin loading, and so does a `main` that names no file inside the folder. The manifest is read by the main process before a line of the plugin runs.

Only the part of TOML a manifest uses is read: top-level keys, one level of tables, and strings, booleans, integers and arrays of those as values. A key with a dot is quoted (`"system.main-process" = …`).

An id is lower case letters, digits, `.`, `_` and `-`, starts with a letter or digit, is at most 64 characters and has no `..`. Lower case only, because a plugin's data is kept in a folder named by its id and macOS disks ignore case.

`url-schemes` is a list of lower case schemes without `:` (`"https"`, `"my-app"`), or `["*"]` alone for every scheme. `javascript`, `data`, `blob` and `about` are refused.

### api

The version of the contract: what the entry exports, what `deck` holds and what a main process module is handed. This deck speaks `1.0.0`. A plugin loads when the major is the same and deck's minor and patch, in that order, are at least the plugin's; otherwise Settings shows why it did not. The same rule compares a plugin's `version` with what another requires.

### permissions

What a plugin may reach beyond its own sandbox is asked for by name, with a reason. The main process checks each where the plugin asks, by the sandbox it asks from.

| Permission | What it reaches | Where it lands |
|---|---|---|
| `system.main-process` | the app's main process, where the plugin's modules run and can read and write files, reach the network and start programs | `deck.mainProcess` |
| `system.files` | files on this Mac, opened in its own pages | `file://` addresses in its web pages |
| `system.network` | any address, past the rules that keep one site from reading another | `fetchText(url)` on a web session |
| `system.certificates` | trusting a certificate this Mac cannot verify, in one of its sessions | `trust` on a web session |
| `system.site-permissions` | what a site's pages may use (the camera, the microphone, notices), in one of its sessions | `allow`, `revoke` on a web session |
| `system.clipboard` | reading what was copied, from any app | `deck.clipboard.readText` |
| `system.notifications` | notices in the corner of the screen | `deck.notify` |
| `system.global-keys` | keys that work wherever the keyboard is in the app | `global: true` on a key |
| `deckit.plugins` | every installed plugin: listing, installing and removing them | `deck.plugins` |
| `deckit.plugin-settings` | every plugin's settings | `deck.pluginSettings` |
| `deckit.key-map` | every plugin's shortcuts | `deck.keymap` |
| `deckit.url-schemes` | who is asked first to open each scheme | `deck.urlSchemes` |

An unknown permission, or one without a reason, stops the plugin. Without asking, a plugin has its own sandbox, records, values, settings, keys and web sessions, and of deck: copying text, asking for an address to be opened, putting itself on screen, showing a file in Finder, and `about()`. None of it reaches another plugin.

## The entry

```js
module.exports = {
    icon: `<svg …>`,
    keywords: ['calendar'],
    settings: { … },
    async start(deck) {
        const daemon = await deck.mainProcess('dist/daemon.js');
        deck.view({ content, sidebar, didAppear, didDisappear });
        deck.keys({ … });
        deck.commands(() => [ … ]);
    },
    stop() { … },
};
```

| Member | What it is |
|---|---|
| `icon` | an inline SVG string, about 18px, which deck draws rebuilt from its shapes |
| `keywords` | optional; the switcher's aliases for the plugin |
| `settings` | optional; what the person can choose about the plugin (below) |
| `start(deck)` | starts the plugin and registers what it contributes; may be async, and deck waits for it |
| `stop()` | optional; the plugin's run is ending: it terminates (removed, updated, the app quitting, a new theme), or `start` failed. It may be async, and deck waits for it a short while. A new theme launches the plugin again, so what `stop()` ended, `start()` starts again. A `stop()` that throws is written to the log; the row in Settings shows the run that follows |

Any other member stops the plugin. Everything the plugin reaches is in `deck`.

### settings

What the person can choose about the plugin is declared. Settings draws and lists every plugin's, the main process checks each value against its declaration and keeps it, and the plugin reads them through `deck.settings`.

`settings` is `{ <key>: { label, type, default, hint } }`, and `type` is one of:

| Type | Also takes |
|---|---|
| `toggle` | |
| `choice` | `options`: `[{ value, label, font }]`, or a function of `deck` that gives them |
| `number` | `min`, `max`, `step`, `unit` |
| `text` | `placeholder` |
| `action` | `button` (its text) and `run(deck)`, which may return a line to show |

## What start() registers

Each registration is a call on `deck`, made once, before `start` ends; deck contributes them all when it does. Leaving one out is how a plugin opts out of it. A call made twice, or after `start` ended, is shown on the plugin's row in Settings. A `start` that throws or rejects leaves the plugin unstarted, with the reason on its row.

### deck.view({ content, sidebar, didAppear, didDisappear })

`content` is the element shown in the panel, to the panel's top. Where a window's title bar lies over that top, the top of the view is its title bar area, as tall as the page's `--deckit-title-bar-area-height` and starting `--deckit-title-bar-area-x` from the left, past the window's buttons; both are `0px` where there is none. A plugin lays its own bar there with `ui.titleBar(element)`, or uses the two values itself. Registering a view gives the plugin a row in the plugin list and lets it be on screen. A plugin with no view is headless: it exists through whatever else it registers (keys, commands, opening addresses, exports, its main process modules) from when it starts until it stops, and a `start` that registers nothing is a headless plugin that does nothing yet. `sidebar` is an element shown in the sidebar under the plugin list while the view is on screen.

### didAppear() and didDisappear()

The view came on screen, and went. They come in turn, never twice running.

### deck.keys(keys)

```js
deck.keys({ newTab: { key: 'mod+t', label: 'New tab', run() { … } } });
```

`key` is the default chord; the person can give the action another, or none, in Settings. Modifiers are `cmd`, `ctrl`, `alt`, `shift`, and `mod` (Cmd, or Ctrl without one); `meta`, `control`, `opt` and `option` are read as the same and written back as these. A key is live only while its plugin is on screen, in its view and in the web pages it shows. A key with `global: true` works wherever the keyboard is in the app, its plugin off screen and the panel closed included; it needs `system.global-keys`, has ⌘, ⌃ or ⌥ in it, and is not one a text field uses. A headless plugin is never on screen, so its keys are global ones, and one that is not is refused and shown on its row; what it offers to be reached from anywhere without one is a command.

### deck.commands(fn)

`fn()` returns `[{ label, hint, icon, group, run, keywords, address }]`: entries for the quick switcher, under the plugin's heading. `group` is a caption inside it; `address` is a URL or a path a query matches last. Running one does not show the plugin: a command that wants to be seen calls `deck.show()`. A headless plugin is often nothing but this.

Instead of `run`, an entry may have a `page`, a list the switcher opens to search inside it; Escape or Backspace leaves it:

- `page: { placeholder, search(query, { signal }) }`: the plugin answers each query. A new query aborts `signal`; pass it on to what fetches.
- `page: { placeholder, entries() }`: one list the switcher ranks itself.

An entry of `commands` has a `run` or a `page`; one with neither is left out. In `now`, `resolve` and a page, an entry without `run` is a readout: shown, never chosen.

### deck.now(fn)

`fn()` returns `[{ label, hint, icon, tone, run, attention }]`, or a promise of it: what is true this minute. The rows sit above everything in the switcher until something is typed. `tone` is `info`, `ok`, `warn` or `alert`: a name, which the switcher draws. `attention` asks for the eye once. The strip is shared: rows are taken a round at a time across plugins, three in all.

### deck.resolve(fn)

`fn(query)` takes the query as typed and returns entries, or a promise of them, for what cannot be ranked because it does not exist until it is typed: a pasted link, an id. They go above the ranked list; one with `fallback: true` goes below it.

### deck.handleURL(fn)

`fn(url, options)` answers for the addresses of the schemes the manifest names: the plugin is one of their URL scheme handlers. `options` is `{ activates, userInitiated, target }`. Return `true` when it opened the address; anything else passes it on.

### deck.exports(object)

What a plugin that requires this one receives as `deck.requires[id]`. Values are copied and frozen when the plugin starts, and a value that cannot be copied (a Symbol, an object that holds itself) leaves the plugin unstarted; functions are called through the main process and so return promises. Keep them working while the view is not on screen: the plugin using them is not looking at it.

## deck

`start(deck)` receives `{ id, name, theme, ui, settings, storage, web, requires, util }`, what it registers with (above), what it asks of deck (below), `mainProcess` for a plugin with `system.main-process`, and `host` for the host app's own plugin.

### theme and ui

`theme` is the look, derived from the host app's: `dark`, `font`, `mono`, `type`, `border`, `color`, `radius`, `shadow`, `motion` and `syntax`. `ui` is the kit, drawn in it. Both are in [UI.md](UI.md).

### settings

- `get(key)`: the saved value, or the declared default.
- `set(key, value)`: checked against the declaration, and resolves once kept.
- `on(listener)`: `listener(key, value)` on every change, from Settings or from the plugin. Returns the unsubscribe.

### storage

- `storage.values`: `get(key, fallback)`, `set(key, value)`, `remove(key)`. Small state that costs a click to lose (a fold, a width), in the sandbox's own storage.
- `storage.records`: `get(key, fallback)`, `set(key, value)`, `remove(key)`, `keys()`. What must not be lost (bookmarks, open tabs), as JSON files in deckit's folder, written by the main process. `get` and `keys` are synchronous, and `get` answers a copy: change it and `set` it to keep the change. `set` and `remove` resolve once written, and a write that fails is shown on the plugin's row in Settings.

### web

`web.session(name)` is a web session of the plugin's own, kept across restarts: `{ name, clear() }`, and with permissions `fetchText(url)`, `trust([{ host, fingerprint }])`, `allow([{ origin, permission }])` and `revoke(entries)`. Its pages share its cookies and nobody else's.

- `web.page({ session, url })` shows a web page the way a browser tab does, in the plugin's view.
- `web.window({ session, url, title })` shows one in a window of its own, for a step taken and finished, such as signing in.

Both return `{ session, state, load(url), back(), forward(), reload(), stop(), mute(on), find(text, { start, back, matchCase }), stopFind({ keepSelection }), close(), delegate }`, and a page also its `element` and `focus()`. `state` is `{ url, title, icon, loading, canGoBack, canGoForward, audible, muted, capture: { microphone, camera, screen } }`.

A page reaches its plugin through its delegate:

```js
page.delegate = {
    didChange(state) {},
    didFocus() {},
    didFind(result) {},              // { matches, active, final }
    didReceiveNotification(notice) {}, // { title, body, silent, click() }
    didRefuseCertificate(info) {},
    didRequestClose() {},
    didClose() {},
    decidePermission(request) {},    // { origin, permissions, app, url }: true allows it
    shouldLeave(url) {},             // a file page's link to the web
    shouldOpenWindow(url, options) {}, // { activates, target }
};
```

A `should…` left out, or answered with anything but `false`, lets the default go ahead: the address goes to its scheme's handlers. Answer `false` when the plugin opened it itself.

### What the plugin asks of deck

| Member | What it does |
|---|---|
| `show()` | puts the calling plugin's view on screen; a plugin with no view in the panel, or one still starting, has nothing to show |
| `emit(name, ...args)`, `on('<plugin id>:<name>', listener)` | events, its own sent and any plugin's heard (Using what another plugin does) |
| `open(url, { activates, userInitiated, usesDefaultApp, target })` | offers an address to its scheme's handlers in turn, then deck's own answer; resolves to whether anything opened it |
| `fileURL(path)`, `filePath(url)` | a file's `file://` address, and back |
| `reveal(path)` | shows a file in the system's Finder, during a person's click or key; otherwise resolves `false` |
| `chordOf(action)` | the chord one of the plugin's keys is bound to now, or `''` |
| `about()` | `{ name, app, version, source, electron, chrome, home, plugins, data, log }`: the host app's name and version, deckit's version and the hash of its sources, the engines, the person's home folder, and the folders of deckit's plugins, data and log |
| `clipboard.writeText(text)` | copies text |
| `clipboard.readText()` | with `system.clipboard` |
| `notify({ title, body, silent, onClick })` | with `system.notifications` |
| `plugins` | with `deckit.plugins`: `list`, `pick`, `install`, `remove`, `relaunch`, `reveal`, `count`, `restartPending`, `restart`; `list` and `restartPending` answer at once, the rest resolve. `relaunch(id)` terminates the plugin and launches it again, or launches one not running, and rejects while a plugin it requires is not running |
| `pluginSettings` | with `deckit.plugin-settings`: `list`, `set(id, key, value)`, `run(id, key)` |
| `keymap` | with `deckit.key-map`: `list`, `set`, `reset`, `record`, `onChange`; `list` answers at once, `onChange` returns the unsubscribe |
| `urlSchemes` | with `deckit.url-schemes`: `list()`, each scheme's handler list `{ scheme, system, handlers }` at once; `set(scheme, { order, off })`; `everyScheme` |

### util

| Member | What it does |
|---|---|
| `match(text, query)` | the switcher's matching: `{ tier, score, at }` or null |
| `ranker({ paths })` | the same off the page, for a list too long to rank on every key (`paths`: the names are paths, matched by their last part first): `{ rank(names, query, { limit }), close() }` |
| `movePath(path, from, to)` | a path after `from` moved to `to`, or null when it went with it |
| `tildify(path)` | a path as it is shown, from `~` under the home folder |

### mainProcess, requires, host

`mainProcess(path)` starts a main process module of the plugin's (below) and resolves to its methods, each called through the main process and so returning a promise, with `on(name, listener)` to hear what it emits; `on` returns the unsubscribe. A path outside the plugin's folder, or a module that throws as it starts, rejects. A failed start is tried again the next time it is asked for.

`requires` is what each plugin named in `[requires]` exports. A plugin runs only while everything it requires runs, so these are there: when one of them terminates or crashes, the plugin terminates too, before that one's `stop()` is asked, and it launches again, with what that one exports now, once that one launches again. Calls made in `stop()` still reach it.

`host` is what the host app offers, handed to the host app's own plugin only.

## Lifecycle

Each launch of a plugin's entry is a run, and a run is in one of four states:

| State | What happens |
|---|---|
| `launching` | its sandbox loads, the entry is evaluated and its settings declared; once what it requires is running, `start(deck)` registers, and starts main process modules if it needs them |
| `running` | `start` has ended and deck has joined what it registered (keys, switcher, URL handler, exports); a view, if it registered one, is in the panel: didAppear and didDisappear |
| `terminating` | `stop()` is asked: removed, updated, the app quitting, a new theme, restarted from Settings, a plugin it requires ending, or `start` failed. A `stop()` asked while `start` is still going runs once it has ended |
| `notRunning` | it ended: `stop()` answered or its time ran out, or its page went away |

A plugin launches again in a new sandbox when it is installed again, and in the same one, loaded again, when the host app's theme changes, when it is restarted from Settings, and when a plugin it requires launches again. A page that loads again by itself ends its run with the page it ran in, and launches a new one. A main process module is started once for each plugin and path while the app runs: a new sandbox asking for the same path gets the one already running. One whose code changed is taken up at the app's next start; Settings asks for the restart.

Whatever deck calls after `start`, a call that throws or rejects costs that call alone: it is shown on the plugin's row in Settings, and the plugin goes on. What must outlive the sandbox is written when it changes: the sandbox can be made again at any of these times.

## Using what another plugin does

Two ways, and one question picks: could the host app do this if the other plugin were not there?

**URL scheme handlers**, when it could. Everything opened is an address: `https://…`, a file as `file:///…`, or a scheme a plugin makes up. A plugin calls `deck.open(url)` and never names who answers. Each scheme has its handlers: the plugins whose manifest names it, in the order the person set in Settings, then deck's own answer (the system browser for `http` and `https`, the system's app for a file), which is always last. A file is opened only when `userInitiated` says a person asked, during their click or key; otherwise it is shown in Finder. A scheme no plugin takes and deck has no answer for ends unopened.

**requires**, when it could not. The other plugin registers `deck.exports`, and this one names it in `[requires]` and receives it as `deck.requires[id]`. If what it requires is missing, too old, failed to start, or requires it back, the plugin does not load, and Settings says why.

Apart from both, a plugin says what happened to it, for whoever cares, as **events**. `deck.emit(name, ...args)` sends one, named after the plugin: `bot` emitting `status` is `bot:status` to listeners, and no plugin can send another's. `deck.on('<plugin id>:<name>', listener)` hears one and returns its off. Values are copied. It takes no requirement: a plugin's events go out while it is running, from when its `start` has finished until it terminates, and nothing arrives from one that is not running.

## A main process module

```js
module.exports = ({ id, folder, emit, window, files }) => ({
    async start(...args) { /* answers daemon.start(…) */ },
    // emit('died', reason) is heard by daemon.on('died', …)
});
```

A module exports a function that deck calls once, with what the module is handed, and that returns (or resolves to) its methods: an object of functions, nested objects walked, as exports are. A method may not be named `on`, which is how its events are heard. Arguments and results cross by structured clone.

`folder` is the plugin's data folder; anything a module keeps goes there, never in the plugin's own folder, which an update replaces.

`files` changes a person's files without losing one: `fresh(folder, base, make, extension)` makes something new under the first free name, `rename(path, name)` and `move(path, folder)` never put anything over another entry, `name(text)` checks a typed name, `trash(path)` is the macOS Trash. A refusal is `files.refuse(kind, message)`, an error whose `kind` (`NAME`, `EXISTS`, `GONE`, `INTO_ITSELF`, `OTHER_DISK`, or one of the plugin's own) reaches the sandbox as `error.kind`.

`window` is a window of the host app's, holding a view the module made: `open({ key, title, view, size, onClose })`, `get(key)`, `close(key)`. The host app frames it. `onClose` runs once the view is out of the window, alive. `open` under a key already open brings that window forward and returns it. `ofPage()` is the window the plugin's view is in now, or null: where a dialog or a preview it opens belongs. Keys are the plugin's own: two plugins asking for `log` get two windows.

A module runs until the app quits, and the app quits once every plugin's `stop()` has answered, a short while at most for each. A plugin whose module starts processes or holds resources outside the app has it end them from `stop()`, through a method of the module's own. A module runs in the app's main process and can do what the app can do, which is why it is asked for. The sandbox cannot widen its own reach: it calls only the methods a module of its own folder returns, and the main process knows which plugin calls by its sandbox.

## Installing

Settings has an Install button: pick the folder, and the plugin's sandbox is made again with it. deck keeps its own copy of the folder, replaced whole by an install, and never touches the plugin's data. Removing asks about the code and the data as two answers.

A removal lasts: the host app's next install of the plugins it ships leaves out one the person removed. An id the host app ships is the host app's; a changed copy under that id is replaced at the next start, so keep one under an id of its own.

# Writing a mod

A mod is a manifest and one entry. deck reads the manifest, runs the entry in a sandbox of the mod's own, and calls its `start(deck)`; in `start` the mod registers what it contributes: a view, keys, commands, a URL scheme handler, exports for other mods, extension points other mods extend, what it extends another's with, styles for other mods' pages, in any mix. A view is one of these abilities, and a mod with none is headless. `deck` is put together by deck, deckit on it, and the shell on deckit. The view, styles, `theme`, `ui`, `show()`, `region()`, `children` and the pins on `mods` are the shell's; deckit's own shell (the panel, the switcher and the kit) gives them as this document says. A host app with no shell, or with a shell of its own, may give none of them, and a mod that registers a view where there is no `deck.view` does not start: a mod that runs on any host app tests for the shell's members before it uses them. Code that needs the app's main process (files, the network, programs) goes in a main process module the mod starts when it needs it.

How the folder is laid out is the mod's own. The folder's name says nothing; the manifest says who the mod is, and its `main` names the entry:

```
dashboard/
  manifest.toml       main = "dist/main.js"
  dist/main.js        the entry: what deck runs in the sandbox
  dist/daemon.js      a main process module, started with deck.mainProcess('dist/daemon.js')
  src/ …              the author's sources, if the entry is bundled from them
```

The entry is one file, run as a CommonJS module with nothing else in reach: the sandbox has no `require`. A mod written as many files is bundled into one, by any bundler that writes CommonJS (esbuild, Rollup, webpack). What deck reads is `module.exports` itself, so the entry sets it, or exports `start` and the rest by name; a bundled `export default` arrives as `module.exports.default` and is refused. A main process module is a plain Node module and may require what it likes.

Each mod runs at the origin `deckit://<id>.mod/`, with its own storage and its own web sessions. Its folder is served at that origin, `deckit://<id>.mod/<path>`, for its view to use: images, styles, fonts, data, and scripts or modules its document loads. Only what is in the folder is served, and a link out of it is not. A script the document loads runs in the page's own world, apart from the entry, so it has no `deck`; it is for what the view shows (a framework's runtime, a worker) and reaches the entry through the document.

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
| `id` | yes | who the mod is, to deck and to every other mod |
| `name` | no | what a person reads; the id when left out |
| `version` | yes | the mod's own version, `MAJOR.MINOR.PATCH`, compared with what other mods require |
| `api` | yes | the version of deck's mod contract it is written against |
| `main` | yes | the entry, a path inside the folder, `/` separated |
| `url-schemes` | no | the schemes of the addresses it opens: it is one of their handlers (below) |
| `requires` | no | mod id = the lowest version it needs |
| `optional` | no | mod id = the lowest version it uses when that one is there; a mod in both is refused |
| `permissions` | no | permission = why it is needed, in words the person reads |

Any other field stops the mod loading, and so does a `main` that names no file inside the folder. The manifest is read by deckit's core before a line of the mod runs.

Only the part of TOML a manifest uses is read: top-level keys, one level of tables, and strings, booleans, integers and arrays of those as values. A key with a dot is quoted (`"system.main-process" = …`).

An id is lower case letters, digits, `.`, `_` and `-`, starts with a letter or digit, is at most 64 characters and has no `..`. Lower case only, because a mod's data is kept in a folder named by its id and macOS disks ignore case.

`url-schemes` is a list of lower case schemes without `:` (`"https"`, `"my-app"`), or `["*"]` alone for every scheme. An empty list is refused, and so are `javascript`, `data`, `blob` and `about`.

### api

The version of the contract: what the entry exports, what `deck` holds and what a main process module is handed. This deck speaks `1.0.0`. A mod loads when the major is the same and deck's minor and patch, in that order, are at least the mod's; otherwise Settings shows why it did not. The same rule compares a mod's `version` with what another requires.

### permissions

What a mod may reach beyond its own sandbox is asked for by name, with a reason. The main process checks each where the mod asks, by the sandbox it asks from.

| Permission | What it reaches | Where it lands |
|---|---|---|
| `system.main-process` | the app's main process, where the mod's modules run and can read and write files, reach the network and start programs | `deck.mainProcess` |
| `system.files` | files on this Mac, opened in its own pages | `file://` addresses in its web pages |
| `system.network` | any address, past the rules that keep one site from reading another | `fetchText(url)` on a web session |
| `system.certificates` | trusting a certificate this Mac cannot verify, in one of its sessions | `trust` on a web session |
| `system.site-permissions` | what a site's pages may use (the camera, the microphone, notifications, what was copied, the location, an app for a link), in one of its sessions | `decidePermission` on a page's delegate, `allow`, `revoke` on a web session |
| `system.clipboard` | reading what was copied, from any app | `deck.clipboard.readText` |
| `system.notifications` | notifications in the corner of the screen | `deck.notify` |
| `system.global-keys` | keys that work wherever the keyboard is in the app | `global: true` on a key |
| `deckit.mods` | every mod: listing, installing, removing and launching them again, picking and revealing their folders, the children pinned to the mod list, and restarting the app | `deck.mods` |
| `deckit.mod-settings` | every mod's settings | `deck.modSettings` |
| `deckit.key-map` | every mod's shortcuts | `deck.keymap` |
| `deckit.url-schemes` | who is asked first to open each scheme | `deck.urlSchemes` |
| `deckit.styles` | how every page looks, other mods' among them, and so what they show | `deck.styles` |

An unknown permission, or one without a reason, stops the mod. Without asking, a mod has its own sandbox, records, values, settings, keys and web sessions, and of deckit and its shell: copying text, asking for an address to be opened, putting itself on screen, showing a file in Finder, and `about()`. None of it reaches another mod.

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
        deck.handleURL((url, options) => { … });
    },
    stop() { … },
};
```

| Member | What it is |
|---|---|
| `icon` | optional; an inline SVG string, about 18px, which the shell draws rebuilt from its shapes |
| `keywords` | optional; the switcher's aliases for the mod |
| `settings` | optional; what the person can choose about the mod (below) |
| `start(deck)` | starts the mod and registers what it contributes; may be async, and deck waits for it |
| `stop()` | optional; the mod's run is ending: it terminates (removed, updated, the app quitting, restarted, a mod it requires ending), or `start` failed. It may be async, and deck waits for it a short while: what must not be lost is written here. A `stop()` that throws is written to the log; the row in Settings shows the run that follows |

Any other member stops the mod. Everything the mod reaches is in `deck`.

### settings

What the person can choose about the mod is declared. Settings draws and lists every mod's, deckit's core checks each value against its declaration and keeps it, and the mod reads them through `deck.settings`. A value is of the kind declared: `true` or `false` for a toggle, a number for a number, held within `min` and `max`, text for text, and one of the options' values for a choice.

`settings` is `{ <key>: { label, type, default, hint } }`, and `type` is one of:

| Type | Also takes |
|---|---|
| `toggle` | |
| `choice` | `options`: `[{ value, label, font }]`, or a function of `deck` that gives them. A `value` is a boolean, a number or text |
| `number` | `min`, `max`, `step`, `unit` |
| `text` | `placeholder` |
| `action` | `button` (its text) and `run(deck)`, which may return a line to show |

A declaration the core does not read, of another type or with a field of the wrong kind, is left out and shown on the mod's row in Settings; the rest stand.

## What start() registers

Each registration is a call on `deck`, made once, before `start` ends; deck contributes them all when it does. Leaving one out is how a mod opts out of it. A call made twice, or after `start` ended, is shown on the mod's row in Settings. A `start` that throws or rejects leaves the mod unstarted, with the reason on its row.

### deck.view({ content, sidebar, parent, didAppear, didDisappear })

`content` is the element shown in the panel, beside its sidebar and to the panel's top. Where a window's title bar lies over that top, the top of the view is its title bar area, as tall as the page's `--deckit-title-bar-area-height` and starting `--deckit-title-bar-area-x` from the left, past the window's buttons; both are `0px` where there is none. A mod lays its own bar there with `ui.titleBar(element)`, or uses the two values itself. Left of `--deckit-title-bar-area-x`, where the window's buttons stand, the panel takes presses to drag the window, whatever the mod draws there. Registering a view gives the mod a row in the mod list and lets it be on screen. A mod with no view is headless: it exists through whatever else it registers (keys, commands, opening addresses, exports, its main process modules) from when it starts until it stops, and a `start` that registers nothing is a headless mod that does nothing yet. `sidebar` is an element shown in the panel's sidebar, in the slot it lends under the mod list, and scrolled when it is taller. Both are laid in the mod's own page, where the panel's frame leaves them room: the mod list and its card are the panel's, drawn over and under the page. Folding the sidebar takes the mod's `sidebar` away with it and gives its room to `content`.

`parent` is the id of a mod whose view this one is shown in: a child's view goes where a region of its parent's shows it (`deck.region`, Using what another mod does), and has no row in the mod list until the person pins it there in Settings. The parent is a mod it uses, so it is in its `[requires]` or `[optional]`; a view that names any other is refused and shown on the mod's row, and the mod runs without it, as a headless mod does. In a region the view is laid in the region: no mod list, the parent showing through around it, its `sidebar` at the region's start, as wide as the panel's sidebar opens and no wider than the region, and as much of the title bar area as lies over the region.

### didAppear() and didDisappear()

The view came on screen, and went. They come in turn, never twice running.

### deck.keys(keys)

```js
deck.keys({ newTab: { key: 'mod+t', label: 'New tab', run() { … } } });
```

`key` is the default chord; the person can give the action another, or none, in Settings. Modifiers are `cmd`, `ctrl`, `alt`, `shift`, and `mod` (Cmd, or Ctrl without one); `meta`, `control`, `opt` and `option` are read as the same and written back as these. A key is live only while its mod is on screen, in its view and in the web pages it shows. A key with `global: true` works wherever the keyboard is in the app, its mod off screen and the panel closed included; it needs `system.global-keys`, has ⌘, ⌃ or ⌥ in it, and is not one a text field uses. With deckit's shell a headless mod is never on screen, so its keys are global ones, and one that is not is refused and shown on its row; what it offers to be reached from anywhere without one is a command.

### deck.commands(fn)

`fn()` returns `[{ label, hint, icon, group, run, keywords, address }]`: entries for the quick switcher, under the mod's heading. `group` is a caption inside it; `address` is a URL or a path a query matches last. Running one does not show the mod: a command that wants to be seen calls `deck.show()`. A headless mod is often nothing but this.

Instead of `run`, an entry may have a `submenu`, a list the switcher opens to search inside it; Escape or Backspace leaves it:

- `submenu: { placeholder, search(query, { signal }) }`: the mod answers each query. A new query aborts `signal`; pass it on to what fetches.
- `submenu: { placeholder, entries() }`: one list the switcher ranks itself.

An entry of `commands` has a `run` or a `submenu`; one with neither is left out. In `now`, `resolve` and a submenu, an entry without `run` is a readout: shown, never chosen.

### deck.now(fn)

`fn()` returns `[{ label, hint, icon, tone, run, attention }]`, or a promise of it: what is true this minute. The rows sit above everything in the switcher until something is typed. `tone` is `info`, `ok`, `warn` or `alert`: a name, which the switcher draws. `attention` asks for the eye once. The strip is shared: rows are taken a round at a time across mods, three in all.

### deck.resolve(fn)

`fn(query)` takes the query as typed and returns entries, or a promise of them, for what cannot be ranked because it does not exist until it is typed: a pasted link, an id. They go above the ranked list; one with `fallback: true` goes below it.

### deck.handleURL(fn)

`fn(url, options)` answers for the addresses of the schemes the manifest names: the mod is one of their URL scheme handlers. `options` is `{ activates, userInitiated, target }`. Return `true` when it opened the address; anything else passes it on. The manifest's `url-schemes` and `deck.handleURL` come together: one without the other is shown on the mod's row in Settings, and the mod is asked to open nothing.

### deck.exports(object)

What a mod that requires this one receives as `deck.requires[id]`. Values are copied as JSON and frozen when the mod starts: a value JSON does not hold (a BigInt, a Symbol, `NaN` or an infinity, an object that holds itself) leaves the mod unstarted, and an object is copied as its own enumerable properties, in their order; functions are called through the main process and so return promises. Keep them working while the view is not on screen: the mod using them is not looking at it. While a function runs, until its first `await`, `deck.caller()` is the id of the mod that called it, and at any other time it throws: a function that answers each caller in its own way reads it first, before it waits on anything.

### deck.extensionPoint(name)

Opens an extension point: a place where other mods add what this one does, which they name `<this mod's id>:<name>`. What a point takes is the mod's own to say, in its documentation: an object of values and functions, such as an account provider's name, icon and `events()`. Called in `start`, once for each name, it returns the point:

- `extensions()`: what extends the point now, `{ [mod id]: extension }`, values copied and frozen, functions called through the main process and so returning promises.
- `onChange(listener)`: `listener(extensions)` each time a mod that extends it starts or ends. Returns the unsubscribe.

Nothing extends a point while its mod starts: what extends it is added once its mod has started. A point's mod never names what extends it, and runs the same with nothing there.

```js
const providers = deck.extensionPoint('accounts');
providers.onChange((extensions) => draw(Object.values(extensions)));
```

### deck.extend({ '<mod id>:<point>': extension })

Extends another mod's points, each with an object of values and functions. The mod names that one in `[requires]`, so it runs only while that one does: it starts after the point is open, and when that one ends, it ends first. Or it names that one in `[optional]`: then deck holds the extension and the point has it while that one runs, handed again each time that one launches, and the mod runs on either way. Copied as exports are, and a value that cannot be copied leaves the mod unstarted. A point of a mod it neither requires nor uses, or one a required mod does not open, is shown on the row in Settings. What extends a point stays in its own mod's page, with its permissions and its web sessions: the point's mod calls it, and never holds what it holds.

```js
deck.extend({ 'calendar:accounts': { name: 'Google', icon, async events(account, calendar, from, to) { … } } });
```

### deck.styles({ '<mod id>' or '*': css })

With `deckit.styles`, styles other pages while the mod runs: a mod's page by its id, and every page the shell draws, the switcher's too, by `*`. A page wears them as its last style sheets, in the mods' order, the later over the earlier: a rule wins at the same specificity over the sheets the kit and the page's mod adopt, and over its `<style>` elements. A style the page sets on an element itself still wins unless the rule is `!important`. A sheet a script of the page's own world adopts, or one pushed onto `adoptedStyleSheets`, goes after them until the styles next change: which wins there is not settled, so a style does not lean on it. What the kit draws reads its tokens, `--deckit-*` on the page's root, and each mod's classes start with its id (UI.md): a mod that sets the tokens recolours what is drawn with them, and what a page colours from `theme` in its code stays as it is. A page for a mod that is not there is never styled, and a mod's styles go when it ends.

## deck

`start(deck)` receives `{ id, name, settings, storage, web, requires, optional, util }`, what it registers with (above, `styles` with `deckit.styles`), what it asks of deck (below), and `mainProcess` for a mod with `system.main-process`. The shell adds `theme`, `ui`, `show()`, `region()` and `children`, the registrations `view` and `styles`, and the pins on `mods` (the beginning of this document).

### theme and ui

`theme` is the look, derived from the host app's: `dark`, `font`, `mono`, `type`, `border`, `color`, `radius`, `shadow`, `motion` and `syntax`, each read as it is now, and `onChange(listener)` for a new one. `ui` is the kit, drawn in it. Both are in [UI.md](UI.md).

### settings

- `get(key)`: the saved value, or the declared default.
- `set(key, value)`: checked against the declaration, and resolves once kept.
- `on(listener)`: `listener(key, value)` on every change, from Settings or from the mod. Returns the unsubscribe.

### storage

- `storage.values`: `get(key, fallback)`, `set(key, value)`, `remove(key)`. Small state that costs a click to lose (a fold, a width), in the sandbox's own storage.
- `storage.records`: `get(key, fallback)`, `set(key, value)`, `remove(key)`, `keys()`. What must not be lost (bookmarks, open tabs), as JSON files in deckit's folder, written by deckit's core. `get` and `keys` are synchronous, and `get` answers a copy: change it and `set` it to keep the change. `set` and `remove` resolve once written, and a write that fails is shown on the mod's row in Settings. A key is lower case letters, digits, `.`, `_` and `-`, starting with a letter or a digit, at most 64: it names a file, and a Mac's disk is blind to case.

### web

`web.session(name)` is a web session of the mod's own, kept across restarts: `{ name, clear() }`, and with permissions `fetchText(url)`, `trust([{ host, fingerprint }])`, `allow([{ origin, permission }])` and `revoke(entries)`. Its pages share its cookies and nobody else's.

- `web.page({ session, url })` shows a web page the way a browser tab does, in the mod's view.
- `web.window({ session, url, title })` shows one in a window of its own, for a step taken and finished, such as signing in.

Both return `{ session, state, load(url), back(), forward(), reload(), stop(), mute(on), find(text, { start, back, matchCase }), stopFind({ keepSelection }), close(), delegate }`, and a page also its `element` and `focus()`. The element is a `<webview>` with white under its page, as a browser has; where it sits in the view is the mod's to say. `state` is `{ url, title, icon, loading, canGoBack, canGoForward, audible, muted, capture: { microphone, camera, screen } }`.

A page reaches its mod through its delegate:

```js
page.delegate = {
    didChange(state) {},
    didFocus() {},
    didFind(result) {},              // { matches, active, final }
    didReceiveNotification(notification) {}, // { title, body, silent, click() }
    didRefuseCertificate(info) {},
    didRequestClose() {},
    didClose() {},
    decidePermission(request) {},    // { origin, permissions, app, url }: true allows it
    shouldLeave(url) {},             // a file page's link to the web
    shouldOpenWindow(url, options) {}, // { activates, target }
};
```

A `should…` left out, or answered with anything but `false`, lets the default go ahead: the address goes to its scheme's handlers. Answer `false` when the mod opened it itself. A page opens a window only during a person's click or key in it, as a browser blocks a popup otherwise; one it opens at any other time is refused before the delegate hears of it.

A site gets what a browser lets it have without asking (full screen, writing what is copied). What a browser asks the person for (the camera, the microphone, notifications, reading what was copied, the location, an app for a link) is `decidePermission`, asked only of a mod with `system.site-permissions`; for any other mod the site is refused. Anything else a site asks for is refused.

### What the mod asks

| Member | What it does |
|---|---|
| `show()` | the shell's: puts the calling mod's view on screen; a mod with no view in the panel, or one still starting, has nothing to show. A child not in the mod list brings its parent on screen |
| `region(element)` | the shell's: a place in the mod's view where its children are shown (Using what another mod does) |
| `children` | the shell's: `list()`, `[{ id, name, icon }]` of the mods whose view names this one as its `parent` and that run or are launching again, each from its first launch, in the mods' order, and `onChange(listener)`, which hears them each time they change and returns its off |
| `caller()` | the mod that called one of this mod's exports, while the function runs to its first `await` (`deck.exports`); it throws otherwise |
| `emit(name, ...args)`, `on('<mod id>:<name>', listener)` | events, its own sent and any mod's heard (Using what another mod does) |
| `open(url, { activates, usesDefaultApp, target })` | offers an address to its scheme's handlers in turn, then deckit's own answer; resolves to whether anything opened it. Whether a person asked is main's to know, by their click or key in the mod's page or a command they ran: a handler hears it as `userInitiated` |
| `fileURL(path)`, `filePath(url)` | a file's `file://` address, and back |
| `reveal(path)` | shows a file in the system's Finder, during a person's click or key, or at any time for a mod with `system.main-process`, which could do it itself; otherwise resolves `false` |
| `chordOf(action)` | the chord one of the mod's keys is bound to now, or `''` |
| `about()` | `{ name, app, version, source, electron, chrome, home, mods, data, log }`: the host app's name and version, deckit's version and the hash of its sources, the version of each engine deckit runs on under its name in lower case (`electron` and `chrome` on Electron), the person's home folder, and the folders of deckit's mods, data and log |
| `clipboard.writeText(text)` | copies text, during a person's click or key in the mod's page or a command they ran; otherwise it resolves `false` and copies nothing |
| `clipboard.readText()` | with `system.clipboard` |
| `notify({ title, body, silent, onClick })` | with `system.notifications` |
| `mods` | with `deckit.mods`: `list`, `pick`, `install`, `remove`, `relaunch`, `reveal`, `usage`, `restartPending`, `restart`, and the shell's `pinned()` (the children the person pinned to the mod list) and `setPinned(id, pinned)`; `list`, `restartPending` and `pinned` answer at once, the rest resolve. `list()` answers `{ found, running }`: `found` is every mod deck found, loaded or not (those that load, as the app ships them and then by id, then those that did not), each its manifest with `folder`, `installed` (a copy in deckit's mods folder), `shipped`, `hides` (folders of the same id not read), `problem`, `state` (its latest run's, or null), `launched` (while it starts or stops again, what its latest run that launched contributed, as `running` lists it, or null), `mainProcess` (`{ running, failure }`: whether a main process module of its started, and why one did not, or null) and `dependencies` (`[{ id, want, name, ok, optional, running }]`, a row for each mod in its `[requires]` and `[optional]`: `want` is the version it names, `ok` whether that one loads at that version, `running` whether it is running), `dependents` (the ids of the mods that load and require it, directly or through another: none of them loads without it) and `waitsFor` (the ids of the mods it requires that are neither starting nor running: it does not start until they do); `running` is each running mod's `id`, `name` and summary, what it contributes, with `extends` (the points it extends) and `problem`. `onChange(listener)` hears that what `list` or `restartPending` answers may have changed (a mod found or gone, a run that moved, a problem against a run, a main process module that ended), and answers its off. `install(from)` is refused but during a person's click or key in the page, since what the mod installed asks for is granted as it installs; it resolves, once what ran in the mod's place has ended, to the mod's manifest with `restart`: whether only a restart of the app finishes the install. `restartPending()` answers `[{ id, why }]`, the mods whose main process modules only a restart finishes; `why` is `updated`, `removed`, `reinstalled` or `leftover` (a `dispose` that failed). `relaunch(id)` terminates the mod and launches it again, or launches one not running, resolving once the run in its place has launched or failed to, and rejects while it waits for a mod it requires (`waitsFor`); for a mod that did not load it resolves and does nothing. `usage(id)` resolves to what the mod has in each place deck keeps it, `{ data, records, settings }`: `data` the files of its data folder (`{ count, capped, hidden }`, `capped` when it holds more than were counted, `hidden` when it holds names that start with a dot), `records` the files of its records (`{ count, hidden }`), and `settings` whether it has a settings file. `remove(id, true)` erases all three |
| `modSettings` | with `deckit.mod-settings`: `list`, `set(id, key, value)`, `run(id, key)` |
| `keymap` | with `deckit.key-map`: `list`, `set`, `reset`, `record`, `onChange`; `list` answers at once, `onChange` returns the unsubscribe |
| `urlSchemes` | with `deckit.url-schemes`: `list()`, each scheme's handler list `{ scheme, system, handlers }` at once; `set(scheme, { order, off })`; `everyScheme` |

### util

| Member | What it does |
|---|---|
| `match(text, query)` | the switcher's matching: `{ tier, score, at }` or null |
| `ranker({ paths })` | the same off the page, for a list too long to rank on every key (`paths`: the names are paths, matched by their last part first): `{ rank(names, query, { limit }), close() }` |
| `movePath(path, from, to)` | a path after `from` moved to `to`, or null when it went with it |
| `tildify(path)` | a path as it is shown, from `~` under the home folder |

### mainProcess, requires, optional

`mainProcess(path)` starts a main process module of the mod's (below) and resolves to its methods, each called through the main process and so returning a promise, with `on(name, listener)` to hear what it emits; `on` returns the unsubscribe. A path outside the mod's folder, or a module that throws as it starts, rejects. A failed start is tried again the next time it is asked for.

`requires` is what each mod named in `[requires]` exports. A mod runs only while everything it requires runs, so these are there: when one of them terminates or crashes, the mod terminates too, before that one's `stop()` is asked, and it launches again, with what that one exports now, once that one launches again, or as it ends when that one already has. Calls made in `stop()` still reach it.

`optional` is a handle for each optional dependency, each mod named in `[optional]`: `exports()` is what that one exports while it runs at a version this one names, or null; `onChange(listener)` hears it each time that changes (that one launched, or began to end), and returns its off. One that begins to end is gone at once: `exports()` is null and a call to it rejects, as a mod that required it would have ended first. The mod runs whether or not that one does, and goes on running when that one ends or launches again: it neither waits for it nor launches again with it.

## Lifecycle

Each launch of a mod's entry is a run, and a run is in one of four states:

| State | What happens |
|---|---|
| `launching` | its sandbox loads, the entry is evaluated and its settings declared; once what it requires is running, `start(deck)` registers, and starts main process modules if it needs them |
| `running` | `start` has ended and deck has joined what it registered (keys, switcher, URL handler, exports); a view, if it registered one, is in the panel: didAppear and didDisappear |
| `terminating` | `stop()` is asked: removed, updated, the app quitting, restarted from Settings, a mod it requires ending, or `start` failed. A `stop()` asked while `start` is still going runs once it has ended |
| `notRunning` | it ended: `stop()` answered or its time ran out, or its page went away |

A mod launches again in a new sandbox when it is installed again, and in the same one, loaded again, when it is restarted from Settings, and when a mod it requires launches again. A new theme launches nothing again: the page takes it in place (`theme`, below). A page that loads again by itself ends its run with the page it ran in, and launches a new one. A main process module is started once for each mod and path in a run, and with `dispose` it ends with the run (A main process module, below). One with no `dispose` is kept while the app runs: a new run asking for the same path gets the one already running, and one whose code changed is taken up at the app's next start; Settings asks for the restart.

Whatever deck calls after `start`, a call that throws or rejects costs that call alone: it is shown on the mod's row in Settings, and the mod goes on. What must outlive the sandbox is written when it changes: the sandbox can be made again at any of these times.

## Using what another mod does

Two ways, and one question picks: could the host app do this if the other mod were not there?

**URL scheme handlers**, when it could. Everything opened is an address: `https://…`, a file as `file:///…`, or a scheme a mod makes up. A mod calls `deck.open(url)` and never names who answers. Each scheme has its handlers: the mods whose manifest names it, in the order the person set in Settings, then deckit's own answer (the system browser for `http` and `https`, the system's app for a file), which is always last. A file is opened, and deckit's own answer (the system browser, a file's app) given, only during a person's click or key: otherwise `deck.open` answers `false`, and a file is offered to no handler. A scheme no mod takes and deckit has no answer for ends unopened.

**requires**, when it could not. The other mod registers `deck.exports`, and this one names it in `[requires]` and receives it as `deck.requires[id]`. If what it requires is missing, too old, failed to start, or requires it back, the mod does not load, and Settings says why.

**optional**, when it could, but does more with the other there. This one names it in `[optional]` and reaches it through `deck.optional[id]` while it runs. Nothing stops for its absence: what is missing is not shown, and nothing breaks.

**Extension points**, the same dependency the other way round: the other mod uses what this one does. That one opens a point (`deck.extensionPoint`), and this one requires it, or uses it optionally, and extends the point (`deck.extend`): a calendar opens `accounts` and a mod adds Google accounts to it, an editor opens `languages` and a mod adds a language server. The dependency goes the one way requires does, so the calendar knows no provider by name, and a new provider is a new mod.

**Regions**, when this mod's view is shown in the other's. The other gives a place in its view (`deck.region(element)`) and this one names it as its view's `parent`, requiring it or using it optionally: a dashboard shows its boards, each a mod, beside its own list of them. The parent hears its children through `deck.children`, and a region answers `place(id)`, which puts that child's view in the region and out of any other, and `clear()`. Both resolve once done. `place` rejects for a mod that is not this one's child, and a mod is a child only from its first launch: a parent places the children `deck.children` lists. A region ends when its element, once in the page, leaves it, and an ended region rejects `place` and `clear`. The child keeps running in its own page, which the shell lays over what of the element is seen, following it frame by frame: cut where an ancestor clips it (a scroller's edge, the sidebar as it folds), and nothing while the element is hidden. The page is made as small as that part, not cropped, and nothing the parent draws, its menus too, comes over it. Regions are shown while their mod is the one on screen, and a child comes and goes with it (didAppear, didDisappear, its keys). A child is its parent's from when it starts, through launching again, until it starts naming another or none. A child pinned to the mod list is in the panel while it is on screen there, and back in its region after.

How another mod's pages look is changed by **styles** (`deck.styles`), with the person's leave. What another mod does is changed only where it opens a point.

Apart from both, a mod says what happened to it, for whoever cares, as **events**. `deck.emit(name, ...args)` sends one, named after the mod: `bot` emitting `status` is `bot:status` to listeners, and no mod can send another's. `deck.on('<mod id>:<name>', listener)` hears one and returns its off. Values are copied. It takes no requirement: a mod's events go out while it is running, from when its `start` has finished until it terminates, and nothing arrives from one that is not running.

## A main process module

```js
module.exports = ({ id, data, emit, window, files }) => ({
    async start(...args) { /* answers daemon.start(…) */ },
    // emit('died', reason) is heard by daemon.on('died', …)
    async dispose() { /* ends what it made: timers, watchers, servers, processes, ipcMain handlers */ },
});
```

A module exports a function that deck calls once, with what the module is handed, and that returns (or resolves to) its methods: an object of functions, nested objects walked, as exports are. A method may not be named `on`, which is how its events are heard, and `dispose` is no method: deckit calls it as the module ends. Arguments and results cross by structured clone.

`data` is the mod's data folder; anything a module keeps goes there, never in the mod's folder, which an update replaces. The folder is not there until the module makes it, as it first writes.

`files` changes a person's files without losing one: `fresh(folder, base, make, extension)` makes something new under the first free name, `rename(path, name)` and `move(path, folder)` never put anything over another entry, `name(text)` checks a typed name, `trash(path)` is the macOS Trash. A refusal is `files.refuse(kind, message)`, an error whose `kind` (`NAME`, `EXISTS`, `GONE`, `INTO_ITSELF`, `OTHER_DISK`, or one of the mod's own) reaches the sandbox as `error.kind`.

`window` is a window of the host app's, holding a view the module made: `open({ key, title, view, size, onClose })`, `get(key)`, `close(key)`. The host app frames it. `onClose` runs once the view is out of the window, alive. `open` under a key already open brings that window forward and returns it. `ofPage()` is the window the mod's view is in now, or null: where a dialog or a preview it opens belongs. Keys are the mod's own: two mods asking for `log` get two windows.

A module with `dispose` ends with the run that started it: once the run has ended, `stop()` and all, deckit closes the windows they opened (their `onClose` runs then), calls each of the run's modules' `dispose`, the last started first, a short while at most for each, then forgets their code, and the next run requires them anew. So Restart in Settings, and an install of a new version, run the new code without restarting the app. This holds only when every module of the mod's run has a `dispose`: deckit cannot end what a module made (a timer, a watcher, a server, a child process, an `ipcMain` handler, an Electron object), so a module with none runs until the app quits, keeping the code it started with, and the files the mod's modules share stay with it. A `dispose` that throws or runs out of time, or a module still starting two seconds after its run ended, leaves the mod pending a restart until the app restarts (`leftover`). When the app quits, it waits for these ends too. What a module keeps across runs goes in `folder`. A native addon cannot be unloaded from a process: a mod that ships one needs the app restarted for a new version even with `dispose`. A module runs in the app's main process and can do what the app can do, which is why it is asked for. The sandbox cannot widen its own reach: it calls only the methods a module of its own folder returns, and the main process knows which mod calls by its sandbox.

## Installing

Settings has an Install button: pick the folder, and the mod's sandbox is made again with it. deck keeps its own copy of the folder, replaced whole by an install, and never touches the mod's data. Removing asks about the code and the data as two answers.

A removal lasts: the host app's next install of the mods it ships leaves out one the person removed. An id the host app ships is the host app's; a changed copy under that id is replaced at the next start, so keep one under an id of its own.

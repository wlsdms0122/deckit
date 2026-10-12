# Writing a plugin

A plugin is a folder under `plugins/` in deckit's folder, and the folder's name is its id. Installing one is putting that folder in place. Every plugin can be removed, Settings included.

```
<id>/
  manifest.toml
  page.js        the page half
  page/**/*.js   more of the page half
  main.js        the main process half, only if it needs one
  main/**/*.js   more of the main half, which main.js requires
```

Each plugin runs in a page of its own, at the origin `deckit://<id>.plugin/`, with its own storage and its own web sessions. Files in `page/` are read before `page.js`, in path order, and run with it as one script: a declaration at the top level of one is in scope for the rest when it is called. The host loads `main.js` and nothing else of the main half; `main.js` requires what it keeps in `main/`.

The rest of the folder is served at the plugin's origin, `deckit://<id>.plugin/<path>`, for its page to use: images, styles, fonts, data, and scripts or modules its document loads. Only what is in the folder is served, a link out of it is not, and neither are `main.js` and `main/`. A script the document loads runs in the page's own world, apart from the page half, so it has no `Deckit` and no `context`; it is for what the page half shows (a framework's runtime, a worker) and reaches the page half through the document. Code that uses `context` goes in `page.js` and `page/`, where a bundler's single-file output fits too.

## manifest.toml

```toml
id = "dashboard"
name = "Dashboard"
version = "1.0.0"
api = "2.0.0"
url-schemes = ["https"]

[requires]
bot = "1.0.0"

[permissions]
"system.main-process" = "Starts the daemons the dashboard shows."
```

| Field | Required | What it says |
|---|---|---|
| `id` | yes | the folder's name |
| `name` | no | what a person reads; the id when left out |
| `version` | yes | the plugin's own version, `MAJOR.MINOR.PATCH`, compared with what other plugins require |
| `api` | yes | the version of the host contract it is written against |
| `url-schemes` | no | the schemes of the addresses it opens: it is one of their handlers (below) |
| `requires` | no | plugin id = the lowest version it needs |
| `permissions` | no | permission = why it is needed, in words the person reads |

Any other field stops the plugin loading. The manifest is read before a line of the plugin runs, by main and by the command line, against the same schema.

Only the part of TOML a manifest uses is read: top-level keys, one level of tables, and strings, booleans, integers and arrays of those as values. A key with a dot is quoted (`"system.main-process" = …`).

An id is lower case letters, digits, `.`, `_` and `-`, starts with a letter or digit, is at most 64 characters and has no `..`. Lower case only, because macOS disks ignore case. An `id` that differs from the folder stops the plugin, with the reason in Settings.

`url-schemes` is a list of lower case schemes without `:` (`"https"`, `"my-app"`), or `["*"]` alone for every scheme. `javascript`, `data`, `blob` and `about` are refused.

### api

The version of the contract: the shape of `context`, of what `register()` takes and of what `make()` returns. This host speaks `2.0.0`. A plugin loads when the major is the same and the host's minor and patch, in that order, are at least the plugin's; otherwise Settings shows why it did not. The same rule compares a plugin's `version` with what another requires.

### permissions

What a plugin may reach beyond its own page is asked for by name, with a reason. Main checks each where the plugin asks, by the page it asks from.

| Permission | What it reaches | Where it lands |
|---|---|---|
| `system.main-process` | the app's main process, where the plugin's `main.js` runs and can read and write files, reach the network and start programs | `context.main` |
| `system.files` | files on this Mac, opened in its own pages | `file://` addresses in its web pages |
| `system.network` | any address, past the rules that keep one site from reading another | `fetchText(url)` on a web session |
| `system.certificates` | trusting a certificate this Mac cannot verify, in one of its sessions | `trust` on a web session |
| `system.site-permissions` | what a site's pages may use (the camera, the microphone, notices), in one of its sessions | `allow`, `revoke` on a web session |
| `system.clipboard` | reading what was copied, from any app | `host.clipboard.readText` |
| `system.notifications` | notices in the corner of the screen | `host.notify` |
| `system.global-keys` | keys that work wherever the keyboard is in the app | `global: true` on a key |
| `deckit.plugins` | every installed plugin: listing, installing and removing them | `host.plugins` |
| `deckit.plugin-settings` | every plugin's settings | `host.pluginSettings` |
| `deckit.key-map` | every plugin's shortcuts | `host.keymap` |
| `deckit.url-schemes` | who is asked first to open each scheme | `host.urlSchemes` |

A `main.js` without `system.main-process`, or the permission without the file, stops the plugin, so what the person is asked about is what is in the folder. An unknown permission, or one without a reason, stops it too. Without asking, a plugin has its own page, records, values, settings, keys and web sessions, and of the host: copying text, asking for an address to be opened, putting itself on screen, showing a file in Finder, and `about()`. None of it reaches another plugin.

## page.js

```js
Deckit.register({
    icon: `<svg …>`,
    keywords: ['calendar'],
    settings: { … },
    make(context) {
        return { content, sidebar, didAppear, didDisappear, keys, commands, now, resolve, open, exports };
    },
});
```

| Member | What it is |
|---|---|
| `icon` | an inline SVG string, about 18px. Another plugin's page draws it rebuilt from its shapes |
| `keywords` | optional; the switcher's aliases for the plugin |
| `settings` | optional; what the person can choose about the plugin (below) |
| `make(context)` | makes the plugin; what it returns is what it contributes |

Everything a page reaches is in `context`.

### settings

What the person can choose about the plugin is declared. Settings draws and lists every plugin's, main checks each value against its declaration and keeps it, and the plugin reads them through `context.settings`.

`settings` is `{ <key>: { label, type, default, hint } }`, and `type` is one of:

| Type | Also takes |
|---|---|
| `toggle` | |
| `choice` | `options`: `[{ value, label, font }]`, or a function of `context` that gives them |
| `number` | `min`, `max`, `step`, `unit` |
| `text` | `placeholder` |
| `action` | `button` (its text) and `run(context)`, which may return a line to show |

## What make() returns

Every member is optional: leaving one out is how a plugin opts out of it. `make` is synchronous: returning nothing or a promise is refused, and a member the contract does not name is shown on the plugin's row in Settings while the plugin runs.

### content and sidebar

`content` is the element shown in the panel. Returning one makes the plugin a view: it gets a row in the plugin list and can be on screen. Leave it out and the plugin is headless: it exists only through whatever else it returns (keys, commands, opening addresses, exports, its main half), from when it starts until it is reloaded. `make()` returning `{}` is a headless plugin that does nothing yet; returning nothing, or a promise, is refused. `sidebar` is an element shown in the sidebar under the plugin list while the view is on screen.

### didAppear() and didDisappear()

The view came on screen, and went. They come in turn, never twice running.

### keys

```js
keys: { newTab: { key: 'mod+t', label: 'New tab', run() { … } } }
```

`key` is the default chord; the person can give the action another, or none, in Settings. Modifiers are `cmd`, `ctrl`, `alt`, `shift`, and `mod` (Cmd, or Ctrl without one); `meta`, `control`, `opt` and `option` are read as the same and written back as these. A key is live only while its plugin is on screen, in its page and in the web pages it shows. A key with `global: true` works wherever the keyboard is in the app, its plugin off screen and the panel closed included; it needs `system.global-keys`, has ⌘, ⌃ or ⌥ in it, and is not one a text field uses. A headless plugin is never on screen, so its keys are global ones; what it offers to be reached from anywhere without one is a command.

### commands()

Returns `[{ label, hint, icon, group, run, keywords, address }]`: entries for the quick switcher, under the plugin's heading. `group` is a caption inside it; `address` is a URL or a path a query matches last. Running one does not show the plugin: a command that wants to be seen calls `host.show()`. A headless plugin is often nothing but this.

Instead of `run`, an entry may have a `page`, a list the switcher opens to search inside it; Escape or Backspace leaves it:

- `page: { placeholder, search(query, { signal }) }`: the plugin answers each query. A new query aborts `signal`; pass it on to what fetches.
- `page: { placeholder, entries() }`: one list the switcher ranks itself.

An entry of `commands()` has a `run` or a `page`; one with neither is left out. In `now()`, `resolve()` and a page, an entry without `run` is a readout: shown, never chosen.

### now()

Returns `[{ label, hint, icon, tone, run, attention }]`, or a promise of it: what is true this minute. The rows sit above everything in the switcher until something is typed. `tone` is `info`, `ok`, `warn` or `alert`: a name, which the switcher draws. `attention` asks for the eye once. The strip is shared: rows are taken a round at a time across plugins, three in all.

### resolve(query)

Takes the query as typed and returns entries, or a promise of them, for what cannot be ranked because it does not exist until it is typed: a pasted link, an id. They go above the ranked list; one with `fallback: true` goes below it.

### open(url, options)

Answers for the addresses of the schemes the manifest names. `options` is `{ activates, userInitiated, target }`. Return `true` when it opened the address; anything else passes it on.

### exports

What a plugin that requires this one receives as `context.requires[id]`. Values are copied and frozen when the plugin starts; functions are called through main and so return promises. Keep them working while the view is not on screen: the plugin using them is not looking at it.

## context

`make(context)` receives `{ id, name, theme, ui, settings, storage, web, host, util, requires }`, with `main` for a plugin with `system.main-process` and `app` for the app's own plugin.

### theme and ui

`theme` is the look, derived from the app's: `dark`, `font`, `mono`, `type`, `border`, `color`, `radius`, `shadow`, `motion` and `syntax`. `ui` is the kit, drawn in it. Both are in [UI.md](UI.md).

### settings

- `get(key)`: the saved value, or the declared default.
- `set(key, value)`: checked against the declaration, and resolves once kept.
- `on(listener)`: `listener(key, value)` on every change, from Settings or from the plugin. Returns the unsubscribe.

### storage

- `storage.values`: `get(key, fallback)`, `set(key, value)`, `remove(key)`. Small state that costs a click to lose (a fold, a width), in the page's own storage.
- `storage.records`: `get(key, fallback)`, `set(key, value)`, `remove(key)`, `keys()`. What must not be lost (bookmarks, open tabs), as JSON files in deckit's folder, written by main. `get` and `keys` are synchronous; `set` and `remove` resolve once written, and a write that fails is shown on the plugin's row in Settings.

### web

`web.session(name)` is a web session of the plugin's own, kept across restarts: `{ name, clear() }`, and with permissions `fetchText(url)`, `trust([{ host, fingerprint }])`, `allow([{ origin, permission }])` and `revoke(entries)`. Its pages share its cookies and nobody else's.

- `web.page({ session, url })` shows a web page the way a browser tab does, in the plugin's screen.
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

### host

| Member | What it does |
|---|---|
| `show()` | puts the calling plugin on screen |
| `open(url, { activates, userInitiated, usesDefaultApp, target })` | offers an address to its scheme's handlers in turn, then the app's own answer; resolves to whether anything opened it |
| `fileURL(path)`, `filePath(url)` | a file's `file://` address, and back |
| `reveal(path)` | shows a file in the system's Finder, during a person's click or key; otherwise resolves `false` |
| `chordOf(action)` | the chord one of the plugin's keys is bound to now, or `''` |
| `about()` | `{ name, app, version, source, electron, chrome, home, plugins, data, log }`: the app's name and version, deckit's version and the hash of its sources, the engines, the person's home folder, and the folders of deckit's plugins, data and log |
| `clipboard.writeText(text)` | copies text |
| `clipboard.readText()` | with `system.clipboard` |
| `notify({ title, body, silent, onClick })` | with `system.notifications` |
| `plugins` | with `deckit.plugins`: `list`, `pick`, `install`, `remove`, `reveal`, `count`, `restartPending`, `restart`; `list` and `restartPending` answer at once, the rest resolve |
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

### main, requires, app

`main` is the plugin's main half: `{ available, call(op, ...args), on(name, listener) }`; `on` returns the unsubscribe. `available` is false when that half failed to load: something to draw, not something to throw on.

`requires` is what each plugin named in `[requires]` exports. A plugin is made only when everything it requires started, so these are there.

`app` is what the app offers, handed to the app's own plugin only.

## Lifecycle

The main half starts once, when the app does, and lives until it quits. The page half is the plugin's page: `make(context)` once when the page comes up, then `didAppear` and `didDisappear`. The page is made again when the plugin is installed again and when the app's theme changes. A main half installed again is taken up at the app's next start; Settings asks for the restart.

`register()` is called once, with `make` and no member but `icon`, `keywords` and `settings`; anything else stops the plugin. Whatever the host calls after `make`, a call that throws or rejects costs that call alone: it is shown on the plugin's row in Settings, and the plugin goes on. A `make` that throws or returns nothing leaves the plugin unmade, with the reason on its row.

What must outlive the page is written when it changes: the page can be made again at any of these times.

## Using what another plugin does

Two ways, and one question picks: could the app do this if the other plugin were not there?

**URL scheme handlers**, when it could. Everything opened is an address: `https://…`, a file as `file:///…`, or a scheme a plugin makes up. A plugin calls `host.open(url)` and never names who answers. Each scheme has its handlers: the plugins whose manifest names it, in the order the person set in Settings, then the host's own answer (the system browser for `http` and `https`, the system's app for a file), which is always last. A file is opened only when `userInitiated` says a person asked, during their click or key; otherwise it is shown in Finder. A scheme no plugin takes and the host has no answer for ends unopened.

**requires**, when it could not. The other plugin returns `exports`, and this one names it in `[requires]` and receives it as `context.requires[id]`. If what it requires is missing, too old, failed to start, or requires it back, the plugin does not load, and Settings says why.

## main.js

```js
module.exports = ({ id, folder, handle, send, window, files }) => {
    handle('start', async (...args) => { /* answers main.call('start', …) */ });
    send('died', reason); // heard by main.on('died', …)
};
```

`folder` is the plugin's data folder; anything the main half keeps goes there, never in its own folder, which an update replaces.

`files` changes a person's files without losing one: `fresh(folder, base, make, extension)` makes something new under the first free name, `rename(path, name)` and `move(path, folder)` never put anything over another entry, `name(text)` checks a typed name, `trash(path)` is the macOS Trash. A refusal is `files.refuse(kind, message)`, an error whose `kind` (`NAME`, `EXISTS`, `GONE`, `INTO_ITSELF`, `OTHER_DISK`, or one of the plugin's own) reaches the page as `error.kind`.

`window` is a window of the app's, holding a view the main half made: `open({ key, title, view, size, onClose })`, `get(key)`, `close(key)`. The app frames it. `onClose` runs once the view is out of the window, alive. `open` under a key already open brings that window forward and returns it. `ofPage()` is the window the plugin's page is in now, or null: where a dialog or a preview it opens belongs. Keys are the plugin's own: two plugins asking for `log` get two windows.

`main.js` runs in the app's main process and can do what the app can do, which is why it is asked for. The page cannot widen its own reach: only the ops `main.js` handles answer, and main knows which plugin calls by its page.

## Installing

Settings has an Install button: pick the folder, and the plugin's page is made again with it. An install replaces `plugins/<id>/` whole and never touches its data. Removing asks about the code and the data as two answers.

A removal lasts: the app's next install of the plugins it ships leaves out one the person removed. An id the app ships is the app's; a changed copy under that id is replaced at the next start, so keep one under an id of its own.

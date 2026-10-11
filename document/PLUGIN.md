# Writing a plugin

A plugin is a folder under `plugins/` in deckit's folder, and the folder's name is its id.
Installing one is dropping that folder in place; nothing is compiled, and the app is not built
again. Plugins are read at startup and none is built in, so any one can be removed, Settings
included. Deckit's own first-party plugins, which an app picks from and installs with itself, are
plugins like any other.

```
<id>/
  manifest.toml
  view.js        the page half
  view/**/*.js   more of the page half, when one file is too much
  main.js        the main-process half, only if it needs one
  main/**/*.js   more of the main half, which main.js require()s
```

The manifest says what the folder cannot: the files are fixed, so `view.js` is the plugin and a
`main.js` beside it is loaded because it is there. Files in `view/`, subfolders included, are read
before `view.js`, in path order, and run with it as one script: a `const` one of them declares at
its top level is in scope for the rest. `main/` is the same room for the main half, but a module
is not a script: the host loads `main.js` and nothing else, and `main.js` requires what it keeps
there.

Each plugin is evaluated on its own, so one with a syntax error costs itself and nothing else.

## manifest.toml

```toml
id = "dashboard"
name = "Dashboard"
version = "1.0.0"
api = "1.0.0"
url-schemes = ["https"]

[requires]
bot = "1.0.0"

[permissions]
"system.main-process" = "Starts the daemons the dashboard shows."
```

| field | required | what it says |
|---|---|---|
| `id` | yes | the folder's name, and the key of every list the app keeps (see below) |
| `name` | no | what a person reads in the sidebar, Settings and the switcher; the `id` when left out |
| `version` | yes | the plugin's own version, `MAJOR.MINOR.PATCH`; what `requires` in other plugins is compared with |
| `api` | yes | the version of the host contract it is written against (see below) |
| `url-schemes` | no | the schemes of the addresses it opens (see Open With, below) |
| `requires` | no | a `[requires]` table of plugin id = the lowest version needed (see below) |
| `permissions` | no | a `[permissions]` table of permission name = why it is needed (see below) |

Any other field stops the plugin loading. The manifest is read and acted on before a line of the
plugin runs, by the app's main process and by the command line tool, which holds a plugin to the
same schema and the same host contract before installing it. Declare `id`, `name` or
`permissions` in `register()` and they are ignored, with a line in the console saying so.

Only the part of TOML a manifest uses is read: top-level keys, one level of `[tables]` (for
`requires` and `permissions`), and as values strings, booleans, integers and arrays of those. An
array may run over several lines. Anything else is refused with its line number. So are a key set
twice, a table that appears twice, and the names `__proto__`, `constructor` and `prototype` as a
key or a table. A name with a dot in it is written in quotes (`"system.main-process" = …`), since
TOML reads a bare dotted key as a table inside a table.

`url-schemes` is a list of at least one scheme, each lower case with no `:` (`"https"`,
`"my-app"`), or `["*"]` alone for every scheme. `javascript`, `data`, `blob` and `about` are not
places and are refused.

### The id

The folder is what the installer writes, what Settings removes, and what the data directory is
named after. The manifest's `id` says the same inside the folder, so a folder copied or renamed
by hand still says what it is; an `id` that differs from the folder stops the plugin loading,
with the reason in Settings.

An id is lower case letters, digits, `.`, `_` and `-`, starts with a letter or digit, is at most
64 characters and has no `..` in it. Lower case only, because macOS disks ignore case and two ids
that differ only in case would be one folder there. `host` is taken, in any case: the app keeps
its own shortcuts, the Open With order and window places under that name. The id of the app
plugins run in is an id like any other, and the plugin that has it is the app's own (see
`context.app`). An app's command that starts a plugin checks an id by the same rule the app loads
with, so an id it accepts is one the app will load.

`name` is the other half: what a person reads. Keeping the two apart lets the id stay a plain
lower-case word while the name says "Dashboard".

### api

The version of the host contract the plugin is written against: the shape of `context`, of what
`register()` takes, and of what `make()` may return. It is not the app's version and does not
move with it: changing the contract is the only thing that can break a plugin, so that is what
gets its own number. This host speaks `1.0.0`.

`MAJOR.MINOR.PATCH`, always all three:

- **PATCH** goes up when something the contract already promised behaves differently in a way a
  plugin can see, with nothing added and nothing taken away.
- **MINOR** goes up when the contract gains something. A plugin asking for `1.2.0` needs a host
  that has whatever `1.2.0` added, and a host at `1.5.0` has it.
- **MAJOR** goes up when something it promised is gone, and then no minor or patch is enough.

The rule: the same major, and the host's minor and patch, read in that order, at least the
plugin's. Anything else is refused, and Settings shows the row with the reason rather than
leaving it out. The same rule compares a plugin's `version` with what another plugin `requires`.

### permissions

`[permissions]` names what a plugin may reach beyond its own view, each with the reason it asks,
in words the person installing it will read:

```toml
[permissions]
"system.main-process" = "Reads, writes and searches the files in your workspaces."
"system.notifications" = "Reminds you of a meeting before it starts."
```

A name says what is reached, not the call that reaches it. There are two families: `system.` is
this Mac, past what the app itself shows, and `deckit.` is deckit itself. In the order Settings
lists them, the widest first:

| permission | shown as | what it reaches | where it lands |
|---|---|---|---|
| `system.main-process` | Main Process | the app's main process, where the plugin's main.js runs and can read and write files, reach the network and start programs | `context.main` |
| `system.files` | Files | files on this Mac, opened in the plugin's own pages, where it can read them | `file://` in the pages of its own sessions (`context.web.page`); main shows a file page only in a session of a plugin that has it |
| `system.network` | Network | any address on the web or your network, past the rules that keep one site from reading another | `context.web.fetchText(url, { session })` |
| `system.certificates` | Certificates | trusting a certificate this Mac cannot verify, for one site, in one of its sessions | `trust` on a web session |
| `system.site-permissions` | Site Permissions | letting a site's pages use the camera, the microphone, notices and the rest a page asks for, in one of its sessions, and taking it back | `allow`, `revoke` on a web session |
| `system.clipboard` | Clipboard | reading what was copied, from any app | `host.clipboard.readText` |
| `system.notifications` | Notifications | notices in the corner of the screen | `host.notify` |
| `system.global-keys` | Keys Everywhere | keys that work wherever the keyboard is in the app, the panel closed included | `global: true` on a key |
| `deckit.plugins` | Plugins | every installed plugin: listing, installing and removing them | `host.plugins` |
| `deckit.plugin-settings` | Plugin Settings | every plugin's settings, not only its own | `host.pluginSettings` |
| `deckit.key-map` | Key Map | every plugin's shortcuts | `host.keymap` |
| `deckit.url-schemes` | URL Schemes | the URL schemes: who is asked first to open each, and who is off | `host.urlSchemes` |

The names and how Settings shows them are defined in `service/plugin/model/manifest.js`
(`PERMISSIONS`); what each hands over, and where, is defined in `service/plugin/client.js`
(`GRANTS`), and nothing else hands any of it out. `system.files` and `system.global-keys` hand
nothing over: main holds file pages to the sessions of a plugin that has `system.files`, and the
keymap takes a `global` key only from a plugin that has `system.global-keys`. `deckit.plugins`
covers seeing the list as well as installing, because a plugin that could list the others could
come to depend on one without declaring it.

What a plugin may do without asking is what a plugin is for, and none of it reaches past it: its
own view, data (`context.data`, `context.store`), settings and keys; web sessions of its own
(`context.storage.web(name)`) and web pages and windows in them (`context.web.page`,
`context.web.window`); copying text (`host.clipboard.writeText`); asking for an address to be
opened, or a file shown in Finder (`host.open`, `host.fileURL`, `host.filePath`, `host.reveal`,
which go through Open With and whether a person asked); putting itself on screen (`host.show`);
and what the app is (`host.about`).

A plugin with a `main.js` asks for `system.main-process`, and a `main.js` without it (or
`system.main-process` without a `main.js`) stops the plugin loading, so what the person is asked
about is what is in the folder. A plugin gets what it names and the rest are simply not there; an
unknown name, or a name with no reason, stops it loading, since a typo would otherwise mean "none"
without a word. Settings asks for the four `deckit.` ones, like anyone would, and shows each
plugin's permissions and reasons in its details. Installing from Settings lists them before the
yes, one line each: the permission's name in words beside its id ("Main Process",
`system.main-process`), what it opens up and no more, and why the plugin wants it, in the plugin's
words. None of it names the app: what a permission reaches is the same whichever app deckit runs
in.

A permission is a declaration, not a wall. Every plugin's view runs in one page, so a plugin
that meant harm could reach what it did not name (another plugin's buttons are in the same
document). What `permissions` does is keep a plugin from changing the app by accident and tell
the person what it will change. The trust is the person's, given at install, the same as for
`main.js` below.

## view.js

```js
Deckit.register({
  icon: `<svg …>`,
  keywords: ["캘린더", "calendar"],
  order: 0,
  settings: { … },
  make(context) {
    return { content, sidebar, didAppear, didDisappear, commands, keys, now, resolve, open, exports };
  },
});
```

| member | what it is |
|---|---|
| `icon` | an inline SVG string, around 18px |
| `keywords` | optional; search aliases for the quick switcher (Korean names belong here) |
| `order` | optional; the position in the list, lower first. The default is 0, ties keep registration order, and the first view is the one that opens on boot. It is only where a plugin starts: the person drags the list into an order of their own, and that wins |
| `settings` | optional; what the person can choose about the plugin (below) |
| `make(context)` | builds the plugin; what it returns is what the plugin contributes (below) |

A view has no `require`. Everything it can reach is in `context`.

### settings

What the person can choose about your plugin is declared as `settings` on the registration, not
drawn. The app lists every plugin's settings in one place (Settings > Plugin Settings), checks each
value against its declaration and keeps it with your data, so you draw no settings screen of your
own and read the values through `context.settings`. It is declared on the registration rather
than returned from `make()` because the defaults and the list are needed before your plugin runs.

`settings` is `{ <key>: { label, type, default, hint? } }`, and `type` is one of:

| type | also takes |
|---|---|
| `"toggle"` | |
| `"choice"` | `options`: `[{ value, label, font? }]`, where `font` is the CSS family a dropdown draws that row in; or a function of `context` giving them |
| `"number"` | `min`, `max`, `step`, `unit` |
| `"text"` | `placeholder` |
| `"action"` | a button: `button` (its text) and `run(context)`, which may return a line to show |

A choice about the plugin as a whole is a setting. What belongs to one thing inside it (one
calendar's colour, whether that calendar notifies) stays with that thing, in your own data and
your own dialog, and what is only where you left off (a mode, a width) is view state.

## What make() returns

What the plugin contributes is what `make()` returns, and every member is optional. The host
never assumes a shape, so leaving something out is the whole of how you opt out of it. A plugin
that only reacts to things returns an empty object. Returning nothing is refused, and the plugin
does not load, with the reason in Settings.

### content and sidebar

`content` is an `HTMLElement`, the root mounted in the content area. Returning one is what makes
the plugin a view: it earns a row in the plugin list, can be selected, and can be the one that
opens on boot. Leave it out and the plugin is headless: it exists only through whatever else it
returns.

`sidebar` is an `HTMLElement` mounted in the sidebar slot. The slot belongs to the view on screen,
so it needs `content` to mean anything.

### didAppear() and didDisappear()

The view came on screen, and went. On screen means the current view of a panel that is up. They
come in turn, never twice running, and only to views (see Lifecycle).

### keys

```js
keys: { newTab: { key: "mod+t", label: "New tab", run() { … } } }
```

Shortcuts, by action. `key` is only the default chord: the person can give the action another
chord, or none, in Settings, and the change is kept under `"<plugin>.<action>"`, so it survives
your plugin changing its default. Modifiers are `cmd`, `ctrl`, `alt` and `shift`, each its own;
`mod` is Cmd, or Ctrl on a keyboard without one.

A key is live only while its plugin is on screen; everywhere else the same chord is the app's.
Two plugins may share a chord, since only one is on screen. Keys are registered with the main
process, so they work while the keyboard is in a web page the plugin shows. A change that lands on
a chord already in use does not take effect, and Settings says so: what was working keeps working.

A key with `global: true` works wherever the keyboard is in the app, your plugin off screen and
the panel closed included, and its `run` still comes to your page. It is for what your plugin
offers the app around the panel (an app's own plugin bringing the panel up), not for a shortcut
inside your screen: a global chord is taken from every page in the app. So it is asked for
(`system.global-keys`), it has ⌘, ⌃ or ⌥ in it, and it is not one a text field uses (⌘C, ⌘←);
one that is not is left out, and Settings says why.

### commands()

Returns `[{ label, hint, icon, group, run, keywords, address }]`: entries for the ⌘⇧G quick
switcher, under the plugin's own heading. `group` is a caption inside that heading, and `address`
is a URL or path that a query matches last of all. Running one does not open the plugin: a
command that wants to be looked at calls `host.show()` itself. Headless plugins are usually
nothing but this. Commands are places to go, not settings to flip: those are in Settings.

Instead of `run`, an entry may have a `page`, which the switcher opens when it is chosen; Escape or
Backspace leaves it:

- `page: { placeholder, search(query, { signal }) }`: a page that asks only `search()` (an
  editor's files). `search` returns entries or a promise of them, and `signal` aborts once a newer
  query takes its place.
- `page: { placeholder, entries() }`: a list the switcher ranks itself, as it ranks its own (the
  bookmarks).

An entry without `run` (here, in `now()` or in `resolve()`) is a readout: inert, never
highlighted, and skipped by the cursor.

### now()

Returns `[{ label, hint, icon, tone, run, attention }]`, or a promise of it: what is true this
minute, such as the next meeting, a daemon that is down, or an unread count. The cards sit above
everything else in the switcher when nothing has been typed, and are gone as soon as something
is. Return nothing when there is nothing to say: a row that is always there stops being read.

| field | |
|---|---|
| `label` | the headline |
| `hint` | under it, and where the state goes: it is the reason the card exists |
| `icon` | 18px; the plugin's own when left out |
| `tone` | `info` (the default), `ok`, `warn` or `alert`: a name, not a colour. The host spends it on a 3px mark and the glyph; only `alert` also tints the card |
| `run` | optional; without it the card is a readout |
| `attention` | this one needs the eye. The host expresses it (a short pulse on the mark) and is the one place that can make it stop. Nothing moves under prefers-reduced-motion |

What is ready is drawn at once, and a late answer folds in as long as the switcher is still open
and untouched. The block is shared: cards are taken a round at a time across plugins, three in
all, so no plugin can fill it.

### resolve(query)

Takes the typed query, raw, and returns entries of the same shape, or a promise of them. It is
for entries that cannot be ranked because they do not exist until something is typed: a pasted
link, an id, an expression. They sit above the ranked list and are not remembered as Recent; a
promise is folded in when it lands. An entry with `fallback: true` goes below the ranked list
instead: a place to search for the text, not what the text is.

### open(url, options)

Answers for the addresses of the schemes the manifest names in `url-schemes`. It is called for an
address `host.open()` was given, with `{ activates, userInitiated, target }`. Return `true` when
it opened it; anything else, `false` or a forgotten return, passes it on. See Open With, below.

### exports

What a plugin that `requires` this one receives as `context.requires[id]`. Build it in `make()`
and keep it working while the view is hidden: the plugin using it is not looking at yours. It is
handed on frozen, your own object and everything in it, so export functions and constants, never
state that a dependent would read by holding on to it: a function that returns the state now is
what stays live. Your `version` is what `[requires]` is compared with, so its major moves when
`exports` stop working the way they did, and not when the view is redrawn.

## context

`make(context)` receives `{ theme, ui, store, data, settings, host, storage, web, util, requires }`,
with `main` when the manifest asks for `system.main-process`, `app` for the app's own plugin only,
and what each permission adds.

### theme and ui

`theme` is the colours, borders and fonts, as the place the panel is shown measured them.

`ui` is widgets in those colours, the whole kit. What is in it, by what a plugin would want to do,
and each member's options are in `UI.md`.

A plugin that draws at the top edge offsets it by the CSS variable `--deckit-top-inset`: in a
window, the window's bar comes down over that strip, and this is how far.

### store and data

`store` is `localStorage`, namespaced by plugin id: `get`, `set`, `remove`. It holds state the app
rebuilds by being used again: a fold, a width, the mode a view was left in.

`data` has the same shape (`get`, `set`, `remove`, `keys`, `path`, `on`) over JSON files under
`data/<id>/` in deckit's folder. It holds what cannot be rebuilt: bookmarks, feeds, open tabs, the
record of which reminders have already fired. The line between the two is whether losing it
matters. `data` also survives the app's profile and can be read and backed up by hand.

- `get()` is synchronous, because `make()` is.
- `set()` and `remove()` return the write as a promise. A key main would refuse throws at once,
  and a write that fails is recorded against the plugin (shown on its row in Settings) whether or
  not it is awaited.
- `on(key, fn)` fires when another window of the app writes the key. A file edited by hand is read
  at the next start.
- The key `"settings"` is the host's, where your settings are kept, and writing it directly is
  refused, in any case of its spelling, since a disk that ignores case makes them one file.

### settings

The plugin's own settings, as declared on the registration:

- `get(key)` is the saved value, or the declared default.
- `set(key, value)` changes one, checked against its declaration, and resolves once it is written.
  The same value again is no change.
- `on(fn)` hears every change once it is written, as `fn(key, value)`, whether it came from
  Settings, the plugin itself or another window.

Changing a setting from the plugin's own screen is a control of its own that calls `set()`; there
is no way into Settings.

### host

| member | what it does |
|---|---|
| `show()` | opens the panel on the plugin that calls it. It takes no id: the only one a plugin could honestly name is its own |
| `open(url, { activates, userInitiated, usesDefaultApp, target })` | opens an address the way the person set it up (Open With, below). Resolves to whether anything opened it |
| `fileURL(path)` | a file's `file://` address |
| `filePath(url)` | the path of a `file://` address |
| `reveal(path)` | shows a file or folder in the system's Finder |
| `chordOf(action)` | the chord one of the plugin's own keys is bound to now (`"⌘N"`), or `""`. For a menu hint or a tooltip; read it when it is shown, so a key changed in Settings is not promised wrong |
| `about()` | `{ name, app, electron, chrome, pluginRoot, dataRoot, logFile, version, builtAt, source }`: what the app calls deckit (`name`, for naming it to a person), what it runs in, and where it keeps things. `version`, `builtAt` and `source` are what the build wrote, null with no build; anything else a build writes comes along unpromised |
| `clipboard.writeText(text)` | copies text |

A permission adds to `host`:

| member | permission | what it does |
|---|---|---|
| `clipboard.readText()` | `system.clipboard` | reads what was copied |
| `notify({ title, body, silent?, onClick? })` | `system.notifications` | raises a desktop notice, for something the person is not looking at, which the switcher cannot cover. Clicking it raises the window and calls `onClick` once |
| `plugins` | `deckit.plugins` | installing and removing plugins (below) |
| `pluginSettings` | `deckit.plugin-settings` | `list()`, `set(id, key, value)`, `run(id, key)`: every plugin's settings |
| `keymap` | `deckit.key-map` | `list`, `set`, `reset`, `record`: every plugin's keys |
| `urlSchemes` | `deckit.url-schemes` | `list`, `set`, `everyScheme`: the Open With lines |

`host.plugins` is what Settings uses to install and remove:

- `pick()` opens a folder picker and resolves to what the folder asks for, or null.
- `install(from)` copies a folder in and returns what it did.
- `remove(id, alsoData)` removes a plugin. Code and data are removed by two separate answers,
  never one.
- `reveal(id)` shows a plugin's folder; `dataCount(id)` resolves to `{ count, capped, hidden }`.
- `running()` is what is running and what each contributes, with `problem`, what went wrong in one
  that runs. `installed()` is every folder on disk and why any is not running, with `restore`, how
  a plugin the app ships comes back once removed, when the app says (else null).
- `refresh(said)` takes the change now: it reloads the panel page, which re-reads the plugins, so
  neither installing nor removing costs a restart of the app. It rejects, without reloading, when
  main could not take the change. `said`, the line the caller would have shown, is kept for the
  reloaded page, which reads it once with `said()`.
- `restartPending()` lists what only a restart of the app takes (a changed main half), and
  `restart()` restarts it.

### storage and web

`storage.web(name)` is a web session of the plugin's own, the same session for the same name,
kept across restarts: `{ name, clear() }`. Its pages, windows and fetches share its cookies and
cache and nobody else's, so a plugin can hold two sign-ins to one site, or drop one with
`clear()`. There is no shared session: every page is in one. Sessions keep plugins from using one
another's sign-ins by mistake; they are not a wall against plugin code, which runs in the same
document. A permission adds to a session:

- `trust([{ host, fingerprint }])`, with `system.certificates`, accepts a certificate this Mac
  cannot verify and reloads what it refused.
- `allow([{ origin, permission }])` and `revoke(entries)`, with `system.site-permissions`, let a
  site use what its pages asked for without asking, and take it back. A page keeps a stream it
  already holds after `revoke()` and still believes it was granted, so reload that origin's pages.

What a session trusts or allows holds for its own pages and no others, and is kept until the app
quits, so a plugin keeps what it decided and hands it back at startup.

`web` shows pages in those sessions:

- `web.page({ session, url })` shows a web page the way a browser tab does: top level and first
  party, not a frame.
- `web.window({ session, url, title })` shows the same page in a window of its own over the window
  the person is in, for a step taken and finished such as signing in. It is closed with `close()`
  or by the person.
- `web.fetchText(url, { session })`, with `system.network`, reads an address from main in the
  session, past the rules a page is held to.

`page` and `window` each return `{ state, load(url), back(), forward(), reload(), stop(),
mute(on), find(text, { start, back, matchCase }), stopFind({ keepSelection }), close(), delegate,
session }`, and a page also `{ element, focus() }`. `session` is the one it was asked for.
`element` is a `<webview>`: put it where the page should be, and it is clipped, faded and drawn
over like any other element. `state` is `{ url, title, icon, loading, canGoBack, canGoForward,
audible, muted, capture: { microphone, camera, screen } }`. `delegate` is how the page reaches its
owner (see Lifecycle).

A permission a page asks for to open an app of this Mac is `"open:<scheme>"`, and is the
person's to allow, never a plugin's alone; what is to be kept is given with the session's
`allow()`.

### main

There only when the manifest asks for `system.main-process`: the plugin's own main half (see
main.js), `{ available, call(op, ...args), on(name, fn) }`. `call` returns a promise. `available`
is false when that half failed to load: something to draw, not something to throw on.

### requires and app

`requires` is what each plugin named in the manifest's `[requires]` exported, by id. A plugin is
only built when everything it requires was, so these are always there.

`app` is what the app the panel lives in offers (the app's `exports`), there only for the app's
own plugin, the one whose id is the app's.

### util

| member | what it does |
|---|---|
| `safeHost`, `canon` | URL helpers |
| `match(text, query)` | the switcher's own matching, for a plugin's list of names: `{ tier, score, at }` or null |
| `ranker({ paths })` | the same matching in a worker, for a list too long to rank on every key (Open Quickly's files): `{ rank(names, query, { limit }), close() }`, where `rank` resolves to the best names, or null once a newer rank came |
| `movePath(p, from, to)` | `p` after `from` moved to `to`, or null when it went with it, for paths a plugin keeps |

## Lifecycle

Whatever the host calls after `make`, a call that throws, or returns a promise that rejects,
costs that call alone: it is recorded on the plugin's row in Settings, the default follows where
there is one, and the plugin goes on. `make` is the one exception: what it returns is the plugin,
so a `make` that throws, returns nothing or returns a promise leaves the plugin unmade, with the
reason on its row.

Everything the host calls on a plugin is one of four kinds, told apart by two questions: is it
about the plugin itself, or about something the plugin has (a page it shows, its data, its main
half); and does the host wait for an answer.

| | told, no answer | asked, an answer |
|---|---|---|
| the plugin itself | **lifecycle**: `didAppear`, `didDisappear` | **requests**: `commands()`, `now()`, `resolve(query)`, `open(url, options)`, a key's or a command's `run` |
| what the plugin has | **events**: `data.on`, `settings.on`, `main.on`, a page delegate's `did…` | **questions**: a page delegate's `should…` and `decide…` |

**Lifecycle.** The main half starts once, when the app does, before the panel: `main.js` is called
and lives until the app quits. The view half is an instance per panel page, and there is one
panel: `make(context)` once when the page comes up, which returns the plugin's parts (so it is not
async), then `didAppear` and `didDisappear` as the view comes on screen and goes, in turn and
never twice running. On screen means the current view of a panel that is up, so picking another
view and the panel closing both say `didDisappear`. Only views (a plugin that returns `content`)
hear them. A new main half is not picked up until the app restarts, so right after an install the
view can be the new one while the main half is the old one, or none: `context.main.available` says
so, and Settings asks for the restart.

Where the panel is shown (over an app, or in a window of its own) is the app's, and a plugin is
not told. A move keeps the same page, so a plugin keeps its loaded pages, its scroll and its
half-typed text, and never has two instances.

There is no end. The view half ends when the panel page is replaced (an install, a removal, a
restart), and nothing called then is sure to finish, so the host promises no call there. What
must outlive the page is written when it changes, to `data` or `store`; what the page holds (the
pages it shows, what it listens to, its timers) goes with it, so there is nothing to undo.

**Requests** use what the plugin offered from `make()`. They come whether or not it is on
screen, with one exception: a key is bound only while its plugin is on screen, so `keys.*.run`
comes only then (offer the same thing as a switcher command to reach it from anywhere), unless the
key is `global`.

**Events and questions** come from what the plugin has. Events are told and not waited for:
`data.on`, `settings.on` and `main.on` take any number of listeners, and a page's `did…` go to
its one delegate. A question is asked of the one owner and the answer is awaited; with no answer,
the host's default follows. A page has a delegate, set by the plugin that shows it
(`page.delegate = { … }`), and it is the page's only way to its owner:

```js
page.delegate = {
  didChange(state) {},                // events: what happened
  didFocus() {},
  didFind(result) {},
  didReceiveNotification(notice) {},
  didRefuseCertificate(info) {},
  didRequestClose() {},
  didClose() {},                      // a page in a window: the window was closed
  decidePermission(request) {},       // questions: true allows; anything else refuses
  shouldLeave(url) {},                // a file page's link to the web
  shouldOpenWindow(url, options) {},  // a new window the page asked for
};
```

What they are handed:

| | |
|---|---|
| `decidePermission(request)` | `{ origin, permissions, app, url }`; `true` allows this one request |
| `didReceiveNotification(notice)` | `{ title, body, silent, click() }` |
| `didFind(result)` | `{ matches, active }`; `find(text, { start: true })` starts a new search, `find(text)` goes to the next match |
| `shouldOpenWindow(url, options)` | `{ activates, target }`: `target` is the window the page named, so a second request for it can reuse a tab. A popup that states a size is never asked about: it opens as a real window |

`should…` answers whether the default goes ahead, so a delegate that leaves one out, or forgets
to return, lets the default happen: a page's new window, or a file page's link to the web, goes to
Open With. Answer `false` when you opened it yourself.

**The web.** Every page is in a web session of the plugin's own (`context.storage.web(name)`). A
page in the plugin's screen is `context.web.page({ session, url })`; the same page in a window of
its own, for a step taken and finished such as signing in, is `context.web.window({ session, url,
title })`, and the plugin decides when it is done by watching `didChange` (a sign-in lands on the
site's own "who am I") and closes it, or hears `didClose` when the person closed it first. A
plugin that wants another's sign-ins `requires` it, and that plugin exports the session.

## Using what another plugin does

There are two ways, and no third.

**Opening an address: Open With.** Everything opened is an address, a URL: a web page is
`https://…`, a file on this Mac is `file:///…` (`host.fileURL(path)` makes one), and a plugin may
make up a scheme of its own (`finder://…`), or one several plugins share. A plugin that wants
something opened calls `host.open(url)` and never names who answers. A plugin that can open some
addresses lists their schemes in its manifest and answers with `open` from `make()`:

```toml
url-schemes = ["http", "https"]   # or ["*"] for every scheme
```

```js
open(url, { activates, userInitiated, target }) {
  /* open it and return true; anything else passes it on */
}
```

Each scheme is a line: the plugins that name it (and those that name `"*"`), in the order the
person set in Settings, then the host's own answer for the schemes it has one for: the system
browser for `http` and `https`, the system's app for `file`. The plugins that name `"*"` also have
a line of their own, every other scheme, for the addresses no line names. Deckit names no scheme
to make this work, so a new one needs no change to deckit, only a plugin that names it. A scheme
the host has no answer for ends unopened when every plugin passes (`host.open` says false): the
host never hands an unknown scheme to the system. Nobody is told whose an address is: a plugin
that knows some addresses opens those and passes the rest on. An app's own plugin is the usual
example: in the `https` line it opens the links into that app and passes everything else to
whoever is next, the Browser, then the system browser. The Finder opens every file through
`host.open`, and the Editor, in the `file` line, opens text and passes everything else on. A
plugin never opens another plugin to show an address or a file; it calls these and does not know
who answered.

The options are the same whatever the scheme, and a caller gives them to `host.open(url, {
activates, userInitiated, usesDefaultApp, target })`. A plugin that wants a file's path asks
`host.filePath(url)`, the other way of `host.fileURL(path)`. `activates`, true unless said, brings
what opens it forward; false is for what should stay behind what is being read. The host's answer
opens a file only when `userInitiated` says a person asked for it (a double click, Enter, a menu
item); without it, it shows the file in Finder instead, whatever kind of file it is. It is the
caller's word, not a proof: it keeps a plugin from running a file it only listed by mistake, not
one that means to. `usesDefaultApp` skips the plugins and goes straight to the host's answer, for
an "Open with Default App". `target` is the window a page named, so a second request for it can
reuse a tab.

Settings > URL Schemes lists each line, a switch on each plugin, and the host's own answer as the
last row, which cannot be moved or switched off. Removing a plugin gives the behaviour back
instead of breaking it. Until the person orders them, a plugin the app names first goes first
(`openWith` in `app/config`, the app's own plugin for `https`), and the rest follow in the list's
order. Standing in a line is not a permission: any plugin may name a scheme, and only the person
(or a plugin with the `deckit.url-schemes` permission) orders the lines.

Only `true` takes a request, so a handler that forgot to return passes it on instead of losing it.
What the screen does after is the taker's, since only it knows: the Browser shows itself with
`host.show()` for a tab it opened, and an app's own plugin that went to something in the app
steps aside for it. A request that does not activate leaves the screen as it is.

What goes through here is opening a place, and only that: the first that takes it ends it, and
whoever asks does not care who. Sharing is not (where it goes is chosen each time, not ordered
once), and neither is "Show in Finder", which names the system's Finder and is
`host.reveal(path)`. A scheme only one plugin names is a way into that plugin that breaks nothing
when it is gone; a plugin that cannot work without another requires it.

**Something only that plugin has: require it.** If yours cannot work without another plugin, say so
in the manifest:

```toml
id = "dashboard"
name = "Dashboard"
version = "1.0.0"
api = "1.0.0"

[requires]
bot = "1.0.0"
```

The version is the lowest one yours needs, under the same rule as `api`, compared with the other
plugin's `version`. The other plugin returns `exports` from `make()`, and yours receives it as
`context.requires.bot`. Nothing else of the other plugin is reachable, so a dependency nobody
wrote down cannot exist. If what you require is missing, too old, failed to load, or requires you
back, your plugin does not load, and Settings shows the reason in red under its row; a row opened
up says what it requires. Removing a plugin that others require says which ones will stop loading
before you confirm.

The app plugins run in is reached the same way. What it offers is handed to one plugin only, the
app's own, whose id is the app's: it receives it as `context.app` and exports it again. A plugin
made for that app writes `requires = { <the app's id> = "1.0.0" }` and receives it as
`context.requires.<the app's id>`, under the same rules as any requirement, so no part of the
contract carries the shape of any one app. In another app there is nothing to hand on, so the
app's plugin does not start there, and neither does a plugin that requires it.

The rule for choosing: if the app could do it by itself without your plugin noticing, it is a
behaviour, so call the host. If there is nothing to fall back to, it is a requirement: a board
that draws what another plugin watches requires that plugin and reads what it exports.

## main.js

Only for a plugin that needs to spawn a process, read a file or talk to the network in a way the
page cannot.

```js
module.exports = ({ id, dir, data, handle, send, window, files }) => {
  handle("start", async (...args) => { /* returns to the view */ });
  send("died", reason);                 // pushes to the view
};
```

`dir` is the plugin's own folder and is read-only: an update replaces it whole. Anything a main
half keeps goes through `data`, never under `dir`.

`files` is how a person's files are changed without losing one, for a plugin that makes, renames
or throws away what it shows: `files.fresh(dir, base, make, ext)` makes something new under the
first free name ("untitled", "untitled 2"; `make(path)` must refuse what is there),
`files.rename(path, name)` and `files.move(path, folder)` never put anything over another entry,
`files.name(text)` checks a typed name, and `files.trash(path)` is the macOS Trash. A refusal's
message starts with its kind (`NAME`, `EXISTS`, `GONE`, `INTO_ITSELF`, `OTHER_DISK`), which the view reads as
`error.kind` (see `context.main`).

`window` is a window of the app's own: frameless, remembering where it was left, and taking its
view back out before it closes. `window.open({ key, title, view, background, beforeClose,
afterDetach })` puts a `WebContentsView` in one, and `get`/`close`/`lights` take the same key. The
keys are namespaced by plugin id, so two plugins asking for `"log"` get two windows and neither
can reach the other's. It is on the main half and not on `context` because a window holds a
`WebContentsView`, and making one is the main process's to do.

The window brings its own bar, the same one every window of the app has, so the page inside does
not draw one and does not mark anything to drag by. What it can do is name itself: the bar shows
the page's `document.title` and favicon. If it draws anything at its top edge,
`--deckit-top-inset` says how far the bar has come down over it.

The view reaches it through `context.main`, which is there because the manifest asks for
`system.main-process`:

```js
const r = await main.call("start", options);
main.on("died", (reason) => { … });
```

`main.available` is false when that half failed to load. That is something to draw, not
something to throw on; half a plugin is worth more than none.

`main.js` is required into the app's main process and can do what the app can do; it is not
sandboxed. It is asked for as the `system.main-process` permission, with a reason, so the person
installing it is told.

What the host does owe is that the view cannot widen its own reach. The view names an op; only
the ops this file registered answer. The plugin id travels with every call, so no plugin can
reach another one's.

A plugin that talks to more than one system splits by system and then by concept: a folder per
system in `view/` and `main/` (say `view/daemon/` and `main/daemon/`), each mode one file in a view
folder with its half under the same name in the main one, and `view.js` and `main.js` only put
them together. A plugin written for one person's setup is kept apart from what an app ships: it
would be a broken row in anybody else's Settings.

## Installing

Settings has an Install button: pick the folder, and the panel reloads with it. The app does not
restart.

An install replaces `plugins/<id>/` outright and never touches `data/<id>/`. Everything under
`plugins/<id>/` is code by definition: nothing there survives an update. Removing asks about the
code and the data as two answers, because they are two decisions.

Installing a folder whose id is already there is an update: the code is replaced, the data is
not. What takes effect at once is everything the panel draws, because the panel reloads and a page
re-reads every plugin. What does not is a main half that was already running, since a module
required into the app's main process stays there. When an update changes `main.js` or anything in
`main/`, Settings says so, names the plugin, and offers a Restart button; when the update left the
main half alone, nothing is asked. Removing a plugin whose main half was running asks the same,
since whatever it started keeps running until the process ends.

A removal lasts. Updating the app updates the plugins that are installed and installs ones that
are new to it, but leaves out one that was removed. It comes back the way it first came: Install
in Settings, picking its folder. For a plugin the app ships, the remove dialog also says the app's
own way (`restore` in `app/config`).

A plugin the app had at the last install and no longer ships (renamed, or folded into another) is
removed by the app's next install of its plugins: nobody would update it again, and left there it
would keep loading beside whatever took its place. Its data stays, as a removal in Settings
leaves it.

An id the app ships is the app's. A folder of your own installed under one of those ids (a
changed copy of the Browser, say) is replaced by the app's copy at the next update, the way an
installed plugin of that id always is. Keep a changed copy under an id of its own.

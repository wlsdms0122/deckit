# Writing a mod

A mod is a manifest and one entry, and the entry exports one class. deck reads the manifest, runs the entry in a sandbox of the mod's own, and makes one instance of the class for the run. Two lifecycles are stacked on that instance. deckit calls `start(deckit, frameworks)` on every host app, and the mod registers there what it does: exports for the interfaces it provides and for the mods that reach it, and the work that runs with no screen. Where a UI shell draws mods, deckit's shell then calls `attach(shell, deckit, frameworks)` on the same instance, and the mod registers there what it shows: its windows, a view in another mod's window, styles for other mods' pages, and the chords and handlers that work on what it shows. A host app with no UI shell never calls `attach`, and the mod runs on what `start` registered. Every method is optional, so a mod with only `start` is headless, and one with only `attach` only draws. What a mod declares to the system's services (its commands, keys, settings and addresses) is in its manifest, there whether it runs or not. Code that needs the app's main process (files, the network, programs) goes in a main process module the mod starts when it needs it.

How the folder is laid out is the mod's own. The folder's name says nothing; the manifest says who the mod is, and its `main` names the entry:

```
dashboard/
  manifest.toml       main = "dist/main.js"
  dist/main.js        the entry: what deck runs in the sandbox
  dist/daemon.js      a main process module, started with mainProcess.start('dist/daemon.js')
  src/ …              the author's sources, if the entry is bundled from them
```

The entry is one file, run as a CommonJS module with nothing else in reach: the sandbox has no `require`. A mod written as many files is bundled into one, by any bundler that writes CommonJS (esbuild, Rollup, webpack). What deck reads is `module.exports` itself, which is the class; a bundled `export default` arrives as `module.exports.default` and is refused. A main process module is a plain Node module and may require what it likes.

Each mod runs at the origin `deckit://<id>.mod/`, with its own storage and its own web sessions. Its folder is served at that origin, `deckit://<id>.mod/<path>`, for its view to use: images, styles, fonts, data, and scripts or modules its document loads. Only what is in the folder is served, and a link out of it is not. A script the document loads runs in the page's own world, apart from the entry, so it has no handle; it is for what the view shows (a framework's runtime, a worker) and reaches the entry through the document.

## manifest.toml

```toml
id = "dashboard"
name = "Dashboard"
version = "1.0.0"
api = "1.0.0"
main = "dist/main.js"
background = "Shows the boards' alerts as they come."
icon = "<svg viewBox='0 0 24 24' …>…</svg>"
keywords = ["boards", "alerts"]

[interfaces]
provides = { "dashboard/boards" = [1] }
uses = { "switcher/actions" = 1, "deckit/configuration" = 1 }

[permissions]
"system.main-process" = "Starts the daemons the dashboard shows."

[[contributes."deckit/commands"]]
id = "open-board"
title = "Open Board"
params = { type = "object", properties = { board = { type = "string", title = "Board" } }, required = ["board"] }
```

| Field | Required | What it says |
|---|---|---|
| `id` | yes | who the mod is, to deck and to every other mod |
| `name` | no | what a person reads; the id when left out |
| `version` | yes | the mod's own release, `MAJOR.MINOR.PATCH`, by which an install tells a newer copy |
| `api` | yes | the version of the mod contract it is written against |
| `main` | yes | the entry, a path inside the folder, `/` separated |
| `background` | no | why it runs in the background, in words the person reads: deckit launches it as the app starts (Running and quitting, below) |
| `interfaces` | no | `provides`, interface = the majors of it the mod speaks, and `uses`, interface = the major of it the mod speaks (below) |
| `permissions` | no | permission = why it is needed, in words the person reads |
| `contributes` | no | `[[contributes."<interface>"]]`, entries declared to an interface's owner, there whether the mod runs or not (below) |

The layers on the host app add fields of their own, which deck carries and does not read. Deckit's shell reads these:

| Field | What it says |
|---|---|
| `activationPolicy` | `"accessory"` for a mod the Dock never shows; any other value, or none, is `regular`, an app mod |
| `icon` | an inline SVG string, about 18px, single-quoted attributes, which the shell draws rebuilt from its shapes |
| `keywords` | other words the mod is matched by beside its name |
| `view` | `{ parent = "<interface>" }`: the interface, one in its `uses`, whose owner's regions show the mod's view (`shell.region`, below) |
| `styles` | `{ "<mod id>" or "*" = a CSS file inside the folder }`, worn as `shell.styles.register`'s are, from the time the mod is installed, running or not, with `deckit.styles` |

Any other field stops the mod loading, and so does a `main` that names no file inside the folder. The manifest is read by deckit's core before a line of the mod runs.

Only the part of TOML a manifest uses is read: top-level keys, one level of tables, and strings, booleans, integers, arrays and inline tables of those as values. An inline table is written on one line. A key with a dot is quoted (`"system.main-process" = …`).

An id is lower case letters, digits, `.`, `_` and `-`, starts with a letter or digit, is at most 64 characters and has no `..`. Lower case only, because a mod's data is kept in a folder named by its id and the machine's disks ignore case.

### interfaces

The interfaces the mod provides and those it uses. An interface is named `<mod id>/<name>`: the id of the mod that defines it, whose README is its document, and a name of the same characters as an id. Its major is not part of the name. `provides = { "dashboard/boards" = [1] }` puts the mod in the queue of `dashboard/boards`, speaking major 1 of it, and the mod opens the exports the document writes down (Interfaces, below). `uses = { "switcher/actions" = 1 }` says the mod speaks major 1 of `switcher/actions`: it is connected to the interface's owner while the owner speaks that major. Any mod may provide any interface, the one that defines it among them, which names it here like any other. A mod may use an interface it provides, and while it owns it, it is as if there were no owner. Using an interface is never required: the mod runs whether or not the interface has an owner. The table takes `provides` and `uses` and nothing else, each an inline table on one line, with its keys quoted.


### api

The version of the contract: what the class has and how it is called, what the handles `deckit` and `shell` hold, the names of the permissions, and what a main process module is handed. This deck speaks `1.0.0`. A mod loads when the major is the same and deck's minor and patch, in that order, are at least the mod's; otherwise Settings shows why it did not.

### permissions

What a mod may reach beyond its own sandbox is asked for by name, with a reason. The main process checks each where the mod asks, by the sandbox it asks from.

| Permission | What it reaches | Where it lands |
|---|---|---|
| `system.main-process` | the app's main process, where the mod's modules run and can read and write files, reach the network and start programs | `mainProcess.start` |
| `system.files` | files on this Mac, opened in its own pages | `file://` addresses in its web pages |
| `system.network` | any address, past the rules that keep one site from reading another | `fetch(url, init)` on a web session |
| `system.certificates` | trusting a certificate that cannot be verified, in one of its sessions | `trust` on a web session |
| `system.site-permissions` | what a site's pages may use (the camera, the microphone, notifications, the location, an app for a link, and what was copied as far as the clipboard permissions reach), in one of its sessions | `decidePermission` on a page's delegate, `allow`, `revoke` on a web session |
| `system.clipboard-read` | reading what was copied, from any app | `deckit.clipboard.readText` |
| `system.clipboard-write` | replacing what was copied with text of its own, which the person then pastes in any app | `deckit.clipboard.writeText` |
| `system.file-handlers` | handing files on this Mac to whatever opens them, which can start programs | `deckit.openExternal` of a `file://` address and `web.downloads.open` |
| `system.overlay-windows` | a window of its own over every app's, on every desktop, whichever app is in front | `level: 'overlay'` on `shell.windows.open` |
| `system.notifications` | the system's notifications | `deckit.notifications` |
| `system.global-keys` | keys that work in every app, this one in front or not, taken from all of them | `scope: 'global'` on `shell.keys.take` |
| `deckit.app-keys` | keys that work wherever the keyboard is in the app, whatever is in front | `scope: 'app'` on `shell.keys.take` |
| `deckit.shell-keys` | the shell's own keys: listing them and giving them chords | `list`, `set` and `reset` on `shell.keys` |
| `deckit.styles` | how every page looks, other mods' among them, and so what they show | `shell.styles.register`, the `styles` field |
| `deckit.fonts` | the fonts and the text size every mod writes text in | `shell.fonts` |
| `deckit.mods` | every mod: listing, installing, removing, launching and quitting them, choosing the mod that owns each interface, keeping mods in the Dock and opening them, and restarting the app | `deckit.mods`, `shell.mods` |
| `deckit.reach-mods` | any mod by its id, which launches it if it does not run | `deckit.dependencies.reach` |
| `deckit.system-services` | other mods, through the system's services: running their commands, changing their keys and settings, and choosing which mod opens an address | the exports of the system mods (Standard interfaces) |

Each layer defines the names of what it adds and checks them where the mod asks; deck only keeps what a mod asked for. A name without a reason stops the mod. `deckit.mods`, `deckit.reach-mods` and `deckit.system-services` are privileged: a mod that is not a system mod and asks for one does not load. A name no layer on this host app defines (`system.overlay-windows`, `deckit.styles`, `deckit.fonts`, `deckit.app-keys` and `system.global-keys` where no UI shell is, or one misspelled) is not usable here: the mod runs without what it guards. Without asking, a mod has its own sandbox, records, values and web sessions, and of deckit and its shell: opening a web address outside the app, windows of its own, and `about()`. None of it reaches another mod.

### contributes

```toml
[[contributes."deckit/configuration"]]
key = "homepage"
type = "string"
title = "Homepage"
default = ""

[[contributes."switcher/actions"]]
label = "Show Log"
```

What the mod declares to an interface's owner, a `[[contributes."<interface>"]]` table for each entry: there from the time the mod is installed, whether its run is there or not. An entry is data, its shape the interface's to define, read by deckit's core with the manifest; deck hands the entries to the interface's owner (Declared contributions) and reads none of what they say. The system's services read theirs this way: commands under `deckit/commands`, keys under `deckit/keys`, settings under `deckit/configuration` and addresses under `deckit/urls` (Standard interfaces). A mod declares to an interface whether or not it uses it.

## The entry

```js
class Calendar {
    async start(deckit) {
        this.providers = new Map();
        deckit.exports.register({ connect: () => ({ runCommand: (id, args) => this.run(id, args) }) });
        deckit.exports.register('calendar/accounts', {
            connect: (connection) => ({
                setProvider: (provider) => {
                    this.providers.set(connection, provider);
                },
            }),
            disconnect: (connection) => this.providers.delete(connection),
        });
    }

    stop() { … }

    attach(shell, deckit) {
        this.window = shell.windows.open({ name: 'main', content, width: 900, height: 600 });
        deckit.dependencies.onConnect('switcher/actions', (switcher) => switcher.setActions(actions));
    }

    reopen() { … }

    detach() { … }
}

module.exports = Calendar;
```

| Member | Read or called by | What it is |
|---|---|---|
| `start(deckit, frameworks)` | deckit | the function lifecycle starts: it registers what the mod does; may be async, and the run waits for it |
| `stop()` | deckit | the function lifecycle ends, with the run |
| `attach(shell, deckit, frameworks)` | deckit's shell | the screen lifecycle starts, once `start` has ended: it registers what the mod shows; may be async |
| `detach()` | deckit's shell | the screen lifecycle ends, before `stop()` |
| `reopen()` | deckit's shell | the mod is opened from the Dock while it runs with no window open |

`frameworks` is a frozen table, by name, of the handles the frameworks the host app stacks hand every lifecycle, each made for that lifecycle: `web`, the mod's web sessions and downloads, where the host app puts the web engine on deckit, as Deckit.app does (web, below), read as `start(deckit, { web })` and `attach(shell, deckit, { web })`, and `mainProcess`, the mod's main process modules, where the host app runs them, as Deckit.app does (mainProcess, below); `{}` on a host app with none, where `web` and `mainProcess` are `undefined`.

Each layer reads only the members it knows, and every one is optional. What is listed and shown of a mod that does not run (its icon, keywords, view and what it declares to the system's services) is in its manifest, not in the class. The class may have any other member it likes: no layer reads it, and none catches a misspelt `detatch`. Share state between the methods through `this`.

## Lifecycles

| | Function lifecycle | Screen lifecycle |
|---|---|---|
| Methods | `start(deckit, frameworks)`, `stop()` | `attach(shell, deckit, frameworks)`, `detach()` |
| Called by | deckit, on every host app | deckit's shell, only where it draws mods |
| What goes in it | what must happen on a host app with no UI: the exports that answer its commands, exports that work with no UI, reminders and notifications | what exists to be shown: windows, a view, styles, the chords it takes, handlers that bring something on screen, exports that mean something only on screen, switcher actions and Settings buttons |
| If it throws | the run does not start: the mod is broken | only the screen lifecycle ends, and the run goes on with what `start` registered |

Which method a mod registers a thing in is one question: does this job have to happen on a host app with no UI? A calendar's reminders do, so `start` sets them and posts their notifications to `deckit/notifications`; the commands it declares are answered by the exports `start` opens, so a key or a switcher runs them with no screen. Which lifecycle a mod opens its exports in is part of what it promises, and its documentation says it: the Switcher opens `setActions` in `attach`, so a mod hands it actions in `attach`; Calendar opens `setProvider` in `start`, so a provider hands itself over in `start`.

The function side never reaches the screen side. `start` does not receive `shell`, and code `start` set going (a timer, a listener, a function its exports hand another mod) does not use a `shell` it was handed later, or the DOM of the page as something shown: the page is the mod's sandbox, not its screen. A mod that does breaks where no shell draws it. Nothing stops it; it is the mod's fault.

The lifecycles wrap the run in the order they stack. As the run launches, `start` runs and what it registered is joined: the run is running. Then `attach` runs, and what it registered is joined to the run's as it ends. A slow `attach` keeps the mod's screen waiting, not the exports it opened in `start`. As the run ends, `detach()` runs, then `stop()`, each without waiting on a start still going, each with its own short time: what is still running when it runs out is left. What must not be lost is written there, or better, as it changes.

If `attach` throws, or what deckit's shell does to the page as the screen lifecycle starts fails, the screen lifecycle ends: what is on screen goes, `detach()` runs, what its handles made is cut (below), its connections end, and the problem is shown on the mod's row in Settings. It is not ended again as the run ends. `detach` is called after an `attach` that did not finish, so it bears state half made.

### What a lifecycle's handles make

Each method that starts a lifecycle receives handles of its own: the `deckit` that `attach` receives has the members of the one `start` received, with its own `dependencies`, and registers into the screen lifecycle, and each receives a `web` and a `mainProcess` of its own. What a handle makes that calls back into the mod's code is cut as its lifecycle ends, without the mod undoing it: registrations; `events.on`, `mods.onChange`, `dependencies.onConnect` and `dependencies.onRefuse`; `notifications.show`'s `onPress`; `web.downloads.onChange`; `mainProcess.onChange` and the `on` of a main process module's methods; `shell.theme.onChange` and `children.onChange`; regions, drop destinations, `shell.web` pages, the chords `shell.keys` took, windows and the view. A window or view on screen disappears first (`didDisappear`), then the end method runs, then the rest is cut, and then the lifecycle's connections end (Dependencies and connections). What the mod makes itself (an emitter of its own, a timer, a listener on the DOM) it undoes in `detach` or `stop` when it would call back into a lifecycle that has ended. A main process module started in `attach` ends with the run.

### Registering

Each registration is a call on a handle, once in each lifecycle, while the method that received the handle runs; the lifecycle joins them all when that method ends. Leaving one out is how a mod opts out of it. A call of `deckit.exports.register` made twice, or after its method ended, is shown on the mod's row in Settings. `shell.view.register` and `shell.styles.register` answer nothing and are never refused: one made twice, after its method ended, or that does not fit, registers nothing.

| Registration | On | What it registers |
|---|---|---|
| `deckit.exports.register(interface, { connect, disconnect })` | `deckit`, once for the run for each interface | the exports of an interface it provides, which the mods that use it are connected to while it owns it |
| `deckit.exports.register({ connect, disconnect })` | `deckit`, once for the run | its own exports, which the mods that reach it by id are connected to |
| `shell.view.register(view)` | `shell` | its view in another mod's region |
| `shell.styles.register(styles)` | `shell`, registering for a mod granted `deckit.styles` | styles for other pages |

`exports.register` is called once for the run for each interface, and once for the mod's own exports, in the lifecycle that has the job: once one lifecycle opened a set of exports, a call for it in the other is refused.

### Keys

A key that runs one of the mod's commands, wherever the keyboard is in the app or in every app, is declared to `deckit/keys` in the manifest, `[[contributes."deckit/keys"]]`: its owner binds it, lists it in Settings and takes its chord, whether the mod runs or not ([README](../source/deckit/mods/keymap/README.md)). A chord the mod takes itself is `shell.keys.take` (shell, below), from `attach`, `app` with `deckit.app-keys` and `global` with `system.global-keys`, and it is let go as `attach`'s run ends. A key of what the mod shows is its page's, heard in its document.

### Commands and addresses

A mod declares its commands to `deckit/commands`, `[[contributes."deckit/commands"]]` in its manifest, and runs them on the exports it opens for its id (`deckit.exports.register({ connect })`, no interface), `runCommand(id, args)` and `completeCommand(id, param, partial, args)`, in `start`, so they run with no screen ([README](../source/deckit/mods/commands/README.md)). It declares the addresses it opens to `deckit/urls` the same way, and opens them on the same exports, `openURL(url, options)` ([README](../source/deckit/mods/urls/README.md)). Those system mods reach it by id, which launches it if it does not run.

### shell.view.register({ content, didAppear, didDisappear })

`content` is the element shown in a region of another mod's window: the region its owner gives for the interface the manifest's `view` names as `parent` (`shell.region`, below), launching the mod if it does not run. A view is registered only by a mod whose manifest gives its view a parent; for any other mod, or `content` that is no element, it registers nothing. It is laid in the mod's own page, where the region lies.

### didAppear() and didDisappear()

The view came on screen, and went. They come in turn, never twice running, and a view on screen as the screen lifecycle ends is told `didDisappear` before `detach()`.

### shell.windows.open({ name, content, level, width, height, minWidth, minHeight, activates, didAppear, didDisappear, didBecomeKey, didResignKey, didResize, didClose })

Opens a window of the mod's, `content` in it, or orders front the one of its `name` open, and answers it: `{ name, isKey, close(), minimize(), zoom(), orderFront(), makeKeyAndOrderFront(), resize(width, height) }`. It is the key window, unless `activates` is false, which leaves the keyboard where it is. A `normal` window, the default `level`, opens on the desktop where its mod last left the window of its name; `overlay` floats it over every app and needs `system.overlay-windows`. `shell.windows.list()` answers the windows open, in the order they opened. Each callback hears what its name says; a window open as the screen lifecycle ends closes. `open` throws its refusal, an error with `stage` `call` and its `kind`: `NOT_PERMITTED` for `overlay` without `system.overlay-windows`, then `INVALID_ARGUMENT` for options that are not a window's (a `name` and `content` an element, a `level` of the two, sizes above 0). A window's `resize` throws `INVALID_ARGUMENT` for a size not above 0.

### shell.styles.register({ '<mod id>' or '*': css })

For a mod granted `deckit.styles`, styles other pages while the screen lifecycle lasts (for any other mod it registers nothing): by id that mod's page, its own among them, and by `*` every page, the shell's too, and every mod's. A page wears them as its last style sheets, in the mods' order, the later over the earlier: a rule wins at the same specificity over the sheets the kit and the page's mod adopt, and over its `<style>` elements. A style the page sets on an element itself still wins unless the rule is `!important`. A sheet a script of the page's own world adopts, or one pushed onto `adoptedStyleSheets`, goes after them until the styles next change: which wins there is not settled, so a style does not lean on it. What the kit draws reads its tokens, `--deckit-*` on the page's root, and each mod's classes start with its id (UI.md): a mod that sets the tokens recolours what is drawn with them, and what a page colours from `theme` in its code stays as it is. A page for a mod that is not there is never styled, and a mod's styles go when its screen lifecycle ends.

Styles that are not made while the mod runs are declared in the manifest's `styles`, a CSS file for each id or `*`: they are worn from the time the mod is installed, whether it runs or not, before what its run registers, and go when it is removed. A file that is not there is left out. `shell.styles.register` is for styles made at run time.

## Configuration

What the person can configure about the mod is declared to `deckit/configuration`, a `[[contributes."deckit/configuration"]]` table for each setting, in the order Settings shows them, read whether the mod runs or not. The mod reads and sets its own through the interface's exports, using it (`uses = { "deckit/configuration" = 1 }`). What a declaration takes, how a value is checked and kept, and what the exports hold are the Configuration mod's ([README](../source/deckit/mods/configuration/README.md)).

## deckit

What `start` and `attach` receive as `deckit`. deck's members and deckit's are one handle: both run with no UI. A member a permission guards is on it all the same, and refuses a mod without it.

| Member | What it is |
|---|---|
| `id`, `name` | the mod's |
| `quit()` | ends the mod's own run (Running and quitting, below) |
| `storage` | below |
| `events` | `emit(name, ...args)`, `on('<mod id>:<name>', listener)` (below) |
| `exports` | `register(interface, { connect, disconnect })` and `register({ connect, disconnect })`; `contributions(interface)`, what mods declare to an interface the mod owns (Dependencies and connections) |
| `dependencies` | `onConnect(name, connected)`, `onRefuse(name, refused)`, and with `deckit.reach-mods` `reach(id)` and `release(id)` (Dependencies and connections) |
| `openExternal(url, { activates })` | hands `url` to the system to open outside the app, the app that opens it brought forward unless `activates` is false; a `file://` address only with `system.file-handlers`. Resolves to nothing once handed on, and rejects `UNSUPPORTED_URL` for one the system does not open |
| `fileURL(path)`, `filePath(url)` | a file's `file://` address, and back, at once |
| `about()` | `{ name, app, version, source, engines, home }`: the host app's name and version, deckit's version and the hash of its sources, the engines deckit runs on, outermost first, each `{ key, name, version }` with `key` its name in lower case (`electron` and `chrome` on Electron), and the person's home folder; deckit's own folders are `mods.folders()` |
| `clipboard.writeText(text)` | with `system.clipboard-write` |
| `clipboard.readText()` | with `system.clipboard-read` |
| `notifications.show({ title, body, silent })` | with `system.notifications`: hands the host a notification to show on the machine, the title and the body whole, and resolves to `{ shown, onPress(listener) }`. `notification` is required, and `title` and `body` both empty is refused `INVALID_ARGUMENT`. `shown` is whether the machine took it. `onPress` is no request: it throws `INVALID_ARGUMENT` for a listener that is not a function, answers its off, and its listeners hear one press, while the lifecycle that showed it runs. Which notifications a mod sends and how they are shown is the owner's of `deckit/notifications` (Standard interfaces), and a mod that tells the person something posts there |
| `mods` | below |

### storage

- `storage.values`: `get(key, fallback)`, `set(key, value)`, `remove(key)`. Small state that costs a click to lose (a fold, a width), in the sandbox's own storage. `set` throws `QUOTA_EXCEEDED` once that storage has no room.
- `storage.records`: `get(key, fallback)`, `set(key, value)`, `remove(key)`, `keys()`. What must not be lost (bookmarks, open tabs), as JSON files in deckit's folder, written by deckit's core. `get` and `keys` are synchronous, and `get` answers a copy: change it and `set` it to keep the change. `set` and `remove` resolve once written, and a write that fails rejects with its refusal, `QUOTA_EXCEEDED` once the disk has no room. A key is lower case letters, digits, `.`, `_` and `-`, starting with a letter or a digit, at most 64: it names a file, and a Mac's disk is blind to case; any other is refused `INVALID_ARGUMENT`. Both take values alone: strings, numbers, booleans, and arrays and plain tables of them, with no null among them.

### mods

With `deckit.mods`: `list`, `runs`, `interfaces`, `install`, `remove`, `launch`, `relaunch`, `quit`, `pin`, `usage`, `restart`, `folders`, `onChange`; each but `onChange` answers a promise. The mods kept in the Dock are the shell's, on `shell.mods`.

- `list()` resolves to every mod deckit found, loaded or not, in the mods' order, `[{ id, mod, refusal, folder, installed, shipped, system, hides }]`: `mod` its manifest, absent for one that does not load; `refusal` why it does not load, `{ stage: 'read', kind, message }`, `kind` null for a problem that is no refusal, absent for one that loads; `installed` whether it is a copy in deckit's mods folder; `shipped` whether the host app ships it; `system` whether it is a system mod; `hides` the folders of the same id not read. Each permission in a manifest is `{ id, reason, usable, name, description, privileged }`, with no `name`, `description` and `privileged` and `usable` false for one no layer on this host app defines.
- `runs()` resolves to the latest run of each mod that loads, in the mods' order, `[{ id, state, refusal, problem, failed, launchedAt, summary }]` (Running and quitting, below): `state` `launching`, `running`, `terminating` or `notRunning`, `notRunning` for a mod with no run since the app started; `refusal` what its run is refused with at launch, `{ stage: 'launch', kind, message }`, `kind` `RELAUNCH_LIMIT`, `TIMED_OUT` or `NOT_LAUNCHED`, absent while it is none; `problem` what went wrong as it launched or ran, or why it failed or crashed, or null; `failed` whether it failed or crashed rather than ending as asked; `launchedAt` when it came to run, in ms since the epoch, or null before; `summary` what it contributes as each layer tells it, with `exports` (whether a lifecycle of it opened exports), null before it runs and once it has ended. A run that launches or terminates answers the summary of the mod's latest run that came to run, so a restart reads as one. `view` in a summary is absent until a screen lifecycle has joined, and false once it has ended.
- `interfaces()` resolves to every interface a mod provides or uses, `[{ interface, name, owner, pinned, providers, clients }]`, `name` the defining mod's, absent when no mod of that id is found, `owner` the id of its owner, absent while no mod provides it, `pinned` whether its owner is pinned, `providers` its queue, the earliest first, `[{ id, name, majors, pinnable }]`, `name` absent and `majors` empty for one kept and not found, `majors` those the mod speaks, `pinnable` whether `pin` takes it: it loads and provides the interface now, and `clients` each mod that uses it, in the mods' order, `[{ id, major, problem }]`, `major` the major it uses and `problem` why it reaches no one by it, or null: an owner other than itself that does not speak that major or is not found (Interfaces).
- `pin(interface, id)` pins the provider `id` as the interface's owner, and `pin(interface, null)` clears the pin; it rejects a mod that does not provide the interface now, one kept in its queue with a problem too, and resolves once `interfaces()` has it.
- `onChange(listener)` hears that what `list`, `runs` or `interfaces` answer may have changed (a mod found or gone, a run that moved, a problem against a run), and answers its off.
- `install(folder, options)` resolves, once the mod it replaces, if that ran, has launched again or failed to, to the mod's manifest with `replaces`: whether it took the place of an installed mod. With `options.dryRun` true it changes nothing and resolves to what it would install: for a folder handed over, chosen (`shell.dialogs.chooseFolders`) or dropped on the page (`shell.dropDestination`). It rejects with why for a folder it refuses, a dry run too.
- `remove(id, erase)` takes the installed mod away and ends its run, and resolves once the run has ended to `{ erased }`: whether what it stored was erased, as `erase` true asks. It rejects `READ_IN_PLACE` for a mod read in place and `NOT_INSTALLED` for an id no installed mod is listed under.
- `launch(id)` launches the mod, one launching or running left as it is, and resolves once it runs; it rejects with what its run is refused with at launch, `NOT_LOADABLE` at `read` for a mod that does not load, and `NOT_INSTALLED` for an id no mod is listed under.
- `relaunch(id)` ends the mod's run, as `quit` does, and then launches it as `launch` does, with its answer and its refusals; one not running is launched.
- `quit(id)` ends the mod's run and resolves once it has ended; one not running is left as it is.
- `usage(id)` resolves to what the mod has stored in each place it is kept, `{ data, records, values, kept }`: `data` the files of its data folder (`{ count, capped, hidden }`, `capped` when it holds more than were counted, `hidden` when it holds names that start with a dot), `records` the files of its records (`{ count, hidden }`), `values` what its pages keep (`{ count }`), and `kept` the names of what the layers keep for the mod, such as `configuration`. An id no mod is listed under is refused `NOT_INSTALLED`. `remove(id, true)` erases all of it.
- `restart()` restarts the app.
- `folders()` resolves to deckit's own places, `{ mods, data, log }`: the folder it installs mods in, the folder that holds each mod's data folder, and the file it writes its log to.

### events

A mod says what happened to it, for whoever cares, as events. `deckit.events.emit(name, ...args)` sends one, named after the mod: `bot` emitting `status` is `bot:status` to listeners, and no mod can send another's. The owner of an interface also sends the interface's signals, named after it: `emit('<interface>:<name>', ...args)` from the owner is `<interface>:<name>`, and from any other mod is named after that mod. The names deck sends of an interface, `<interface>:owner-changed` and `<interface>:contributions-changed`, are deck's own: the owner's `emit` of one throws its refusal, `NOT_PERMITTED`, and is not sent. `deckit.events.on('<mod id>:<name>', listener)` hears one and returns its off. A mod hears only the names it may hear: its own id, any mod's id when it is granted `deckit.reach-mods`, and an interface it uses or provides, whose signals (`<interface>:owner-changed`) are named after it; `on` with any other name is refused. Values are copied, and only values cross (strings, numbers, booleans, arrays and plain tables of them): `emit` of an event that holds anything else, a function or a null among it, throws its refusal, `INVALID_ARGUMENT`, and sends nothing. Listening to a dependency, optional or not, waits for nothing: a mod's events go out while it launches and runs, from when its code starts until it terminates, and nothing arrives from one that does neither.

## The SDK

What a mod's code works out by itself, asking nothing of deck or deckit, is the library it links from the SDK, `deckit-sdk`, a package of ES modules: `deckit-sdk/match` and `deckit-sdk/path`. A mod requires each by its entry, and the bundler that makes the mod's entry carries what it requires into it, as it carries the mod's own files:

```js
const { match, matchFields, TIER, ranker } = require('deckit-sdk/match');
const { tildify, movePath } = require('deckit-sdk/path');
```

The SDK runs as it is written, on the engine the pages run on, and is bundled as it is, not lowered to older JavaScript: a bundler that lowers it rewrites the code `ranker`'s worker runs from its own source, and the worker fails. deckit's own mods reach it through `mods/node_modules/deckit-sdk`, a link to the package, and their build bundles it into each entry with the mod's own files. The SDK's other folders hold the frameworks a mod's page is handed (`deckit`, `shell`, `web`), which a mod reaches only through its handles: a mod's `require` of one of their files does not resolve, and the build bundles only `match` and `path`.

### deckit-sdk/match

| Member | What it does |
|---|---|
| `match(text, query)` | the switcher's matching: `{ tier, score, at }` or null |
| `matchFields(fields, query)` | the same over several fields, `[{ text, name, weight, cap }]`: `{ tier, raw, score, at }` or null |
| `TIER` | the tiers a match is in, best first: `EXACT` 5, `PREFIX` 4, `WORD` 3, `INSIDE` 2, `SPREAD` 1 |
| `ranker({ paths })` | the same in a worker, for a list too long to rank on every key (`paths`: the names are paths, matched by their last part first): `{ rank(names, query, { limit }), close() }`; `rank` resolves to the names found, best first, or null once a newer `rank` of the same ranker is asked. The worker keeps a ranker's list until its `close()`: what makes a ranker closes it as it ends, as `detach()` does for one `attach` made |

### deckit-sdk/path

| Member | What it does |
|---|---|
| `tildify(path, home)` | a path as it is shown: under `home`, from `~`; `about().home` is the person's home folder |
| `movePath(path, from, to)` | a path after `from` moved to `to`, or null when it went with it |

## web

What every lifecycle receives as `web` in its `frameworks`, where the host app puts the web engine on deckit: `session(name)` and `downloads`, below. It runs with no UI, as `deckit` does; the pages of its sessions are shown by `shell.web`. Each lifecycle's `web` is its own, and its session handles are its own: a session handle's requests are refused at `call` with kind `ENDED` once its lifecycle has ended. Every member but `session(name)` and `downloads.onChange(listener)` is a request, refused as `deckit`'s requests are, and takes and answers values.

### web.session(name)

A web session of the mod's own, kept across restarts, by a name of up to 40 lowercase letters, digits and `-`, starting with a letter or a digit. `session(name)` answers at once, the same handle for a name each time in its lifecycle, and throws its refusal, kind `INVALID_ARGUMENT`, for a name that is none. Its pages share its cookies and nobody else's. A session does its work with no UI; its pages are shown by `shell.web`, which takes only a session handle `web.session(name)` answered, throwing its refusal, `INVALID_ARGUMENT`, for anything else, and `ENDED` for one whose lifecycle has ended.

- `name`, the name it was asked for.
- `clear()` takes what the session stored, its cookies and the site data its pages kept, and answers nothing. A session never used holds nothing, and is left as it is.
- `fetch(url, { method, headers, body, redirect })`, with `system.network`, sends a request as the session's pages send it: with the session's cookies and its pages' user agent, the cookies the answers set kept in the session. `url` is an `http` or `https` address. `method` is `GET` where it is left out; `headers` is an array of `[name, value]` pairs of strings; `body` is the bytes sent, in base64, left out for none and for a `GET` or `HEAD`; `redirect` is `follow` (left out), `error`, which refuses a request that is redirected, or `manual`, which answers the redirect itself. It answers `{ url, status, headers, body, redirected }`: `url` the address that answered, after the redirects followed, `headers` an array of `[name, value]` pairs, one a name, the names in lowercase and in order, a name the answer repeats answered once with its values joined by `, `, and `body` the bytes in base64, left out for a status that has none (101, 103, 204, 205, 304). An argument that does not fit is refused `INVALID_ARGUMENT`; an answer over 4 MB is refused `QUOTA_EXCEEDED`, and a request that is not answered (the network, a redirect refused) `REFUSED`. It runs no script of what it is answered: a page that goes on only once its scripts run stops it there.
- `trust(entries)`, with `system.certificates`, trusts in the session the certificates `[{ host, fingerprint }]`, each a string, as a certificate a site's page was refused under names them (`didRefuseCertificate`), and loads again what was refused under one. It answers nothing.
- `allow(entries)` and `revoke(entries)`, with `system.site-permissions`, let the sites of the session have, and take back, what each of `[{ origin, permission }]` names: `origin` a site's origin, as `URL`'s `origin` writes it (`https://example.com`), and `permission` one a site is asked for, `notifications`, `clipboard-read`, `geolocation`, `microphone` or `camera`, or `open:<scheme>`, the app for the addresses of a scheme that is not the web's own (not `http`, `https`, `ws`, `wss`, `file`, `data`, `blob`, `filesystem`, `about` or `javascript`). They answer nothing. A page already holding a stream keeps it, and one told it was granted keeps believing it: reload the site's pages after `revoke`.

`trust`, `allow` and `revoke` take the whole array or nothing of it: an entry that does not fit refuses the call `INVALID_ARGUMENT`, and none of it is done.

### web.downloads

What the mod's web pages download goes to the Downloads folder, under the name the site gives it, made unique there with ` (2)`, ` (3)` and on, once the page's delegate lets it (`shouldDownload`); one it does not is not listed, and one that fails before it can be asked is listed as `failed`, named for its address. The web engine keeps the mod's last 100 downloads, and any older one still under way, across restarts, newest first, and forgets them with the mod's data. A download is `{ id, url, name, path, state, received, expected, error, started }`: `state` is `downloading`, `finished`, `failed` or `cancelled`, `received` and `expected` are bytes, `expected` -1 while it is not known, and `started` is when it started, in milliseconds since 1970. One still downloading when Deckit quit is `failed`.

- `list()` resolves to the downloads.
- `onChange(listener)` hears a download each time it changes, a new one first, while the mod's run is running, and returns its off. It throws its refusal, `INVALID_ARGUMENT`, for a listener that is no function.
- `cancel(id)` stops one under way, and resolves to nothing once it is stopped, or once it is known there is none of that id under way.
- `remove(id)` forgets one, stopping it first if it is under way, and resolves to whether there was one. The file stays.
- `open(id)`, with `system.file-handlers`, opens a finished one's file in its app and resolves to whether it opened.

## mainProcess

What every lifecycle receives as `mainProcess` in its `frameworks`, where the host app runs mods' main process modules (A main process module, below): `start(path)`, and `restartPending()`, `statusOf(id)` and `onChange(listener)`, below. A host app that runs none hands no `mainProcess`.

### mainProcess.start(path)

With `system.main-process`: starts a main process module of the mod's and resolves to its methods, each called through the main process and so returning a promise, with `on(name, listener)` to hear what it emits; `on` returns the unsubscribe, and a listener is heard until the lifecycle whose `mainProcess` made it ends. A module starts once on the mod's page, however many lifecycles ask for it. A path outside the mod's folder, or a module that throws as it starts, rejects. A failed start is tried again the next time it is asked for. A method of a module not started in the mod's run rejects `NOT_STARTED`.

### mainProcess.restartPending(), statusOf(id), onChange(listener)

With `deckit.mods`, what the main process modules of every mod come to:

- `restartPending()` resolves to `[{ id, why }]`, the mods whose main process modules only a restart finishes; `why` is `updated`, `removed`, `reinstalled` or `leftover` (a `dispose` that failed).
- `statusOf(id)` resolves to `{ running, failure }`: whether a main process module of the mod's runs, and why those that did not start did not, or null.
- `onChange(listener)` hears that what `restartPending` or `statusOf` answers may have changed (a module that started, failed or ended, a mod that came to need a restart or no longer does), and answers its off.

## shell

What `attach` receives as `shell`, from deckit's shell (the desktop, the Dock and the kit). A shell of another host app that calls `attach` gives the same.

Every member is on the handle of every mod, whatever it is granted. A member is of one of four shapes. A **request** answers a promise, never throws, and is refused as deckit's requests are (deckit, above): an error with `stage`, `kind` and `message`, `NOT_PERMITTED` at `call` for a mod not granted the permission that guards it, before `INVALID_ARGUMENT` for an argument of another type than it takes. A member that **answers at once** (a window, a region, an off, a stop) throws its refusal, the same error. A **registration** answers nothing and is never refused (Registering). A **value** is read as it is now, with a listener of its change (`theme`, a window's `isKey`).

| Member | What it is |
|---|---|
| `theme` | the look, derived from the host app's and the person's fonts: `dark`, `font`, `mono`, `textFont`, `textSize`, `fonts` (the person's choice, `{ text, size }`, each left out for the default), `type`, `border`, `color`, `radius`, `shadow`, `motion`, `tracking`, `rim`, `syntax` and `glass` (the strength a surface drawn as glass lays its colour at over what is behind it, per look, 1 while the system asks for less transparency or more contrast), each read as it is now, and `onChange(listener)` for a new one, which new fonts are too, throwing `INVALID_ARGUMENT` for a listener that is no function ([UI.md](UI.md)) |
| `ui` | the kit, drawn in `theme` ([UI.md](UI.md)) |
| `region(element, interface)` | answers at once: a place in the mod's view where the children of an interface it provides are shown (below); it throws `INVALID_ARGUMENT` for an element that is none or an interface the mod does not provide |
| `dropDestination(element, { onDrop, onTargeted })` | answers at once: takes the files the person drops on `element` from outside the app, by their paths (below); it throws `INVALID_ARGUMENT` for an element that is none or an `onDrop` or `onTargeted` that is no function |
| `children` | `list(interface)`, a request, resolves to `[{ id, name, icon }]` of the mods whose view names that interface as its `parent`, while this mod owns it, and that run or are launching again, each from its first launch, in the mods' order, refused `INVALID_ARGUMENT` for an interface the mod does not provide; `onChange(listener)`, `listener(interface, children)` each time an interface's children change, which returns its off and throws `INVALID_ARGUMENT` for a listener that is no function |
| `web` | `page({ session, url })`, `window({ session, url, title })` (below) |
| `fonts` | `set(fonts)`, a request `deckit.fonts` guards: `fonts` the fonts whole, any of `{ text, size }`, a face's name for `text` and a whole size from 11 to 22 px, each left out for its default; it resolves to the fonts as kept, and is refused `INVALID_ARGUMENT` for a face or size it does not take. Every page's `theme` wears the person's fonts (`textFont`, `textSize`) |
| `mods` | requests `deckit.mods` guards: `list()` resolves to every app mod in the Dock's order, `[{ id, name, icon, keywords, pinned, running }]`, `pinned` whether the person keeps it in the Dock and `running` whether it runs; `pinned()` to the ids of the mods the person keeps in the Dock; `setPinned(id, pinned)` keeps an app there or takes it out; and `open(id)` opens an app as the Dock opens it: launched when it does not run, its windows brought forward when it does, or its `reopen()` with none open. `setPinned` and `open` are refused `INVALID_ARGUMENT` for a mod that is no app |
| `keys` | `take(keystroke, run, { scope })`, a request, a chord taken for the mod, `keystroke` `{ code, meta, control, alt, shift }`, in `scope` `app`, the default, with `deckit.app-keys`, or `global` with `system.global-keys`, `run()` what each press does; it resolves to `{ held, release }`, `held` false for a chord the system did not give, which works in the app still, and the chord is let go as `attach`'s run ends. `record(onKeystroke)` answers at once its stop and hands over each key pressed in the page until then, and throws `INVALID_ARGUMENT` for no function. `list()`, `set(id, keystroke)` and `reset(id)` of the shell's own keys are requests `deckit.shell-keys` guards: `set` and `reset` resolve to the key as kept, and are refused `INVALID_ARGUMENT` for an id that is none of the shell's keys, `REFUSED` for a chord another of them has |
| `active()` | a request: resolves to whether the app is in front, one of its pages has the keyboard |
| `dialogs` | `chooseFolders({ multiple, title, message })`, which asks the person for folders in a dialog titled `title` and saying `message`, and resolves to the absolute paths of those they chose, one unless `multiple`, none when they chose none |
| `reveal(path)` | shows the file or folder at an absolute path where it lies, outside the app, and resolves to nothing |
| `windows` | `open(options)` and `list()` (`shell.windows.open`, above) |
| `view`, `styles` | each `register` (Registering); `styles` registers for a mod granted `deckit.styles` |

The page wears the theme, the kit's styles and other mods' styles from just before `attach` runs.

### region(element, interface)

A mod's view is shown in another's when that one gives a place in its window for an interface it provides (`shell.region(element, interface)`) and this one names the interface as its view's `parent`, in its `uses`, while that mod owns it: a dashboard shows its boards, each a mod, beside its own list of them. An interface that only gives a place needs no exports. The parent hears its children through `shell.children`, and a region answers `place(id)`, which puts that child's view in the region and out of any other, and `clear()`. Both resolve once done. A child whose `parent` is owned by a mod that does not speak the major it uses has no parent, as if there were none. `place` is refused `INVALID_ARGUMENT` for a mod that is not this one's child of that interface, and a mod is a child only from its first launch: a parent places the children `shell.children` lists. A region ends when its element, once in the page, leaves it, or with the parent's screen lifecycle, and an ended region refuses `place` and `clear` at `call` with `ENDED`. The child keeps running in its own page, which the shell lays over what of the element is seen, following it frame by frame: cut where an ancestor clips it (a scroller's edge, the sidebar as it folds), and nothing while the element is hidden. The page is made as small as that part, not cropped, and nothing the parent draws, its menus too, comes over it. Regions are shown while their mod is the one on screen, and a child comes and goes with it (didAppear, didDisappear, its keys). A child is its parent's from when it starts, through launching again, until it starts naming another interface or none, or another mod comes to own it, when its view goes from the region and comes up in the new parent's; when the parent's screen fails, the child's view has no place and its function lifecycle runs on.

### dropDestination(element, { onDrop, onTargeted })

`shell.dropDestination(element, { onDrop, onTargeted })` takes files the person drags from outside the app, from another app, onto `element`. `onTargeted(on)`, optional, hears a drag of files come over the element (`true`) and leave it (`false`), to show that it takes them. `onDrop(paths, { x, y })` hears the files dropped, by their absolute paths in the order they came, folders too, and the point they landed, from the element's top left. A drag that carries no files is left to the page. Of destinations one inside another, the innermost takes the drop. It answers its off, and ends with the screen lifecycle. A page reads no file's path from the web's own drop events: this is where a mod gets them. A drag within the page, of the kit's things, is the kit's `dragSource` and `dropTarget` ([UI.md](UI.md)).

### web

`shell.web` shows the pages of a session `web.session(name)` gave:

- `web.page({ session, url })` shows a web page the way a browser tab does, in the mod's view.
- `web.window({ session, url, title })` shows one in a window of its own, for a step taken and finished, such as signing in.

A `url` left out, empty or `about:blank` is a blank page, which loads nothing.

Both return `{ session, state, load(url), back(), forward(), reload(), stop(), mute(on), find(text, { start, back, matchCase }), stopFind({ keepSelection }), close(), delegate }`, and a page also its `element` and `focus()`. A page has the keyboard once the person presses in it or `focus()` gives it, never by focusing an element of its own. The element holds the page's place: the Mac's WebKit draws the page over it, clear until the page has shown a page and on white after, as a browser has, and where it sits in the view is the mod's to say. Nothing else of the mod's page is drawn over it: what floats (a menu, a popover, a dialog) is in the page's overlay, over the web page, which goes on as it is under it. `state` is `{ url, title, icon, loading, canGoBack, canGoForward, blank, audible, muted, capture: { microphone, camera, screen } }`, `blank` true until the page has shown a page. A page or window closes as the screen lifecycle ends.

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
    openWindow(page, options) {},    // { url, activates }: the window it opened, to show
    shouldDownload(download) {},     // { url, name, mimeType, expected }: false does not save it
};
```

A `should…` left out, or answered with anything but `false`, lets the default go ahead: the address goes to its scheme's handlers, and a download is saved. Answer `false` when the mod opened it itself, or for a download not to save. `openWindow` hands over the window the page opened with `window.open` or a link to a new one, a page as `shell.web.page` makes it, already the site's window: the mod shows its `element`, and the site and the window reach each other as they do in a browser. Left out or answered `false`, the window closes and its address goes to its scheme's handlers. A window that asked for its size, or one a window opened, is a window of the app's, and a file page's goes to the handlers. A window opened at no address or at `about:blank` is a blank page, given as any other is; where nothing takes it, it closes, and it never goes to the handlers. A page opens a window only during a person's click or key in it, as a browser blocks a popup otherwise; one it opens at any other time is refused before the delegate hears of it.

A site gets what a browser lets it have without asking (full screen, writing what is copied). What a browser asks the person for (the camera, the microphone, notifications, reading what was copied, the location, an app for a link) is `decidePermission`, asked only of a mod with `system.site-permissions`; for any other mod the site is refused. What is copied is the clipboard of the machine, which a site reaches only as its mod does: it writes there only for a mod with `system.clipboard-write`, and reading is asked only of a mod with `system.clipboard-read` as well, the site refused unasked otherwise. One document falls outside this: a frame or window opened at an address has an empty document until that address loads, which WebKit gives none of deckit's scripts, and the site's own script there reaches WebKit's clipboard during a click or key, writing what is copied and reading it through WebKit's own Paste control, whatever its mod is granted. Anything else a site asks for is refused.

## The run

Each launch of a mod's entry is a run, and a run is in one of four states:

| State | What happens |
|---|---|
| `launching` | its sandbox loads and the entry is evaluated; the instance is made and `start(deckit, frameworks)` registers, and starts main process modules if it needs them |
| `running` | `start` has ended and deck has joined what it registered. Where a UI shell draws mods, `attach(shell, deckit, frameworks)` runs then, and what it registered joins as it ends |
| `terminating` | `detach()` then `stop()` are asked: quit by the mod or by a mod with `deckit.mods`, removed, updated, the app quitting, or `start` failed. An end asked while its start is still going runs at once |
| `notRunning` | it ended: each end answered or its time ran out, or its page went away |

A mod that runs launches again in a new sandbox when it is installed again, and in the same one, loaded again, when it is relaunched (`deckit.mods.relaunch`).

Whatever a layer calls once a lifecycle has started, a call that throws or rejects costs that call alone: it is shown on the mod's row in Settings, and the mod goes on. What must outlive the sandbox is written when it changes: the sandbox can be made again at any of these times.

### Running and quitting

A mod installed runs only when something asks deck to launch it. As the app starts, deckit launches the background mods, those whose manifest gives `background`, in the mods' order. Any other mod launches as it is asked for: by a mod with `deckit.mods` (`deckit.mods.launch`), opened from the Dock, or reached by id (`deckit.dependencies.reach`), which waits until its `start` has ended. A system service launches as a client connects to it, as its README says.

A background mod whose run fails or crashes is launched again; one that ends as asked is not. A mod whose runs fail 5 times within 10 seconds reaches the relaunch limit: nothing launches it again until its launch is asked (`deckit.mods.launch`, the Dock), which forgets what it failed before, and its last run stays failed, saying why, with `refusal` `{ stage, kind, message }` of kind `RELAUNCH_LIMIT`.

A run ends when the mod quits, with `deckit.quit()`, or is quit (`deckit.mods.quit`). The end is any end: its connections and what it registered end with it, and what it declares, its place as an interface's owner, its pins and its storage stay. A later request launches it again.

## Dependencies and connections

A mod reaches another's functions by one of two names. By interface, it names a role in `uses`: who answers is the interface's owner, one mod for each interface, which the person may change. It gets the exports the owner opens for the interface, and a place in the owner's window, by naming the interface as its view's `parent` (`shell.region`). By id, with `deckit.reach-mods`, it asks for the mod by name (`deckit.dependencies.reach`): it gets the exports that mod opens for those that reach it by id, and the mod launches if it does not run. Both come on `deckit.dependencies`.

What a mod offers anyone is an event (`deckit.events`), or what it declares to a system service: commands (`deckit/commands`) and addresses (`deckit/urls`). Events carry values only, never a function. A connection has a start and an end, so a function crosses it as a function.

A caller that names who it calls names a mod by id: a reach, an event (`<mod id>:<name>`), a style. One that does not name who answers names a role: an interface, which its owner answers.

### Interfaces

An interface is a name, its majors and a document. The name is `<mod id>/<name>`, the defining mod's id first, so no two mods that do not know each other make up the same one; its document is that mod's README (an interface named `deckit/<name>` is a system service, documented by the system mod that provides it, Standard interfaces), which writes down what the exports hold, what each function takes and answers, the lifecycle that opens them, and whether it gives a place for views (`parent`). A change that breaks any of it is a new major. The major is not part of the name: a provider lists the majors it speaks in `provides`, and a mod that uses the interface names the one it speaks in `uses`. An interface that hands out handles (a session, a run) promises that a handle never repeats across providers and runs, and that one it does not know is answered as not there: a dependent holds a handle as it was handed and never reads it.

Each interface has one owner at a time, among the mods that provide it. deck keeps a queue of them for each interface, in the order they started providing it: a mod joins the end of the queue when it is installed, first read, or updated to provide the interface, and leaves it when it is removed, is no longer found, or is updated to stop providing it. An update that goes on providing it keeps its place. A mod found that cannot load by its own folder (a manifest that does not read, an `api` of another major, an install that failed) joins no queue, and keeps the places it holds and its pins as they were kept: while it owns an interface, its connections are down as for an owner that does not run. One whose manifest names no id is read under its folder's name, so it may be any mod: while one is found, a mod not found keeps its places and pins too, until every mod found names its id, and one removed leaves them at once. Whether what a mod requires is there, and whether it runs, keep no mod out of a queue.

The owner is the provider the person pinned (`deckit.mods.pin`, Settings), or else the first in the queue. The person pins only a provider that loads and provides the interface now: one kept with a problem keeps a pin it holds and is not pinned anew. Whether it runs is not looked at: while the owner is not running its connections are down, and they stand once it runs; one that fails or crashes stays the owner. So a mod installed later waits in the queue and does not take the interface, and the mods a host app ships own their interfaces because they are installed first, not by a place of their own (EMBEDDING.md). The mods' order has no part in it, and a mod sets no priority of its own. A pin goes when its mod leaves the queue. A provider that is not the owner runs as any mod does, and no one reaches it by that interface.

The owner changes when it leaves the queue, when the person pins another or clears the pin, and when the first provider of an interface arrives; terminating the owner does not change it. Then the mods that use the interface connect to the new owner: their connections to the old one end and stand again to the new one (`onConnect`), and what is on screen in a region of the old one goes to the new one's. deck sends the event `<interface>:owner-changed`, of no args, to the mods listening for it (`deckit.events.on('switcher/actions:owner-changed', listener)`), so a mod that only hears an interface's events learns of it too. What a role keeps (a history, the actions handed over) is in its owner's storage and does not follow a new owner.

There is one owner whatever the majors. An owner that does not speak the major a mod uses is, for that mod, as if there were none: no connection stands, and the mod's row in Settings says why. Using an interface is never required: the mod runs whether or not it has an owner, and what it uses comes and goes.

A mod that uses an interface never learns which mod owns it: the exports it is handed are the interface's, and an owner's identity is no part of any interface. The owner knows who it is connected to (`connect`), since what a mod hands it is that mod's: the switcher lists actions under the mod that handed them.


### Connections

A connection stands between the exports a mod opened and one lifecycle of a mod that reaches them: those of an interface, for a mod that uses the interface while the mod owns it, or the mod's own, for a lifecycle that reaches it by id. A mod opens each set of exports once for the run, in the lifecycle that has the job: `start` for what must work on a host app with no UI, `attach` for what means something only on screen, such as a switcher taking actions. Exports opened in `start` reach the dependent's `start` and `attach`; exports opened in `attach` reach only the dependent's `attach`.

A connection stands when both ends are up: as the dependent's lifecycle begins, before its method is called, or as the exports join, once the method that opened them has ended, and for a mod by id once `reach` asks for it. It stands only at a major the dependent uses. It ends as either lifecycle ends, the dependent releases the id, or the interface has another owner, and the lifecycle ends as every lifecycle does: what is on screen goes, its end method (`detach` or `stop`) runs, what its handles made is cut, and then its connections are cut. So a call made in `detach` or `stop` still reaches the other end. As a connection is cut, only the end that lives on hears it: when the exports' lifecycle ends, the dependent's `onConnect` cleanup runs; when the dependent's lifecycle ends, the exports' `disconnect` runs. The end that ends tidies up in its own end method.

### deckit.exports.register(interface, { connect, disconnect })

```js
// for the mods that use switcher/actions, while this mod owns it
deckit.exports.register('switcher/actions', {
    connect: (connection) => ({
        setActions: (actions) => {
            this.actions.set(connection, actions);
        },
    }),
    disconnect: (connection) => this.actions.delete(connection),
});

// for the mods that reach this one by id
deckit.exports.register({ connect: () => this.forge });
```

`interface` is one the manifest `provides`; any other is refused and shown on the mod's row. With no `interface`, the exports are the mod's own, for the mods that reach it by id. `connect(connection)` is called once for each connection and answers the exports for it, at once: an object of values and functions. `connection` is `{ mod: { name }, credential: { mod, permissions } }`, the mod on the other end, its id and permissions as the core holds them, frozen, and `disconnect` is handed the same object. So the exports made for a connection know the mod that calls them, and a function keyed by the connection knows whose it is. Exports that need not know answer one object for every connection (`connect: () => this.forge`). `disconnect(connection)`, which may be left out, hears the dependent's lifecycle end while the exports are open. A mod that keeps what a dependent handed it keys it by the connection, and drops it in `disconnect` or once it has no more use for it.

It is called once for the run for each interface, and once for the mod's own exports, in `start` or in `attach`: once one lifecycle opened a set of exports, a call for it in the other is refused. The exports end with the lifecycle that opened them. An interface that only gives a place for views is provided with no exports.

### Declared contributions

```toml
[[contributes."switcher/actions"]]
label = "Show Log"
keywords = ["finder"]
```

```js
// the owner of switcher/actions, while it runs
const declared = await deckit.exports.contributions('switcher/actions');
// [{ mod: { name: 'Deckit' }, credential: { mod: 'deckit', permissions: [...] }, entry: { label: 'Show Log', keywords: ['finder'] } }]
```

A mod gives an interface's owner what is there whether the mod runs or not, by declaring it in its manifest, a `[[contributes."<interface>"]]` table for each entry; what only a run knows it hands over a connection (`deckit.dependencies.onConnect`), and that goes as the connection ends. An entry is data, its shape the interface's to define. The owner asks for them while it runs: `contributions(interface)` resolves to each entry declared to it by the mods that load, in their order, `{ mod, credential, entry }`, `mod` `{ name }` and `credential` the declaring mod's id and permissions, frozen as a connection's are; it is refused with kind `NOT_OWNER` for an interface the mod does not own. The owner hears `<interface>:contributions-changed` as what is declared changes.

### deckit.dependencies

```js
// handed as each connection stands
deckit.dependencies.onConnect('switcher/actions', (switcher) => {
    switcher.setActions({ list, now, search, run });
    return () => {}; // may be left out: called as the switcher's lifecycle ends while this one lasts
});

// by id, with deckit.reach-mods: launches the mod if it does not run
const exports = await deckit.dependencies.reach('forge');
deckit.dependencies.release('forge');
```

- `onConnect(name, connected)`: `connected(exports)` each time a connection for `name`, an interface or a mod id the lifecycle reaches, stands. A connection already standing is handed at once. A function `connected` answers is called as the connection ends while the lifecycle lasts. Returns its off.
- `onRefuse(name, refused)`: `refused(error)` for each refusal of a connection for `name`, the last at once while no connection by it stands. Returns its off.
- `reach(id)`, with `deckit.reach-mods`: connects the lifecycle to the exports the mod `id` opens for those that reach it by id, launching it if it does not run, and resolves with them once the connection stands; it rejects with the first refusal. `release(id)` lets it go, once for each `reach`; the lifecycle's end lets all go.

Each lifecycle has its own `dependencies`. What `onConnect` and `onRefuse` add is cut as the lifecycle ends.

### What crosses a connection

The exports, the args of a call and what a call answers cross the same way:

- Values are copied as JSON. A value JSON does not hold (a BigInt, a Symbol, `NaN` or an infinity, an object that holds itself, a Map, a Set, an Error or another of the platform's own kinds) does not cross: in exports it leaves the connection down, and in a call it rejects the call. A value with `toJSON` crosses as what that answers.
- A function crosses as a reference. On the far side it is a function that calls the one handed over, in the page of the mod that handed it, and answers a promise of what that answers. What it throws rejects with its `name`, `message` and `kind`.
- An object crosses as its own enumerable data, copied, and its functions and its class's methods, which cross as references bound to it. So `setProvider(new GoogleProvider())` hands over the provider's methods. Getters, `#private` fields and the class do not cross, and `instanceof` does not hold on the far side.
- The same function handed twice on one connection is the same reference on the far side (`===`).
- A function received from another mod is not handed on: handing it over again throws. To pass one on, a mod hands a function of its own that calls it. So whatever calls a mod's function is the mod connected to it, and `connection.mod` is always the mod that calls.
- A reference the far side holds no more is let go, and the side that handed the function over drops it. Every reference of a connection is let go as the connection ends, and calling one then rejects: the mod on the other end has ended.
- How long a function is good for is the function's own to say: a calendar's `ask`, handed to a provider for one sign-in, answers false once that sign-in has ended. A function of one lifecycle handed over a connection of another is not caught: it is the mod's fault.


### When a connection fails

A `connect` that throws, answers a promise, or answers what does not cross leaves the connection down, refused, and it is not asked again while both lifecycles last: the dependent's `onRefuse(name, refused)` hears it, and a `reach` waiting on it rejects with it. So does an owner that does not speak the major the mod uses, and one that runs with no exports for the name that reach the lifecycle. The refusal reaches the code as an error with its `kind` and `stage`, and the mod runs on.

### Versions

The majors a mod `provides` an interface at are those of the interface's document whose promise its exports for it keep: a change that breaks any of it is a new major. What a mod opens for those that reach it by id keeps the promise its README writes down. A change only to what the mod shows is no break.

### What is outside

- Passing a failed owner over for the next in the queue.
- Connecting a mod to every provider of an interface at once: one that gathers from many is an interface the gatherer provides and the many use (`switcher/actions`).
- A provider that calls the next one in the queue (a proxy, a decorator).
- A different owner for each mod that uses an interface, or for each major.

### Standard interfaces

The interfaces named `deckit/<name>` are the system's services, each provided by a system mod deckit ships, whose README is its document:

| Interface | Provided by | What it is |
|---|---|---|
| `deckit/commands` | Commands | the commands mods declare, listed and run on the mod that declares them ([README](../source/deckit/mods/commands/README.md)) |
| `deckit/keys` | Keymap | the keys mods declare, each running one of the mod's commands on its chord ([README](../source/deckit/mods/keymap/README.md)) |
| `deckit/configuration` | Configuration | the settings mods declare, read and set by their own mod, and kept ([README](../source/deckit/mods/configuration/README.md)) |
| `deckit/urls` | URLs | which mod opens an address, offered to the mods that declare it, and outside the app when none takes it ([README](../source/deckit/mods/urls/README.md)) |
| `deckit/notifications` | Notifications | the notifications mods post, shown and kept in one place ([README](../source/deckit/mods/notifications/README.md)) |

A mod declares to one in its manifest (`[[contributes."deckit/commands"]]`, and so on), whether it uses the interface or not, and uses it (`uses`) to call its exports.

### What deckit's own mods open

Each README writes down what its exports take.

- `switcher/actions`, defined and provided by the Switcher: `setActions(actions)`, the actions listed under the mod, opened in `attach`, so a mod uses it and hands its actions with `onConnect` ([README](../source/deckit/mods/switcher/README.md)).
- `settings/buttons`, defined and provided by Settings: `setButtons(buttons)`, buttons on the mod's settings, opened in `attach` ([README](../source/deckit/mods/settings/README.md)).
- `calendar/accounts`, defined and provided by Calendar: `setProvider(provider)`, an account the calendar shows ([README](../source/deckit/mods/calendar/README.md)).
- `forge/sessions`, defined and provided by Forge: its sessions and the runs on them ([README](../source/deckit/mods/forge/README.md)).

## Order

The mods stand in the order they were installed, deck keeping it with the mods it installed, and a mod read in place after them, by id. It is the order styles are worn in, the later over the earlier, and the order the mods are listed in (`deckit.mods.list()`, Settings).

## A main process module

```js
module.exports = ({ id, data, emit, window, files }) => ({
    async start(...args) { /* answers daemon.start(…) */ },
    // emit('died', reason) is heard by daemon.on('died', …)
    async dispose() { /* ends what it made: timers, watchers, servers, processes, ipcMain handlers */ },
});
```

A module exports a function that deck calls once, with what the module is handed, and that returns (or resolves to) its methods: an object of functions, nested objects walked. A method may not be named `on`, which is how its events are heard, and `dispose` is no method: deckit calls it as the module ends. Arguments and results cross by structured clone.

`data` is the mod's data folder; anything a module keeps goes there, never in the mod's folder, which an update replaces. The folder is not there until the module makes it, as it first writes.

`files` changes a person's files without losing one: `fresh(folder, base, make, extension)` makes something new under the first free name, `rename(path, name)` and `move(path, folder)` never put anything over another entry, `name(text)` checks a typed name, `trash(path)` moves it to the system's Trash. A refusal is `files.refuse(kind, message)`, an error whose `kind` (`NAME`, `EXISTS`, `GONE`, `INTO_ITSELF`, `OTHER_DISK`, or one of the mod's own) reaches the sandbox as `error.kind`.

`window`, a window of Electron's own (a `BaseWindow`) holding a view of Electron's the module made, is the Electron environment's own, beside what deckit hands every module: `open({ key, title, view, size, onClose })`, `get(key)`, `close(key)`. The environment opens and frames it. `onClose` runs once the view is out of the window, alive. `open` under a key already open brings that window forward and returns it. `ofPage()` is the window the mod's page is shown in now, or null while it is hidden, as far as a preview or a dialog of the mod's goes: `previewFile(file, title)` and `closeFilePreview()` show and close Quick Look's panel over it, `showOpenDialog(options)` and `showSaveDialog(options)` open a dialog as a sheet on it, taking and answering as Electron's `dialog` does (of its options, `title`, `message`, `buttonLabel`, `defaultPath` and `properties`), and `isClosed()` says whether it has closed since. Keys are the mod's own: two mods asking for `log` get two windows.

A module with `dispose` ends with the run that started it: once the run has ended, `detach()`, `stop()` and all, deckit closes the windows they opened (their `onClose` runs then), calls each of the run's modules' `dispose`, the last started first, a short while at most for each, then forgets their code, and the next run requires them anew. So Restart in Settings, and an install of a new version, run the new code without restarting the app. This holds only when every module of the mod's run has a `dispose`: deckit cannot end what a module made (a timer, a watcher, a server, a child process, an `ipcMain` handler, an Electron object), so a module with none runs until the app quits, keeping the code it started with, and the files the mod's modules share stay with it. A `dispose` that throws or runs out of time, or a module still starting two seconds after its run ended, leaves the mod pending a restart until the app restarts (`leftover`). When the app quits, it waits for these ends too. What a module keeps across runs goes in `folder`. A native addon cannot be unloaded from a process: a mod that ships one needs the app restarted for a new version even with `dispose`. A module runs in the app's main process and can do what the app can do, which is why it is asked for. The sandbox cannot widen its own reach: it calls only the methods a module of its own folder returns, and the main process knows which mod calls by its sandbox.

## Installing

Settings has an Install button: pick one folder or several, or drop them on its Mods section, and the mod's sandbox is made again with it. deck keeps its own copy of the folder, replaced whole by an install, and never touches the mod's data. Removing asks about the code and the data as two answers.

A removal lasts: the host app's next install of the mods it ships leaves out one the person removed. An id the host app ships is the host app's; a changed copy under that id is replaced at the next start, so keep one under an id of its own.

# Writing a mod

A mod is a manifest and one entry, and the entry exports one class. deck reads the manifest, runs the entry in a sandbox of the mod's own, and makes one instance of the class for the run. Two lifecycles are stacked on that instance. deckit calls `start(deckit)` on every host app, and the mod registers there what it does: keys, commands, a handler for the addresses it asks for, and exports for the mods that depend on it. Where a UI shell draws mods, deckit's shell then calls `attach(shell, deckit)` on the same instance, and the mod registers there what it shows: a view, a window, styles for other mods' pages, and the keys, actions and handlers that work on what it shows. A host app with no UI shell, or with a shell that only manages mods, never calls `attach`, and the mod runs on what `start` registered. Every method is optional, so a mod with only `start` is headless, and one with only `attach` only draws. Code that needs the app's main process (files, the network, programs) goes in a main process module the mod starts when it needs it.

How the folder is laid out is the mod's own. The folder's name says nothing; the manifest says who the mod is, and its `main` names the entry:

```
dashboard/
  manifest.toml       main = "dist/main.js"
  dist/main.js        the entry: what deck runs in the sandbox
  dist/daemon.js      a main process module, started with deckit.mainProcess('dist/daemon.js')
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
urls = ["https://github.com/*", "dashboard:*"]

[dependencies]
bot = "1.0.0"
switcher = { version = "1.0.0", optional = true }

[permissions]
"system.main-process" = "Starts the daemons the dashboard shows."
```

| Field | Required | What it says |
|---|---|---|
| `id` | yes | who the mod is, to deck and to every other mod |
| `name` | no | what a person reads; the id when left out |
| `version` | yes | the mod's own version, `MAJOR.MINOR.PATCH`, compared with what other mods name in `[dependencies]`: the version of what its exports promise (Dependencies and connections) |
| `api` | yes | the version of the mod contract it is written against |
| `main` | yes | the entry, a path inside the folder, `/` separated |
| `urls` | no | patterns of the addresses it asks to be offered: it is one of their handlers (below) |
| `dependencies` | no | mod id = the lowest version it needs, or `{ version, optional = true }` for one it runs without (below) |
| `permissions` | no | permission = why it is needed, in words the person reads |

Any other field stops the mod loading, and so does a `main` that names no file inside the folder. The manifest is read by deckit's core before a line of the mod runs.

Only the part of TOML a manifest uses is read: top-level keys, one level of tables, and strings, booleans, integers, arrays and inline tables of those as values. An inline table is written on one line. A key with a dot is quoted (`"system.main-process" = …`).

An id is lower case letters, digits, `.`, `_` and `-`, starts with a letter or digit, is at most 64 characters and has no `..`. Lower case only, because a mod's data is kept in a folder named by its id and macOS disks ignore case.

### dependencies

Each mod the mod relies on, by id. `forge = "1.0.0"` is a required dependency: the mod runs only with it, at that version or a later one of the same major. `switcher = { version = "1.0.0", optional = true }` is an optional one: the mod runs without it, and it comes and goes as the mod runs. A table takes `version` and `optional` and nothing else. A mod does not name itself. In this document, a mod requires the dependencies it names without `optional`, and only those. What a dependency gives is in Dependencies and connections, below.

### urls

A list of patterns of the addresses the mod asks to be offered:

| Pattern | What it matches |
|---|---|
| `<scheme>:*` | every address of the scheme: `"board:*"`, `"https:*"` |
| `<scheme>://<host>/<path>*` | the addresses of that host whose path starts with `/<path>`: `"https://github.com/*"` |
| `*` | every address; it stands alone in the list |

The `*` stands only at the end, after the scheme's `:` or after the path, so `https://github.com*` is refused. Scheme and host are compared in lower case, and the path as written. An empty list is refused, and so are `javascript`, `data`, `blob` and `about`, which are no place to open. A pattern asks to be offered an address; the handler still says whether it opened it (`deckit.urls.register`).

Everything opened is an address: `https://…`, a file as `file:///…`, or a scheme a mod makes up. A mod calls `deckit.urls.open(url)` and never names who answers. Each scheme has one list of handlers: the mods with a pattern of that scheme, and those with `*`. An address of a scheme with no list goes to the `*` list. The address is offered in the list's order to each handler that is on, has a pattern that matches it, and whose run registered `deckit.urls.register`; then to deckit's own answer (the default browser for `http` and `https`, the system's app for a file), which is always last. A scheme no mod takes and deckit has no answer for ends unopened.

The order is the person's: they order each list and switch handlers off in Settings, and the order they set stays. Before they do, the host app places the mods it names (EMBEDDING.md, `schemeHandlers`). A mod no one placed goes before the first handler whose pattern is wider than its own, so `https://github.com/*` goes before `https:*`, and `https:*` before `*`. A mod is as narrow as its narrowest pattern for the scheme, and a longer path is narrower. Two mods no one placed go the narrower first, then by id. The load order says nothing of who opens what.

### api

The version of the contract: what the class has and how it is called, what the handles `deckit` and `shell` hold, the names of the permissions, and what a main process module is handed. This deck speaks `1.0.0`. A mod loads when the major is the same and deck's minor and patch, in that order, are at least the mod's; otherwise Settings shows why it did not. The same rule compares a mod's `version` with what another names in `[dependencies]`.

### permissions

What a mod may reach beyond its own sandbox is asked for by name, with a reason. The main process checks each where the mod asks, by the sandbox it asks from.

| Permission | What it reaches | Where it lands |
|---|---|---|
| `system.main-process` | the app's main process, where the mod's modules run and can read and write files, reach the network and start programs | `deckit.mainProcess` |
| `system.files` | files on this Mac, opened in its own pages | `file://` addresses in its web pages |
| `system.network` | any address, past the rules that keep one site from reading another | `fetchText(url)` on a web session |
| `system.certificates` | trusting a certificate this Mac cannot verify, in one of its sessions | `trust` on a web session |
| `system.site-permissions` | what a site's pages may use (the camera, the microphone, notifications, what was copied, the location, an app for a link), in one of its sessions | `decidePermission` on a page's delegate, `allow`, `revoke` on a web session |
| `system.clipboard-read` | reading what was copied, from any app | `deckit.clipboard.readText` |
| `system.clipboard-write` | replacing what was copied with text of its own, which the person then pastes in any app | `deckit.clipboard.writeText` |
| `system.file-handlers` | handing files on this Mac to whatever opens them, a mod or the app for them, which can start programs, and showing them in Finder | `deckit.urls.open` of a `file://` address, `deckit.reveal` |
| `system.overlay-windows` | a window of its own over every app's, on every desktop, whichever app is in front | `overlay` on `shell.window.register` |
| `system.notifications` | notifications in the corner of the screen | `deckit.notify` |
| `system.global-keys` | keys that work in every app, this one in front or not, taken from all of them | `scope: 'global'` on a key |
| `deckit.command-registry` | listing the commands of every mod and of the app, and running them, doing whatever they do | `list`, `run`, `complete` and `onChange` on `deckit.commands` |
| `deckit.mods` | every mod: listing, installing, removing, launching them again and putting them in a load order, picking and revealing their folders, the children pinned to the mod list, and restarting the app | `deckit.mods`, `shell.mods` |
| `deckit.mod-configuration` | every mod's configuration | `deckit.modConfiguration` |
| `deckit.app-keys` | keys that work wherever the keyboard is in the app, whatever is in front | `scope: 'app'` on a key |
| `deckit.keymap` | binding, changing and switching off the keys of every mod | `list`, `bind`, `reset`, `record` and `onChange` on `deckit.keys` |
| `deckit.url-schemes` | the order of each scheme's handlers, and which are switched off | `list`, `set` and `everyScheme` on `deckit.urls` |
| `deckit.styles` | how every page looks, other mods' among them, and so what they show | `shell.styles.register` |
| `deckit.fonts` | the fonts and the text size every mod writes text in | `shell.fonts` |

The names are the contract's. A name the contract does not have, or one without a reason, stops the mod. A name the contract has that no layer on this host app gives (`system.overlay-windows`, `deckit.styles` and `deckit.fonts` where no UI shell is) is not usable here: the mod runs without what it guards. Without asking, a mod has its own sandbox, records, values, configuration, keys and web sessions, and of deckit and its shell: asking for an address to be opened, putting itself on screen, a window of its own, and `about()`. None of it reaches another mod.

## The entry

```js
class Calendar {
    static configuration = { notify: { type: 'string', title: 'Notify me', default: '5', oneOf: [ … ] } };
    static form = { … };
    static icon = `<svg …>`;
    static keywords = ['calendar'];

    async start(deckit) {
        this.providers = new Map();
        deckit.commands.register({ … });
        deckit.exports.register({
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
        shell.view.register({ content, sidebar, didAppear, didDisappear });
        deckit.keys.register({ today: { label: 'Today', key: 'mod+shift+y', scope: 'app', run: today } });
        deckit.dependencies.onConnect('switcher', (switcher) => switcher.setActions(actions));
    }

    detach() { … }
}

module.exports = Calendar;
```

| Member | Read or called by | What it is |
|---|---|---|
| `static configuration` | deckit | what the person can configure about the mod (below) |
| `static keywords` | deckit | other words the mod is matched by, as in the Show candidates |
| `static icon` | deckit's shell | an inline SVG string, about 18px, which the shell draws rebuilt from its shapes |
| `static form` | deckit's shell | how Settings draws the configuration (below) |
| `start(deckit)` | deckit | the function lifecycle starts: it registers what the mod does; may be async, and the run waits for it |
| `stop()` | deckit | the function lifecycle ends, with the run |
| `attach(shell, deckit)` | deckit's shell | the screen lifecycle starts, once `start` has ended: it registers what the mod shows; may be async |
| `detach()` | deckit's shell | the screen lifecycle ends, before `stop()` |

Each layer reads only the members it knows, and every one is optional. The statics are read as the entry is evaluated, before an instance is made, so a mod whose `start` fails still has its icon and its configuration. A static of the wrong shape (an `icon` that is no string, a key in `form` the configuration does not declare) is read as far as it can be, with a warning on the mod's row in Settings. The class may have any other member it likes: no layer reads it, and none catches a misspelt `detatch`. Share state between the methods through `this`.

## Lifecycles

| | Function lifecycle | Screen lifecycle |
|---|---|---|
| Methods | `start(deckit)`, `stop()` | `attach(shell, deckit)`, `detach()` |
| Called by | deckit, on every host app | deckit's shell, only where it draws mods |
| What goes in it | what must happen on a host app with no UI: commands a CLI runs by name, exports that work with no UI, what it hands a dependency that does a job, reminders and notifications, `app` and `global` keys that do a job | what exists to be shown: the view or window, styles, `local` keys, keys and handlers that bring something on screen, exports that mean something only on screen, switcher actions and Settings buttons |
| If it throws | the run does not start: the mod is broken | only the screen lifecycle ends, and the run goes on with what `start` registered |

Which method a mod registers a thing in is one question: does this job have to happen on a host app with no UI? A calendar's reminders do, so `start` sets them and fires their notifications; clicking one brings the calendar forward through a path of the mod's own to what `attach` made (a field `attach` sets on `this` and `detach` clears). A browser opening an address in a tab does not, so its `deckit.urls.register` is in `attach`, and on a host app with no UI the address passes to the next handler. Which lifecycle a mod opens its exports in is part of what it promises, and its documentation says it: the Switcher opens `setActions` in `attach`, so a mod hands it actions in `attach`; Calendar opens `setProvider` in `start`, so a provider hands itself over in `start`.

The function side never reaches the screen side. `start` does not receive `shell`, and code `start` set going (a timer, a listener, a function its exports hand another mod) does not use a `shell` it was handed later, or the DOM of the page as something shown: the page is the mod's sandbox, not its screen. A mod that does breaks where no shell draws it. Nothing stops it; it is the mod's fault.

The lifecycles wrap the run in the order they stack. As the run launches, `start` runs and what it registered is joined: the run is running, and the mods that require it start. Then `attach` runs, and what it registered is joined to the run's as it ends. A slow `attach` keeps the mod's screen waiting, not its commands, the exports it opened in `start` or the mods that require it. As the run ends, `detach()` runs, then `stop()`, each without waiting on a start still going, each with its own short time: what is still running when it runs out is left. What must not be lost is written there, or better, as it changes.

If `attach` throws, or what deckit's shell does to the page as the screen lifecycle starts fails, the screen lifecycle ends: what is on screen goes, `detach()` runs, what its handles made is cut (below), its connections end, and the problem is shown on the mod's row in Settings. It is not ended again as the run ends. `detach` is called after an `attach` that did not finish, so it bears state half made.

### What a lifecycle's handles make

Each method that starts a lifecycle receives handles of its own: the `deckit` that `attach` receives has the members of the one `start` received, with its own `dependencies`, and registers into the screen lifecycle. What a handle makes that calls back into the mod's code is cut as its lifecycle ends, without the mod undoing it: registrations; `events.on`, `configuration.on`, `keys.onChange`, `commands.onChange`, `mods.onChange` and `dependencies.onConnect`; `notify`'s `onClick`; the `on` of a main process module's methods; `shell.theme.onChange` and `children.onChange`; regions, `shell.web` pages and windows, the window, and the view. A view or window on screen disappears first (`didDisappear`), then the end method runs, then the rest is cut, and then the lifecycle's connections end (Dependencies and connections). What the mod makes itself (an emitter of its own, a timer, a listener on the DOM) it undoes in `detach` or `stop` when it would call back into a lifecycle that has ended. A main process module started in `attach` ends with the run.

### Registering

Each concept on a handle is one namespace, and `register` on it puts up the mod's own. Each registration is a call on a handle, once in each lifecycle, while the method that received the handle runs; the lifecycle joins them all when that method ends. Leaving one out is how a mod opts out of it. A call made twice, or after its method ended, is shown on the mod's row in Settings.

| Registration | On | What it registers |
|---|---|---|
| `deckit.keys.register(keys)` | `deckit` | keys |
| `deckit.commands.register(commands)` | `deckit` | commands |
| `deckit.urls.register(handler)` | `deckit` | the handler of the addresses its `urls` patterns match |
| `deckit.exports.register({ connect, disconnect })` | `deckit`, once for the run | the exports the mods that depend on it are connected to |
| `shell.view.register(view)` | `shell` | the view |
| `shell.window.register(window)` | `shell` | a window of its own |
| `shell.styles.register(styles)` | `shell`, with `deckit.styles` | styles for other pages |

Keys and commands are named in one space for the mod. When `start` and `attach` register the same name (a key, a command) or both register a URL handler, the one from `start` stands, and the other is left out with a warning on the row. `exports.register` is called once for the run, in the lifecycle that has the job: once one lifecycle opened them, a call in the other is refused.

### deckit.keys.register(keys)

```js
deckit.keys.register({ home: { label: 'Open Home', key: 'mod+shift+h', scope: 'local', run: () => tabs.open('https://example.com') } });
```

Each key is `{ label, key, scope, run }`: `run()` is what pressing it does, in the mod's page, and `label` is what Settings calls it. A key takes no args: the same thing done two ways is two keys, each `run` with its own. What `run` throws is only logged, since no one asked to be told. A key is refused and shown on the mod's row when it has no `label` or no `run`. A key that does what one of the mod's commands does calls the same function. `key` is the default chord; the person can give the key another, or none, in Settings. Modifiers are `cmd`, `ctrl`, `alt`, `shift`, and `mod` (Cmd, or Ctrl without one); `meta`, `control`, `opt` and `option` are read as the same and written back as these.

`scope` is where it works. `local`, the default, is only while its mod is on screen, in its view, its window and the web pages it shows, so a mod registers its `local` keys in `attach`, with what it shows. `app` is wherever the keyboard is in the app, its mod off screen and the panel closed included, and needs `deckit.app-keys`. `global` is in every app too, where the system gives the app its chord, and needs `system.global-keys`; where it does not, the key works as an `app` one does. Which page is in front is the shell's to answer: where no UI shell is, no key comes from within the app, and only `global` keys run. Of keys on one chord the narrowest scope runs where it works: a mod's `local` key in its page, then the app's own on any mod, then `app` keys, then `global` ones. Two keys of one scope that work in the same place on one chord conflict: the one loaded first runs, and Settings shows the other as never running. A key that works past its page has ⌘, ⌃ or ⌥ in it and is not one a text field uses, Return with ⌘, ⌃ or ⌥ among them. A `local` key pressed while a dialog or menu is open in the page is dropped. A mod that shows nothing has only keys that work past its page: as the screen lifecycle joins, each `local` key of the mod, from `start` too, is checked against its view and window, and one that would never run is left out and shown on its row.

### deckit.commands.register(commands)

```js
deckit.commands.register({
    'open-tab': {
        description: 'Opens an address in a new tab',
        params: { type: 'object', properties: { url: { type: 'string', title: 'Address' } }, required: ['url'] },
        run(args) { … },
        complete(param, partial, { args, signal }) { … },
    },
});
```

What the mod does, by name, for anyone to run: another mod through `deckit.commands.run`, the host app, a CLI, an automation. Which of what it does a mod offers is its own to choose: a command does not know where the person's focus is, so what only means something there (Save, Next Tab, Go to Line) stays a key, and a command is what its name and args say in full. A command a CLI runs by name is registered in `start`, so it is there with no UI. A name is ASCII letters, digits, `_` and `-`. `params` is a subset of JSON Schema: `type: 'object'` at the top, and `type`, `properties`, `required`, `items`, `enum`, `oneOf` of `{ const, title, description }`, `title` and `description`; the core refuses any other keyword and checks the args against `params` before every run. A command has no label and no icon: what a person reads is a key's or an action's. Commands are public.

`run(args)` answers the command's result, what the caller receives: a value JSON holds, copied, or nothing. `description` says what it answers; commands have no version, so code that leans on the shape of a result depends on the mod and calls its exports instead. A throw is why it did not run, which the caller reads. A command does not come to the front: one whose work is to be seen (the shell's `show`) does, and a caller that wants a mod in front runs `@shell.show` too. `complete(param, partial, { args, signal })` answers `[{ value, title, hint, keywords }]` for a param being typed, ranked by the mod; `signal` is aborted when the caller no longer wants the answer, and an answer has 2 s. A headless mod is often nothing but commands.

### deckit.urls.register(handler)

`handler(url, options)` answers for the addresses the manifest's `urls` patterns match: the mod is one of their handlers. `options` is `{ activates, target }`: whether the opener means for the person to go there, and the name a web page gave the window it opens; and the address is untrusted input. Return `true` when it opened the address; anything else passes it on. Whether to come on screen is the handler's to decide, with `shell.show()`. A mod that opens an address to show it (a browser's tab, an editor's file) registers its handler in `attach`; one that only does a job with it, in `start`. A handler registered while the manifest names no `urls` is shown on the mod's row in Settings, and nothing asks it. A run that registers no handler takes no address: each passes to the next handler.

### shell.view.register({ content, sidebar, parent, didAppear, didDisappear })

`content` is the element shown in the panel, beside its sidebar and to the panel's top. Where a window's title bar lies over that top, the top of the view is its title bar area, as tall as the page's `--deckit-title-bar-area-height` and starting `--deckit-title-bar-area-x` from the left, past the window's buttons; both are `0px` where there is none. A mod lays its own bar there with `ui.titleBar(element)`, or uses the two values itself. Left of `--deckit-title-bar-area-x`, where the window's buttons stand, the panel takes presses to drag the window, whatever the mod draws there. Registering a view gives the mod a row in the mod list and lets it be on screen. `sidebar` is an element shown in the panel's sidebar, in the slot it lends under the mod list, and scrolled when it is taller. Both are laid in the mod's own page, where the panel's frame leaves them room: the mod list and its card are the panel's, drawn over and under the page. Folding the sidebar takes the mod's `sidebar` away with it and gives its room to `content`.

`parent` is the id of a mod whose view this one is shown in: a child's view goes where a region of its parent's shows it (`shell.region`, below), and has no row in the mod list until the person pins it there in Settings. The parent is a mod named in its `[dependencies]`: optional for a child that runs without it, required for one that does not. A view that names any other is refused and shown on the mod's row, and the mod shows nothing. In a region the view is laid in the region: no mod list, the parent showing through around it, its `sidebar` at the region's start, as wide as the panel's sidebar opens and no wider than the region, and as much of the title bar area as lies over the region.

### didAppear() and didDisappear()

The view came on screen, and went. They come in turn, never twice running, and a view on screen as the screen lifecycle ends is told `didDisappear` before `detach()`.

### shell.window.register({ content, width, height, overlay, didAppear, didDisappear, didResignKey })

Returns `{ open(), close() }`: the mod's page, `width` by `height` with `content` in it, in a window the host app makes, and `open` and `close` put it on screen and away. `overlay` floats the window over every app and needs `system.overlay-windows`; without it the window is refused and shown on the mod's row. `didAppear` and `didDisappear` are as a view's, and `didResignKey` is the keyboard leaving the window. A mod has a view or a window: a `shell.view.register` beside a window is refused ("shell.view.register() is for a mod with no window"). Its `local` keys work while the window is on screen.

### shell.styles.register({ '<mod id>' or '*': css })

With `deckit.styles`, styles other pages while the screen lifecycle lasts: by id its own page and those of the mods named in its `[dependencies]`, and by `*` every page, the shell's too, and every mod's. A style by the id of a mod it does not name is not worn. A page wears them as its last style sheets, in the load order, the later over the earlier: a rule wins at the same specificity over the sheets the kit and the page's mod adopt, and over its `<style>` elements. A style the page sets on an element itself still wins unless the rule is `!important`. A sheet a script of the page's own world adopts, or one pushed onto `adoptedStyleSheets`, goes after them until the styles next change: which wins there is not settled, so a style does not lean on it. What the kit draws reads its tokens, `--deckit-*` on the page's root, and each mod's classes start with its id (UI.md): a mod that sets the tokens recolours what is drawn with them, and what a page colours from `theme` in its code stays as it is. A page for a mod that is not there is never styled, and a mod's styles go when its screen lifecycle ends.

## Configuration

What the person can configure about the mod is declared in `static configuration`. deckit's core checks each value against its declaration and keeps it, the mod reads them through `deckit.configuration`, and Settings draws them, as `static form` says. A declaration is a subset of JSON Schema, as a command's `params` is:

```js
static configuration = {
    wrap: { type: 'boolean', title: 'Wrap lines', default: true },
    size: { type: 'number', title: 'Text size', default: 13, minimum: 9, maximum: 32 },
    font: { type: 'string', title: 'Font', default: 'default' },
    notify: { type: 'string', title: 'Notify me', default: '5', oneOf: [{ const: 'off', title: 'Off' }, { const: '5', title: '5 minutes before' }] },
};
```

| Field | What it says |
|---|---|
| `type` | `boolean`, `number` or `string` |
| `title`, `description` | what a person reads |
| `default` | what it reads as while nothing it takes is saved |
| `oneOf` | `[{ const, title }]`: the values it takes, each of its `type` |
| `minimum`, `maximum` | for a number: the values it takes, and what a number set is held within |

A declaration deckit's core does not read (no `type`, a choice of another type, a `default` it does not take) is left out and shown on the mod's row in Settings; the rest stand. A value saved that its declaration does not take (another type, out of range, not one of the choices, a key no longer declared) reads as the default, with a warning on the row, and is left as it is saved: a mod never fails to start because of its configuration. What a value means is the mod's alone; one that only says how the mod draws (an editor's minimap) is declared the same way, and is read by nobody on a host app with no UI.

### static form

How Settings draws each key: `{ <key>: { placeholder, unit, step, choices } }`, read by deckit's shell. `placeholder` is the hint in an empty text field, `unit` is written after a number, `step` is what a number moves by. `choices` names a list the shell has, a method of `ui` that answers it: `textFonts` or `monospacedFonts` (UI.md). A key with `choices` is declared `type: 'string'`; a value saved that the list does not have is drawn as the default.

### deckit.configuration

- `get(key)`: what it reads as: the value saved, when its declaration takes it, or `default`.
- `set(key, value)`: checked against the declaration, a number held within `minimum` and `maximum`; a value of another type, or not one of the choices, rejects. Resolves to the value as kept.
- `on(listener)`: `listener(key, value)` on every change, from Settings or from the mod. Returns the unsubscribe.

## deckit

What `start` and `attach` receive as `deckit`. deck's members and deckit's are one handle: both run with no UI.

Each concept is one namespace. `register` puts up the mod's own (Registering). Every other verb reaches others: it asks them, hears them, or handles what they registered. What reaches other mods' code and registrations widely is guarded by a permission: running and listing others' commands, binding keys, ordering the handlers of addresses, and opening files.

| Member | What it is |
|---|---|
| `id`, `name` | the mod's |
| `configuration` | above |
| `storage` | below |
| `web` | `web.session(name)`, below |
| `commands` | `register(commands)`; with `deckit.command-registry`: `list()`, `[{ provider, command, description, params }]`, the app's commands first, then the mods' in the load order, `provider` the id of what declared and runs one: a mod's, or a host's `@` name; `run({ provider, command }, args)`, which resolves to the command's result or null and rejects with why it did not run; `complete({ provider, command }, param, partial, { args, signal })`; `onChange(listener)`, which returns its off |
| `keys` | `register(keys)`; `chordOf(name, { provider })`, the chord one of the mod's keys is bound to now, or `''`, and with `provider`, a key of that mod or host; with `deckit.keymap`: `list`, `bind`, `reset`, `record`, `onChange`, where `bind` gives a key the chord a person chose, as Settings does; `list` answers at once, `onChange` returns the unsubscribe |
| `urls` | `register(handler)`; `open(url, { activates, usesDefaultApp, target })`, which offers an address to the handlers its patterns match in turn, then deckit's own answer (`urls`, above), and resolves to whether anything opened it. A `file://` address goes anywhere only with `system.file-handlers`, and otherwise resolves `false`; a web address goes to the default browser with no permission. With `deckit.url-schemes`: `list()`, each scheme's handler list `{ scheme, system, handlers }` at once, a handler `{ id, name, patterns, on }`; `set(scheme, { order, off })`; `everyScheme`, the name of the list for every scheme |
| `events` | `emit(name, ...args)`, `on('<mod id>:<name>', listener)` (below) |
| `exports` | `register({ connect, disconnect })` (Dependencies and connections) |
| `dependencies` | `dependencies.<id>` and `onConnect(id, connected)` (Dependencies and connections) |
| `fileURL(path)`, `filePath(url)` | a file's `file://` address, and back |
| `reveal(path)` | with `system.file-handlers`: shows a file in the system's Finder |
| `provider(id)` | with `deckit.command-registry` or `deckit.keymap`: who declares keys or commands as `id`, `{ id, name, host }`: a host by the name it gives, or a mod deck loads; null for neither |
| `about()` | `{ name, app, version, source, electron, chrome, home, mods, data, log }`: the host app's name and version, deckit's version and the hash of its sources, the version of each engine deckit runs on under its name in lower case (`electron` and `chrome` on Electron), the person's home folder, and the folders of deckit's mods, data and log |
| `util` | below |
| `clipboard.writeText(text)` | with `system.clipboard-write` |
| `clipboard.readText()` | with `system.clipboard-read` |
| `notify({ title, body, silent, onClick })` | with `system.notifications` |
| `mainProcess(path)` | with `system.main-process` (below) |
| `mods` | with `deckit.mods` (below) |
| `modConfiguration` | with `deckit.mod-configuration`: `list()`, each mod that declares any configuration as `{ id, name, items }`, an item its declaration with `key` and `value`, what it reads as; `set(id, key, value)`, checked as the mod's own `set` is, which resolves to the value as kept |

### storage

- `storage.values`: `get(key, fallback)`, `set(key, value)`, `remove(key)`. Small state that costs a click to lose (a fold, a width), in the sandbox's own storage.
- `storage.records`: `get(key, fallback)`, `set(key, value)`, `remove(key)`, `keys()`. What must not be lost (bookmarks, open tabs), as JSON files in deckit's folder, written by deckit's core. `get` and `keys` are synchronous, and `get` answers a copy: change it and `set` it to keep the change. `set` and `remove` resolve once written, and a write that fails is shown on the mod's row in Settings. A key is lower case letters, digits, `.`, `_` and `-`, starting with a letter or a digit, at most 64: it names a file, and a Mac's disk is blind to case.

### web.session(name)

A web session of the mod's own, kept across restarts: `{ name, clear() }`, and with permissions `fetchText(url)`, `trust([{ host, fingerprint }])`, `allow([{ origin, permission }])` and `revoke(entries)`. Its pages share its cookies and nobody else's. A session does its work with no UI; its pages are shown by `shell.web`.

### mods

With `deckit.mods`: `list`, `pick`, `install`, `remove`, `relaunch`, `load`, `arrange`, `reveal`, `usage`, `restartPending`, `restart`, `onChange`; `list` and `restartPending` answer at once, the rest resolve. The children pinned to the mod list are the shell's, on `shell.mods`.

- `list()` answers `{ found, running }`. `found` is every mod deck found, loaded or not, in the load order, each its manifest with `folder`, `installed` (a copy in deckit's mods folder), `shipped`, `hides` (folders of the same id not read), `problem` (why it does not load, or null), `run` (its latest run's `{ state, problem }`, or null for one with no sandbox), `launched` (while it starts or stops again, what its latest run that launched contributed, as `running` lists it, or null), `mainProcess` (`{ running, failure }`: whether a main process module of its started, and why one did not, or null), `relations` (`[{ id, optional, version, name, problem, running }]`, a row for each mod in its `[dependencies]`: `optional` whether it runs without it, `version` the version it names, `problem` what is wrong with it, absent when nothing is: a required one not there at that version, or an optional one there at a version it does not take, `running` whether it is running) and `dependents` (the ids of the mods that load and require it, directly or through another: none of them loads without it). Each permission in a manifest is `{ id, name, means, reach, reason, usable }`, `usable` false for one no layer on this host app gives. `running` is each running mod's `id`, `name` and summary: what each layer read of its class (`keywords`, `icon`, `form`) and what it contributes, with `exports` (whether a lifecycle of it opened exports) and `problem`. `view` in a summary is absent until a screen lifecycle has joined, and false once it has ended.
- `onChange(listener)` hears that what `list` or `restartPending` answers may have changed (a mod found or gone, a run that moved or joined a lifecycle, a problem against a run, a main process module that ended), and answers its off.
- `install(from)` resolves, once the mod and the mods that require it have launched in its place or failed to, to the mod's manifest with `restart`: whether only a restart of the app finishes the install.
- `restartPending()` answers `[{ id, why }]`, the mods whose main process modules only a restart finishes; `why` is `updated`, `removed`, `reinstalled` or `leftover` (a `dispose` that failed).
- `relaunch(id)` terminates the mod and launches it again, or launches one not running, and the mods that require it load again with it, resolving once each has launched or failed to: one launched while a mod it requires is not running fails as it launches; for a mod that did not load it resolves and does nothing.
- `load(ids)` loads the mods named that are not running, in the load order, each once a run of its that terminates has ended and what it requires has launched or failed to, and resolves once each has launched or failed to.
- `arrange(ids)` gives the mods named the places they held among themselves in the load order, in the order given, the rest staying put, and resolves once `list()` has it; it rejects an order that puts a mod that loads before one it requires, and while `deck.json` does not read.
- `usage(id)` resolves to what the mod has in each place deck keeps it, `{ data, records, kept }`: `data` the files of its data folder (`{ count, capped, hidden }`, `capped` when it holds more than were counted, `hidden` when it holds names that start with a dot), `records` the files of its records (`{ count, hidden }`), and `kept` the names of what the layers keep for the mod, such as `configuration`. `remove(id, true)` erases all of it.

### util

| Member | What it does |
|---|---|
| `match(text, query)` | the switcher's matching: `{ tier, score, at }` or null |
| `matchFields(fields, query)` | the same over several fields, `[{ text, name, weight, cap }]`: `{ tier, raw, score, at }` or null |
| `TIER` | the tiers a match is in, best first: `EXACT` 5, `PREFIX` 4, `WORD` 3, `INSIDE` 2, `SPREAD` 1 |
| `ranker({ paths })` | the same off the page, for a list too long to rank on every key (`paths`: the names are paths, matched by their last part first): `{ rank(names, query, { limit }), close() }` |
| `movePath(path, from, to)` | a path after `from` moved to `to`, or null when it went with it |
| `tildify(path)` | a path as it is shown, from `~` under the home folder |

### mainProcess

`mainProcess(path)` starts a main process module of the mod's (below) and resolves to its methods, each called through the main process and so returning a promise, with `on(name, listener)` to hear what it emits; `on` returns the unsubscribe. A path outside the mod's folder, or a module that throws as it starts, rejects. A failed start is tried again the next time it is asked for.

### events

A mod says what happened to it, for whoever cares, as events. `deckit.events.emit(name, ...args)` sends one, named after the mod: `bot` emitting `status` is `bot:status` to listeners, and no mod can send another's. `deckit.events.on('<mod id>:<name>', listener)` hears one and returns its off. Values are copied, and a function is not: an event that holds one is not sent, and the mod's row in Settings says why. Listening takes no dependency: a mod's events go out while it is running, from when its `start` has finished until it terminates, and nothing arrives from one that is not running.

## shell

What `attach` receives as `shell`, from deckit's shell (the panel and the kit). A shell of another host app that calls `attach` gives the same.

| Member | What it is |
|---|---|
| `theme` | the look, derived from the host app's and the person's fonts: `dark`, `font`, `mono`, `textFont`, `textSize`, `type`, `border`, `color`, `radius`, `shadow`, `motion`, `syntax` and `glass` (the strength, 0.68, a surface drawn as glass lays its colour at over what is behind it), each read as it is now, and `onChange(listener)` for a new one, which new fonts are too ([UI.md](UI.md)) |
| `ui` | the kit, drawn in `theme` ([UI.md](UI.md)) |
| `show()` | the calling mod asks for its view on screen, and the shell puts it there; a mod with no view in the panel, or one still starting, has nothing to show. A child not in the mod list brings its parent on screen |
| `iconOf(mod)` | the icon of the mod's latest launched run, or `''` |
| `formOf(mod)` | resolves to the mod's `static form` as the shell read it |
| `region(element)` | a place in the mod's view where its children are shown (below) |
| `children` | `list()`, `[{ id, name, icon }]` of the mods whose view names this one as its `parent` and that run or are launching again, each from its first launch, in the load order, and `onChange(listener)`, which hears them each time they change and returns its off |
| `web` | `page({ session, url })`, `window({ session, url, title })` (below) |
| `fonts` | with `deckit.fonts`: `get()`, the person's `{ text, mono, size }` at once, each null for the default: a face's name for `text` and `mono`, a whole size from 11 to 22 px; `set(change)`, any of them, null putting one back to its default, which resolves to the fonts as kept. Every page's `theme` wears them (`textFont`, `mono`, `textSize`) |
| `mods` | with `deckit.mods`: `pinned()`, the children the person pinned to the mod list, at once, and `setPinned(id, pinned)` |
| `view`, `window`, `styles` | each `register` (Registering); `styles` with `deckit.styles` |

The page wears the theme, the kit's styles and other mods' styles from just before `attach` runs.

### region(element)

A mod's view is shown in another's when that one gives a place in its view (`shell.region(element)`) and this one names it as its view's `parent`, in its `[dependencies]`: a dashboard shows its boards, each a mod, beside its own list of them. The parent hears its children through `shell.children`, and a region answers `place(id)`, which puts that child's view in the region and out of any other, and `clear()`. Both resolve once done. `place` rejects for a mod that is not this one's child, and a mod is a child only from its first launch: a parent places the children `shell.children` lists. A region ends when its element, once in the page, leaves it, or with the parent's screen lifecycle, and an ended region rejects `place` and `clear`. The child keeps running in its own page, which the shell lays over what of the element is seen, following it frame by frame: cut where an ancestor clips it (a scroller's edge, the sidebar as it folds), and nothing while the element is hidden. The page is made as small as that part, not cropped, and nothing the parent draws, its menus too, comes over it. Regions are shown while their mod is the one on screen, and a child comes and goes with it (didAppear, didDisappear, its keys). A child is its parent's from when it starts, through launching again, until it starts naming another or none; when the parent's screen fails, the child's view has no place and its function lifecycle runs on. A child pinned to the mod list is in the panel while it is on screen there, and back in its region after.

### web

`shell.web` shows the pages of a session `deckit.web.session(name)` gave:

- `web.page({ session, url })` shows a web page the way a browser tab does, in the mod's view.
- `web.window({ session, url, title })` shows one in a window of its own, for a step taken and finished, such as signing in.

Both return `{ session, state, load(url), back(), forward(), reload(), stop(), mute(on), find(text, { start, back, matchCase }), stopFind({ keepSelection }), close(), delegate }`, and a page also its `element` and `focus()`. The element is a `<webview>` with white under its page, as a browser has; where it sits in the view is the mod's to say. `state` is `{ url, title, icon, loading, canGoBack, canGoForward, audible, muted, capture: { microphone, camera, screen } }`. A page or window closes as the screen lifecycle ends.

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

## The run

Each launch of a mod's entry is a run, and a run is in one of four states:

| State | What happens |
|---|---|
| `launching` | its sandbox loads, the entry is evaluated, each layer reads the class's statics and its configuration is declared; once what it requires runs, the instance is made and `start(deckit)` registers, and starts main process modules if it needs them |
| `running` | `start` has ended and deck has joined what it registered. Where a UI shell draws mods, `attach(shell, deckit)` runs then, and what it registered joins as it ends; a view, if it registered one, is in the panel: didAppear and didDisappear |
| `terminating` | `detach()` then `stop()` are asked: removed, updated, the app quitting, restarted from Settings, a mod it requires ending, or `start` failed. An end asked while its start is still going runs at once |
| `notRunning` | it ended: each end answered or its time ran out, or its page went away |

A mod loads only while what it requires runs, so deckit loads each once what it requires has launched: as the app starts, and as a mod is found, installed or updated, the mods that require it with it. One loaded while a mod it requires does not run (restarted meanwhile) fails as it launches, its page not loaded, and stays as it is, its problem saying which mod it needs. A mod launches again in a new sandbox when it is installed again, and in the same one, loaded again, when it is restarted from Settings. The mods that require one, directly or through another, load again with it when it is restarted (`deckit.mods.relaunch`). A new theme launches nothing again: the page takes it in place (`shell.theme`). A page that loads again by itself ends its run with the page it ran in, and launches a new one in it. A main process module is started once for each mod and path in a run, and with `dispose` it ends with the run (A main process module, below). One with no `dispose` is kept while the app runs: a new run asking for the same path gets the one already running, and one whose code changed is taken up at the app's next start; Settings asks for the restart.

Whatever a layer calls once a lifecycle has started, a call that throws or rejects costs that call alone: it is shown on the mod's row in Settings, and the mod goes on. What must outlive the sandbox is written when it changes: the sandbox can be made again at any of these times.

## Dependencies and connections

A mod relies on another by naming it in `[dependencies]`. It gets three things from it, each in its own place: the exports that mod opens, on `deckit.dependencies`; a place in its view, by naming it as the view's `parent` (`shell.region`); and its pages to style, with `shell.styles.register`. A mod's own exports are what it opens, on `deckit.exports`.

What a mod offers anyone needs no dependency: addresses (`deckit.urls`), commands (`deckit.commands`) and events (`deckit.events`). They are public: anyone may ask at any time, and the one who asks may be no page at all (a CLI, the host app). Nothing says when a function handed over that way could be let go, so they carry values only, never a function. A dependency has a start and an end, a connection, so a function crosses it as a function.

One question picks: could the host app do this if the other mod were not there? If it could, open an address, run a command, or hear an event. If it could not, depend on the mod.

### Required and optional

| | Required | Optional |
|---|---|---|
| Written as | `forge = "1.0.0"` | `switcher = { version = "1.0.0", optional = true }` |
| What it is | part of the mod | something that comes and goes |
| Without it | the mod does not load, and Settings says why | the mod runs |
| As it ends | the mod terminates first, before that one's `stop()` | the mod hears it go (`onConnect`) and runs on |
| Load order | the mod loads after it, and a cycle stops every mod in it | sets no order |
| At a version it does not take | the mod does not load | it is as if it were not there, and the mod's row in Settings says why |

A mod that requires another stays as it is when that one terminates or crashes, until it is launched again.

### Connections

A connection stands between the exports a mod opened and one lifecycle of a mod that depends on it. A mod opens its exports once for the run, in the lifecycle that has the job: `start` for what must work on a host app with no UI, `attach` for what means something only on screen, such as a switcher taking actions. Exports opened in `start` reach the dependent's `start` and `attach`; exports opened in `attach` reach only the dependent's `attach`. It is the rule between lifecycles, widened to mods: the function side never reaches the screen side. A slow `attach` does not keep the mods that depend on it from starting.

| Exports opened in | The dependent's `start` | The dependent's `attach` |
|---|---|---|
| `start` | required: `dependencies.<id>`; optional: `onConnect` | required: `dependencies.<id>`; optional: `onConnect` |
| `attach` | does not reach | required or optional: `onConnect` |

What lasts the whole lifecycle is `dependencies.<id>`; what comes and goes is `onConnect`.

A connection stands when both ends are up: as the dependent's lifecycle begins, before its method is called, or as the exports join, once the method that opened them has ended. It stands whether or not the dependent uses it, and only at a version the dependent takes. It ends as either lifecycle ends, and the lifecycle ends as every lifecycle does: what is on screen goes, its end method (`detach` or `stop`) runs, what its handles made is cut, and then its connections are cut. So a call made in `detach` or `stop` still reaches the other end. As a connection is cut, only the end that lives on hears it: when the exports' lifecycle ends, the dependent's `onConnect` cleanup runs; when the dependent's lifecycle ends, the exports' `disconnect` runs. The end that ends tidies up in its own end method.

### deckit.exports.register({ connect, disconnect })

```js
deckit.exports.register({
    connect: (connection) => ({
        setActions: (actions) => {
            this.actions.set(connection, actions);
        },
    }),
    disconnect: (connection) => this.actions.delete(connection),
});
```

`connect(connection)` is called once for each connection and answers the exports for it, at once: an object of values and functions. `connection` is `{ mod: { id, name } }`, the mod on the other end, frozen, and `disconnect` is handed the same object. So the exports made for a connection know the mod that calls them, and a function keyed by the connection knows whose it is. Exports that need not know answer one object for every connection (`connect: () => this.forge`). `disconnect(connection)`, which may be left out, hears the dependent's lifecycle end while the exports are open. A mod that keeps what a dependent handed it keys it by the connection, and drops it in `disconnect` or once it has no more use for it.

It is called once for the run, in `start` or in `attach`: once one lifecycle opened the exports, a call in the other is refused. The exports end with the lifecycle that opened them.

### deckit.dependencies

```js
// lasts the lifecycle: a required dependency's exports, opened in start
await deckit.dependencies.forge.dispatch('review', inputs, { onRun: (run) => draw(run) });

// comes and goes: handed as each connection stands
deckit.dependencies.onConnect('switcher', (switcher) => {
    switcher.setActions({ list, now, search, run });
    return () => {}; // may be left out: called as the switcher's lifecycle ends while this one lasts
});
```

- `dependencies.<id>`: the exports a required dependency opened in `start`, there from before the lifecycle's method is called until the lifecycle ends. Each lifecycle has its own `dependencies`.
- `dependencies.onConnect(id, connected)`: `connected(exports)` each time a connection to `id` stands that comes and goes: an optional dependency's, or a required one's opened in `attach`. A connection already standing is handed at once. Called twice for one id, both are handed it. A function `connected` answers is called as the connection is cut because the other end ended, while this lifecycle lasts. What `onConnect` adds is cut as its lifecycle ends.
- An `onConnect` in a lifecycle the exports do not reach (in `start`, for exports opened in `attach`) never connects, and the mod's row in Settings says so as those exports join.
- A mod id is lower case only, so `onConnect` is never a dependency's name.

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

A `connect` that throws, answers a promise, or answers what does not cross leaves the connection down, and it is not asked again while both lifecycles last. What follows is the rule for a lifecycle that fails:

| The connection | What follows |
|---|---|
| required, to the dependent's `start` | the run does not start |
| required, to the dependent's `attach` | that screen lifecycle ends, and the run goes on |
| optional | only that connection is down, and the mod's row in Settings says why |

### The version of a mod

What a mod's exports hold, what each of their functions takes and answers, and the lifecycle that opens them are its promise to the mods that depend on it, and its README writes them down. The mod's `version` is the version of that promise: a change that breaks any of it is a new major. Commands have no version (`deckit.commands.register`), and a change only to what the mod shows is no break.

### What is outside

Exports are one mod's protocol: the mod that opens them says what they are. Mods relate by id. Depending on a role ("any calendar provider"), or one protocol that two mods serve alike, is outside this model.

### What deckit's own mods open

Two mods deckit ships open exports for the screen, so a mod names them as optional dependencies and hands them what they take in `attach`, with `onConnect`. Each README writes down what its exports take.

- The Switcher (`switcher`): `setActions(actions)`, the actions listed under the mod ([README](../source/deckit/mods/switcher/README.md)).
- Settings (`settings`): `setButtons(buttons)`, buttons on the mod's settings ([README](../source/deckit/mods/settings/README.md)).

## Load order

The mods load in an order deck keeps: `loadOrder` in `deck.json`, at the top of deckit's folder, a list of mod ids. A mod loads after the mods it requires: one the list places later goes just before it. Otherwise each loads where the list places it. One the list does not place comes after those it places: in the order the host app ships them, then by id. Installing a mod the list does not place puts it in the list just before the first mod there that loads after it, and removing one takes it off; every other place stays, even one whose mod does not load or is not found. A `deck.json` that does not read as a JSON object is left as it is, and the order is not kept until it does. The person changes it by dragging the mods in Settings and applying the order (`deckit.mods.arrange`), and an order that puts a mod that loads before one it requires is refused. It is the order styles are worn in, the later over the earlier, so a mod's styles go over those of the mods it requires, the order keys are tried in, and the order the mods are listed in (`deckit.mods.list()`, Settings). When a mod starts is not: it starts once what it requires has started.

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

`files` changes a person's files without losing one: `fresh(folder, base, make, extension)` makes something new under the first free name, `rename(path, name)` and `move(path, folder)` never put anything over another entry, `name(text)` checks a typed name, `trash(path)` is the macOS Trash. A refusal is `files.refuse(kind, message)`, an error whose `kind` (`NAME`, `EXISTS`, `GONE`, `INTO_ITSELF`, `OTHER_DISK`, or one of the mod's own) reaches the sandbox as `error.kind`.

`window` is a window of the host app's, holding a view the module made: `open({ key, title, view, size, onClose })`, `get(key)`, `close(key)`. The host app frames it. `onClose` runs once the view is out of the window, alive. `open` under a key already open brings that window forward and returns it. `ofPage()` is the window the mod's view is in now, or null: where a dialog or a preview it opens belongs. Keys are the mod's own: two mods asking for `log` get two windows.

A module with `dispose` ends with the run that started it: once the run has ended, `detach()`, `stop()` and all, deckit closes the windows they opened (their `onClose` runs then), calls each of the run's modules' `dispose`, the last started first, a short while at most for each, then forgets their code, and the next run requires them anew. So Restart in Settings, and an install of a new version, run the new code without restarting the app. This holds only when every module of the mod's run has a `dispose`: deckit cannot end what a module made (a timer, a watcher, a server, a child process, an `ipcMain` handler, an Electron object), so a module with none runs until the app quits, keeping the code it started with, and the files the mod's modules share stay with it. A `dispose` that throws or runs out of time, or a module still starting two seconds after its run ended, leaves the mod pending a restart until the app restarts (`leftover`). When the app quits, it waits for these ends too. What a module keeps across runs goes in `folder`. A native addon cannot be unloaded from a process: a mod that ships one needs the app restarted for a new version even with `dispose`. A module runs in the app's main process and can do what the app can do, which is why it is asked for. The sandbox cannot widen its own reach: it calls only the methods a module of its own folder returns, and the main process knows which mod calls by its sandbox.

## Installing

Settings has an Install button: pick the folder, and the mod's sandbox is made again with it. deck keeps its own copy of the folder, replaced whole by an install, and never touches the mod's data. Removing asks about the code and the data as two answers.

A removal lasts: the host app's next install of the mods it ships leaves out one the person removed. An id the host app ships is the host app's; a changed copy under that id is replaced at the next start, so keep one under an id of its own.

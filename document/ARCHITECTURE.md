# How deckit is built

**Deckit** is a library an app embeds, UI included: a host and the plugins it holds. Where it is
shown is the app's, and every app that shows it brings a shell to say so. The host is a contract:
it finds plugin folders, hands each one what it may use, and owns the few things there can only be
one of (the panel, the keyboard, the windows). Everything a person actually uses is a plugin. What
an app embeds is an archive this package builds (deckit-lib); SlacKit, which puts deckit into Slack, is the
app the examples are from.

This document is the reasoning behind those splits and the rules that keep them, in the order
they matter. The contract a plugin is written against is [PLUGIN.md](PLUGIN.md). How an app embeds deckit, and what a deckit of its
own would need, is [EMBEDDING.md](EMBEDDING.md). The kit is [UI.md](UI.md), and how the core is
being restructured is [CORE.md](CORE.md).

## 1. The library, the plugins, and the app

```
deckit/deckit  the library: the host, what is left with every plugin taken away (the panel,
               the plugin system, the switcher, the keymap, pages, windows, files, data), and
               the design system plugins draw with. Names no app it lives in, not even its own name
deckit/plugin  deckit's first-party plugins, Settings among them
the app        not here: its configuration, its shell, what it offers its own plugin, and that
               plugin. SlacKit's is Slack's; Deckit.app's own is deckit/deckit-app
```

The test for each line is the one the host has always had, one layer up: a new plugin needs no
change to the host, and a new shell to show the panel in would need no change to deckit.

Deckit hears of the app it runs in through three narrow surfaces, all filled in by the app:
the module `app/config` in every process (its id and name, how a removed plugin the app ships
comes back, what it adds to the user agent, who is asked first to open links; with none given,
deckit's own), `connect({ assets, shell })` on the app's entry, `deckit/feature/app/main`, in main (how deckit's page is
loaded, and the shell that shows it, which every app brings), and the module
`app/exports` in the panel's page (what the app offers, handed only to its own plugin, the one
whose id is the app's, as `context.app`). EMBEDDING.md is the contract in full.

## 2. The host is the core, plugins are the composition

"The host" here means the library, `source/deckit/deckit/`: the contract, and the few things
there can only be one of. The core is what is left once every feature is taken away: loading a
folder, compiling its view, handing it `context`, mounting what `make()` returned, routing keys to
whoever is on screen. Every feature sits on top as a plugin, and that includes the screen that
installs plugins: Settings is a plugin in every sense, installed with the app like the other
first-party ones and removable like any of them. What it can do beyond other plugins it asks for
by name in `permissions`, the way any plugin could. No plugin is built in: first-party is a fact
about how plugins are bundled and installed, not about what they may do.

When a plugin needs something the host does not offer, the question is whether every plugin would
want it (then it goes in the kit or `context`, once) or only this one (then it stays in the plugin).
What is one app's alone is neither: the app offers it (`app/exports`) to its own plugin, the one
whose id is the app's, and a plugin that wants it requires that plugin like any other, so an
app's plugins can know the app (SlacKit's know Slack) while no general contract carries its shape.

What the core offers is versioned. `api` in a plugin's manifest is the contract version, not the
app's: same major, and the host's minor and patch at least the plugin's.

The kit (`context.ui`, section 9) is part of that contract, and the same rule applied one layer down:
it is the core of how things look, and plugins compose screens out of it. It grows by a different
test, though. A look is added to the kit as soon as one plugin needs it, because a look drawn
inside one plugin is the start of two looks.

## 3. Three processes, and one direction between them

Deckit runs on Electron, so it runs in three places, and each knows one kind of thing.

| | where it runs | what it knows |
|---|---|---|
| the app's page | the app's own page, if it has one | whatever is the app's; deckit is there only as how a chord is spelled (`chord.js`) |
| the panel's page | its own page in a `WebContentsView` | the panel, the plugins, the quick switcher; `app/exports` is what the app offers its own plugin there |
| main | the app's main process | where the view goes (asked of the app's shell), the IPC between the pages, and the machine |

The pages cannot speak to each other, so main carries everything between them, and every word of
it is in a protocol. A channel belongs to the concept whose fact it carries and is declared once,
in that concept's `protocol.js`, with which way it goes and the fields of what it carries
(`deckit/deckit/module/ipc/index.js`): `ask` (a page asks, main answers), `tell` (main tells a page), `report` (a
page tells main). Each side is handed the end it may use, and what crosses is held to the fields at
both ends, so a field renamed on one side fails at the first message, by channel and field. The
check refuses Electron's IPC anywhere but `module/ipc/index.js` and a channel string anywhere but a
protocol, and a channel spoken by a module below its owner is in the wrong concept. A leg is a
channel of its own: the switcher's entries go from the panel's page to main on one channel and
from main to the switcher's page on another. Channels are named `deckit:` and who they are about;
an app's own are its own (SlacKit's are `slackit:`), and deckit sends on none of them. A command
and the fact it brings about never share a name: `panel-hide` is answered later by
`panel-hidden`, `panel-play` by `panel-played`.

A concept is named by its face: the files at its root (`index.js`; a service's `server.js` and
`client.js`; a feature's `main.js` and `view.js`) and its `model/`, but for its `model/protocol.js`,
which is how its own sides reach each other and no other concept's to speak on. What is in any
other folder of it (`service/web/server/`) is its own, and the check refuses another concept naming
it (document/STRUCTURE.md, 3.4).

## 4. Every piece of state has one owner

Most of the bugs this codebase has had were two places holding the same fact. The rule is that a
fact has one owner, everyone else asks it, and the owner is whoever the fact is naturally about.

| state | owner | why there |
|---|---|---|
| whether the panel is on screen | `deckit/feature/panel/main.js`, changed only by the shell | the page asks "show me" or "put it away" and the shell answers, so what the shell believes and what is on screen cannot part |
| which window the panel and the switcher are in, and where in it | the app's shell | it is where the app puts them, not a fact about the panel: deckit asks the shell where a keystroke counts as the panel's (`showsPanel`) |
| which plugin is on screen | `deckit/feature/panel/view.js` (`state.current`) | it is a fact about the panel, not about a plugin |
| which plugins were shown, for back and forward | `deckit/feature/panel/view.js` (`history`), for the life of the page | it is the panel's history of screens, as a window's is of pages: the Back and Forward buttons on the sidebar's Plugins heading and `ctrl+mod+[` `ctrl+mod+]` step through it, while what happens inside a plugin is that plugin's own history, with its own keys |
| the running plugins | `deckit/service/plugin/client.js` (`instances`) | the plugin system made them. The panel, the switcher, the keymap and open hold what each registered with them, never the plugin |
| the order plugins are listed in | the person, kept in the app's own store (`plugin-order`) | a plugin's `order` only places it the first time |
| sidebar width, fold, split | `deckit/feature/panel/view/sidebar.js` | the only state the panel remembers, read and written in that one file |
| a plugin's content (bookmarks, feeds, notes) | files under `data/<id>/`, written by main | losing it matters, and a file can be backed up and read by hand |
| sign-ins to the web (`context.web`, a page's or a fetch's) | a web session of the plugin's own (`context.storage.web(name)`), kept across restarts | a session is always somebody's: what one plugin signs in to, trusts or allows holds for its own pages and no others. There is no shared session; a plugin that wants another's sign-ins `requires` it |
| a plugin's view state (folds, widths, last mode) | `store`, localStorage | losing it costs a click |
| a plugin's settings | the host, in `data/<id>/settings.json` | declared by the plugin, checked and kept by the host, drawn by Settings from the declarations |
| key overrides, the Open With order, plugin order, window places | the app's own store, `data/host/` | they arrange the app itself and outlive a reinstall. `host` is the one id no plugin can take |
| what deckit is called, and so where its data folder is | the app's `app/config`, read through `deckit/service/home/model/config.js` | said once, first in every process, and read by everything after it |
| which keystroke means what | `deckit/service/keymap/`, live in main | a keystroke in a page a plugin shows never reaches the panel's page, so main hears it and hands it to the plugin on screen |

Every name deckit stores something under comes from its configured id: the folder
(`~/.config/<id>`, `~/.config/slackit` in SlacKit), the keys of `store`, the web sessions
(`persist:<id>:<plugin>:<name>`, spelled in `service/storage/model/space.js`), the log. A deckit
of its own, or another app's, keeps its data apart by being called something else.

Two flows cross those owners rather than living in one. Escape goes from main to the page that
answers where it was typed, and there to the topmost modal, then to the field being typed in, then
to what the page means by it (the panel puts itself away): the order an in-page listener would
give, applied to keys no page listener saw, and the keymap's on both sides. The switcher's entries are built by the panel, drawn
by the switcher's own page and relayed by main as data; only the chosen id comes back, and it runs
where the plugin lives.

Values are held as they arrived and interpreted where they are shown. A component returns what
it was given; a consumer that wants it trimmed trims it where it uses it.

## 5. What a plugin is handed

A plugin reaches the host through the `Deckit` facade it is handed and through `context`. Before any
plugin runs, `boot()` (the page's entry, `feature/app/view.js`) removes every global the panel's bundle added, the module registry the
files found each other through first of all, and then leaves two on the page: the kit (`DeckitUI`)
and how a chord is spelled (`DeckitChord`). The loader (the
app's build, or its development shell's preload) notes the page's globals before the first file runs, so a
global added later is closed by default, by whatever name, rather than left open by being
forgotten. Every plugin's view is compiled with `new Function` and only that facade in reach,
so none can see the bundle's scope.

Between plugins there are two ways and only two, and one question picks between them: **could the
app do this by itself if the other plugin were not there?** If it could, it is Open With; if it
could not, it is `requires`. There is no third way, and no "use it if it is there":

- **requires and exports.** A plugin names another in its manifest and receives what that one
  exported, frozen. A dependency nobody wrote down cannot exist. What the app deckit runs in
  offers (`app/exports`) is handed to one plugin only, the app's own (its id is the app's), as
  `context.app`, and that plugin exports it; another plugin wanting the app requires the app's
  plugin like any plugin (in SlacKit, `slackit`). That is how SlacKit's plugins know Slack, and why
  they do not start anywhere else.
- **Open With.** A plugin asks for an address to be opened (`host.open(url)`, a file as a
  `file://` address) without knowing who answers. Each scheme is a line: the plugins whose
  manifest names it in `url-schemes` (or `"*"`) answer with `open(url, options)`, in the order
  the person set in Settings (before that, the app's `openWith`, then the list's), in front of the
  host's own answer for the schemes it has one (the system browser for http and https, the
  system's app for a file); that answer is always last and never off, so taking a plugin away
  gives the behaviour back. Deckit names no scheme for this: a new one needs only a plugin that
  names it, and one nobody takes ends unopened. A plugin that knows some addresses (the app's own,
  SlacKit's plugin and Slack's links) opens those and passes on the rest: the host never asks whose an
  address is. A plugin's settings have no way in from the
  plugin: they are changed in Settings, or by a control of the plugin's own that sets one.

Standing in Open With is not a permission. A permission is what a plugin may reach, asked about
once, when it is installed; Open With is who is asked first when something is to be opened,
ordered by the person at any time. Any plugin may stand in the line; reordering it is reaching
the URL schemes themselves, and only a plugin with the `deckit.url-schemes` permission may.

What every plugin's `host` holds is about itself and about the machine, never about another
plugin: `host.show()` puts the calling plugin on screen and takes no id, because the only id it
could honestly be given is its own. Knowing what else is installed is not on it either; a list of
plugins is what an optional dependency would be built on.

Tools that change the app itself, or that look at the other plugins (`host.plugins`,
`host.pluginSettings`, `host.keymap` and `host.urlSchemes`), and the ones that reach this Mac past
what the app shows (reading the clipboard, notices, any web address, trusting a certificate,
what sites may use), exist on `host` only for a plugin whose manifest asks for them in
`permissions`, with the reason it wants each; a `main.js` is asked for there too, as
`system.main-process`. Permissions come in two families, `system.` for this Mac and `deckit.` for
deckit itself (the table is in PLUGIN.md). A permission is named for what it reaches and the
key for the tool, so the person reads the first and the code the second. That is a declaration, not a wall: every plugin's view runs in one page and a main
half runs in the app's process, so none of this keeps out a plugin that means harm. What it does
is make an accidental reach fail where it is written, and let the person see what a plugin will
change before it is installed (Settings asks, one line for each permission with the plugin's reason). The trust
is given at install, to a folder from someone the person knows. A plugin's main half is reached by op name, and the plugin's id travels with the
call, so no plugin can name another's ops.

Plugins are read from one folder (`plugins/` under deckit's, or `DECKIT_PLUGIN_HOME`), the only
one an install or a removal touches. Where it is, where a copy is staged before it replaces an
installed one, and where the list of the plugins the app ships is kept are decided once, in
`service/home/index.js` (`pluginInstall`), and the command line asks that file rather than
spelling them again. That list (`plugins/.package`) is how an update tells a plugin new to the
product from one a person removed, and it is inside the folder so that whatever removes the plugins
removes the record too. It is written by the one rule that installs the plugins a product ships
(`service/plugin/install.js`, `installShipped`), which the command line bundle carries too, so an
app's installer asks it rather than keeping a copy. An app's development shell also
reads every folder it keeps them in (`DECKIT_PLUGIN_SOURCES`, a path list), read only: a plugin
there wins over an installed copy of the same id, and cannot be removed from Settings.

## 6. Names are the design

**A folder is a concept; its core file says what it is to the rest, and what supports it is in
folders under it.** A feature's halves are `main.js` and `view.js` (the shape a plugin already has),
a service's sides `server.js` and `client.js`, a one-sided concept's face `index.js`, and what the
sides share is in `model/`. So a path says which half it is without a lookup, and where a file whose
name does not say it runs is declared in its define (`runs`, document/STRUCTURE.md, 3.4). A further
part of one (`feature/panel/view/sidebar.js`, `service/web/server/session.js`) is named after its job.

A manifest's `id` must equal the folder; `name` is what a person reads. Inside the code it is the
same for anything told apart by an id (a plugin, a permission, a kind of request): `id` is what the
machine keys on and `name` is what a person reads, never `title` or `label` for that. A control's
own words (`label`) and a tooltip's or a dialog's `title` are something else and keep their names.

Where a file goes is decided by the question it answers, not by who asks it. `service/web/`
gives a web page an agent, windows, certificates and permissions; plugins are what ask for pages,
and it still does not live under `plugin/`, because neither half of it knows what a plugin is.

## 7. The layout

`deckit` is the package; deckit itself is `source/deckit/`, and copied anywhere that folder is all
of it (document/STRUCTURE.md, section 2): the library, Deckit.app's own files and deckit's own
plugins. `source/cli/` is what builds, checks and runs it. The archive, deckit-lib, is the library's
bundles and the plugins beside them as the folders they are; Deckit.app is built from that
archive, the way any app that embeds deckit loads it.

```
source/
  deckit/                 deckit
    deckit/               the library, by layer (document/STRUCTURE.md, 3.1); in a concept, index.js is a
                          one-sided concept, server.js and client.js a service's sides in main and in a
                          page, main.js and view.js a feature's, model/ what the sides share (3.4)
      feature/              deckit's screens, and its entries
        app/                  deckit as an app: main.js, the entry in an app's main process, connect({ assets,
                              shell }); view.js, the entry in a page, the panel's or the switcher's put together
        panel/                the panel's screen (view.js, view/sidebar.js, page.html) and its view in main,
                              in a window of the app's or of its own (main.js, presentInWindow)
        switcher/             the quick switcher's screen (view.js, the list) and its view (main.js)
        window/               a window of our own (the frame the panel's window wears), as a thing rather
                              than a thing the panel does; main/bar.js, when its bar is there
      service/              what deckit does, whatever shows it, and how it is reached across processes
        plugin/               the plugin system: model/manifest.js, the one schema main and an app's command
                              line check against; install.js and remove.js, the rules both sides keep;
                              server.js, the folders, their main halves and their data; client.js, loading
                              them, what each is handed, registering what each contributes
        keymap/               every shortcut by name (model/global.js, the host's own), the person's changes,
                              recording a new chord, running every keystroke where it belongs (server.js), and
                              a page's side of it: its live chords, typing, Escape's order (client.js)
        open/                 what the app opens by itself, and the handlers registered to open it instead;
                              model/scheme.js, what a scheme is, which a manifest is held to as well
        web/                  web pages a plugin shows, as a browser tab holds them, or in a window of their
                              own, in sessions of storage's; server.js and server/ (agent, session, pages,
                              permission, certificate, shim), client.js what a plugin is handed
        switcher/             what can be jumped to (client.js: the sources, what was reached for last) and
                              the relay that carries it to the switcher's screen (server.js)
        notify/               a desktop notice, raised in main, and its click brought back to whoever asked
        runtime/              what this build is (versions, the build, the folders, the log), and quitting
                              and coming back, which is the app's shell's
        storage/              data/ under the folder: the rules every side agrees on (model/space.js: a
                              space's name, a key's spelling, counting, web sessions) and the core's own state
        home/                 how deckit is set up (model/config.js, its defaults), where its folder is and
                              where plugins are installed
        log/                  what our code says, kept in the folder's logs/
      module/               what the rest is built from, with no deckit in it
        registry/             how every file names what it uses and provides, and the one global a bundle adds
        ipc/                  how main and the pages talk: a protocol's ends (ask, tell, report), held to their fields
        store/                a file read whole and written whole
        log/                  a log file kept small, and a guard that turns a throwing listener into a line
        file/                 a person's files as a main half changes them: free names, no overwrite, the Trash
        clipboard/            text on the clipboard and text put there, through main, which has it whatever is focused
        query/                how a typed query finds a name, and how well (context.util.match), and the same
                              off the page in a worker for long lists (context.util.ranker)
        chord/                how a chord is spelled and matched, shared by every process
      ui/                   the design system. Knows nothing about plugins or the panel
        token/                the look as words: colours, motion, layers, glyphs, pointer rules
        kit/                  the components (component/, one file a component; document/UI.md lists them by
                              use), what they share (part.js), and the lot assembled into one `context.ui`
    deckit-app/           Deckit.app's own: config.js (what it hands deckit), shell.js (one window, the
                          panel in it), main.js (the Electron entry), bundle.js (its files around the bundles)
    deckit-cli/           deckit's command line, for an app that embeds it: deckit-cli (the entry),
                          commands.js (what each command does, the library's rules underneath),
                          template/ (what `new` writes)
    plugin/               deckit's own plugins: a catalog deckit-lib carries beside the library, from which an app picks
      settings/ note/ editor/ finder/ browser/
  cli/                    `deckit`, and command/ it dispatches to: build, app, check, dev, install, plugins,
                          engine; library.js, the library as the build reads it (each bundle worked out
                          from its entry); concept.js, which concept and layer a module is and whether it
                          is its face; app.js, Deckit.app's folder put together from an archive;
                          electron.js, the Electron it is made of
    engine/               how the Editor's and the Notes' engine.js are built (deckit engine <plugin>)
document/
  ARCHITECTURE.md         this
  EMBEDDING.md            what an app embeds, and how: the archive, the page and the shell,
                          the configuration, what the app offers and its own plugin
  PLUGIN.md               the plugin contract
  UI.md                   the kit
  CORE.md                 how the core is being restructured
  STRUCTURE.md            what deckit builds, and how it is cut (the target)
```

`service/plugin/` is what deckit does about plugins; `source/deckit/plugin/`
is plugins: deckit's own, which deckit-lib carries for an app to pick from. An app keeps its own
beside them.

## 8. One direction, and one module per file

The library's bundles come out of `source/deckit/deckit/`, each worked out from its entry: the
app's entry for main and for the page (feature/app), the chord module, and what deckit-cli asks. A bundle
carries everything its entry names, and everything those name, each after what it names
(`source/cli/library.js`), so there is no list of files to keep in step with the files, and what an
app embeds is exactly what was checked. An app loads each bundle on its own, after the registry
and what it hands deckit, so a bundle defines everything it uses itself.

Each file is a module (`module/registry/index.js`): it says its name, which is `deckit/` and its
path under the library, the names it uses and the names it provides, and makes what it provides out of
what those give it. The registry holds both ends to that: what `make` returns is refused unless its
names are exactly the ones provided, and whoever uses the module is handed a view that throws on
any other name, so a misspelled or stale member fails where it is read. Nothing else
crosses between files: no file reads another's global, so what a file depends on is written at
its top and nowhere else. The registry is the one global a bundle adds. A name used has to be
defined earlier in the same bundle, and `deckit check`, which the build runs first, holds every
file to that: one module a file, named for its path, no global reached for, nothing named that is
not defined, nothing that names itself through another, no file of deckit's left out of a bundle.

Names go one way, and the check holds that too (document/STRUCTURE.md, 3.1): a feature names
features, services, modules and the kit; a service names services and modules; a module names
modules; the kit names the kit. A feature never knows how a service is reached (whether a call
crosses to another process, and how): that is the service's to compose. What a service needs of
a screen (the frame the windows web and a plugin's main half open wear, the panel each plugin's
screen goes in) it is handed by the feature that has it. Nothing
in deckit names the app's files: it is handed `app/config` and `app/exports`, named as optional,
since an app may hand neither.
`ui` takes a theme and returns things that can be put on screen and has never heard of a plugin.
`service/plugin/client.js` takes the list main read, assembles `context`, and registers what each plugin
contributes; it never touches the DOM.
The app's entry (`feature/app/main.js`) comes after everything it assembles, and the app's shell after deckit's main bundle,
because it is the app: it connects before the app is ready (SlacKit's places the panel when Slack's
page says it is up).

The contribution points (the panel, the switcher, the keymap, open) take registrations, each in a
shape of its own (a screen, a source, a key scope, a handler), and tell the registrant what was
wrong with one through the `invalid(why)` it handed in. None of them asks who registered: the
plugin system registers for each plugin, after every plugin is made, and records what goes wrong
against the plugin, where Settings shows it. `feature/app/view.js` is where the page is assembled:
it says which page this is (the switcher's draws its list and nothing else), connects the pages
plugins show to open, makes the plugins through the plugin system, and starts the panel with the
screens they registered. So calls follow the load order: nothing hands a lower module a way back
up except the hooks a registration carries.

## 9. One design system

A panel where every plugin invented its own row height and its own hover is a panel that looks
like several apps. So there is one of each thing, in `deckit/ui/`, and plugins draw with it:

- one easing and three durations (`ui.motion`), one accent blue, one set of layer numbers (`ui.z`),
  status said by name (`ui.tone`: ok, warn, alert) and two row washes (`ui.wash`: hover, cursor);
- one stack of what floats above the page (a modal, a menu, a drag, the switcher's card): Escape
  closes its top, a press outside closes what it is not in, and each layer is drawn above the
  ones under it, whatever kind either is. What takes the keyboard is a layer; what floats while
  the keyboard stays with the text being typed (`ui.suggestions` under a caret, `ui.floatingBar`
  over a selection) is not, and the text decides when it goes;
- a transition whose start has to be committed before its end goes through `ui.play`, so an
  element never arrives in one style pass instead of moving;
- buttons are `iconBtn`, `textBtn` and `segmented` in two sizes; a plugin does not style a button
  of its own, it asks the kit for another option;
- sidebar sections are `ui.section`: a heading that folds carries the caret and steps its rows in
  under its icon, one that does not is set in by a row's own padding so its icon stands over its
  rows' icons, and no heading keeps an empty column for a fold it does not have; a section over a
  list has an icon, and the one heading that names the screen (`title`) has none; a heading that
  is a control of its own (`onHeading`) is drawn as one, never reached into;
- a path of places is `ui.breadcrumb`; a row's own actions are `miniBtn`s, shown by
  `ui.hoverable` while the row is pointed at or holds the keyboard, and only those;
- a screen with nothing on it says so with `ui.emptyState` (glyph, what is missing, what to do,
  the buttons that do it), centred, on the panel's glass;
- a list with a keyboard cursor follows the pointer only once it moves (`ui.aimOnMove`), so a list
  opening or redrawing under a resting mouse does not move the cursor;
- a field never waits on what it asks for: a long list is ranked off the page
  (`context.util.ranker`, a worker), what is on disk is searched by main, a long answer is drawn a
  screenful at a time (`ui.drawInSteps`), and what only reports on an answer (a count of matches)
  waits for the typing to pause, so a key pressed is on screen in the frame it was pressed;
- controls are mixed to solid colours, never faded with alpha, because a control that lets the
  page behind it show through stops reading as an object;
- icons are Lucide, added to the kit's glyph table and used by name.

## 10. What is deliberately not here

Every absence below was something that existed, or was proposed, and was taken out because it
could not justify itself.

- **No backward compatibility shims.** A rename renames everything, keys and channels included;
  an old manifest format or storage key is not read.
- **No built-in plugins, and no `private`.** Every plugin is a folder read from where it is
  installed, Settings included, and any one can be removed. Whether a plugin is handed on is where
  it is kept, not a flag in its manifest. The app's own plugin is one too: what a person does with
  the app can be removed, while where the panel is shown is the app's shell and stays.
- **No app in deckit.** Not Slack, not any: not in its code, its names or its comments. What is an
  app's is the app's, and deckit hears of it only through the three surfaces in section 1. Only the
  app's own plugin is handed what the app offers, and any other plugin reaches it by requiring that
  one; a request to open an address carries the address, never whose it is.
- **No popout in deckit.** Over an app, in a window of its own, moved between them: that is a
  shell's, and the panel and its plugins are not told which. The panel draws no way out: the app
  offers the move itself (SlacKit through its own plugin's command and the panel key).
- **No `view` or `main` fields in a manifest.** The folder already says whether `main.js` is there.
  A manifest only says what the folder cannot.
- **No double click on top of a click that already acts.** A click that does something (folds,
  resets, runs) is not given a second meaning on two clicks. The file-list idiom is the exception
  it is: where a click only selects or previews, a double click opens or keeps, as in the Editor's
  tree and tabs and in Finder.
- **No overlay mode.** The panel used to be laid over the app's document; it is its own view now,
  and so is the switcher, which moves to whichever window asked for it.
- **No watcher on plugin data files.** A file edited by hand is read at the next start. Nothing
  promises otherwise.
- **No source tree in an app.** An app embeds the archive and never edits what is in it; a change to deckit
  is made here and built again.

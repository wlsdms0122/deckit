# Deckit's core, layered

A design for restructuring what was `source/lib/core/`. It is the target, not a description of the
code today; section 12 is the order of getting there, and once the code matches, the parts of this
that last move into ARCHITECTURE.md and this file goes. Its folders, files and layers are
replaced by document/STRUCTURE.md, section 3 (what is a capability or a contribution point here is
a feature, a service or a module there), so the paths in it are the names files had before that
move; what it says of the contribution points, storage, web and the order holds.

## 1. What is wrong today

The core is 25 files and about 8,200 lines, and eight of them hold 73% of it (`panel/view.js` 1038,
`page/main.js` 886, `plugin/view.js` 817, `panel/main.js` 798, `plugin/main.js` 726,
`switcher/list.js` 594, `switcher/view.js` 444, `window/main.js` 444). The size is mostly not the
size of what those files are about. It is concepts with no module of their own living in the
panel and the plugin system:

- The plugin contract, 420 lines, is the header of `panel/view.js`, and PLUGIN.md says the same
  again.
- The app's own store (`DeckitStore`: the key map, the scheme order, window places, the plugin
  order) is published by `plugin/main.js`, so keymap, open and window, which are below the plugin
  system, lean on it, and main's bundle has to load the plugin system before them.
- Notifications are in three files: main's half in `panel/main.js`, the page's in
  `plugin/view.js`, the click relayed by `panel/view.js`.
- Routing a keystroke (recording, Escape, the global chords, the chords of what is on screen,
  typing) is in `panel/main.js`; `keymap/main.js` only keeps the overrides and records.
- The switcher's main half (its view and ten relay channels) is in `panel/main.js`.
- A cookie jar is spelled in `plugin/data.js`, fetched through and cleared in `plugin/main.js`,
  signed into and kept alive in `page/main.js`.
- The capabilities a plugin is handed leave `plugin/view.js` (`HOST.capabilities`), are assembled by
  `panel/view.js` and come back (`HOST.connect({ provided })`) unchanged, except the four that
  are opening's.

Three knots hold it together: `windowOf` in `panel/main.js`, which answers "which window is this
page in" out of the panel's record, the switcher's and the web pages'; `panel/view.js` being the
page's composition root as well as the panel's screen; and the store direction above.

## 2. The rules this follows

1. **Deckit is a library to be embedded, UI included.** Where it is shown, over Slack's window or
   in an app packaged for deckit alone, is the app's. No app is special: a standalone deckit is an
   app like the Slack build, and it shows deckit the same way.
2. **The core provides the core capabilities, and everything is composed over them.** Thin is
   not "does little": a capability the core does not open is one no plugin can have (a plugin
   cannot show the web if the core cannot). A capability is opened as an abstract interface. A
   flow with one purpose (signing into one site) is composition, not core.
3. **The core knows no plugin.** The plugin system is part of the core; what the core must never
   know is any plugin in particular, by name, by flow or by the words of its screen.
4. **Inside the core, layers.** A capability or a contribution point does not know the plugin
   system; the plugin system composes them into what a plugin is handed and what it contributes.
5. **Every module says what it provides and what it depends on.** A reader of one module reads
   its interface and the interfaces it names, never past them. Code is written by people and by
   models, and a model weighs everything it has seen; a boundary that has to be inferred is one
   it will cross.

## 3. The layers

```
app/
  slack/            an app: its configuration, its shell (where deckit is shown), its embed in
                    Slack's page, what it offers its own plugin, and that plugin
  deckit/           the library
    ui/             the design system
    module/         the registry every file is a module of
    core/
      capability/   home, log, storage, files, window, web, notify, clipboard, app, query
      contribution/ keymap, open, switcher, panel
      plugin/       the plugin system
      boot/         where the core is assembled, and the one way in for an app
    plugin/         deckit's first-party plugins
```

The two middle layers are told apart by which way things go through them. A **capability** is taken:
a plugin, or anything above, calls it and gets something back (a space, a page, a window). A
**contribution point** is given to (the word VS Code uses for the same thing, and the one the code
already says: what a plugin contributes): it takes registrations of what fills it (a screen, a source, a key scope,
a handler, section 8) and tells the registrant what was wrong with one (`invalid`). The plugin
system does both, and so it reads as two acts: handing a plugin its capabilities, and registering what
the plugin contributes to the contribution points.

Dependencies go one way: an app → boot → plugin → contribution points → capabilities, and `ui`
beside them for whatever draws. Inside a layer, a module names only the ones its row in section 5
declares, and those declarations form no cycle: among capabilities, web and window name storage
and web names window; among contribution points, keymap and open name none of the others, the
panel names keymap, and the switcher names the panel (its page is the panel's page in another
role) and keymap. Nothing below the plugin system names
it or boot. Policy a module needs (which addresses a page may show, where a failure is recorded)
is a hook boot hands it, not a global it reads.

Every file is a module of `deckit/module/registry.js`: it is named for its path, names what it
uses, and reads no global, and `deckit check` (run by the build) holds every
file to that, and to the direction: a module names only modules of its own layer or below, and
nothing in deckit names the app's files. No first-party plugin's id in the core joins the check in
step 6.

`deckit/shell/` is gone (section 4).

## 4. The app's side: the shell

An app connects once, in main, before it is ready: `Deckit.connect({ assets, shell })`
(`boot/main.js`). `assets` is how the core's pages are loaded. There is no default shell: an app
that shows deckit brings the shell that shows it.

What the core hands the shell, in `start(deck)`:

| | |
|---|---|
| `panel.view()` | the panel's view, built on first use. The shell puts it in a window (`window.place`) |
| `panel.show()`, `panel.hide()` | up, and away once the page has played its exit. `hide` resolves whether the panel had the keyboard, which is then the shell's to give back |
| `panel.leave()`, `panel.arrive()` | the exit and the entrance around a move the shell makes (re-parenting is the shell's); `leave` resolves false when the move is off |
| `panel.shown()`, `panel.focus()` | whether it is up; the keyboard |
| `panel.present(look)`, `panel.setTheme(theme)` | `{ floating, dismissible }`; the colours the page and deckit's windows wear |
| `panel.presentInWindow({ key, title, boundsKey, onClose })` | the panel in a deckit window of its own (below) |
| `switcher.chord()` | the switcher's key as bound now, for a shell that names it |
| `switcher.view()`, `switcher.open()`, `switcher.close()`, `switcher.shown()` | the switcher, placed by the shell in front of where it was summoned. `open` resolves once it is over: true when put away (the keyboard is the shell's to give back), false when it went elsewhere |

`presentInWindow` is the core's because three facts hold between the panel and a deckit window
and both are deckit's: the bar's height over the page reaches the panel's page as its inset (so a
plugin steps out from under it), the window is glass because the panel is (a coloured window under
it would make the panel solid in one place and not the other), and the view is out of the window
before the window takes it down. Whether to show the panel in a window, and when, stays the app's.

What the shell answers (`connect` refuses a shell that does not answer all of it):

| | |
|---|---|
| `showsPanel(webContents)` | whether, where that keystroke landed, the panel is what is on screen: in its window, with nothing (the switcher) in front of it there. A web page inside the panel is asked as the panel's own page. Chords, Escape, and the keyboard when a window comes forward ask this, since only the shell knows where it put the panel |
| `reveal()`, `dismiss()` | "show me", "put it away" |
| `summonSwitcher(webContents)` | where the switcher comes up for a chord pressed there, or a page that asked |
| `noticeClicked()` | a desktop notice was clicked: bring the app forward |
| `restart()` | quit and come back: the process is the app's |

What leaves the core for the shell: `panel.window`, `where()`, `windowOf`, giving the keyboard
back to a window when the panel or the switcher goes, putting the switcher in front of the window
it was summoned in, raising a window for a clicked notice. What stays is the panel taking the
keyboard when it comes up or its window comes forward, asked through `showsPanel`, and how a view
is in a window at all, which the window capability offers for any window (`place`: one window at
a time, sized to it, out of it alive before it closes), so a shell says only which window. The Slack build decides the rest; the standalone app, when
it is packaged, writes the same few lines.

## 5. The modules

Each row is the module's whole interface. "Hooks" are what boot hands it.

| module | provides | depends on | hooks |
|---|---|---|---|
| `home/` | `config` (`app/config` over deckit's defaults), the folder, where plugins install | | |
| `log/` | `guard`, `keep`, the log file | home | |
| `keymap/chord.js` | how a chord is written, read and matched; the core's global chords | | |
| `query/` | `match`, `ranker` | | |
| *capabilities* | | | |
| `storage/` | `space(name)` (section 6), the name rule, the reserved space `host` | home | |
| `files/` | making, renaming, moving, trashing a person's file without losing one | | |
| `window/` | `main.js`: a deckit window (frame, place remembered), and a view in any window (`place`: one parent, sized, out before it closes); `bar.js`: the bar, all of it | storage (`host`), log | |
| `web/` | section 7 | storage, window, log | `mayShowFile(space)` |
| `notify/` | `notify({ title, body, silent, onClick })` | log | `clicked()` (the shell's `noticeClicked`) |
| `clipboard/` | `readText()`, `writeText(text)` | | |
| `app/` | `about()`: versions, build, roots; `restart()` | home | `restart()` (the shell's `restart`) |
| *contribution points* | | | |
| `keymap/` | `main.js`: overrides, recording, and routing every keystroke; `view.js`: bindings by scope, collisions, `live(scope)`, `chord(id)`, and a page's side (`connect({ escape })`: its live chords, typing, Escape's order; `publish()` from the page every scope registers in) | storage (`host`), chord, ui (the layers) | scopes (section 8); from the panel, what a keystroke means for it (`answersFor(webContents)`, `escape(webContents)`, `run` for main's own chords) |
| `open/` | `open(url, options)`, `fileURL`, `filePath`, `reveal(path)`, the lines by scheme and their order; in main, `open(page, url, options)` for a page's own window.open; `scheme.js`, what a scheme is | storage (`host`) | handlers (section 8) |
| `switcher/` | `main.js`: its view, opening and closing, and the relay between its page and the panel's; `view.js`: entries from sources, frecency, page searches; `list.js`: the switcher's page, its boot included | panel (its page is the panel's page in another role, and its entries come from the panel's), query, chord, ui | sources (section 8) |
| `panel/` | `main.js`: the page as a view in either role, the panel's verbs (section 4), `presentInWindow`; `view.js`: the screen (sidebar, slot, the screen on show, history, chrome, what Escape means at its last stop), `reveal(id)`; `sidebar.js` | window, open, keymap, ui | the shell's answers (section 4), screens (section 8) |
| `plugin/` | section 9; `view.js` registers what each plugin contributes (section 8) | every capability and contribution point, manifest | |
| `boot/` | `main.js`: `connect`, checking the shell, starting it, `restart`; `view.js`: a page's assembly (panel page or switcher page), the plugin system's registrations, clearing the globals | everything | |

## 6. Storage

`storage.space(name)` is a space under a name the core does not interpret: whose it is, the core
does not know. One name rule for every kind (today the key rule and the jar spelling in
`plugin/data.js`). `host` is reserved for the core's own state.

A space holds four kinds of thing, told apart by what losing one costs and who keeps it:

| kind | what it is |
|---|---|
| `values` | small state that costs a click to lose: a fold, a width, the mode a view was left in |
| `records` | what must not be lost and is the app's to keep: JSON by key, written whole and atomically, a failed write recorded, a change made elsewhere told (`on(key)`) |
| `folder()` | a directory of the space's own, for files a person also keeps by hand (notes) |
| `web(name)` | a web session: cookies and cache, kept across restarts |

Where each is read follows from what it is, not from a rule: `values` lives in a page's own
storage and so is a page's; a `folder()` is the disk and so is main's (a page reaches it through
its main half); `records` and `web` are read on either side. `size()` and `clear()` cover all
four.

The plugin system uses a plugin's id as its space's name. The app's own state (the key map, the
scheme order, window places, the plugin order) is space `host`, read by the module it belongs to,
so `DeckitStore` leaves `plugin/main.js` and nothing below the plugin system leans on it.

## 7. Web

`web/` (it was `page/`: "page" already names the panel's page and the switcher's).

- `web.page({ session, url })`: a web page in an element of the panel, with its delegate
  (`didChange`, `didFocus`, `didRefuseCertificate`, `didReceiveNotification`, `didFind`,
  `didRequestClose`, `decidePermission`, `shouldLeave`, `shouldOpenWindow`).
- `web.window({ session, url, title })`: the same page in a deckit window. The same handle and the
  same delegate, plus `close()` and `didClose`. Only the web: a file is shown in the panel. Its
  windows close with the panel's document that asked for it, since a new document has no delegate
  for them.
- `web.fetchText(url, { session })`: an address read from main, in that session.
- On a session: `trust([{ host, fingerprint }])`, `allow([{ origin, permission }])`, `revoke(...)`,
  `clear()`. What a session trusts and allows holds for the pages in that session and no other.
- Every page is in a session of a space (`context.storage.web(name)`, a partition under the
  space's name). There is no shared session: a page element that names none, or names a partition
  that is not a space's, is refused, so the embedding app's own session is never a page's.

Stays a web capability: the page presented as a browser's (the agent), popups that keep their
opener, certificate and permission requests put to the page's delegate, a page's notices and
capture reported to it, session cookies kept across a restart the way a browser restoring its
session keeps them.

Left the core: `session.signIn(url, { until })`, a flow with one purpose. Calendar, which signs in,
composes it from `web.window` and `didChange`.

`system.files` is not read inside web: whether a page may show a file is the `mayShowFile(space)`
hook boot hands in, which the plugin system answers from a plugin's permissions.

Main's half is split the way a plugin splits a long `main.js`: `web/main.js` (the pages, loads,
state, find, popups, windows) and `web/main/agent.js` (the agent), `session.js` (sessions by
partition, fetching in one, clearing one, cookies kept), `pages.js` (which pages are ours and who
answers for each), `certificate.js`, `permission.js`, `shim.js` (the notice and capture watching
that runs in the page).

## 8. Registration

Each contribution point lists things that, in this app, are plugins. Each takes registrations of a shape
of its own and never asks what registered it.

| contribution point | takes |
|---|---|
| panel | screen `{ id, name, icon, content, sidebar, didAppear, didDisappear }` (`register`), and `onReorder(ids)` when it starts |
| switcher | source `{ id, name, icon, aliases, open, commands, now, resolve, invalid }`; `open` only for a source with a screen |
| keymap | scope `{ id, name, keys, everywhere, invalid }`; the panel's own keys are the scope `host`, live `everywhere` |
| open | handler `{ id, name, schemes, open, invalid }` |

A screen's keys are not part of the screen: they are the key scope of the same id, registered with
the keymap, and the panel only tells the keymap which scope is on screen now. One fact, one
registration.

What went wrong in a registration (an entry with no label, a key with no chord, an `open` that
threw) is told to the `invalid(why)` the registration carries. The plugin system registers for
every running plugin once all are made, in the order they are listed, guards every call into the
plugin it hands over (`commands`, `now`, `didAppear`), and records what goes wrong against the
plugin, where Settings shows it.

## 9. The plugin system

`plugin/` keeps what a plugin is: its folder, manifest, requirements, install, its main half, the
context it is handed, its permissions, its settings, its life (make, ask, tell, failures). It is
split by concept the way a plugin is split:

- `main.js` (the folders and their requirements), `main/install.js`, `main/half.js` (loading a main
  half, its ops and events, what only a restart takes)
- `view.js` (loading, the context, the instances), `view/settings.js`, `view/grant.js` (what each
  permission hands over, and where)
- `manifest.js` as today

It hands a plugin its capabilities (a space, web sessions in it, notices) and registers what the plugin
contributes to the contribution points (its screen, source, key scope, handler), and answers the hooks
(`mayShowFile`, `invalid`).

## 10. What changes for a plugin

Before a release, so changed outright and nothing kept for the old form:

| today | becomes |
|---|---|
| `context.store`, `context.data`, `host.session(name)` | `context.storage = { values, records, web(name) }` |
| a main half's `data` (its data directory) | the main half's `storage`, with `folder()` and `records` |
| `host.plugins.restart()` | the same name, answered by the app's shell |
| `host.page(opts)`, `session.page`, `host.fetchText`, `session.fetchText` | `context.web = { page, window, fetchText }` |
| `host.trustCert`, `host.grant`, `host.revoke` | `trust`, `allow`, `revoke` on a web session, behind the same permissions |
| `session.signIn(url, { until })` | composed by the plugin: `web.window` and `didChange` |
| `host.plugins.refresh(said)`, `said()` | `refresh()`; the line to show after the reload is the caller's to keep (`storage.values`) |

Calendar is the one plugin that signs in. Every plugin that reads `store`, `data` or `session`
changes its reads, bot and dashboard included.

## 11. What leaves the core besides

- Words of one plugin's screen: the sentences that introduce a scheme's line and its last answer
  (`when`, `fallback` in `open/view.js`) go to Settings, and the core says the fact instead
  (`systemAnswer: "browser" | "file" | null`).
- The name of the screen in Settings that orders the schemes: no identifier, comment or document
  of deckit's carries it. The core says `open` and `url-schemes`; `openWith` in `app/config`
  becomes `urlSchemes`.
- Reasons written in terms of one plugin: 111 lines in 16 files justify a core decision by a
  plugin (a calendar's reminders, how Settings draws a list, bookmarks). Each is written again in
  terms of the core's own concepts.
- The contract's second copy: PLUGIN.md is the contract; the header of `panel/view.js` goes.

## 12. Order

By what the rest waits on:

1. **storage**, and the app's own state moved onto space `host`. (Started: `storage/space.js`,
   `storage/main.js` and space `host`; the kinds and `context.storage` are to come.)
2. **The shell** (done): `boot/main.js`, the shell contract of section 4, `windowOf` and the window
   facts to the Slack build, `panel.presentInWindow`, `switcher/main.js`, `restart` to the shell,
   `deckit/shell/` removed.
3. **Registration and boot** (done): panel, switcher, keymap and open take registrations;
   `boot/view.js` assembles the page; the plugin system registers; the direction is checked.
4. **web** (done): renamed, main split, sessions from storage, `trust`/`allow` per session, `signIn` to
   Calendar, no shared session. For a plugin the sessions come as `context.storage.web(name)` beside
   `store` and `data`, which join `context.storage` as `values` and `records` with the rest of step 1.
5. **notify, clipboard, about** (done): out of the panel and the plugin system into capabilities
   of their own, and routing a keystroke out of `panel/main.js` into `keymap/main.js`, which the
   panel tells what the keys mean for it (`connect({ answersFor, escape, run })`).
6. **The plugin system split**, the contract in PLUGIN.md alone, the comments, the names.

Each step ends measured in SlacKit's dev shell, with the deckit archive built and taken into it,
and SlacKit works after each.

## 13. Taken as the default, open to change

- The contract changes outright (section 10), as every change before a release has.
- Trust and permissions hold per web session rather than for the whole app.
- PLUGIN.md is the contract's one copy.
- Keeping session cookies across a restart is what every web session does, not an option.

Settled with the owner (2026-10-08):

- **A page always names a session.** There is no shared session: the Browser's web tabs move to
  the Browser's own, signed out of everything once. A session is always somebody's, and a plugin
  that wants another's sign-ins `requires` it.
- **The layers are folders**, named for which way things go through them: `capability/` and
  `contribution/`, beside `plugin/` and `boot/`. There is no "base": what was in it is taken like
  any capability (home, log, query), and how a chord is spelled is the keymap's.
- **The rules are checked by the build** (`deckit check`), on the module registry.

## 14. Not changed

The plugin folder and manifest, `requires` and `exports`, the permission names, the kit, the
first-party plugins' screens, and what a person sees.

# How an app embeds deckit

Deckit is a library an app embeds, UI included: the panel, the plugin system, the kit and the rest
of the host, and its first-party plugins. Where it is shown is the app's. An app brings a
configuration, a shell, what it offers, and its own plugin. This is the line between the two, as it
is drawn in the code, for any app: what one app puts on its side of it is that app's to write
down.

## 1. What an app embeds

One archive, `deckit-lib-<version>.tgz`, built by the deckit package with its sha256 beside it,
and carried by the app as it was built: the app keeps the archive, never what is in it, and
unpacks it where it builds and runs. The same sources make the same archive, byte for byte, so its
hash is which deckit it is. deckit's own plugins are in it beside the library, and an app that
picks none of them has the library alone.

| in the archive | |
|---|---|
| `deckit.json` | what it is: `version`, the plugin contract it speaks (`api`), the hash of the sources (`source`), each bundle's file and the modules it `defines`, the page, the command line (`cli`), the plugins |
| `registry.js` | the module registry: first in every place deckit runs, and the one global deckit adds |
| `main.js` | the main process |
| `page.js`, `page.html` | the panel's page, and the switcher's, which is the same page in another role: `page.js` is its preload |
| `chord.js` | how a chord is spelled and matched, for a page of the app's that names one of deckit's chords |
| `cli.js` | what deckit's command line asks of the library, in plain Node: deckit's folder, a plugin folder's manifest, installing and removing, how stored things are counted |
| `deckit-cli/` | deckit's command line (`deckit-cli/deckit-cli`): the plugins in deckit's folder, for the app's own command line to run rather than doing their jobs again (section 1) |
| `plugin/<id>/` | deckit's own plugins, each the folder it is: a catalog, from which the app picks the ones it ships and installs them with its own |
| `document/` | the plugin contract (PLUGIN.md), the kit (UI.md), and this |

In each place it runs, the app loads, in this order: `registry.js`; what it hands deckit
(`app/config` everywhere, `app/exports` in the page), and whatever of its own those use, which
can be only its own, since nothing of deckit's is there yet; the bundle for that place; and then
what of its own uses deckit there. In main that last is the shell, which calls
`connect({ assets, shell })` (section 2). In the page it is starting deckit, once every file has
run: `DeckitModule.use(["deckit/feature/app/view"], (boot) => boot.boot(before))`, `before` being
the names the page's global object had before `registry.js` ran, so boot can take away every
global the bundles added. A page of the app's own that spells one of deckit's chords loads
`registry.js` and `chord.js`, and nothing else of deckit's.

One bundle to a place, besides the registry: bundles overlap on purpose (how a chord is spelled,
how a key is counted, what a scheme is, are in every one that needs them, so every place says them
the same way), and a module defined twice stops the script that defines it.

The bundles carry no name of their own (no `sourceURL`): an app may join them to its own code in
one script, and the last name given in a script names all of it, so naming them is the loader's.

The app's command line does not load deckit's files itself: it runs
`node deckit-cli/deckit-cli --config <its app/config file> [--ship <plugin folder>]... <command>`,
which loads them in that same order and does what is asked of the plugins in deckit's folder:
`where`, `list`, `install <folder>...`, `remove <id> [--data]`, `ship` (the plugins the app ships,
`--ship`, by the rule a removed one stays removed by), `restore <id>...`, `new <id> --in <folder>
[--main]`, `manifest <folder> [<field>]`, `data [<folder>]`. `deckit-cli` alone lists them.

A module of the app's names deckit's by the names the bundle `defines` (deckit.json says them, each
with the names it provides), so the app can check its own files against the archive as deckit
checks its own. The app's own files are modules the same way: `define(name, { uses, provides },
make)`, and what `app/config` and `app/exports` make is held to what they say they provide
(`registry.js`). `app/config` sets only what section 3 lists: a setting deckit does not read stops
the bundle, said as one.

## 2. The page and the shell

Deckit makes the panel: one page in a view, with the plugins, the switcher and the keyboard in
it. Where that view is shown is not deckit's question. The app's **shell** answers it, the way a
browser decides whether a page goes in a tab or a window while the page stays the same page.
There is no shell of deckit's own: every app that shows deckit brings one, and none is special.
One may lay the panel over the app's own window, in its colours, and move it out to a window of
its own and back; an app packaged for deckit alone would put it in a window and keep it there
(section 5).

Moving the panel is a re-parent, never a rebuild, so plugins keep their pages and their half-typed
text, and no plugin is told where the panel is.

The contract, in main (deckit's entry there, `deckit/feature/app/main`: `connect({ assets, shell })`,
once, before the app is ready):

| | |
|---|---|
| what the app gives | `assets`, how deckit's page is loaded: `{ preload, load(webContents), sandbox }` (`page.html` with `page.js` as its preload, by whatever scheme the app serves its files over), and `shell` |
| what a shell answers | `start(deck)` once the app is ready, with what it drives (the only way it gets it); `showsPanel(webContents)`, whether the panel is what is on screen where a keystroke landed (a web page a plugin shows in the panel arrives as the panel's own webContents; the switcher's page never counts as the panel); `reveal()` for "show me" (a plugin's `host.show()`, a switcher choice); `dismiss()` for "put it away" (Escape with nothing else to close); `summonSwitcher(webContents)` for the switcher's chord; `noticeClicked()`; `restart()` |
| what `deck.panel` does | `view()`, built on first use, which the shell puts in a window (`place`); `show()`, for a view the shell has already placed; `hide()` (waits for the page's exit, and says whether the panel had the keyboard); `leave()` and `arrive()`, the exit and the entrance around a move the shell makes (`leave()` resolves false when the move is called off because the panel was put away meanwhile); `shown()`, `focus()`; `present({ floating, dismissible })`; `setTheme`; `presentInWindow({ key, title, boundsKey, onClose })`, resolving to the window, or null when called off, with `onClose` run once the window is gone |
| what `deck.switcher` does | `view()`, which the shell puts in front where it was summoned; `open()`, resolving true when the switcher was put away (the shell gives the keyboard back) and false when the keyboard went elsewhere; `close()`, `shown()`, `chord()` |

Which window anything is in is the shell's alone, since the shell put it there. Deckit asks it
where a keystroke counts as the panel's (`showsPanel`, for chords, Escape and the keyboard when a
window comes forward), and leaves it what follows from a window: putting the switcher in front of
the window it was summoned in, giving the keyboard back to a window when the panel or the switcher
goes, and bringing the app forward for a clicked notice. How a view is in a window, any window, is
deckit's to offer: `place(view, window, { bounds, front, onClose })` in the window module puts it
in one window at a time, sizes it to the window or to `bounds`, and takes it out alive before the
window closes, so a shell says only which window.

`presentInWindow` is deckit's because three facts hold between the panel and a deckit window: the
bar's height over the page reaches the panel's page as its inset, so a plugin steps out from under
it; the window is glass because the panel is; and the view is out of the window before the window
takes it down. Whether to show the panel in a window, and when, is the app's.

`present` is all the page learns of where it is: whether it floats over something (rounded and
ringed) or fills a window, and whether Escape with nothing else to close puts it away. The panel
draws no way to anywhere else, and has no key of its own to bring it up. Both are the app's to
offer through its own plugin (section 4): a command in the switcher, worded for where the panel is
now, and a key declared `global`, which works wherever the keyboard is in the app (PLUGIN.md).

The glass is the panel's alone and the same everywhere; what lies under it is the place's. Over an
app's window, whatever the app lays under the panel (a shade, a blur) does; in a window, the
window's own material (vibrancy) does, and a shade laid under the glass there as well makes it a
layer thicker than over the app. The material is the one choice there is: macOS lets an app pick a
material but not its blur or tint, and the window-background ones (`under-window`) tinted enough
that the glass over them read as solid, so a glass window uses `hud`, the lightest tint of them
all when measured, and dark in any appearance.

Whether the panel is up is the core's to hold: only the panel's own verbs change it, and each
tells the page in the same step, so what the shell believes and what is on screen cannot part.

What stays deckit's wherever the panel is: Escape's order (a dialog, then the field being typed
in, then the panel), plugin chords and the switcher's, which only main hears, the switcher's page
and its entries, notifications, and the panel taking the keyboard when it comes up or its window
comes forward.

## 3. The configuration

Said once, first in every process, before anything asks: `app/config`, read by
`service/home/model/config.js`, which fills in deckit's own for anything left out:

| | what it is | deckit's own |
|---|---|---|
| `id` | the data folder (`~/.config/<id>`), the store's keys, the web sessions, the log, and the id of the app's own plugin (section 4) | `deckit` |
| `name` | what a person reads | `Deckit` |
| `restore` | how a removed plugin the app ships comes back other than by installing its folder again (its command line), with `{id}` where the plugin's id goes | none |
| `agent` | what the app adds to the user agent, hidden from the pages plugins show | none |
| `openWith` | by scheme, the plugins asked first in that line until the person orders Open With | none |

No plugin may take `host` (`service/plugin/model/manifest.js`, `idProblem`). The app's id is a plugin id
like any other, and the plugin that has it is the app's own (section 4).

What the app's build is, for the person who asks (about): `<id>-build.json` beside `main.js` as
the app ships it, `{ version, builtAt, source }`, written by the app's build. Without one (an app
run from its sources), those read as nothing.

## 4. What the app offers, and its own plugin

What a person does with the app from the panel is a plugin, the app's own: the one whose id is the
app's (`id` in `app/config`), shipped with the app and removable like any other. That is all that
sets it apart. It alone is handed what the app offers (`app/exports`) as `context.app`
(`service/plugin/client.js`), and it exports that again, unchanged, so a plugin that wants the app asks
for it the way it asks for any plugin, `requires = { <the app's id> = "1.0.0" }`, and receives it
as `context.requires.<the app's id>`, through the same check of installed, loaded and version.
There is no other way in: in another app a folder with that id is not the app's plugin and is
handed nothing, so its `make()` should say so and throw, and a plugin that requires it does not
start either and Settings says why.

It may stand first in an Open With line (`openWith` in `app/config`, and the scheme in its
manifest's `url-schemes`): it opens the addresses it knows and passes on the rest. Deckit does not
ask whose an address is; it opens addresses, and a plugin that knows some of them opens those.

Removed, what it did is gone and the panel stays where the shell put it: that is the shell's, not
a plugin's.

## 5. A deckit of its own

An app with nothing of another app's in it: the archive embedded the same way, a configuration
(its own id and name, so its data never meets another app's), `assets`, how its page is loaded, and a
shell that shows the panel in a window (`deck.panel.presentInWindow`, brought back by the Dock
when it is closed) and the switcher in front of it. Deckit's plugins go with it unchanged. None of
it is written yet: the app, its own Electron, its name and icon, a command line that builds and
installs it.

## 6. What this does not do

- It does not make deckit work without Electron, or move plugins off the `context` they have.
- It does not let a plugin be the shell. The shell is there before the panel, and plugins live in
  the panel.
- It does not show deckit in two places at once (over an app's window and in a window of its own). There is one panel,
  wherever the shell puts it.

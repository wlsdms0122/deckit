# deckit

A library a host app embeds to take mods, the way a game does. It runs mods and composes what they add to the app: views, commands, keys, URL scheme handlers, libraries for other mods, extensions of what other mods do, new looks for their pages and work in the app's main process. It is three layers: deck, the engine, which knows nothing of a screen; deckit, the platform on deck (the web, windows, keys, commands, opening addresses, main process modules); and a shell, the surface a person uses. Deckit's own shell is the panel and the kit mods draw with; deckit runs its mods whether or not a host app puts it on, so a host app may leave it off. Deckit has its own mods too (Switcher, Editor, Finder, Notes, Browser, Calendar, Bot, Settings, and Deckit, which offers what a person asks of deck itself in the switcher). Where the panel is shown is the host app's. Deckit.app is deckit embedded by itself.

Deckit is `source/deckit` and the documents it ships, whole by itself. This package around it, `manifest.toml` and `source/cli`, is the commands below, which check, build, run and ship it.

## Building

```
source/cli/deckit build
```

writes `.build/deckit-<version>.tgz`, with its sha256 beside it: the bundles of deck and deckit and of the shell, the core (built with Swift 6.3 or later), `deckit.json`, the documents a host app reads, and deckit's own mods, each with its entry bundled. It is what a host app embeds ([document/EMBEDDING.md](document/EMBEDDING.md)). The same sources, built with the same Swift, make the same archive, byte for byte.

```
source/cli/deckit build app
```

makes `.build/Deckit.app` from it too, the way any host app embeds it. Deckit keeps its folder in `~/.config/deckit`; where its windows were left is in `~/Library/Application Support/Deckit`, and what its pages and the sites they show store is WebKit's, in `~/Library/WebKit/dev.deckit.app`.

## Commands

`source/cli/deckit`, run with no command, lists its commands and what each takes.

`test` runs the app in the background, with data of its own that it throws away, so it never takes the screen or touches `~/.config/deckit`. It leaves screenshots and the app's log in `.build/test/`; `--port` picks the DevTools port when another test is running.

`resize` is for a person's drag: `deckit dev --inspect=9445`, then `deckit resize start 9445`, drag the window's edge, and `deckit resize stop 9445` tells how often the window was resized, how often each page drew, and how far each page as wide as the window trailed it. A resize made in code does not wait on the pages the way a drag does.

`manifest.toml` lists them for open-package, but for `engine` and `resize`, which are for work on deckit itself.

## Documents

- [ARCHITECTURE.md](document/ARCHITECTURE.md): how deckit is built, and why
- [EMBEDDING.md](document/EMBEDDING.md): what a host app embeds, and how
- [MOD.md](document/MOD.md): writing a mod: the manifest, what a mod registers and what `deck` gives it
- [UI.md](document/UI.md): the kit mods draw with, part by part
- [GUIDELINES.md](document/GUIDELINES.md): what shape a mod takes and where its features go: its view, the sidebar, the switcher, keys, settings and notifications

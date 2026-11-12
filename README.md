# deckit

A library a host app embeds to run mods. A mod is what a person adds to the app: a window or a view, keys, what it declares to other mods' interfaces, exports for the mods that use it, a new look for other mods' pages and work in the app's main process. Deckit is built in layers: the environment, the driver, which deck and deckit run on in Electron; deck, the kernel, which runs principals' jobs in sandboxes and knows no mod; Deckit, the system services and policy: what a mod is, installing it, which mods launch and when, and the platform services a mod reaches; the system mods, the services, which provide commands, keys, configuration, opening addresses and notifications as interfaces; and the Deckit Shell, the desktop: the mods' windows, the Dock and the kit mods draw with. Deckit runs its mods whether or not a host app attaches the shell. Deckit has its own mods too (Switcher, Editor, Finder, Notes, Browser, Calendar, Bot, Forge, Notifications, Mods, Packages, Settings, Commands, Configuration, Keymap, URLs, and Deckit, which offers what a person asks of deckit itself in the switcher). Where the desktop is shown is the host app's. Deckit.app is deckit embedded by itself.

Deckit is `source/deckit` and the documents it ships, whole by itself. This package around it, `manifest.toml` and `source/cli`, is the commands below, which check, build, run and ship it.

## Building

```
source/cli/deckit build
```

writes `.build/deckit-<version>.tgz`, with its sha256 beside it: the bundles of the environment and of deckit-shell, the core (built with Swift 6.3 or later), `deckit.json`, the documents a host app reads, and deckit's own mods, each with its entry bundled. It is what a host app embeds ([document/EMBEDDING.md](document/EMBEDDING.md)). The same sources, built with the same Swift, make the same archive, byte for byte.

```
source/cli/deckit build app
```

makes `.build/Deckit.app` from it too, the way any host app embeds it. Deckit keeps its folder in `~/.config/deckit`; where its windows were left is in `~/Library/Application Support/Deckit`, and what its pages and the sites they show store is WebKit's, in `~/Library/WebKit/dev.deckit.app`.

## Commands

`source/cli/deckit`, run with no command, lists its commands and what each takes.

`test` runs the app in the background, with data of its own that it throws away, so it never takes the screen or touches `~/.config/deckit`. It leaves screenshots and the app's log in `.build/test/`; `--port` picks the DevTools port when another test is running.

`style` reads the CSS deckit writes, in its scripts' templates and the styles they set from code, and holds it to the rules of its look: colours from the token, motion only of what does not lay the page out, no capitals or wide tracking under 16px, no stripe down one side, no glow, no text under 11px, a border or a wide shadow but not both, and the kit's layers rather than a z-index of its own. Each problem is a line, its file, its line and its rule; the places whose job is a colour written out are listed in it, each with why.

`resize` is for a person's drag: `deckit dev --inspect=9445`, then `deckit resize start 9445`, drag the window's edge, and `deckit resize stop 9445` tells how often the window was resized, how often each page drew, and how far each page as wide as the window trailed it. A resize made in code does not wait on the pages the way a drag does.

`manifest.toml` lists them for open-package, but for `engine` and `resize`, which are for work on deckit itself.

## Documents

- [ARCHITECTURE.md](document/ARCHITECTURE.md): how deckit is built, and why
- [EMBEDDING.md](document/EMBEDDING.md): what a host app embeds, and how
- [MOD.md](document/MOD.md): writing a mod: the manifest, what a mod registers and what its handles give it
- [UI.md](document/UI.md): the kit mods draw with, part by part
- [GUIDELINES.md](document/GUIDELINES.md): what shape a mod takes and where its features go: its view, the sidebar, the switcher, keys, settings and notifications

# deckit

A panel of plugins, as a library an app embeds, UI included: the panel and the quick switcher, the
plugin system, the kit plugins draw with, and deckit's own plugins (Settings, Notes, Editor,
Finder, Browser). Where the panel is shown is the app's: over another app's window, in a
window of its own, moved between the two. SlacKit, which puts it into Slack, is one such app.

## What it builds

```
open-package build
```

writes into `.build/`:

- `deckit-lib-<version>.tgz`, with its sha256 beside it: the library (its bundles, its page,
  `deckit.json`, the documents whoever builds on it reads) and deckit's own plugins beside it, as a
  catalog an app picks from. It is what an app embeds: the app keeps the archive as it is and
  unpacks it where it builds and runs. How an app loads it, and what it hands deckit, is
  [document/EMBEDDING.md](document/EMBEDDING.md), which the archive carries too. The same sources
  make the same archive, byte for byte, so its hash is which deckit it is.

`open-package app` then makes `.build/Deckit.app` from that archive, the way any app embeds it:
deckit on its own, one window with the panel in it (Electron 44.4.5, `dev.deckit.app`, signed ad
hoc). Its data is in `~/.config/deckit`, and it installs the plugins it ships at every launch.

A change to deckit is tried in Deckit.app (`open-package dev`, which runs it from the sources and
starts it again when one changes) and in an app that embeds it: build, and give that app the new
archive (SlacKit: `slackit deckit <archive>`).

## Commands

```
open-package build             deckit-lib, into .build/
open-package app               Deckit.app, into .build/, from the archive the last build made
open-package run check         hold the files to how they reach each other (check alone is the runner's own)
open-package dev               Deckit.app from the sources, its data in .dev/, built again when one changes
open-package install           Deckit.app into /Applications, as open-package app last made it
open-package plugins <id>…     a plugin Deckit ships, brought back after it was removed
open-package engine <plugin>   build the Editor's or the Notes' editing engine again (editor, note)
```

## Documents

- [ARCHITECTURE.md](document/ARCHITECTURE.md): how deckit is built, and why
- [EMBEDDING.md](document/EMBEDDING.md): what an app embeds, and how
- [PLUGIN.md](document/PLUGIN.md): the plugin contract
- [UI.md](document/UI.md): the kit
- [CORE.md](document/CORE.md): how the core is being restructured
- [STRUCTURE.md](document/STRUCTURE.md): what deckit builds, and what its modules are made of (the target)

# deckit

A plugin library a host app embeds. Its core, deck, runs plugins and composes what they add to the app: views, commands, keys, URL scheme handlers, libraries for other plugins and work in the app's main process, the way mods add to a game. On deck it gives basic views (the panel, the quick switcher, the kit plugins draw with) and its own plugins (Editor, Finder, Notes, Browser, Settings). Where the panel is shown is the host app's. Deckit.app is deckit embedded by itself.

## Building

```
source/cli/deckit build
```

writes `.build/deckit-lib-<version>.tgz`, with its sha256 beside it: the library's bundles, its page, `deckit.json`, the command line for plugins (`deckit-cli/`), the documents a host app reads, and deckit's own plugins, each with its entry bundled. It is what a host app embeds ([document/EMBEDDING.md](document/EMBEDDING.md)). The same sources make the same archive, byte for byte.

```
source/cli/deckit app
```

then makes `.build/Deckit.app` from that archive, the way any host app embeds it. Its data is in `~/.config/deckit`.

## Commands

```
source/cli/deckit build            deckit-lib, into .build/
source/cli/deckit app              Deckit.app, into .build/, from the archive the last build made
source/cli/deckit check            hold every file to how the library is laid out
source/cli/deckit dev              Deckit.app from the sources, its data in .dev/, built again when one changes
source/cli/deckit install          Deckit.app into /Applications, as the last app command made it
source/cli/deckit plugins <id>…    a plugin Deckit ships, brought back after it was removed
source/cli/deckit engine <plugin>  build the Editor's or the Notes' editing engine again
```

`manifest.toml` lists the same commands for open-package.

## Documents

- [ARCHITECTURE.md](document/ARCHITECTURE.md): how deckit is built, and why
- [EMBEDDING.md](document/EMBEDDING.md): what a host app embeds, and how
- [PLUGIN.md](document/PLUGIN.md): the plugin contract
- [UI.md](document/UI.md): the kit plugins draw with

# Mods

Every mod you can open, in one place: each installed app mod, with its icon and name, in the mods' order, the running ones marked. Typing finds a mod by its name and its keywords, best first, and Enter opens the first. Picking one opens it: it launches when it does not run, and its windows come in front. Its menu keeps it in the Dock or takes it out.

The Dock at the desktop's left edge holds only the mods kept there and the ones running; this is where the rest are found. It reads the mods as the shell's Dock lists them, `shell.mods.list()`, opens one with `shell.mods.open(id)` and keeps one with `shell.mods.setPinned(id, pinned)`, and draws them again as `deckit.mods.onChange` tells that they may have changed, all under `deckit.mods` ([MOD.md](../../../../document/MOD.md), shell).

It is opened from the Dock, where the host app keeps it from the first start, from the Switcher's action Show All Mods, or by its command `show`. A host app may ship another mod in its place: nothing else depends on it.

## Commands

Declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports Mods opens for its id in `start`. Show All Mods is declared to `switcher/actions` too, running `show`.

| Command | Title | What it does |
|---|---|---|
| `show` | Show All Mods | brings Mods' window in front, opening it again where it was closed |

Mods opens its window in `attach`, and again from `reopen()` as its Dock item is pressed while the window is closed. `show` opens it with the handle `attach` is given, so it works once `attach` has run on the same run; run before that, or on a host with no shell, it fails, saying so.

## Permissions

| Permission | Why |
|---|---|
| `deckit.mods` | lists every mod you can open, opens the one you pick, and keeps one in the Dock or takes it out |

# Mods

Every mod you can open, in one place: each installed mod that declares a view, with its icon and name, in the mods' order, the running ones marked. Typing finds a mod by its name and its keywords, best first, and Enter opens the first. Picking one opens it: it launches when it does not run, and comes on screen in the panel. Its menu keeps it in the Dock or takes it out.

The Dock in the panel's sidebar holds only the mods kept there and the ones running; this is where the rest are found. It reads the mods as the shell's Dock lists them, `shell.mods.list()`, opens one with `shell.mods.open(id)` and keeps one with `shell.mods.setPinned(id, pinned)`, and draws them again as `deckit.mods.onChange` tells that they may have changed, all under `deckit.mods` ([MOD.md](../../../../document/MOD.md), shell).

It is opened from the Dock, where the host app keeps it from the first start, from the Switcher's action Show All Mods, or by its command `show`. A host app may ship another mod in its place: nothing else depends on it.

## Commands

Declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports Mods opens for its id in `start`. Show All Mods is declared to `switcher/actions` too, running `show`.

| Command | Title | What it does |
|---|---|---|
| `show` | Show All Mods | asks the shell to put Mods on screen (`shell.show()`) |

`shell.show()` is on the handle `attach` is given, so `show` puts Mods on screen once `attach` has run on the same run; run before that, or on a host with no shell, it fails, saying so.

## Permissions

| Permission | Why |
|---|---|
| `deckit.mods` | lists every mod you can open, opens the one you pick, and keeps one in the Dock or takes it out |

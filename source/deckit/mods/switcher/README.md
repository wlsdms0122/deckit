# Switcher

A list over the app you are in, opened on its key from any app: each mod the app can show, to show the one you pick, and what other mods add to it. It runs in the background from the start, so its key opens it as soon as the app opens.

## Adding actions: `switcher/actions`

Switcher defines the interface `switcher/actions`, and provides its major 1. A mod gives actions by using it: while the interface's owner speaks major 1, the mod is connected to it, and since its exports open in `attach`, the mod hands its actions over in `attach`, with `onConnect`. They are `setActions(actions)`, one set of actions for each connection, listed under the connected mod. A mod that provides `switcher/actions` and is pinned in Settings takes the actions in the Switcher's place. It gives no place for views.

```toml
[interfaces]
uses = { "switcher/actions" = 1 }
```

```js
deckit.dependencies.onConnect('switcher/actions', (switcher) => {
    switcher.setActions({ list, now, search, run });
});
```

An action is data, and what it does is `run(value)`, given the `value` the mod knows it by, any value JSON holds. Setting actions again replaces them, and they go as the connection ends.

| Member | What it is |
|---|---|
| `list()` | the actions listed under the mod, after a Show item for each mod the shell can show |
| `now()` | the actions on top until something is typed, three in all, taken a round at a time across mods |
| `search(query, within)` | what is typed: `search(query, null)` answers the actions above the ranked list, and its `fallback` actions go below it. An action with `opens` opens a list of its own, which the switcher fills with `search(query, value)` as the person types, for the next arg. A `search` answers null when a newer one has taken its place, and nothing is drawn for it |
| `run(value)` | runs the picked action. Text it answers shows under the switcher's list, and a throw says why it did not run there |

An action, as the first three answer it:

| Field | What it is |
|---|---|
| `label`, `hint` | its text, and a line beside it. An action with no `label` is left out |
| `icon` | a kit icon string. An action with none shows no icon, but on the Now strip, where it shows its mod's |
| `group` | the group it is listed in under the mod, whose name it is found by too |
| `tone` | `info`, `ok`, `warn` or `alert` |
| `attention` | asks for the eye once |
| `fallback` | from `search`, listed below the ranked list |
| `keywords` | more words it is found by |
| `value` | what `run` is given. An action with none is read only |
| `opens` | it opens a list of its own (`search(query, value)`) |

The picked action's row shows it running, then done or failed. The list stays until the keyboard leaves it, and a throw that comes once it has gone is posted to `deckit/notifications` (MOD.md, Standard interfaces), with nothing to bring forward, or only logged while no mod owns it. Whether the mod comes on screen is its own to ask, with its window's `orderFront()` ([GUIDELINES.md](../../../../document/GUIDELINES.md), The switcher): the shell putting it on screen takes the keyboard from the switcher, which goes. The switcher ranks what was picked before by the mod and the `value`, so an action keeps one `value`.

## Declaring actions

An action that is there whether the mod runs or not is declared in the mod's manifest, one `[[contributes."switcher/actions"]]` table for each, and the mod need not use the interface. It runs a command the mod declares to `deckit/commands` (see the Commands mod), `command` with `args`, which may be left out; one that names no command is read only. The switcher lists the declared actions under the mod after those it set, each time it opens, and picking one runs its command through `deckit/commands` (`run(mod, command, args)`), which launches the mod if it does not run. While no mod provides `deckit/commands`, picking one says so.

```toml
[[contributes."deckit/commands"]]
id = "show-log"
title = "Show Log"

[[contributes."switcher/actions"]]
label = "Show Log"
keywords = ["finder", "reveal"]
command = "show-log"
```

A declared action has the fields of one set over a connection but `value`, `opens` and `fallback`: `label`, `hint`, `icon`, `group`, `tone`, `attention` and `keywords`, then `command` and `args`, a table that fits the command's `params` (`{}` left out). It is listed, and found as the list is, but is never among the Now actions or what `search` answers.

## The mods to show

The Show items are the mods the shell's Dock lists, every app mod (`shell.mods.list()`), and picking one puts it on screen as the person opens it (`shell.mods.open(id)`), which launches it if it does not run. Each section is named by its mod's name, its manifest's as `deckit.mods.list()` answers it, or by its id for one that does not load. All three are under `deckit.mods`.

## Commands and keys

Declared in the manifest to `deckit/commands` and `deckit/keys` (see the Commands and Keymap mods), and run from `runCommand(id, args)` in the exports the Switcher opens for its id in `start`:

| Command | Title | Key | What it does |
|---|---|---|---|
| `show` | Show Switcher | ⌥Space, in every app | opens the list, and leaves it open when it is |

The list is made in `attach`, and its window opens as it shows, so `show` opens the list only once `attach` has run on the same run; run before that, or on a host with no shell, it fails, saying so.

## Permissions

| Permission | Why |
|---|---|
| `deckit.mods` | lists each mod the app can show, and shows the one you pick |
| `deckit.system-services` | runs the command of an action a mod declares, which launches the mod if it does not run |
| `system.overlay-windows` | its window floats over the app you are in |

# Switcher

A list over the app you are in, opened on its key from any app: each mod the app can show, to show the one you pick, and what other mods add to it.

## Adding actions

A mod adds actions as an optional dependency and hands them over in `attach`. Switcher opens `setActions(actions)` in `attach`, one set of actions for each connection, listed under the connected mod:

```toml
[dependencies]
switcher = { version = "1.0.0", optional = true }
```

```js
deckit.dependencies.onConnect('switcher', (switcher) => {
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
| `icon` | a kit icon string |
| `group` | the group it is listed in under the mod, whose name it is found by too |
| `tone` | `info`, `ok`, `warn` or `alert` |
| `attention` | asks for the eye once |
| `fallback` | from `search`, listed below the ranked list |
| `keywords` | more words it is found by |
| `value` | what `run` is given. An action with none is read only |
| `opens` | it opens a list of its own (`search(query, value)`) |

The picked action's row shows it running, then done or failed. The list stays until the keyboard leaves it, and a throw that comes once it has gone is told in a notification. Whether the mod comes on screen is its own to ask, with `shell.show()` ([GUIDELINES.md](../../../../document/GUIDELINES.md), The switcher): the shell putting it on screen takes the keyboard from the switcher, which goes. The switcher ranks what was picked before by the mod and the `value`, so an action keeps one `value`.

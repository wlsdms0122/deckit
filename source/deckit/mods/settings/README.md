# Settings

Where the app is set up: the mods (installing, removing, restarting, pinning, their order), what runs and what starts with the app, each mod's settings, the keys, which mod opens an address first, which mod owns an interface, and the fonts.

## Activity

Every mod running now, with a view or without: its run's state, why it runs (opened by you, started with the app, required by another mod, or the work another mod asked of it: a connection, a command, a key, an address), how long it has run, and what is wrong with it, with a quit and a restart. One that owns an interface links to the Interfaces section. Under them, the startup list: each mod whose manifest asks to start with the app, with its reason and a switch approving it (`deckit.mods.approveStartup`). A mod switched off starts only when something opens it. What deckit refuses is told on the mod's row.

## Interfaces

Each interface a mod provides or uses, with its owner and the mods that provide it, in their queue: the earliest to provide it first, each with the majors it speaks. The mods that use the interface reach its owner, the one pinned or else the first in the queue. Its menu says Automatic while no one pinned one, and pins a provider that loads and provides it now, or clears the pin: one kept in the queue with a problem keeps a pin it holds and cannot be pinned anew. A pin deckit refuses is told on its card. A mod's row shows the interfaces it uses, with their owners, and says why one reaches no one.

## Adding buttons: `settings/buttons`

Settings defines the interface `settings/buttons`, and provides its major 1. Its exports open in `attach`, so a mod uses it and hands its buttons over in `attach`, with `onConnect`. They are `setButtons(buttons)`, one set of buttons for each connection, shown on the connected mod's settings. It gives no place for views.

```toml
[interfaces]
uses = { "settings/buttons" = 1 }
```

```js
deckit.dependencies.onConnect('settings/buttons', (settings) => {
    settings.setButtons({ list, run });
});
```

A button is data, and what it does is `run(value)`, given the `value` the mod knows it by, any value JSON holds. Setting buttons again replaces them, and they go as the connection ends.

| Member | What it is |
|---|---|
| `list()` | `[{ button, hint, after, value }]`: buttons on the mod's settings, `button` its text and `hint` a line under it, each after the configuration whose key is `after`, or at the end when no configuration has that key |
| `run(value)` | runs the button pressed. Text it answers shows under its button |

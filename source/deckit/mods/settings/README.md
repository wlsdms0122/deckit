# Settings

Where the app is set up: the mods (installing, removing, restarting, pinning, their order), each mod's settings, the keys, which mod opens an address first, which mod owns an interface, and the fonts.

## Interfaces

Each interface a mod provides or uses, with its owner and the mods that provide it, in their queue: the earliest to provide it first, each with the majors it speaks. The mods that use the interface reach its owner, the one pinned or else the first in the queue. Its menu says Automatic while no one pinned one, and pins one provider or clears the pin. A pin deckit refuses is told on its card. A mod's row shows the interfaces it uses, with their owners, and says why one reaches no one.

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

# Settings

Where the app is set up: the mods (installing, removing, restarting, pinning, the load order), each mod's settings, the keys, which mod opens an address first, which mod implements an interface, and the fonts.

## Interfaces

Each interface a mod implements or depends on, with its implementations in their order. The first that is on is the one picked, and the mods that depend on the interface get it: drag to change the order, switch one off to pass it over. An interface whose implementations no one placed is marked Undecided until one is dragged into place. An order deckit refuses, one whose pick would make a cycle, is told on its card.

## Adding buttons: `settings/buttons`

Settings defines the interface `settings/buttons`, and implements it at `1.0.0`. Its exports open in `attach`, so a mod names it as an optional dependency and hands its buttons over in `attach`, with `onConnect`. They are `setButtons(buttons)`, one set of buttons for each connection, shown on the connected mod's settings. It gives no place for views.

```toml
[dependencies]
"settings/buttons" = { version = "1.0.0", optional = true }
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

# Settings

Where the app is set up: the mods (installing, removing, restarting, pinning, the load order), each mod's settings, the keys, which mod opens an address first, and the fonts.

## Adding buttons

A mod adds buttons to its settings as an optional dependency and hands them over in `attach`. Settings opens `setButtons(buttons)` in `attach`, one set of buttons for each connection:

```toml
[dependencies]
settings = { version = "1.0.0", optional = true }
```

```js
deckit.dependencies.onConnect('settings', (settings) => {
    settings.setButtons({ list, run });
});
```

A button is data, and what it does is `run(value)`, given the `value` the mod knows it by, any value JSON holds. Setting buttons again replaces them, and they go as the connection ends.

| Member | What it is |
|---|---|
| `list()` | `[{ button, hint, after, value }]`: buttons on the mod's settings, `button` its text and `hint` a line under it, each after the configuration whose key is `after`, or at the end when no configuration has that key |
| `run(value)` | runs the button pressed. Text it answers shows under its button |

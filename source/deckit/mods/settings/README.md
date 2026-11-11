# Settings

Where the app is set up: the mods (installing, removing, restarting, pinning), what runs and what runs in the background, each mod's settings, the keys, which mod opens an address first, which mod owns an interface, and the fonts.

```toml
[interfaces]
provides = { "settings/buttons" = [1] }
uses = { "deckit/commands" = 1, "deckit/configuration" = 1, "deckit/keys" = 1, "deckit/urls" = 1, "switcher/actions" = 1 }
```

Its Keyboard, URL Schemes and Mod Settings sections act on every mod through the system's services, `deckit/keys`, `deckit/urls` and `deckit/configuration` (see the Keymap, URLs and Configuration mods), with `deckit.system-services`. Settings holds each while it is connected (`deckit.dependencies.onConnect`); while one is not, its section lists nothing, and Mod Settings says it cannot read the settings.

## Mods

Every mod found, in the mods' order, whether it loads or not (`deckit.mods`): its version, what its manifest contributes (a view in another mod's window, commands, keys, settings, the addresses it opens, the interfaces it provides) and, while it runs, the styles it lays on pages, with a restart, its folder revealed, and a removal for one installed. A mod is installed from a folder picked or dropped on the section, once you agree to the permissions it asks for, to running in the background where it asks to, with its reason, and to what it replaces. An opened row shows the interfaces it uses and what each reaches, whether a view shown in another mod's is kept in the Dock too (`shell.mods`), its permissions, where it stands in the turn of each scheme it opens, its keys, and its folder with what it stores. What the services of `deckit/commands`, `deckit/configuration`, `deckit/keys` and `deckit/urls` leave out of what a mod declares to them (each `list()`'s `refused`) is told on its row, with the interface. When a main process module keeps running what a mod no longer is, a notice asks to restart the app.

## Activity

Every mod running now, an app or not: its run's state, how long it has run, and what is wrong with it (its run's problem, what its launch was refused with), with a quit and a restart. One that owns an interface links to the Interfaces section. Under them, each mod whose manifest asks to run in the background (`background`), with its reason. What deckit refuses is told on the mod's row.

## Interfaces

Each interface a mod provides or uses, with its owner and the mods that provide it, in their queue: the earliest to provide it first, each with the majors it speaks. The mods that use the interface reach its owner, the one pinned or else the first in the queue. Its menu says Automatic while no one pinned one, and pins a provider that loads and provides it now, or clears the pin: one kept in the queue with a problem keeps a pin it holds and cannot be pinned anew, and one kept and not found is listed by its id. A pin deckit refuses is told on its card.

## Mod Settings

A card for each mod that declares a setting to `deckit/configuration` (`list()`), a control for each, and a change set through `setOf(mod, key, value)`. A setting is drawn from its entry: a toggle for a `boolean`, its `oneOf` as choices, a stepper for a `number`, and a field for a `string`, with the hints its entry carries beside what Configuration reads:

| Field         | What it is                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `placeholder` | the text an empty field shows                                                                                   |
| `unit`        | the word after a number                                                                                         |
| `step`        | how much a number steps by. Left out, 1                                                                         |
| `inherits`    | for a `number` with no `default`: the theme's number it reads as while it is unset, `textSize`                  |
| `choices`     | for a `string`: the kit's list it takes its choices from, `textFonts` or `monospacedFonts`, in place of `oneOf` |

A mod's buttons (`settings/buttons`, below) are on its card too.

## URL Schemes

A card for each scheme `deckit/urls` lists, with the mods that open its addresses in the turn they are offered one, and what opens it outside the app after them. Its menu chooses what opens the scheme (`choose(scheme, choice)`): Automatic, the mods in turn; a mod first; or, for a scheme the system opens, outside the app at once, offered to no mod. A choice the service refuses is told on its card.

## Keyboard

The app's own keys, those of its windows (`shell.keys`, with `deckit.shell-keys`), and every key the mods declare to `deckit/keys` (`list()`), each with where it works and what keeps it from working: another key on its chord, a chord one of the app's own keys holds or another mod took, or one the system does not give. A click records a new chord from the next press in Settings' window (`shell.keys.record`), until the keyboard leaves the window, set through `set` (the shell's `set(id, keystroke)`, the keymap's `set(mod, command, keystroke)`): Esc cancels, ⌫ clears it. A chord refused says why on the key. A changed key goes back to its default with `reset`.

## General

The fonts and the text size mods write text in (`shell.fonts`, with `deckit.fonts`).

## Commands

What a CLI, the switcher or another mod runs by name: declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports Settings opens for its id in `start`. It acts on Settings' window, opening it where it is closed, and fails, saying so, while Settings is not attached.

| Command            | Title                 | Args  | What it does                                                              |
| ------------------ | --------------------- | ----- | ------------------------------------------------------------------------- |
| `show-settings-of` | Show a Mod's Settings | `mod` | shows Settings on the card of the mod's settings, for a mod that has some |

The switcher lists each section, and Show a Mod's Settings, through `switcher/actions`.

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

| Member       | What it is                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list()`     | `[{ button, hint, after, value }]`: buttons on the mod's settings, `button` its text and `hint` a line under it, each after the setting whose key is `after`, or at the end when no setting has that key |
| `run(value)` | runs the button pressed. Text it answers shows under its button                                                                                                                                          |

## Permissions

| Permission               | Why                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deckit.mods`            | Mods and Activity: lists every mod, installs, removes, restarts and quits them, keeps one in the Dock, pins the owner of an interface, and restarts the app  |
| `deckit.system-services` | Keyboard, URL Schemes and Mod Settings: lists and sets every mod's keys, what opens each scheme, and every mod's settings; Mods: what the services leave out |
| `deckit.shell-keys`      | Keyboard: lists and sets the app's own keys                                                                                                                  |
| `deckit.fonts`           | General: sets the fonts and the text size                                                                                                                    |

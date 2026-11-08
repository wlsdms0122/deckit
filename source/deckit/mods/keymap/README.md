# Keymap

The mods' keys, in one place: each key a mod declares in its manifest runs one of its commands, on the chord it declares or the one you set, wherever you are in the app or in every app. It has no view, and runs from the start, so each key works as soon as the app opens.

## Declaring keys

A mod declares its keys in its manifest, one `[[contributes."deckit/keys"]]` table for each, and need not use the interface. A key runs a command the mod declares to `deckit/commands` (see the Commands mod), with no args, and its mod launches if it does not run. A key is taken only for a mod granted the permission of its scope: `deckit.app-keys` for `app`, `system.global-keys` for `global`.

```toml
[permissions]
"system.global-keys" = "Its key opens it from any app."

[[contributes."deckit/commands"]]
id = "show"
title = "Show Switcher"

[[contributes."deckit/keys"]]
command = "show"
keystroke = "alt+space"
scope = "global"
```

| Field       | What it is                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `command`   | the id of the command it runs, one the mod declares, which takes no args or none it requires                           |
| `keystroke` | its default chord, as a spec (below)                                                                                   |
| `scope`     | where it works: `app` wherever you are in the app, whatever is in front, or `global` in every app too. Left out, `app` |

A spec is words joined by `+`: modifiers, `cmd` (or `meta`, `mod`) for ⌘, `ctrl` (or `control`) for ⌃, `alt` (or `opt`, `option`) for ⌥ and `shift` for ⇧, and one key: a letter, a digit, `f1` to `f19`, `left`, `right`, `up`, `down`, `enter`, `escape`, `space`, `tab`, `backspace`, `delete`, or one of `` [ ] , . / \ - = ; ' ` ``. Case does not matter. A chord is matched on the physical key, so `shift+1` is the key 1 with ⇧, not `!`. A key works past its page and is taken from every page, text fields included, so its chord needs ⌘, ⌃ or ⌥, and is none a field with focus takes: the arrows, Home, End, Page Up and Down, ⌫ and ⌦ with any modifier, ⌘A, ⌘C, ⌘X, ⌘V, ⌘Z, and ↩ with ⌘, ⌃ or ⌥.

An entry that cannot be used (no command, a command its mod does not declare or one that requires args, a scope of another word or one its mod is not granted, a spec that is no chord or that breaks the rule above) is left out and logged once, as is a second key for one command. The others of that mod are taken.

What is declared is read as Keymap starts and again as `deckit/keys` sends `contributions-changed` or `owner-changed`, and the commands as `deckit/commands` connects and again as it sends `contributions-changed`. The chords are taken again after each.

## Two keys on one chord

Of the keys of one scope on one chord, one runs:

- Defaults first: of keys on one chord by default, the first listed runs, in the mods' order and then the order declared, and the others are `shadowed`.
- Then what you set, in the order you set it: a chord you set onto one a key of that scope has already is `held`, not applied, until that chord is free.

A key of `app` and one of `global` on one chord do not contend: the `app` one runs while the app is in front, the `global` one in every other app.

A chord another mod took through the keys hole (`deckit.keys.take`) runs none of the keys on it (`taken`), until that mod lets it go and the keys are read again. A `global` chord the system does not give works in the app only (`unavailable`).

The shell's own keys (`shell.keys`) are the shell's, not the keymap's. In the pages of the app the shell looks at a key pressed before the keymap does: a key on a chord the shell holds does not run while the shell takes that chord, and runs elsewhere. A `global` chord the system gives reaches no page, so there it runs before the shell's.

## Providing `deckit/keys`

Keymap provides `deckit/keys` major 1, an interface of the mod contract's own. The exports open in `start`. A client lists every key and sets one (Settings) when it uses the interface and holds `deckit.system-services`, which only a system mod is granted; any client reads the chord of a key of its own mod:

```toml
[interfaces]
uses = { "deckit/keys" = 1 }

[permissions]
"deckit.system-services" = "Lists the mods' keys and sets the chord you choose."
```

```js
deckit.dependencies.onConnect('deckit/keys', (keys) => {
    this.keys = keys;
    return () => (this.keys = null);
});
const bindings = await this.keys.list();
await this.keys.set('switcher', 'show', { code: 'Space', meta: false, control: true, alt: false, shift: false });
const chord = await this.keys.chordOf('today'); // '⌥T', or '' for none
```

## What a client calls

A keystroke is `{ code, meta, control, alt, shift }`, `code` as a keyboard event names the key.

| Export                         | Who                      | What it is                                                                                                                                                                                                |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chordOf(command)`             | any client               | the chord the key for its own mod's `command` runs on, as a person reads it (`⌃⌥⇧⌘` and then the key, as `⌥Space`), or `''` for none                                                                      |
| `list()`                       | `deckit.system-services` | every key declared, `[{ mod, command, title, scope, defaultKeystroke, keystroke, chord, changed, active, issues }]`, `app` keys first, then `global`, each in the mods' order and then the order declared |
| `set(mod, command, keystroke)` | `deckit.system-services` | binds the key of the mod `mod` for `command` to `keystroke`, or to none for null, and answers it as `list()` does                                                                                         |
| `reset(mod, command)`          | `deckit.system-services` | binds that key to its default again, and answers it as `list()` does                                                                                                                                      |

A key as `list()` answers it:

| Field                | What it is                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mod`                | the declaring mod's `{ id, name }`                                                                                                                                                                                                                                             |
| `command`, `title`   | the command it runs, and its title                                                                                                                                                                                                                                             |
| `scope`              | `app` or `global`                                                                                                                                                                                                                                                              |
| `defaultKeystroke`   | the keystroke it declares                                                                                                                                                                                                                                                      |
| `keystroke`, `chord` | the keystroke it is bound to now, null for none, and it as a person reads it, `''` for none                                                                                                                                                                                    |
| `changed`            | whether you set it to other than its default                                                                                                                                                                                                                                   |
| `active`             | whether a press of its chord runs it                                                                                                                                                                                                                                           |
| `issues`             | `[{ kind, message, other }]`: `held` and `shadowed` (Two keys on one chord) with `other` the key that has the chord, `{ mod, command, title }`; `taken`, the chord another mod took; `unavailable`, a `global` chord the system did not give. `other` is null for the last two |

What you set is kept in Keymap's storage across runs, and is kept for a key whose mod is gone, so it is bound so again as the mod comes back. A set to the default keeps nothing.

A call that does not hold `deckit.system-services` rejects with kind `REFUSED`. The others reject with why, the `kind` saying which:

| Kind          | Why                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `KEY`         | the mod declares no key for that command                                                               |
| `KEYSTROKE`   | `keystroke` is not one, names a key a spec cannot, or breaks the rule a chord follows (Declaring keys) |
| `NOT_RUNNING` | `deckit/commands` is not connected, so no command is known                                             |

## A press

A press of a chord runs its key's command through `deckit/commands` (`run(mod, command)`), which launches the mod if it does not run and asks it to run the command on the exports it opens for its id (see the Commands mod). What the run throws is logged, and told no one.

## Permissions

| Permission               | Why                                                                              |
| ------------------------ | -------------------------------------------------------------------------------- |
| `deckit.app-keys`        | takes the mods' keys that work wherever you are in the app                       |
| `system.global-keys`     | takes the mods' keys that work in every app                                      |
| `deckit.system-services` | runs the command of the key you press, which launches its mod if it does not run |

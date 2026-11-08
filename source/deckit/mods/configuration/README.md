# Configuration

The mods' settings, in one place: the settings each mod declares in its manifest, each read and set by its own mod, listed and set for every mod by a system mod that shows them to the person (Settings), and kept across runs. It has no view, and launches as a client connects to it.

## Declaring settings

A mod declares its settings in its manifest, one `[[contributes."deckit/configuration"]]` table for each key, and need not use the interface to declare them. They are there whether the mod runs or not, and Configuration reads them from what is declared each time a client reads, sets or lists one.

```toml
[[contributes."deckit/configuration"]]
key = "tab-size"
type = "number"
title = "Tab size"
description = "How many spaces a tab is wide."
default = 4
minimum = 1
maximum = 8

[[contributes."deckit/configuration"]]
key = "theme"
type = "string"
title = "Theme"
default = "light"
oneOf = [{ const = "light", title = "Light" }, { const = "dark", title = "Dark" }]
```

| Field                | What it is                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `key`                | the setting's key among the mod's: letters, digits, `_` and `-`                                                      |
| `type`               | `string`, `number` or `boolean`                                                                                      |
| `title`              | its name as a person reads it, text, not empty                                                                       |
| `description`        | more about it, text. Left out, none                                                                                  |
| `default`            | what it reads as until it is set, a value it takes. Left out, it reads as null until it is set                       |
| `minimum`, `maximum` | the least and the most it takes, numbers, for a `number` only. Left out, no bound                                    |
| `oneOf`              | the values it takes, `[{ const, title }]`, each `const` of its type and within its bounds. Left out, any of its type |

Any other field of the entry (one a client that draws settings reads, as `placeholder` or `unit`) is not read by Configuration, and is handed on as written in `list()`.

An entry that cannot be used (a key that is no key, a type of another word, no title, a description that is not text, bounds on a type other than `number` or that are not numbers, a `minimum` above the `maximum`, a `oneOf` that is not a list of `{ const, title }` or whose `const` it does not take, a `default` it does not take) is left out and logged once, as is a second entry of one key from one mod. The others of that mod are read.

## Providing `deckit/configuration`

Configuration provides `deckit/configuration` major 1, an interface of the mod contract's own. The exports open in `start`, so a client reads its settings with no screen too. Any client reads, sets and hears the settings of its own mod, the one `connection.credential` names. A client lists every mod's settings and sets one of another mod's (Settings) when it holds `deckit.system-services`, which only a system mod is granted:

```toml
[interfaces]
uses = { "deckit/configuration" = 1 }

[permissions]
"deckit.system-services" = "Lists the mods' settings and sets the value you choose."
```

```js
deckit.dependencies.onConnect('deckit/configuration', (configuration) => {
    this.configuration = configuration;
    configuration.onChange((key, value) => this.use(key, value));
    return () => (this.configuration = null);
});
const size = await this.configuration.get('tab-size');
await this.configuration.set('theme', 'dark');
const listed = await this.configuration.list();
await this.configuration.setOf('editor', 'tab-size', 2);
```

## What a client calls

| Export                   | Who                      | What it is                                                                                                                                                                                   |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get(key)`               | any client               | the value of its own mod's `key`: what was set, or else its default                                                                                                                          |
| `values()`               | any client               | every key its own mod declares with its value, as `get` answers it, in an object                                                                                                             |
| `set(key, value)`        | any client               | sets its own mod's `key` to `value`, or unsets it for null so it reads as its default again, and answers the value it reads as now                                                           |
| `onChange(listener)`     | any client               | `listener(key, value)` hears each key of its own mod whose value changes, by `set` or `setOf`, with the value it reads as now, until the connection ends. What it throws is told no one      |
| `list()`                 | `deckit.system-services` | every mod that declares a setting, in the mods' order, `[{ mod, items }]`: `mod` its `{ id, name }`, and `items` `[{ entry, value }]` its settings in the order declared, `entry` as written |
| `setOf(mod, key, value)` | `deckit.system-services` | as `set`, for the mod of the id `mod`                                                                                                                                                        |

What is set is kept in Configuration's storage across runs, by mod id. A set to null keeps nothing for the key. A value kept for a key no longer declared is left out of every answer, and kept, so it reads so again as the key comes back. A value kept that the key no longer takes reads as its default until it is set.

A call to `list` or `setOf` that does not hold `deckit.system-services` rejects with kind `REFUSED`. `get`, `set` and `setOf` reject with why, the `kind` saying which:

| Kind    | Why                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| `KEY`   | the mod declares no setting of `key`                                                                           |
| `VALUE` | `value` is not of the setting's type, is none of its `oneOf`, or is below its `minimum` or above its `maximum` |

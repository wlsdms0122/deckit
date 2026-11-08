# Commands

What mods can do on request, in one place: the commands each mod declares in its manifest, listed for a system mod that offers them to the person (a switcher, a key map) and run on the mod that declares them, which launches it if it does not run. It has no view, and launches as a client connects to it.

## Providing `deckit/commands`

Commands provides `deckit/commands` major 1, an interface of the mod contract's own. The exports open in `start`, so a client lists and runs commands with no screen too. A client uses the interface and holds `deckit.system-services`, which only a system mod is granted:

```toml
[interfaces]
uses = { "deckit/commands" = 1 }

[permissions]
"deckit.system-services" = "Lists the mods' commands and runs the one you pick."
```

```js
deckit.dependencies.onConnect('deckit/commands', (commands) => {
    this.commands = commands;
    return () => (this.commands = null);
});
const listed = await this.commands.list();
await this.commands.run('calendar', 'open-event', { start: 1767225600000 });
```

## Declaring commands

A mod declares its commands in its manifest, one `[[contributes."deckit/commands"]]` table for each, and need not use the interface. They are there whether the mod runs or not. Commands reads what is declared as it starts and again as `deckit/commands` sends `contributions-changed` or `owner-changed`.

```toml
[[contributes."deckit/commands"]]
id = "today"
title = "Show Today"
keywords = ["day", "now"]

[[contributes."deckit/commands"]]
id = "open-event"
title = "Open Event"
params = { type = "object", properties = { start = { type = "integer", title = "Start" } }, required = ["start"] }
```

| Field | What it is |
|---|---|
| `id` | the command's id among the mod's: letters, digits, `_` and `-` |
| `title` | its name as a person reads it, text, not empty |
| `keywords` | more words it is found by, a list of text. Left out, none |
| `params` | the args it takes, as JSON Schema reads them, of `type`, `properties`, `required`, `items`, `enum`, and `oneOf` of `const`s, with `title` and `description` anywhere, and `type = "object"` at the top. Left out, it takes no args |

An entry that cannot be used (an id that is no id, no title, keywords that are not text, params of another keyword or not an object) is left out and logged once, as is a second command of one id from one mod. The others of that mod are listed.

## What a client calls

Every call needs `deckit.system-services`: a client that does not hold it is connected, and each call rejects with kind `REFUSED`.

| Export | What it is |
|---|---|
| `list()` | every command declared by the mods that load, in the mods' order and then the order declared, `[{ mod, id, title, keywords, params }]`, `mod` the declaring mod's `{ id, name }` and `params` null for one that takes no args |
| `run(mod, id, args)` | runs the command `id` of the mod `mod` with `args`, and resolves to what it answers, JSON or null. `args` fit its `params`; one that takes no args takes none or `{}`. It reaches the mod by its id, which launches the mod if it does not run, and asks it to run the command (What a mod answers) |

`run` rejects with why it did not run, the `kind` saying which:

| Kind | Why |
|---|---|
| `REFUSED` | the client does not hold `deckit.system-services` |
| `COMMAND` | the mod declares no such command, or its exports for its id have no `runCommand` |
| `ARGUMENTS` | `args` do not fit its `params`, or hold a function |

A mod that is not reached rejects with the reach's kind and stage: at `launch` one the system does not launch (`NOT_INSTALLED`, `NOT_LOADABLE`, `RELAUNCH_LIMIT`) or one whose run failed (`NOT_LAUNCHED`, `TIMED_OUT`), at `call` one that opens no exports for its id (`NOT_EXPORTED`) or a reach the core refuses (`REFUSED`, `NOT_UP`). A throw of the command is handed to the client as the mod threw it, with its `kind`. A mod running a command of its own calls its own code, and needs nothing of Commands.

## What a mod answers

A mod that declares commands runs them on the exports it opens for its id (`deckit.exports.register(exports)`, with no interface), in `start`, so Commands reaches them with no screen too. They hold one function for this:

| Export | What it is |
|---|---|
| `runCommand(id, args)` | runs the mod's command `id` with `args`, an object that fits its `params` (`{}` for one with none), and answers its result, JSON or nothing. A throw is why it did not run |

```js
start(deckit) {
    const commands = {
        today: () => this.today(),
        'open-event': ({ start }) => this.open(start),
    };
    deckit.exports.register({
        connect: () => ({
            runCommand: (id, args) => {
                if (!Object.hasOwn(commands, id)) throw new Error(`no command ${id}`);
                return commands[id](args);
            },
        }),
    });
}
```

Commands checks the command is declared and its args fit before it asks, and reaches the mod for each run and lets it go as the run ends. A mod is reached by id only by a mod granted `deckit.reach-mods`, which only a system mod is; `connection.credential` says which one asks.

## Permissions

| Permission | Why |
|---|---|
| `deckit.reach-mods` | reaches the mod whose command is run, which launches it if it does not run |

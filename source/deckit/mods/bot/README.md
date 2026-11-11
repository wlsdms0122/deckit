# Bot

The forge daemons and the llmemory brain of a bot that runs on them. Services starts, stops and restarts a daemon and the services it supervises, with its log; Workflows runs and cancels workflows; Schedules makes, pauses and runs schedules; Brain lists, searches and reads the brain's notes. Bot reaches the daemons through `forge/sessions`, which the Forge mod provides and Bot uses, and the brain by running the `llmemory` command in its main process module.

```toml
[interfaces]
uses = { "forge/sessions" = 1, "deckit/configuration" = 1, "deckit/urls" = 1, "switcher/actions" = 1 }
```

Bot holds `forge/sessions` while it is connected (`deckit.dependencies.onConnect`). While it is not, each call to Forge fails, and the Forge views show it as they show a daemon that does not answer until Forge is connected again.

## Where llmemory is

Settings says where it is, `~` at the start of a path being the home folder. Where forge is, the Forge mod's settings say. Bot declares its settings in its manifest to `deckit/configuration` (see the Configuration mod), and reads and sets them through it.

| Key | Setting | What it is | Empty |
|---|---|---|---|
| `llmemory` | LLMemory command | the `llmemory` program | the `llmemory` on the login shell's PATH |
| `brain` | Brain folder | the brain llmemory reads (`--home`) | not set: Brain says so and lists nothing |
| `wrapCode` | Wrap code in notes | whether long lines in a note's code blocks wrap; the wrap button on a block switches it too | off |

Until the settings are read, Brain says it is not serving the brain. llmemory runs with the login shell's PATH, for an app the system opens has only the system's. A changed setting is used at once: what Bot still runs of llmemory for the settings before ends.

## Sessions

Services, Workflows and Schedules show one forge session, chosen from the pop-up button in the title bar, where each is marked running, started elsewhere or stopped, or with Choose Forge Session in the switcher. What a session is and which can be reached from here, the Forge mod says.

## Commands

What a CLI, the switcher or another mod runs by name: declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports Bot opens for its id in `start`. Each acts on the views in Bot's window, and one run while Bot is not attached fails, saying so. Bot opens its window in `attach`, and again from `reopen()` as its Dock item is pressed while the window is closed.

| Command | Title | Args | What it does |
|---|---|---|---|
| `show` | Show in Bot | `view` (`supervisor`, `workflows`, `schedules` or `brain`), `session`? | shows the view in Bot's window, brought in front and opened where it was closed, a Forge view on the session given |
| `choose-session` | Choose Forge Session | `session` | chooses which daemon the Forge views show |
| `search-brain` | Search the Brain | `query` | lists the notes of the brain that match a search, in Brain |
| `read-note` | Read a Brain Note | `note` | opens a note of the brain in Brain |

## Keys

The window's own shortcuts, which Bot handles in its window while the window is key.

| Key | Action |
|---|---|
| ⌘1, ⌘2, ⌘3, ⌘4 | Services, Brain, Workflows, Schedules |
| ⌘F | search the brain |
| ⌘[ | back to the note read before, in Brain |

Reading a note in Brain is a read of the brain like any other: llmemory records it as one. A link in a note opens in the mod that opens its address (`deckit/urls`), or outside the app while `deckit/urls` is not connected.

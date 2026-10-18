# Bot

The forge daemons and the llmemory brain of a bot that runs on them. Services starts, stops and restarts a daemon and the services it supervises, with its log; Workflows runs and cancels workflows; Schedules makes, pauses and runs schedules; Brain lists, searches and reads the brain's notes. Bot does all of it by running the bot's own `forge` and `llmemory` commands in its main process module.

## The bot's folder

Settings has the bot's folder, `~/workspace/agent/jineun-bot` until it is set: where `bin/forge`, `bin/llmemory`, `.forge` (the bot's forge configuration and workflows) and `bot/brain` are. `~` at its start is the home folder. A new folder is used at once, and the commands still running for the one before end. A daemon already running stays the one it was started as until it is restarted: the `default` session is one name whatever the folder.

## Sessions

Each forge session is a daemon of its own. `default` is the bot's, served with `.forge/config.toml` and logging to `log/forge/proc.log`; every other is a folder of forge's own (`~/.config/forge/<name>`, or under `$XDG_CONFIG_HOME`). Services, Workflows and Schedules show one session, chosen from the pop-up button in the title bar, where each is marked running, started elsewhere or stopped, or with Forge Session in the switcher.

forge hands the token that controls a daemon to the process that starts it. A daemon started elsewhere can be stopped and restarted from here; its services, workflows and schedules are reached once it is started from here, or, for a session other than `default`, once its folder holds an `admin.token`, which Bot writes for such a session it starts. The daemons Bot starts are the person's and run on after the app quits.

## For other mods

A mod that requires `bot` receives `forge`, two reports the bot's workflows write, each read on the `default` session:

| Member | What it is |
|---|---|
| `forge.tasks` | `state()`, `check()` and `sync()`: the report of the `task-status` workflow, `{ report, checkedAt, checking, error, syncing, lastSync, revision }`. `check()` asks for it again, `sync()` runs `task-sync` and then asks again |
| `forge.release` | `state()` and `check()`: the report of the `release-status` workflow, `{ report, checkedAt, checking, error, revision }` |

Each change is sent as the events `bot:tasks` and `bot:release`, with the state, and `revision` counts them.

## Keys

| Key | Action |
|---|---|
| ⌘1, ⌘2, ⌘3, ⌘4 | Services, Brain, Workflows, Schedules |
| ⌘F | search the brain |
| ⌘[ | back to the note read before, in Brain |

Reading a note in Brain is a read of the brain like any other: llmemory records it as one.

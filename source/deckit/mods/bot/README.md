# Bot

The forge daemons and the llmemory brain of a bot that runs on them. Services starts, stops and restarts a daemon and the services it supervises, with its log; Workflows runs and cancels workflows; Schedules makes, pauses and runs schedules; Brain lists, searches and reads the brain's notes. Bot does all of it by running the `forge` and `llmemory` commands in its main process module.

## Where forge and llmemory are

Settings says where each is, `~` at the start of a path being the home folder:

| Setting | What it is | Empty |
|---|---|---|
| Forge command | the `forge` program | the `forge` on the login shell's PATH |
| Forge configuration | the `config.toml` the `default` session is served with (`forge serve --config`), with the workflows it names | forge's own, `config.toml` in the session's folder |
| LLMemory command | the `llmemory` program | the `llmemory` on the login shell's PATH |
| Brain folder | the brain llmemory reads (`--home`) | not set: Brain says so and lists nothing |

The commands run with the login shell's PATH, as do the daemons they start, for an app opened from the Finder has only the system's. A changed setting is used at once by the tool it is for: what Bot still runs of that tool for the settings before ends, while what it runs of the other goes on, and a daemon already running stays the one it was started as until it is restarted.

## Sessions

Each forge session is a daemon of its own, with a folder of forge's own (`~/.config/forge/<name>`, or under `$XDG_CONFIG_HOME`) where its socket is and where Bot writes what the daemon prints, `log/proc.log`. `default` is the bot's, served with the Forge configuration; every other with its folder's. Services, Workflows and Schedules show one session, chosen from the pop-up button in the title bar, where each is marked running, started elsewhere or stopped, or with Choose Forge Session in the switcher.

forge hands the token that controls a daemon to the process that starts it. A daemon started elsewhere can be stopped and restarted from here; its services, workflows and schedules are reached once it is started from here, or, for a session other than `default`, once its folder holds an `admin.token`, which Bot writes for such a session it starts. The daemons Bot starts are the person's and run on after the app quits.

## For other mods

A mod that requires `bot` receives `forge`, two reports the bot's workflows write, each read on the `default` session:

| Member | What it is |
|---|---|
| `forge.tasks` | `state()`, `check()` and `sync()`: the report of the `task-status` workflow, `{ report, checkedAt, checking, error, syncing, lastSync, revision }`. `check()` asks for it again, `sync()` runs `task-sync` and then asks again |
| `forge.release` | `state()` and `check()`: the report of the `release-status` workflow, `{ report, checkedAt, checking, error, revision }` |

Each change is sent as the events `bot:tasks` and `bot:release`, with the state, and `revision` counts them. A changed Forge command or Forge configuration starts both again, from revision 0, and sends them. While those settings do not hold, each report's `error` says why.

## Keys

| Key | Action |
|---|---|
| ⌘1, ⌘2, ⌘3, ⌘4 | Services, Brain, Workflows, Schedules |
| ⌘F | search the brain |
| ⌘[ | back to the note read before, in Brain |

Reading a note in Brain is a read of the brain like any other: llmemory records it as one.

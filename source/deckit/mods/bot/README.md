# Bot

The forge daemons and the llmemory brain of a bot that runs on them. Services starts, stops and restarts a daemon and the services it supervises, with its log; Workflows runs and cancels workflows; Schedules makes, pauses and runs schedules; Brain lists, searches and reads the brain's notes. Bot reaches the daemons through the Forge mod, which it requires, and the brain by running the `llmemory` command in its main process module.

## Where llmemory is

Settings says where it is, `~` at the start of a path being the home folder. Where forge is, the Forge mod's settings say.

| Setting | What it is | Empty |
|---|---|---|
| LLMemory command | the `llmemory` program | the `llmemory` on the login shell's PATH |
| Brain folder | the brain llmemory reads (`--home`) | not set: Brain says so and lists nothing |

llmemory runs with the login shell's PATH, for an app opened from the Finder has only the system's. A changed setting is used at once: what Bot still runs of llmemory for the settings before ends.

## Sessions

Services, Workflows and Schedules show one forge session, chosen from the pop-up button in the title bar, where each is marked running, started elsewhere or stopped, or with Choose Forge Session in the switcher. What a session is and which can be reached from here, the Forge mod says.

## Keys

| Key | Action |
|---|---|
| ⌘1, ⌘2, ⌘3, ⌘4 | Services, Brain, Workflows, Schedules |
| ⌘F | search the brain |
| ⌘[ | back to the note read before, in Brain |

Reading a note in Brain is a read of the brain like any other: llmemory records it as one.

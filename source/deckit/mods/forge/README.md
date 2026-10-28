# Forge

The forge daemons, for the mods that depend on this one. Forge starts, stops and restarts a daemon, holds the token the daemon hands the process that starts it, and runs forge's operations on it by running the `forge` command in its main process module. It has no view: Bot shows the daemons, and any other mod uses them the same way.

## Where forge is

Settings says where it is, `~` at the start of a path being the home folder:

| Setting | What it is | Empty |
|---|---|---|
| Forge command | the `forge` program | the `forge` on the login shell's PATH |
| Forge configuration | the `config.toml` the `default` session is served with (`forge serve --config`), with the workflows it names | forge's own, `config.toml` in the session's folder |

forge runs with the login shell's PATH, as do the daemons it starts, for an app opened from the Finder has only the system's. A changed setting is used at once: the commands still running for the settings before end, and a daemon already running stays the one it was started as until it is restarted.

## Sessions

Each forge session is a daemon of its own, with a folder of forge's own (`~/.config/forge/<name>`, or under `$XDG_CONFIG_HOME`) where its socket is and where Forge writes what the daemon prints, `log/proc.log`. `default` is served with the Forge configuration, every other with its folder's.

forge hands the token that controls a daemon to the process that starts it, and keeping it is that process's to do. Forge keeps it in the session's folder, `admin.token`, readable only by the person, for each daemon it starts, `default` too. A daemon started elsewhere can be stopped and restarted from here; its operations are reached once its folder holds its token. The daemons Forge starts are the person's and run on after the app quits.

## For other mods

A mod that names `forge` in `[dependencies]` reaches these as `deckit.dependencies.forge`, opened in `start`. A session not given is `default`:

| Member | What it does |
|---|---|
| `sessions()` | every session, `{ main, sessions: [{ name, up, daemon, authority, controls }] }`: `authority` is whether its token is here, `controls` which of start, stop and restart apply |
| `session(session)` | one session, as in `sessions()` |
| `start(session)`, `stop(session)`, `restart(session)` | the daemon |
| `log(lines, { session })` | the last lines the daemon printed |
| `call(operation, args, { session })` | one of forge's operations, below, answering what forge answers |
| `dispatch(name, inputs, { session, onRun })` | dispatches a workflow, answering `{ workflow_id, name, status: 'running' }` once forge has taken the run, which goes on |
| `runSchedule(id, { session, onRun })` | dispatches a schedule's workflow now, answering as `dispatch` does |
| `run(id, { onRun })` | a run the calling mod dispatched, or `null` |

| Operation | `args` | Answers |
|---|---|---|
| `status` | | the daemon's status |
| `workflow.list`, `workflow.active` | | the registered workflows, the runs under way |
| `workflow.describe` | `{ name }` | a workflow's inputs and outputs |
| `workflow.cancel` | `{ id }` | |
| `service.status`, `service.list`, `service.reload` | | |
| `service.run`, `service.shutdown`, `service.restart` | `{ name }` | |
| `service.send` | `{ name, payload }` | what the service's handler answers |
| `schedule.list` | | |
| `schedule.create` | `{ workflow, inputs, trigger, concurrency }` | |
| `schedule.enable`, `schedule.disable`, `schedule.delete` | `{ id }` | |

`call` refuses `workflow.dispatch`: a run is dispatched with `dispatch`.

A run is `{ id, name, session, status, step, startedAt, endedAt, outputs, error }`. `status` is forge's, `running` and then `ok` or `failed`, with `error` as forge gives it, `{ type, message }`; `step` is the step of the run itself it last started. A run is followed whatever the settings become; one whose stream ends before forge tells its end, as when the daemon stops, ends `failed` with the error type `unfollowed`. Forge waits fifteen seconds for forge to take a run, and rejects the dispatch after. Ended runs are answered by `run(id)` until a hundred more have ended.

A run is the mod's that dispatched it, which forge records as who dispatched it, and only that mod reads it with `run(id)`. `onRun(run)` is told each change of the run, a step started or the end, until it ends. It lasts as long as the connection it was handed over on: a mod that starts again reaches a run it dispatched before with `run(id, { onRun })`.

```js
const { forge } = deckit.dependencies;
await forge.dispatch('merge-gate', { number: 42 }, { onRun: (run) => draw(run) });
```

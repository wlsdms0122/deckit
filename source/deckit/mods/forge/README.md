# Forge

The forge daemons, for the mods that require this one. Forge starts, stops and restarts a daemon, holds the token the daemon hands the process that starts it, and runs forge's operations on it by running the `forge` command in its main process module. It has no view: Bot shows the daemons, and any other mod uses them the same way.

## Where forge is

Settings says where it is, `~` at the start of a path being the home folder:

| Setting | What it is | Empty |
|---|---|---|
| Forge command | the `forge` program | the `forge` on the login shell's PATH |
| Forge configuration | the `config.toml` the `default` session is served with (`forge serve --config`), with the workflows it names | forge's own, `config.toml` in the session's folder |

forge runs with the login shell's PATH, as do the daemons it starts, for an app opened from the Finder has only the system's. A changed setting is used at once: the commands still running for the settings before end, and a daemon already running stays the one it was started as until it is restarted.

## Sessions

Each forge session is a daemon of its own, with a folder of forge's own (`~/.config/forge/<name>`, or under `$XDG_CONFIG_HOME`) where its socket is and where Forge writes what the daemon prints, `log/proc.log`. `default` is served with the Forge configuration, every other with its folder's.

forge hands the token that controls a daemon to the process that starts it. A daemon started elsewhere can be stopped and restarted from here; its operations are reached once it is started from here, or, for a session other than `default`, once its folder holds an `admin.token`, which Forge writes for such a session it starts. The daemons Forge starts are the person's and run on after the app quits.

## For other mods

A mod that names `forge` in `[requires]` receives these, each `session` being a session's name, `default` when it is empty:

| Member | What it does |
|---|---|
| `sessions()` | every session, `{ main, sessions: [{ name, up, daemon, authority, controls }] }`: `authority` is whether its token is here, `controls` which of start, stop and restart apply |
| `session(session)` | one session, as in `sessions()` |
| `start(session)`, `stop(session)`, `restart(session)` | the daemon |
| `log(session, lines)` | the last lines the daemon printed |
| `call(session, operation, args)` | one of forge's operations, below, answering what forge answers |
| `runSchedule(session, id)` | dispatches a schedule's workflow now, answering as `workflow.dispatch` does |
| `run(id)` | a run dispatched from here, or `null` |

| Operation | `args` | Answers |
|---|---|---|
| `status` | | the daemon's status |
| `workflow.list`, `workflow.active` | | the registered workflows, the runs under way |
| `workflow.describe` | `{ name }` | a workflow's inputs and outputs |
| `workflow.dispatch` | `{ name, inputs }` | `{ workflow_id, name, status: 'running' }` once forge has taken the run, which goes on |
| `workflow.cancel` | `{ id }` | |
| `service.status`, `service.list`, `service.reload` | |  |
| `service.run`, `service.shutdown`, `service.restart` | `{ name }` | |
| `service.send` | `{ name, payload }` | what the service's handler answers |
| `schedule.list` | |  |
| `schedule.create` | `{ workflow, inputs, trigger, concurrency }` | |
| `schedule.enable`, `schedule.disable`, `schedule.delete` | `{ id }` | |

A run is `{ id, name, session, status, step, startedAt, endedAt, outputs, error }`. `status` is forge's, `running` and then `ok` or `failed`, with `error` as forge gives it, `{ type, message }`; `step` is the step of the run itself it last started. Each change, a step started or the end, is sent as the event `forge:run` with the run. A run cut off from Forge, the daemon stopping or the Forge settings changing, ends `failed` with the error type `unfollowed`. Ended runs are answered by `run(id)` until a hundred more have ended.

forge records a run as dispatched by the mod that called.

```js
const { forge } = deck.requires;
const { workflow_id } = await forge.call('', 'workflow.dispatch', { name: 'merge-gate', inputs: { number: 42 } });
deck.on('forge:run', (run) => {
    if (run.id === workflow_id) draw(run);
});
```

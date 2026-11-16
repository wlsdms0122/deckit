# DECKIT-19: Notifications

Status: draft
Area: system

## Summary

`deckit/notifications` is the standard interface through which a mod tells a person something while the person may be doing something else. A client posts a notification, with a title or a body, and a command of its own mod's that a press on it runs, and actions, each a button beside it running a command of its own; it reads the notifications of its own mod that are kept, and takes one of them away. The interface's owner keeps what is posted as the host app starts again and shows each notification to a person. This DECKIT fixes what a notification is, the requests `post`, `remove` and `list` with their answers and refusals, which notifications a client reads, and how many are kept. How and when a notification is shown is the owner's, and which mod ships as the owner is the embedding's.

## Motivation

A calendar written once for every host tells a person of a meeting, and a press on it shows the day:

```js
await notifications.post({ title: "Standup", body: "in 5 min", command: "show-date", args: { date: "2026-11-06" } });
```

Without a rule, a post with `silent: "no"` makes no sound on one implementation, which reads any value but `false` as true, and is refused on another; a post of the title `5` is shown as `5` on one and refused on another; and a post refused is refused with no kind on one, so the calendar cannot tell why. `list()` answers every mod's notifications on one implementation, so a mod reads what another mod tells a person, and its own alone on another. A mod could show its own notifications through the shell, and then each would be shown its own way, none would be kept while its mod is not running, and a press could not launch it. What a notification is and what each request answers are the system's to fix, not the owner's.

## Rules

### What a notification is

A **notification** is a table:

| key | takes | required | what it is |
|---|---|---|---|
| `title` | string | no | what a person reads first; left out, the empty string |
| `body` | string | no | what a person reads after it; left out, the empty string |
| `silent` | boolean | no | whether the owner shows it with no sound; left out, `false` |
| `command` | string, not empty | no | the id of a command of its mod's that a press on it runs, as [the commands](../DECKIT-15/SPEC.md) fix one; left out, a press runs none |
| `args` | table | no | what `command` runs with; left out, `{}`, and not read where `command` is left out |
| `actions` | array of tables `{ title, command, args }`, `title` a string, not empty, `command` as `command` above and required, `args` as `args` above | no | the actions a person presses beside it, in order, each running its own command; left out, none |

A notification's `title` and `body` are not both empty. A key of the table that the table above does not name is not read.

A notification posted is **of** the client's own mod, the one the credential the connection hands the owner names. Its command and each action's run on that mod.

### The requests

The owner of `deckit/notifications`, as [the interfaces](../DECKIT-10/SPEC.md) fix one, provides major `1`, opens its exports for every client, in its start, and its exports hold these members on every connection, each a function a call of which is a request, as [calls across a connection](../DECKIT-11/SPEC.md) fix one:

| member | takes | answers |
|---|---|---|
| `post(notification)` | `notification`, a notification, required | the notification's id, a string no other notification has had, once it is kept |
| `remove(id)` | `id`, a string, required | `true`, once the notification of the own mod's kept under `id` is taken away, or `false` where none of the own mod's is kept under it |
| `list()` | nothing | an array, one table `{ id, title, body, posted, actions }` for each notification of the own mod's kept, newest first: `id` its id, `title` and `body` as they read, `posted` the time it was posted, a number of milliseconds since 1970-01-01T00:00:00Z, and `actions` an array, one table `{ title }` for each of its actions, in order |

A request is refused at `call` as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, with kind `INVALID_ARGUMENT`, and a post refused keeps nothing.

### What is kept

The owner keeps each notification posted, in its own storage, as [the storage](../DECKIT-13/SPEC.md) fixes it, so that it stands as the host app starts again, until it is taken away. It keeps the 100 newest of every mod's, and takes the oldest away as one more is posted. A notification is taken away by a `remove` of its mod's, by a person, and as a person presses it or one of its actions.

### What a press runs

As a person presses a notification, or one of its actions, the owner takes it away and runs the command of what was pressed, with its args, on the notification's mod, as `run` of [the commands](../DECKIT-15/SPEC.md) runs one for a client granted `deckit.system-services`, which launches the mod where it does not run.

**Note.** How a notification is shown, when, and how many at once, are the owner's: a toast over the app, a notification of the machine's through `notifications.show`, as [notifications of the machine](../DECKIT-21/SPEC.md) fix it, or none at all on a host with no shell. A person's press reaches the owner through what it shows. What the owner an implementation ships shows, and when: [the notifications mod](../DECKIT-43/SPEC.md).

## Interactions

- A mod's id and name, and `background`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.system-services`, which the owner is granted to run a notification's command: [the permissions](../DECKIT-3/SPEC.md).
- `INVALID_ARGUMENT` and what a value is: [the handle](../DECKIT-7/SPEC.md).
- A notification shown on the machine, and a press of it heard: [notifications of the machine](../DECKIT-21/SPEC.md).
- The owner of an interface and the connection to it: [the interfaces](../DECKIT-10/SPEC.md). A call of a member of the exports and a refusal: [calls across a connection](../DECKIT-11/SPEC.md).
- Where the owner keeps what is posted: [the storage](../DECKIT-13/SPEC.md).
- A command of a mod's, and `run`, which launches its mod: [the commands](../DECKIT-15/SPEC.md).
- How a case matches values, and the owner a case's host ships: [the case format](../DECKIT-1/SPEC.md).
- Which mod a host ships as the owner, and that nothing holds its place: [the embedding](../DECKIT-22/SPEC.md).

## Alternatives considered

- `list()` answering every mod's notifications to any client. A mod's notifications are its own: a mod would read what another tells a person. A person reads every mod's through what the owner shows.
- A member granted `deckit.system-services` that lists every mod's notifications. No client of the interface has a role that reads another mod's; the owner, which shows them, keeps them itself.
- The events `deckit/notifications:posted` and `deckit/notifications:removed`, each with the id. An event is told to every mod that hears it, as [the events](../DECKIT-12/SPEC.md) fix one, so each mod would be told of another's notifications; a mod reads its own with `list()`.
- A value of another type read as one the notification takes, such as `silent: "yes"` as `true` or a title `5` as `"5"`. A value is never read as another, as [the handle](../DECKIT-7/SPEC.md) fixes it.
- A post refused with no kind where its notification does not fit. A refusal with no kind crosses as `REFUSED`, as [calls across a connection](../DECKIT-11/SPEC.md) fix it, and a client could not tell it from the owner failing.
- A post refused where `command` names no command of its mod's. A mod's commands are read as a press runs one, as [the commands](../DECKIT-15/SPEC.md) refuse one it does not declare, and a mod that declares a command after it posts is not refused for it.
- The 100 newest of each mod's kept. What the owner stores would grow with the number of mods that post; one limit over every mod's bounds it alike on every host.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That `post` answers an id no other has had, `posted`, and a `remove` that answers `true`: an id and a time are not known before the case runs, and a step hands no value an earlier step answered. `silent`, `command`, `args`, and what a press runs: how a notification is shown is the owner's, so no case knows that one is shown on the machine where the input `press` of the case format presses it. That a notification is taken away by a person: likewise. That the owner opens its exports in its start and for every client: every case reaches it so. A key the table does not name: each is a key a case reads the same way.

**Note.** What this costs an implementation's owner: it writes its record to its storage on each post and each notification taken away, and, writing `background`, runs from the host app's start, so that a notification posted before a person opens anything is kept.

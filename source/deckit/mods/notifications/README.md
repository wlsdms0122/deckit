# Notifications

What mods tell you, in one place: the notifications they post, shown over the app while you are in it and as the system's while you are in another, and the recent ones when you ask. It runs in the background from the start, so a notification posted before you open anything is not missed.

## Providing `deckit/notifications`

Notifications provides `deckit/notifications` major 1, an interface of the mod contract's own (MOD.md, Standard interfaces): a mod posts with `post({ title, body, silent, command, args, actions })`, takes its own away with `remove(id)`, and reads the record with `list()`. The exports open in `start`, so a mod posts with no screen too. Notifications sends `deckit/notifications:posted` and `deckit/notifications:removed`, each with the notification's id.

```toml
[interfaces]
uses = { "deckit/notifications" = 1 }
```

```js
deckit.dependencies.onConnect('deckit/notifications', (notifications) => {
    this.notifications = notifications;
    return () => (this.notifications = null);
});
const id = await this.notifications.post({
    title: 'Standup',
    body: 'in 5 min',
    command: 'show-date',
    args: { date: '2026-11-06' },
    actions: [{ title: 'Snooze', command: 'snooze', args: { minutes: 5 } }],
});
```

| Export | What it is |
|---|---|
| `post({ title, body, silent, command, args, actions })` | posts a notification of the sender's, and resolves to its id, a string. `title` and `body` are text, one of them not empty; `silent` asks for no sound. `command` is the id of a command the sender declares to `deckit/commands` (see the Commands mod), which a press on the notification runs with `args`, a table that fits its `params` (`{}` left out); `actions`, `[{ title, command, args }]`, are buttons beside it, each running its own command of the sender's. A notification with no `command` is pressed to put it away, and brings nothing forward. A post of another shape rejects with a `TypeError` |
| `remove(id)` | takes away a notification of the sender's own, and resolves to whether it was there |
| `list()` | the record, newest first, whoever posted, `[{ id, mod, title, body, posted, actions }]`, `mod` the sender's `{ id, name }`, `posted` when, in milliseconds, and `actions` `[{ title }]` |

A command a notification names is always the sender's own: Notifications runs it on the mod that posted it.

## What it does with a post

| | |
|---|---|
| The record | each post is kept, newest first, up to 100: the oldest goes as a new one comes. It is kept across runs, in Notifications' storage, and `list()` reads it whoever posted |
| The rate | a sender is shown at most 3 notifications within 10 seconds; one past that is kept and listed, and not shown |
| The queue | what is let through is shown in the order posted. While the app is in front, as a toast; otherwise, and while Notifications has no screen, as the system's (`deckit.notifications.show`) |
| Toasts | at most 3 at once, stacked in Notifications' window over the app, which leaves the keyboard where it is; one more waits in the queue until one goes. Each goes after 6 seconds or as you close it, and stays in the record |
| A press | on a toast, on the system's notification, on a row of the list, or on one of its actions, it takes the notification away and runs the command it names on its sender through `deckit/commands` (`run(mod, command, args)`), which launches the sender if it is not running. One with no command is taken away, and brings nothing forward. A command that does not run, or one pressed while no mod provides `deckit/commands`, is logged |
| Taking away | by a press, by the close button on a row of the list, by Clear, or by its sender's `remove`: it leaves the record, the queue and the screen |

`silent` asks the system's notification for no sound; a toast makes none. Actions are drawn on toasts and rows; the system's notification shows the title and the body only.

## The list

The `show` command opens the recent notifications in the same window, newest first, each with its sender and when it came: press one to run it, close it to take it away, or clear them all. The list goes as the keyboard leaves it.

## Commands

Declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports Notifications opens for its id in `start`. The window is made in `attach`, so a command run before `attach` has run, or on a host with no shell, fails, saying so.

| Command | Title | What it does |
|---|---|---|
| `show` | Show Notifications | opens the list of recent notifications |

Show Notifications is declared to `switcher/actions` too, running `show`.

## Permissions

| Permission | Why |
|---|---|
| `system.notifications` | shows a notification as the system's while you are in another app |
| `system.overlay-windows` | its window, of toasts and the list, floats over the app |
| `deckit.system-services` | runs the command of a notification you press, which launches its sender if it does not run |

# Notifications

What mods tell you, in one place: the notifications they post, shown at the top right of the app, and as the system's besides while you are in another, and the recent ones in the notification center, under its item in the status bar, when you ask. It runs in the background from the start, so a notification posted before you open anything is not missed.

## Providing `deckit/notifications`

Notifications provides `deckit/notifications` major 1, an interface of the mod contract's own (MOD.md, Standard interfaces): a mod posts with `post({ title, body, silent, command, args, actions })`, takes its own away with `remove(id)`, and reads its own with `list()`: a mod's notifications are its own. The exports open in `start`, so a mod posts with no screen too.

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
| `post({ title, body, silent, command, args, actions })` | posts a notification of the sender's, and resolves to its id, a string. `title` and `body` are text, one of them not empty; `silent`, a boolean, asks for no sound. `command` is the id of a command the sender declares to `deckit/commands` (see the Commands mod), which a press on the notification runs with `args`, a table that fits its `params` (`{}` left out); `actions`, `[{ title, command, args }]`, are buttons beside it, each running its own command of the sender's. A notification with no `command` is pressed to put it away, and brings nothing forward. A post of another shape, a value of another type among it, rejects with kind `INVALID_ARGUMENT` |
| `remove(id)` | takes away a notification of the sender's own, and resolves to whether it was there; an `id` that is not a string rejects with kind `INVALID_ARGUMENT` |
| `list()` | the sender's own notifications in the record, newest first, `[{ id, title, body, posted, actions }]`, `posted` when, in milliseconds, and `actions` `[{ title }]` |

A command a notification names is always the sender's own: Notifications runs it on the mod that posted it.

## What it does with a post

| | |
|---|---|
| The record | each post is kept, newest first, up to 100: the oldest goes as a new one comes. It is kept across runs, in Notifications' storage, and `list()` reads a sender's own of it |
| The rate | a sender is shown at most 3 notifications within 10 seconds; one past that is kept and listed, and not shown |
| The queue | what is let through is shown in the order posted: as a toast while Notifications has a screen, whoever looks at it, and as the system's besides (`deckit.notifications.show`) while the app is not in front, which waits for no room among the toasts |
| Toasts | at most 3 at once, stacked in a view Notifications draws at the top right of the app, 360 wide and as high as they are, open while it holds any. Everyone who sits at the desktop reads it and presses in it, and it takes nobody's keyboard; one more waits in the queue until one goes. Each goes after 6 seconds or as you close it, one with actions as you press one or close it, and stays in the record |
| A press | on a toast, on the system's notification, on a row of the notification center, or on one of its actions, it takes the notification away and runs the command it names on its sender through `deckit/commands` (`run(mod, command, args)`), which launches the sender if it is not running. One with no command is taken away, and brings nothing forward. A command that does not run, or one pressed while no mod provides `deckit/commands`, is logged |
| Taking away | by a press, by the close button on a row of the notification center, by Clear All, or by its sender's `remove`: it leaves the record, the queue and the screen |

`silent` asks the system's notification for no sound; a toast makes none. Actions are drawn on toasts and rows; the system's notification shows the title and the body only.

## The item in the status bar

Notifications declares an item to the status bar (the Status Bar mod's README): a bell, there with an empty record too, with the count of the record beside it while it holds any. As a notification arrives the item asks for attention for 4 seconds. A press on it runs `toggle`.

```toml
[[contributes."status-bar/items"]]
name = "Notifications"
icon = "bell"
command = "toggle"
```

## The notification center

The recent notifications, newest first, each with its sender and when it came, in a view under the item, 360 wide and as high as its rows, up to 560, beyond which it scrolls: press one to run it, close it to take it away, or clear them all. It is shown for the one who asked and holds that one's keyboard while it is shown: the arrows move along the rows, Return runs the one they are on, and Command-Delete takes it away. Escape and a press outside it put it away, as for any view under an item.

## Commands

Declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports Notifications opens for its id in `start`. The views are made in `attach`, so a command run before `attach` has run, or on a host with no shell, fails, saying so.

| Command | Title | What it does |
|---|---|---|
| `toggle` | Show or Hide Notifications | shows the notification center for the one who asked, or puts it away where it is shown |
| `show` | Show Notifications | shows the notification center for the one who asked |

Show Notifications is declared to `switcher/actions` too, running `show`.

## Permissions

| Permission | Why |
|---|---|
| `system.notifications` | shows a notification as the system's while you are in another app |
| `deckit.panel-windows` | the toasts stand at the top right of the app, and the notification center under its item in the status bar |
| `deckit.system-services` | runs the command of a notification you press, which launches its sender if it does not run |

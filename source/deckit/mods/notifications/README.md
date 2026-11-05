# Notifications

What mods tell you, in one place: the notifications they post, shown over the app while you are in it and as the system's while you are in another, and the recent ones when you ask. It asks to start with the app, so a notification posted before you open anything is not missed.

## Providing `deckit/notifications`

Notifications provides `deckit/notifications` major 1, which the mod contract defines (MOD.md, Standard interfaces): a mod posts with `post({ title, body, silent, token, actions })`, takes its own away with `remove(id)`, and reads the record with `list()`. The exports open in `start`, so a mod posts with no screen too. Notifications sends `deckit/notifications:posted` and `deckit/notifications:removed`, each with the notification's id.

```toml
[interfaces]
uses = { "deckit/notifications" = 1 }
```

## What it does with a post

| | |
|---|---|
| The record | each post is kept, newest first, up to 100: the oldest goes as a new one comes. It is kept across runs, in Notifications' storage, and `list()` reads it whoever posted |
| The rate | a sender is shown at most 3 notifications within 10 seconds; one past that is kept and listed, and not shown |
| The queue | what is let through is shown in the order posted. While the app is in front, as a toast; otherwise, and while Notifications has no screen, as the system's (`deckit.notifications.show`) |
| Toasts | at most 3 at once, stacked in Notifications' window over the app, which leaves the keyboard where it is; one more waits in the queue until one goes. Each goes after 6 seconds or as you close it, and stays in the record |
| A press | on a toast, on the system's notification, on a row of the list, or on one of its actions, it runs the token the sender handed (`deckit.commands.tokens.run`), which launches the sender if it is not running, and takes the notification away. One with no token is taken away, and brings nothing forward |
| Taking away | by a press, by the close button on a row of the list, by Clear, or by its sender's `remove`: it leaves the record, the queue and the screen, and its tokens are released |

`silent` asks the system's notification for no sound; a toast makes none. Actions are drawn on toasts and rows; the system's notification shows the title and the body only.

## The list

The `show` command (and Show Notifications in the switcher) opens the recent notifications in the same window, newest first, each with its sender and when it came: press one to run it, close it to take it away, or clear them all. The list goes as the keyboard leaves it.

## Permissions

| Permission | Why |
|---|---|
| `system.notifications` | shows a notification as the system's while you are in another app |
| `system.overlay-windows` | its window, of toasts and the list, floats over the app |

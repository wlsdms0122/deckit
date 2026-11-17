# DECKIT-43: Notifications

Status: draft
Area: mods

## Summary

The **notifications** mod is the mod of the id `notifications` an implementation ships as the owner of `deckit/notifications`, which [the notifications](../DECKIT-19/SPEC.md) fix. It runs in the background from the host app's start, and gives an item in the [status bar](../DECKIT-42/SPEC.md). This DECKIT fixes what it does beyond 19: its item and what the item counts, its commands `toggle` and `show`, the **center**, a view under its item that lists what is kept and that a seat presses, a **toast**, a view at a place that shows each notification as it is posted to every seat, and the gate, which tells when a notification is also shown on the machine. Which mods the app ships is the implementation's, and how a view and a toast look is the kit's.

## Motivation

A calendar posts `{ title: "Standup", command: "open" }` five minutes before a meeting. The interface fixes that the post is kept and that a press runs `open`, but not where a person meets it. Without a rule, one implementation shows it at the top right of the host app's window, another in a list under an item of the bar alone, and a third on the machine only, so a person who works through a seat from outside the app never sees it; a fourth shows it to the seat that last pressed and not to the others. A seat that reads the bar cannot tell whether a count beside a bell is what is kept or what is unread, nor whether a press on it opens a list or clears it. Two implementations that ship this mod answer each of these alike only where it is fixed here.

## Rules

### The item

The notifications mod declares one item to `status-bar/items`, as [the status bar](../DECKIT-42/SPEC.md) fixes the contribution: the name `Notifications`, the glyph `bell` and the command `toggle`. So the item stands from the host app's start, before the mod sets anything of it.

While the mod runs it sets of its item, with `set` of the status bar's exports, its `count` and its `tone` alone, each time what it keeps changes, and as the status bar connects:

- `count` is how many notifications it keeps, of every mod's, and none while it keeps none;
- `tone` is `attention` for a while as a notification arrives, one newer than every notification kept before, and `plain` otherwise.

So the item shows its count while a notification is kept, and its glyph alone as none is.

### The commands

The mod declares two commands to `deckit/commands`, as [the commands](../DECKIT-15/SPEC.md) fix them. Each acts for the seat the mod acts for, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes it, so for the seat that pressed the item:

| id | what it does |
|---|---|
| `toggle` | shows the center for that seat by activation where it is not shown for it so, and puts it away for that seat where it is: the center's `toggle()`, as [views](../DECKIT-41/SPEC.md) fix it |
| `show` | shows the center for that seat by activation, and its keyboard goes to the center: the center's `makeKeyAndOrderFront()` |

The first of them that runs opens the center, shown by activation, for that seat. A command run while the mod has no shell fails, as a command that throws fails.

### The center

The center is a view named `center`, under the anchor `{ mod: "status-bar", id: "notifications" }`, as [the status bar](../DECKIT-42/SPEC.md) fixes the anchor of an item, so it stands under the item while the item is in view. It is a view as [views](../DECKIT-41/SPEC.md) fix one: shown for one seat, put away for it as 41 says, and 360 wide.

It holds a region named `Notifications`, with a button `Clear All`, and a list box, whose options are the **rows**: one for each notification kept, of every mod's, newest first, as [what a seat reads](../DECKIT-40/SPEC.md) reads each role. A row is named by the notification's title, the sender's name where it has none, and its body after it, the two apart by `, `. It holds a button for each of the notification's actions, named by the action's title, in their order, and a button `Remove`.

- A press on a row is a press of its notification, and one on an action's button a press of that action, as [the notifications](../DECKIT-19/SPEC.md) fix a press: the notification is taken away, and the command pressed runs on its sender.
- A press on `Remove` takes the row's notification away, and runs nothing.
- A press on `Clear All` takes every notification away.

A row stands while its notification is kept, and goes as it is taken away, by any of these or by a `remove` of its sender's. While the center has the seat's keyboard, `ArrowDown` and `ArrowUp` move along the rows, `Enter` presses the row moved to, and `Backspace` with `meta` held takes its notification away.

### A toast

As a notification is posted, the mod shows it as a **toast**, where the gate below says. A toast is shown in a view named `toasts` at the place `top-right`, opened with `activates` `false`, as [views](../DECKIT-41/SPEC.md) fix a view at a place: it is shown for every seat, the local seat and each seat a user from outside holds alike, and takes no seat's keyboard. The view is open while it holds a toast, one under another in the order they came, at most 3 at once, and closes as the last goes; a toast beyond 3 waits, in the order posted, until one goes.

A toast is an alert, named as its notification's row is, and holds a button for each of its actions and a button `Close`. A press on it, or on an action's button, is a press as the center's row is. A toast goes:

- after a while, where its notification has no action; one with an action stays;
- as `Close` is pressed on it, its notification still kept;
- as its notification is taken away, however it is.

A sender's notifications beyond 3 posted within 10 seconds are kept and listed in the center, and shown as no toast and on no machine.

### The gate

Each notification a toast is for is shown as a toast while the mod is attached to a shell, and is shown on the machine besides, through `notifications.show` of [notifications of the machine](../DECKIT-21/SPEC.md), with its title, body and `silent`, while the host app is not in front as `active()` of [activation](../DECKIT-32/SPEC.md) answers as it comes to be shown. Where the mod has no shell, it is shown on the machine alone. A press of what the machine shows is a press of the notification. A notification shown on the machine waits for no room among the toasts.

## Interactions

- The interface, what a notification is, what is kept and what a press runs: [the notifications](../DECKIT-19/SPEC.md). A notification shown on the machine, and its press heard: [notifications of the machine](../DECKIT-21/SPEC.md).
- An item, its contribution, `set`, a press on it and the anchor of an item: [the status bar](../DECKIT-42/SPEC.md).
- A command, and `run`: [the commands](../DECKIT-15/SPEC.md). `background`: [the bundle](../DECKIT-2/SPEC.md).
- A view under an anchor and at a place, for which seats it is shown, and what puts it away: [views](../DECKIT-41/SPEC.md). The seat a mod acts for, and a seat's press: [seats at the desktop](../DECKIT-39/SPEC.md). What a seat reads: [what a seat reads](../DECKIT-40/SPEC.md).
- Whether the host app is in front: [activation](../DECKIT-32/SPEC.md). A key and `meta`: [the shell's keys](../DECKIT-34/SPEC.md).
- A host that ships the owner and the status bar: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- A toast shown to the seat that last pressed, or to the local seat alone. A notification is for whoever works at the host app; a seat from outside the app stands equal to the person at its window, and no seat is told apart.
- The center shown for every seat as one presses the item. One seat's list would open over every other seat's work; a press is one seat's, and so is what it shows.
- The count of notifications not yet seen. Seen by which seat: each seat would need a count of its own, and the item is one for every seat. The count is what is kept, which every seat reads alike.
- The machine's notification always, beside a toast. A person at the host app's window would be told each one twice.
- The center as a window of its own. It would stand among the person's windows and take a place in their order; a view stands under the item it is for, and goes at a press outside it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The gate's notification on the machine, while the host app is not in front, and its press: no case puts the host app out of front, and a case raises no notification on the machine, so the cases hold the toast alone. The tone and how long it stays, how long a toast stays, and the rate of 3 within 10 seconds: a time is not held by a case, which steps no clock. The keys of the center and its `show`: a case presses the item alone. More than 3 toasts at once: the cases post fewer. How a view and a toast look, the words of the empty center and when a row says it came: the kit's and the implementation's, as [the look](../DECKIT-35/SPEC.md) leaves them; a case reads a view's lines with no text under them, and holds the height of a toast and of a center that holds rows as the kit draws them, so it holds only against that kit. The item's tone: how long `attention` stays is a time, so a case reads the item's name with a stand-in, as [the case format](../DECKIT-1/SPEC.md) gives one, where its tone would be. Where the toasts and the center stand on the local seat's screen while the item shows a count: the look `windows` holds the capsule's width as a number, which is the machine's fonts, and no party reads the local seat's desktop, so the cases read the desktop of the seat a party sits at, with a stand-in for its mark, for where its pointer and the capsule stand and for how wide the capsule is.

**Note.** What this costs an implementation: it runs from the host app's start, sets its item each time what it keeps changes, keeps the toasts' view open only while it holds one, and asks whether the host app is in front for each notification it shows.

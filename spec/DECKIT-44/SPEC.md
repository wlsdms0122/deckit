# DECKIT-44: Seats

Status: draft
Area: mods

## Summary

The **seats** mod is the mod of the id `seats` an implementation ships, granted `deckit.seats`, which [seats at the desktop](../DECKIT-39/SPEC.md) fixes. It runs in the background from the host app's start, and gives an item in the [status bar](../DECKIT-42/SPEC.md) while a seat sits beside another. This DECKIT fixes what it does with `shell.seats`: its item, its command `show`, and its **view**, under its item, that lists who sits, where a press has the host app's window follow a seat, for whoever pressed. Which mods the app ships is the implementation's, and how the view looks is the kit's.

## Motivation

Ada sits from outside beside the person at the machine. The member `shell.seats` lets a mod granted `deckit.seats` read who sits and have the host app's window follow a seat, but fixes no place where a seat meets either. Without a rule, one implementation lists the seats in the bar, another nowhere until a mod is written for it, and a seat that reads the bar cannot tell whether a count beside a glyph is every seat or those beside one, nor what a press on Ada's row does. Two implementations that ship this mod answer each of these alike only where it is fixed here.

## Rules

### The item

The seats mod declares no item: it sets one with `set` of the status bar's exports, as [the status bar](../DECKIT-42/SPEC.md) fixes it, while it is attached to a shell and more than one seat is open, and takes it away with `remove` as one alone is or as it is detached. It sets the item each time what `seats.list()` answers changes, and as the status bar connects:

- `name` is `Seats`, `icon` `users`, a glyph of the kit, and `command` `show`;
- `count` is the number of open seats less one;
- `tone` is `plain`;
- `label` is, for a while as a seat opens after the mod first read the seats, the name of its seat's user, cut to 24 characters, the last of them `…` where the name is longer; and empty otherwise, or once that seat closes.

So the item counts the seats beside one.

### The command

The mod declares one command to `deckit/commands`, as [the commands](../DECKIT-15/SPEC.md) fix them, which acts for the seat the mod acts for, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes it, so for the seat that pressed the item:

| id | what it does |
|---|---|
| `show` | opens the view where it was never opened, and otherwise shows it for that seat where it is not shown for it and puts it away for that seat where it is: the view's `toggle()`, as [views](../DECKIT-41/SPEC.md) fix it |

A command run while the mod has no shell fails, as a command that throws fails.

### The view

The view is a view named `seats`, under the anchor `{ mod: "status-bar", id: "seats" }`, as [the status bar](../DECKIT-42/SPEC.md) fixes the anchor of an item, so it stands under the item while the item is in view. It is a view as [views](../DECKIT-41/SPEC.md) fix one, shown for one seat and put away for it as 41 says. It is 280 wide, and as high as its rows and 6 above and below them, with 2 between two rows, each 28 high, within the bounds [views](../DECKIT-41/SPEC.md) fix. It takes that size each time its rows change, while it has one.

It holds a group named `Seats`, whose **rows** are a row for each open seat, in the order `seats.list()` answers them, as [what a seat reads](../DECKIT-40/SPEC.md) reads each role: a button named by its user's name, and `idle` where the seat is idle and `following` where the host app's window follows it, each that is so, joined by a comma and a space; pressed while the window follows it. It shows a mark in the seat's colour.

A user that waits to sit has no row: the ask is the machine's, as [users and seats](../DECKIT-38/SPEC.md) fix admission, and the view lists who sits alone.

### A press

A press on a row, or `Enter` or the space key on a row that has the seat's keyboard, acts for whoever pressed, as `deckit.seats` lets the mod act: `seats.follow` of that row's seat, and the host app's window follows it, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes following; on the row of the seat followed, `seats.follow` of null, which ends it.

A row stands while its seat is open, and goes as the shell tells that it closed.

**Note.** Who may have the window follow is not settled, as [seats at the desktop](../DECKIT-39/SPEC.md) says of `deckit.seats`. The mod is told nothing of which seat pressed, so as it stands every seat that reaches the view does it.

## Interactions

- `shell.seats`, `deckit.seats`, a seat's colour and following: [seats at the desktop](../DECKIT-39/SPEC.md). Admission, `asking`, and who sits being the machine's: [users and seats](../DECKIT-38/SPEC.md).
- An item, `set`, `remove`, a press on it and the anchor of an item: [the status bar](../DECKIT-42/SPEC.md).
- A command, and `run`: [the commands](../DECKIT-15/SPEC.md). `background`: [the bundle](../DECKIT-2/SPEC.md).
- A view under an anchor, for which seats it is shown, and what puts it away: [views](../DECKIT-41/SPEC.md). What a seat reads: [what a seat reads](../DECKIT-40/SPEC.md).
- A host that ships the mod and the status bar: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- A row for each user that waits to sit, where any seat answers the ask. Who sits is the machine's, as [users and seats](../DECKIT-38/SPEC.md) part every state, and a press in the view is any seat's input in the shared state, so a seat from outside would admit or refuse another; the host asks whoever is at the machine.
- An item that stands always. Alone at the desktop there is no one to count; a press on it would open an empty view.
- A count of every open seat. One seat is always open where the host app shows a desktop; the seats beside it are what a seat wants told.
- A row that says which seat is the machine's. The shell tells no mod which seat is the machine's, and the view tells it no seat either.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The label and how long it stays: a time is not held by a case, which steps no clock, and the cases read the item after the seat that opened last has closed. The cut of a long name: the cases' users have short names. That the view stands on no screen but the one of the seat that pressed, while the item shows a count: the look `windows` holds the capsule's width as a number, which is the machine's fonts, and no party reads the local seat's desktop, so the case reads the desktop of the seat that pressed, with a stand-in, as [the case format](../DECKIT-1/SPEC.md) gives one, for its mark, for where its pointer and the capsule stand and for how wide the capsule is; a case that reads the capsule as a node writes one for where it stands, how wide it is and whether it scrolls, which follows from its width. `idle`: a seat is idle only after `idleTime` seconds. The keys of a seat's row: the cases press the rows. A command run with no shell: a case's host app always has one. The mark in a seat's colour, and how the view looks: the kit's, as [the look](../DECKIT-35/SPEC.md) leaves it. The view's heights are held as the kit lays the rows, so a case holds them only against that kit.

**Note.** What this costs an implementation: it runs from the host app's start, reads the seats each time they change, and sets its item and resizes its view as it does.

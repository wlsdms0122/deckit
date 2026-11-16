# DECKIT-44: Seats

Status: draft
Area: mods

## Summary

The **seats** mod is the mod of the id `seats` an implementation ships, granted `deckit.seats`, which [seats at the desktop](../DECKIT-39/SPEC.md) fixes. It runs in the background from the host app's start, and gives an item in the [status bar](../DECKIT-42/SPEC.md) while a seat sits beside another or a user asks to sit. This DECKIT fixes what it does with `shell.seats`: its item, its command `show`, and its **view**, under its item, that lists who asks and who sits, where a press answers an ask or has the host app's window follow a seat, for whoever pressed. Which mods the app ships is the implementation's, and how the view looks is the kit's.

## Motivation

Ada attaches from outside while asking is on, and waits. The member `shell.seats` lets a mod granted `deckit.seats` read her ask and answer it, but fixes no place where a seat meets it. Without a rule, one implementation shows the ask to the person at the host app's window alone, another nowhere until a mod is written for it, and a seat that reads the bar cannot tell whether a count beside a glyph is the seats or the asks, nor whether a press on a row seats Ada or follows her. Two implementations that ship this mod answer each of these alike only where it is fixed here.

## Rules

### The item

The seats mod declares no item: it sets one with `set` of the status bar's exports, as [the status bar](../DECKIT-42/SPEC.md) fixes it, while it is attached to a shell and either more than one seat is open or an ask waits, and takes it away with `remove` as neither is so or as it is detached. It sets the item each time what `seats.list()` or `seats.asks()` answers changes, and as the status bar connects:

- `name` is `Seats`, `icon` `users`, a glyph of the kit, and `command` `show`;
- `count` is the number of open seats less one, and none while one is open;
- `tone` is `attention` while an ask waits, and `plain` otherwise;
- `label` is, for a while as a seat opens after the mod first read the seats, the name of its seat's user, cut to 24 characters, the last of them `…` where the name is longer; and empty otherwise, or once that seat closes.

So the item counts the seats beside one, and draws attention while a user asks to sit.

### The command

The mod declares one command to `deckit/commands`, as [the commands](../DECKIT-15/SPEC.md) fix them, which acts for the seat the mod acts for, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes it, so for the seat that pressed the item:

| id | what it does |
|---|---|
| `show` | opens the view where it was never opened, and otherwise shows it for that seat where it is not shown for it and puts it away for that seat where it is: the view's `toggle()`, as [views](../DECKIT-41/SPEC.md) fix it |

A command run while the mod has no shell fails, as a command that throws fails.

### The view

The view is a view named `seats`, under the anchor `{ mod: "status-bar", id: "seats" }`, as [the status bar](../DECKIT-42/SPEC.md) fixes the anchor of an item, so it stands under the item while the item is in view. It is a view as [views](../DECKIT-41/SPEC.md) fix one, shown for one seat and put away for it as 41 says. It is 280 wide, and as high as its rows and 6 above and below them, with 2 between two rows: an ask's row is 36 high and a seat's 28, within the bounds [views](../DECKIT-41/SPEC.md) fix. It takes that size each time its rows change, while it has one.

It holds a group named `Seats`, whose **rows** are, as [what a seat reads](../DECKIT-40/SPEC.md) reads each role:

- first a row for each ask that waits, in the order `seats.asks()` answers them: a group named by the user's name and ` asks to sit`, holding a button `Deny` and a button `Allow`, named `Deny` and `Allow` each followed by a space and the user's name;
- then a row for each open seat, in the order `seats.list()` answers them: a button named by its user's name, and `idle` where the seat is idle and `following` where the host app's window follows it, each that is so, joined by a comma and a space; pressed while the window follows it. It shows a mark in the seat's colour.

An ask waits only while the setting `asking` makes one wait, as [users and seats](../DECKIT-38/SPEC.md) fix admission, so the view holds no ask's row while `asking` is false.

### A press

A press on a row, or `Enter` or the space key on a seat's row that has the seat's keyboard, acts for whoever pressed, as `deckit.seats` lets the mod act:

- on `Allow`, `seats.answer` of that ask with `true`: the user sits, as [users and seats](../DECKIT-38/SPEC.md) fix admission;
- on `Deny`, `seats.answer` of that ask with `false`: the user is refused;
- on a seat's row, `seats.follow` of that seat: the host app's window follows it, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes following; on the row of the seat followed, `seats.follow` of null, which ends it.

A row stands while its ask waits or its seat is open, and goes as the shell tells that it ended.

**Note.** Who may answer an ask and who may have the window follow is not settled, as [seats at the desktop](../DECKIT-39/SPEC.md) says of `deckit.seats`. The mod is told nothing of which seat pressed, so as it stands every seat that reaches the view does both.

## Interactions

- `shell.seats`, `deckit.seats`, a seat's colour and following: [seats at the desktop](../DECKIT-39/SPEC.md). An ask, admission and `asking`: [users and seats](../DECKIT-38/SPEC.md).
- An item, `set`, `remove`, a press on it and the anchor of an item: [the status bar](../DECKIT-42/SPEC.md).
- A command, and `run`: [the commands](../DECKIT-15/SPEC.md). `background`: [the bundle](../DECKIT-2/SPEC.md).
- A view under an anchor, for which seats it is shown, and what puts it away: [views](../DECKIT-41/SPEC.md). What a seat reads: [what a seat reads](../DECKIT-40/SPEC.md).
- A host that ships the mod and the status bar: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- The asks shown to the person at the host app's window alone. A seat from outside the app stands equal to the person at its window, and no seat is told apart.
- An item that stands always. Alone at the desktop there is no one to count and nothing to answer; a press on it would open an empty view.
- A count of every open seat. One seat is always open where the host app shows a desktop; the seats beside it are what a seat wants told.
- A row that says which seat is the machine's. The shell tells no mod which seat is the machine's, and the view tells it no seat either.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The label and how long it stays: a time is not held by a case, which steps no clock, and the cases read the item after the seat that opened last has closed. The cut of a long name: the cases' users have short names. `idle`: a seat is idle only after `idleTime` seconds. A press on a followed seat's row, and the keys of a seat's row: the cases press the rows of seats not followed. The mark in a seat's colour, and how the view looks: the kit's, as [the look](../DECKIT-35/SPEC.md) leaves it. The view's heights are held as the kit lays the rows, so a case holds them only against that kit.

**Note.** What this costs an implementation: it runs from the host app's start, reads the seats and the asks each time either changes, and sets its item and resizes its view as it does.

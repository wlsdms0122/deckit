# Seats

Who sits at the desktop with you, in the status bar. Every user that attaches has a seat: a pointer, a keyboard and a view of its own. While a seat sits beside the first, Seats gives the status bar an item (the Status Bar mod's README): the count of the seats beside the first, labelled with the name of a seat that just sat for a few seconds. Alone at the desktop there is no item.

A press on the item opens the view under it, and a press again puts it away. It holds a row for every seat, in the order they sat: its colour, its user's name, `idle` where its devices gave no input for the idle time, and `following` where the app's window shows its view. A press on a seat's row has the app's window show that seat's view, until the person at the machine presses or types; a press on a followed seat's row ends it.

A user that asks to sit, while asking is on (`deckit seat asking`), has no row: the app asks the person at the machine, as the machine shows its own questions.

It runs in the background from the start and is no app: it has no Dock item and no window but its view. It knows the seats by what the shell tells it (`shell.seats`, MOD.md): plain data, with nothing that says which seat is the machine's or which seat pressed.

## Commands

| Command | What it does |
|---|---|
| `show` | shows the view under the item, or puts it away where it is shown |

## Permissions

| Permission | Why |
|---|---|
| `deckit.seats` | shows who sits at the desktop, and follows a seat you press |
| `deckit.panel-windows` | shows who sits under its item in the status bar when you ask |

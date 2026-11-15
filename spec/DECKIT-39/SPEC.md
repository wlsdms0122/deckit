# DECKIT-39: Seats at the desktop

Status: draft
Area: shell

## Summary

The shell serves the seats of [users and seats](../DECKIT-38/SPEC.md): every seat has the desktop for itself. This DECKIT fixes what of the desktop each seat has of its own and what every seat shares, the seat a mod acts for, which seat **holds** a window's keyboard and how an idle holder gives it up, what `seat/input` takes and answers for a pointer, a key and a text event, the output `held`, the colour a seat is told apart by, and the member `seats` of the handle `shell` with its permission `deckit.seats`, by which a mod reads who sits and who asks to, answers an ask, and has the host app's window follow a seat.

## Motivation

[Windows](../DECKIT-31/SPEC.md), [activation](../DECKIT-32/SPEC.md), [the Dock](../DECKIT-33/SPEC.md) and [the shell's keys](../DECKIT-34/SPEC.md) speak of one person. With two seats open, each of these is something two implementations could answer differently without a rule:

- One seat presses a window. One implementation brings it in front for every seat, another for that seat alone, and the second seat's typing lands in a window it did not come to, or does not.
- Two seats press the same window. One implementation hands the keyboard to the last press, and what the first seat types is cut in the middle of a word; another keeps it with the first for ever, though that seat left its devices an hour ago.
- A party sends a press at a point. One implementation answers nothing, another which window took it, and a party that cannot see the screen has no way to tell whether the keys it sends next go where it pressed.

A user's run is handed nothing but the requests of a seat, so nothing a mod or a host has in the live set could give a seat its own key window, and no mod could seat a user that asks: the shell alone knows the desktop's order.

## Rules

### Each seat's desktop

Every rule of [windows](../DECKIT-31/SPEC.md), [activation](../DECKIT-32/SPEC.md), [the Dock](../DECKIT-33/SPEC.md) and [the shell's keys](../DECKIT-34/SPEC.md) that speaks of the person, of the person's hand or of the keyboard holds for each seat: the person is the seat's user, the hand the seat's pointer, and the keyboard the seat's. What those rules keep is parted so:

| kept for each seat | kept once, for every seat |
|---|---|
| the desktop's order | which windows are open, and each one's frame, zoom and tile |
| the key window, and with it the active mod | the Dock's items and which are kept |
| which windows it minimized | each mod's run |
| which mods may activate, which are held back and which ask for attention | |
| the Dock's marks `active` and `attention` | |
| whether the Dock is out, and the menu of an item | |

So a press of a seat brings a window in front in that seat's order and makes it that seat's key window, input of a seat lets a mod activate for that seat, a mod held back for a seat asks for that seat's attention, and a shell key a seat pressed closes, minimizes or cycles by that seat's order. No other seat's order, key window or marks change by it. A window a seat closes is closed for every seat, and one a seat moves, sizes, zooms or tiles stands so for every seat.

A window that opens stands in each seat's order where [windows](../DECKIT-31/SPEC.md) places a window that opens, by that seat's key window. A window its mod brings in front comes in front for each seat by that seat's own record: for a seat the mod may activate for, as [activation](../DECKIT-32/SPEC.md) brings the window of a mod that may activate, and for any other, as it brings that of a mod held back.

A seat that opens has every open window in its order, in the order they opened, none minimized and none key. A seat that closes holds nothing any more: no window is key or minimized by it.

What the content of a window asks of its own window where [windows](../DECKIT-31/SPEC.md) gives the content the person's hand, such as the drag of its bar, is done for the seat that pressed the window last, and for the local seat where none pressed it.

The local seat's desktop is what the host app's window shows, but while it follows another seat, under *Following*.

An overlay window, which the host floats outside the desktop as [windows](../DECKIT-31/SPEC.md) fixes it, is on no seat's desktop: it stands in no seat's order, and only the machine's own devices reach it. A seat a transport connection opened neither reads it nor points at it.

### The seat a mod acts for

A mod is told nothing of seats. Where a rule has a mod act for one seat, as a view shown by activation is shown, that seat is: of the seats the mod may activate for, the one whose input reached the mod last, itself or handed on by a request; where input of none of them reached it, the one of them that opened first; and none where the mod may activate for no seat.

Inputs are counted in the order they reach the shell.

**Note.** This holds for inputs that come one after another. A mod that inputs of two seats reach close together, each before what the mod does for the other is done, acts for the later seat in both: no input carries its seat into the mod, since a mod does nothing for seats and knows none. Which seat such a mod acts for is not fixed, and this DECKIT is not accepted before it is.

### The holder

The **holder** of a window is the seat whose key window it is. A window has one holder at most: its content is one page under every seat that looks at it, and it is told `didBecomeKey` and `didResignKey` of its holder alone.

A window that would become a seat's key window while another seat holds it is **held**:

- it comes in front in the pressing seat's order, or wherever the rule that brought it places it, and does not become that seat's key window: the seat's key window stays what it was;
- a pointer event of the seat still reaches it, as *A pointer event* fixes;
- a key or text event of the seat, sent while the last window it pressed is one held from it, is refused, under *Where a seat's keys go*.

A holder that is idle, as [users and seats](../DECKIT-38/SPEC.md) fixes when a seat is idle, **gives the window up** as another seat would make it key: the window becomes that seat's key window, the idle seat is left with no key window, and it is told the output `held`, below. A key or text event of a seat tries again for the window it last pressed and was held from, so a seat held from a window takes it by its next key once the holder is idle.

A window whose holder closes or minimizes it, or makes another window key, is held by none, and the next seat that would make it key holds it.

The output `held` tells a seat that the window it held was taken:

| key | value |
|---|---|
| `of` | `held` |
| `window` | an integer: the window's id |
| `holder` | a string: the id of the seat that holds it now |

It is told from the moment a seat opens, and watched and turned off by `seat/watch` as [users and seats](../DECKIT-38/SPEC.md) fixes.

### A pointer event

`seat/input` with `event` `pointer` takes, beside `event` and `type`:

| key | value | read for |
|---|---|---|
| `x`, `y` | numbers: a point of the desktop, from its top left | every type |
| `ref` | a string: what a reading named, as the DECKIT of readings fixes a ref | every type |
| `button` | an integer: 0 the main button, 1 the middle, 2 the second | `down`, `up` |
| `buttons` | an array of such integers: the buttons held once the event is | every type |
| `modifiers` | an array of `alt`, `control`, `meta`, `shift` | every type |
| `count` | an integer: which press in a row this is, 1 the first | `down`, `up` |
| `dx`, `dy` | numbers: how far a scroll goes, positive down and right | `scroll` |

An integer is one as [a party from outside](../DECKIT-37/SPEC.md) fixes an integer, and a `button` or a `count` that is none is refused as [users and seats](../DECKIT-38/SPEC.md) refuses the `params` of a request. An `x`, a `y`, a `dx` and a `dy` may hold a fraction.

An event names its place by `x` and `y`, both, or by `ref`, never by both. It answers a table:

| key | value |
|---|---|
| `over` | what the event reached: a number, the id of a window; `dock`, the Dock; `desktop`, the desktop's own page where no window lies; or null, where it reached nothing |
| `key` | written for a `down` on a normal window: `key` where the window is the seat's key window now, `held` where another seat holds it |
| `holder` | written with `key`: the id of the seat that holds the window, or null |
| `at` | table `{ x, y }`: the point of the desktop the event went to |

A `down` and a `scroll` reach what lies at the point in the seat's order, the windows it minimized left out. A `down` on a window is the seat's press on it, as [windows](../DECKIT-31/SPEC.md) fixes the person's hand, and input of that seat to the window's mod. A `move` with a button held and the `up` that ends it reach what the `down` reached, and answer it under `over`; a `move` or an `up` with no `down` before it moves the seat's pointer alone and answers `over` null.

An event at a `ref` goes to the place the ref names. Where another window covers that place in the seat's order, the window the ref is of first comes in front, as the seat's press on it brings it.

### Where a seat's keys go

A key or text event of a seat goes to the window that holds the seat's keyboard: its key window, or the panel window it pressed last. It goes to the page there that took the seat's last press, a page laid over the content as the content itself, while that page is still laid there, and to the window's content otherwise. It is input of that seat to the window's mod.

A chord the event makes is read as [the shell's keys](../DECKIT-34/SPEC.md) read one, for that seat.

### A key event and a text event

`seat/input` with `event` `key` takes `code` and `key`, strings, as a page is told a key by them, and may take `modifiers`, as a pointer event writes it, and `repeat`, a boolean. With `event` `text` it may take `text`, a string, read for `insert` and `compose`: `insert` puts the text where the caret is; `compose` shows it as text still being composed, in place of what was being composed before it; `commit` ends the composing and keeps the text composed last; and `cancel` ends the composing and keeps none of it. A `commit` and a `cancel` read no `text`. An `insert` with no `text`, and a `commit` or a `cancel` while nothing is being composed, do nothing.

Each answers a table `{ to }`: the id of the window the event went to, or null where nothing holds the seat's keyboard, and nothing is done then.

### What refuses an input

A `seat/input` is refused at `call` with the first of these that is so, after what [users and seats](../DECKIT-38/SPEC.md) refuses of it:

1. kind `HIDDEN`, where the host app's window is hidden: no page takes input;
2. kind `INVALID_ARGUMENT`, where a pointer event names no place, names one by both `x`, `y` and `ref`, or writes an `x` or a `y` that is no finite number;
3. kind `REFUSED`, where it is a `move` at a `ref` with no button of the seat held: no page hears a pointer that only moves;
4. kind `GONE`, where its `ref` names nothing: nothing a reading named, or what one named and is there no more;
5. kind `HELD`, where it is a key or text event, the window the seat pressed last is held from it, and that window's holder is not idle.

A seat's events are done in the order its party sent them: one that takes time, as an event at a `ref` does, is answered before the next is begun.

### A seat's colour

Each seat is told apart by a **colour**, one of six names, in this order: `blue`, `green`, `orange`, `purple`, `pink`, `teal`. A seat takes as it opens the first name the fewest open seats have, so the first six seats have six colours and the seventh repeats `blue`; it gives the name back as it closes. A reading and `seats.list()` write a seat's colour by its name.

**Note.** What a name looks like is the look's, and so is everything drawn of a seat on the screen: its pointer and name, the ring around the window it holds, the line of its drag, its caret. No rule fixes any of it, and a party reads the desktop by `seat/read`, never by what is drawn for the eye.

### The member seats

`shell.seats` reads the seats and acts on them. Each member is a request, as [the shell](../DECKIT-29/SPEC.md) fixes one, guarded by `deckit.seats`, but `onChange`, which answers at once.

| member | takes | answers |
|---|---|---|
| `seats.list()` | nothing | an array, the open seats in the order they opened: each `{ id, name, colour, idle, following }` |
| `seats.asks()` | nothing | an array, the users that wait for an answer under [admission](../DECKIT-38/SPEC.md), in the order they asked: each `{ id, name }` |
| `seats.answer(ask, allow)` | an ask's `id`, and a boolean | `true` where an ask of that id waited, which is answered `allow`; `false` otherwise, and nothing is done |
| `seats.follow(seat)` | a seat's `id`, or null | whether the host app's window follows that seat now, under *Following* |
| `seats.onChange(listener)` | a function | a function that ends the registration; `listener` is called with nothing as what `list()` or `asks()` answers changes |

In what `list()` answers, `name` is the name of the seat's user, `colour` the seat's colour, `idle` whether the seat is idle, and `following` whether the host app's window follows it. In what `asks()` answers, `name` is the name of the user that asks.

An `id` here is the shell's own, a string, and not the seat's id of [users and seats](../DECKIT-38/SPEC.md): the shell gives one to each seat as it opens and to each ask as it begins to wait, the count of the ids it gave since the host app started, from 1, written in decimal digits. A seat or an ask keeps its id until the seat closes or the ask is answered or its party left, and no id is given twice in a start. An id says nothing of what it names: none tells one seat from another by its form.

`seats.answer` answers the ask whichever seat's press made the mod call it, and `seats.follow` likewise: no member is handed a seat, and no member says which seat acts.

A request is refused at `call` with kind `NOT_PERMITTED` for a mod not granted `deckit.seats`, then with kind `INVALID_ARGUMENT` where `ask` is no string, `allow` no boolean, or `seat` neither a string nor null. `onChange` throws at `call` with kind `NOT_PERMITTED` for such a mod, then with kind `INVALID_ARGUMENT` handed what is no function. Through a cut handle each is refused with kind `ENDED`, as [the shell](../DECKIT-29/SPEC.md) refuses a member of one.

**Note.** Who may answer an ask and who may have the window follow is not settled. As it stands, whoever sits at any seat does both through a mod granted `deckit.seats`, and the permission is the whole of the rule. A later DECKIT that parts what a seat may do moves this decision, and nothing here should be read as deciding that every seat may.

### Following

The host app's window shows the local seat's desktop, or **follows** one other seat: it shows that seat's desktop, in that seat's order, in the local seat's place. Following is a state of the host app's window, and of no seat: the seat followed is told nothing and nothing of its desktop changes.

`seats.follow(seat)` begins to follow the seat of that id and answers `true`. It answers `false` and changes nothing where no seat is told under that id. With null, or with the id of the local seat, the window shows the local seat's desktop again, and it answers `false`.

Following ends, the window showing the local seat's desktop again, with the first of these:

- `seats.follow(null)`, or `seats.follow` of another seat, which is followed in its place;
- a press down or a key down of the machine's own devices, which does nothing else: the press reaches no window, and what the key would do is not done until it is let go;
- the seat followed closing.

While the window follows a seat, the machine's own pointer and keyboard reach no page of the seat's desktop.

### The permission

| id | name | description | privileged |
|---|---|---|---|
| `deckit.seats` | Seats | It can see who sits at the desktop and who asks to, answer one that asks, and show the view of one that sits. | yes |

It guards every member of `shell.seats`.

## Interactions

- A user, a seat and its id, the local seat, admission and the ask, `idleTime` and when a seat is idle, `seat/input`, `seat/watch`, `seat/output`, the tables of events and outputs, and what a layer serves: [users and seats](../DECKIT-38/SPEC.md). The shell is the layer that serves input, a reading and the ask.
- The desktop, its order, the key window, the levels, the person's hand, a window's frame, zoom and tile, `didBecomeKey` and `didResignKey`: [windows](../DECKIT-31/SPEC.md).
- The active mod, who may activate, input and a request, a mod held back and attention: [activation](../DECKIT-32/SPEC.md).
- The Dock, its items and marks, a click, the menu and the drag of an item: [the Dock](../DECKIT-33/SPEC.md).
- A chord and the shell's own keys: [the shell's keys](../DECKIT-34/SPEC.md).
- The handle `shell`, a request, a registration, `ENDED` and how the shell defines a permission: [the shell](../DECKIT-29/SPEC.md). A privileged permission and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- `[host] seats`, the key `seat` of the looks `windows`, `desktop` and `dock`, a party of a case and the look `told`: [the case format](../DECKIT-1/SPEC.md).
- `HIDDEN`, `HELD` and `REFUSED` of an input: here.

## Alternatives considered

- One desktop that every seat shares whole: one order and one key window. A press of one seat would take the keyboard from under another's typing, and two users could not work in two windows at once.
- A desktop of its own for each seat, with windows of its own. A mod would have to open a window for each seat and so know the seats; a mod does nothing for seats, and one window is under every seat that looks at it.
- A window's keyboard to the last seat that pressed it. What the holder types would be cut by a press of another; the window stays with its holder until the holder leaves it or is idle.
- A holder that never gives up. A seat that left its devices would keep a window from every other for as long as its run goes; the idle time a host sets ends that.
- Every rule of the desktop written again for a seat in its own DECKIT. Four DECKITs would say each thing twice; one rule reads them for each seat, as [a party from outside](../DECKIT-37/SPEC.md) reads a run for its principal.
- A seat named in what a mod is handed, so a mod acts for the seat that asked. A mod would tell seats apart, and with them who asks; the shell keeps for which seat a mod acts.
- The ids of `shell.seats` being the seats' own ids. `local` would tell a mod which seat is the machine's; an id here is a count.
- Following as a seat that watches another. The seat followed would have two users at one view; only the host app's window, which is no seat, shows another's desktop.

## Notes

**Note.** What this costs an implementation: it keeps the desktop's order, the key window, the minimized windows and the record of activation once for each seat; lays the stage out for each seat that reads or points; keeps for each window its holder and asks the system whether that holder is idle; and tells every content what is so of its holder alone.

**Note.** No case holds these, each for its reason. A seat's events done in the order sent: a party of a case asks one request and waits for its answer before the next. `ENDED` of a cut handle: no `call` of a case reaches one, as [the shell](../DECKIT-29/SPEC.md) notes. What is drawn of a seat, since no look reads the screen. A seventh seat's colour, since a case's host would attach six parties to reach it. Two inputs close together, which no rule fixes. Following ended by a press or a key of the machine's own devices: the person's press and key of the base `shell` of [the case format](../DECKIT-1/SPEC.md) come of no device of the machine. Following ended by the seat followed closing, and `seats.follow` with null: once the seat is closed no member answers whether the window follows it, and a case writes no null. The menu of an item open for one seat alone, and the Dock out for one: no look reads either. The 4 of a drag of an item by a seat: a case knows no point of an item, which is the look's. `HIDDEN`: that base shows the host app's window from its start, and no input of a case hides it. An `x` or a `y` that is no finite number, and a `button` or a `count` that is no integer: a case writes no number but an integer. An event at the `ref` of an element of a window's content: such a ref is known only from a reading, which no look answers, so the cases at a `ref` write `w1.bar`, the title bar of the window of the id 1, `dock.mod-b`, the Dock's item of the mod `mod-b`, and `dock-menu.quit` and `dock-menu.keep`, the choices of the menu open for the seat that quit the app and that keep it or take it out. A registration of `seats.onChange` ended: what the member answers is a function, and a `call` of a case calls a member of what a call answered, never the answer itself.

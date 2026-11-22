# DECKIT-39: Seats at the desktop

Status: draft
Area: shell

## Summary

The shell serves the seats of [users and seats](../DECKIT-38/SPEC.md): every seat has the desktop for itself. This DECKIT fixes what of the desktop each seat has of its own and what every seat shares, each seat's screen and camera and the event `screen` that sizes them, the seat a mod acts for, the one **focus** a window's content has under every seat whose key window it is, what `seat/input` takes and answers for a pointer, a key and a text event, what a seat's key does in a page, a seat's clipboard and the event `clipboard` that pastes, the colour a seat is told apart by, and the member `seats` of the handle `shell` with its permission `deckit.seats`, by which a mod reads who sits and has the host app's window follow a seat.

## Motivation

[Windows](../DECKIT-31/SPEC.md), [activation](../DECKIT-32/SPEC.md), [the Dock](../DECKIT-33/SPEC.md) and [the shell's keys](../DECKIT-34/SPEC.md) speak of one person. With two seats open, each of these is something two implementations could answer differently without a rule:

- One seat presses a window. One implementation brings it in front for every seat, another for that seat alone, and the second seat's typing lands in a window it did not come to, or does not.
- Two seats press the same window. One implementation hands the keyboard to the last press, and the first seat's keys go nowhere; another keeps it with the first, and the second cannot type where it pressed; a third has both type, into the one field the page's focus is in.
- A party sends a press at a point. One implementation answers nothing, another which window took it, and a party that cannot see the screen has no way to tell whether the keys it sends next go where it pressed.

A user's run is handed nothing but the requests of a seat, so nothing a mod or a host has in the live set could give a seat its own key window: the shell alone knows the desktop's order.

## Rules

### Each seat's desktop

Every rule of [windows](../DECKIT-31/SPEC.md), [activation](../DECKIT-32/SPEC.md), [the Dock](../DECKIT-33/SPEC.md) and [the shell's keys](../DECKIT-34/SPEC.md) that speaks of the person, of the person's hand or of the keyboard holds for each seat: the person is the seat's user, the hand the seat's pointer, and the keyboard the seat's. What those rules keep is parted as [users and seats](../DECKIT-38/SPEC.md) parts every state, so:

| kept for each seat | kept once, for every seat |
|---|---|
| its screen's size and its camera | a panel window's room and a view's size, by the host app's window |
| the desktop's order | which windows are open, and each one's frame, zoom and tile, and the dialog a page asks in one |
| the key window, and with it the active mod | the Dock's items and which are kept |
| which windows it minimized | each mod's run |
| which mods may activate, which are held back and which ask for attention | where each page's pointer is |
| the Dock's marks `active` and `attention` | |
| whether the Dock is out, and the menu of an item | |

So a press of a seat brings a window in front in that seat's order and makes it that seat's key window, input of a seat lets a mod activate for that seat, a mod held back for a seat asks for that seat's attention, and a shell key a seat pressed closes, minimizes or cycles by that seat's order. No other seat's order, key window or marks change by it. A window a seat closes is closed for every seat, and one a seat moves, sizes, zooms or tiles stands so for every seat.

Each seat has its **screen**, on which it sees the desktop through its own **camera**, as [windows](../DECKIT-31/SPEC.md) fixes the camera the host app's window shows. The local seat's screen is the host app's window; another seat's is the size it tells under *A screen event*, and the size of the host app's window until it tells one. A seat's camera is as large as its screen, and the bar, the Dock and the zoom area are of each seat's camera, so a rule of windows that speaks of the camera speaks of one seat's:

- a tile, the zoom area a window is zoomed to and an edge met are of the zoom area of the seat whose hand or key it is;
- a frame let go is brought into reach of the camera of the seat whose hand let it go, and a window that opens, or that `resize` sizes, is placed and brought into reach in the camera of the seat its mod acts for, under *The seat a mod acts for*, and in the local seat's where it acts for none;
- a seat's camera moves as a scroll of that seat on the desktop moves it, and as a window becomes that seat's key window while it is out of reach, and no other seat's camera moves by it.

What is sized once, for every seat, is sized by the host app's window: a panel window's room in the bar, and a view's size, as [views](../DECKIT-41/SPEC.md) bound it. Where each stands is each seat's: a panel window in the bar, and a view under its anchor or at its place, stand on each seat's screen in that seat's camera.

A window that opens stands in each seat's order where [windows](../DECKIT-31/SPEC.md) places a window that opens, by that seat's key window. A window its mod brings in front comes in front for each seat by that seat's own record: for a seat the mod may activate for, as [activation](../DECKIT-32/SPEC.md) brings the window of a mod that may activate, and for any other, as it brings that of a mod held back.

A seat that opens has every open window in its order, in the order they opened, none minimized and none key, and its camera's top left where the local seat's camera's is then. A seat that closes holds nothing any more: no window is key or minimized by it.

What the content of a window asks of its own window where [windows](../DECKIT-31/SPEC.md) gives the content the person's hand, such as the drag of its bar, is done for the seat that pressed the window last, and for the local seat where none pressed it.

The local seat's camera is what the host app's window shows, but while it follows another seat, under *Following*.

An overlay window, which the host floats outside the desktop as [windows](../DECKIT-31/SPEC.md) fixes it, is on no seat's desktop: it stands in no seat's order, and only the machine's own devices reach it. A seat a transport connection opened neither reads it nor points at it.

### The seat a mod acts for

A mod is told nothing of seats. Where a rule has a mod act for one seat, as a view shown by activation is shown, that seat is: of the seats the mod may activate for, the one whose input reached the mod last, itself or handed on by a request; where input of none of them reached it, the one of them that opened first; and none where the mod may activate for no seat.

Inputs are counted in the order they reach the shell.

**Note.** This holds for inputs that come one after another. A mod that inputs of two seats reach close together, each before what the mod does for the other is done, acts for the later seat in both: no input carries its seat into the mod, since a mod does nothing for seats and knows none. Which seat such a mod acts for is not fixed, and this DECKIT is not accepted before it is.

### The focus

Which window is a seat's key window is the seat's own, and nothing of another seat changes it: a window may be the key window of several seats at once. A window **holds a seat's keyboard** while it is that seat's key window and no view is shown for that seat by activation, and a view holds it while it is shown for that seat by activation, as [views](../DECKIT-41/SPEC.md) fix it. A window or a view may hold the keyboard of several seats at once.

The content of a window or a view is one page under every seat that looks at it, and its **focus** is the page's, one for every seat, as its pointer is: one element of it takes the keys and the text, whichever seat's they are. So two seats whose keyboard one window holds type into the same field, and what a seat types lands where the last press of any seat, or the page itself, put the focus.

The content has the focus while its window or view holds the keyboard of any seat: its document answers `hasFocus()` true, it hears `focus` as the window or view comes to hold the keyboard of a seat while it held none's, and it hears `blur` as it holds none's any more. The window or view is told `didBecomeKey` and `didResignKey` at those same two moments, and is key between them: a second seat whose keyboard it comes to hold, and a seat whose keyboard it holds no more while it holds another's, tell it nothing. Nothing else moves the focus: neither which app has the machine's keyboard nor another seat's key window.

No press on a window's content, of whatever button and with whatever keys held, opens a menu that is not the content's own: the content hears `contextmenu` as it hears any event of the press, and a menu it draws is its content, which every seat that looks at it sees.

### What the shell names

The shell serves input and a reading, as [users and seats](../DECKIT-38/SPEC.md) fixes what a layer serves. It takes these kinds of device; the outputs it reads, and `changes`, which it tells, are those of [what a seat reads](../DECKIT-40/SPEC.md), and it tells `clipboard` besides, under *A seat's clipboard*.

| `event` | `type` |
|---|---|
| `pointer` | `move`, `down`, `up`, `scroll` |
| `key` | `down`, `up` |
| `text` | `insert`, `compose`, `commit`, `cancel` |
| `screen` | `resize` |
| `clipboard` | `paste` |

### A pointer event

`seat/input` with `event` `pointer` takes, beside `event` and `type`:

| key | value | read for |
|---|---|---|
| `x`, `y` | numbers: a point of the desktop, as [windows](../DECKIT-31/SPEC.md) sets `x` and `y` | every type |
| `ref` | a string: what a reading named, a ref as [what a seat reads](../DECKIT-40/SPEC.md) fixes one | every type |
| `button` | an integer: 0 the main button, 1 the middle, 2 the second | `down`, `up` |
| `buttons` | an array of such integers: the buttons held once the event is | every type |
| `modifiers` | an array of `alt`, `control`, `meta`, `shift` | every type |
| `count` | an integer: which press in a row this is, 1 the first | `down`, `up` |
| `dx`, `dy` | numbers: how far a scroll goes, positive down and right | `scroll` |

An integer is one as [a party from outside](../DECKIT-37/SPEC.md) fixes an integer, and a `button`, a `count`, a `width` or a `height` that is none is refused as [users and seats](../DECKIT-38/SPEC.md) refuses the `params` of a request. An `x`, a `y`, a `dx` and a `dy` may hold a fraction.

An event names its place by `x` and `y`, both, or by `ref`, never by both. It answers a table:

| key | value |
|---|---|
| `over` | what the event reached: a number, the id of a window; `dock`, the Dock; `desktop`, the desktop's own page where no window lies; or null, where it reached nothing |
| `key` | written for a `down` that reached a window: a boolean, whether the seat's key and text events go to that window after it, under *Where a seat's keys go* |
| `at` | table `{ x, y }`: the point of the desktop the event went to |

A `down`, a `scroll` and a `move` with no button of the seat held reach what lies at the point in the seat's order, the windows it minimized left out, and nothing where the point is outside the seat's camera. A `down` on a window is the seat's press on it, as [windows](../DECKIT-31/SPEC.md) fixes the person's hand, and input of that seat to the window's mod. A `scroll` that reaches the desktop is the seat's scroll on it, which moves the seat's camera by `dx`, `dy`, as windows fixes the person's hand. A `move` with a button held and the `up` that ends it reach what the `down` reached, and answer it under `over`; an `up` with no `down` before it moves the seat's pointer alone and answers `over` null.

Where the pointer is over a page, and whether the page is hovered, is the page's, one for every seat: a page has one pointer, and the last move of any seat places it. A `move` with no button held is heard by the page of the window it reaches as that page hears the machine's own pointer move: the pointer comes over what lies there, enters it and moves; and a page whose pointer a move of that seat placed, and that this move left, hears the pointer leave it. Such a move presses nothing: it brings no window in front, makes no window key and changes no seat's order, and it is no input to a mod, as the machine's own pointer moving is none in [activation](../DECKIT-32/SPEC.md).

An event at a `ref` goes to the place the ref names. Where another window covers that place in the seat's order, the window the ref is of first comes in front, as the seat's press on it brings it; a `move` with no button held brings none, and reaches what lies there.

### Where a seat's keys go

A key or text event of a seat goes to the window that holds the seat's keyboard, under *The focus*: its key window, or in its place the view shown for the seat by activation, as [views](../DECKIT-41/SPEC.md) fix a view's keyboard. That the window holds another seat's keyboard too changes nothing of where the event goes. A panel window in the bar is never key and holds no seat's keyboard, so a seat's press there leaves its keys with the window that holds them. In that window the event goes to the page that took the seat's last press, a page laid over the content as the content itself, while that page is still laid there, and to the window's content otherwise. A dialog a page asks, read as [a window](../DECKIT-40/SPEC.md) reads it, covers the page that waits on it and, where that page is the window's content, every page laid over that content: an event that would go to a page a dialog covers goes to the dialog asked last of those that cover it, Return pressing OK or Leave, Escape Cancel or Stay, and text and Backspace editing a prompt's field, and one that would go to a page no dialog covers goes there, where the page's one focus takes it. It is input of that seat to the window's mod.

A chord the event makes is read as [the shell's keys](../DECKIT-34/SPEC.md) read one, for that seat.

A key of a seat does in the page it goes to what the same key of the machine's own keyboard does there, the edits of a page's text among them: undo and redo, cut, copy and paste, and select all, each with the seat's own clipboard, under *A seat's clipboard*. A key that acts on the host app and not on a page, as one that quits or hides the app, is the machine's own keyboard's alone: a seat's key goes no further than what [the shell's keys](../DECKIT-34/SPEC.md) say a key pressed in a page goes to.

### A screen event

`seat/input` with `event` `screen` and `type` `resize` tells the size of the seat's screen by `width` and `height`, integers 1 or more. It sets the size of the seat's camera to them, its top left where it was, and answers the camera, a table `{ x, y, width, height }`. A party tells it as its seat opens and as its screen changes size. The local seat's screen is the host app's window, which no event sizes.

### A key event and a text event

`seat/input` with `event` `key` takes `code` and `key`, strings, as a page is told a key by them, and may take `modifiers`, as a pointer event writes it, and `repeat`, a boolean. With `event` `text` it may take `text`, a string, read for `insert` and `compose`: `insert` puts the text where the caret is; `compose` shows it as text still being composed, in place of what was being composed before it; `commit` ends the composing and keeps the text composed last; and `cancel` ends the composing and keeps none of it. A `commit` and a `cancel` read no `text`. An `insert` with no `text`, and a `commit` or a `cancel` while nothing is being composed, do nothing.

Each answers a table `{ to }`: the id of the window the event went to, or null where nothing holds the seat's keyboard, and nothing is done then.

### A seat's clipboard

A seat's **clipboard** is of its input and output, as its pointer and keyboard are, and is where the seat's party keeps it. The local seat's is [the clipboard](../DECKIT-20/SPEC.md), the machine's. A seat a transport connection opened has the one its party holds, and the host keeps none for it.

`seat/input` with `event` `clipboard` and `type` `paste` takes `text`, a string, the plain text pasted. The page the seat's key events go to, under *Where a seat's keys go*, hears a paste of that text as it hears one of the machine's own key, and where the page does not prevent it the text is put in where the caret is, in place of what is selected, an edit the page's undo takes back. A `paste` with no `text` does nothing. It answers a table `{ to }`, as a key event does.

A key of a seat a transport connection opened that copies or cuts is heard by the page as the machine's own key's copy or cut. The text copied, what the page set for it or else what is selected, is told to the seat's party as `{ of = "clipboard", text }`, from the moment the seat opens, as [users and seats](../DECKIT-38/SPEC.md) lets a layer tell an output; and where the page does not prevent a cut, it removes what is selected, an edit the page's undo takes back. The machine's clipboard stays as it was.

### What refuses an input

A `seat/input` is refused at `call` with the first of these that is so, after what [users and seats](../DECKIT-38/SPEC.md) refuses of it:

1. kind `HIDDEN`, where the host app's window is hidden: no page takes input;
2. kind `INVALID_ARGUMENT`, where a pointer event names no place, names one by both `x`, `y` and `ref`, writes an `x` or a `y` that is no finite number, writes a `button` or a `count` below 0, which is no count, or where a screen event writes a `width` or a `height` below 1;
3. kind `GONE`, where its `ref` names nothing, as [what a seat reads](../DECKIT-40/SPEC.md) fixes when a ref does: nothing a reading named, or what one named and is there no more.

A seat's events are done in the order its party sent them: one that takes time, as an event at a `ref` does, is answered before the next is begun.

### A seat's colour

Each seat is told apart by a **colour**, one of six names, in this order: `blue`, `green`, `orange`, `purple`, `pink`, `teal`. A seat takes as it opens the first name the fewest open seats have, so the first six seats have six colours and the seventh repeats `blue`; it gives the name back as it closes. A reading and `seats.list()` write a seat's colour by its name.

**Note.** What a name looks like is the look's, and so is everything drawn of a seat on the screen: its pointer and name, the ring around its key window, the line of its drag, its caret. No rule fixes any of it, and a party reads the desktop by `seat/read`, never by what is drawn for the eye.

### The member seats

`shell.seats` reads the seats and acts on them. Each member is a request, as [the shell](../DECKIT-29/SPEC.md) fixes one, guarded by `deckit.seats`, but `onChange`, which answers at once.

| member | takes | answers |
|---|---|---|
| `seats.list()` | nothing | an array, the open seats in the order they opened: each `{ id, name, colour, idle, following }` |
| `seats.follow(seat)` | a seat's `id`, or null | whether the host app's window follows that seat now, under *Following* |
| `seats.onChange(listener)` | a function | a function that ends the registration; `listener` is called with nothing as what `list()` answers changes |

In what `list()` answers, `name` is the name of the seat's user, `colour` the seat's colour, `idle` whether the seat is idle, and `following` whether the host app's window follows it.

An `id` here is the shell's own, a string, and not the seat's id of [users and seats](../DECKIT-38/SPEC.md): the shell gives one to each seat as it opens, the count of the ids it gave since the host app started, from 1, written in decimal digits. A seat keeps its id until it closes, and no id is given twice in a start. An id says nothing of what it names: none tells one seat from another by its form.

`seats.follow` does the same whichever seat's press made the mod call it: no member is handed the seat that acts, and no member says which seat acts.

A request is refused at `call` with kind `NOT_PERMITTED` for a mod not granted `deckit.seats`, then with kind `INVALID_ARGUMENT` where `seat` is neither a string nor null. `onChange` throws at `call` with kind `NOT_PERMITTED` for such a mod, then with kind `INVALID_ARGUMENT` handed what is no function. Through a cut handle each is refused with kind `ENDED`, as [the shell](../DECKIT-29/SPEC.md) refuses a member of one.

**Note.** Who may have the window follow is not settled. As it stands, whoever sits at any seat has it follow through a mod granted `deckit.seats`, and the permission is the whole of the rule. A later DECKIT that parts what a seat may do moves this decision, and nothing here should be read as deciding that every seat may.

### Following

The host app's window shows the local seat's desktop, or **follows** one other seat: it shows that seat's desktop, in that seat's order, in the local seat's place, through a camera as large as the host app's window whose centre is that of the seat's camera. The local seat's own camera does not change while it follows, and is shown again as following ends. Following is a state of the host app's window, and of no seat: the seat followed is told nothing and nothing of its desktop changes.

`seats.follow(seat)` begins to follow the seat of that id and answers `true`. It answers `false` and changes nothing where no seat is told under that id. With null, or with the id of the local seat, the window shows the local seat's desktop again, and it answers `false`.

Following ends, the window showing the local seat's desktop again, with the first of these:

- `seats.follow(null)`, or `seats.follow` of another seat, which is followed in its place;
- a press down or a key down of the machine's own devices, which does nothing else: the press reaches no window, and what the key would do is not done until it is let go;
- the seat followed closing.

While the window follows a seat, the machine's own pointer and keyboard reach no page of the seat's desktop.

### The permission

| id | name | description | privileged |
|---|---|---|---|
| `deckit.seats` | Seats | It can see who sits at the desktop, and show the view of one that sits. | yes |

It guards every member of `shell.seats`.

## Interactions

- A user, a seat and its id, the local seat, admission, `idleTime` and when a seat is idle, `seat/input`, `seat/watch`, `seat/output`, what a layer serves and names, and the refusals of a seat's requests: [users and seats](../DECKIT-38/SPEC.md). The shell is the layer that serves input and a reading.
- The desktop, its order, the key window, the levels, the person's hand, a window's frame, zoom and tile, `didBecomeKey` and `didResignKey`: [windows](../DECKIT-31/SPEC.md).
- The active mod, who may activate, input and a request, a mod held back and attention: [activation](../DECKIT-32/SPEC.md).
- The Dock, its items and marks, a click, the menu and the drag of an item: [the Dock](../DECKIT-33/SPEC.md).
- A chord and the shell's own keys: [the shell's keys](../DECKIT-34/SPEC.md).
- The machine's clipboard, which is the local seat's and which a mod's request reads and writes: [the clipboard](../DECKIT-20/SPEC.md).
- The handle `shell`, a request, a registration, `ENDED` and how the shell defines a permission: [the shell](../DECKIT-29/SPEC.md). A privileged permission and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- `[host] seats`, the key `seat` of the looks `windows`, `desktop` and `dock`, a party of a case, the look `told` and a step settled once a seat's output is sent: [the case format](../DECKIT-1/SPEC.md).
- A reading, a ref and when it names nothing, the mark and the output `changes`: [what a seat reads](../DECKIT-40/SPEC.md).
- `HIDDEN` of an input, the focus, a seat's screen and its camera: here.
- The camera, a scroll on the desktop and a window made key out of reach: [windows](../DECKIT-31/SPEC.md).

## Alternatives considered

- One desktop that every seat shares whole: one order and one key window. A press of one seat would take the keyboard from under another's typing, and two users could not work in two windows at once.
- A desktop of its own for each seat, with windows of its own. A mod would have to open a window for each seat and so know the seats; a mod does nothing for seats, and one window is under every seat that looks at it.
- One camera for every seat, as one frame is. A seat that scrolls would move every other seat's view, and a seat with a smaller screen would see a part of what another sees; each seat looks through its own camera, and a frame stays one.
- A camera that sizes what is sized once, a view's bounds and a panel window's room. A mod sizes its panel window by one room and a view by one size; they are the host app's window's, and each seat's camera places them.
- A window's keyboard held by one seat at a time, a second seat that presses the window kept from its keys until the first leaves it or gives no input for a time. The focus is the page's, as its pointer and its scroll are, and a window that is shared to one device and one seat's to another is two things; every seat whose key window it is types in it. What is lost: what one seat types lands where another seat's press last put the focus.
- Every rule of the desktop written again for a seat in its own DECKIT. Four DECKITs would say each thing twice; one rule reads them for each seat, as [a party from outside](../DECKIT-37/SPEC.md) reads a run for its principal.
- A seat named in what a mod is handed, so a mod acts for the seat that asked. A mod would tell seats apart, and with them who asks; the shell keeps for which seat a mod acts.
- `shell.seats` reading and answering the users that ask to sit. Who sits is the machine's, as [users and seats](../DECKIT-38/SPEC.md) part every state, and a mod acts in the shared state for whichever seat's input reaches it, so a seat from outside would admit or refuse another; the host asks whoever is at the machine.
- The ids of `shell.seats` being the seats' own ids. `local` would tell a mod which seat is the machine's; an id here is a count.
- A content's focus that follows each seat's key window. A seat's key window is its own: a press of one seat elsewhere would blur the content another seat types in, and close there what closes as it blurs, as a menu.
- One clipboard for every seat, the machine's. A seat could not paste what its own device copied, and what one seat copied any seat could paste.
- A mod's request of [the clipboard](../DECKIT-20/SPEC.md) following the seat whose input led to it. A mod would have to know of seats; a mod does nothing for seats, so its request reads and writes the machine's clipboard.
- A pointer over a page for each seat. A page would hear several pointers and tell them apart, and with them the seats; a page has one, which the last move of any seat places.
- Following as a seat that watches another. The seat followed would have two users at one view; only the host app's window, which is no seat, shows another's desktop.

## Notes

**Note.** What this costs an implementation: it keeps the desktop's order, the key window, the minimized windows, the camera and the screen's size and the record of activation once for each seat; lays the stage out for each seat that reads or points; keeps for each window and view the seats whose keyboard it holds, and tells its content the focus by whether it holds any; does for a seat's key in its page what the host app does for the machine's key there, but that a seat's copy, cut and paste go to and come from its party; and asks the system when each seat's devices last gave input, for `idle` of `seats.list()`.

**Note.** What a seat's clipboard leaves out: text alone crosses between a seat's party and its page, and what a mod's request copies reaches no party's clipboard. Carrying it across is a matter apart, which this DECKIT does not rule.

**Note.** No case holds these, each for its reason. That a press the host's input `window` makes opens no menu but the content's: that `press` of [the case format](../DECKIT-1/SPEC.md) is of the main button with no key held, which opens none, and a seat's press of the second button holds the rule. A seat's events done in the order sent: a party of a case asks one request and waits for its answer before the next. `ENDED` of a cut handle: no `call` of a case reaches one, as [the shell](../DECKIT-29/SPEC.md) notes. What is drawn of a seat, since no look reads the screen. A seventh seat's colour, since a case's host would attach six parties to reach it. Two inputs close together, which no rule fixes. Following ended by a press or a key of the machine's own devices: the person's press and key of the base `shell` of [the case format](../DECKIT-1/SPEC.md) come of no device of the machine. Following ended by the seat followed closing, and `seats.follow` with null: once the seat is closed no member answers whether the window follows it, and a case writes no null; `seats.follow` with null is held only as [the seats mod](../DECKIT-44/SPEC.md) asks it, a press on the row of the seat followed. The menu of an item open for one seat alone, and the Dock out for one: no look reads either. The 4 of a drag of an item by a seat: a case knows no point of an item, which is the look's. `HIDDEN`: that base shows the host app's window from its start, and no input of a case hides it. An `x` or a `y` that is no finite number, and a `button` or a `count` that is no integer: a case writes no number but an integer. An event at the `ref` of an element of a window's content: such a ref is known only from a reading, which no look answers, so the cases at a `ref` write `w1.bar`, the title bar of the window of the id 1, `dock.mod-b`, the Dock's item of the mod `mod-b`, and `dock-menu.quit` and `dock-menu.keep`, the choices of the menu open for the seat that quit the app and that keep it or take it out. What the host app's window shows while it follows a seat: the looks `windows`, `desktop` and `dock` read a seat's screen, the local seat's where they name none. A registration of `seats.onChange` ended: what the member answers is a function, and a `call` of a case calls a member of what a call answered, never the answer itself. That the local seat's clipboard is the machine's, and that a seat a transport connection opened leaves the machine's clipboard as it was: a case never reads or replaces the clipboard of whoever runs it, as [the clipboard](../DECKIT-20/SPEC.md) notes, and the clipboard the base `system` keeps in its place is the one a mod's request reads, not one a page's copy writes. That a pasted text is plain text: a case writes `text` as a string, and no other form.

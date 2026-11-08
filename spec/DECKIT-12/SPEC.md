# DECKIT-12: Events

Status: draft
Area: system

## Summary

An event is a name and values a run sends through its handle, told to every run that listens to the name and may hear it. It is a broadcast: the sender names no receiver, is answered nothing and is not told who heard it, and no run asks another anything by one. This DECKIT fixes `events.emit` and `events.on`, the members of [the handle](../DECKIT-7/SPEC.md) that send and hear events, what an event is named after, who may hear it, what a listener is handed and in what order, the signals the system tells of an interface, and `mods.onChange`, which tells a mod granted `deckit.mods` that the mods may have changed.

## Motivation

[The handle](../DECKIT-7/SPEC.md) lists `events` and `mods.onChange` and leaves them here, and [the interfaces](../DECKIT-10/SPEC.md) fix who owns an interface and leave how its owner tells its clients that something happened. A mod author writes one entry for every implementation, so each of these is a call two implementations could answer differently without a rule.

`mod-b` owns `mod-b/pages`, and `mod-c` provides it too:

```js
deckit.events.emit("mod-b/pages:changed", "page-1"); // in mod-b, and in mod-c
```

On one implementation both are heard by every mod that uses `mod-b/pages`, so `mod-c` speaks for an interface it does not own and a client cannot tell the two apart. On another only `mod-b`'s is. A mod that uses the interface listens to it:

```js
deckit.events.on("mod-b/pages:changed", (page) => this.reload(page));
deckit.events.on("mod-d:status", (status) => this.show(status));
```

The second line hears `mod-d`'s events on one implementation, is refused on another, and on a third adds a listener that is never called, so a mod cannot tell a name it may not hear from an event that never came. A listener handed twice is called twice on one and once on another.

A mod manager redraws its list as the mods change:

```js
deckit.mods.onChange(() => this.redraw());
```

Whether a mod not granted `deckit.mods` is refused here, with what kind, and whether the listener is told once for a launch or once for each state the run passes through, decide whether one mod manager works on every implementation.

## Rules

### What an event is

An **event** is a name, an `event-name`, and the values it carries, in order:

```
event-name = owner ":" signal
owner      = id / interface        ; as the bundle names them
signal     = 1*( %x00-10FFFF )     ; any text, not empty
```

The `owner` is what the event is named after: a mod's `id`, or an `interface`, as [the bundle](../DECKIT-2/SPEC.md) names them, neither of which holds a `:`. The `signal` is the rest of the name after the first `:`. The values are values as [the handle](../DECKIT-7/SPEC.md) fixes them, and each run that hears the event is handed a copy of them, as [the connections](../DECKIT-9/SPEC.md) say a value crosses.

### Sending an event

`events.emit(name, ...values)`, a member of [the handle](../DECKIT-7/SPEC.md), is not a request: it answers nothing, and throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one.

| takes | type | required | what it is |
|---|---|---|---|
| `name` | string | yes | the event's name, as the run sends it |
| `values` | values, any number | no | what the event carries |

The event sent is named:

- `name`, where `name` is an `event-name` whose `owner` is an interface the mod owns, as [the interfaces](../DECKIT-10/SPEC.md) fix the owner as the event is sent: a **signal** of the interface;
- `<id>:<name>`, `id` the mod's `id`, for every other `name`.

It is refused at `call` with kind `INVALID_ARGUMENT`, and sends nothing, where `name` is not a string or a value is not a value, as [the handle](../DECKIT-7/SPEC.md) fixes values.

It sends nothing, and is not refused, where:

- the run is not `running`, as [the lifecycle](../DECKIT-5/SPEC.md) fixes the states of a run;
- it is a signal named `<interface>:owner-changed` or `<interface>:contributions-changed`, which the system tells, under *What the system tells of an interface*.

### Listening

`events.on(name, listener)`, a member of [the handle](../DECKIT-7/SPEC.md), is not a request: it adds `listener` for `name` in the lifecycle whose handle it is called on, and answers a function that removes it. It throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one.

| takes | type | required | what it is |
|---|---|---|---|
| `name` | string, an `event-name` | yes | the name listened to |
| `listener` | function | yes | what is called with each event of that name the run hears |

A mod **hears** the names whose `owner` is its own `id`, or an interface it uses or provides, as [the interfaces](../DECKIT-10/SPEC.md) fix providing and using. It is refused with the first of these that is so, and adds nothing:

1. at `call` with kind `INVALID_ARGUMENT`, where `name` is not a string or not an `event-name`, or `listener` is not a function;
2. at `call` with kind `NOT_PERMITTED`, where the mod does not hear `name`.

A listener is added once for a name: handed again for the same name in the same run, it is still called once for each event. It is removed once the function `on` answered is called, or once the lifecycle whose handle `on` was called on ends, whichever comes first.

### Who hears an event

An event is told to each run that is `running` and that has a listener for its name, and to no other:

| the event | is heard by |
|---|---|
| named after a mod's `id` | that mod's own run |
| a signal of an interface | each mod that uses or provides the interface, its owner among them |

Each listener for the event's name is called once, with a copy of the event's values, in order. A run's listeners for one name are called in the order they were added. The events one run sends are heard in the order it sends them. A listener added after an event was told is not called for it.

### What the system tells of an interface

The system tells two signals of an interface, `<interface>:<signal>`, with no values, to those that hear the interface, as *Who hears an event* says of a signal:

| signal | told once |
|---|---|
| `owner-changed` | the interface's owner has changed, as [the interfaces](../DECKIT-10/SPEC.md) fix the owner |
| `contributions-changed` | the entries declared to the interface, as [the interfaces](../DECKIT-10/SPEC.md) answer them, have changed |

### Being told the mods changed

`mods.onChange(listener)`, a member of [the handle](../DECKIT-7/SPEC.md), is not a request: it adds `listener` in the lifecycle whose handle it is called on, and answers a function that removes it. It throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one.

| takes | type | required | what it is |
|---|---|---|---|
| `listener` | function | yes | what is called once what `mods.list()` answers may have changed |

`deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards it. It is refused with the first of these that is so, and adds nothing:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`;
2. at `call` with kind `INVALID_ARGUMENT`, where `listener` is not a function.

`listener` is called with no values, at least once after what `mods.list()` answers, as [the catalog](../DECKIT-4/SPEC.md) and [the lifecycle](../DECKIT-5/SPEC.md) fix it, may have changed: a bundle found or gone, or a run that moved. Changes that come together may be told by one call. It is removed as `events.on`'s listener is.

**Note.** `mods.onChange` says only that the list may have changed: a listener reads `mods.list()` again for what did. How many calls a launch comes to is not fixed, so a mod that counts them counts what no rule states.

## Interactions

- The `id` and `interface` names, and the values of the manifest text: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods`, what a mod is granted and the refusal `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- What `mods.list()` answers: [the catalog](../DECKIT-4/SPEC.md). A run's states, and a run that is `running`: [the lifecycle](../DECKIT-5/SPEC.md).
- A run's lifecycles, and when one ends: [the entry](../DECKIT-6/SPEC.md).
- The handle, values, and an error with its stage, kind and message: [the handle](../DECKIT-7/SPEC.md).
- How a value crosses as a copy: [the connections](../DECKIT-9/SPEC.md). Asking one mod something and being answered: [the connections](../DECKIT-9/SPEC.md) and [calls across a connection](../DECKIT-11/SPEC.md).
- Providing and using an interface, its owner, a pin, and what is declared to it: [the interfaces](../DECKIT-10/SPEC.md).
- The listener a case hands, and the look at what it heard: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- An event a mod sends to a mod it names. A sender would choose its receivers, and a run would be asked something it cannot answer; asking is what a connection is for, and an event says only what happened to its sender.
- An event named as the sender writes it. A mod could send another's events, or an interface's it does not own, and a listener could not tell who spoke. An event is named after the mod that sent it, or after an interface its owner speaks for.
- Every provider of an interface sending its signals. Two providers would speak for one interface, and a client connected to the owner would hear the others too.
- A name a mod may not hear taken, and its listener never called. A mod could not tell a name it may not hear from an event that never came; a refusal says which it is at once.
- `on` and `mods.onChange` as requests that answer a promise. What they answer, the function that removes the listener, is no value, and a listener added later than the call would miss what happened between.
- A listener handed twice called twice. Removing it would take two calls of two functions, and adding a listener that is there already would change what it hears.
- `mods.onChange` told once for each change, with what changed. Every implementation would have to tell the same steps of a launch alike; telling that the list may have changed, and reading it again, is the same on all.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. A value that is not a value handed to `emit`: a case's `args` are values. An event sent while the run is not `running`, and one told to a run that is not: a case's `call` is made through a run that is `running`, and a `heard` look reads that run's listener alone. A listener removed by the function `on` answers, or as its lifecycle ends: a case reads no function and calls none, and a case's lifecycle runs while its steps are taken. The order of a run's listeners for one name: a case hands one listener. How many calls of a `mods.onChange` listener a change comes to: no rule fixes it.

**Note.** What this costs an implementation: it keeps, for each run, the names its listeners hear, and tells each event only to those; it judges the owner of an interface as each signal is sent; it judges as `on` is called whether the mod hears the name, from its id and its bundle's interfaces; and it tells `owner-changed` and `contributions-changed` once each changes.

# DECKIT-10: Interfaces

Status: draft
Area: system

## Summary

An interface is a contract one mod defines and any mod may provide: a mod that uses it is connected to whichever mod owns it, and never names that mod. This DECKIT fixes who owns an interface among the mods that provide it, how a request pins one and what a request reads of each interface, which majors a provider and a client must share to connect, the connection to the owner each lifecycle of a client's run has from before its start is called, the exports a provider opens for an interface, what a client's listeners are handed of each connection and each refusal, and the entries mods declare to an interface, which only its owner is handed. What a connection is and what crosses it are [the connections](../DECKIT-9/SPEC.md)'s; this DECKIT names who is at the other end.

## Motivation

[The bundle](../DECKIT-2/SPEC.md) reads `provides`, `uses` and `contributes` and leaves what they come to here, and [the handle](../DECKIT-7/SPEC.md) lists `exports.register(interface, exports)`, `exports.contributions(interface)`, `dependencies.onConnect`, `dependencies.onRefuse` `mods.pin` and `mods.interfaces()` and leaves them here. A mod author writes one entry for every implementation, so each of these is a call two implementations could answer differently without a rule.

`mod-b` and `mod-c` both provide `mod-b/pages`, and `mod-a` uses it:

```toml
[interfaces]
uses = { "mod-b/pages" = 1 }
```

```js
class Mod {
    start(deckit) {
        deckit.dependencies.onConnect("mod-b/pages", (pages) => this.show(pages));
    }
}
```

One implementation connects `mod-a` to `mod-b`, another to whichever of the two runs, a third to both. A person who wants `mod-c` cannot say so on one, and on another what they chose is gone once the app starts again. Where `mod-b` provides only major 1 and `mod-a` uses major 2, one implementation connects them and `mod-a` breaks on what it is handed; another launches `mod-b` and tells `mod-a` nothing, and `mod-a` waits for a connection that is never made.

`mod-b` owns `mod-b/actions`, and `mod-c` declares to it:

```toml
[[contributes."mod-b/actions"]]
title = "New Page"
```

Whether `mod-b` is handed `mod-c`'s id beside the entry decides whether it can tell two mods' entries apart, and whether a mod that does not own the interface is handed them decides whether a mod can read what another declares by providing its interface.

## Rules

### Providing and using

An interface is named as [the bundle](../DECKIT-2/SPEC.md) names one. A mod **provides** an interface its `provides` names, each major in its array, and **uses** one its `uses` names, the one major written. Only a mod whose bundle the system took provides or uses an interface, and it does so whether its run is `running` or not.

### The owner of an interface

The mods that provide an interface stand in a **queue**, each from when it begins to provide the interface, at the end of the queue, those that begin at once in [the catalog's](../DECKIT-4/SPEC.md) order. A mod keeps its place while it provides the interface, and leaves the queue once it does not.

The **owner** of an interface is the mod pinned for it, where one is, and else the first mod in its queue. A pin stands until it is cleared or its mod leaves the queue. Whether a mod's run is `running` does not decide whether it owns an interface. The system keeps each queue and each pin in its own folder, so that they stand as the host app starts again.

`mods.pin(interface, mod)`, a member of [the handle](../DECKIT-7/SPEC.md), is a request:

| takes | type | required | what it is |
|---|---|---|---|
| `interface` | string | yes | the interface |
| `mod` | string | no | the id of the mod pinned; left out, the pin is cleared |

It answers nothing, and from then on `mod` owns `interface`. `deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards it. It is refused with the first of these that is so:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`;
3. at `call` with kind `NOT_PROVIDER`, where `mod` is written and does not provide `interface`.

`mods.interfaces()`, a member of [the handle](../DECKIT-7/SPEC.md), is a request that takes nothing. `deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards it, and it is refused only as they refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`. It answers an array of entries, one for each interface a mod provides or uses, each a table:

| key | value |
|---|---|
| `interface` | string: the interface |
| `name` | string: the `name` of the bundle listed under the mod id the interface is named by; absent where the system took none under it |
| `owner` | string: the id of its owner; absent where it has none |
| `pinned` | boolean: whether its owner is the mod pinned for it |
| `providers` | array of tables `{ id, name, majors, pinnable }`, its queue, the first first: `id` the mod's id, `name` its bundle's `name`, absent where the system took no bundle under `id`, `majors` the majors it provides, an array of integers, and `pinnable` whether `mods.pin` pins it rather than refuse it |
| `clients` | array of tables `{ id, major, problem }`, each mod that uses it, in [the catalog's](../DECKIT-4/SPEC.md) order: `id` the mod's id, `major` the major it uses, and `problem` a string, where the interface has an owner other than the mod and its lifecycles reach no one by it, why, as the implementation says it; absent otherwise |

### Connecting to the owner

Each lifecycle of a client's run reaches, by each interface the client uses, the owner of that interface, as [the connections](../DECKIT-9/SPEC.md) say a lifecycle reaches a mod, from before its start is called until it ends, and the name of the connection is the interface. A lifecycle reaches no one by an interface where:

- the interface has no owner;
- the owner is the client itself;
- the owner does not provide the major the client uses, whether it runs or not: the owner is not launched for the lifecycle, and the lifecycle is refused, below.

The owner of an interface a lifecycle reaches launches, as [the lifecycle](../DECKIT-5/SPEC.md) says of a lifecycle that reaches a mod, and is connected to as [the connections](../DECKIT-9/SPEC.md) say, with what the owner is handed of the client and what crosses as they say. The connections a lifecycle has as its start is called stand before it is called. Once the interface has another owner, the connection to the one before ends, and the lifecycle reaches the new owner.

A lifecycle is **refused** by an interface with the first of these that is so:

1. at `call` with kind `UNSUPPORTED_VERSION`, where the owner does not provide the major the client uses;
2. where the owner is at the relaunch limit, or has no run that is `launching` or `running` and its latest run timed out or failed to launch, at `launch` with the kind [the connections](../DECKIT-9/SPEC.md) give the refusal of a reach: `RELAUNCH_LIMIT`, `TIMED_OUT` or `NOT_LAUNCHED`;
3. at `call` with kind `NOT_EXPORTED`, where the owner's run is `running` with no exports for the interface that reach the lifecycle;
4. where the owner refuses the connection, at `call` with the kind it refuses with, or `REFUSED`, as [the connections](../DECKIT-9/SPEC.md) say of a reach.

A refusal does not let the interface go: while the lifecycle uses the interface, it reaches the owner where the owner provides its major, and is connected once a connection is made.

### The exports a mod opens for an interface

`exports.register(interface, exports)`, a member of [the handle](../DECKIT-7/SPEC.md), opens the run's exports for those that reach the mod by `interface`, as `exports.register(exports)` opens them for its id under [the connections](../DECKIT-9/SPEC.md), by the same rules, `interface` in place of the id. It also opens nothing where `interface` is not a string or is not an interface the mod provides.

### What a client is handed

`dependencies.onConnect(interface, listener)` and `dependencies.onRefuse(interface, listener)`, members of [the handle](../DECKIT-7/SPEC.md), are not requests: each adds `listener` for `interface` in the lifecycle whose handle it is called on, until the lifecycle ends, and throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one.

| takes | type | required | what it is |
|---|---|---|---|
| `interface` | string | yes | the interface whose connections or refusals are heard |
| `listener` | function | yes | what is called with each of them |

Each is refused at `call` with kind `INVALID_ARGUMENT`, and adds nothing, where `interface` is not a string or `listener` is not a function, as [the events](../DECKIT-12/SPEC.md) refuse a listener: an `interface` of another type is not read as a string.

| member | answers | `listener` is called |
|---|---|---|
| `onConnect(interface, listener)` | a function that removes `listener` | with the exports of each connection by `interface` of the lifecycle: at once for each one that stands, and for each one made from then on, as it is made |
| `onRefuse(interface, listener)` | a function that removes `listener` | with each refusal by `interface` the lifecycle is told, as [the handle](../DECKIT-7/SPEC.md) fixes a refusal: at once with the last one told, where no connection by `interface` has been made since it, and with each one told from then on |

### What is declared to an interface

`exports.contributions(interface)`, a member of [the handle](../DECKIT-7/SPEC.md), is a request:

| takes | type | required | what it is |
|---|---|---|---|
| `interface` | string | yes | an interface the mod owns |

It answers an array of the entries declared to `interface`, as [the bundle](../DECKIT-2/SPEC.md) reads `contributes`, by every mod whose bundle the system took, in [the catalog's](../DECKIT-4/SPEC.md) order and then in the order written. Each is a table:

| key | value |
|---|---|
| `mod` | table `{ name }`: the declaring mod's `name`, as [the bundle](../DECKIT-2/SPEC.md) answers it |
| `credential` | table `{ mod, permissions }`: the declaring mod's `id`, and the ids of the permissions it is granted, as [the connections](../DECKIT-9/SPEC.md) hand a service its client's |
| `entry` | the entry, a value, as written |

No permission guards it. It is refused with the first of these that is so:

1. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`;
2. at `call` with kind `NOT_OWNER`, where the mod does not own `interface`.

**Note.** The declaring mod's id is handed once, in `credential`, as a connection hands a client's: an owner that keeps what each mod declared keeps it under `credential.mod`.

## Interactions

- The interface's name, `provides`, `uses`, `contributes` and what the system answers of a bundle: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods`, what a mod is granted, and the refusal `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- The catalog's order, and the other requests `deckit.mods` guards: [the catalog](../DECKIT-4/SPEC.md).
- What launches a mod and the refusals at `launch`: [the lifecycle](../DECKIT-5/SPEC.md).
- A run's lifecycles and when a lifecycle's start is called: [the entry](../DECKIT-6/SPEC.md).
- The handle, requests, refusals and `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md).
- What a connection is, when it stands, what the service is handed, what crosses, and the refusals of a reach: [the connections](../DECKIT-9/SPEC.md).
- A function in the exports, a call of it and its refusal: [calls across a connection](../DECKIT-11/SPEC.md).
- The listener a case hands, and the look at what it heard: [the case format](../DECKIT-1/SPEC.md).
- A listener refused as `events.on` refuses one: [the events](../DECKIT-12/SPEC.md).

## Alternatives considered

- A client that names the mod it connects to. A mod that defines an interface would be bound to one provider, and a person could not choose another. The client names the interface; who owns it is the system's.
- The provider that runs owning the interface. Which mod a client is connected to would depend on which launched first, and could change between two starts of the app with nothing installed. The queue is a fact of the bundles, and a pin of a person's choice.
- A pin kept only while the host app runs. A person's choice would be lost as the app starts again.
- A client connected to every provider. A client would have to choose among them itself, every client alike, and an interface could not stand for one mod's service.
- A major that does not match connected anyway. A client would be handed a contract it was not written for.
- A client of a major the owner does not provide told nothing, the owner launched for it. The client would wait for a connection that is never made, and the owner would run for a client it cannot serve; the major is a fact of the bundles, known before anything launches.
- Every mod handed what is declared to any interface. A mod that does not own an interface would read what others declare to it, and an owner could not be the one that decides what an entry means.
- An `interface` of another type read as a string. As [the handle](../DECKIT-7/SPEC.md) sets aside an argument turned into the type its signature gives: `1` would listen for the interface `"1"` on one implementation and be refused on another, and every member that adds a listener refuses alike.
- The declaring mod's id handed in `mod` and in `credential`. As [the connections](../DECKIT-9/SPEC.md) set it aside for a client's id: two values where one is meant.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That a mod leaves a queue and a pin goes with it, and that the connection ends as the owner changes while both lifecycles stand: a mod leaves a queue only as its bundle is installed, removed or changed, which no input of the case format does while a client is connected. A refusal at `launch` of kind `RELAUNCH_LIMIT` or `TIMED_OUT`: [the connections](../DECKIT-9/SPEC.md) hold the same refusals of a reach, and a launch out of time takes longer than a step may take to settle. That a lifecycle has its connections as its start is called: a case's request is made after the lifecycle has started. That `onConnect` and `onRefuse` answer a function that removes the listener: a case reads no function. That a listener is not called once its lifecycle has ended: a case's lifecycle runs while its steps are taken. What `mods.interfaces()` answers: the owners and queues it reads are held by the cases of `mods.pin` and of connecting to the owner, and a client's `problem` is a message no rule states.

**Note.** What this costs an implementation: the system keeps a queue and a pin for each interface across starts, connects every lifecycle of a client to the owner as it begins and again as the owner changes, reads the majors the owner provides from its bundle before it launches it, and keeps for each interface the last refusal a lifecycle was told while no connection was made since, to hand a listener added after it.

# DECKIT-9: Connections

Status: draft
Area: system

## Summary

A mod's code reaches another mod's code only through a connection: a lifecycle of one mod's run, the client, joined to the exports a lifecycle of another mod's run opened, the service. This DECKIT fixes what a connection is and when it stands, the exports a mod opens for those that reach it by its id, what a service is handed of who its client is, the values that cross, and the two requests through which a lifecycle reaches a mod by its id and lets it go: the permission that guards reaching, that a mod reached launches and launches again while it is reached, and each refusal a client hears. Connecting to the owner of an interface a mod uses, and the functions that cross a connection with a call of one, are left to the DECKITs after it.

## Motivation

[The handle](../DECKIT-7/SPEC.md) lists `exports` and `dependencies` among a mod's members and leaves them to this DECKIT, and [the permissions](../DECKIT-3/SPEC.md) define `deckit.reach-mods` and leave what it guards here. A mod author writes one entry for every implementation, so each of these is a call two implementations could answer differently without a rule.

A system mod granted `deckit.reach-mods` reaches a mod that is not a background mod and does not run:

```js
const pages = await deckit.dependencies.reach("mod-b");
```

One implementation launches `mod-b` and answers once it is connected; another refuses the reach because `mod-b` does not run, and the mod must first ask `deckit.mods` to launch it, a permission that reaches every mod. On a third the reach answers at once with nothing, and the code that reads `pages` breaks.

`mod-b` opens its exports for its id:

```js
class Mod {
    start(deckit) {
        deckit.exports.register({
            connect: (connection) => ({ owner: connection.credential.mod }),
        });
    }
}
```

What `connection` holds decides what a service can know of who asks: whether it is told the client's permissions, so that it serves a mod granted one and not another, or only the client's id, which it would then look up through a permission of its own. Where one implementation copies the table `connect` answers and another hands the client the service's own object, a client that changes what it was handed changes the service on one and not on the other.

`mod-b` is at the relaunch limit, or its entry throws, or it runs and opens no exports, or its `connect` throws an error of kind `BUSY`. A client that tells a person why it cannot reach `mod-b` reads the refusal's stage and kind, and on an implementation that answers each with one kind, or leaves the reach waiting, it cannot.

A client reaches `mod-b`, and a mod granted `deckit.mods` quits `mod-b`. On one implementation `mod-b` launches again because it is still reached, and on another it stays quit and the client is cut off until it reaches again.

## Rules

### A connection

A **connection** joins one lifecycle of a mod's run, its **client**, to the **exports** one lifecycle of another mod's run opened, its **service**, as [the entry](../DECKIT-6/SPEC.md) fixes a run's lifecycles. It is made for a **name** the client reaches the service by, here the service's id.

The lifecycles of a run are stacked in order, the system's lifecycle first, as [the entry](../DECKIT-6/SPEC.md) says, and each has its **place** in that order, the system's lifecycle the first. Exports opened in a lifecycle reach a client's lifecycles whose place is the same or later.

A connection is made only while the service's run is `running`, as [the lifecycle](../DECKIT-5/SPEC.md) fixes a run's states, and the client's run is `launching` or `running`. It stands until the first of these: the client's lifecycle ends; the lifecycle that opened the exports ends; the client lets the name go. A connection that has ended is not made again, and the client is connected anew only by a connection made after it, as the rules below make one.

### The exports a mod opens for its id

`exports.register(exports)`, a member of [the handle](../DECKIT-7/SPEC.md), opens the run's exports for those that reach the mod by its id, in the lifecycle whose handle it is called on. It is not a request: it answers nothing, and is never refused.

| takes | type | required | what it is |
|---|---|---|---|
| `exports` | table | yes | what answers each connection to the exports |
| `exports.connect` | function, `connect(connection)` | yes | answers the exports of a connection as it is made |
| `exports.disconnect` | function, `disconnect(connection)` | no | hears a connection to the exports end |

A call opens the exports only while the start of the lifecycle whose handle it is called on runs: from the call of the start until the lifecycle has started, as [the entry](../DECKIT-6/SPEC.md) fixes it. The exports for the id are opened once for the run. A call opens nothing where:

- the lifecycle's start has ended;
- exports for the id are open already, opened in this lifecycle or in one under it;
- `exports` is not a table, its `connect` is not a function, or its `disconnect` is neither left out nor a function.

A call that opens nothing does not fail the run: the run goes on, with the exports opened before it, if any.

`connect(connection)` is called once for each connection made to the exports, with what the service is handed of the client, under *What a service is handed*, and answers the exports of that connection itself, not a promise of them. The service **refuses** the connection where `connect` throws, answers a promise, or answers what does not cross, under *What crosses*; the client is then refused as *Reaching a mod by its id* says, and the connection is not made.

`disconnect(connection)` is called with the same `connection` as a connection to the exports ends, but where it ends because the lifecycle that opened the exports ended.

### What a service is handed

`connection`, which `connect` and `disconnect` are handed, is a table:

| key | value |
|---|---|
| `mod` | table `{ name }`: the client's `name`, as [the bundle](../DECKIT-2/SPEC.md) answers it |
| `credential` | table `{ mod, permissions }`: the client's `id`, and an array of the ids of the permissions the client is granted, as [the permissions](../DECKIT-3/SPEC.md) say, in the order [the bundle](../DECKIT-2/SPEC.md) answers them |

The client's id is handed once, in `credential`.

**Note.** The credential is what the service decides by: a service that serves only a client granted a permission reads `credential.permissions`, and one that keeps what each client did keeps it under `credential.mod`. It needs no permission of its own to learn either.

### What crosses

The exports `connect` answers are handed to the client as a value. A value, as [the handle](../DECKIT-7/SPEC.md) fixes values, crosses as itself: a string, an integer or a boolean as the same, an array as an array of what each of its elements crosses as, in order, and a table as a table of the same keys, each bound to what its value crosses as. The client is handed a copy, and what it does with it changes nothing of what the service holds. What else crosses, a function among them, and a call of a function across a connection: the DECKIT of calls across a connection.

### Reaching a mod by its id

`dependencies.reach(id)` and `dependencies.release(id)`, members of [the handle](../DECKIT-7/SPEC.md), are requests:

| request | takes | answers | refused with |
|---|---|---|---|
| `dependencies.reach(id)` | `id`, a string | the exports of the connection to the mod under `id`, once it stands | at `call` `NOT_PERMITTED`, `INVALID_ARGUMENT`, `ENDED`, `NOT_INSTALLED`; at `read` `NOT_LOADABLE`; at `launch` `RELAUNCH_LIMIT`, `TIMED_OUT`, `NOT_LAUNCHED`; at `call` `NOT_EXPORTED`, the kind the service refuses with or `REFUSED`, `CANCELLED` |
| `dependencies.release(id)` | `id`, a string | nothing | at `call` `INVALID_ARGUMENT` |

`deckit.reach-mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards `reach`. No permission guards `release`.

A reach and a release are of the lifecycle whose handle they are called on. A lifecycle **reaches** the mod under `id` from a `reach` of it until a `release` of it has been called once for each `reach`, or until the lifecycle ends; a `reach` that is refused counts none, and a `release` past the reaches counted does nothing. While a lifecycle reaches a mod:

- where the mod's run is `running` with exports for its id that reach the lifecycle, a connection to them is made, as *A connection* says, and `reach` answers its exports: at once where a connection stands already;
- where the mod has no run that is `launching` or `running`, the mod launches, as [the lifecycle](../DECKIT-5/SPEC.md) says of a lifecycle that reaches a mod, unless a refusal below is so: one whose run is `terminating` launches once that run is `notRunning`, as it says of a mod asked to launch. This holds each time its run ends while it is reached, so a mod reached launches again once its run has ended.

Once the lifecycle no longer reaches the mod, its connection to the mod ends, and the mod is not launched for it. Its run is left as it is.

A `reach` is refused with the first of these that is so, and every `reach` of the same id the lifecycle has not had answered is refused with it:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`;
3. at `call` with kind `ENDED`, where the lifecycle whose handle it is called on has ended;
4. at `call` with kind `INVALID_ARGUMENT`, where `id` is the mod's own id;
5. at `call` with kind `NOT_INSTALLED`, where no bundle is listed under `id`;
6. at `read` with kind `NOT_LOADABLE`, where the system did not take the bundle [the catalog](../DECKIT-4/SPEC.md) holds under `id`;
7. at `launch` with kind `RELAUNCH_LIMIT`, where the mod is at the relaunch limit;
8. at `launch` with kind `TIMED_OUT` or `NOT_LAUNCHED`, where the mod has no run that is `launching` or `running` and its latest run timed out or failed to launch;
9. at `call` with kind `NOT_EXPORTED`, where the mod's run is `running` with no exports for its id that reach the lifecycle;
10. at `call`, where the service refuses the connection: with the `kind` the error `connect` threw carries where that is a kind, as [the specification](../README.md) fixes one, and with kind `REFUSED` where it carries none or what is not a kind, or where `connect` answered a promise or what does not cross. No refusal but the service's is of kind `REFUSED`.

Each refusal from 5 on, and each the lifecycle comes to while it reaches the mod, as the mod launches again or its service refuses a new connection, lets the reach go: the lifecycle no longer reaches the mod, whatever reaches of it were counted before, and the mod is not launched for it again until a `reach` asks anew. A mod at the relaunch limit is not taken off it by a reach, as [the lifecycle](../DECKIT-5/SPEC.md) says.

A `release` is refused only as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes. A reach still unanswered as the reaches it counted are released is refused at `call` with kind `CANCELLED`.

**Note.** A mod reached launches as an operating system launches a service a client connects to, and launches again while it is reached, so a client holds what it reaches by holding the reach, and lets it go by a release, never by asking the mod to quit.

## Interactions

- `id`, `name` and the permissions a bundle answers, in their order: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.reach-mods`, what a mod is granted, and the refusal `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- Which bundle the catalog holds under an id: [the catalog](../DECKIT-4/SPEC.md).
- A run's states, what launches a mod, the relaunch limit, a run that times out or fails to launch, and the refusals at `launch`: [the lifecycle](../DECKIT-5/SPEC.md).
- A run's lifecycles, their order, when a lifecycle has started and when it ends: [the entry](../DECKIT-6/SPEC.md).
- The handle that holds `exports` and `dependencies`, values, requests and the refusal `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md). The input that hands a case's request: [the case format](../DECKIT-1/SPEC.md).
- The interfaces a mod provides and uses, the connection to an interface's owner made as a lifecycle begins, and its other members of `exports` and `dependencies`: the interfaces' DECKIT.
- A function that crosses a connection, a call of it, its answer and its refusal: the DECKIT of calls across a connection.

## Alternatives considered

- Reaching any mod by its id with no permission. Any mod could launch every other and read what each opens for its id, and a person installing it would be told nothing of it. What a mod reaches by id is granted as a permission, and an interface a mod uses is named in its bundle.
- A reach of a mod that does not run refused until something launches it. The client would need `deckit.mods` to launch it, a permission that reaches every mod, and between its launch and its reach the mod may end. Operating systems launch a service as a client connects to it.
- A mod reached kept as it was once its run ends, until the client reaches it again. The client would have to watch every run it reaches and ask again, and a connection it holds would end for a reason it was not told. Holding the reach holds the mod, as long as the relaunch limit lets it.
- A mod reached quit as the last reach of it is let go. Whether a mod runs would depend on who reaches it, and a mod that is also a background mod or was launched by a request would end for a release by another.
- A service told only the client's id, with a request to look up what the client is granted. A second round trip for every connection, and what it answers could change between the two.
- A service's `kind` handed on to the client whatever it is. The client would read as a kind a value no DECKIT could fix as one, a number or a lower-case word.
- A reach of the mod's own id refused `REFUSED`. A client could not tell it from a service that refused it, and the id is an argument that does not fit the request.
- The client's id handed twice, in `mod` and in `credential`. A service would have two values to read where one is meant, and an implementation two to keep the same.
- Every refusal by the service answered with one kind. A service that defines what it refuses with, as an interface's DECKIT does, could not tell its client why.
- Exports opened at any time in the run. Whether a client connects would depend on when it reached the mod, and `NOT_EXPORTED` would be a race rather than an answer: once a run is `running`, what it exports is known.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `TIMED_OUT`: a launch out of time takes longer than a step may take to settle. `ENDED`, `CANCELLED`, a reach refused because another reach of the id was, and a mod reached as its run is `terminating`: steps settle one at a time and a case's request is made while its lifecycle runs, so no reach is unanswered and no run is between two states as another step comes. `disconnect`: what it hears reaches no handle a case reads. That exports opened in a lifecycle reach only lifecycles of the same or a later place, and that a connection ends as either lifecycle ends while its run goes on: no case's host stacks a layer that opens exports or ends one lifecycle of a run alone, so the shell's DECKITs hold them with the shell on. That the client is handed a copy: a case reads what crosses and not what the service holds. That a mod at the relaunch limit stays at it after a reach: [the lifecycle](../DECKIT-5/SPEC.md)'s cases hold what takes a mod off it.

**Note.** What this costs an implementation: the system keeps, for each lifecycle, the ids it reaches and how many reaches of each are not let go, and launches a mod reached each time its run ends; a mod's exports are known once its run is `running`; and a service's refusal carries its kind across to the client where it is one.

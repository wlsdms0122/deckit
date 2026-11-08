# DECKIT-11: Calls across a connection

Status: draft
Area: system

## Summary

A connection hands its client the service's exports, and what a service offers is more than values: it is what the client calls. This DECKIT fixes how a function crosses a connection, in either direction, what a call of it answers, and how a call is refused: with the kind the function threw where it is a kind, `REFUSED` where it is not, and `ENDED` once the connection has ended. What a connection is, and how a value crosses, are [the connections](../DECKIT-9/SPEC.md)'s.

## Motivation

[The connections](../DECKIT-9/SPEC.md) fix how a value crosses and leave what else crosses here. `mod-b` opens exports for its id:

```js
class Mod {
    start(deckit) {
        deckit.exports.register({
            connect: () => ({ open: (page) => this.open(page) }),
        });
    }
}
```

and a client reaches it and calls `open`:

```js
const pages = await deckit.dependencies.reach("mod-b");
await pages.open("home");
```

One implementation hands the client a function that runs `open` in `mod-b`'s sandbox and answers what it answered; another leaves `open` out of what crosses, and `pages.open` is not a function. Where `open` throws an error of kind `BUSY`, one implementation hands the client that kind and another an error with none, and a client that tells a person why it could not open the page cannot. Where `mod-b` has quit and launched again, a call of the `open` handed before goes to nothing on one implementation, waits forever on another, and is refused on a third.

## Rules

### What crosses

What crosses a connection, the exports `connect` answers, what a call is handed and what it answers, crosses as [the connections](../DECKIT-9/SPEC.md) say a value crosses, and besides:

- a **function** crosses as a function of the other end's, which calls it across the connection, a **reference** to it;
- a table's key bound to a function crosses bound to a reference to it;
- a table made from a class crosses with each **method** of that class, but those named by its own keys, bound to a reference to it, which calls it with that table, as it is on the end that handed it.

The same function handed again on one connection crosses as the same reference. A reference an end was handed does not cross again: what calls a function is always a connection to the end that holds it. Anything else does not cross. Where what a call answers does not cross, the call is refused, below.

### A call

A call of a reference is a request, of the end that holds it to the end that handed it, guarded by no permission. It calls the function on the end that handed it with what the reference is called with, each crossing as above, and answers what the function answered, crossing as above, or, where the function answered a promise, what the promise resolves with.

A call is refused at `call` with the first of these that is so:

1. with kind `ENDED`, where the connection that handed the reference has ended;
2. with kind `INVALID_ARGUMENT`, where what the reference is called with does not cross;
3. with the `kind` the error the function threw, or the promise it answered rejected with, carries, where that is a kind, as [the specification](../README.md) fixes one;
4. with kind `REFUSED`, where it threw or rejected with what carries no kind or what is not one, or answered what does not cross.

**Note.** A reference reaches the far end only while the connection that handed it stands. A client that holds the exports across a run of the service's that ends holds references to a connection that has ended, and reaches the service again through the connection made after it.

## Interactions

- What a connection is, when it stands, and how a value crosses: [the connections](../DECKIT-9/SPEC.md).
- The connection to an interface's owner, whose exports cross as these do: [the interfaces](../DECKIT-10/SPEC.md).
- A request, a refusal and what a kind is: [the handle](../DECKIT-7/SPEC.md) and [the specification](../README.md).
- The call of what an earlier call answered, and the listener a case hands: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- Only values crossing, a service answering what a client asks through events. Every service would build its own calls over events, each with its own answers and refusals, and two clients of one service would build them twice.
- A function copied to the other end and run there. It would run in a sandbox not its own, with a handle not its own, and reach what its mod is not granted.
- A thrown error handed across whatever it carries. The client would read as a kind what no DECKIT could fix as one, as [the connections](../DECKIT-9/SPEC.md) set aside for a refusal of a connection.
- A call on a connection that has ended sent on to the service's next run. The run that answers would not be the one that handed the function, and what the function closed over would be gone.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That the same function handed again crosses as the same reference: a case reads no function. That a reference a mod was handed is not handed on to a third mod, and a call whose arguments do not cross: a case's arguments are values, and the only function it hands is its own listener. That a reference let go on one end lets the function go on the other: what is held is no answer a case reads.

**Note.** What this costs an implementation: each end keeps, for each connection, the functions it handed by a number of its own until the other end lets them go, and drops them as the connection ends; and the kind an error carries is read on the end that threw it, so that `REFUSED` is the only kind a call is refused with that the function did not throw.

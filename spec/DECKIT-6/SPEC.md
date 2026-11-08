# DECKIT-6: The entry

Status: draft
Area: system

## Summary

A mod's code is its entry, the file `main` names, which the system evaluates as the mod's run launches. This DECKIT fixes what the entry exports, what a run needs of it to come to run, how the system starts a run's code and when it has started, how it ends a run's code with its sandbox, the time each end is given, and that a layer a host stacks fails no run by throwing.

## Motivation

[The lifecycle](../DECKIT-5/SPEC.md) fixes a run's states and evaluates the entry as a run launches, and leaves open what the entry must give, when its code has started and when it has ended. A mod author writes one entry for every implementation, so each of these is an entry two implementations could run differently without a rule.

A host ships a mod whose entry is this:

```js
class Mod {
    async start(deckit) {
        this.index = await build();
    }

    stop() {
        return new Promise(() => {});
    }
}

module.exports = Mod;
```

A mod granted `deckit.mods` asks that it launch: one implementation answers as `start` is called, another once the promise it answered is fulfilled, and a mod manager reading the answer shows the mod running on one while its index is still being built on the other. Asked to quit, the run whose `stop()` never settles keeps the app from quitting on one implementation and ends after a time on another.

The same mod written as `module.exports = { start() {} }`, a table and not a class, runs on an implementation that calls the `start` it finds and is refused on one that makes an instance. A `start` that throws leaves the run running on one and fails it on another, and a background mod whose run fails launches again where one that runs does not.

A `stop()` that sets a timer and answers at once leaves the timer asking the system for a run that has ended on an implementation that keeps the mod's code loaded until it launches again, and asking nothing on one that ends it with the run. A layer a host stacks that throws as it reads the class fails the mod's run on one host and is left out on another.

## Rules

### What the entry exports

The entry is evaluated as a script with two names in reach: `module`, a table whose key `exports` holds an empty table as the script starts, and `exports`, that same table. What `module.exports` holds once the script has run is what the entry **exports**, and it exports a **class**: a function that holds a `prototype` object, which the system makes an instance of with `new`.

```js
class Mod {
    async start(deckit) { … }
    stop() { … }
}

module.exports = Mod;
```

The system makes one instance of the class for the run, with no arguments, and reads two members of it:

| member | signature | what it is |
|---|---|---|
| `start` | `start(deckit)`: answers nothing, or a promise fulfilled with nothing | starts the system's lifecycle; `deckit` is the handle, as [the handle](../DECKIT-7/SPEC.md) fixes it |
| `stop` | `stop()`: answers nothing, or a promise fulfilled with nothing | ends the system's lifecycle |

Each may be left out, and a member that is not a function is read as one left out. What either answers, or fulfils its promise with, is not read. Every other member of the instance is the mod's own or a layer's, and the system reads none of them.

**Note.** One instance holds every lifecycle of the run, so what `start` keeps on it is in reach of `stop` and of what a layer calls, without a handle passing it.

### What a run needs of its entry

A run's code **does not start**, and the run fails to launch, as [the lifecycle](../DECKIT-5/SPEC.md) says, where:

- what the entry exports is not a class;
- making the instance throws;
- `start` throws, or answers a promise that is rejected.

What the system answers of such a run is then refused at `launch` with kind `NOT_LAUNCHED`, as the lifecycle fixes it. A run that fails to launch ends no lifecycle: its `stop()` is not called.

### Starting a run's code

Once its entry is evaluated, the system makes the run's instance and starts the **system's lifecycle** by calling `start(deckit)`. The system's lifecycle has **started** once `start` has answered nothing, or once the promise it answered is fulfilled. An instance with no `start` has started the system's lifecycle once it is made.

A host may stack layers over the system on each mod's run, and each layer stacks **lifecycles** of its own over the system's lifecycle, each with a start and an end, those of a lower layer first. What a layer's lifecycle calls of the instance is that layer's. A layer may read what the entry exports before the instance is made, and one whose reading throws is left out of the run, with the layers over it: none of their lifecycles is stacked, and the run goes on. Once the system's lifecycle has started, the layers' lifecycles start one at a time, each once the one under it has started. One whose start throws or is rejected ends, as under *Ending a run's code*, no lifecycle over it starts, and the run goes on. **A layer that throws fails no run**: it is left out, and the run goes on with what is under it.

A run's code **has started**, the step from `launching` to `running` of [the lifecycle](../DECKIT-5/SPEC.md), once the system's lifecycle has started and no lifecycle is left to start: each of the layers' lifecycles has started, has ended, or is over one that ended.

**Note.** A mod runs on a host with no layer as well as on one with many, so a layer that throws decides nothing of whether a run fails. A run that waits for its layers before it is `running` is answered by a `launch` only once what the layers start of it has started too.

### Ending a run's code

As a run's end is asked, each lifecycle whose start was called ends, one at a time, the highest first and the system's last. An end does not wait for a start still going, and a lifecycle whose start was not called by then is not started. A lifecycle that has ended is not ended again. The system's lifecycle ends by calling the instance's `stop()`, with no arguments; an instance with no `stop` has ended it at once. A layer's lifecycle ends as its layer says.

Each lifecycle's end is given **5 seconds** of its own. It has ended once what it called has answered, has thrown, or has settled the promise it answered, or once its 5 seconds have run out, whichever comes first. An end that throws, is rejected or runs out of time has ended all the same, and the run ends as asked: it has not failed.

Once the system's lifecycle has ended, the run's code has ended it, the step from `terminating` to `notRunning` of [the lifecycle](../DECKIT-5/SPEC.md). A run whose end is asked before its instance is made has no lifecycle to end, and its code has ended it at once.

The time a run's end is given, as the lifecycle names it, is 5 seconds for each lifecycle the run stacks, the system's among them. Once it has run out, the run moves to `notRunning` whatever its code is doing.

**A run's end ends its code.** Once the run is `notRunning`, its sandbox has ended, as [the lifecycle](../DECKIT-5/SPEC.md) says, and with it every part of its code: what it left, a timer or a promise still going, runs no more and asks nothing of the system, and an end still running as its time ran out is ended where it is.

**Note.** What must not be lost is written as it changes, not as the run ends: the end is short because the app quits only once every run has ended. 5 seconds is of the order operating systems give an app told it terminates, where they give one a time. Each lifecycle has its own, so a layer's end that takes all of its time leaves the system's `stop()`, the one end every host calls, its own.

## Interactions

- `main`, the file the entry is: [the bundle](../DECKIT-2/SPEC.md).
- A run's states and the steps between them, what fails to launch, the 20 seconds a launch is given, what asks a run's end, the requests `launch` and `quit`, and what the system answers of a run: [the lifecycle](../DECKIT-5/SPEC.md).
- The handle `start` is handed, and what a request through it answers: [the handle](../DECKIT-7/SPEC.md).
- What a lifecycle that ends does to its connections, and the exports a lifecycle opens for the mod's id: [the connections](../DECKIT-9/SPEC.md). What each lifecycle is connected to as it starts: the interfaces' DECKIT.
- Which layers a host stacks over the system: the embedding DECKIT. The lifecycles the shell stacks, and the members of the instance they call: the shell's DECKITs.
- The inputs and looks a case reads these rules with: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- An entry that exports a table, with a key for the system's class and one for each layer's. The lifecycles of one run would be on separate instances, and what one starts would reach another only through a handle made for passing it. The system reads two members of one instance, and a layer's DECKIT names its own beside them.
- `start` required. A mod whose part is what a layer adds has nothing for the system's lifecycle to do, and an instance with no `start` starts at once.
- A `start` or `stop` that is not a function refused at `launch`. The system reads two members to call them, and a member it cannot call is none of them; refusing it would be a check of its own beside the call.
- A run that is `running` once `start` has settled, before the layers' lifecycles have started. A `launch` would be answered while what a layer starts of the mod has not, and two requests that wait for the same run would see it in two states.
- A layer that fails the run when it throws, as it reads the class or as its lifecycle starts. Whether a mod runs would then depend on the layers its host has, and a mod is written once for every host.
- A sandbox left as it is once its run has ended, until the mod launches again. What the code left would go on asking the system for a run that has ended, and an end that ran out of time would end nothing of what it runs.
- One time for the whole end of a run. A layer's end that took all of it would leave the system's `stop()` none.
- An end with no time. A `stop()` that never settles would keep the app from quitting.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. What a layer does, its reading of the class and its lifecycles, and when a run with layers has started: no case's host stacks a layer a case can make throw or wait, so the shell's DECKITs hold them with the shell on. That `exports` is the table `module.exports` holds as the script starts: an entry that exports through it alone exports a table, which is no class. The 5 seconds of an end, and the time a run's end is given: a case holds that an end that never settles ends within a step's 10 seconds, and no format has a time input to hold the 5 seconds themselves. A `start` that never settles: it times out after 20 seconds, past what a step may take to settle. An end asked while a start is still going, or before the instance is made: steps settle one at a time, so no case asks an end while a run is `launching`.

**Note.** What this costs an implementation: one instance per run, made before any lifecycle starts; a run is `running` only once each layer's lifecycle has started or ended; each lifecycle's end is timed on its own, with the run's end timed again as a whole; and the sandbox ended as the run is `notRunning`, so that what the code left, or an end that holds it, ends with the run.

# DECKIT-5: The lifecycle

Status: draft
Area: system

## Summary

A mod runs in runs, one at a time. This DECKIT fixes a run's states and the steps between them, what launches a mod and what ends its run, which runs fail, which background mods launch again after a run fails and when the relaunch limit stops them, the refusals at `launch`, the requests a mod granted `deckit.mods` makes to read each mod's latest run, to launch a mod, to quit one and to launch one again, and the request `quit()` through which a mod quits itself.

## Motivation

[The bundle](../DECKIT-2/SPEC.md) fixes what a bundle is and which bundles are taken, and [the catalog](../DECKIT-4/SPEC.md) fixes which bundle is held under each name. What happens once a bundle held is to run is left open, and each of these is a host two implementations could answer differently without a rule.

A host ships a background mod whose entry throws as it is evaluated:

```toml
id = "mod-a"
version = "1.0.0"
api = "1.0.0"
main = "main.js"
background = "Keeps the index."
```

```js
throw new Error("not yet");
```

One implementation launches it once and leaves it, another launches it again at once and forever, and a third waits and tries again later. A mod manager listing it shows it stopped on one, flickering on the next, and coming back on the third.

The same mod with an entry that never finishes starting leaves every request that waits for it to launch waiting. Where one implementation ends the launch after a time and another waits forever, a mod that waits for it works on one and hangs on the other.

A mod granted `deckit.mods` asks that another launch, and that launch fails. Whether the request is answered or refused, and at which stage and with which kind, decides whether the same mod manager can tell a mod that did not launch from one that did.

## Rules

### A run

A mod runs in **runs**, one at a time, and each launch is a new run. A run is of the bundle the catalog held under the mod's name as the mod launched. It is in one of four states:

| state | the run |
|---|---|
| `launching` | has launched, and its code has not started yet |
| `running` | its code has started, and its end has not been asked |
| `terminating` | its end has been asked, and its code has not ended it yet |
| `notRunning` | has ended |

It moves between them by these steps and no others:

| step | from | to |
|---|---|---|
| it launches | | `launching` |
| its code has started | `launching` | `running` |
| it fails to launch | `launching` | `notRunning` |
| its end is asked | `launching`, `running` | `terminating` |
| its code has ended it, or the time its end is given has run out | `terminating` | `notRunning` |
| its sandbox ends | `launching`, `running`, `terminating` | `notRunning` |

A run's code runs in a **sandbox** of the run's, which ends as the run moves to `notRunning`, by whichever step: once a run has ended, nothing of its code runs.

Launching evaluates the file `main` names as the mod's entry. What the entry exports, what starting the mod's code is and when it has started, and the time a run's end is given: [the entry](../DECKIT-6/SPEC.md).

A run **fails to launch** when evaluating its entry throws, or when its code does not start, and its sandbox then ends at once. A run **times out** when its code has not started 20 seconds after it launched, and it then moves as a run that fails to launch. A run **crashes** when its sandbox ends while it has not ended. A run **failed** when it failed to launch, timed out, or crashed before its end was asked.

### What launches a mod

A mod launches only as one of these asks it:

- As the app starts, once what the host ships is installed, every background mod the catalog holds launches, in the catalog's order.
- A background mod whose run failed launches again once that run is `notRunning`, unless it is at the relaunch limit.
- A `launch` or `relaunch` request.
- A lifecycle that reaches the mod, as [the connections](../DECKIT-9/SPEC.md) say.

A mod asked to launch while its run is `launching` or `running` is left as it is, and one asked while its run is `terminating` launches once that run is `notRunning`. Nothing launches while the app quits.

### The relaunch limit

A mod is **at the relaunch limit** once five of its runs have failed within 10 seconds: as a run fails, the runs of the mod that failed in the 10 seconds before it are counted with it, and five reach the limit. A mod at the limit stays at it until a `launch` or `relaunch` request asks it to launch, which takes it off the limit and forgets the runs that failed before. What the system counts is kept while the app runs, and each start of the app begins with nothing counted.

### What ends a run

The end of a mod's run is asked:

- by a `quit` or `relaunch` request;
- by the mod itself, as *A mod quitting itself* says;
- as the app quits, of every run that has not ended. The app quits once each of them is `notRunning`;
- once the catalog no longer holds, under the mod's name, the bundle the run is of. Where the run was launching or running, the mod then launches again, from the bundle the catalog holds under its name now, if it holds one.

### What the system answers of a run

What the system answers of a mod's run is its latest run's, read once the app has settled, as [the case format](../DECKIT-1/SPEC.md) says, and the first of these that is so:

- the string `"running"`, where it is `running`;
- refused at `launch` with kind `RELAUNCH_LIMIT`, where the mod is at the relaunch limit;
- refused at `launch` with kind `TIMED_OUT`, where its latest run timed out;
- refused at `launch` with kind `NOT_LAUNCHED`, where its latest run failed to launch;
- the string `"notRunning"` otherwise, and for a mod that has not run since the app started.

Under a name whose bundle the system did not take, it is refused at `read` with kind `NOT_LOADABLE`, as [the bundle](../DECKIT-2/SPEC.md) refuses the bundle. Under a name no bundle is listed under, there is no mod to answer of.

### What a mod granted deckit.mods asks

`deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards each of these requests:

| request | takes | answers | refused with |
|---|---|---|---|
| `launch` | `id`, a string | nothing, once the mod's run is `running` | at `call` `NOT_INSTALLED`; at `read` `NOT_LOADABLE`; at `launch` `NOT_LAUNCHED`, `TIMED_OUT` |
| `quit` | `id`, a string | nothing, once the mod's run is `notRunning` | at `call` `NOT_INSTALLED` |
| `relaunch` | `id`, a string | nothing, once the mod's new run is `running` | at `call` `NOT_INSTALLED`; at `read` `NOT_LOADABLE`; at `launch` `NOT_LAUNCHED`, `TIMED_OUT` |
| `runs` | nothing | an array of entries, one for each name whose bundle the system took, in [the catalog](../DECKIT-4/SPEC.md)'s order | |

A request is refused first as [the permissions](../DECKIT-3/SPEC.md) refuse one, then as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, and then with the first refusal of its row that is so, in the row's order. Each that takes `id` is refused at `call` with kind `NOT_INSTALLED` where no bundle is listed under `id`, as [the catalog](../DECKIT-4/SPEC.md)'s `remove` is.

`launch` launches the mod the catalog holds under `id`, as *What launches a mod* says. It is refused at `read` with kind `NOT_LOADABLE` where the system did not take the bundle the catalog holds under `id`, and at `launch` with kind `NOT_LAUNCHED` or `TIMED_OUT` where the run it asked for failed to launch or timed out. Asked while the app quits, it launches nothing and is refused at `launch` with kind `NOT_LAUNCHED`.

`quit` asks the end of the run of the mod under `id`. A mod whose run is `notRunning`, or that has no run, is left as it is.

`relaunch` asks the end of the run of the mod under `id`, as `quit` does, and once that run is `notRunning`, launches the mod, as `launch` does, with its answer and its refusals. A mod whose run is `notRunning`, or that has no run, is launched.

`runs` answers the mod's latest run for each entry, a table:

| key | value |
|---|---|
| `id` | string: the name the bundle is listed under |
| `state` | string: the run's state, one of the four of *A run*; `"notRunning"` for a mod that has not run since the app started |
| `refusal` | table `{ stage, kind, message }`: where what the system answers of the run, as *What the system answers of a run* says, is a refusal, that refusal, `message` why, as [the handle](../DECKIT-7/SPEC.md)'s errors carry it; absent otherwise |
| `problem` | string: what went wrong with the run as it launched or ran, or why it failed, as the implementation says it; absent where nothing did |
| `failed` | boolean: whether the run failed, as *A run* says; `false` for a mod that has not run since the app started |
| `launchedAt` | integer: when the run came to be `running`, in milliseconds since 1970-01-01 00:00:00 UTC; absent before it has |
| `summary` | table: the run's **summary**, what it contributes as the layers on the system report it, which their DECKITs fix; absent where none is reported. A run that is `launching` or `terminating` answers the summary of the mod's latest run that came to be `running`, and is absent where none did. A run that is `notRunning` answers none |

### A mod quitting itself

`quit()`, a member of [the handle](../DECKIT-7/SPEC.md), is the request through which a run asks its own end:

| request | takes | answers | refused with |
|---|---|---|---|
| `quit()` | nothing | nothing, once the run's end is asked | |

It asks the end of the run whose handle it is called on, as `quit` asks the end of a run: a run that is `launching` or `running` moves to `terminating`, and one that is `terminating` is left as it is. A handle a layer hands its lifecycles is the run's, as [the handle](../DECKIT-7/SPEC.md) says, and `quit()` through it asks the end of the same run. No permission guards it, and it is never refused.

A run whose end `quit()` asked has not failed, as *A run* says, whether it was `launching` or `running`: a background mod is not launched again for it, and once it has ended, what the system answers of it is `"notRunning"`.

**Note.** `quit()` answers once the end is asked, and not once the run has ended as `quit` does: the run's code ends with the run, so an answer given only then would reach no code.

## Interactions

- What a bundle is, which bundles are taken, the `background` key, and the refusal at `read`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods`, and the refusal of a request made by a mod not granted it: [the permissions](../DECKIT-3/SPEC.md).
- Which bundle the catalog holds under a name, the catalog's order, what a host ships, and installing and removing a bundle: [the catalog](../DECKIT-4/SPEC.md).
- What the entry exports, what a run needs of it, what starting and ending the mod's code is, and the time a run's end is given: [the entry](../DECKIT-6/SPEC.md).
- The handle a mod makes these requests through, `quit()` among its members, and a handle a layer hands its lifecycles: [the handle](../DECKIT-7/SPEC.md). The input that hands a case's request: [the case format](../DECKIT-1/SPEC.md).
- A lifecycle that reaches a mod, and what a run that ends does to its connections: [the connections](../DECKIT-9/SPEC.md).
- What a run's summary holds: the DECKITs of the layers on the system.
- Being told that a run may have moved: [the events](../DECKIT-12/SPEC.md).
- When the app has quit, as a host is told it: the embedding DECKIT. What a host is given of the runs: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- The relaunch limit as runs that failed in a row, each counted by how long it ran. A run that failed long after the last one says nothing of the next, and a window of time counts every way a run fails by one measure.
- Waiting before a background mod launches again. A run that failed is `notRunning`, and the limit already stops a mod that fails at once.
- No time a launch is given. A run whose code never starts leaves the `launch` request and every lifecycle that waits for the mod waiting, and the app never settles.
- A limit the host gives. A mod is written for every host, and how often a mod that fails comes back is part of what it can count on.
- Launching again every mod whose run failed. A mod that is not a background mod launches because something asked it to, and whether to ask again is that asker's.
- One kind for every launch that does not come to run. A launch out of time is a code that did not answer, which what reads the refusal treats apart from a code that threw, and a mod at the limit is one nothing launches by itself.
- A kind for each way a launch fails to start: an entry that throws, a class that is not one, a start that throws. What reads the refusal does one thing with each, and the reason is the refusal's message.
- A mod quitting itself through `quit` of `deckit.mods`. That permission reaches every mod, which a mod that only ends itself has no need of, and its answer comes once the run has ended, when the code that waits for it has ended too.
- No `relaunch` request, a `quit` and then a `launch`. Between the two another request may launch the mod, and the mod that asked may be the one quit, so its own launch would never be asked.

## Notes

**Note.** Several sentences above are held by no case under `conformance/`, each for its reason. `TIMED_OUT` of `launch` and `relaunch`: a launch out of time takes longer than a step may take to settle. A `launch` asked while the app quits, and a mod asked to launch while its run is `terminating`: steps settle one at a time, so no step comes while the app quits or a run is between two states. A crash: no bundle can end its own sandbox through what a mod is given. What the app's quit does but let the next start come: [the case format](../DECKIT-1/SPEC.md) looks at nothing after a `quit`. That background mods launch in the catalog's order: no look of the case format shows which run launched first, and [the events](../DECKIT-12/SPEC.md) tell only that the mods may have changed. The 20 seconds of a launch and the 10 seconds of the limit: a time input is not in the case format, and a launch out of time takes longer than a step may take to settle. That the limit is five runs, and not four or six: no state is carried from one run to the next, so no bundle can fail four times and then start, and what the system answers of a run gives no count. That each start begins with nothing counted: a mod at the limit as the app quit comes to it again at the next start, counted afresh or not. That `quit()` answers once the end is asked: [the case format](../DECKIT-1/SPEC.md) compares no answer of an input that answers nothing. Of what `runs` answers, `launchedAt`: a case writes no time. `problem` and the `message` of `refusal`: no rule states a message, and a table is matched whole. `summary`: what it holds is the layers' DECKITs', and no case's host stacks a layer a case writes. Its `state`, and `failed`: the look at a run of [the case format](../DECKIT-1/SPEC.md) reads the same latest run. That `quit()` leaves a run that is `terminating` as it is, and asks the end of the run through a layer's handle: no step comes while a run is between two states, and no case's host stacks a layer a case writes.

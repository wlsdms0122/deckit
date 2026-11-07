# DECKIT-5: The lifecycle

Status: draft
Area: system

## Summary

A mod runs in runs, one at a time. This DECKIT fixes a run's states and the steps between them, what launches a mod and what ends its run, which runs fail, which background mods launch again after a run fails and when the relaunch limit stops them, the refusals at `launch`, and the requests a mod granted `deckit.mods` makes to launch a mod, to quit one and to launch one again.

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

The same mod with an entry that never finishes starting holds every request waiting for it to launch. Where one implementation ends the launch after a time and another waits forever, a mod that waits for it works on one and hangs on the other.

A mod granted `deckit.mods` asks that another launch, and that launch fails. Whether the request is answered or refused, and at which stage and with which kind, decides whether the same mod manager can tell a mod that did not launch from one that did.

## Rules

### A run

A mod runs in **runs**, one at a time, and each launch is a new run. A run runs the bundle the catalog held under the mod's name as the mod launched. It is in one of four states:

| state | the run |
|---|---|
| `launching` | has launched, and its code has not started yet |
| `running` | its code has started, and its end has not been asked |
| `terminating` | its end has been asked, or it failed to launch, and its code has not ended it yet |
| `notRunning` | has ended |

It moves between them by these steps and no others:

| step | from | to |
|---|---|---|
| it launches | | `launching` |
| its code has started | `launching` | `running` |
| it fails to launch | `launching` | `terminating` |
| its end is asked | `launching`, `running` | `terminating` |
| its code has ended it, or the time its end is given has run out | `terminating` | `notRunning` |
| its sandbox ends | `launching`, `running`, `terminating` | `notRunning` |

Launching evaluates the file `main` names as the mod's entry. What the entry exports, what starting the mod's code is and when it has started, and the time a run's end is given: the handle's DECKIT.

A run **fails to launch** when evaluating its entry throws, or when its code does not start. A run **times out** when its code has not started 20 seconds after it launched, and it then moves as a run that fails to launch. A run **crashes** when its sandbox ends while it has not ended. A run **failed** when it failed to launch, timed out, or crashed before its end was asked.

### What launches a mod

A mod launches only as one of these asks it:

- As the app starts, once what the host ships is installed, every background mod the catalog holds launches, in the catalog's order.
- A background mod whose run failed launches again once that run is not running, unless it is at the relaunch limit.
- A `launch` or `relaunch` request.
- A lifecycle that waits for the mod, as the connections' DECKIT says, unless the mod is at the relaunch limit.

A mod asked to launch while its run launches or runs is left as it is, and one asked while its run terminates launches once that run is not running. Nothing launches while the app quits.

### The relaunch limit

A mod is **at the relaunch limit** once five of its runs have failed within 10 seconds: as a run fails, the runs of the mod that failed in the 10 seconds before it are counted with it, and five reach the limit. A mod at the limit stays at it until a `launch` or `relaunch` request asks it to launch, which takes it off the limit and forgets the runs that failed before. What the system counts is kept while the app runs, and each start of the app begins with nothing counted.

### What ends a run

The end of a mod's run is asked:

- by a `quit` or `relaunch` request;
- by the mod itself, as the handle's DECKIT says;
- as the app quits, of every run that has not ended. The app quits once each of them is not running;
- once the catalog no longer holds, under the mod's name, the bundle the run runs. Where the run was launching or running, the mod then launches again, from the bundle the catalog holds under its name now, if it holds one.

### What the system answers of a run

What the system answers of a mod's run is its latest run's, read once the app has settled, as [the case format](../DECKIT-1/SPEC.md) says:

- the string `"running"`, where it runs;
- refused at `launch` with kind `RELAUNCH_LIMIT`, where the mod is at the relaunch limit;
- refused at `launch` with kind `TIMED_OUT`, where its latest run timed out;
- refused at `launch` with kind `NOT_LAUNCHED`, where its latest run failed to launch;
- the string `"notRunning"` otherwise, and for a mod that has not run since the app started.

Under a name whose bundle the system did not take, it is refused at `read` with kind `NOT_LOADABLE`, as [the bundle](../DECKIT-2/SPEC.md) refuses the bundle.

### What a mod granted deckit.mods asks

`deckit.mods`, as [the permissions](../DECKIT-3/SPEC.md) define it, guards each of these requests:

| request | takes | answers | refused with |
|---|---|---|---|
| `launch` | `id`, a string | nothing, once the mod runs | `read`: `NOT_LOADABLE`; `launch`: `NOT_LAUNCHED`, `TIMED_OUT` |
| `quit` | `id`, a string | nothing, once the mod does not run | |
| `relaunch` | `id`, a string | nothing, once the mod runs again | `read`: `NOT_LOADABLE`; `launch`: `NOT_LAUNCHED`, `TIMED_OUT` |

`launch` launches the mod the catalog holds under `id`, as *What launches a mod* says. It is refused at `read` with kind `NOT_LOADABLE` where the catalog holds no bundle under `id` the system took, and at `launch` with kind `NOT_LAUNCHED` or `TIMED_OUT` where the run it asked for failed to launch or timed out. Asked while the app quits, it launches nothing and answers nothing.

`quit` asks the end of the run of the mod under `id`. A mod that does not run is left as it is.

`relaunch` asks the end of the run of the mod under `id`, as `quit` does, and once that run is not running, launches the mod, as `launch` does, with its answer and its refusals. A mod that does not run is launched.

## Interactions

- What a bundle is, which bundles are taken, the `background` key, and the refusal at `read`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods`, and the refusal of a request made by a mod not granted it: [the permissions](../DECKIT-3/SPEC.md).
- Which bundle the catalog holds under a name, the catalog's order, what a host ships, and installing and removing a bundle: [the catalog](../DECKIT-4/SPEC.md).
- What the entry exports, what starting and ending the mod's code is, the time a run's end is given, a mod quitting itself, and the input that hands a case's request: the handle's DECKIT.
- A lifecycle that waits for a mod, and what a run that ends does to its connections: the connections' DECKIT.
- Being told that a run has moved: the events' DECKIT.
- What a host is told of the runs and when the app has quit: the embedding DECKIT.

## Alternatives considered

- The relaunch limit as runs that failed in a row, each counted by how long it ran. A run that failed long after the last one says nothing of the next, and a window of time counts every way a run fails by one measure.
- Waiting before a background mod launches again. A run that failed is not running, and the limit already stops a mod that fails at once.
- No time a launch is given. A run whose code never starts holds the `launch` request and every lifecycle waiting for the mod, and the app never settles.
- A limit the host gives. A mod is written for every host, and how often a mod that fails comes back is part of what it can count on.
- Launching again every mod whose run failed. A mod that is not a background mod runs because something asked it to, and whether to ask again is that asker's.
- One kind for every launch that does not come to run. A launch out of time is a code that did not answer, which what reads the refusal treats apart from a code that threw, and a mod at the limit is one nothing launches by itself.
- A kind for each way a launch fails to start: an entry that throws, a class that is not one, a start that throws. What reads the refusal does one thing with each, and the reason is the refusal's message.
- No `relaunch` request, a `quit` and then a `launch`. Between the two another request may launch the mod, and the mod that asked may be the one quit, so its own launch would never be asked.

## Notes

**Note.** Several sentences above are held by no case under `conformance/`, each for its reason. The requests, and a lifecycle that waits for a mod, wait on the handle's DECKIT and the connections' DECKIT, which add the input that hands a request. A crash: no bundle can end its own sandbox through what a mod is given. What the app's quit does: [the case format](../DECKIT-1/SPEC.md) looks at nothing after a `quit`. A bundle replaced while it runs: it waits on the input that hands a request, which installs one. The 20 seconds of a launch and the 10 seconds of the limit: a time input is not in the case format, and a launch out of time takes longer than a step may take to settle. That the limit is five runs: the cases hold that a mod failing at each launch comes to the limit, and what the system answers of a run holds no count.

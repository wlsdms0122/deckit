# DECKIT-1: Conformance

Status: draft
Area: system

## Summary

Conformance cases are data: one case sets up a host, hands the app a series of inputs, and says what each one is answered and what the app shows or keeps after it. The rules decide how a case is laid out and written and what a runner does with one, so that an implementation in another language runs the same cases and finds out the same things. One format holds the cases of every area: the system, the shell, the app and the shipped mods. Each case belongs to the `conformance/` of the one DECKIT it measures, and no two cases share a name.

## Motivation

Deckit has more than one implementation in view: another host language, the web. A test kept inside one implementation, written against its own types and its own process split, is a test of that implementation and says nothing to another. A rule two implementations read alike and answer differently, such as whether a bundle with an unknown top-level key is taken, is found only by a case both can run, written in terms of what both have: bundles, the inputs an app receives, and what the app answers and shows.

## Rules

How a case is laid out and written, and what a runner does with one. An implementation that passes every case is not thereby correct, and one that fails a case is thereby wrong.

### What a case is

A case is a folder. It sits in the `conformance/` of the one DECKIT whose rule it measures, and its folder's name is the case's name, which no other case in the specification has:

```
spec/DECKIT-N/conformance/
  <name>/
    case.toml          the case: the host, the steps, what each step must come to
    mods/              the bundles written for the case, if any
      <bundle>/        one bundle, as the bundle's DECKIT has it, named by its folder
        manifest.toml
        …
```

What else the folder holds is not the case's. A case is named, and a bundle in `mods/` is named, by this grammar:

```
case-name   = lower *( lower / DIGIT / "-" )
bundle-name = lower *( lower / DIGIT / "-" )
lower       = %x61-7A                      ; a to z
```

`case.toml` is written in the manifest text [the bundle](../DECKIT-2/SPEC.md) fixes, and is read by the same reader. Its keys are these and no others:

| key | takes | required | what it says |
|---|---|---|---|
| `case` | integer | yes | the case format this file is written for. Current format: **1** |
| `name` | string, a `case-name` | yes | the case's name, which is its folder's name |
| `note` | string | yes | why the case exists: the rule it holds an implementation to |
| `host` | table, under *The host* | yes | the host the app runs on |
| `drive` | array of `bundle-name` | no | the bundles whose entry the runner supplies, under *Driven bundles* |
| `step` | array of tables, `[[step]]`, under *Steps* | yes, at least one | the steps, in the order they are taken |

A case **refuses as a case** when it writes any other key, a key under the wrong table, a value of another type than the table gives, a `name` that is not its folder's name, a bundle in `mods/` that no key of the case names, or a name of a bundle that is not in `mods/`. What refuses as a case is asked by no case: the folders hold the suite, and a runner that refuses one of its cases stops on it, because the suite is what is wrong then.

### The host

`[host]` says what the app runs on, which is everything the runner sets up before the first step:

| key | takes | required | what it says |
|---|---|---|---|
| `base` | `"system"`, `"shell"` or `"app"` | yes | what the host is before the case adds to it, below |
| `api` | string, a version as [the bundle](../DECKIT-2/SPEC.md) writes one | with `base = "system"`, and only there | the mod contract the host runs mods with |
| `fields` | array of strings | no | the manifest fields the host adds, in order |
| `permissions` | array of tables `{ id, name, means, privileged }`, each a string but `privileged`, a boolean | no | the permissions the host defines, in order |
| `ship` | array of `bundle-name` | no | the bundles the host ships, in the order it ships them |
| `system` | array of `bundle-name`, each one in `ship` | no | the bundles it ships that it marks system |
| `sources` | array of `bundle-name` | no | the bundles it reads in place |

| base | the host |
|---|---|
| `system` | the system and its layers alone: no shell is on and nothing is shipped. The case's `api` is the mod contract it runs mods with |
| `shell` | the system with the shell on, as the shell's DECKITs fix it, the fields and permissions the shell adds among it. Nothing is shipped. Its mod contract is the one this specification describes |
| `app` | Deckit.app as it ships, as the app's DECKITs fix it: the shell, the mods it ships and those it marks system, and its own answers. Its mod contract is the one this specification describes |

What the case writes under `[host]` adds to the base: its fields and permissions after the base's, its bundles shipped after the base's. Where the case defines a field or a permission that its base or the system already defines, the start refuses as [the bundle](../DECKIT-2/SPEC.md) says, and that refusal is the answer to the `start` step.

Each run of a case starts from nothing kept: the system's own folder is new and empty, and every bundle is laid out afresh where the runner keeps its run, never in the case's folder. The bundles in `sources` are laid side by side in one folder, which the host hands the system as a folder of bundles read in place. Each bundle in `ship` is handed as a bundle the host ships, marked system where `system` names it.

### Driven bundles

A case makes a mod act through its handle by driving it. A bundle named in `drive` holds no file at the path its manifest's `main` names, and the runner writes its **driver** there before the first step. A driven bundle that holds that file refuses as a case.

The driver is an entry as the handle's DECKIT has one. It takes part in every lifecycle the system has, and the shell has where the shell is on, keeps each handle it is handed, and does nothing else until a `call` step asks it to. How the runner tells the driver what to call and hears what it was answered is the runner's own, and reaches nothing of the implementation: only the handles the driver was handed and what the system gives any host.

In what a `call` step hands, a table whose only keys are `"case.function"` and, if written, `"case.answers"` stands for a **function** the driver makes: called, it records the arguments it was called with, and returns the value under `"case.answers"`, or nothing where none is written. The string under `"case.function"` names it, and no two functions of one case share a name. Every other value is handed as it is written.

### Steps

Each `[[step]]` is one **input** the app receives or one **look** at what the app answers, shows or keeps, and writes `input` or `look`, exactly one of them. A step never says who acts: an input arrives at the app from wherever it comes, the app is not told, and no rule may tell. A look changes nothing.

Inputs:

| `input` | its keys | what the app receives | what it is answered |
|---|---|---|---|
| `start` | none | the app starts, on the host `[host]` gives | nothing, or a refusal |
| `quit` | none | the app quits | nothing |
| `call` | `mod`, `member`, `args` | a call, through the handle of the running driven mod whose id is `mod`, to the member at the path `member`, handed `args` | what the member answers, or its refusal |
| `key` | `chord` | a key pressed, where the keyboard is | nothing |
| `click` | `on` | a click on what is shown at the place `on` | nothing |
| `type` | `text` | text typed, where the keyboard is | nothing |
| `time` | `seconds` | time passing for the app, as its clock reads | nothing |

Looks:

| `look` | its keys | what it answers |
|---|---|---|
| `mod` | `mod`, and `part` if written | the bundle the system read under the id `mod`, as [the bundle](../DECKIT-2/SPEC.md) answers one, or the value under the key `part` of it. A bundle it did not take refuses at `read` |
| `mods` | none | the ids of every bundle the system found, taken or not, in its order |
| `run` | `mod` | the state of the run of the mod `mod`, as the lifecycle's DECKIT names its states |
| `heard` | `function` | each list of arguments the function of that name was called with since the case started or since the last `heard` of it, in the order called. An event, a message on a connection and a lifecycle call are each heard this way, by the function the case handed to receive it |
| `shown` | `at` | what is shown at the place `at`, as the DECKIT that shows it gives it: the mod in front, a list's rows, a window |

Their keys take:

| key | takes |
|---|---|
| `mod` | string: a mod's id |
| `member` | string: `member-path` below. Its first name is the handle's, as the handle's DECKIT names it |
| `args` | array of values: what the member is handed, in order |
| `part` | string: a key of the answer [the bundle](../DECKIT-2/SPEC.md) fixes |
| `function` | string: the name of a function the case handed |
| `chord` | string: a chord, as the keys' DECKIT writes one |
| `on`, `at` | string: `place` below, as the DECKIT that shows it names its places |
| `text` | string |
| `seconds` | integer, at least 1 |

```
member-path = identifier *( "." identifier )
identifier  = ALPHA *( ALPHA / DIGIT / "_" )
place       = place-name *( "/" place-name )
place-name  = 1*( lower / DIGIT / "-" / "." / "_" )
```

`start` is the first step, and a case starts the app again only after a `quit`. A case whose `start` is refused writes no step after it.

### What a step must come to

A step may write `[step.expect]`, which holds `answers`, or `refuses` and `kind`:

| key | takes | means |
|---|---|---|
| `answers` | any value | the step answers this value |
| `refuses` | `"read"`, `"launch"` or `"call"` | the step is refused at this stage, and at no earlier or later one |
| `kind` | string, `[A-Z][A-Z_]*` | the refusal's kind; written beside `refuses` and only there |

A look writes `[step.expect]`, always. An input without it must not be refused, and what it answers is not compared. An input whose answer is nothing writes no `answers`.

**What a step expects is matched strictly**, as values: a string matches the string of the same Unicode scalar values; an integer the number of the same value; a boolean the same boolean; an array the array of matching values in the same order; a table the table of the same keys, each bound to a matching value. A key that an implementation answers with no value (a null) is a key it does not answer, since the manifest text has no null.

### What a runner does

Read `case.toml`, and read `case` before any other key: a case written for a format this runner does not know says so as "this runner is too old for this case", which is a different refusal from "this is not a case". Then check every key under the tables above, and refuse as a case what they do not take.

Lay out the bundles, write the driver into each driven bundle, and set up the host as `[host]` gives it. Then take the steps in order. After each input, wait until the app has **settled**: nothing it was asked is left unanswered, no run is between two states, and what it shows has been drawn. An input the app has not settled after within 10 seconds fails the case. Then compare what the step came to with its `expect`, if it writes one. A step that does not match fails the case, and the runner names the step by its place in the list, from 1, and what it came to.

A case passes when every step matches. A runner reports, for each case, whether it passed, and for one that did not, its first step that did not match.

A runner reaches inside nothing. It sets up a host with what the system gives any host, hands inputs as the app receives them from outside, makes calls only through the handles the driver was handed, and reads only what the system gives a host or what is shown. One that could see inside its implementation could pass by agreeing with the implementation rather than with the specification.

A runner runs the cases of the live set and no others, as [the specification](../README.md) works the live set out.

### How a case is written

A case is written by hand, in the manifest text, with one key a line, its tables in the order of the table under *What a case is*, and each step's keys before its `[step.expect]`. A case names one rule in its `note` and is written so that the rule it names is the one that refuses or answers: every other part of it is one the system takes.

**Note.** `case.toml` is written in the manifest text so that a runner needs no reader beyond the one every implementation has, and so that a bundle and the case around it read alike.

## Interactions

- The manifest text, the versions and the answer a `mod` look gives: [the bundle](../DECKIT-2/SPEC.md).
- The handle's names, the run's states, a chord's grammar and the places of what is shown are the DECKITs that fix them. A step that names one of them is measured against that DECKIT.

## Alternatives considered

- A case as one file, with its bundles written inline as tables. A bundle is a folder, and a rule about one, such as a `main` naming no file in it, is about files beside the manifest. A bundle written inline would be a second spelling of a bundle, and the runner would write the folder anyway.
- Steps that name an actor (the host, a person, a mod). What an input comes to cannot depend on who sent it, so a step that named one would ask a question no rule may answer. Where the surface matters, the step names where the input arrives: a mod's handle, the place clicked.
- Matching a refusal's message. No rule states a message, so a runner that matched one would hold implementations to something the specification does not say. A runner measures the stage and the kind.
- A runner that waits a fixed time after each input. What settles fast would be slow to test, and what settles slow would fail at random. Settling is a fact of the app.

## Notes

**Note.** This format holds the cases of every area: an input reaches the system (`start`, `call`, `time`), the shell or a shipped mod (`key`, `click`, `type`) alike, and a look reads what the system keeps (`mod`, `mods`, `run`) or what is shown (`shown`). A DECKIT that needs an input or a look this format does not have supplements this DECKIT with it, which moves no existing case's answer.

**Note.** This DECKIT's rules are held by every case in the specification, and what refuses as a case is asked by no case, so its own `conformance/` holds none.

**Note.** No runner reads this format at this commit, so no case under any DECKIT has run, and this DECKIT stays `draft` until one does (criterion C5).

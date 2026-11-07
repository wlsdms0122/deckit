# DECKIT-1: Conformance

Status: accepted
Area: system

## Summary

Conformance cases are data: one case sets up a host, hands the host app a series of inputs, and says what the system answers after each one. The rules decide how a case is laid out and written and what a runner does with one, so that an implementation in another language runs the same cases and finds out the same things. One format holds the cases of every DECKIT, and a DECKIT that needs more of it adds to it. Each case belongs to the `conformance/` of the one DECKIT it measures, and no two cases share a name.

## Motivation

Deckit has more than one implementation in view: another host language, the web. A test kept inside one implementation, written against its own types and its own process split, is a test of that implementation and says nothing to another. A rule two implementations read alike and answer differently, such as whether a bundle with an unknown top-level key is taken, is found only by a case both can run, written in terms of what both have: bundles, the inputs a host app receives, and what the system answers.

What a runner does with a case decides what the case finds out. Each of these is a case two runners could judge differently without a rule:

- **Settling.** A runner looks at `mods` 100 milliseconds after a `start`. For the same bundle and the same implementation it reads `["mod-a"]` on one machine and `[]` on a slower one.
- **Strict matching.** A `mod` look expects a bundle's whole answer, and an implementation answers it with one more key, `color`. A runner that compares only the keys the expect writes passes the case, and one that compares the whole value fails it.
- **Refusing as a case.** A step writes `look = "mods"` and its expect under `[step.expected]`. A runner that passes over the key it does not know compares nothing, and the case passes whatever the system answers.
- **The format's number.** A case writes a look added after a runner was built. One runner refuses it as a case and stops the suite, and another reports itself too old for it and goes on.

## Rules

How a case is laid out and written, and what a runner does with one. An implementation that passes every case is not thereby correct, and one that fails a case is thereby wrong.

### What a case is

A case is a folder. It sits in the `conformance/` of the one DECKIT whose rule it measures, and its folder's name is the case's name, which no other case in the specification has:

```
spec/DECKIT-N/conformance/
  <name>/
    case.toml          the case: the host, the steps, what each step must come to
    mods/              the case's bundles, if any
      <bundle>/        one bundle, named by its folder
        manifest.toml
        …
```

Each folder in `mods/` is one of the case's bundles: a folder the runner lays out for the system to read, which [the bundle](../DECKIT-2/SPEC.md) takes, refuses or passes over. What else `mods/` holds, and what else the case's folder holds, is not the case's. A case is named, and a bundle in `mods/` is named, by this grammar:

```
case-name   = lower *( lower / DIGIT / "-" )
bundle-name = [ "." ] lower *( lower / DIGIT / "-" )
lower       = %x61-7A                      ; a to z
```

`case.toml` is written in the manifest text [the bundle](../DECKIT-2/SPEC.md) fixes, so its integers lie within the same bound as a manifest's. A runner reads it by that text's rules, with a reader of its own. Its keys are these and no others:

| key | takes | required | what it says |
|---|---|---|---|
| `case` | integer, at least 1 | yes | the case format this file is written for, under *Formats* |
| `name` | string, a `case-name` | yes | the case's name, which is its folder's name |
| `note` | string | yes | why the case exists: the rule it holds an implementation to |
| `host` | table, under *The host* | yes | what the host app is made of |
| `step` | array of tables, `[[step]]`, under *Steps* | yes, at least one | the steps, in the order they are taken |

A case **refuses as a case** when it breaks any rule under *What a case is*, *The host*, *Steps*, *What a step must come to* and *Formats*, the grammars and bounds among them, or when its name is another case's in the specification. Among them: a key the tables do not give, a key under the wrong table, a value of another type than the table gives, a `name` that is not its folder's name, a bundle in `mods/` that no key of the case names, and a name of a bundle that is not in `mods/`.

### The host

`[host]` says what the host app is made of, which is everything the runner sets up before the first step:

| key | takes | required | what it says |
|---|---|---|---|
| `base` | `"system"` | yes | what the host is before the case adds to it, below |
| `api` | string, a version as [the bundle](../DECKIT-2/SPEC.md) writes one | yes | the version of the mod contract the host runs mods with |
| `fields` | array of strings | no | the manifest fields the host adds, in order |
| `permissions` | array of tables `{ id, name, means, privileged }`, each a string but `privileged`, a boolean, which may be left out and is then handed absent | no | the permissions the host defines, in order |
| `ship` | array of `bundle-name` | no | the bundles the host ships, in the order it ships them |
| `system` | array of `bundle-name`, each one in `ship` | no | the bundles it ships that it marks system |
| `sources` | array of `bundle-name` | no | the bundles it reads in place |

| base | the host |
|---|---|
| `system` | the system alone, with nothing shipped |

What the case writes under `[host]` adds to the base. Its fields and permissions come after the base's, as [the bundle](../DECKIT-2/SPEC.md) says, and a refusal of one is the answer to the `start` step.

Each run of a case starts from nothing kept: the system's own folder is new and empty, and every bundle is laid out afresh where the runner keeps its run, never in the case's folder. A bundle is laid out as written: each file and folder as the case holds it, and each link as a link holding the target it is written with, so that a link to a place inside the bundle points inside the bundle laid out. Each bundle is laid out in a folder named by its `bundle-name`. Those in `sources` lie side by side in one folder that holds nothing else, which the host hands the system as a folder of bundles read in place. Each one in `ship` is handed as its own folder of that name, a bundle the host ships, marked system where `system` names it.

### What the system gives a host

A runner sets up a host, and reads what the system answers, through what the system gives any host:

| what | when | what it is |
|---|---|---|
| the fields and permissions the host adds | before the start | as [the bundle](../DECKIT-2/SPEC.md) fixes them |
| the bundles the host ships | before the start | each one's folder, marked system or not |
| a folder of bundles read in place | before the start | one folder |
| the system's own folder | before the start | one folder, the system's alone |
| the mod contract | before the start | the version the host runs mods with |
| the start | as the host app starts | answered once the host app has settled, or refused at `call` with its kind |
| the bundles found | once the host app has started | the name each one is listed under, in the system's order, and each one by that name, answered or refused as [the bundle](../DECKIT-2/SPEC.md) says |
| the quit | as the host app quits | answered once the host app has quit |

### Steps

Each `[[step]]` is one **input** the host app receives or one **look** at what the system answers or keeps, and writes `input` or `look`, exactly one of them. A step never says who acts: an input arrives at the host app from wherever it comes, the host app is not told, and no rule may tell. A look changes nothing.

Inputs:

| `input` | its keys | what the host app receives | what it is answered |
|---|---|---|---|
| `start` | none | the host app starts, on the host `[host]` gives | nothing, or a refusal at `call` of what the host hands as the host app starts |
| `quit` | none | the host app quits | nothing |

Looks:

| `look` | its keys | what it answers |
|---|---|---|
| `mod` | `mod`, and `part` if written | the bundle the system found under the name `mod`, as [the bundle](../DECKIT-2/SPEC.md) answers one, or the value under the key `part` of it. A bundle it did not take refuses at `read` |
| `mods` | none | the name each bundle the system found is listed under, taken or not, in the system's order |

Their keys take:

| key | takes |
|---|---|
| `mod` | string: a name a bundle is listed under |
| `part` | string: a key of the answer [the bundle](../DECKIT-2/SPEC.md) fixes |

A look at a name no bundle is listed under, or at a `part` the answer does not hold, comes to nothing, which no `[step.expect]` matches. A key's absence from an answer is read by a look at the whole bundle.

`start` is the first step. A case starts the host app again only after a `quit`, and looks only while the host app is started: after a `start` and before the next `quit`. A case whose `start` is refused writes no step after it.

### What a step must come to

A step may write `[step.expect]`, which holds `answers`, or `refuses` and `kind`:

| key | takes | means |
|---|---|---|
| `answers` | any value | the step answers this value |
| `refuses` | `"read"`, `"launch"` or `"call"` | the step is refused at this stage, and at no earlier or later one |
| `kind` | string, `[A-Z][A-Z_]*` | the refusal's kind; written beside `refuses` and only there |

A look writes `[step.expect]`, always. An input without it must not be refused, and what it answers is not compared. An input whose answer is nothing writes no `answers`.

**What a step expects is matched strictly**, as values: a string matches the string of the same Unicode scalar values; an integer the number of the same value; a boolean the same boolean; an array the array of matching values in the same order; a table the table of the same keys, each bound to a matching value. A key that an implementation answers with no value (a null) is a key it does not answer, since the manifest text has no null.

### Formats

A case format is the keys, values, bases, inputs and looks a case may write. The rows of this DECKIT's tables are format **1**. A DECKIT that needs a base, an input, a look or a key that the format does not have adds it to this format as a supplement to this DECKIT, and gives the format the next number. That format holds every row of the one before it and the rows the DECKIT adds, and each row it adds says the format that added it. A case writes only the rows of its format.

### What a runner does

A runner knows every format up to the newest it was built for. It reads `case.toml`, and reads `case` before any other key, so that a case it is too old for is told from one that is not a case. It then holds the case to every rule above.

It lays out the bundles and sets up the host as `[host]` gives it, then takes the steps in order. After each input, it waits until the host app has **settled**: nothing it was asked is left unanswered, and no run is between two states. An input the host app has not settled after, or a look it has not answered, within 10 seconds fails the case. Then it compares what the step came to with its `expect`, if it writes one. A step that does not match fails the case. A case passes when every step matches.

A case comes to one of these outcomes:

| outcome | the case | the run |
|---|---|---|
| passed | every step matched | goes on |
| failed | a step did not match, or did not settle or answer within 10 seconds; the runner names the first such step by its place in the list, from 1, and what it came to | goes on |
| too old | is of a later format than the newest the runner knows | goes on |
| not laid out | holds a bundle the runner cannot lay out as written, and nothing of it runs | goes on |
| not a case | refuses as a case | the runner reports it and runs no case |

For each case a runner reports the case's name, its DECKIT and that DECKIT's status, and its outcome.

A runner reaches inside nothing. It sets up a host and reads what the system answers only through what the system gives any host, under *What the system gives a host*, and hands inputs as the host app receives them from outside. One that could see inside its implementation could pass by agreeing with the implementation rather than with the specification.

Asked for nothing, a runner runs the cases of the live set, as [the specification](../README.md) works the live set out. Asked for DECKITs or cases by name, it runs those, a draft's among them.

### How a case is written

A case is written by hand, in the manifest text, and is judged by its value. A case names one rule in its `note` and is written so that the rule it names is the one that refuses or answers: every other part of it is one the system takes.

**Note.** `case.toml` is written in the manifest text so that a bundle and the case around it are one text, read by one grammar.

## Interactions

- The manifest text, the versions, the fields and permissions a host adds, and the answer a `mod` look gives: [the bundle](../DECKIT-2/SPEC.md).
- The live set, and what an implementation conforms to: [the specification](../README.md).

## Alternatives considered

- A case as one file, with its bundles written inline as tables. A bundle is a folder, and a rule about one, such as a `main` naming no file in it, is about files beside the manifest. A bundle written inline would be a second spelling of a bundle, and the runner would write the folder anyway.
- Steps that name an actor (the host, a person, a mod). What an input comes to cannot depend on who sent it, so a step that named one would ask a question no rule may answer. Where the surface matters, a step names where the input arrives.
- Matching a refusal's message. No rule states a message, so a runner that matched one would hold implementations to something the specification does not say. A runner measures the stage and the kind.
- A runner that waits a fixed time after each input. What settles fast would be slow to test, and what settles slow would fail at random. Settling is a fact of the host app.

## Notes

**Note.** Some sentences above are held by no case, each for its reason. What refuses as a case, and every outcome but passed: a case in the specification measures the implementation and passes on a conforming one, and a case that refused as a case would stop the suite. The 10-second bound: a case that passes settles inside it. That a runner reaches inside nothing: it is a property of the runner, checked by reading the runner. That each run starts from nothing kept: no input or look of this format reads the system's own folder. The order `mods` answers in, and with it the order of `ship`: the order the system finds bundles in is the catalog's DECKIT's, and its cases hold it. A refusal at `launch`: a start and the looks of this format answer what the host handed and what the system read of a bundle, all of it decided before a run launches.

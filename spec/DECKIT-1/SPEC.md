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

Each entry of `mods/`, a folder, a file or a link, is one of the case's bundles: an entry the runner lays out for the system to read, which [the bundle](../DECKIT-2/SPEC.md) takes, refuses or passes over. What else `mods/` holds, and what else the case's folder holds, is not the case's. A case is named, and a bundle in `mods/` is named, by this grammar:

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

A case **refuses as a case** when it breaks any rule under *What a case is*, *The host*, *Steps*, *What a step must come to* and *Formats*, the grammars and bounds among them, or when its name is another case's in the specification. Among them: a key the tables do not give, a key under the wrong table, a value of another type than the table gives, a `name` that is not its folder's name, a bundle in `mods/` that no key of the case names, a name of a bundle that is not in `mods/`, and a `bundle-name` written twice in `ship` and `sources` together.

### The host

`[host]` says what the host app is made of, which is everything the runner sets up before the first step:

| key | takes | required | what it says |
|---|---|---|---|
| `base` | `"system"` | yes | what the host is before the case adds to it, below |
| `api` | string, a version as [the bundle](../DECKIT-2/SPEC.md) writes one | yes | the version of the mod contract the host runs mods with |
| `fields` | array of strings | no | the manifest fields the host adds, in order |
| `permissions` | array of tables `{ id, name, description, privileged }`, each a string but `privileged`, a boolean, which may be left out and is then handed absent | no | the permissions the host defines, in order |
| `ship` | array of `bundle-name` | no | the bundles the host ships, in the order it ships them |
| `system` | array of `bundle-name`, each one in `ship` | no | the bundles it ships that it marks system |
| `sources` | array of `bundle-name` | no | the bundles it reads in place |
| `owners` | array of strings, each the name of a standard interface, `deckit/` and a name, none written twice | no | format 5: the standard interfaces whose owner the host ships, in order |

| base | the host |
|---|---|
| `system` | the system alone, with nothing shipped, which opens none of the addresses it is handed to open outside the app |

What the case writes under `[host]` adds to the base. Format 5: for each interface `owners` names, the host ships, before each bundle `ship` names, the bundle the implementation ships as the owner of that interface, marked system, as it ships it, and adds, before the fields the case writes, each field that bundle's manifest writes that [the bundle](../DECKIT-2/SPEC.md) does not read itself. The case names that bundle by nothing else. An implementation that ships no owner of an interface `owners` names cannot lay the case out. Its fields and permissions come after the base's, as [the bundle](../DECKIT-2/SPEC.md) says, and a refusal of one is the answer to the `start` step.

Each run of a case starts from nothing kept: the system's own folder is new and empty, and every bundle is laid out afresh where the runner keeps its run, never in the case's folder. A bundle is laid out as written: each file and folder as the case holds it, and each link as a link holding the target it is written with, so that a link to a place inside the bundle points inside the bundle laid out. Each bundle is laid out under its `bundle-name`, and a bundle that is a link is laid out as that link, so that a target naming a bundle beside it names that bundle laid out. Those in `sources` lie side by side in one folder that holds nothing else, which the host hands the system as a folder of bundles read in place. Each one in `ship` is handed as itself, laid out under that name, a bundle the host ships, marked system where `system` names it. Each one that a step's `folders` names and no key of `[host]` names is laid out on its own, apart from those in `sources`, and the host hands the system nothing of it. A bundle's **path** is the absolute path of the folder, file or link it is laid out as.

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
| the bundles found | once the host app has started | the name each one is listed under, in [the catalog's](../DECKIT-4/SPEC.md) order, and each one by that name, answered or refused as [the bundle](../DECKIT-2/SPEC.md) says |
| the runs | once the host app has started | format 2: for each name a bundle is listed under, what the system answers of its mod's run, as [the lifecycle](../DECKIT-5/SPEC.md) fixes it |
| a request through a mod's handle | while the mod's run is `running` | format 3: the run makes a request through the handle its code is handed, as the mod's code makes one, as [the handle](../DECKIT-7/SPEC.md) fixes it, and the host is answered what the request answers, or its refusal at its stage with its kind. Format 4: or through what a request the run made before answered, and handed a function the host gives, as the mod's code hands one of its own |
| the addresses to open outside the app | while the host app is started | format 3: each address a mod hands the host to open, with whether the app that opens it comes to the front, as [opening outside the app](../DECKIT-8/SPEC.md) fixes them |
| the quit | as the host app quits | answered once the host app has quit |

### Steps

Each `[[step]]` is one **input** the host app receives or one **look** at what the system answers or keeps, and writes `input` or `look`, exactly one of them. A step never says who acts: an input arrives at the host app from wherever it comes, the host app is not told, and no rule may tell. A `call` names the mod whose run makes the request, since a request is a mod's and its permissions are that mod's, and says nothing of where the input came from. A look changes nothing.

Inputs:

| `input` | its keys | what the host app receives | what it is answered |
|---|---|---|---|
| `start` | none | the host app starts, on the host `[host]` gives | nothing, or a refusal at `call` of what the host hands as the host app starts |
| `quit` | none | the host app quits | nothing |
| `call` | `mod` and `member`, and `args`, `folders`, `part`, `of`, `listener` and `handed` if written | format 3: the run of the mod listed under the name `mod` makes a request through its handle: the member `member`, called with the path of each bundle `folders` names, in order, then each value of `args`, in order, and then, format 4, a listener where `listener` is `true`. Format 4: where `of` is written, `member` names a member of what the call at that place answered, as the run holds it, and not of the handle. Format 5: where `handed` is `true`, `member` names a member of the first value the listener the call at `of` handed was last called with, as the run holds it. A member that holds a value is read, and is written with no `args`, no `folders` and no `listener` | what the request answers, or the value under the key `part` of it, or its refusal at its stage with its kind, as [the handle](../DECKIT-7/SPEC.md) fixes them |

Looks:

| `look` | its keys | what it answers |
|---|---|---|
| `mod` | `mod`, and `part` if written | the bundle the system found under the name `mod`, as [the bundle](../DECKIT-2/SPEC.md) answers one, or the value under the key `part` of it. A bundle it did not take refuses at `read` |
| `mods` | none | the name each bundle the system found is listed under, taken or not, in [the catalog's](../DECKIT-4/SPEC.md) order |
| `run` | `mod` | format 2: what the system answers of the run of the mod listed under the name `mod`, as [the lifecycle](../DECKIT-5/SPEC.md) fixes it: a string, or a refusal at `launch`. A bundle it did not take refuses at `read` |
| `opened` | none | format 3: an array of each address the system handed the host to open outside the app since the host app last started, in the order handed, each a table `{ url, activates }`, `url` a string and `activates` a boolean, as [opening outside the app](../DECKIT-8/SPEC.md) fixes them |
| `heard` | `mod` | format 4: an array, for each call of a listener a `call` handed a request of the run of the mod listed under the name `mod` that is `running`, in the order called, of the values it was called with, in order |

Their keys take:

| key | takes |
|---|---|
| `mod` | string: a name a bundle is listed under |
| `part` | string: a key of the answer the step reads |
| `member` | string, a `member`, below: format 3 |
| `args` | array of values: format 3 |
| `folders` | array of `bundle-name`: format 3 |
| `of` | integer: the place, from 1, of an earlier `call` of the same `mod`: format 4 |
| `listener` | boolean: format 4 |
| `handed` | boolean: written `true` beside an `of` whose call writes `listener`, format 5 |

```
member = name *( "." name )
name   = ALPHA *( ALPHA / DIGIT )
```

A `member` names a member of the handle: each `name` a member of the one before it, the first a member of the handle itself.

A step that writes `part` answers the value under that key of what it reads: of the answer, where the answer is a table, and, format 3, of each element of the answer that holds the key, in order, where the answer is an array of tables.

A **listener**, format 4, is a function the host gives: each call of it is kept, with the values it is called with, and it answers nothing. What a step answers, and each value a listener is called with, is read as a value: a function is no value, so a key of a table bound to one is a key not answered, a request that answers one answers nothing, and an answer that holds one anywhere else comes to nothing, as does such a value a listener is called with; a refusal, as [the handle](../DECKIT-7/SPEC.md) fixes one, is read as the table `{ stage, kind }`.

A look at a name no bundle is listed under, and a step whose `part` a table answer does not hold, or whose answer with a `part` is no table and no array of tables, come to nothing, which no `[step.expect]` matches. A key's absence from an answer is read by a look at the whole bundle. A `call` comes to nothing where no run of the mod listed under `mod` is `running` as the step is taken, where `member` names no member of the handle or of what the call at `of` answered, or, format 4, where the run that answered the call at `of` is not the one `running`, or, format 5, where `handed` is written and the listener the call at `of` handed has not been called. A `heard` look at a mod with no run `running` comes to nothing.

`start` is the first step. A case starts the host app again only after a `quit`, and calls and looks only while the host app is started: after a `start` and before the next `quit`. A case whose `start` is refused writes no step after it.

### What a step must come to

A step may write `[step.expect]`, which holds `answers`, or `refuses` and `kind`:

| key | takes | means |
|---|---|---|
| `answers` | any value | the step answers this value |
| `refuses` | `"read"`, `"launch"` or `"call"` | the step is refused at this stage, and at no earlier or later one |
| `kind` | string, `[A-Z][A-Z_]*` | the refusal's kind; written beside `refuses` and only there |

A look writes `[step.expect]`, always. An input without it must not be refused and must not come to nothing, and what it answers is not compared. An input whose answer is nothing writes no `answers`.

**What a step expects is matched strictly**, as values: a string matches the string of the same Unicode scalar values; an integer the number of the same value; a boolean the same boolean; an array the array of matching values in the same order; a table the table of the same keys, each bound to a matching value. A key that an implementation answers with no value (a null) is a key it does not answer, since the manifest text has no null.

### Formats

A case format is the keys, values, bases, inputs and looks a case may write. The rows of this DECKIT's tables are format **1**, but those that say a later format. Format **2** adds the rows that say so, for [the lifecycle](../DECKIT-5/SPEC.md). Format **3** adds the rows that say so, for the requests a mod makes through its handle. Format **4** adds the rows that say so, for what a mod is handed by a connection and calls across it. Format **5** adds the rows that say so, for the standard interfaces: the owner a host ships, and a call of what a connection handed a listener. A DECKIT that needs a base, an input, a look or a key that the format does not have adds it to this format as a supplement to this DECKIT, and gives the format the next number. That format holds every row of the one before it and the rows the DECKIT adds, and each row it adds says the format that added it. A case writes only the rows of its format.

### What a runner does

A runner knows every format up to the newest it was built for. It reads `case.toml`, and reads `case` before any other key, so that a case it is too old for is told from one that is not a case. It then holds the case to every rule above.

It lays out the bundles and sets up the host as `[host]` gives it, then takes the steps in order. After each input, it waits until the host app has **settled**: nothing it was asked is left unanswered, and no run is between two states. An input the host app has not settled after, or a look it has not answered, within 10 seconds fails the case. Then it compares what the step came to with its `expect`, if it writes one. A step that does not match fails the case. A case passes when every step matches.

A case comes to one of these outcomes:

| outcome | the case | the run |
|---|---|---|
| passed | every step matched | goes on |
| failed | a step did not match, came to nothing, or did not settle or answer within 10 seconds; the runner names the first such step by its place in the list, from 1, and what it came to | goes on |
| too old | is of a later format than the newest the runner knows | goes on |
| not laid out | holds a bundle the runner cannot lay out as written, or, format 5, names in `owners` an interface the implementation ships no owner of, and nothing of it runs | goes on |
| not a case | refuses as a case | the runner reports it and runs no case |

For each case a runner reports the case's name, its DECKIT and that DECKIT's status, and its outcome.

A runner reaches inside nothing. It sets up a host and reads what the system answers only through what the system gives any host, under *What the system gives a host*, and hands inputs as the host app receives them from outside. One that could see inside its implementation could pass by agreeing with the implementation rather than with the specification.

Asked for nothing, a runner runs the cases of the live set, as [the specification](../README.md) works the live set out. Asked for DECKITs or cases by name, it runs those, a draft's among them.

### How a case is written

A case is written by hand, in the manifest text, and is judged by its value. A case names one rule in its `note` and is written so that the rule it names is the one that refuses or answers: every other part of it is one the system takes.

**Note.** `case.toml` is written in the manifest text so that a bundle and the case around it are one text, read by one grammar.

**Note.** A `call` is how a case has a mod make a request, so that what a request answers is read by the runner as the system answers it, and not as a mod's code chose to report it.

## Interactions

- The manifest text, the versions, the fields and permissions a host adds, and the answer a `mod` look gives: [the bundle](../DECKIT-2/SPEC.md).
- The order of the bundles found: [the catalog](../DECKIT-4/SPEC.md).
- What the system answers of a run: [the lifecycle](../DECKIT-5/SPEC.md).
- The handle a `call` makes its request through, what a request answers and how it is refused: [the handle](../DECKIT-7/SPEC.md). What a connection hands a listener, and a call of a function it hands: [the interfaces](../DECKIT-10/SPEC.md) and [calls across a connection](../DECKIT-11/SPEC.md). The addresses a mod hands the host to open, and what `opened` answers of each: [opening outside the app](../DECKIT-8/SPEC.md).
- The standard interfaces whose owner a host ships: their DECKITs, such as [the addresses](../DECKIT-14/SPEC.md).
- The live set, and what an implementation conforms to: [the specification](../README.md).

## Alternatives considered

- A case as one file, with its bundles written inline as tables. A bundle is a folder, and a rule about one, such as a `main` naming no file in it, is about files beside the manifest. A bundle written inline would be a second spelling of a bundle, and the runner would write the folder anyway.
- Steps that name an actor (the host, a person, a mod). What an input comes to cannot depend on who sent it, so a step that named one would ask a question no rule may answer. Where the surface matters, a step names where the input arrives.
- Matching a refusal's message. No rule states a message, so a runner that matched one would hold implementations to something the specification does not say. A runner measures the stage and the kind.
- A runner that waits a fixed time after each input. What settles fast would be slow to test, and what settles slow would fail at random. Settling is a fact of the host app.
- A case's mod that makes its requests from its own code and reports what each answered. The runner would read what the mod's code reports, and every case would carry code that could itself be wrong.
- A case's mod that keeps what a connection hands it and answers it to a request. The runner would read what the mod's code chose to keep, as for a mod that reports what its requests answered; a listener the host gives is a function no case writes.
- A case that holds the owner of a standard interface among its bundles, a copy or a link. A case would hold one implementation's owner, and pass on that one alone; the owner a case's host ships is the implementation's own, named by the interface it owns.
- A path written in a case as a string. Where the runner lays a bundle out is its own, and a case that wrote one would pass on one runner only.

## Notes

**Note.** Some sentences above are held by no case, each for its reason. What refuses as a case, and every outcome but passed: a case in the specification measures the implementation and passes on a conforming one, and a case that refused as a case would stop the suite. A `call` or a look that comes to nothing fails its case, for the same reason. The 10-second bound: a case that passes settles inside it. That a runner reaches inside nothing, waits until the host app has settled, matches strictly, reads `case` before any other key and reads a null as a key not answered: each is a property of the runner, checked by reading the runner. That each run starts from nothing kept: no input or look of these formats reads the system's own folder. The order `mods` answers in, and with it the order of `ship`: [the catalog](../DECKIT-4/SPEC.md)'s cases hold it.

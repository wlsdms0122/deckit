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
    sites/             format 9: the case's sites, if any
      <site>/          the files a site serves, named by its folder
      <site>.toml      what a site answers besides
```

Each entry of `mods/`, a folder, a file or a link, is one of the case's bundles: an entry the runner lays out for the system to read, which [the bundle](../DECKIT-2/SPEC.md) takes, refuses or passes over. What else `mods/` holds, and what else the case's folder holds but, format 9, `sites/`, is not the case's. A case is named, and a bundle in `mods/` is named, by this grammar:

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

A case **refuses as a case** when it breaks any rule under *What a case is*, *The host*, *Sites*, *Steps*, *What a step must come to* and *Formats*, the grammars and bounds among them, or when its name is another case's in the specification. Among them: a key the tables do not give, a key under the wrong table, a value of another type than the table gives, a `name` that is not its folder's name, a bundle in `mods/` that no key of the case names, a name of a bundle that is not in `mods/`, a `bundle-name` written twice in `ship` and `sources` together, an entry of `sites/` that is no site's that `sites` names, and a name in `sites` of a site that is not in `sites/`.

### The host

`[host]` says what the host app is made of, which is everything the runner sets up before the first step:

| key | takes | required | what it says |
|---|---|---|---|
| `base` | `"system"`, or, format 6, `"shell"`, or, format 8, `"web"` | yes | what the host is before the case adds to it, below |
| `api` | string, a version as [the bundle](../DECKIT-2/SPEC.md) writes one | yes | the version of the mod contract the host runs mods with |
| `fields` | array of strings | no | the manifest fields the host adds, in order |
| `permissions` | array of tables `{ id, name, description, privileged }`, each a string but `privileged`, a boolean, which may be left out and is then handed absent | no | the permissions the host defines, in order |
| `ship` | array of `bundle-name` | no | the bundles the host ships, in the order it ships them |
| `system` | array of `bundle-name`, each one in `ship` | no | the bundles it ships that it marks system |
| `sources` | array of `bundle-name` | no | the bundles it reads in place |
| `owners` | array of strings, each the name of a standard interface, `deckit/` and a name, none written twice | no | format 5: the standard interfaces whose owner the host ships, in order |
| `sites` | array of `site-name`, none written twice | no | format 9: the sites the runner serves, under *Sites* |
| `delegate` | table, each key a `name`, below, bound to any value | no | format 10: the members of the host's delegate and what each answers, under *Steps* |

| base | the host |
|---|---|
| `system` | the system alone, with nothing shipped, which opens none of the addresses it is handed to open outside the app, and, format 7, which shows none of the notifications of the machine it is handed to show and answers of each that the machine took it, and which keeps a clipboard of its own, never the machine's: it holds no text as the case begins, and what is written to it stands as the host app quits and starts again |
| `web` | format 8: the system as the base `system` is, with [the web engine](../DECKIT-23/SPEC.md) stacked over it, and no shell; format 10: with the host's own layer stacked over the web engine, the layer over it, which it offers web pages, as [web pages](../DECKIT-25/SPEC.md) fix them |
| `shell` | format 6: the system as the base `system` is, with the web engine stacked over it and the shell attached over the web engine, which shows nothing on screen |

Format 9: on every base, the host app sends a request fetched through a session only to the loopback address, `127.0.0.1`: one to another address is not answered. Format 10: a case shows a page at an address of the web only as a `site-address` names one, so a page loads what the case's sites serve.

What the case writes under `[host]` adds to the base. Format 5: for each interface `owners` names, the host ships, before each bundle `ship` names, the bundle the implementation ships as the owner of that interface, marked system, as it ships it, with each framework the implementation's host app stacks for a permission that bundle asks for, and adds, before the fields the case writes, each field that bundle's manifest writes that neither [the bundle](../DECKIT-2/SPEC.md) nor the base reads. The case names that bundle by nothing else. An implementation that ships no owner of an interface `owners` names cannot lay the case out. Its fields and permissions come after the base's, as [the bundle](../DECKIT-2/SPEC.md) says, and a refusal of one is the answer to the `start` step.

Each run of a case starts from nothing kept: the system's own folder is new and empty, and every bundle is laid out afresh where the runner keeps its run, never in the case's folder. A bundle is laid out as written: each file and folder as the case holds it, and each link as a link holding the target it is written with, so that a link to a place inside the bundle points inside the bundle laid out. Each bundle is laid out under its `bundle-name`, and a bundle that is a link is laid out as that link, so that a target naming a bundle beside it names that bundle laid out. Those in `sources` lie side by side in one folder that holds nothing else, which the host hands the system as a folder of bundles read in place. Each one in `ship` is handed as itself, laid out under that name, a bundle the host ships, marked system where `system` names it. Each one that a step's `folders` names and no key of `[host]` names is laid out on its own, apart from those in `sources`, and the host hands the system nothing of it. A bundle's **path** is the absolute path of the folder, file or link it is laid out as.

### Sites

Format 9. A **site** is a server the runner keeps for the case's run, which the host app reaches through the web: each site `sites` names is served over HTTP on the loopback address, `127.0.0.1`, at a port of its own that the runner chooses as the run begins. A site is named by this grammar, and is in `sites/` as a folder `<site-name>/`, a file `<site-name>.toml`, or both, and nothing else of `sites/` is:

```
site-name = lower *( lower / DIGIT / "-" )
```

A site's **address** is `http://127.0.0.1:` and its port, and is written in a case as its `site-name`.

A site answers each request it gets. Its folder holds the files it serves: a request whose path, its segments percent-decoded, names a file under the folder is answered that file's bytes, as the case holds them. Its file, `<site-name>.toml`, written in the manifest text, holds a table for each request target it answers besides, its key the target as a request writes it, its path and query, and its keys these and no others:

| key | takes | required | what it says |
|---|---|---|---|
| `status` | integer, from 200 to 599 | no | the answer's status; left out, 200 where a file of the folder is at the path, and 404 where none is |
| `location` | string, a `site-path` | no | the header `location` the answer carries |
| `headers` | array of arrays `[name, value]`: `name` a `token` and none of `location`, `content-length`, `connection` and `transfer-encoding`, compared ignoring case; `value` a `field-value` | no | the headers the answer carries besides, in order |

```
site-path = "/" [ ( %x21-2E / %x30-7E ) *VCHAR ]   ; a path on the same site, no "//" first
```

`token` and `field-value` are the grammars [fetching through a session](../DECKIT-24/SPEC.md) gives, and a target the file holds a key for is a `site-path`.

A request whose target the file holds is answered as that table writes it, and every other as a table with no keys. The answer carries its status; then the header `location`, where it is written; each header of `headers`, in order; `content-length`, the number of bytes of the body, but for the statuses 204 and 304; and `connection`, `close`. Its body is the bytes of the file at the path, none where there is no file, and none for the method `HEAD` and the statuses 204 and 304. A request whose method is not one HTTP registers, written in upper case, is answered 400 with no body.

A site keeps each request it gets, with its method, its target, each header it carries and its body, for the look `requested`.

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
| a request through a mod's handle | while the mod's run is `running` | format 3: the run makes a request through the handle its code is handed, as the mod's code makes one, as [the handle](../DECKIT-7/SPEC.md) fixes it, and the host is answered what the request answers, or its refusal at its stage with its kind. Format 4: or through what a request the run made before answered, and handed a function the host gives, as the mod's code hands one of its own. Format 8: or through a handle a framework the host stacks hands a lifecycle of the run, as [the entry](../DECKIT-6/SPEC.md) fixes it |
| the addresses to open outside the app | while the host app is started | format 3: each address a mod hands the host to open, with whether the app that opens it comes to the front, as [opening outside the app](../DECKIT-8/SPEC.md) fixes them |
| the notifications of the machine | while the host app is started | format 7: each notification a mod hands the host to show on the machine, which the host answers whether the machine took, and a press on one, which the host hands the system, as [notifications of the machine](../DECKIT-21/SPEC.md) fix them |
| the clipboard | while the host app is started | format 7: the text the system reads of the clipboard and the text it replaces it with, as [the clipboard](../DECKIT-20/SPEC.md) fixes them |
| the web | while the host app is started | format 9: each request the system fetches through a session, which the host sends, and what it is answered, as [fetching through a session](../DECKIT-24/SPEC.md) fixes them |
| the web pages | while a mod's run is `running` | format 10: what the web engine offers the layer over it on the mod's page, which the host's layer is offered, as [web pages](../DECKIT-25/SPEC.md) fix it |
| the quit | as the host app quits | answered once the host app has quit |

### Steps

Each `[[step]]` is one **input** the host app receives or one **look** at what the system answers or keeps, and writes `input` or `look`, exactly one of them. A step never says who acts: an input arrives at the host app from wherever it comes, the host app is not told, and no rule may tell. A `call` names the mod whose run makes the request, since a request is a mod's and its permissions are that mod's, and says nothing of where the input came from. A look changes nothing.

Inputs:

| `input` | its keys | what the host app receives | what it is answered |
|---|---|---|---|
| `start` | none | the host app starts, on the host `[host]` gives | nothing, or a refusal at `call` of what the host hands as the host app starts |
| `quit` | none | the host app quits | nothing |
| `call` | `mod` and `member`, and `args`, `folders`, `sites`, `part`, `handle`, `of`, `listener` and `handed` if written | format 3: the run of the mod listed under the name `mod` makes a request through its handle: the member `member`, called with the path of each bundle `folders` names, in order, then, format 9, the address each `site-address` of `sites` names, in order, then each value of `args`, in order, and then, format 4, a listener where `listener` is `true`. Format 4: where `of` is written, `member` names a member of what the call at that place answered, as the run holds it, and not of the handle, or, format 10, of the page handle of the page the `show` at that place showed. Format 5: where `handed` is `true`, `member` names a member of the first value the listener was last called with, as the run holds it, and not of the handle. Format 8: where `handle` is written, `member` names a member of the handle it names, below, and not of `deckit`. A member that holds a value is read, and is written with no `args`, no `folders` and no `listener` | what the request answers, or the value under the key `part` of it, or its refusal at its stage with its kind, as [the handle](../DECKIT-7/SPEC.md) fixes them |
| `press` | `notification` | format 7: the notification of the machine at the place `notification` in what `shown` answers is pressed, as [notifications of the machine](../DECKIT-21/SPEC.md) fix a press | nothing |
| `show` | `mod` and `session`, and `site`, `url` and `apart` if written | format 10: the host's layer shows a page on the page of the run of the mod listed under `mod`, in the session the handle `web` of the lifecycle a `call` reads answers for the name `session`, as [web pages](../DECKIT-25/SPEC.md) fix `page`, or `window` where `apart` is `true`, at the address `site` names, or at `url`, or at the empty string where neither is written, and gives the page the host's delegate | nothing, or the refusal of what it did at its stage with its kind |

Looks:

| `look` | its keys | what it answers |
|---|---|---|
| `mod` | `mod`, and `part` if written | the bundle the system found under the name `mod`, as [the bundle](../DECKIT-2/SPEC.md) answers one, or the value under the key `part` of it. A bundle it did not take refuses at `read` |
| `mods` | none | the name each bundle the system found is listed under, taken or not, in [the catalog's](../DECKIT-4/SPEC.md) order |
| `run` | `mod` | format 2: what the system answers of the run of the mod listed under the name `mod`, as [the lifecycle](../DECKIT-5/SPEC.md) fixes it: a string, or a refusal at `launch`. A bundle it did not take refuses at `read` |
| `opened` | none | format 3: an array of each address the system handed the host to open outside the app since the host app last started, in the order handed, each a table `{ url, activates }`, `url` a string and `activates` a boolean, as [opening outside the app](../DECKIT-8/SPEC.md) fixes them |
| `heard` | `mod` | format 4: an array, for each call of a listener a `call` handed a request of the run of the mod listed under the name `mod` that is `running`, in the order called, of the values it was called with, in order |
| `shown` | none | format 7: an array of each notification of the machine the system handed the host to show since the host app last started, in the order handed, each a table `{ title, body, silent }`, `title` and `body` strings and `silent` a boolean, as [notifications of the machine](../DECKIT-21/SPEC.md) fix them |
| `delegated` | `mod`, and `part` if written | format 10: an array, for each call of a member of the host's delegate of a page the host's layer shows for the run of the mod listed under `mod` that is `running`, in the order called, of a table `{ method, args }`: the member's name, and an array of the values it was called with, in order |
| `requested` | `headers` if written | format 9: an array of each request the case's sites got since the host app last started, in the order got, each a table `{ site, method, path, headers, body }`: `site` the `site-name` of the site that got it, `method` and `path` its method and its target, its path and query, as the request writes them, `headers` an array of `[name, value]` of each header it carries whose name, in lower case, `headers` holds, the name in lower case, in the order of `headers` and then in the order carried, and `body` its bytes in base64, as [fetching through a session](../DECKIT-24/SPEC.md) writes bytes, left out where it carries none |

Their keys take:

| key | takes |
|---|---|
| `mod` | string: a name a bundle is listed under |
| `part` | string: a key of the answer the step reads |
| `member` | string, a `member`, below: format 3 |
| `handle` | string, a handle's name, below; never beside `of` or `handed`: format 8 |
| `args` | array of values: format 3 |
| `folders` | array of `bundle-name`: format 3 |
| `sites` | array of `site-address`, below, each of a site `[host] sites` names: format 9 |
| `headers` | array of strings, each a `token` in lower case, none written twice: format 9 |
| `of` | integer: the place, from 1, of an earlier `call` of the same `mod`, or, format 10, of an earlier `show` of it: format 4 |
| `session` | string: format 10 |
| `site` | string, a `site-address` of a site `[host] sites` names: format 10 |
| `url` | string, never one whose scheme is `http` or `https`, compared ignoring case, and never beside `site`: format 10 |
| `apart` | boolean: format 10 |
| `listener` | boolean: format 4 |
| `handed` | boolean: written `true`, and never beside `of`: format 5 |
| `notification` | integer: the place, from 1, of a notification in what `shown` answers: format 7 |

```
member = name *( "." name )
name   = ALPHA *( ALPHA / DIGIT )
```

A `member` names a member of the handle: each `name` a member of the one before it, the first a member of the handle itself.

```
site-address = site-name [ site-path ]
```

A `site-address` names the site's address followed by its `site-path`, or by `/` where it writes none.

A `call` that writes neither `of` nor `handed` reads `member` from a handle of one lifecycle of the run, the same lifecycle for every `call` of that run, the handle `handle` names:

| `handle` | the handle |
|---|---|
| `"deckit"` | the handle `deckit`, as [the handle](../DECKIT-7/SPEC.md) fixes it; the handle of a `call` that writes no `handle` |
| `"web"` | format 8: the handle `web`, which the lifecycle is handed in `frameworks`, as [the web engine](../DECKIT-23/SPEC.md) fixes it |

The **host's delegate**, format 10, is the delegate the host gives each page its layer shows, as [web pages](../DECKIT-25/SPEC.md) fix a delegate: it holds each member `[host] delegate` names and no other, each a function that answers the value the table binds it to and is kept, with the values it is called with, for the look `delegated`. A page `openWindow` is handed and answers `true` for is given the host's delegate.

A step that writes `part` answers the value under that key of what it reads: of the answer, where the answer is a table, and, format 3, of each element of the answer that holds the key, in order, where the answer is an array of tables.

A **listener**, format 4, is a function the host gives, one for each run, handed to every `call` of that run that writes `listener`: each call of it is kept, with the values it is called with, and it answers nothing. What a step answers, and each value a listener is called with, is read as a value: a function is no value, so a key of a table bound to one is a key not answered, a request that answers one answers nothing, and an answer that holds one anywhere else comes to nothing, as does such a value a listener is called with; a refusal, as [the handle](../DECKIT-7/SPEC.md) fixes one, is read as the table `{ stage, kind }`.

Format 9: a string a step answers, anywhere in what it answers, that starts with a site's address followed by `/` or by nothing more, is read with that address written as the site's `site-name`, as a `site-address` writes it.

A look at a name no bundle is listed under, and a step whose `part` a table answer does not hold, or whose answer with a `part` is no table and no array of tables, come to nothing, which no `[step.expect]` matches. A key's absence from an answer is read by a look at the whole bundle. A `call` comes to nothing where no run of the mod listed under `mod` is `running` as the step is taken, where `member` names no member of the handle or of what the call at `of` answered, or, format 4, where the run that answered the call at `of` is not the one `running`, or, format 5, where `handed` is written and the run's listener has not been called, or, format 8, where the lifecycle is handed no handle of the name `handle` writes. A `show` comes to nothing where no run of the mod is `running`, or where the host's layer is offered no web pages, as on every base but `web`. A `delegated` look at a mod with no run `running` comes to nothing. A `heard` look at a mod with no run `running` comes to nothing. A `press` comes to nothing where `shown` answers no notification at the place `notification`.

`start` is the first step. A case starts the host app again only after a `quit`, and calls, presses and looks only while the host app is started: after a `start` and before the next `quit`. A case whose `start` is refused writes no step after it.

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

A case format is the keys, values, bases, inputs and looks a case may write. The rows of this DECKIT's tables are format **1**, but those that say a later format. Format **2** adds the rows that say so, for [the lifecycle](../DECKIT-5/SPEC.md). Format **3** adds the rows that say so, for the requests a mod makes through its handle. Format **4** adds the rows that say so, for what a mod is handed by a connection and calls across it. Format **5** adds the rows that say so, for the standard interfaces: the owner a host ships, and a call of what a connection handed a listener. Format **6** adds the rows that say so, for [the key bindings](../DECKIT-16/SPEC.md): the base `shell`, whose handle the owner of `deckit/keys` takes chords through. Format **7** adds the rows that say so, for what of the machine the base stands for: the notifications of the machine, shown and pressed, and the clipboard. Format **8** adds the rows that say so, for [the web engine](../DECKIT-23/SPEC.md): the base `web`, and the handle a `call` reads its member from. Format **9** adds the rows that say so, for [fetching through a session](../DECKIT-24/SPEC.md): the sites a case serves, the key of a `call` that hands their addresses, and the look `requested`. Format **10** adds the rows that say so, for [web pages](../DECKIT-25/SPEC.md): the host's layer over the web engine on the base `web`, the input `show`, the host's delegate and the look `delegated`. A DECKIT that needs a base, an input, a look or a key that the format does not have adds it to this format as a supplement to this DECKIT, and gives the format the next number. That format holds every row of the one before it and the rows the DECKIT adds, and each row it adds says the format that added it. A case writes only the rows of its format.

### What a runner does

A runner knows every format up to the newest it was built for. It reads `case.toml`, and reads `case` before any other key, so that a case it is too old for is told from one that is not a case. It then holds the case to every rule above.

It lays out the bundles and sets up the host as `[host]` gives it, then takes the steps in order. After each input, it waits until the host app has **settled**: nothing it was asked is left unanswered, and no run is between two states; and, format 10, no page the host's layer shows is loading what it was asked to load. An input the host app has not settled after, or a look it has not answered, within 10 seconds fails the case. Then it compares what the step came to with its `expect`, if it writes one. A step that does not match fails the case. A case passes when every step matches.

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
- The handle a `call` makes its request through, what a request answers and how it is refused: [the handle](../DECKIT-7/SPEC.md). What a connection hands a listener, and a call of a function it hands: [the interfaces](../DECKIT-10/SPEC.md) and [calls across a connection](../DECKIT-11/SPEC.md). The addresses a mod hands the host to open, and what `opened` answers of each: [opening outside the app](../DECKIT-8/SPEC.md). The notifications a mod hands the host to show, what `shown` answers of each, and a press: [notifications of the machine](../DECKIT-21/SPEC.md). The clipboard a mod reads and replaces: [the clipboard](../DECKIT-20/SPEC.md).
- The standard interfaces whose owner a host ships: their DECKITs, such as [the addresses](../DECKIT-14/SPEC.md).
- The web engine the bases `web` and `shell` stack, and the handle `web` it hands every lifecycle: [the web engine](../DECKIT-23/SPEC.md).
- The requests fetched through a session, which the sites a case serves answer, and the grammars of a header and of base64: [fetching through a session](../DECKIT-24/SPEC.md).
- The shell the base `shell` attaches, and the handle `shell` it hands a mod: the shell's DECKITs.
- What a host hands the system before the start, and what the system asks of a host after it: [the embedding](../DECKIT-22/SPEC.md).
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
- Sites on the web as it is. A case would pass only while the site answered as it did the day it was written, and a run would reach out of the machine; a site the case holds, served on the loopback address, answers the same in every run. Its port is chosen as the run begins, so a case writes a site's name where its address goes, both ways.
- A look `requested` that answers every header a request carries. A request carries headers the session writes itself, such as the user agent, which differ from one implementation to another, and its host names the port of the run; a look answers the headers it names.
- A site that redirects to any address. A redirect it answered off the loopback address would reach out of the machine; a `location` of the site's is a path on it.

## Notes

**Note.** Some sentences above are held by no case, each for its reason. What refuses as a case, and every outcome but passed: a case in the specification measures the implementation and passes on a conforming one, and a case that refused as a case would stop the suite. A `call` or a look that comes to nothing fails its case, for the same reason. The 10-second bound: a case that passes settles inside it. That a runner reaches inside nothing, waits until the host app has settled, matches strictly, reads `case` before any other key and reads a null as a key not answered: each is a property of the runner, checked by reading the runner. That each run starts from nothing kept: no input or look of these formats reads the system's own folder. The order `mods` answers in, and with it the order of `ship`: [the catalog](../DECKIT-4/SPEC.md)'s cases hold it. That the host app sends a request only to the loopback address: a property of the host, checked by reading it, since a case that fetched another address would read the host and not the system. What a site answers, and what `requested` answers of a request: the cases of [fetching through a session](../DECKIT-24/SPEC.md) read them, but a method HTTP does not register, which none sends.

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

A case **refuses as a case** when it breaks any rule under *What a case is*, *The host*, *Sites*, *Parties*, *Steps*, *What a step must come to* and *Formats*, the grammars and bounds among them, or when its name is another case's in the specification. Among them: a key the tables do not give, a key under the wrong table, a value of another type than the table gives, a `name` that is not its folder's name, a bundle in `mods/` that no key of the case names, a name of a bundle that is not in `mods/`, a `bundle-name` written twice in `ship` and `sources` together, an entry of `sites/` that is no site's that `sites` names, or, format 24, that is of a site `refusing` names, and a name in `sites` of a site that is not in `sites/`, but, format 24, one `refusing` names. Format 25: a `party` an `attach` writes that an earlier `attach` of the case wrote, and a `party` any other step writes that no earlier `attach` wrote. Format 26: a `party` an `admitted` writes whose `attach` did not write `waits` `true`.

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
| `mods` | array of strings, each an `id` as [the bundle](../DECKIT-2/SPEC.md) writes one, none written twice | no | format 27: the ids of the mods the implementation ships that the host ships, in order |
| `sites` | array of `site-name`, none written twice | no | format 9: the sites the runner serves, under *Sites* |
| `refusing` | array of `site-name`, each one in `sites`, none written twice | no | format 24: the sites that refuse every connection, under *Sites* |
| `delegate` | table, each key a `name`, below, bound to any value | no | format 10: the members of the host's delegate and what each answers, under *Steps* |
| `apps` | table, each key a `scheme` as [what a site is let have](../DECKIT-26/SPEC.md) writes one, bound to a string that is not empty | no | format 12: the apps the machine has, each the name of the app that opens addresses of its scheme |
| `chosen` | array of `bundle-name` | no | format 16: the folders the person chooses in each dialog of folders, in order, under the base `shell` |
| `dock` | array of strings | no | format 19: the ids of the mods the host keeps in the Dock at the first start, in order, under the base `shell` |
| `unavailable` | array of keystrokes, each a `keystroke`, below | no | format 20: the chords the machine does not give the host app outside it, under the base `shell` |
| `appearance` | string, `"light"` or `"dark"` | no | format 21: the host app's look as it starts, under the base `shell`, `"dark"` where it is not written |
| `bar` | integer, 0 or more | no | format 23: the height of the bar across the top of the host app's window, under the base `shell`, 0 where it is not written |
| `users` | array of tables `{ id, name }`, each a string | no | format 25: the users the host makes before the host app first starts, in order, each a user of the id `id` that a person reads as `name`, as [users and seats](../DECKIT-38/SPEC.md) fix a user |
| `keys` | array of tables `{ principal, key }`, `principal` a string and `key` a `key-name`, under *Parties* | no | format 25: the keys the host registers before the host app first starts, in order, each the public key of the key pair `key` names, authorized for the principal `principal` |
| `seats` | table `{ idleTime, asking }`, `idleTime` an integer and `asking` a boolean, either or both left out | no | format 26: the settings of the seats the host sets before the host app first starts, as [users and seats](../DECKIT-38/SPEC.md) fix the settings: a setting it does not write stands as where none is kept |

| base | the host |
|---|---|
| `system` | the system alone, with nothing shipped, which opens none of the addresses it is handed to open outside the app, and, format 7, which shows none of the notifications of the machine it is handed to show and answers of each that the machine took it, and which keeps a clipboard of its own, never the machine's: it holds no text as the case begins, and what is written to it stands as the host app quits and starts again; and, format 12, which has an app for the addresses of a scheme only where `apps` names one, of the name `apps` gives it; and, format 25, which listens, as a host app that is started does, on the local socket in the system's own folder, as [a party from outside](../DECKIT-37/SPEC.md) fixes the transport |
| `web` | format 8: the system as the base `system` is, with [the web engine](../DECKIT-23/SPEC.md) stacked over it, and no shell; format 10: with the host's own layer stacked over the web engine, the layer over it, which it offers web pages, as [web pages](../DECKIT-25/SPEC.md) fix them; format 11: which shows a mod's page, once its layer shows a web page on it, in a window of the host app's, on screen and without the keyboard, so that a press reaches each web page laid in it, as it reaches one shown apart; format 14: which hands the web engine, as the host's downloads folder, a folder of its own, new and empty as each run begins, where the runner keeps its run |
| `shell` | format 6: the system as the base `system` is, with the web engine stacked over it and the shell attached over the web engine, which shows nothing on screen; format 15: with the host's own layer stacked over the shell, whose lifecycle the shell hands the handle `shell`, as [the shell](../DECKIT-29/SPEC.md) fixes it; format 16: which shows no dialog of folders on screen, the person choosing in each the path of each bundle `chosen` names, in order, the first of them alone where the dialog takes one folder, and none where `chosen` names none, as one who cancels; and which shows no path where it lies, keeping each one it is handed, as [files outside the app](../DECKIT-30/SPEC.md) fixes them; format 17: which shows the desktop as the host app starts, the whole of a stand-in for a screen 1280 wide and 800 high, from `x` 0 and `y` 0, that lays nothing on the person's screen; which floats each overlay window the shell asks it to show, on that screen, in front of the others it floats, at the frame kept for it where that frame lies whole on the screen, and otherwise centred across it with its top a fifth of the way down, rounded to whole numbers, taking the keyboard as it shows it unless asked not to, and giving it up as the desktop comes up or the person's hand reaches a window on the desktop; which shows a web page apart on the desktop, in the window the shell shows it in; and on which a double click on a title bar is set to zoom the window, as [windows](../DECKIT-31/SPEC.md) fixes them; format 18: which stands for the machine's keyboard, the host app in front from its start: a key goes to the page the shell last gave the keyboard to, and the host gives the keyboard back to the desktop as the desktop comes up and as the person's hand reaches a window on it, as [activation](../DECKIT-32/SPEC.md) fixes it; format 19: which hands the shell the ids `dock` names, as the mods it keeps in the Dock at the first start, and none where `dock` is not written, as [the Dock](../DECKIT-33/SPEC.md) fixes them; format 20: which stands for the chords the machine gives the host app outside it, holding each with no machine: it gives the shell each chord the shell asks for, but one `unavailable` names and one it gave already, and a key pressed in another app reaches the chord given of its keystroke alone, as [the shell's keys](../DECKIT-34/SPEC.md) fixes them; format 21: which hands the shell, as the host app's look, the one `appearance` names as the host app starts, and the one an input `appearance` turns it to, as [the look](../DECKIT-35/SPEC.md) fixes it; format 22: which draws the desktop and each overlay window on no screen, each page the shell lays in them and each material it draws among them drawn as on a screen, a material blurring what lies under it, and hands the shell each drop of files from outside the app, as [regions and drops](../DECKIT-36/SPEC.md) fixes them; format 23: which lays a bar `bar` high across the top of its window, from `y` 0, the desktop under it, as [windows](../DECKIT-31/SPEC.md) fixes it; format 30: which hands the shell each scroll of the person's on its window as the machine's pointer's, in the page laid at that point, which has it already |

Format 18: on every base, the host app's name is `Deckit conformance`.

Format 9: on every base, the host app sends a request fetched through a session only to the loopback address, `127.0.0.1`: one to another address is not answered. Format 10: a case shows a page at an address of the web only as a `site-address` names one, so a page loads what the case's sites serve.

What the case writes under `[host]` adds to the base. Format 5: for each interface `owners` names, the host ships, before each bundle `ship` names, the bundle the implementation ships as the owner of that interface, marked system, as it ships it, with each framework the implementation's host app stacks for a permission that bundle asks for, and adds, before the fields the case writes, each field that bundle's manifest writes that neither [the bundle](../DECKIT-2/SPEC.md) nor the base reads. The case names that bundle by nothing else. An implementation that ships no owner of an interface `owners` names cannot lay the case out. Its fields and permissions come after the base's, as [the bundle](../DECKIT-2/SPEC.md) says, and a refusal of one is the answer to the `start` step. Format 27: for each id `mods` names, the host ships, after the owners `owners` names and before each bundle `ship` names, the bundle the implementation ships as the mod of that id, marked system, as it ships it, with its frameworks and its fields as format 5 hands an owner's. An implementation that ships no mod of an id `mods` names cannot lay the case out. The ids are the implementation's, not this specification's: a case that names one holds only against an implementation that ships a mod of it, and the DECKIT whose cases name it says which mod it is. A mod that is both the owner of an interface `owners` names and of an id `mods` names is shipped once, where `owners` ships it: an interface and an id are two names, neither written twice, and which mod owns an interface is the implementation's, which the case cannot know. Format 25: before the host app first starts, and at no later start, the host makes each user `users` names, as [users and seats](../DECKIT-38/SPEC.md) fix a user, and then registers each key `keys` names, in order, as [a party from outside](../DECKIT-37/SPEC.md) fixes the authorized keys. The first of them that is refused is the answer to the first `start` step, at `call` with its kind, and the host app does not start. Format 26: after them, before that first start and at no later one, the host sets the settings `seats` writes, as [users and seats](../DECKIT-38/SPEC.md) fix what a host asks, and a refusal of them is the answer to the first `start` step in the same way.

Each run of a case starts from nothing kept: the system's own folder is new and empty, and every bundle is laid out afresh where the runner keeps its run, never in the case's folder. A bundle is laid out as written: each file and folder as the case holds it, and each link as a link holding the target it is written with, so that a link to a place inside the bundle points inside the bundle laid out. Each bundle is laid out under its `bundle-name`, and a bundle that is a link is laid out as that link, so that a target naming a bundle beside it names that bundle laid out. Those in `sources` lie side by side in one folder that holds nothing else, which the host hands the system as a folder of bundles read in place. Each one in `ship` is handed as itself, laid out under that name, a bundle the host ships, marked system where `system` names it. Each one that a step's `folders` names, or, format 11, its `file`, or, format 16, `chosen`, and no other key of `[host]` names is laid out on its own, apart from those in `sources`, and the host hands the system nothing of it. A bundle's **path** is the absolute path of the folder, file or link it is laid out as.

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

Format 24. A site `refusing` names is in `sites/` as nothing, neither a folder nor a file. It has an address of its own as any site has, at a port the runner chooses as the run begins, and nothing listens at that port: each connection to it is refused, as a host refuses one at a port where nothing is served, and it gets no request.

### Parties

Format 25. A **party** of a case is the runner itself on a transport connection of its own to the socket the host app listens on, sending and answering the messages [a party from outside](../DECKIT-37/SPEC.md) fixes. An `attach` makes a party and names it, whatever it is answered, and every other step that writes `party` is of the transport connection of the party an earlier `attach` named so. A party and a key pair are named by these grammars:

```
party-name = lower *( lower / DIGIT / "-" )
key-name   = lower *( lower / DIGIT / "-" )
```

A **key pair** of a case is a private key and its public key under the scheme `ed25519`, which the runner makes as the run begins: one for each `key-name` the case writes, in `[host] keys` or in an `attach`, the same pair wherever that name is written. The runner keeps the private key, and a party signs with it. The host is handed the public key of each pair `[host] keys` names, which it registers under the pair's `key-name` as the key's name, and of no other: a pair `[host] keys` does not name is one the host did not register.

A party keeps each message the host sends it that answers no request the party asked, in the order sent, for the look `told`, and answers each request among them with a null, at once. A request of a party that is answered a null answers nothing.

Format 26. A party whose `attach` wrote `waits` `true` **waits**: its step ends with `authenticate` not yet answered where the host asks whether its user may sit, and the case goes on while it waits, to the step that has the ask answered, or to the party's `detach`. A party that waits hosts no run until `authenticate` answers its result, and the look `admitted` waits for that answer as any look waits for its own.

### What the system gives a host

A runner sets up a host, and reads what the system answers, through what the system gives any host:

| what | when | what it is |
|---|---|---|
| the fields and permissions the host adds | before the start | as [the bundle](../DECKIT-2/SPEC.md) fixes them |
| the bundles the host ships | before the start | each one's folder, marked system or not |
| a folder of bundles read in place | before the start | one folder |
| the system's own folder | before the start | one folder, the system's alone |
| the users and the authorized keys | before the start | format 25: each user the host makes, as [users and seats](../DECKIT-38/SPEC.md) fix what a host asks, and each key it registers for a principal, as [a party from outside](../DECKIT-37/SPEC.md) fixes the authorized keys, each taken or refused at `call` with its kind |
| the seats' settings | before the start | format 26: the settings the host sets, as [users and seats](../DECKIT-38/SPEC.md) fix what a host asks, taken or refused at `call` with its kind |
| the downloads folder | before the start | format 14: one folder, which the host hands the web engine, where it writes the downloads a mod's web pages start, as [downloads](../DECKIT-28/SPEC.md) fixes them |
| the mod contract | before the start | the version the host runs mods with |
| the start | as the host app starts | answered once the host app has settled, or refused at `call` with its kind |
| the bundles found | once the host app has started | the name each one is listed under, in [the catalog's](../DECKIT-4/SPEC.md) order, and each one by that name, answered or refused as [the bundle](../DECKIT-2/SPEC.md) says |
| the runs | once the host app has started | format 2: for each name a bundle is listed under, what the system answers of its mod's run, as [the lifecycle](../DECKIT-5/SPEC.md) fixes it; format 25: and, for the principal a party proved, what it answers of the run the party's transport connection hosts, as [a party from outside](../DECKIT-37/SPEC.md) fixes that run |
| a request through a mod's handle | while the mod's run is `running` | format 3: the run makes a request through the handle its code is handed, as the mod's code makes one, as [the handle](../DECKIT-7/SPEC.md) fixes it, and the host is answered what the request answers, or its refusal at its stage with its kind. Format 4: or through what a request the run made before answered, and handed a function the host gives, as the mod's code hands one of its own. Format 8: or through a handle a framework the host stacks hands a lifecycle of the run, as [the entry](../DECKIT-6/SPEC.md) fixes it. Format 15: or through the handle `shell` the shell hands the lifecycle of the host's layer over it, as [the shell](../DECKIT-29/SPEC.md) fixes it |
| the addresses to open outside the app | while the host app is started | format 3: each address a mod hands the host to open, with whether the app that opens it comes to the front, as [opening outside the app](../DECKIT-8/SPEC.md) fixes them |
| the notifications of the machine | while the host app is started | format 7: each notification a mod hands the host to show on the machine, which the host answers whether the machine took, and a press on one, which the host hands the system, as [notifications of the machine](../DECKIT-21/SPEC.md) fix them |
| the clipboard | while the host app is started | format 7: the text the system reads of the clipboard and the text it replaces it with, as [the clipboard](../DECKIT-20/SPEC.md) fixes them |
| the dialogs of folders | while the host app is started | format 16: each dialog of folders the shell asks the host to show, with whether it takes several folders, which the host answers with the path of each folder the person chose, as [files outside the app](../DECKIT-30/SPEC.md) fixes them |
| the paths shown where they lie | while the host app is started | format 16: each path the shell hands the host to show the person where it lies, as [files outside the app](../DECKIT-30/SPEC.md) fixes them |
| the windows | while the host app is started | format 17: the desktop the shell shows in the host app's window, and the normal windows on it as the shell holds them, each with its mod, its name, its frame and whether it is key or minimized; format 23: the panel windows the shell places in the bar, each with its mod, its name and its frame; format 17: each overlay window the shell asks the host to float, with its size and the frame kept for it, which the host tells the shell takes the keyboard, gives it up and is moved; and the person's hand on a window, which the host hands the shell, as [windows](../DECKIT-31/SPEC.md) fixes them |
| the keyboard | while the host app is started | format 18: each key the person presses, which the host hands the page that has the keyboard; and the mod the shell holds active, the mods that ask for attention and the title the shell gives the desktop, as [activation](../DECKIT-32/SPEC.md) fixes them; format 20: each chord the shell asks the host to have the machine give it outside the app, which the host answers whether it was given, and a key the person presses in another app, which the host hands the shell where it gave its chord, as [the shell's keys](../DECKIT-34/SPEC.md) fixes them |
| the Dock | while the host app is started | format 19: the Dock the shell draws on the desktop, its items and their marks, and the person's hand on it, which the host hands the shell: a click on an item, a choice of its menu and a drag of a kept item, as [the Dock](../DECKIT-33/SPEC.md) fixes them |
| the look | while the host app is started | format 21: the host app's look, light or dark, which the host hands the shell, and what each page the shell draws in wears, as [the look](../DECKIT-35/SPEC.md) fixes them |
| the drops and the regions | while the host app is started | format 22: each drop of files from outside the app on a point of a window, which the host hands the page laid there, and the children's views the shell lays over the regions of the windows, as [regions and drops](../DECKIT-36/SPEC.md) fixes them |
| the apps | while the host app is started | format 12: the name of the app the machine has for the addresses of a scheme, which the system asks of the host, as [what a site is let have](../DECKIT-26/SPEC.md) asks it |
| the socket | while the host app is started | format 25: the local socket the host app listens on in the system's own folder, which a party opens a transport connection to, as [a party from outside](../DECKIT-37/SPEC.md) fixes the transport |
| the web | while the host app is started | format 9: each request the system fetches through a session, which the host sends, and what it is answered, as [fetching through a session](../DECKIT-24/SPEC.md) fixes them |
| the web pages | while a mod's run is `running` | format 10: what the web engine offers the layer over it on the mod's page, which the host's layer is offered, as [web pages](../DECKIT-25/SPEC.md) fix it |
| the quit | as the host app quits | answered once the host app has quit |

### Steps

Each `[[step]]` is one **input** the host app receives or one **look** at what the system answers or keeps, and writes `input` or `look`, exactly one of them. A step never says who acts: an input arrives at the host app from wherever it comes, the host app is not told, and no rule may tell. A `call` names the mod whose run makes the request, since a request is a mod's and its permissions are that mod's, and says nothing of where the input came from. Format 25: an `attach` names the principal its party claims, since a proof is of a principal, and a step that writes `party` names the transport connection it is of; neither says who is behind the party. A look changes nothing.

Inputs:

| `input` | its keys | what the host app receives | what it is answered |
|---|---|---|---|
| `start` | none | the host app starts, on the host `[host]` gives | nothing, or a refusal at `call` of what the host hands as the host app starts |
| `quit` | none | the host app quits | nothing |
| `call` | `mod` and `member`, and `args`, `folders`, `sites`, `origins`, `part`, `handle`, `of`, `listener`, `handed`, `delegated` and `answered` if written | format 3: the run of the mod listed under the name `mod` makes a request through its handle: the member `member`, called with the path of each bundle `folders` names, in order, then, format 9, the address each `site-address` of `sites` names, in order, then, format 14, what the call at the place `answered` answered, as the system answered it and before a step reads it, or each element of it, in order, where it is an array, then each value of `args`, in order, and then, format 4, a listener where `listener` is `true`. Format 12: where `origins` is written, each string of `args`, at any depth, that is a `site-name` it holds is handed as that site's address, its origin. Format 4: where `of` is written, `member` names a member of what the call at that place answered, as the run holds it, and not of the handle, or, format 10, of the page handle of the page the `show` at that place showed. Format 5: where `handed` is `true`, `member` names a member of the first value the listener was last called with, as the run holds it, and not of the handle. Format 13: where `delegated` is written, `member` names a member of the first value the call of the host's delegate at that place in what the look `delegated` answers was called with, as the host's layer holds it, and not of the handle. Format 8: where `handle` is written, `member` names a member of the handle it names, below, and not of `deckit`. A member that holds a value is read, and is written with no `args`, no `folders` and no `listener` | what the request answers, or the value under the key `part` of it, or its refusal at its stage with its kind, as [the handle](../DECKIT-7/SPEC.md) fixes them |
| `press` | `notification` | format 7: the notification of the machine at the place `notification` in what `shown` answers is pressed, as [notifications of the machine](../DECKIT-21/SPEC.md) fix a press | nothing |
| `show` | `mod` and `session`, and `site`, `url`, `file` and `apart` if written | format 10: the host's layer shows a page on the page of the run of the mod listed under `mod`, in the session the handle `web` of the lifecycle a `call` reads answers for the name `session`, as [web pages](../DECKIT-25/SPEC.md) fix `page`, or `window` where `apart` is `true`, at the address `site` names, or at `url`, or, format 11, at the file address of the file `file` names, or at the empty string where none is written, and gives the page the host's delegate | nothing, or the refusal of what it did at its stage with its kind |
| `window` | `mod` and `action`, and `name`, `edge` and `by` if written | format 17: the person's hand on the window on screen of the run of the mod listed under `mod` named `name`, or on its window with no name, a web page's, where `name` is not written: by `action`, `press` a press in it, `close`, `minimize` or `zoom` a click of that button of its title bar, `move` a drag of its title bar by `by`, let go, `resize` a drag of its edge or corner `edge` by `by`, let go, and `doubleClick` a double click on its title bar, as [windows](../DECKIT-31/SPEC.md) fixes them; on an overlay window, a `press` or a `move` alone; format 23: on a panel window, a `press` alone; format 26: on a normal or a panel window, each is a press down of the local seat, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes one, in the window's content for a `press` and on what the shell draws of it for the others. A hand on no window on screen, or of an `action` an overlay window does not take, comes to nothing | nothing |
| `key` | `keystroke`, and `outside` if written | format 18: the person presses the key `keystroke` in the page that has the keyboard, which reaches what [activation](../DECKIT-32/SPEC.md) fixes; a key where no page has the keyboard comes to nothing. Format 20: where `outside` is `true`, the person presses it in another app in front, which reaches no page of the host app, and only a chord the machine gave the host app, as [the shell's keys](../DECKIT-34/SPEC.md) fixes it | nothing |
| `dock` | `mod` and `action`, and `to` if written | format 19: the person's hand on the Dock's item of the mod listed under `mod`: by `action`, `click` a click on it, `quit`, `keep` or `remove` the choice of its menu that quits the mod, keeps it in the Dock or takes it out, and `drag` a drag of it onto the place of the item of the mod listed under `to`, as [the Dock](../DECKIT-33/SPEC.md) fixes them. A hand on no item, a choice the menu does not offer, or a drag that is not of a kept item onto another kept item comes to nothing | nothing |
| `appearance` | `appearance` | format 21: the host app's look turns to `appearance`, which the host hands the shell, as [the look](../DECKIT-35/SPEC.md) fixes it | nothing |
| `drop` | `mod`, `name`, `folders` and `at` | format 22: the person drops the files from outside the app at the path of each bundle `folders` names, in order, at `at` from the top left of the normal window on screen of the run of the mod listed under `mod` named `name`, on the page the shell laid there that takes the pointer, as [regions and drops](../DECKIT-36/SPEC.md) fixes a drop. A drop on no such window, or where no page takes the pointer, comes to nothing | nothing |
| `desktop` | `at` and `by` | format 30: the person's hand on the host app's window: a scroll of the machine's pointer at `at` from its top left, by `by`, `x` across and `y` down, as [windows](../DECKIT-31/SPEC.md) writes a scroll by `dx`, `dy`, on what lies at that point: a window's content, the bar, the Dock, a view, or the desktop where none of them lies, as [windows](../DECKIT-31/SPEC.md) fixes the person's hand and a scroll on the desktop. A scroll at no point of the host app's window comes to nothing | nothing |
| `activate` | `mod` and `of` | format 11: the web page the `show` at the place `of` showed, for the run of the mod listed under `mod`, is pressed with the mouse's button, pressed down and let go inside it, as a person's press comes to the host app; a site a case presses lays what it presses over its whole page | nothing |
| `attach` | `party`, `principal` and `key`, and `part` or `waits` if written | format 25: a party opens a transport connection to the host app's socket and asks `initialize` and then `authenticate`, as [a party from outside](../DECKIT-37/SPEC.md) fixes the handshake: with a nonce of 32 bytes it chooses at random, claiming the principal `principal` under the scheme `ed25519`, with the public key of the key pair `key` names and the signature of what is signed by that pair's private key; and is the party `party` from then on; format 26: where `waits` is `true`, the step ends once the party is told `attach/asking` or `authenticate` is answered, whichever is first, as [users and seats](../DECKIT-38/SPEC.md) fix an admission | what `authenticate` answers, or the value under the key `part` of it, or its refusal at its stage with its kind; nothing where `waits` is `true`, whose answer the look `admitted` reads |
| `ask` | `party` and `method`, and `params` and `part` if written | format 25: the party `party` asks the request `method` on its transport connection, with the `params` written, and with none where none is written | what the request answers, or the value under the key `part` of it, or its refusal at its stage with its kind |
| `detach` | `party` | format 25: the party `party` closes its transport connection | nothing |

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
| `revealed` | none | format 16: an array of each path the shell handed the host to show where it lies since the host app last started, in the order handed, each a string, as [files outside the app](../DECKIT-30/SPEC.md) fixes them |
| `windows` | `seat` if written | format 17: an array of the windows of every run: the normal windows on the desktop, on screen or minimized, in the shell's order back to front, a minimized one where it stood, format 23: then the panel windows that stand on the screen, a view where [views](../DECKIT-41/SPEC.md) fixes that it stands and is shown, in the order they opened, format 17: and then the overlay windows the host floats, back to front; each a table `{ mod, name, level, frame, key, minimized }`, `mod` the name its mod's bundle is listed under, `name` its name, left out for a window with none, `level` `"normal"` or `"overlay"`, format 23: or `"panel"`, format 17: `frame` a table `{ x, y, width, height }` of integers, its frame or where the host floats it, `key` whether it is key, for an overlay window whether it has the keyboard, and for a panel window `false`, and `minimized` whether it is minimized, as [windows](../DECKIT-31/SPEC.md) fixes them; format 26: the windows the user at the seat of the id `seat` sees, at the local seat where `seat` is not written, as [users and seats](../DECKIT-38/SPEC.md) fix a seat: the normal windows in the order they have for that seat, `key` and `minimized` as they are for it, `key` `false` of its key window while a view holds its keyboard, the window told `didResignKey` and its key window in its order still, then the panel windows that stand on its screen, a view shown for another seat alone left out, and then the overlay windows for the seat `local` alone, the id of the local seat, on whose screen the host floats them. A `seat` that is the id of no open seat comes to nothing. |
| `desktop` | `seat` if written | format 18: a table `{ active, attention, title }`: `active` the name the active mod's bundle is listed under, left out where no mod is active, `attention` an array of the names of the mods that ask for attention, in the order they first asked, and `title` the title the shell gives the desktop, as [activation](../DECKIT-32/SPEC.md) fixes them; format 26: where `seat` is written, a table `{ active, attention }` of the seat of the id `seat`: its active mod and the mods that ask for its attention, and no `title`, which is the title of the host app's own window. A `seat` that is the id of no open seat comes to nothing. |
| `dock` | `seat` if written | format 19: an array of the Dock's items, in the Dock's order, each a table `{ mod, pinned, running, attention, active }`: `mod` the name its mod's bundle is listed under, `pinned` whether the mod is kept in the Dock, and `running`, `attention` and `active` whether the item is marked running, for attention and active, as [the Dock](../DECKIT-33/SPEC.md) fixes them; format 26: where `seat` is written, the items as the user at the seat of the id `seat` sees them, `attention` and `active` as they are marked for that seat. A `seat` that is the id of no open seat comes to nothing. |
| `worn` | `properties`, and `mod` if written | format 21: a table `{ dark, properties }` of what the page of the run of the mod listed under `mod` wears, or the desktop's own page where `mod` is not written: `dark` whether its colour scheme is dark, and `properties` a table of the value, trimmed of white space, of each custom property `properties` names that the page's root holds, by its name, as [the look](../DECKIT-35/SPEC.md) fixes them |
| `regions` | none | format 22: an array of the children's views the shell lays over the regions of the windows on screen, back to front, those on the desktop, format 23: then those in the panel windows, format 22: then those in each overlay window the host floats; each a table `{ mod, parent, window, frame }`, `mod` the name the child's bundle is listed under, `parent` the one the window's mod's is listed under, `window` the window's name, and `frame` a table `{ x, y, width, height }` of integers, the rect the view is laid at, cut to the window's frame, as [regions and drops](../DECKIT-36/SPEC.md) fixes them |
| `downloaded` | none | format 14: an array of each file in the host's downloads folder, in the order of the Unicode scalar values of its name, each a table `{ name, body }`: `name` the file's name and `body` its bytes in base64, as [fetching through a session](../DECKIT-24/SPEC.md) writes bytes, left out where it holds none |
| `told` | `party`, and `part` if written | format 25: a table `{ messages, closed }` of the party `party`, or the value under the key `part` of it: `messages` an array of each message the host sent the party that answers no request the party asked, since its transport connection opened, in the order sent, each a table `{ method, params, request }`, `method` and `params` as the message holds them, `params` left out where it holds none, and `request` whether it is a request, as [a party from outside](../DECKIT-37/SPEC.md) fixes the messages; and `closed` whether the party's transport connection has closed, by either end |
| `admitted` | `party`, and `part` if written | format 26: what `authenticate` answers the party `party`, whose `attach` wrote `waits` `true`, read once it is answered and the same at each look from then on: its result, or the value under the key `part` of it, or its refusal at its stage with its kind. Where the party's transport connection closed before an answer, it comes to nothing |

Their keys take:

| key | takes |
|---|---|
| `mod` | string: a name a bundle is listed under |
| `part` | string: a key of the answer the step reads |
| `member` | string, a `member`, below: format 3 |
| `handle` | string, a handle's name, below; never beside `of` or `handed`: format 8 |
| `args` | array of values: format 3 |
| `folders` | array of `bundle-name`: format 3; beside a `drop`, always there: format 22 |
| `sites` | array of `site-address`, below, each of a site `[host] sites` names: format 9 |
| `headers` | array of strings, each a `token` in lower case, none written twice: format 9 |
| `origins` | array of `site-name`, each of a site `[host] sites` names, none written twice: format 12 |
| `of` | integer: the place, from 1, of an earlier `call` of the same `mod`, or, format 10, of an earlier `show` of it, and, format 11, for an `activate`, of an earlier `show` of it alone: format 4 |
| `session` | string: format 10 |
| `site` | string, a `site-address` of a site `[host] sites` names: format 10 |
| `url` | string, never one whose scheme is `http` or `https`, compared ignoring case, and never beside `site`: format 10 |
| `file` | string, a `bundle-file`, below, never beside `site` or `url`: format 11 |
| `apart` | boolean: format 10 |
| `listener` | boolean: format 4 |
| `handed` | boolean: written `true`, and never beside `of`: format 5 |
| `delegated` | integer: the place, from 1, of a call in what the look `delegated` answers; never beside `of`, `handed` or `handle`: format 13 |
| `answered` | integer: the place, from 1, of an earlier `call`, of any `mod`: format 14 |
| `notification` | integer: the place, from 1, of a notification in what `shown` answers: format 7 |
| `name` | string: a window's name: format 17; beside a `drop`, always there: format 22 |
| `action` | string: of a `window`, one of `press`, `close`, `minimize`, `zoom`, `move`, `resize` and `doubleClick`: format 17; of a `dock`, one of `click`, `quit`, `keep`, `remove` and `drag`: format 19 |
| `edge` | string, one of `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left` and `bottom-right`, written beside the `action` `resize`, and always there: format 17 |
| `by` | table `{ x, y }`, each an integer and 0 where it is left out, written beside the `action` `move` or `resize` alone, and `{ x = 0, y = 0 }` where it is not written: format 17; format 30: or beside a `desktop`, and always there |
| `keystroke` | table, a keystroke as [the key bindings](../DECKIT-16/SPEC.md) fix one: `code` a string, not empty, and `meta`, `control`, `alt` and `shift` booleans, each `false` where it is left out: format 18 |
| `outside` | boolean, written beside a `key` alone: format 20 |
| `appearance` | string, `"light"` or `"dark"`, written beside an `appearance` alone: format 21 |
| `properties` | array of strings, each `--` and then one or more of the letters `A` to `Z` and `a` to `z`, the digits, `_` and `-`, none written twice, written beside a `worn` alone: format 21 |
| `at` | table `{ x, y }`, each an integer, both always there, written beside a `drop` alone: format 22; format 30: or beside a `desktop` |
| `to` | string: a name a bundle is listed under, written beside the `action` `drag` of a `dock` alone, and always there: format 19 |
| `party` | string, a `party-name`, under *Parties*: format 25 |
| `principal` | string: format 25 |
| `key` | string, a `key-name`, under *Parties*: format 25 |
| `waits` | boolean, written beside an `attach` alone and never beside its `part`: format 26 |
| `method` | string: format 25 |
| `params` | table: format 25 |

```
member = name *( "." name )
name   = ALPHA *( ALPHA / DIGIT )
```

A `member` names a member of the handle: each `name` a member of the one before it, the first a member of the handle itself.

```
site-address = site-name [ site-path ]
```

A `site-address` names the site's address followed by its `site-path`, or by `/` where it writes none.

```
bundle-file = bundle-name "/" file-path
file-path   = segment *( "/" segment )
segment     = 1*( %x21-2E / %x30-7E )
```

A `bundle-file`, format 11, names the file at `file-path` in the bundle `bundle-name` names, a bundle of the case, no `segment` of it `.` or `..`. Its **file address** is the `file` URL of the file's path as the bundle is laid out, as the runner writes the path of a bundle, each segment of it percent-encoded where a URL's path takes it so.

A `call` that writes none of `of`, `handed` and `delegated` reads `member` from a handle of one lifecycle of the run, the same lifecycle for every `call` of that run, the handle `handle` names:

| `handle` | the handle |
|---|---|
| `"deckit"` | the handle `deckit`, as [the handle](../DECKIT-7/SPEC.md) fixes it; the handle of a `call` that writes no `handle` |
| `"web"` | format 8: the handle `web`, which the lifecycle is handed in `frameworks`, as [the web engine](../DECKIT-23/SPEC.md) fixes it |
| `"shell"` | format 15: the handle `shell`, which the shell hands the lifecycle on the base `shell`, as [the shell](../DECKIT-29/SPEC.md) fixes it |

The **host's delegate**, format 10, is the delegate the host gives each page its layer shows, as [web pages](../DECKIT-25/SPEC.md) fix a delegate: it holds each member `[host] delegate` names and no other, each a function that answers the value the table binds it to and is kept, with the values it is called with, for the look `delegated`. A page `openWindow` is handed and answers `true` for is given the host's delegate.

A step that writes `part` answers the value under that key of what it reads: of the answer, where the answer is a table, and, format 3, of each element of the answer that holds the key, in order, where the answer is an array of tables.

A **listener**, format 4, is a function the host gives, one for each run, handed to every `call` of that run that writes `listener`: each call of it is kept, with the values it is called with, and it answers nothing. What a step answers, and each value a listener is called with, is read as a value: a function is no value, so a key of a table bound to one is a key not answered, a request that answers one answers nothing, and an answer that holds one anywhere else comes to nothing, as does such a value a listener is called with; a refusal, as [the handle](../DECKIT-7/SPEC.md) fixes one, is read as the table `{ stage, kind }`.

Format 9: a string a step answers, anywhere in what it answers, that starts with a site's address followed by `/` or by nothing more, is read with that address written as the site's `site-name`, as a `site-address` writes it. Format 14: a string a step answers, anywhere in what it answers, that starts with the path of the host's downloads folder followed by `/` is read with that path written as `downloads`, and one that starts with the folder's `file` URL followed by `/`, with that URL written as `file:downloads`. Format 16: a string a step answers, anywhere in what it answers, that is a bundle's path, or starts with it followed by `/`, is read with that path written as the bundle's `bundle-name`.

A look at a name no bundle is listed under, and a step whose `part` a table answer does not hold, or whose answer with a `part` is no table and no array of tables, come to nothing, which no `[step.expect]` matches. A key's absence from an answer is read by a look at the whole bundle. A `call` comes to nothing where no run of the mod listed under `mod` is `running` as the step is taken, where `member` names no member of the handle or of what the call at `of` answered, or, format 4, where the run that answered the call at `of` is not the one `running`, or, format 5, where `handed` is written and the run's listener has not been called, or, format 13, where `delegated` is written and the host's delegate of the run has been called fewer times than it names, or, format 14, where the call at the place `answered` answered nothing, was refused or came to nothing, or, format 8, where the lifecycle is handed no handle of the name `handle` writes. A `show` comes to nothing where no run of the mod is `running`, or where the host's layer is offered no web pages, as on every base but `web`. An `activate` comes to nothing where no run of the mod is `running`, or where the web page the `show` at `of` showed is not there, as one that has closed. A `delegated` look at a mod with no run `running` comes to nothing. A `heard` look at a mod with no run `running` comes to nothing. A `press` comes to nothing where `shown` answers no notification at the place `notification`. Format 25: an `attach` comes to nothing where no transport connection opens; an `attach` and an `ask` where the request is answered an error that is no refusal, one that holds no `data`, or the transport connection closes before the request is answered; and an `ask` and a `detach` where the party's transport connection has closed.

`start` is the first step. A case starts the host app again only after a `quit`, and calls, presses, shows, activates, drops and looks, and, format 25, attaches, asks and detaches, only while the host app is started: after a `start` and before the next `quit`. A case whose `start` is refused writes no step after it.

### What a step must come to

A step may write `[step.expect]`, which holds `answers`, or `refuses` and `kind`:

| key | takes | means |
|---|---|---|
| `answers` | any value | the step answers this value |
| `refuses` | `"read"`, `"launch"` or `"call"` | the step is refused at this stage, and at no earlier or later one |
| `kind` | string, `[A-Z][A-Z_]*` | the refusal's kind; written beside `refuses` and only there |

A look writes `[step.expect]`, always. An input without it must not be refused and must not come to nothing, and what it answers is not compared. An input whose answer is nothing writes no `answers`.

**What a step expects is matched strictly**, as values: a string matches the string of the same Unicode scalar values, but where it writes a stand-in; an integer the number of the same value; a boolean the same boolean; an array the array of matching values in the same order; a table the table of the same keys, each bound to a matching value. A key that an implementation answers with no value (a null) is a key it does not answer, since the manifest text has no null.

Format 29: an expected string, anywhere in `answers`, may write the **stand-in**, the code point U+001A, which the manifest text writes `\u001A`:

| in an expected string | matches |
|---|---|
| U+001A | format 29: any run of code points that holds no LF, the empty run among them |

Each other code point of the string matches only itself, in order, and a key of a table is matched as written. This keeps matching strict: a stand-in stands only where a case writes one, so the case says each run within a line it leaves unfixed, such as a width the machine's fonts draw or a mark a moment raises, and a runner still compares every key, every value and every other code point. No reading of [what a seat reads](../DECKIT-40/SPEC.md) holds U+001A, which a quoted string writes as an escape, so a stand-in stands for no code point a reading prints as it is.

### Formats

A case format is the keys, values, bases, inputs and looks a case may write. The rows of this DECKIT's tables are format **1**, but those that say a later format. Format **2** adds the rows that say so, for [the lifecycle](../DECKIT-5/SPEC.md). Format **3** adds the rows that say so, for the requests a mod makes through its handle. Format **4** adds the rows that say so, for what a mod is handed by a connection and calls across it. Format **5** adds the rows that say so, for the standard interfaces: the owner a host ships, and a call of what a connection handed a listener. Format **6** adds the rows that say so, for [the key bindings](../DECKIT-16/SPEC.md): the base `shell`, whose handle the owner of `deckit/keys` takes chords through. Format **7** adds the rows that say so, for what of the machine the base stands for: the notifications of the machine, shown and pressed, and the clipboard. Format **8** adds the rows that say so, for [the web engine](../DECKIT-23/SPEC.md): the base `web`, and the handle a `call` reads its member from. Format **9** adds the rows that say so, for [fetching through a session](../DECKIT-24/SPEC.md): the sites a case serves, the key of a `call` that hands their addresses, and the look `requested`. Format **10** adds the rows that say so, for [web pages](../DECKIT-25/SPEC.md): the host's layer over the web engine on the base `web`, the input `show`, the host's delegate and the look `delegated`. Format **11** adds the rows that say so, for [web pages](../DECKIT-25/SPEC.md): the mod's page shown in a window of the host app's on the base `web`, the input `activate`, which presses a page the host's layer shows, and the key `file` of a `show`. Format **12** adds the rows that say so, for [what a site is let have](../DECKIT-26/SPEC.md): the apps the machine has, which the base stands for, and the key `origins` of a `call`, which hands a site's address inside a value. Format **13** adds the rows that say so, for [notifications of a site](../DECKIT-27/SPEC.md): the key `delegated` of a `call`, which calls a member of what the host's delegate was told. Format **14** adds the rows that say so, for [downloads](../DECKIT-28/SPEC.md): the host's downloads folder on the base `web`, the look `downloaded`, the key `answered` of a `call`, which hands it what an earlier call answered, and the folder read back in what a step answers. Format **15** adds the rows that say so, for [the shell](../DECKIT-29/SPEC.md): the host's layer over the shell on the base `shell`, and the handle `shell` a `call` reads its member from. Format **16** adds the rows that say so, for [files outside the app](../DECKIT-30/SPEC.md): the dialogs of folders and the paths shown where they lie, which the base `shell` stands for, the key `chosen` of the host, the look `revealed`, and a bundle's path read back as its name. Format **17** adds the rows that say so, for [windows](../DECKIT-31/SPEC.md): the desktop, the overlay windows and a web page's window, which the base `shell` shows on a stand-in for a screen, the input `window` and its keys `name`, `action`, `edge` and `by`, the look `windows`, and a step settled once each mod's page has taken what the shell told it. Format **18** adds the rows that say so, for [activation](../DECKIT-32/SPEC.md): the machine's keyboard, which the base `shell` stands for, the host app's name, the input `key` and its key `keystroke`, and the look `desktop`. Format **19** adds the rows that say so, for [the Dock](../DECKIT-33/SPEC.md): the Dock and the person's hand on it, which the base `shell` hands the shell, the key `dock` of the host, the input `dock` and its keys `action` and `to`, and the look `dock`. Format **20** adds the rows that say so, for [the shell's keys](../DECKIT-34/SPEC.md): the chords the machine gives the host app outside it, which the base `shell` stands for, the key `unavailable` of the host, and the key `outside` of a `key`. Format **21** adds the rows that say so, for [the look](../DECKIT-35/SPEC.md): the host app's look, which the base `shell` hands the shell, the key `appearance` of the host, the input `appearance` and its key `appearance`, and the look `worn` and its key `properties`. Format **22** adds the rows that say so, for [regions and drops](../DECKIT-36/SPEC.md): the desktop and the overlay windows drawn on no screen, the drops of files from outside the app, which the base `shell` hands the shell, the input `drop` and its key `at`, the look `regions`, and a step settled once each page the shell lays has drawn. Format **23** adds the rows that say so, for [windows](../DECKIT-31/SPEC.md): the bar the base `shell` lays across the top of its window, the key `bar` of the host, a panel window under the input `window`, and the panel windows in the looks `windows` and `regions`. Format **24** adds the rows that say so, for [web pages](../DECKIT-25/SPEC.md): a site that refuses every connection, and the key `refusing` of the host. Format **25** adds the rows that say so, for [a party from outside](../DECKIT-37/SPEC.md): the socket every base listens on, the users the host makes and the keys it registers, the keys `users` and `keys` of the host, the parties and the key pairs of a case, the inputs `attach`, `ask` and `detach` and their keys `party`, `principal`, `key`, `method` and `params`, the look `told`, and a step settled once the run a party's transport connection hosts has. Format **26** adds the rows that say so, for [users and seats](../DECKIT-38/SPEC.md): the key `seats` of the host, the settings the host sets before the first start, and the key `seat` of the looks `windows`, `desktop` and `dock`. Format **27** adds the rows that say so, for the mods an implementation ships: the key `mods` of the host, which ships one by its id. Format **28** adds the rows that say so, for what the system tells a page of its own accord: a step settled once what it told as the step's effect is taken. Format **29** adds the rows that say so, for what a case leaves unfixed: the stand-in in an expected string. Format **30** adds the rows that say so, for [windows](../DECKIT-31/SPEC.md): the person's scroll on the host app's window, which the base `shell` hands the shell as the machine's, and the input `desktop` and its keys `at` and `by`. A DECKIT that needs a base, an input, a look or a key that the format does not have adds it to this format as a supplement to this DECKIT, and gives the format the next number. That format holds every row of the one before it and the rows the DECKIT adds, and each row it adds says the format that added it. A case writes only the rows of its format.

### What a runner does

A runner knows every format up to the newest it was built for. It reads `case.toml`, and reads `case` before any other key, so that a case it is too old for is told from one that is not a case. It then holds the case to every rule above.

It lays out the bundles and sets up the host as `[host]` gives it, then takes the steps in order. After each input, it waits until the host app has **settled**: nothing it was asked is left unanswered, and no run is between two states; and, format 10, no page the host's layer shows is loading what it was asked to load; and, format 11, what a press set going in a page has been told and asked, a popup it opened among it; and, format 14, no download a page started is under way; and, format 17, on the base `shell`, each running mod's page has taken what the shell told it of its windows, and the shell what the page asked as it took it, twice over; and, format 22, each running mod's page the shell lays has drawn two frames since, or 300 ms have passed where it draws none; and, format 25, the run a party's transport connection hosts is not `terminating`, and is `notRunning` once that transport connection has closed, as [the lifecycle](../DECKIT-5/SPEC.md) names the states; and, format 28, what the system told a page of its own accord as the input's effect has been told and taken, and what the page asked as it took it: each is a telling, and the tellings are a click on a notification handed back to the document that showed it, as [notifications of a site](../DECKIT-27/SPEC.md) fixes it, the news that its site may have notifications told to a document that waits for it, and a change of seats told to a mod's listener, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes it. A page that waits on its dialog, as [windows](../DECKIT-31/SPEC.md) fixes a page's dialogs, runs nothing, so none of these is asked of it while it waits. An input the host app has not settled after, or a look it has not answered, within 10 seconds fails the case. Format 25: a look `told` and a `detach` are taken once the party has taken each message the host sent it before, and the close of its transport connection where the host closed it. Then it compares what the step came to with its `expect`, if it writes one. A step that does not match fails the case. A case passes when every step matches.

A case comes to one of these outcomes:

| outcome | the case | the run |
|---|---|---|
| passed | every step matched | goes on |
| failed | a step did not match, came to nothing, or did not settle or answer within 10 seconds; the runner names the first such step by its place in the list, from 1, and what it came to | goes on |
| too old | is of a later format than the newest the runner knows | goes on |
| not laid out | holds a bundle the runner cannot lay out as written, or, format 5, names in `owners` an interface the implementation ships no owner of, or, format 27, in `mods` an id it ships no mod of, and nothing of it runs | goes on |
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
- The standard interfaces whose owner a host ships, and the mods it ships by their ids: the DECKITs that fix them, such as [the addresses](../DECKIT-14/SPEC.md).
- The web engine the bases `web` and `shell` stack, and the handle `web` it hands every lifecycle: [the web engine](../DECKIT-23/SPEC.md).
- The pages the host's layer shows, the delegate it gives them, a popup a press opens and a page at a file: [web pages](../DECKIT-25/SPEC.md).
- The app the host has for a scheme, asked as a site goes to an address of it, and a site named in what a mod lets it have: [what a site is let have](../DECKIT-26/SPEC.md).
- The host's downloads folder, the downloads a page starts in it, and the ids a later call is handed: [downloads](../DECKIT-28/SPEC.md).
- The requests fetched through a session, which the sites a case serves answer, and the grammars of a header and of base64: [fetching through a session](../DECKIT-24/SPEC.md).
- The shell the base `shell` attaches, and the handle `shell` it hands a mod and the host's layer over it: [the shell](../DECKIT-29/SPEC.md).
- The dialogs of folders the base `shell` answers in place of the machine's, and the paths it keeps for `revealed`: [files outside the app](../DECKIT-30/SPEC.md).
- The desktop, the bar over it, the panel windows and the overlay windows the base `shell` shows on its stand-in screen, the person's hand on a window and the look `windows`: [windows](../DECKIT-31/SPEC.md).
- The Dock, the mods the host keeps there at the first start, the person's hand on it and the look `dock`: [the Dock](../DECKIT-33/SPEC.md).
- The host app's look the base `shell` hands the shell, and what a page wears, read by the look `worn`: [the look](../DECKIT-35/SPEC.md).
- A drop of files from outside the app and the page it lands on, and the children's views laid over regions, which the look `regions` reads: [regions and drops](../DECKIT-36/SPEC.md).
- What a host hands the system before the start, and what the system asks of a host after it: [the embedding](../DECKIT-22/SPEC.md).
- The socket a party opens a transport connection to, the messages on it, the handshake an `attach` asks, the run a transport connection hosts, what a party asks and is told, and the keys a host registers: [a party from outside](../DECKIT-37/SPEC.md).
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
- An `activate` that writes where in the page it presses. A point in a page lands on what the page lays there at the size the host app shows it, which a case does not fix; a site whose press fills its page is pressed alike wherever the press lands.
- A `show` that writes a file's address. Where the runner lays a bundle out is its own, as for a path; a case names a file by its bundle and its path in it.
- `[host] apps` left out for the machine's own apps. A case would pass only on a machine with the app it names, and a press would start a program of the person's; the base stands in for the apps as it stands in for opening an address.
- A site's origin written in `args` as a placeholder of its own, such as a template in a string. A case's text would hold a second grammar inside its strings; `origins` names the sites whose name, written as a whole string, is handed as the address, as a site's address is read back as its name.
- A dialog of folders shown on the machine, and a path shown there where it lies. A case would wait on a person's choice, and a run would show the folders of whoever runs it; the base stands in for the dialog as it stands in for opening an address, and the folders the person chooses are bundles of the case, whose paths are the runner's.
- The desktop shown on the machine's screen. A run would lay windows over whoever runs it, and where a window opens would hang on the size of their screen; the base stands in for a screen of a size fixed here, as it stands in for a dialog of folders.
- A site that redirects to any address. A redirect it answered off the loopback address would reach out of the machine; a `location` of the site's is a path on it.
- A party as a program the case holds. Every case would carry code that could itself be wrong, written for one runner; the runner is the party, and a case writes what the party asks.
- A key written in the case. A private key in the specification is one every reader holds, and a public key alone signs nothing; a case names a pair, and the runner makes it and keeps its private key.
- An `attach` written as its two requests. What `authenticate` sends is signed over the challenge `initialize` answered, with a key no case holds, so a case could write the `params` of neither; an `attach` is the handshake whole.
- An `expect` that names an error's code. A step is measured by a refusal's stage and its kind, and an error that carries neither is no refusal; a step answered one comes to nothing, as a `call` of a member the handle does not have does.
- A `told` that answers the answers to a party's requests too. What a request answers is what its `ask` answers, and `told` would say it twice.
- A party that asks `runner/started` as it attaches. A run that has not started is a run a rule may speak of, and a case could not reach one; a case asks it as any request.

## Notes

**Note.** Some sentences above are held by no case, each for its reason. What refuses as a case, and every outcome but passed: a case in the specification measures the implementation and passes on a conforming one, and a case that refused as a case would stop the suite. A `call` or a look that comes to nothing fails its case, for the same reason. The 10-second bound: a case that passes settles inside it. That a runner reaches inside nothing, waits until the host app has settled, matches strictly, matches a stand-in to no run across a line's end, reads `case` before any other key and reads a null as a key not answered: each is a property of the runner, checked by reading the runner. That each run starts from nothing kept: no input or look of these formats reads the system's own folder. The order `mods` answers in, and with it the order of `ship`: [the catalog](../DECKIT-4/SPEC.md)'s cases hold it. That a mod both `owners` and the host's `mods` reach is shipped once and not twice: the catalog passes over a folder shipped under a name a folder shipped before it is listed under, so the two answer alike; a case holds where it is shipped. That the host app shows no dialog of folders, no path and no window on the machine: a property of the host, checked by reading it. That the host app sends a request only to the loopback address: a property of the host, checked by reading it, since a case that fetched another address would read the host and not the system. What a site answers, and what `requested` answers of a request: the cases of [fetching through a session](../DECKIT-24/SPEC.md) read them, but a method HTTP does not register, which none sends. Of the parties: that a request answered a null answers nothing, and that an `attach`, an `ask` or a `detach` comes to nothing, since a step that writes no `expect` is not compared and one that comes to nothing fails its case; that a party answers a request at once, since the host closes the transport connection of a party that does not answer `runner/stop` once the time an end is given has passed, and `told` would answer the same; that the runner makes each key pair as the run begins, keeps its private key and chooses each nonce at random, that a `told` and a `detach` wait for what the host sent before, and that an `attach` that waits ends at the first of the two it ends at: each is a property of the runner, checked by reading the runner.

**Note.** The run a party's transport connection hosts is `launching` until the party asks `runner/started`, which a case may never ask. A runner does not wait for it as it waits for a mod's run between two states: it waits only for a run that is `terminating`, and for the end of one whose transport connection has closed.

**Note.** Where an implementation keeps its users and its authorized keys is its own, and so is how its host makes one and registers the other before the host app starts. A runner does both through what its implementation gives a host, as it hands over the fields and the permissions.

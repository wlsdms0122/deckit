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
| `apps` | table, each key a `scheme` as [what a site is let have](../DECKIT-26/SPEC.md) writes one, bound to a string that is not empty | no | format 12: the apps the machine has, each the name of the app that opens addresses of its scheme |
| `chosen` | array of `bundle-name` | no | format 16: the folders the person chooses in each dialog of folders, in order, under the base `shell` |
| `dock` | array of strings | no | format 19: the ids of the mods the host keeps in the Dock at the first start, in order, under the base `shell` |

| base | the host |
|---|---|
| `system` | the system alone, with nothing shipped, which opens none of the addresses it is handed to open outside the app, and, format 7, which shows none of the notifications of the machine it is handed to show and answers of each that the machine took it, and which keeps a clipboard of its own, never the machine's: it holds no text as the case begins, and what is written to it stands as the host app quits and starts again; and, format 12, which has an app for the addresses of a scheme only where `apps` names one, of the name `apps` gives it |
| `web` | format 8: the system as the base `system` is, with [the web engine](../DECKIT-23/SPEC.md) stacked over it, and no shell; format 10: with the host's own layer stacked over the web engine, the layer over it, which it offers web pages, as [web pages](../DECKIT-25/SPEC.md) fix them; format 11: which shows a mod's page, once its layer shows a web page on it, in a window of the host app's, on screen and without the keyboard, so that a press reaches each web page laid in it, as it reaches one shown apart; format 14: which hands the web engine, as the host's downloads folder, a folder of its own, new and empty as each run begins, where the runner keeps its run |
| `shell` | format 6: the system as the base `system` is, with the web engine stacked over it and the shell attached over the web engine, which shows nothing on screen; format 15: with the host's own layer stacked over the shell, whose lifecycle the shell hands the handle `shell`, as [the shell](../DECKIT-29/SPEC.md) fixes it; format 16: which shows no dialog of folders on screen, the person choosing in each the path of each bundle `chosen` names, in order, the first of them alone where the dialog takes one folder, and none where `chosen` names none, as one who cancels; and which shows no path where it lies, keeping each one it is handed, as [files outside the app](../DECKIT-30/SPEC.md) fixes them; format 17: which shows the desktop as the host app starts, the whole of a stand-in for a screen 1280 wide and 800 high, from `x` 0 and `y` 0, that lays nothing on the person's screen; which floats each overlay window the shell asks it to show, on that screen, in front of the others it floats, at the frame kept for it where that frame lies whole on the screen, and otherwise centred across it with its top a fifth of the way down, rounded to whole numbers, taking the keyboard as it shows it unless asked not to, and giving it up as the desktop comes up or the person's hand reaches a window on the desktop; which shows a web page apart on the desktop, in the window the shell shows it in; and on which a double click on a title bar is set to zoom the window, as [windows](../DECKIT-31/SPEC.md) fixes them; format 18: which stands for the machine's keyboard, the host app in front from its start: a key goes to the page the shell last gave the keyboard to, and the host gives the keyboard back to the desktop as the desktop comes up and as the person's hand reaches a window on it, as [activation](../DECKIT-32/SPEC.md) fixes it; format 19: which hands the shell the ids `dock` names, as the mods it keeps in the Dock at the first start, and none where `dock` is not written, as [the Dock](../DECKIT-33/SPEC.md) fixes them |

Format 18: on every base, the host app's name is `Deckit conformance`.

Format 9: on every base, the host app sends a request fetched through a session only to the loopback address, `127.0.0.1`: one to another address is not answered. Format 10: a case shows a page at an address of the web only as a `site-address` names one, so a page loads what the case's sites serve.

What the case writes under `[host]` adds to the base. Format 5: for each interface `owners` names, the host ships, before each bundle `ship` names, the bundle the implementation ships as the owner of that interface, marked system, as it ships it, with each framework the implementation's host app stacks for a permission that bundle asks for, and adds, before the fields the case writes, each field that bundle's manifest writes that neither [the bundle](../DECKIT-2/SPEC.md) nor the base reads. The case names that bundle by nothing else. An implementation that ships no owner of an interface `owners` names cannot lay the case out. Its fields and permissions come after the base's, as [the bundle](../DECKIT-2/SPEC.md) says, and a refusal of one is the answer to the `start` step.

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

### What the system gives a host

A runner sets up a host, and reads what the system answers, through what the system gives any host:

| what | when | what it is |
|---|---|---|
| the fields and permissions the host adds | before the start | as [the bundle](../DECKIT-2/SPEC.md) fixes them |
| the bundles the host ships | before the start | each one's folder, marked system or not |
| a folder of bundles read in place | before the start | one folder |
| the system's own folder | before the start | one folder, the system's alone |
| the downloads folder | before the start | format 14: one folder, which the host hands the web engine, where it writes the downloads a mod's web pages start, as [downloads](../DECKIT-28/SPEC.md) fixes them |
| the mod contract | before the start | the version the host runs mods with |
| the start | as the host app starts | answered once the host app has settled, or refused at `call` with its kind |
| the bundles found | once the host app has started | the name each one is listed under, in [the catalog's](../DECKIT-4/SPEC.md) order, and each one by that name, answered or refused as [the bundle](../DECKIT-2/SPEC.md) says |
| the runs | once the host app has started | format 2: for each name a bundle is listed under, what the system answers of its mod's run, as [the lifecycle](../DECKIT-5/SPEC.md) fixes it |
| a request through a mod's handle | while the mod's run is `running` | format 3: the run makes a request through the handle its code is handed, as the mod's code makes one, as [the handle](../DECKIT-7/SPEC.md) fixes it, and the host is answered what the request answers, or its refusal at its stage with its kind. Format 4: or through what a request the run made before answered, and handed a function the host gives, as the mod's code hands one of its own. Format 8: or through a handle a framework the host stacks hands a lifecycle of the run, as [the entry](../DECKIT-6/SPEC.md) fixes it. Format 15: or through the handle `shell` the shell hands the lifecycle of the host's layer over it, as [the shell](../DECKIT-29/SPEC.md) fixes it |
| the addresses to open outside the app | while the host app is started | format 3: each address a mod hands the host to open, with whether the app that opens it comes to the front, as [opening outside the app](../DECKIT-8/SPEC.md) fixes them |
| the notifications of the machine | while the host app is started | format 7: each notification a mod hands the host to show on the machine, which the host answers whether the machine took, and a press on one, which the host hands the system, as [notifications of the machine](../DECKIT-21/SPEC.md) fix them |
| the clipboard | while the host app is started | format 7: the text the system reads of the clipboard and the text it replaces it with, as [the clipboard](../DECKIT-20/SPEC.md) fixes them |
| the dialogs of folders | while the host app is started | format 16: each dialog of folders the shell asks the host to show, with whether it takes several folders, which the host answers with the path of each folder the person chose, as [files outside the app](../DECKIT-30/SPEC.md) fixes them |
| the paths shown where they lie | while the host app is started | format 16: each path the shell hands the host to show the person where it lies, as [files outside the app](../DECKIT-30/SPEC.md) fixes them |
| the windows | while the host app is started | format 17: the desktop the shell shows in the host app's window, and the normal windows on it as the shell holds them, each with its mod, its name, its frame and whether it is key or minimized; each overlay window the shell asks the host to float, with its size and the frame kept for it, which the host tells the shell takes the keyboard, gives it up and is moved; and the person's hand on a window, which the host hands the shell, as [windows](../DECKIT-31/SPEC.md) fixes them |
| the keyboard | while the host app is started | format 18: each key the person presses, which the host hands the page that has the keyboard; and the mod the shell holds active, the mods that ask for attention and the title the shell gives the desktop, as [activation](../DECKIT-32/SPEC.md) fixes them |
| the Dock | while the host app is started | format 19: the Dock the shell draws on the desktop, its items and their marks, and the person's hand on it, which the host hands the shell: a click on an item, a choice of its menu and a drag of a kept item, as [the Dock](../DECKIT-33/SPEC.md) fixes them |
| the apps | while the host app is started | format 12: the name of the app the machine has for the addresses of a scheme, which the system asks of the host, as [what a site is let have](../DECKIT-26/SPEC.md) asks it |
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
| `call` | `mod` and `member`, and `args`, `folders`, `sites`, `origins`, `part`, `handle`, `of`, `listener`, `handed`, `delegated` and `answered` if written | format 3: the run of the mod listed under the name `mod` makes a request through its handle: the member `member`, called with the path of each bundle `folders` names, in order, then, format 9, the address each `site-address` of `sites` names, in order, then, format 14, what the call at the place `answered` answered, as the system answered it and before a step reads it, or each element of it, in order, where it is an array, then each value of `args`, in order, and then, format 4, a listener where `listener` is `true`. Format 12: where `origins` is written, each string of `args`, at any depth, that is a `site-name` it holds is handed as that site's address, its origin. Format 4: where `of` is written, `member` names a member of what the call at that place answered, as the run holds it, and not of the handle, or, format 10, of the page handle of the page the `show` at that place showed. Format 5: where `handed` is `true`, `member` names a member of the first value the listener was last called with, as the run holds it, and not of the handle. Format 13: where `delegated` is written, `member` names a member of the first value the call of the host's delegate at that place in what the look `delegated` answers was called with, as the host's layer holds it, and not of the handle. Format 8: where `handle` is written, `member` names a member of the handle it names, below, and not of `deckit`. A member that holds a value is read, and is written with no `args`, no `folders` and no `listener` | what the request answers, or the value under the key `part` of it, or its refusal at its stage with its kind, as [the handle](../DECKIT-7/SPEC.md) fixes them |
| `press` | `notification` | format 7: the notification of the machine at the place `notification` in what `shown` answers is pressed, as [notifications of the machine](../DECKIT-21/SPEC.md) fix a press | nothing |
| `show` | `mod` and `session`, and `site`, `url`, `file` and `apart` if written | format 10: the host's layer shows a page on the page of the run of the mod listed under `mod`, in the session the handle `web` of the lifecycle a `call` reads answers for the name `session`, as [web pages](../DECKIT-25/SPEC.md) fix `page`, or `window` where `apart` is `true`, at the address `site` names, or at `url`, or, format 11, at the file address of the file `file` names, or at the empty string where none is written, and gives the page the host's delegate | nothing, or the refusal of what it did at its stage with its kind |
| `window` | `mod` and `action`, and `name`, `edge` and `by` if written | format 17: the person's hand on the window on screen of the run of the mod listed under `mod` named `name`, or on its window with no name, a web page's, where `name` is not written: by `action`, `press` a press in it, `close`, `minimize` or `zoom` a click of that button of its title bar, `move` a drag of its title bar by `by`, let go, `resize` a drag of its edge or corner `edge` by `by`, let go, and `doubleClick` a double click on its title bar, as [windows](../DECKIT-31/SPEC.md) fixes them; on an overlay window, a `press` or a `move` alone. A hand on no window on screen, or of an `action` an overlay window does not take, comes to nothing | nothing |
| `key` | `keystroke` | format 18: the person presses the key `keystroke` in the page that has the keyboard, which reaches what [activation](../DECKIT-32/SPEC.md) fixes; a key where no page has the keyboard comes to nothing | nothing |
| `dock` | `mod` and `action`, and `to` if written | format 19: the person's hand on the Dock's item of the mod listed under `mod`: by `action`, `click` a click on it, `quit`, `keep` or `remove` the choice of its menu that quits the mod, keeps it in the Dock or takes it out, and `drag` a drag of it onto the place of the item of the mod listed under `to`, as [the Dock](../DECKIT-33/SPEC.md) fixes them. A hand on no item, a choice the menu does not offer, or a drag that is not of a kept item onto another kept item comes to nothing | nothing |
| `activate` | `mod` and `of` | format 11: the web page the `show` at the place `of` showed, for the run of the mod listed under `mod`, is pressed with the mouse's button, pressed down and let go inside it, as a person's press comes to the host app; a site a case presses lays what it presses over its whole page | nothing |

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
| `windows` | none | format 17: an array of the windows of every run: the normal windows on the desktop, on screen or minimized, in the shell's order back to front, a minimized one where it stood, and then the overlay windows the host floats, back to front; each a table `{ mod, name, level, frame, key, minimized }`, `mod` the name its mod's bundle is listed under, `name` its name, left out for a window with none, `level` `"normal"` or `"overlay"`, `frame` a table `{ x, y, width, height }` of integers, its frame or where the host floats it, `key` whether it is key, or for an overlay window whether it has the keyboard, and `minimized` whether it is minimized, as [windows](../DECKIT-31/SPEC.md) fixes them |
| `desktop` | none | format 18: a table `{ active, attention, title }`: `active` the name the active mod's bundle is listed under, left out where no mod is active, `attention` an array of the names of the mods that ask for attention, in the order they first asked, and `title` the title the shell gives the desktop, as [activation](../DECKIT-32/SPEC.md) fixes them |
| `dock` | none | format 19: an array of the Dock's items, in the Dock's order, each a table `{ mod, pinned, running, attention, active }`: `mod` the name its mod's bundle is listed under, `pinned` whether the mod is kept in the Dock, and `running`, `attention` and `active` whether the item is marked running, for attention and active, as [the Dock](../DECKIT-33/SPEC.md) fixes them |
| `downloaded` | none | format 14: an array of each file in the host's downloads folder, in the order of the Unicode scalar values of its name, each a table `{ name, body }`: `name` the file's name and `body` its bytes in base64, as [fetching through a session](../DECKIT-24/SPEC.md) writes bytes, left out where it holds none |

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
| `name` | string: a window's name: format 17 |
| `action` | string: of a `window`, one of `press`, `close`, `minimize`, `zoom`, `move`, `resize` and `doubleClick`: format 17; of a `dock`, one of `click`, `quit`, `keep`, `remove` and `drag`: format 19 |
| `edge` | string, one of `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left` and `bottom-right`, written beside the `action` `resize`, and always there: format 17 |
| `by` | table `{ x, y }`, each an integer and 0 where it is left out, written beside the `action` `move` or `resize` alone, and `{ x = 0, y = 0 }` where it is not written: format 17 |
| `keystroke` | table, a keystroke as [the key bindings](../DECKIT-16/SPEC.md) fix one: `code` a string, not empty, and `meta`, `control`, `alt` and `shift` booleans, each `false` where it is left out: format 18 |
| `to` | string: a name a bundle is listed under, written beside the `action` `drag` of a `dock` alone, and always there: format 19 |

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

A look at a name no bundle is listed under, and a step whose `part` a table answer does not hold, or whose answer with a `part` is no table and no array of tables, come to nothing, which no `[step.expect]` matches. A key's absence from an answer is read by a look at the whole bundle. A `call` comes to nothing where no run of the mod listed under `mod` is `running` as the step is taken, where `member` names no member of the handle or of what the call at `of` answered, or, format 4, where the run that answered the call at `of` is not the one `running`, or, format 5, where `handed` is written and the run's listener has not been called, or, format 13, where `delegated` is written and the host's delegate of the run has been called fewer times than it names, or, format 14, where the call at the place `answered` answered nothing, was refused or came to nothing, or, format 8, where the lifecycle is handed no handle of the name `handle` writes. A `show` comes to nothing where no run of the mod is `running`, or where the host's layer is offered no web pages, as on every base but `web`. An `activate` comes to nothing where no run of the mod is `running`, or where the web page the `show` at `of` showed is not there, as one that has closed. A `delegated` look at a mod with no run `running` comes to nothing. A `heard` look at a mod with no run `running` comes to nothing. A `press` comes to nothing where `shown` answers no notification at the place `notification`.

`start` is the first step. A case starts the host app again only after a `quit`, and calls, presses, shows, activates and looks only while the host app is started: after a `start` and before the next `quit`. A case whose `start` is refused writes no step after it.

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

A case format is the keys, values, bases, inputs and looks a case may write. The rows of this DECKIT's tables are format **1**, but those that say a later format. Format **2** adds the rows that say so, for [the lifecycle](../DECKIT-5/SPEC.md). Format **3** adds the rows that say so, for the requests a mod makes through its handle. Format **4** adds the rows that say so, for what a mod is handed by a connection and calls across it. Format **5** adds the rows that say so, for the standard interfaces: the owner a host ships, and a call of what a connection handed a listener. Format **6** adds the rows that say so, for [the key bindings](../DECKIT-16/SPEC.md): the base `shell`, whose handle the owner of `deckit/keys` takes chords through. Format **7** adds the rows that say so, for what of the machine the base stands for: the notifications of the machine, shown and pressed, and the clipboard. Format **8** adds the rows that say so, for [the web engine](../DECKIT-23/SPEC.md): the base `web`, and the handle a `call` reads its member from. Format **9** adds the rows that say so, for [fetching through a session](../DECKIT-24/SPEC.md): the sites a case serves, the key of a `call` that hands their addresses, and the look `requested`. Format **10** adds the rows that say so, for [web pages](../DECKIT-25/SPEC.md): the host's layer over the web engine on the base `web`, the input `show`, the host's delegate and the look `delegated`. Format **11** adds the rows that say so, for [web pages](../DECKIT-25/SPEC.md): the mod's page shown in a window of the host app's on the base `web`, the input `activate`, which presses a page the host's layer shows, and the key `file` of a `show`. Format **12** adds the rows that say so, for [what a site is let have](../DECKIT-26/SPEC.md): the apps the machine has, which the base stands for, and the key `origins` of a `call`, which hands a site's address inside a value. Format **13** adds the rows that say so, for [notifications of a site](../DECKIT-27/SPEC.md): the key `delegated` of a `call`, which calls a member of what the host's delegate was told. Format **14** adds the rows that say so, for [downloads](../DECKIT-28/SPEC.md): the host's downloads folder on the base `web`, the look `downloaded`, the key `answered` of a `call`, which hands it what an earlier call answered, and the folder read back in what a step answers. Format **15** adds the rows that say so, for [the shell](../DECKIT-29/SPEC.md): the host's layer over the shell on the base `shell`, and the handle `shell` a `call` reads its member from. Format **16** adds the rows that say so, for [files outside the app](../DECKIT-30/SPEC.md): the dialogs of folders and the paths shown where they lie, which the base `shell` stands for, the key `chosen` of the host, the look `revealed`, and a bundle's path read back as its name. Format **17** adds the rows that say so, for [windows](../DECKIT-31/SPEC.md): the desktop, the overlay windows and a web page's window, which the base `shell` shows on a stand-in for a screen, the input `window` and its keys `name`, `action`, `edge` and `by`, the look `windows`, and a step settled once each mod's page has taken what the shell told it. Format **18** adds the rows that say so, for [activation](../DECKIT-32/SPEC.md): the machine's keyboard, which the base `shell` stands for, the host app's name, the input `key` and its key `keystroke`, and the look `desktop`. Format **19** adds the rows that say so, for [the Dock](../DECKIT-33/SPEC.md): the Dock and the person's hand on it, which the base `shell` hands the shell, the key `dock` of the host, the input `dock` and its keys `action` and `to`, and the look `dock`. A DECKIT that needs a base, an input, a look or a key that the format does not have adds it to this format as a supplement to this DECKIT, and gives the format the next number. That format holds every row of the one before it and the rows the DECKIT adds, and each row it adds says the format that added it. A case writes only the rows of its format.

### What a runner does

A runner knows every format up to the newest it was built for. It reads `case.toml`, and reads `case` before any other key, so that a case it is too old for is told from one that is not a case. It then holds the case to every rule above.

It lays out the bundles and sets up the host as `[host]` gives it, then takes the steps in order. After each input, it waits until the host app has **settled**: nothing it was asked is left unanswered, and no run is between two states; and, format 10, no page the host's layer shows is loading what it was asked to load; and, format 11, what a press set going in a page has been told and asked, a popup it opened among it; and, format 14, no download a page started is under way; and, format 17, on the base `shell`, each running mod's page has taken what the shell told it of its windows, and the shell what the page asked as it took it, twice over. An input the host app has not settled after, or a look it has not answered, within 10 seconds fails the case. Then it compares what the step came to with its `expect`, if it writes one. A step that does not match fails the case. A case passes when every step matches.

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
- The pages the host's layer shows, the delegate it gives them, a popup a press opens and a page at a file: [web pages](../DECKIT-25/SPEC.md).
- The app the host has for a scheme, asked as a site goes to an address of it, and a site named in what a mod lets it have: [what a site is let have](../DECKIT-26/SPEC.md).
- The host's downloads folder, the downloads a page starts in it, and the ids a later call is handed: [downloads](../DECKIT-28/SPEC.md).
- The requests fetched through a session, which the sites a case serves answer, and the grammars of a header and of base64: [fetching through a session](../DECKIT-24/SPEC.md).
- The shell the base `shell` attaches, and the handle `shell` it hands a mod and the host's layer over it: [the shell](../DECKIT-29/SPEC.md).
- The dialogs of folders the base `shell` answers in place of the machine's, and the paths it keeps for `revealed`: [files outside the app](../DECKIT-30/SPEC.md).
- The desktop and the overlay windows the base `shell` shows on its stand-in screen, the person's hand on a window and the look `windows`: [windows](../DECKIT-31/SPEC.md).
- The Dock, the mods the host keeps there at the first start, the person's hand on it and the look `dock`: [the Dock](../DECKIT-33/SPEC.md).
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
- An `activate` that writes where in the page it presses. A point in a page lands on what the page lays there at the size the host app shows it, which a case does not fix; a site whose press fills its page is pressed alike wherever the press lands.
- A `show` that writes a file's address. Where the runner lays a bundle out is its own, as for a path; a case names a file by its bundle and its path in it.
- `[host] apps` left out for the machine's own apps. A case would pass only on a machine with the app it names, and a press would start a program of the person's; the base stands in for the apps as it stands in for opening an address.
- A site's origin written in `args` as a placeholder of its own, such as a template in a string. A case's text would hold a second grammar inside its strings; `origins` names the sites whose name, written as a whole string, is handed as the address, as a site's address is read back as its name.
- A dialog of folders shown on the machine, and a path shown there where it lies. A case would wait on a person's choice, and a run would show the folders of whoever runs it; the base stands in for the dialog as it stands in for opening an address, and the folders the person chooses are bundles of the case, whose paths are the runner's.
- The desktop shown on the machine's screen. A run would lay windows over whoever runs it, and where a window opens would hang on the size of their screen; the base stands in for a screen of a size fixed here, as it stands in for a dialog of folders.
- A site that redirects to any address. A redirect it answered off the loopback address would reach out of the machine; a `location` of the site's is a path on it.

## Notes

**Note.** Some sentences above are held by no case, each for its reason. What refuses as a case, and every outcome but passed: a case in the specification measures the implementation and passes on a conforming one, and a case that refused as a case would stop the suite. A `call` or a look that comes to nothing fails its case, for the same reason. The 10-second bound: a case that passes settles inside it. That a runner reaches inside nothing, waits until the host app has settled, matches strictly, reads `case` before any other key and reads a null as a key not answered: each is a property of the runner, checked by reading the runner. That each run starts from nothing kept: no input or look of these formats reads the system's own folder. The order `mods` answers in, and with it the order of `ship`: [the catalog](../DECKIT-4/SPEC.md)'s cases hold it. That the host app shows no dialog of folders, no path and no window on the machine: a property of the host, checked by reading it. That the host app sends a request only to the loopback address: a property of the host, checked by reading it, since a case that fetched another address would read the host and not the system. What a site answers, and what `requested` answers of a request: the cases of [fetching through a session](../DECKIT-24/SPEC.md) read them, but a method HTTP does not register, which none sends.

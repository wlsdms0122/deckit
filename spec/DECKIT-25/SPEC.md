# DECKIT-25: Web pages

Status: draft
Area: web

## Summary

The web engine shows web pages in a mod's sessions, and offers what shows them to the layer a host stacks over it, never to a mod's handle: `page({ session, url })`, a page laid in the mod's page, and `window({ session, url, title })`, a page the host shows apart from it. This DECKIT fixes that offer, the page handle each answers, its `state`, a load that fails among it, its members and how each is refused, what a page loads, `system.files` among it, a popup a page opens after a press, the delegate through which the layer is told and asked, and what a page opens outside the app.

## Motivation

A layer a host stacks over the web engine, such as a shell, lets a mod show a site signed in to, in its page or apart from it, and is written once for every implementation of the web engine:

```js
const page = surfaces.page({ session: web.session("main"), url: "https://example.com/" });
page.delegate = { openWindow: (popup) => true, didChange: (state) => show(state.title) };
```

The page is the web engine's: what it loads, in which session's store, and what of it leaves the app are the web engine's to decide, alike under every layer over it. Each of these is a call two implementations could answer differently without a rule:

- `page.load(5)` loads the address `5` on one implementation, read as a relative address, and throws an error with no kind on another; `page.mute("no")` mutes the page on one, which reads any string as true.
- `window({ session, url: "ftp://example.com/" })` is closed at once on one implementation, while `page(...)` of the same address is shown blank on the same one; another shows both blank.
- A site's script calls `window.open("/child")` as it loads, with no press. One implementation opens the child; another, as a browser does, opens nothing.
- A site's popup at `about:blank`, which a sign-in flow writes into, is opened outside the app as an address on one implementation, which hands a person's browser an empty page, and handed to the layer as a page on another.
- A page shows `file:///Users/a/notes.txt` for a mod granted nothing. One implementation shows the file; another refuses it, as only a mod granted `system.files` reads files in its pages.
- A site's popup the layer does not take is dropped on one implementation, and its address opened in the browser on another.
- A page is asked to load an address whose host refuses the connection. One implementation tells the layer nothing but that the page stopped loading, at the address it showed before, and the layer shows that page as if it were the one asked for; another tells the address that failed and why, and the layer says so in the page's place.
- A sign-in page shown apart opens its consent step as a popup. One implementation shows the popup apart itself, and the layer holds no handle of it and is told nothing of it; another hands it to the layer as it hands the popup of a page laid in the mod's page.

## Rules

### The pages the web engine offers

The web engine offers the layer a host stacks over it, as [the web engine](../DECKIT-23/SPEC.md) says, on the page of each mod's run, for each lifecycle of the run that layer has, what shows web pages in the mod's sessions, a table of two members:

| member | takes | answers |
|---|---|---|
| `page({ session, url })` | `session`, a session handle the handle `web` of a lifecycle of the run answered, required; `url`, a string, the address the page loads, left out the empty string | the page handle of a page laid in the mod's page |
| `window({ session, url, title })` | as `page`, and `title`, a string, left out the empty string: the title the host shows the page with while it has none of its own | the page handle of a page the host shows apart from the mod's page |

Each answers at once and throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one: at `call` with kind `INVALID_ARGUMENT` where `session` is no session handle the handle `web` of the run answered, and then at `call` with kind `ENDED` where that session handle is cut, as [the web engine](../DECKIT-23/SPEC.md) fixes it, or where the lifecycle the layer was offered the pages for has ended. A page shown in a session **uses** it, as [the web engine](../DECKIT-23/SPEC.md) fixes a session used, and keeps in its store what its sites store, as a fetch through it does: a cookie a page's site sets is sent by a fetch through the session, as [fetching through a session](../DECKIT-24/SPEC.md) fixes it, and one a fetch is answered is sent by the session's pages.

A page **loads** `url` as it is made, as *What a page loads* fixes, and a page whose `url` is the empty string or `about:blank`, written in any case, with any query or fragment, is a **blank page**, which loads nothing and shows nothing. Where a page laid in the mod's page is shown in it, and where and how the host shows a page apart, is the layer's and the host's.

A page is closed as the lifecycle ends that the layer was offered the pages for, and then nothing more of it is told.

### The page handle

A page handle is a table of these members, each but `state` and `delegate` a member that answers nothing at once and throws its refusal:

| member | takes | what it does |
|---|---|---|
| `session` | | the session handle the page was made with |
| `state` | | the page's state, under *The state*, a value read; told to the delegate's `didChange` as it changes |
| `delegate` | | the delegate, under *The delegate*: read, and written by the layer, a table or `null`; anything else written is `null` |
| `load(url)` | `url`, a string, required | loads `url`, as *What a page loads* fixes |
| `back()`, `forward()` | | goes to the page before, or after, in the page's history, where there is one; `back()`, while `state` holds a failure, goes to what the page showed, under *A load that fails* |
| `reload()`, `stop()` | | loads the page's address again, or, while `state` holds a failure, the address that failed; stops what it is loading |
| `mute(on)` | `on`, a boolean, required | mutes the page's sound, or lets it play |
| `find(text, options)` | `text`, a string, required; `options`, a table `{ start, back, matchCase }` of booleans, each left out `false` | finds `text` in the page, from its first match where `start` is `true`, else from the match after the last found, before it where `back` is `true`; its case compared where `matchCase` is `true`; the empty string finds nothing |
| `stopFind(options)` | `options`, a table `{ keepSelection }`, a boolean left out `false` | ends finding, leaving the match selected where `keepSelection` is `true` |
| `close()` | | closes the page |
| `element`, `focus()` | | of a page laid in the mod's page only: the element of the mod's page the layer lays where the page shows; and gives the page the keyboard |

A member is refused with the first of these that is so, and does nothing:

1. at `call` with kind `INVALID_ARGUMENT`, where what it is handed does not fit what it takes, as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not;
2. at `call` with kind `ENDED`, where the lifecycle the layer was offered the pages for has ended.

A page that has closed does nothing it is asked, and is not refused.

### The state

`state` is a table:

| key | value |
|---|---|
| `url` | string: the address of what the page shows, the empty string for a blank page |
| `title` | string: its title, the empty string where it has none |
| `icon` | string: the address of its icon |
| `loading` | boolean: `true` while it loads |
| `canGoBack`, `canGoForward` | boolean: whether `back()`, or `forward()`, has a page to go to |
| `blank` | boolean: `true` while it has shown nothing but a blank page |
| `audible`, `muted` | boolean: whether it plays sound; whether it is muted |
| `capture` | table `{ microphone, camera, screen }` of booleans: whether it takes each, as [what a site is let have](../DECKIT-26/SPEC.md) lets it |
| `failure` | `null`, or a table `{ url, kind }`: how the last load of the page failed, under *A load that fails* |

A page made is not loading where it is a blank page, and loading where it is not, until it is told otherwise, and holds no failure.

### A load that fails

A load **fails** where the page's main frame gets nothing it could show of the address: no answer of the address's host came before the load ended. `state.failure` then holds `url`, the address that failed, as the load asked for it, and `kind`, a string, one of:

| `kind` | the load ended as |
|---|---|
| `no-connection` | the machine had no connection to a network to send it on |
| `host-not-found` | no host of the address's name was found |
| `refused` | the host refused the connection |
| `timed-out` | the host did not answer in time |
| `other` | any other way it ended with no answer |

None of these is a failure, and none sets `failure`: an answer the site serves, of any status, which the page shows as its content; a load stopped, by `stop()`, or replaced by another load; a load that becomes a download; a load refused, which never left the page, under *What a page loads*; a certificate refused, which is [what a site is let have](../DECKIT-26/SPEC.md)'s; and a load whose document was shown and then ended before it was whole, which keeps what it showed.

A failure holds until the next load of the page that shows what it gets, the page's own or one the layer asks, and is then `null`; a load asked while a failure holds, which fails too, replaces it. What the page showed before the load that failed stays the page's, and its history holds only what it showed: while a failure holds, `canGoBack` is `true` where the page showed anything but a blank page, and `back()` goes to that, which shows again as it was, and makes `failure` `null`; `reload()` loads `url`.

**Note.** A failure is told in `state` and not as an event of its own, since the layer draws a page from its `state` as it changes: a layer that draws a page's place from `didChange` draws its failure the same way, and one that reads `state` later still finds it. The kinds are named by what the layer must say to the person, so a layer says the same on every implementation, whatever codes each one's web gets.

### What a page loads

A load is a page's own navigation, by a link or its script, or one the layer asks: as the page is made, and by `load(url)`. A load the layer asks loads:

| address | loaded |
|---|---|
| an address of the web, whose scheme is `http` or `https` | in every page |
| a file, whose scheme is `file` | in a page laid in the mod's page, where the mod is granted `system.files` as the page loads it; in no other |
| any other | in no page |

A load refused leaves the page as it was: a page made at an address it does not load is a blank page. `system.files` guards what this table says of a file and nothing else, as [the web engine](../DECKIT-23/SPEC.md) defines it.

A page's own navigation loads where it leads, but that a page that shows a file never goes to an address of the web: the page stays, and the address is **left for**, under *The delegate*. A page's own navigation to an address of a scheme an app opens is [what a site is let have](../DECKIT-26/SPEC.md)'s.

**Note.** A file is read in a page of the mod's own and not apart from it, so that a page that reads the files a person keeps is one the mod lays where it shows it. A file page sends its address of the web elsewhere since its session would keep what the web's sites set beside the files it read.

### Popups

A page's `window.open(url)` opens a **popup** only where a key or the mouse was pressed in that page within the 5 seconds before it, and each press opens at most one: without one it opens nothing and answers `null`, as a browser blocks a popup with no press. A popup at a blank page or an address of the web is opened in the page's session; at an address of another scheme, it is [what a site is let have](../DECKIT-26/SPEC.md)'s, and opens no page.

| the page that opens it | the popup |
|---|---|
| a page that shows a file | no page: its address, unless it is blank, is opened outside the app, under *What a page opens outside the app* |
| any other, laid in the mod's page or shown apart, whatever window features it asks with | a page handed to the delegate of the page that opens it, its `openWindow(page, { url, activates })`, `activates` `true` but where the press asked for the popup behind: a page the delegate does not take, answering anything but `true`, is closed and its address, unless it is blank, opened outside the app |

A popup handed to the delegate and taken is a page laid in the mod's page, made for the same lifecycle.

### The delegate

The **delegate** is the table a page's `delegate` holds, through which the web engine tells the layer and asks it. A member it does not hold, as a function, is not told and is answered its default; one that throws, or whose promise rejects, is answered its default:

| member | told or asked | default |
|---|---|---|
| `didChange(state)` | told each time `state` changes, the whole `state` | |
| `didFocus()` | told as a page laid in the mod's page is pressed | |
| `didFind({ matches, active, final })` | told what `find` found: how many matches, the place from 1 of the one shown, and whether the count is final | |
| `didRequestClose()` | told as a page laid in the mod's page asks to close, by `window.close()` | |
| `didClose()` | told as a page shown apart has closed | |
| `openWindow(page, { url, activates })` | asked whether it takes a popup, under *Popups* | `false` |
| `shouldLeave(url)` | asked as a page that shows a file leaves for an address of the web | `true`: the address is opened outside the app; `false` keeps it in |
| `didRefuseCertificate`, `decidePermission` | [what a site is let have](../DECKIT-26/SPEC.md) | |
| `didReceiveNotification` | [notifications of a site](../DECKIT-27/SPEC.md) | |
| `shouldDownload` | [downloads](../DECKIT-28/SPEC.md) | |

A page's dialog, its `alert`, `confirm`, `prompt` and the leave of its document, is no member of the delegate: the shell draws it in the window that shows the page, as [windows](../DECKIT-31/SPEC.md) fixes a page's dialogs.

### What a page opens outside the app

What the web engine opens outside the app for a mod is opened as [opening outside the app](../DECKIT-8/SPEC.md) fixes `openExternal` of the mod, with its guard and its refusals, `activates` as handed:

- an address a page that shows a file leaves for, unless `shouldLeave` answers `false`, and a popup's address not taken, under *Popups*, each through what the layer over the web engine is offered the pages with: what opens an address outside the app for the mod;
- an address the mod's own page opens with `window.open`, or leaves for, which it never shows.

A blank page is never opened outside the app.

## Interactions

- The layer a host stacks over the web engine, a session, a session handle and its cut, a session used, and `system.files`: [the web engine](../DECKIT-23/SPEC.md).
- The cookies a page's session shares with a fetch: [fetching through a session](../DECKIT-24/SPEC.md).
- An error thrown with a stage and a kind, `INVALID_ARGUMENT`, and a value read: [the handle](../DECKIT-7/SPEC.md).
- What opens outside the app, its guard `system.file-handlers` and `UNSUPPORTED_URL`: [opening outside the app](../DECKIT-8/SPEC.md).
- A lifecycle and its end: [the entry](../DECKIT-6/SPEC.md).
- The window the shell shows a page apart in, and a page's dialogs: [windows](../DECKIT-31/SPEC.md).
- The inputs `show` and `activate`, a page shown at a file of a bundle, the host's delegate and the look `delegated`: [the case format](../DECKIT-1/SPEC.md).
- What a site is let have, an app for an address and a certificate refused, which is no failure of a load: [what a site is let have](../DECKIT-26/SPEC.md).
- A site that refuses a connection, which a case serves at an address of its own: [the case format](../DECKIT-1/SPEC.md). A site's notification: [notifications of a site](../DECKIT-27/SPEC.md). A download a page starts: [downloads](../DECKIT-28/SPEC.md).

## Alternatives considered

- The pages on the handle `web`. A mod with no layer over the web engine has no place to lay a page and no window to show one in; what shows a page is the layer's, which hands its mods what it chooses.
- A window as the web engine's. Where a page apart is shown, its frame and its title bar, is the GUI's, which a host may run without; the web engine hands a page and tells what it does.
- The page's members as requests. Each sends what it is asked to the page and waits on nothing, so a promise would make the layer wait on nothing; what it comes to is told through `didChange`.
- A popup of a page shown apart shown apart by the host on its own. The layer over the web engine would hold no handle of it and be told nothing of it, and the web engine would name a window; a popup handed on as a page, whichever page opens it, is one path, and the layer shows it where it chooses.
- A page at an address it may not show closed at once. A page made at a refused address and a page later asked to load one would come to two answers; a load refused leaves the page as it was, whichever load it is.
- A popup with no press. A site would open pages a person never asked for, as browsers block.
- A blank popup opened outside the app as its address. It hands a person's browser an empty page, and the site that writes into it loses it.
- A popup not taken dropped. A site whose popup is its own page would lose it; its address opened outside the app reaches it.
- A load that fails told as an event of the delegate's, `didFailLoad`. A layer that draws a page from its `state` would hold a second account of the page beside it, and one that sets the delegate after the failure would never learn of it.
- A failure told with the code its web gives. Each implementation's web has its own codes, and the layer would say one thing on one and another on the next; the kinds are the few the layer says apart.
- `back()` from a failure through the page's history. The page that failed is no entry of it, so `back()` would skip the page the person was on and go to the one before.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The 5 seconds a press lets a popup open: no input of [the case format](../DECKIT-1/SPEC.md) waits a set time, and the cases hold only that a press opens one popup and no press none. `activates` `false`, a press that asks for the popup behind: the case format's press asks for nothing behind. A popup taken being a page laid in the mod's page: no step reaches the page handed to the delegate. A file loaded by `load(url)`, and `system.files` read at each load while a mod runs: a case hands a call no file's address, and grants no permission while a mod runs; the cases show a file as the page is made, for a mod granted `system.files` and for one granted nothing. The mod's own page opening an address outside the app: no input of the case format has the mod's page navigate. `ENDED`: the host's layer of the case format is offered the pages on the base `web` alone, where no lifecycle of a run ends while another runs. `forward()`, `reload()`, `stop()`, `find`, `stopFind`, `focus()`, `element`, `didFocus`, `didFind`, `didRequestClose`, `capture` and `audible`: the case format takes no keyboard, plays no sound and reads nothing a page draws, and the cases read `back()` and `mute(on)` of the same kind. `title` of `window`: what the host shows a page apart with is the host's. A member the delegate does not hold, or one that throws, answered its default: the host's delegate holds each member a case reads, and throws nothing.

**Note.** Of a load that fails, the cases hold `refused`, at a site of the case that refuses the connection, its `url`, that a load that shows what it gets makes `failure` `null`, and `back()` from a failure. No case holds the other kinds: a case's host reaches the loopback address alone, where a name is never not found, a connection is never lost and every host answers at once or refuses. Nor a load stopped, replaced, become a download, or whose document ended before it was whole, each of which no site of the case can hold apart in time from one that loads; nor a certificate refused, which a case's sites, served over HTTP, never send; nor `reload()` of the address that failed, as a site that refuses refuses for the whole run.

**Note.** What this costs an implementation: each load asked by the layer held to the table of *What a page loads*, read at each load; a press remembered for each page and used up by the popup it opens; every popup handed on as a page, but a file page's; a delegate whose every member may be missing or may throw; each load of a page's main frame that ends with no answer told as its failure, by kind, until a load shows what it gets, with what the page showed kept for `back()`; and every page closed with the lifecycle it was offered for.

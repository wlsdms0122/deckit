# DECKIT-28: Downloads

Status: draft
Area: web

## Summary

A site a mod's web page shows downloads files, as a site does in a browser: a link to download, an attachment, an answer the page cannot show. This DECKIT fixes what a download is, how the delegate of the page is asked whether to save it with `shouldDownload({ url, name, mimeType, expected })`, where it is written, in the host's downloads folder under the name the site gives it, numbered where the name is taken, what the web engine keeps of each download, across starts and up to its bound, and the members `downloads.list()`, `downloads.onChange(listener)`, `downloads.cancel(id)`, `downloads.remove(id)` and `downloads.open(id)` of the handle `web`, through which the mod reads, stops, forgets and opens its own downloads and never another mod's. A mod's downloads are erased with it, and the files they wrote stay.

## Motivation

A mod that shows sites, such as a browser, asks a person where a download goes, lists what its pages downloaded and opens a file once it is there:

```js
page.delegate = {
    shouldDownload: ({ name, expected }) => this.confirm(`Save ${name}?`, expected),
};
web.downloads.onChange((download) => this.show(download));
const [last] = await web.downloads.list();
if (last?.state === "finished") await web.downloads.open(last.id);
```

A download writes a file of the person's, outside every mod's storage, so it is the web engine's to decide under every layer over it and in every mod. Each of these is a download two implementations could answer differently without a rule:

- A site's link downloads `report.pdf` twice. One implementation writes over the first file; another writes `report (2).pdf`; a third refuses the second.
- The delegate holds no `shouldDownload`. One implementation saves the download, as a browser does; another drops it, and a mod that never showed a prompt loses every download.
- A mod quits while a download is under way, and the host app quits. On one implementation the download is listed `downloading` forever after the next start; on another it is listed as failed; on a third it is gone.
- mod-b hands `downloads.remove` an id of mod-a's download. One implementation forgets mod-a's download; another answers `false`.
- A mod removes its downloads with `erase`. One implementation deletes the files its pages downloaded from the person's folder; another leaves them.

## Rules

### A download

A **download** is a load in a web page, as [web pages](../DECKIT-25/SPEC.md) fix a page, its main frame's or a frame's, that the web engine writes to a file instead of showing:

- a link with the attribute `download` the page follows, to an address of the web, a `blob:` or a `data:` address;
- an answer whose header `content-disposition` says `attachment`;
- an answer of a type the engine does not show.

A download needs no user activation: one a script starts is one as a press starts it. A popup's load is a download of the popup's page, once its delegate takes it, under *Popups* of [web pages](../DECKIT-25/SPEC.md); a popup no delegate takes downloads nothing.

A download is the mod's whose page shows the web page that started it, as [web pages](../DECKIT-25/SPEC.md) fix the mod's page, and stays that mod's whatever becomes of the web page. It is the mod's and not a session's: a download of a page in any session of the mod is listed alike.

### Asked of the delegate

Before a download is written, the delegate of the page whose load it is, as [web pages](../DECKIT-25/SPEC.md) fix a delegate, is asked by its member `shouldDownload(download)`, `download` a table:

| key | value |
|---|---|
| `url` | string: the address downloaded |
| `name` | string: the name it is written under, under *Where it is written*, before it is numbered |
| `mimeType` | string: the type the answer says it is, the empty string where it says none |
| `expected` | number: the length in bytes the answer says it holds, `-1` where it says none |

The delegate answers a value, or a promise of one. Only `false` refuses the download: nothing of it is written, it is not listed and the mod is not told it. Any other answer saves it. A delegate that does not hold the member, as a function, or that throws, or whose promise rejects, is answered its default, `true`, as [web pages](../DECKIT-25/SPEC.md) answer a delegate member's default. The download waits for the answer, for as long as it takes; where the page closes before the delegate answers, it is not saved.

A download that fails before it is asked, its answer never come, is not asked: it is listed `failed`, under the last segment of its address's path.

### Where it is written

A download is written in the host's **downloads folder**: the folder where the host keeps the downloads of the person who runs the app, which the host hands the web engine as it stacks it, as [the web engine](../DECKIT-23/SPEC.md) fixes it. Its file holds the bytes of the answer, whole.

Its **name** is the name the site gives it: the value of the link's `download`, where it is not empty; else the filename of the answer's `content-disposition`; else the last segment of the address's path. It is made the name of a file of the folder as the engine underneath makes one, as the web platform leaves that to the user agent: one segment, with no `/`, that does not start with `.` and is not empty, `download` where nothing is left.

Where a file of the folder has the name, or a download under way is writing one of it, the download takes the least `n`, from 2, for which `stem (n)extension` is free, `extension` the name's from its last `.`, the empty string where it holds none or starts with it, and `stem` what is before. A file of the folder is never written over.

### A download listed

The web engine keeps each download of a mod, across starts of the host app, as a table:

| key | value |
|---|---|
| `id` | string: the download's, which the web engine gives it, the id of no other download of the mod |
| `url` | string: the address downloaded |
| `name` | string: the name of its file, numbered |
| `path` | string: the absolute path of its file, in the downloads folder |
| `state` | string: one of the states below |
| `received` | number: the bytes it has written |
| `expected` | number: the length in bytes the answer says it holds, `-1` where it says none |
| `error` | string: why it failed, as the implementation says it, for `failed`; else the empty string |
| `started` | number: when it started, in milliseconds since 1970-01-01 00:00 UTC |

| state | what it is |
|---|---|
| `downloading` | it is under way: its file is being written |
| `finished` | its file was written whole |
| `failed` | it stopped before its file was written whole, for a reason not the mod's |
| `cancelled` | the mod stopped it with `cancel` |

A download is listed from the moment it has a file, once `shouldDownload` saved it, or, one that fails before it is asked, as it fails. It leaves `downloading` once, for one of the other three, which it keeps. A download under way as the host app quits is `failed` from then on.

As a download starts, the web engine keeps the last **100** downloads of the mod to have started, this one among them, and each older one still under way, and no other.

**Note.** The bound keeps a mod that downloads for years from keeping every record; one under way is kept past it so that a mod never loses a download it is still showing.

### The handle's downloads

These members of the handle `web`, as [the web engine](../DECKIT-23/SPEC.md) lists them, reach the downloads of the mod whose lifecycle the handle was handed to, and of no other mod:

| member | takes | answers |
|---|---|---|
| `downloads.list()` | nothing | an array of each download of the mod, as *A download listed* writes one, newest first |
| `downloads.onChange(listener)` | `listener`, a function, required | a function that removes `listener` |
| `downloads.cancel(id)` | `id`, a string, required | nothing, once the mod's download `id`, where it is under way, is stopped |
| `downloads.remove(id)` | `id`, a string, required | `true`, once the mod's download `id` is no longer listed, or `false` where the mod has no download `id` |
| `downloads.open(id)` | `id`, a string, required | `true`, once the file of the mod's download `id` is handed to open outside the app, or `false` where the mod has no download `id`, or it is not `finished` |

`list`, `cancel`, `remove` and `open` are requests, as [the handle](../DECKIT-7/SPEC.md) fixes a request through a framework's handle. `system.file-handlers`, as [opening outside the app](../DECKIT-8/SPEC.md) defines it, guards `open`; no permission guards the others, nor a download. A request of them is refused with the first of these that is so, and nothing of it is done:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`;
2. at `call` with kind `INVALID_ARGUMENT`, where `id` is not a string;
3. at `call` with kind `ENDED`, where the handle `web` is cut, as [the web engine](../DECKIT-23/SPEC.md) cuts it as its lifecycle ends;
4. for `open`, as `openExternal` of [opening outside the app](../DECKIT-8/SPEC.md) refuses the file's address.

`onChange(listener)` is not a request: it adds `listener` in the lifecycle whose handle it is called on, and answers at once a function that removes it. It throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one: at `call` with kind `INVALID_ARGUMENT`, where `listener` is not a function, and then at `call` with kind `ENDED`, where the handle `web` is cut; it then adds nothing. `listener` is called with a download of the mod, as `list()` answers one, whole, each time it changes: as it is first listed, as what it received changes, and as it leaves `downloading`, the last call with it in its last state. It is called in the mod's run that is `running`, as [the lifecycle](../DECKIT-5/SPEC.md) fixes the states of a run; a run in any other state is told nothing. It is removed once the function it answered is called, or once the lifecycle ends.

`cancel(id)` stops the mod's download `id` while it is `downloading`: it is `cancelled`. Of any other id, a download of the mod no longer under way among them, it does nothing.

`remove(id)` forgets the mod's download `id`, stopped first where it is under way: it is no longer listed, and the mod is not told of it again. The file it wrote stays.

`open(id)` opens the file of the mod's download `id`, once `finished`, outside the app, as `openExternal` of [opening outside the app](../DECKIT-8/SPEC.md) opens the `file` URL of its `path` for the mod, with `activates` `true`.

### Kept and erased

The downloads of a mod are what [the web engine](../DECKIT-23/SPEC.md) keeps of it under *What the web engine keeps of a mod*, and are erased with it as that DECKIT erases what it keeps: each download under way is stopped, none is listed, and the files they wrote stay where they were written.

**Note.** The file is the person's, in the folder the person keeps downloads in, and stays there as the mod goes, as a browser removed leaves what it downloaded; the list, which the mod shows, is what the mod kept.

## Interactions

- The handle `web` and its members, a lifecycle's handle cut and `ENDED`, what the web engine keeps of a mod, `kept` and erasing it, the web engine a host stacks and the downloads folder it hands it: [the web engine](../DECKIT-23/SPEC.md).
- A web page, its frames, its delegate, a member missing or throwing answered its default, a popup taken and a page closed: [web pages](../DECKIT-25/SPEC.md).
- `openExternal`, a `file` URL opened for the mod, `activates` and `system.file-handlers`: [opening outside the app](../DECKIT-8/SPEC.md).
- A request, a value, an error with a stage and a kind, `INVALID_ARGUMENT`, and a member that throws its refusal: [the handle](../DECKIT-7/SPEC.md). `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- A run `running`: [the lifecycle](../DECKIT-5/SPEC.md). A lifecycle and its end: [the entry](../DECKIT-6/SPEC.md).
- `remove` answering `false` for what the mod does not hold, as `remove(id)` of [notifications](../DECKIT-19/SPEC.md) does.
- `remove` with `erase`: [the catalog](../DECKIT-4/SPEC.md). `mods.usage(id)` and `kept`: [the storage](../DECKIT-13/SPEC.md) and [the embedding](../DECKIT-22/SPEC.md).
- The host's downloads folder as the case format sets it up, the look `downloaded`, the key `answered` of a `call`, and the folder read back in what a step answers: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- A permission that guards a download, or the list. A site downloads in every browser unasked, to the folder the person keeps downloads in, and a mod that shows sites would ask for it always; what reaches outside the app, a file opened, is guarded, by `system.file-handlers`.
- Only `true` from `shouldDownload` saving. A delegate that forgot the member, or answers late with nothing, would lose every download a site starts; a browser saves unasked, and `false` is how a mod says no, as `shouldLeave` of [web pages](../DECKIT-25/SPEC.md) keeps an address in.
- A time limit on `shouldDownload`. A mod that asks a person where to save waits on the person, who takes as long as they take; the download waits, as a site's ask waits in [what a site is let have](../DECKIT-26/SPEC.md).
- A name taken written over. A second download of one name would lose the file of the first, which is the person's.
- The site's name used as given. A name with `/` or `..` would write outside the downloads folder, and one that starts with `.` would be hidden from the person.
- `remove` and `open` refusing an id the mod does not hold with a kind of their own. What the mod reads is that there is no such download, which `false` says, as `remove(id)` of [notifications](../DECKIT-19/SPEC.md) answers it; a kind would tell a mod an id another mod holds from one nobody holds.
- `cancel` answering whether it stopped anything. A download may finish between the mod's read and its call, and the state the mod is told says what became of it.
- The downloads a session's, cleared with it. A person who clears a session to sign out of a site would lose the list of what they downloaded; a download is the mod's.
- Every download kept, or only those of the last start. A mod that downloads for years would keep records without end, and a mod that shows a list would lose it at each start; the last 100 are what a browser's list shows.
- A download under way as the app quits listed as it was. It would read `downloading` forever, for a file no one writes; `failed` says what became of it.
- `onChange` told to every run of the mod, or to the first found. A run that is not `running` has no code to hear it, and the run that is `running` is the one that shows it.
- The files erased with the mod. A file a site downloaded is the person's, which the person opens and moves, and not what the mod stored.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. A download under way: a site of [the case format](../DECKIT-1/SPEC.md) answers whole at once, so no case cancels, removes, erases or quits while one is under way, and none reads the `downloading` state in a list or a name taken by a download being written; the cases hold `cancel` of a download finished and the listener's last call. A delegate that throws, whose promise rejects or answers late, and a page closed while it is asked: the host's delegate answers a value, and no input closes a page before it answers. A download that fails before it is asked: no site of the case format fails to answer. The name made a file's name, past the cases' plain names: the web platform leaves it to the user agent, and an implementation on another engine makes another name of a site's `a/b.txt`. `started` and `error`: a step compares no time and no message. `ENDED`: no base of the case format ends a lifecycle while the run goes on, as [the web engine](../DECKIT-23/SPEC.md) says. That a mod's downloads name `web` under `kept`: the page that downloads uses a session, which names it already.

**Note.** The case of the bound lays each of its 101 downloads in a frame of its own. On the engine underneath here, a load of a frame that a later load of the same frame replaces before it becomes a download is none, so of links a script follows one after another in one frame only some download, the last among them.

**Note.** What this costs an implementation: a question to the mod before each download, with no time limit; a file name of the folder never written over, a download under way counted as a file; a record of each download of each mod, written as its state changes and kept across starts, the last 100 and every one under way; a download under way as the app quits marked failed as it starts again; the mod's running run told each change; and every member held to the mod's own downloads, so that an id another mod holds answers as an id nobody holds.

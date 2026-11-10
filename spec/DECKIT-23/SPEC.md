# DECKIT-23: The web engine

Status: draft
Area: web

## Summary

The web engine is the layer that lets a mod reach the web: it keeps a mod's web sessions, fetches through them, shows web pages in them, decides what a site is let have, and keeps the downloads its pages start. A host stacks it over the system as a framework, as [the entry](../DECKIT-6/SPEC.md) fixes one, and it hands every lifecycle of every mod the handle `web`, in the table `frameworks`, made for that lifecycle and cut as it ends. This DECKIT fixes what the web engine is on a host, the handle `web` as a whole and the DECKIT of the web engine's that fixes each member, sessions (their names, how they are kept apart, `session(name)`, `name` and `clear()`, and a session handle cut with its lifecycle), what the web engine keeps of a mod and how it is erased, and the four permissions the web engine defines. [Fetching](../DECKIT-24/SPEC.md), [web pages](../DECKIT-25/SPEC.md), [what a site is let have](../DECKIT-26/SPEC.md) and downloads are the web engine's other DECKITs'.

## Motivation

A mod that shows a site signed in, syncs a feed or keeps what a page downloaded is written once for every host, and reaches the web only through what its lifecycle is handed:

```js
class Mod {
    start(deckit, { web }) {
        this.session = web.session("main");
    }
}
```

The web engine is a layer a host may stack or not: a host with no web pages to show leaves it out, and a host with no GUI still fetches through it. So it is not the system's, whose members are on every handle, and not the shell's, which a host may run without. Each of these is a call two implementations could answer differently without a rule:

- `web.session("Main")` is answered on one implementation and refused on another; a name of 41 code points is cut to 40 on one and refused on another; `web.session(1)` throws an error with no kind on one and is refused with `INVALID_ARGUMENT` on another.
- mod-a and mod-b each take `web.session("main")`. One implementation keeps one store for the name, and mod-b's pages are signed in as mod-a's; another keeps one store for each mod.
- mod-a calls `web.session("main").clear()` before it ever fetched through it. One implementation records the session as used, and `mods.usage("mod-a").kept` names `web` for a mod that keeps nothing; another records nothing. A clear on one implementation takes back what the mod let a site have in the session, and on another leaves it.
- A layer over the web engine stacks a lifecycle for each window it shows. The lifecycle that took a session ends while the run goes on, and code it left still holds the session and calls `clear()`. One implementation clears the store, for a lifecycle that has ended; another refuses with a kind the mod can tell.
- A person removes a mod with `erase` and installs it again. On one implementation the sites it let have notifications still have them, and the certificates it trusted are still trusted; on another the mod finds nothing of what it had.
- A mod that asks for `system.network` reads one name and description for it on one host and another on another, and finds it before or after the system's own.

## Rules

### The web engine on a host

A host stacks the web engine over the system, as [the embedding](../DECKIT-22/SPEC.md) hands the layers it stacks, under the name `web`. The web engine has no lifecycle of its own, so it is a **framework**, as [the entry](../DECKIT-6/SPEC.md) fixes one: it hands every lifecycle of every mod's run its handle, `web`, in the table `frameworks`, under the key `web`, made for that lifecycle and cut as that lifecycle ends. A host that does not stack it hands no lifecycle `web`, and `frameworks` holds no key `web`.

Before the start, the web engine defines the permissions under *The web engine's permissions*, after the system's own, as [the permissions](../DECKIT-3/SPEC.md) order them. A host that does not stack it defines none of them, and a mod that asks for one there finds it not usable, as [the bundle](../DECKIT-2/SPEC.md) answers a permission no one defines.

The web engine offers a layer the host stacks over it what shows web pages in a mod's sessions, as [web pages](../DECKIT-25/SPEC.md) fix it. A layer under it is offered nothing of it.

### The handle web

`web` is a table of **members**, as [the handle](../DECKIT-7/SPEC.md) fixes members, and holds these:

| member | what it is | fixed by |
|---|---|---|
| `session(name)` | the handle of the mod's session `name` | here |
| `downloads.list()`, `downloads.onChange(listener)`, `downloads.cancel(id)`, `downloads.remove(id)`, `downloads.open(id)` | the downloads the mod's web pages started | the DECKIT of downloads |

A **session handle**, which `session(name)` answers, is a table of these members, through which the mod reaches one of its sessions:

| member | what it is | fixed by |
|---|---|---|
| `name` | string: the session's name | here |
| `clear()` | the request that takes what the session stored | here |
| `fetch(url, init)` | the request that fetches an address through the session | [fetching through a session](../DECKIT-24/SPEC.md) |
| `allow(entries)`, `revoke(entries)` | what the mod lets a site have in the session, and takes back | [what a site is let have](../DECKIT-26/SPEC.md) |
| `trust(entries)` | the certificates the mod trusts in the session | [what a site is let have](../DECKIT-26/SPEC.md) |

Every member is on the handle `web` of every lifecycle, whatever the mod is granted. A request a permission guards, made by a mod not granted it, is refused as [the permissions](../DECKIT-3/SPEC.md) say, and its member is on the handle all the same. A member that is a request is one as [the handle](../DECKIT-7/SPEC.md) fixes a request through a framework's handle, and is refused first as the handle refuses one. A member the table leaves to another DECKIT takes, answers and is refused as that DECKIT fixes.

### Sessions

A **session** is where the web engine keeps what a mod's web pages and requests store of the web: their cookies, the storage their sites keep, and their cache. A mod has as many sessions as it names, and each is named by this grammar:

```
session-name = ( lower / DIGIT ) *39( lower / DIGIT / "-" )
lower        = %x61-7A                      ; a to z
```

A session is the mod's and its name's. Two mods' sessions of one name are two sessions, which share nothing of what they store, and two sessions of one mod with two names are two as well. A mod reaches only its own sessions.

`session(name)` is not a request: it answers at once a session handle of the session `name` of the mod whose lifecycle the handle `web` was handed to, and throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one.

| takes | type | required | what it is |
|---|---|---|---|
| `name` | string | yes | the session's name, a `session-name` |

It is refused at `call` with kind `INVALID_ARGUMENT`, where `name` is not a string or not a `session-name`. Called again with the same `name` on the same handle `web`, it answers the same session handle; called with another name, another.

`name`, a member of a session handle, holds the `name` it was answered for, and is read as a value.

A mod **uses** a session as it fetches through it, as [fetching through a session](../DECKIT-24/SPEC.md) fixes it, or as a web page is shown in it, as [web pages](../DECKIT-25/SPEC.md) fix it. A session it used stays one it used as the host app quits and starts again, until the mod is erased, under *What the web engine keeps of a mod*. No other member of a session handle uses it.

### clear()

`clear()`, a member of a session handle, is a request. It takes nothing, and answers nothing, once what the session stored is taken: its cookies, the storage its sites keep, and its cache. It takes nothing else: what the mod let a site have in the session and the certificates it trusted there stay, as [what a site is let have](../DECKIT-26/SPEC.md) keeps them, and a session the mod used stays one it used. Of a session the mod never used, it takes nothing, and the session stays one the mod never used.

No permission guards it.

### A session cut

A session handle is **cut** as the lifecycle ends that the handle `web` which answered it was made for, as [the entry](../DECKIT-6/SPEC.md) cuts a framework's handle. A request through a session handle that is cut is refused with the first of these that is so, and nothing of it is done:

1. as [the handle](../DECKIT-7/SPEC.md) refuses a request, at `call` with kind `NOT_PERMITTED` and then `INVALID_ARGUMENT`;
2. at `call` with kind `ENDED`;
3. as the DECKIT that fixes the request refuses it.

A session handle cut takes nothing of the session: the session handle that the handle `web` of a lifecycle still running answers for the same name reaches the same session, and is not cut.

**Note.** A lifecycle a layer stacks for each window it shows ends while the mod's run goes on, and what its code left, a timer or a promise, may still hold the session handle it took. The refusal tells that code that its lifecycle has gone, rather than doing for it what no lifecycle asked.

### What the web engine keeps of a mod

The web engine keeps these of a mod, outside the mod's records, values and data folder:

| what | fixed by |
|---|---|
| each session the mod used, with what it stored | here, under *Sessions* |
| the downloads the mod's web pages started | the DECKIT of downloads |
| what the mod let a site have, in each of its sessions | [what a site is let have](../DECKIT-26/SPEC.md) |
| the certificates the mod trusted, in each of its sessions | [what a site is let have](../DECKIT-26/SPEC.md) |

Where it keeps any of them of a mod `id`, `mods.usage(id)` names `web` under `kept`, as [the embedding](../DECKIT-22/SPEC.md) and [the storage](../DECKIT-13/SPEC.md) fix it. [The catalog](../DECKIT-4/SPEC.md)'s `remove` with `erase` true erases all of them: what each session stored is taken, as `clear()` takes it, and no session is one the mod used; each download under way is stopped and none is listed, and the files the downloads wrote stay where they were written; nothing the mod let a site have is had; and no certificate is trusted for it. What the web engine keeps of every other mod stays as it was.

**Note.** A file a download wrote is the person's, in the folder a person keeps downloads in, and is not what the mod stored; the list of downloads, which the mod shows, is.

### The web engine's permissions

The web engine defines these permissions, in a table of the shape [the permissions](../DECKIT-3/SPEC.md) give the system's own, in this order:

| id | name | description | privileged |
|---|---|---|---|
| `system.files` | `Files` | `It can open files in its own pages, where it can read what they hold.` | `false` |
| `system.network` | `Network` | `It can read any address on the web or your network, past the rules that keep one site from reading another.` | `false` |
| `system.certificates` | `Certificates` | `It can accept a certificate that cannot be verified, for one site, so that site's pages load.` | `false` |
| `system.site-permissions` | `Site Permissions` | `It can let a site's pages use the camera, the microphone, notifications, your location, the apps links open in and, as far as its clipboard permissions reach, what you copied, and take that back.` | `false` |

Each guards what this table names and nothing else, as [the permissions](../DECKIT-3/SPEC.md) say a permission guards what the DECKIT that defines it names:

| id | guards |
|---|---|
| `system.files` | a file loaded in the mod's own web page, as [web pages](../DECKIT-25/SPEC.md) fix what loads |
| `system.network` | `fetch(url, init)`, as [fetching through a session](../DECKIT-24/SPEC.md) fixes it |
| `system.certificates` | `trust(entries)`, as [what a site is let have](../DECKIT-26/SPEC.md) fixes it |
| `system.site-permissions` | `allow(entries)` and `revoke(entries)`, and whether the mod is asked what a site is let have, as [what a site is let have](../DECKIT-26/SPEC.md) fixes them |

**Note.** None is privileged: what each grants is what a person reads before installing the mod. The ids start with `system.` as the system's permissions of the machine do, since what each reaches lies outside the app: the web, the files on the machine, the camera.

## Interactions

- The layers a host stacks, a framework, `frameworks`, a lifecycle and its end, and a framework's handle made for each lifecycle and cut as it ends: [the entry](../DECKIT-6/SPEC.md).
- Members, a request, values, the error a request is rejected with, `INVALID_ARGUMENT`, the order a request is refused in, and that a request through a framework's handle is the run's: [the handle](../DECKIT-7/SPEC.md).
- A permission defined, asked for, answered usable or not: [the bundle](../DECKIT-2/SPEC.md). What a mod is granted, `NOT_PERMITTED`, what a permission guards, the shape of a table of permissions and the order a layer's come in: [the permissions](../DECKIT-3/SPEC.md).
- `remove` with `erase`: [the catalog](../DECKIT-4/SPEC.md). `mods.usage(id)` and `kept`: [the storage](../DECKIT-13/SPEC.md). What a layer a host stacks owes of what it keeps of a mod: [the embedding](../DECKIT-22/SPEC.md).
- The layers a host hands the system before the start, each by its name: [the embedding](../DECKIT-22/SPEC.md).
- The base `web`, the host that stacks the web engine, and the key `handle` of the input `call`, which reads `web`: [the case format](../DECKIT-1/SPEC.md).
- `fetch`, the cookies it sends and keeps in a session, and the session it uses: [fetching through a session](../DECKIT-24/SPEC.md).
- Web pages and what loads in them: [web pages](../DECKIT-25/SPEC.md).
- What a site is let have with `allow` and `revoke`, and the certificates `trust` trusts: [what a site is let have](../DECKIT-26/SPEC.md).
- Downloads: the web engine's DECKIT of downloads.

## Alternatives considered

- The web engine's members on the handle `deckit`. Every host would carry the web, and a host with no web pages would answer every one of them with a refusal; a framework is what a host stacks or leaves out, and a mod reads `frameworks.web` where it is.
- Sessions named by any string. A session's store is named by its name on an implementation that keeps one store for each, and a name that names two stores on one and one on another would be kept apart on one and confused on the other; a name of one grammar is the same everywhere, as a record's key is in [the storage](../DECKIT-13/SPEC.md).
- Sessions shared between mods by their names. A mod would read the cookies another mod's pages were signed in with; a mod reaches only what it is given.
- `session(name)` as a request. A mod hands a session to the page it shows in the same pass as it takes it, and a promise would leave it waiting for what has nothing to wait for; it answers at once, as `about()` does.
- One handle `web` for the whole run. A request a lifecycle left behind would still be done once that lifecycle ended; [the entry](../DECKIT-6/SPEC.md) makes a framework's handle for each lifecycle and cuts it as it ends.
- A cut session refused like any other request, with no kind of its own. Code a lifecycle left behind would read `INVALID_ARGUMENT` for arguments it handed right; `ENDED` says what is so.
- `clear()` taking what the mod let a site have and the certificates it trusted. A person who clears a session to sign out of a site would be asked again for every camera and notification; what a site is let have is taken back by `revoke`, and all of it as the mod is erased.
- A session recorded as used as it is cleared. A mod that clears its sessions as it starts, to begin signed out, would be named under `kept` while it keeps nothing.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That the handle is made for each lifecycle and cut as it ends, a session handle cut, and the refusal `ENDED`: no base of [the case format](../DECKIT-1/SPEC.md) ends one lifecycle of a run while another runs, and a case's lifecycles last as long as its run. That a session holds the storage its sites keep and its cache, and that `clear()` takes them: a page the case format shows is read by its state and by the requests its sites get, and no input reads what its sites keep or what its session cached. A session's cookies are read through a fetch: a case here holds that `clear()` takes them, and the cases of [fetching through a session](../DECKIT-24/SPEC.md) hold that two sessions share none, of one mod or of two mods of one name; the cases here hold the sessions of two mods kept apart by what the web engine keeps of each, and what `clear()` leaves. That a session the mod used stays one it used across starts, and is erased: the cases of fetching through a session read a session used within one start, and no case reads one after a start or an erase. The downloads kept and erased: the cases of the DECKIT of downloads hold them; the certificates trusted, kept and erased: the cases of [what a site is let have](../DECKIT-26/SPEC.md). What the web engine offers a layer over it: the cases of [web pages](../DECKIT-25/SPEC.md) hold it, on the host's layer over the web engine. What each permission guards: the DECKIT that fixes what it guards holds it, but for `system.site-permissions`, which a case of this DECKIT holds through `allow`.

**Note.** What this costs an implementation: one store for each mod and session name, never shared; a session handle remembered for each lifecycle, cut as the lifecycle ends; a record of the sessions each mod used, kept across starts, which `clear()` leaves and erasing takes; and, as a mod is erased, every place the web engine keeps anything of it emptied, its sites' allowances and the certificates it trusted among them, even where they are kept only until the app quits.

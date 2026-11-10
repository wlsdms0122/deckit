# DECKIT-26: What a site is let have

Status: draft
Area: web

## Summary

A site a mod's web page shows asks for what the web platform names by a permission name, such as `notifications` or `camera`, and goes to addresses an app on the machine opens, such as `mailto:`. The web engine decides each of them for the mod, alike on every host: this DECKIT fixes the rules a site's ask meets and the names under each, how the mod is asked with `system.site-permissions` and answers through the delegate's `decidePermission`, `allow(entries)` and `revoke(entries)` of a session handle and the names they take, the app for an address, what a site reaches of the clipboard beside `system.clipboard-read` and `system.clipboard-write`, a certificate the system cannot verify and `trust(entries)` with `system.certificates`, and how long what a site was let have and a certificate trusted last. A site's notifications and its downloads are the web engine's later DECKITs'.

## Motivation

A mod that shows sites, such as a browser, asks a person what a site may have, keeps the answers, and hands them back as it starts:

```js
page.delegate = { decidePermission: ({ origin, permissions, app }) => ask(origin, permissions, app) };
await web.session("main").allow([{ origin: "https://example.com", permission: "notifications" }]);
```

What a site reaches is the web engine's to decide, under every layer over it and in every mod, since a site is no mod and reaches the machine only as the web engine lets it. Each of these is a call or a page two implementations could answer differently without a rule:

- A site asks for `camera`. One implementation asks the mod showing it, another lets it have the camera, a third refuses it; and on one a mod granted nothing is asked all the same.
- `allow([{ origin: "https://example.com/", permission: "camera" }])` is taken on one implementation, which reads the origin of the address, and refused on another; `allow` with an entry `open:mailto` is refused on one, which knows only the names a site asks for, and the mod that hands back every answer it kept in one call loses them all.
- A site's link to `mailto:a@example.com` starts the mail app at once on one implementation, asks the mod on another, and is dropped on a third.
- A site of a mod granted nothing writes what a person then pastes in any app on one implementation, while the mod itself may not; on another it may not either.
- A site's certificate the machine cannot verify loads on one implementation once the mod trusts it, and on another only after the mod shows the page again; one reads a fingerprint as one text and another as another, and what a mod kept is trusted on neither.
- A mod lets a site have notifications, and the host app quits and starts. On one implementation the site still has them, and on another it is asked again.

## Rules

### What a site asks for

A site asks for what it may have by the **names** the web platform gives each in the Permissions API. Each name meets one **rule**, and a name of no row meets the rule `refuse`:

| rule | names | a site that asks for it | a site that checks it |
|---|---|---|---|
| `ask` | `notifications`, `clipboard-read`, `geolocation`, `microphone`, `camera` | is asked of the mod, under *Asking the mod* | has it where the mod let the site have it with `allow`, under *allow and revoke* |
| `allow` | `fullscreen`, `clipboard-write`, `pointer-lock`, `keyboard-lock`, `encrypted-media` | is let have it, unasked | has it |
| `checked` | `local-network-access` | is refused it, unasked | has it |
| `refuse` | any other | is refused it, unasked | does not have it |

A name the system guards with a permission of its own is had by a site only while the mod whose page shows it is granted that permission: where it is not, the site is refused it unasked as it asks, and does not have it as it checks it, whatever its rule, whatever `allow` let it have and whatever the mod would answer.

| name | the permission of the system's |
|---|---|
| `clipboard-read` | `system.clipboard-read`, as [the clipboard](../DECKIT-20/SPEC.md) defines it |
| `clipboard-write` | `system.clipboard-write`, as [the clipboard](../DECKIT-20/SPEC.md) defines it |

A site's ask may hold more than one name. It is refused where it holds none, or where any name in it is refused; let through where every name in it is let through; and asked of the mod otherwise, all its names in one question.

A page's `capture`, as [web pages](../DECKIT-25/SPEC.md) fix its state, tells whether it takes the microphone or the camera it was let have, or the screen.

The **site** of an ask is the origin of the address of the page that shows it, as the URL Standard serializes the origin of an address of the web.

**Note.** The names are the web platform's, so a site's own code and a person who read a browser's settings mean the same thing by each. A name the system guards is guarded for the site as for the mod: a site the mod shows reaches through the mod, and reaches no further than the mod may.

### Asking the mod

An ask is put to the mod only where the mod is granted `system.site-permissions`, and the page that asked is still shown: else the site is refused it, unasked. An ask whose every name `allow` let the site have in the page's session is let through, unasked.

The mod is asked through the delegate of the page that asked, as [web pages](../DECKIT-25/SPEC.md) fix a delegate, by its member `decidePermission(question)`, `question` a table:

| key | value |
|---|---|
| `origin` | string: the site |
| `permissions` | array of strings: the names it asks for, in the order it asked, or the one name of an app, under *The app for an address* |
| `app` | string: the name of the app, for an app; the empty string otherwise |
| `url` | string: the address the app would open, for an app; the empty string otherwise |

The site is let have what it asked for where `decidePermission` answers `true`, or a promise of `true`; anything else it answers, a member the delegate does not hold, and one that throws or whose promise rejects refuse it. The question has no time limit. An ask the page makes while a question for the same page, site and names is unanswered joins it, and is answered as it is. A page that closes while it is asked is refused.

What the mod answers is not kept: the site is asked again as it asks again.

### allow and revoke

`allow(entries)` and `revoke(entries)`, members of a session handle, are requests. `allow` lets each site the entries name have each name they name in the session, and `revoke` takes it back. Each answers nothing. What it changes holds for each ask and check after it, of every page of the session, but that a page that had a name before `revoke` may go on having it until it loads again.

| takes | type | required | what it is |
|---|---|---|---|
| `entries` | array of tables `{ origin, permission }`, each a string | yes | the sites and what each is let have, or no longer |

`origin` is a site: the origin of an address of the web as the URL Standard serializes it, `http` or `https`, the host in lower case, and no port where it is the scheme's default. `permission` is a `site-permission`:

```
site-permission = ask-name / "open:" scheme
ask-name        = "notifications" / "clipboard-read" / "geolocation" / "microphone" / "camera"
scheme          = lower *( lower / DIGIT / "+" / "-" / "." )
lower           = %x61-7A                      ; a to z
```

the name of the rule `ask`, case-sensitive, or `open:` and the scheme of an app, under *The app for an address*, a scheme off the never list there. A key of an entry other than these two is not read.

`system.site-permissions` guards both. Each is refused first as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`, then at `call` with kind `INVALID_ARGUMENT`, where `entries` is not an array or any entry of it does not fit: then nothing of the call is done, the entries that fit among it. A session handle cut refuses them as [the web engine](../DECKIT-23/SPEC.md) fixes it.

What `allow` let a site have is the session's: another session of the mod, and another mod's session, are not changed by it. A site the mod let have a name had it before is let have it again; a name `revoke` takes back that the site was not let have changes nothing.

**Note.** A mod that keeps what a person answered hands it back with `allow` as it starts, all in one call, so `allow` takes every name a mod is asked for, the apps among them. An entry that does not fit refuses the whole call, so that a mod reads that its call was wrong rather than that some of it held.

### The app for an address

An address whose scheme is off the **never list** is the address of an **app**, the program on the machine the host knows opens addresses of that scheme. The never list holds the schemes of the web and of the web engine's own: `javascript`, `data`, `blob`, `file`, `filesystem`, `about`, `http`, `https`, `ws` and `wss`.

A page's own navigation to an address of an app, by a link or its script, and a popup at one, as [web pages](../DECKIT-25/SPEC.md) fix a popup, open no page. The address is asked of the mod as the name `open:` and its scheme, in lower case, with `app` the name the host gives the app and `url` the address as the URL Standard serializes it, as an ask of the rule `ask` is, under *Asking the mod*. Where the site is let have it, the address is handed the host to open outside the app, the app coming to the front, and the look `opened` of [the case format](../DECKIT-1/SPEC.md) answers it as `{ url, activates }`, `url` that address and `activates` `true`. Where the host knows no app for the scheme, nothing is asked and nothing opened.

**Note.** An app's address is handed to the host and not to the mod's `openExternal`, which [opening outside the app](../DECKIT-8/SPEC.md) keeps to the web and files: here a site asks for the app, and the mod lets it, by a question a person answers for that site and that app.

### A page's clipboard

A site reads the clipboard's text, as the web platform's `navigator.clipboard.readText()` and `read()` do, as the name `clipboard-read`, and replaces it, as `writeText(text)` and `write(items)` do, as the name `clipboard-write`. It reaches the clipboard [the clipboard](../DECKIT-20/SPEC.md) fixes, the one a mod's `clipboard.readText()` reads and `clipboard.writeText(text)` writes. What it may not have is refused with the web platform's `NotAllowedError`, and the clipboard is left as it was. An item written with no text, `text/plain`, is refused alike.

By the rules above, a site reads the clipboard only where its mod is granted `system.clipboard-read` and `system.site-permissions` and answers `true`, and writes it, unasked, only where its mod is granted `system.clipboard-write`.

**Note.** The camera, the microphone and the location have no permission of the system's, so `system.site-permissions` alone reaches them for a site.

### Certificates and trust

A page's load of an address of the web whose certificate the system cannot verify is refused, unless the certificate is trusted in the page's session for the address's host. The page's delegate is told `didRefuseCertificate(certificate)`, `certificate` a table:

| key | value |
|---|---|
| `url` | string: the address the page was loading |
| `host` | string: the address's host |
| `fingerprint` | string: `sha256/` and the SHA-256 digest of the certificate's bytes as DER, in base64 |
| `error` | string: why it could not be verified |
| `subject`, `issuer` | string: the names the certificate and its issuer give, the empty string where none |

`trust(entries)`, a member of a session handle, is a request. It trusts each certificate the entries name, by its host and fingerprint, in the session, and answers nothing; each page of the session refused under one of them loads again what it was loading.

| takes | type | required | what it is |
|---|---|---|---|
| `entries` | array of tables `{ host, fingerprint }`, each a string | yes | the certificates, each the host it is trusted for and its fingerprint as `didRefuseCertificate` tells it |

`system.certificates` guards it. It is refused first as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`, then at `call` with kind `INVALID_ARGUMENT`, where `entries` is not an array or any entry is not a table of the two strings: then nothing of it is done. A session handle cut refuses it as [the web engine](../DECKIT-23/SPEC.md) fixes it. A certificate trusted is the session's alone, as what `allow` lets have is.

### How long

What `allow` let a site have, and each certificate `trust` trusted, last until the host app quits, or until the mod is erased, as [the web engine](../DECKIT-23/SPEC.md) erases what it keeps of a mod. `clear()` of the session takes neither.

**Note.** A mod hands back what it keeps of them as it starts, in its own records, which a person reads and changes in it; the web engine keeps nothing a mod would have to read back to know.

## Interactions

- A session, a session handle, its cut, `clear()`, what the web engine keeps of a mod and its erasing, `kept`, and the permissions `system.site-permissions` and `system.certificates`: [the web engine](../DECKIT-23/SPEC.md).
- A page, its delegate and the members missing or throwing answered their default, a popup after a press, a page's navigation and what it opens outside the app: [web pages](../DECKIT-25/SPEC.md).
- The clipboard and `system.clipboard-read` and `system.clipboard-write`: [the clipboard](../DECKIT-20/SPEC.md).
- `openExternal` and the addresses it opens, and the look `opened`: [opening outside the app](../DECKIT-8/SPEC.md).
- What a mod is granted, `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md). A request, `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md).
- The apps the host has, the key `origins` of a call, the inputs `show` and `activate`, the host's delegate and the look `delegated`: [the case format](../DECKIT-1/SPEC.md).
- A site's notifications, which a site has as the name `notifications`, and its downloads: the web engine's later DECKITs.

## Alternatives considered

- Every name asked of the mod. A site that goes full screen or locks the pointer on a press would wait on a question no browser asks; the rule `allow` is what a browser lets a site have.
- A yes the mod answers kept by the web engine. Which answers last, and which a person can take back, would be the web engine's, and a mod could not show what it keeps; the mod keeps what it chooses and hands it back with `allow`.
- `allow` taking any string, or skipping an entry that does not fit. A misspelt name would be kept as if it held and never asked for; a whole call refused tells the mod its call was wrong.
- `allow` taking only the names of the rule `ask`. A mod that keeps the apps a person let a site open could not hand them back, and one call holding one would lose every answer.
- `allow` and `revoke` answering how many sites are let have something. A mod would read how much other mods let sites have.
- An app's address opened as `openExternal` of the mod. `openExternal` refuses a scheme other than the web's and `file`; a site that asks for an app reaches it only through a question a person answers.
- A site's clipboard left to the engine underneath. A site of a mod granted nothing would write what a person pastes in any app, which the mod itself may not, and two implementations would ask a person on screens of their own.
- The camera, the microphone and the location under permissions of the system's. The system defines none for them, since no request of a mod's handle reaches them; `system.site-permissions` is the one a person reads for them.
- What a site was let have and the certificates trusted kept across starts by the web engine. The mod keeps them already, as it keeps what a person answered, and hands them back; two copies would disagree as a person changes one.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The camera, the microphone and the location: the case format reads no device of the machine, and a site's ask for one waits on the machine. The names of the rules `allow` but `clipboard-write`, and `checked`: no input of the case format goes full screen, locks a key or the pointer, plays protected media or reaches a local network. `capture`: no case takes a device. A page that had a name before `revoke` going on having it: no case revokes while a page is shown. A question joined, and a page closed while it is asked: no input closes a page before the delegate answers. A delegate member missing or throwing: the host's delegate holds each member a case reads, and throws nothing. `read()` and `write(items)` of the clipboard: the cases read and write it by text. A certificate refused, `didRefuseCertificate` and a page loaded again once `trust` trusts its certificate: the case format serves its sites over HTTP alone, and a site served with a certificate would need one the runner makes or a case carries, with its fingerprint written in the case; the cases hold the refusals of `trust` and that what it trusts is kept, and no case loads a page under a certificate. That `allow`, `revoke` and `trust` answer nothing: the case format compares no answer of a request that answers nothing.

**Note.** What this costs an implementation: each ask held to the table of rules and to the permissions of the system's at the moment it is asked; a question for each page, site and names, joined and refused as its page closes; the site's clipboard routed to the clipboard the mod's handle reaches, whatever the engine underneath does with the web platform's; an app's address asked by its scheme and handed to the host; the fingerprint computed as this DECKIT writes it; and what a site was let have and the certificates trusted held for each mod and session, until the host app quits or the mod is erased.

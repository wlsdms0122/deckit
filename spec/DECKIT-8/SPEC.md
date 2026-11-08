# DECKIT-8: Opening outside the app

Status: draft
Area: system

## Summary

A mod hands the host an address to open outside the app with `openExternal(url, options)`, a member of [the handle](../DECKIT-7/SPEC.md). This DECKIT fixes the request: what it takes, the addresses it hands the host and how it hands each, an address of the web and a file, with whether the app that opens it comes to the front, and how it is refused. It defines the permission `system.file-handlers`, which guards the request for a file, and fixes what the look `opened` of [the case format](../DECKIT-1/SPEC.md) answers of each address handed.

## Motivation

A mod written once for every host opens a page of the web, and a report it wrote, in the apps a person opens them with:

```js
await deckit.openExternal("https://example.com/a", { activates: false });
await deckit.openExternal("file:///data/report.pdf");
```

The request is handled inside the system, so a host cannot make two implementations agree on it. Each of these is a call two implementations could answer differently without a rule:

- `deckit.openExternal("HTTP://Example.COM")` is handed on as written on one, as `http://example.com/` on another, and refused on a third, which reads a scheme in lower case only.
- `deckit.openExternal("mailto:a@example.com")` starts a mail program on one, and is refused on another. A mod that hands on whatever address it is given starts programs on the first that the person never named.
- The second call above, made by a mod granted nothing, opens the report on one implementation, whose apps can start programs from it, and is refused on another.
- The first call leaves the browser behind on one implementation, and brings it to the front on another, which keeps `activates` for a file only, or for no address.
- `deckit.openExternal("file://elsewhere/report.pdf")` names a file on the host `elsewhere`, and opens the file at `/report.pdf` where the app runs on one implementation, and is refused on another.
- `deckit.openExternal("file:///data/report%zz.pdf")` opens the file `/data/report%zz.pdf` on one implementation, which keeps a `%` that two hexadecimal digits do not follow as it is, and fails with no kind on another, whose decoding throws.

Which of these a mod may do is what a person reads before installing it, so the permission that guards a file, its name and its description are the system's to define, alike on every host.

## Rules

### The request openExternal

`openExternal(url, options)` hands the host an address to open outside the app:

| argument | takes | required | what it says |
|---|---|---|---|
| `url` | string | yes | the address |
| `options` | table `{ activates }` | no | |
| `options.activates` | boolean | no | whether the app that opens the address comes to the front; `true` where it is left out |

`url` is read as a URL by the URL Standard, with no base URL. A URL whose scheme is `http` or `https` is an **address of the web**. A URL whose scheme is `file`, whose host is empty, as the URL Standard reads it, and whose path decodes is a **file**: the file at the path the URL's path decodes to. A path **decodes** where each `%` in it is followed by two hexadecimal digits and the bytes it percent-decodes to, each `%` and its two digits the byte they give, are UTF-8; it decodes to the text those bytes are.

The request hands the host an address of the web as the URL Standard serializes the URL, and a file as its path, which holds nothing of the URL's query or fragment. Either is handed with `activates`, and the request is fulfilled with nothing once the host has been handed it. What the host does with an address it is handed is the host's.

`openExternal` of a URL whose scheme is `file` is a request that `system.file-handlers` guards, a file or not, and `openExternal` of anything else is a request no permission guards. It is refused at `call` with kind `UNSUPPORTED_URL` where `url` is not read as a URL, or where the URL is neither an address of the web nor a file: its scheme is another, or it is a `file` URL whose host is not empty or whose path does not decode.

A request is refused first as [the permissions](../DECKIT-3/SPEC.md) refuse one, then as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, and then with `UNSUPPORTED_URL`.

**Note.** These are the addresses every host can open outside the app: the web's, in the browser, and a file, in the app for it. Another scheme names a program the system knows nothing of. A mod that hands an address on to the mod that opens it does so through [the addresses](../DECKIT-14/SPEC.md).

### What the look opened answers

The look `opened` of [the case format](../DECKIT-1/SPEC.md) answers each address the host is handed as a table `{ url, activates }`, `activates` the boolean it was handed with, and `url`:

- for an address of the web, the string it was handed as;
- for a file, the file URL of its path: `file://` and then the path, each code point of it but `/`, `ALPHA`, `DIGIT` and `-_.!~*'()` percent-encoded as its bytes in UTF-8, each byte `%` and two upper-case hexadecimal digits.

### The permission system.file-handlers

The system defines this permission, in a table of the shape [the permissions](../DECKIT-3/SPEC.md) give the system's own, and in the order they give:

| id | name | description | privileged |
|---|---|---|---|
| `system.file-handlers` | `File Handlers` | `It can open files in the app for them, which can start programs, and show them in their folders.` | `false` |

It guards `openExternal` of a `file` URL. The other requests it guards are those [the handle](../DECKIT-7/SPEC.md) names it for, each stated by its own DECKIT.

**Note.** Any mod may ask for it, since what it grants is what a person reads before installing the mod: a mod that may open a file says so, and is installed or not on what it asks.

## Interactions

- The handle `openExternal` is a member of, what a request answers, the error it is rejected with and `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md).
- What a mod is granted, `NOT_PERMITTED`, the shape of a table of the system's permissions and their order: [the permissions](../DECKIT-3/SPEC.md). How a permission is asked for and answered usable: [the bundle](../DECKIT-2/SPEC.md).
- The input `call`, which has a case's mod make the request, and the look `opened`, whose answer this DECKIT fixes: [the case format](../DECKIT-1/SPEC.md).
- A file shown in its folder, the address of a file and the file of an address, the other members of the handle that reach files outside the app: the DECKIT of files outside the app.
- A window or an address a mod's web page opens outside the app, and a download opened or shown, which `system.file-handlers` guards: the web sessions' DECKIT.
- Which mod opens an address a mod hands on: [the addresses](../DECKIT-14/SPEC.md), `deckit/urls`.

## Alternatives considered

- Any scheme handed to the host. A scheme other than the web's and `file` names a program the system knows nothing of and cannot tell a person of before a mod is installed. A mod that opens such an address for another does so through `deckit/urls`, as [the addresses](../DECKIT-14/SPEC.md) fix it, where a mod chooses which one opens it.
- Every address guarded by `system.file-handlers`, or by a permission of the web's. An address of the web opens in the browser the person already uses, which gives the page nothing but what it gives any page of the web.
- A file handed to the host as the URL the mod wrote. A host opens a file by its path, as it opens a download, and a URL's query and fragment name nothing of a file.
- `activates` read for an address of the web only. Whether the app that opens an address comes to the front is the mod's to ask whatever the address, as an operating system that opens an address in its app takes it alike for a file and for the web.
- `system.file-handlers` privileged. What it grants is a person's to judge before installing the mod, as for any permission that is not privileged, and a mod that is not a system mod opens the files it wrote.
- A `file` URL on another host opened as the file at its path. The host would open a file of its own for an address that names one elsewhere.
- A path that does not decode opened as the URL Standard percent-decodes it, a `%` that two digits do not follow kept as it is. Bytes that are not UTF-8 are no text, so no path the host can be handed, and a `%` kept would open a file whose own file URL, as `opened` writes it, is another address than the one the mod handed.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That the request is fulfilled with nothing: [the case format](../DECKIT-1/SPEC.md) compares no answer of an input that answers nothing. That what the host does with an address is the host's: the base `system` opens none of them. That the other requests `system.file-handlers` guards are those the handle names: their DECKITs' cases hold them.

**Note.** What this costs an implementation: `url` is read by the URL Standard, so an implementation whose own URL reader differs uses one that follows the Standard; a file's path is decoded before it is handed, and refused where it does not decode; and `activates` is carried to the host for a file as for an address of the web.

# DECKIT-20: The clipboard

Status: draft
Area: system

## Summary

A mod reads the text of the machine's clipboard with `clipboard.readText()` and replaces it with `clipboard.writeText(text)`, members of [the handle](../DECKIT-7/SPEC.md). This DECKIT fixes the two requests: what each takes and answers, and how each is refused. It defines the permissions `system.clipboard-read` and `system.clipboard-write`, which guard them. The clipboard is the machine's: what another app copied is read, and what a mod writes is pasted in any app.

## Motivation

A mod written once for every host copies a link for a person to paste, and pastes what the person copied:

```js
await deckit.clipboard.writeText("https://example.com/a");
const copied = await deckit.clipboard.readText();
```

The requests are handled inside the system, so a host cannot make two implementations agree on them. Each of these is a call two implementations could answer differently without a rule:

- `deckit.clipboard.readText()`, where the person last copied an image, answers the empty string on one implementation, nothing on another, and is refused on a third.
- `deckit.clipboard.writeText(5)` copies `5` on one implementation, which reads the number as a string, and is refused on another.
- The second call, made by a mod granted only `system.clipboard-write`, reads what the person copied from a password manager on one implementation, which takes one permission for both, and is refused on another.

What a mod may read of what a person copied, from any app, and what it may put there to be pasted, are what a person reads before installing it, so the permissions that guard them, their names and their descriptions are the system's to define, alike on every host.

## Rules

### The requests

`clipboard.readText()` and `clipboard.writeText(text)`, members of [the handle](../DECKIT-7/SPEC.md), are requests:

| member | takes | answers | guarded by |
|---|---|---|---|
| `clipboard.readText()` | nothing | the text the clipboard holds, a string: the empty string where it holds none, or holds what is not text | `system.clipboard-read` |
| `clipboard.writeText(text)` | `text`, a string, required | nothing, once the clipboard holds `text` in place of what it held | `system.clipboard-write` |

The **clipboard** is the machine's, one for every app: the text `writeText` writes is the text the next `readText` reads, of any mod, until it is replaced, and what the machine holds as the host app starts is read as it is. A request reads and writes it whichever [seat](../DECKIT-39/SPEC.md)'s input led to it, since a mod knows of no seat.

Each is refused first as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`, and then as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`. A write refused leaves the clipboard as it was.

### The permissions system.clipboard-read and system.clipboard-write

The system defines these permissions, in a table of the shape [the permissions](../DECKIT-3/SPEC.md) give the system's own, and in the order they give:

| id | name | description | privileged |
|---|---|---|---|
| `system.clipboard-read` | `Clipboard Read` | `It can read what you copied, from any app.` | `false` |
| `system.clipboard-write` | `Clipboard Write` | `It can replace what you copied with text of its own, which you then paste in any app.` | `false` |

`system.clipboard-read` guards `clipboard.readText()`, and `system.clipboard-write` guards `clipboard.writeText(text)`.

**Note.** Any mod may ask for either, since what each grants is what a person reads before installing the mod. Reading and writing are two permissions because what they reach differs: a mod that reads is told what the person copied from any app, a password among it, and one that writes is told nothing.

## Interactions

- The handle `clipboard` is a member of, what a request answers, the error it is rejected with and `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md).
- What a mod is granted, `NOT_PERMITTED`, the shape of a table of the system's permissions and their order: [the permissions](../DECKIT-3/SPEC.md). How a permission is asked for and answered usable: [the bundle](../DECKIT-2/SPEC.md).
- The input `call`, which has a case's mod make the requests, and the clipboard the base `system` keeps in place of the machine's: [the case format](../DECKIT-1/SPEC.md).
- A seat's clipboard, which is this one for the local seat alone: [seats at the desktop](../DECKIT-39/SPEC.md).
- What a site a mod's web page shows reads of the clipboard and writes to it, only while the mod is granted these permissions: [what a site is let have](../DECKIT-26/SPEC.md).

## Alternatives considered

- One permission for reading and writing. A mod that only copies a link would be granted what the person copied from every app, and a person could not tell the two apart before installing it.
- Either permission privileged. What each grants is a person's to judge before installing the mod, as for any permission that is not privileged, and a mod that is not a system mod copies the text it shows.
- `readText` refused, or answering nothing, where the clipboard holds no text. A clipboard that holds an image, or nothing, holds no text, and the empty string says so in the type the request answers; a refusal would have a mod catch what is no failure.
- Content other than text, such as an image or a file, read and written. A value is text, a number, a boolean, or an array or table of them, as [the handle](../DECKIT-7/SPEC.md) fixes values, and no form of an image is one every host reads alike.
- An event, or a listener, that tells a mod the clipboard changed. A mod would be told of every copy the person makes in any app, which reaches more than reading it as the mod needs it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That the clipboard is the machine's, one for every app, and what the machine holds as the host app starts: the base `system` keeps a clipboard of its own, as [the case format](../DECKIT-1/SPEC.md) fixes it, so that a case never reads or replaces the clipboard of whoever runs it, and no input of the case format copies as another app does. That a request reads and writes it whichever seat's input led to it: a mod is handed no seat, as [seats at the desktop](../DECKIT-39/SPEC.md) fixes, so a request is the same whatever led to it, and the cases of the requests hold it. That `readText` answers the empty string where the clipboard holds what is not text: the base's clipboard holds text alone. That `readText` answers the empty string where the clipboard holds nothing: [the case format](../DECKIT-1/SPEC.md)'s case of the base's clipboard as a case begins holds it. That `writeText` answers nothing: the case format compares no answer of an input that answers nothing.

**Note.** What this costs an implementation: the clipboard is read and written as each request is made, and nothing of it is kept by the system, so a text another app copies is read at once.

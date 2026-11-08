# DECKIT-16: Key bindings

Status: draft
Area: system

## Summary

`deckit/keys` is the standard interface through which a key runs a mod's command. A mod declares its keys in its manifest, as entries to `deckit/keys`, each a chord bound to a command it declares to [the commands](../DECKIT-15/SPEC.md). The interface's owner binds each key to its chord, or to the one a person set, takes the chords through `keys.take` of its handle, and runs a key's command through `deckit/commands` as its chord is pressed. Any client reads the chord of a key of its own mod; a client granted `deckit.system-services` lists every key and sets or resets one, which the owner keeps as the host app starts again. This DECKIT fixes what is declared and when an entry is left out, a spec and a keystroke, which of the keys on one chord runs, the requests `chordOf`, `list`, `set` and `reset` with their answers and refusals, and what the owner does with a chord. Which mod ships as the owner is the embedding's.

## Motivation

A mod written once for every host gives a person a key for what it does, and a person moves a key that is in the way. `mod-b` declares a command and a key for it:

```toml
[[contributes."deckit/commands"]]
id = "today"
title = "Show Today"

[[contributes."deckit/keys"]]
command = "today"
keystroke = "ctrl+alt+t"
```

and `mod-c` declares one on the same chord. One implementation runs `today` as the chord is pressed, another `mod-c`'s command, a third both. A settings mod sets `today` to ⌘V, which one implementation takes from every text field and another refuses, and sets it with `{ code = "KeyK", alt = "yes" }`, which one reads as ⌥K. A person's choice is gone on one host as the app starts again. `mod-b` could take its chord itself through `keys.take`, and then no other mod could list it or move it, and no key would run its command where `mod-b` is not running. The key a mod declares and what each request answers are the system's to fix, not the owner's.

## Rules

### What a mod declares

A mod declares its keys as entries to `deckit/keys`, under `contributes` as [the bundle](../DECKIT-2/SPEC.md) reads it, and need not use the interface. Each entry is a table:

| key | takes | required | what it is |
|---|---|---|---|
| `command` | string: the id of a command its mod declares | yes | the command the key runs, with no args |
| `keystroke` | string: a `spec`, below | yes | the chord it is bound to by default |
| `scope` | `"app"` or `"global"` | no | where it works: `app` wherever the person is in the host app, `global` in every app too; left out, `app` |

A key of scope `app` needs its mod granted `deckit.app-keys`, and one of scope `global` `system.global-keys`, as [the handle](../DECKIT-7/SPEC.md) names the permissions of `keys.take`.

An entry is **left out** where it is not a table, where a key does not take what the table gives, where its command is none that [the commands](../DECKIT-15/SPEC.md)' `list` answers of its mod, or one whose `params` require a key, where its mod is not granted the permission of its scope, where its keystroke does not fit, below, or where its mod declared a key for its command in an entry before it that is not left out. Entries are read in [the catalog's](../DECKIT-4/SPEC.md) order and then the order written.

### A spec and a keystroke

A **spec** is a chord as a manifest writes it: words apart at `+`, each with the white space code points at its ends dropped and read in lower case, an empty one passed over. Each word is a modifier or a key, and a spec holds one key:

| word | what it is |
|---|---|
| `cmd`, `meta`, `mod` | the modifier `meta` |
| `ctrl`, `control` | the modifier `control` |
| `alt`, `opt`, `option` | the modifier `alt` |
| `shift` | the modifier `shift` |
| a letter `a` to `z` | the key of the code `Key` and the letter in upper case |
| a digit `0` to `9` | the key of the code `Digit` and the digit |
| `f1` to `f19` | the key of the code `F1` to `F19` |
| `left`, `right`, `up`, `down` | `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` |
| `enter`, `escape`, `space`, `tab`, `backspace`, `delete` | `Enter`, `Escape`, `Space`, `Tab`, `Backspace`, `Delete` |
| `[`, `]`, `,`, `.`, `/`, `\`, `-`, `=`, `;`, `'`, `` ` `` | `BracketLeft`, `BracketRight`, `Comma`, `Period`, `Slash`, `Backslash`, `Minus`, `Equal`, `Semicolon`, `Quote`, `Backquote` |

A **keystroke** is a table `{ code, meta, control, alt, shift }`: `code` a string, not empty, the key's code, and each modifier a boolean, `true` where it is held. A spec names the keystroke of its key's code as the table above gives it, with the modifiers it holds. A keystroke a client hands may leave out a modifier, which is then not held.

A keystroke **fits** where its code is one the table gives, it holds `meta`, `control` or `alt`, and it is none a text field with focus takes: none of `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Backspace` and `Delete`, with any modifiers; none of `KeyA`, `KeyC`, `KeyX`, `KeyV` and `KeyZ` with `meta` and with neither `control` nor `alt`; and not `Enter` with `meta`, `control` or `alt`.

A keystroke's **chord**, as a person reads it, is `⌃`, `⌥`, `⇧` and `⌘` for `control`, `alt`, `shift` and `meta`, each where it is held, in that order, then its key: `⌫`, `⌦`, `↩`, `⎋`, `⇥`, `←`, `→`, `↑` and `↓` for `backspace`, `delete`, `enter`, `escape`, `tab`, `left`, `right`, `up` and `down`, a word of one code point in upper case, and any other word with its first code point in upper case, as `Space` and `F12`.

### Which key runs

A **key** is an entry not left out. Each key is bound to the keystroke a person set it to, or to none where they set none, as `set` keeps it, and else to its default, the keystroke of its spec. A key is **changed** where what it is bound to is not its default.

Two keys **share** a chord where they are of one scope and bound to one keystroke. Keys of scope `app` come first, then those of `global`, each in the order read. The keys bound to a keystroke are taken in turn, those not changed first, in that order, then the changed ones in the order a person set them; a changed key that shares a chord with one taken before it is **held**, and is not taken. Of the keys taken that share a chord, the first in the order read **runs** and the others are **shadowed**. A key bound to none does not run.

**Note.** A key of `app` and one of `global` on one chord do not share it: the first works while the host app is in front, the second in every other app.

### What the owner does with a chord

The owner takes the chord of each key that runs through `keys.take` of its handle, once for each keystroke, in the scope `global` where a key of `global` runs on it and `app` otherwise. A key whose chord `keys.take` refuses does not run, and is **taken**; one of `global` whose chord `keys.take` answers not held runs in the host app alone, and is **unavailable**. A press of a chord runs the command of the key that runs on it, of scope `app` while the host app is in front, through the request `run` of [the commands](../DECKIT-15/SPEC.md), with no args, and what that request is refused with is told no one.

The owner takes the chords again as what is declared to `deckit/keys` or to `deckit/commands` changes and as a key is set or reset, and lets go of each chord no key runs on.

**Note.** The owner reaches `deckit/commands` as a client and takes chords for every mod; an owner is shipped granted `deckit.system-services`, `deckit.app-keys` and `system.global-keys`.

### The requests

The owner of `deckit/keys`, as [the interfaces](../DECKIT-10/SPEC.md) fix one, provides major `1`, opens its exports for every client, in its start, and its exports hold these members on every connection, each a function a call of which is a request, as [calls across a connection](../DECKIT-11/SPEC.md) fix one:

| member | takes | answers | guarded by |
|---|---|---|---|
| `chordOf(command)` | `command`, a string, required | the chord of the key of the client's own mod for `command`, where it is active, as `list` answers it, and `""` otherwise | |
| `list()` | nothing | a table `{ keys, refused }`, below | `deckit.system-services` |
| `set(mod, command, keystroke)` | `mod`, a string, required: the declaring mod's id; `command`, a string, required; `keystroke`, a keystroke, not required: left out, the key is bound to none | the key, as `list` answers one, once what is set is kept | `deckit.system-services` |
| `reset(mod, command)` | `mod`, `command`, as `set` | the key, as `list` answers one, bound to its default, once that is kept | `deckit.system-services` |

The client's own mod is the one the credential the connection hands the owner names, and its permissions are the client's. A request is refused with the first of these that is so, at `call`:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, with kind `NOT_PERMITTED`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, with kind `INVALID_ARGUMENT`;
3. for `list`, `set` and `reset`, with kind `NOT_CONNECTED`, while the owner has no connection to `deckit/commands`, as [the interfaces](../DECKIT-10/SPEC.md) fix one;
4. for `set` and `reset`, with kind `NOT_DECLARED`, where `mod` declares no key for `command`;
5. for `set`, with kind `INVALID_ARGUMENT`, where `keystroke` does not fit.

The owner keeps what a person set in its own storage, as [the storage](../DECKIT-13/SPEC.md) fixes it, so that it stands as the host app starts again, and keeps it for a key whose mod is gone, so that it stands again as the key comes back. A set of a key to its default keeps nothing for it.

### What list answers

`keys` is an array, one table for each key, in the order of *Which key runs*:

| key | value |
|---|---|
| `mod` | table `{ id, name }`: the declaring mod's, as [the bundle](../DECKIT-2/SPEC.md) answers them |
| `command` | string: the command's id |
| `title` | string: the command's title, as [the commands](../DECKIT-15/SPEC.md)' `list` answers it |
| `scope` | `"app"` or `"global"` |
| `defaultKeystroke` | keystroke: its default |
| `keystroke` | keystroke: what it is bound to; left out where it is bound to none |
| `chord` | string: the chord of what it is bound to, `""` for none |
| `changed` | boolean: whether it is changed |
| `active` | boolean: whether it runs and is not taken |
| `issues` | array of tables `{ kind, message, other }`: `kind` `"held"`, `"shadowed"`, `"taken"` or `"unavailable"`, for each it is; `message` a string, why, as the implementation says it; `other`, for `held` and `shadowed`, the key that runs on the chord, `{ mod, command, title }`, and left out for the others |

`refused` is an array, one table `{ mod, entry, problem }` for each entry left out, in the order read: `mod` the table `{ id, name }` of the declaring mod, `entry` the entry as written, and `problem` a string, why, as the implementation says it.

## Interactions

- `contributes`, an entry as a value, and a bundle's `id` and `name`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.system-services` and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md). `deckit.app-keys`, `system.global-keys` and `keys.take`: [the handle](../DECKIT-7/SPEC.md), and the keys' DECKIT.
- The catalog's order: [the catalog](../DECKIT-4/SPEC.md).
- `INVALID_ARGUMENT`, and what a value is: [the handle](../DECKIT-7/SPEC.md).
- The owner of an interface, the connection to it, and the entries declared to it: [the interfaces](../DECKIT-10/SPEC.md). A call of a member of the exports and its refusal: [calls across a connection](../DECKIT-11/SPEC.md).
- Where the owner keeps what is set: [the storage](../DECKIT-13/SPEC.md).
- The commands a key runs, their titles and `params`, and the request that runs one: [the commands](../DECKIT-15/SPEC.md).
- The owner a case's host ships, and the call of what a listener was handed: [the case format](../DECKIT-1/SPEC.md).
- Which mod a host ships as the owner: the embedding DECKIT.

## Alternatives considered

- Every mod taking its own chords through `keys.take`. No person could list or move a key, and a key would do nothing while its mod is not running.
- A key that runs a function of its mod rather than a command. It could run only where the mod runs, and the command a switcher or a notification runs would be another thing.
- Of two keys on one chord, both running, or the last one installed. A press would do two things, or what was installed when would decide it; the order read is a fact of the catalog, and a person who moves a key decides the rest.
- A key set onto a chord another key has taking it from that key. A person would move a key they did not touch; the one set waits until the chord is free.
- A chord with no ⌘, ⌃ or ⌥, or one a text field takes. A key works past its page and is taken from every page, text fields included, so such a key would take letters, arrows or paste from every field.
- A modifier of another type read as held or not. A value is never read as another, as [the handle](../DECKIT-7/SPEC.md) fixes it.
- A kind of the interface's own for a key not declared and a keystroke that does not fit. A kind names what went wrong; a keystroke that does not fit is an argument that does not fit what the request takes.
- `null` for a key bound to none and for an issue with no other key. A value has no null, as [the handle](../DECKIT-7/SPEC.md) fixes it; a key left out says the same.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `message` and `problem`: no rule states their text. A press of a chord, and the scope a key works in: no input of the case format presses a key. Keys of scope `global` and `unavailable`: whether the machine gives a chord to the host app outside it is the machine's. The order of keys of `app` before those of `global`, and the kinds of `issues`: what a case reads of an answer is a value or the value under one key of it, and a key's `issues` hold a `message`; whether a key runs is read from `active` and `chordOf`. What is kept for a key whose mod is gone: no input of the case format removes a bundle. That the owner opens its exports in its start and for every client: every case reaches it so.

**Note.** What this costs an implementation's owner: it reads the entries declared to `deckit/keys` and the commands of `deckit/commands` again as they change, resolves every key again on each change, and takes and lets go of chords to match.

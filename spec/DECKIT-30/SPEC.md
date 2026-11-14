# DECKIT-30: Files outside the app

Status: draft
Area: shell

## Summary

A mod asks the person for folders of the machine with `dialogs.chooseFolders(options)`, and shows the person a file where it lies with `reveal(path)`, members of [the handle `shell`](../DECKIT-29/SPEC.md). This DECKIT fixes the two requests: what each takes and answers, what each asks of the host, and how each is refused. No permission guards either. The file address of a path, and a file opened outside the app, are the system's, as [opening outside the app](../DECKIT-8/SPEC.md) fixes them.

## Motivation

A mod that keeps its notes in a folder the person picks asks for it, and shows it to them where it lies:

```js
const [folder] = await shell.dialogs.chooseFolders({ message: "Choose the folder your notes are in." });
if (folder) await shell.reveal(folder);
```

Each is something shown to the person: a dialog they choose in, and a file shown in the folder that holds it. Showing to a person is the shell's, and a host with no shell has nothing to show them in; the system keeps what hands over or computes without showing anything, the file address of a path and an address opened outside the app. A mod cannot show either itself: its page is shown in the app, and the machine's folders are outside it. Each of these is a call two implementations could answer differently without a rule:

- The person cancels the dialog. The request answers the empty array on one implementation, nothing on another, and is refused on a third.
- `shell.dialogs.chooseFolders({ multiple: "yes" })` shows a dialog of several folders on one implementation, which reads the string as true, and is refused on another.
- `shell.reveal("notes/today.md")` shows a file of the folder the host app was started in on one implementation, and nothing on another.
- A mod granted nothing calls `shell.dialogs.chooseFolders()`. One implementation refuses it with `NOT_PERMITTED`; another shows the dialog.

## Rules

### The request dialogs.chooseFolders

`dialogs.chooseFolders(options)` is a request, as [the shell](../DECKIT-29/SPEC.md) fixes a request of the handle `shell`. It asks the host to show the person a **dialog of folders**, in which the person chooses folders of the machine, or none:

| argument | takes | required | what it says |
|---|---|---|---|
| `options` | table `{ multiple, title, message }` | no | |
| `options.multiple` | boolean | no | whether the dialog takes several folders; `false` where it is left out, and the dialog then takes one |
| `options.title` | string | no | the dialog's title |
| `options.message` | string | no | the text the dialog shows the person, saying what the folders are for |

The shell asks the host to show the dialog with `multiple`, `title` and `message`, and the request is fulfilled once the person has chosen, with an array of strings: the absolute path of each folder the person chose, as [opening outside the app](../DECKIT-8/SPEC.md) fixes an absolute path, in the order the dialog answers them. Where the dialog takes one folder, the array holds one path at most. Where the person chose none, as one who cancels the dialog, it is the empty array.

No permission guards it. It is refused as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`, and through a handle that is cut, then with kind `ENDED`, as [the shell](../DECKIT-29/SPEC.md) refuses a request of a cut handle. A request refused shows no dialog.

**Note.** What the dialog draws besides `title` and `message`, such as the label of the button that chooses and where it is shown over the app, is the shell's, as what the shell draws is, and no rule fixes it.

### The request reveal

`reveal(path)` is a request, as [the shell](../DECKIT-29/SPEC.md) fixes a request of the handle `shell`. It asks the host to show the person the file or folder at `path` where it lies, in the folder that holds it, outside the app:

| argument | takes | required | what it says |
|---|---|---|---|
| `path` | string | yes | the path of the file or folder |

Where `path` is absolute, as [opening outside the app](../DECKIT-8/SPEC.md) fixes an absolute path, the request hands the host `path` as it is, and is fulfilled with nothing once the host has been handed it. Where it is not absolute, it names no file: the host is handed nothing, and the request is fulfilled with nothing all the same. What the host shows of a path it is handed, and where no file is at it, is the host's.

No permission guards it. It is refused as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`, and through a handle that is cut, then with kind `ENDED`, as [the shell](../DECKIT-29/SPEC.md) refuses a request of a cut handle. A request refused hands the host nothing.

**Note.** A path that is not absolute is a string of the type `reveal` takes, so it is not refused, as [opening outside the app](../DECKIT-8/SPEC.md) answers the empty string for the file address of one; a refusal is kept for an argument of another type. An absolute path at which no file is reaches the host all the same, which finds whether one is there as it shows it.

## Interactions

- The handle `shell`, a request of it, and the handle cut with its `ENDED`: [the shell](../DECKIT-29/SPEC.md).
- A request, the error it is rejected with, `INVALID_ARGUMENT`, and a key of a table or an argument past those a request takes, which is not read: [the handle](../DECKIT-7/SPEC.md).
- An absolute path, the file address of a path, and a file opened outside the app, which `system.file-handlers` guards: [opening outside the app](../DECKIT-8/SPEC.md).
- The base `shell`, which shows no dialog of folders and has the person choose the folders `[host] chosen` names, and keeps each path it is handed to show for the look `revealed`; and a bundle's path read back as its name: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- A permission guarding either request. Each shows something to the person and hands over nothing past what it shows: `chooseFolders` answers the folders its dialog answered, and `reveal` answers nothing. A permission guards what a request hands over or reaches without showing it, as `system.file-handlers` guards a file opened outside the app by [opening outside the app](../DECKIT-8/SPEC.md).
- A cancelled dialog refused with a kind, or answering nothing. A person who chooses no folder has answered; the empty array says so in the type the request answers, and a refusal would have a mod catch what is no failure.
- A label of the dialog's button among `options`. What the button does is fixed, choosing the folders, so its label is the shell's, as the label of a button the shell draws is; `title` and `message` say what a mod asks the folders for, which only the mod knows.
- A path that is not absolute read from a folder, such as the one the host app was started in. A mod knows no such folder, and two hosts would show two files for one path.
- `reveal` refused where no file is at the path. Whether one is there is the machine's, and can change between a check and the showing; the host finds it as it shows it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. What the dialog shows of `title` and `message`, and that a request refused shows no dialog: the base `shell` of [the case format](../DECKIT-1/SPEC.md) shows no dialog, and no look reads what a dialog was asked; the cases read that each is taken. That the request is fulfilled once the person has chosen: the base's dialog answers at once. That `reveal` is fulfilled with nothing: the case format compares no answer of an input that answers nothing. `ENDED`: no `call` reaches a cut handle, as [the shell](../DECKIT-29/SPEC.md) says of its cases. What the host shows of a path: the base keeps each path it is handed and shows none.

**Note.** What this costs an implementation: a request of a dialog holds until the person has chosen, which may be long after it was made; and the shell tells an absolute path from one that is not before it hands the host one.

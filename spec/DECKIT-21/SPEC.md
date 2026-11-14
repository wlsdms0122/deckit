# DECKIT-21: Notifications of the machine

Status: draft
Area: system

## Summary

A mod hands the host a notification to show on the machine, outside the app, with `notifications.show(notification)`, a member of [the handle](../DECKIT-7/SPEC.md), and hears it pressed through `onPress(listener)`, a member of what the request answers. This DECKIT fixes the request: what a notification of the machine is, what the host is handed of it, what the request answers, and how it is refused. It fixes `onPress`, which is not a request, and when a press is heard: once, while the lifecycle that showed the notification runs. It defines the permission `system.notifications`, which guards the request, and fixes what the look `shown` of [the case format](../DECKIT-1/SPEC.md) answers of each notification handed and what the input `press` presses. Which notifications a mod tells a person of, and how they are kept, are [the notifications](../DECKIT-19/SPEC.md)' owner's.

## Motivation

The owner of `deckit/notifications` shows a notification on the machine while the app is not in front, and runs its command as a person presses it, as [the notifications](../DECKIT-19/SPEC.md) fix it:

```js
const { shown, onPress } = await deckit.notifications.show({ title: "Standup", body: "in 5 min" });
onPress(() => this.press(id));
```

The request is handled inside the system, so a host cannot make two implementations agree on it. Each of these is a call two implementations could answer differently without a rule:

- `deckit.notifications.show({})` shows an empty notification on one implementation and is refused on another; `deckit.notifications.show()` is taken on one and refused on another.
- A title of 300 code points is cut at 200 on one implementation, in the middle of a code point that takes two UTF-16 units, and handed whole on another.
- A press an hour after the notification was shown, from the machine's list of notifications, is heard on one implementation, which keeps the listener while the run runs, and on another, which keeps it ten minutes, reaches nothing: the owner cannot run the command [the notifications](../DECKIT-19/SPEC.md) say a press runs.
- `onPress("x")` throws an error with no kind on one implementation and is refused with `INVALID_ARGUMENT` on another; the same listener handed twice is called twice on one and once on another.
- On a machine that shows no notifications, `shown` is `false` on one implementation, and the request is refused on another.

Which mod may show a notification on the machine, while a person looks at something else, is what a person reads before installing it, so the permission that guards it, its name and its description are the system's to define, alike on every host.

## Rules

### The request notifications.show

`notifications.show(notification)`, a member of [the handle](../DECKIT-7/SPEC.md), is a request that hands the host a notification to show on the machine:

| argument | takes | required | what it says |
|---|---|---|---|
| `notification` | table `{ title, body, silent }` | yes | the notification |
| `notification.title` | string | no | what a person reads first; left out, the empty string |
| `notification.body` | string | no | what a person reads after it; left out, the empty string |
| `notification.silent` | boolean | no | whether the machine shows it with no sound; left out, `false` |

A notification's `title` and `body` are not both empty.

The request hands the host the notification, its `title`, `body` and `silent` as they read, the title and the body whole: what of them the machine shows is the machine's. It is fulfilled, once the host has answered, with a table of two keys:

| key | what it is |
|---|---|
| `shown` | a boolean: `true` where the host answered that the machine took the notification; `false` where the machine has no notifications, or where the host answered that the machine did not take it |
| `onPress` | a member, under *Hearing a press* |

`onPress` is a function, which is no value as [the handle](../DECKIT-7/SPEC.md) fixes values: it is a member of the answer, as a member of the handle is of the handle, and the value the request answers is the table `{ shown }`, as [the case format](../DECKIT-1/SPEC.md) reads a key bound to a function.

It is refused with the first of these that is so, and hands the host nothing:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`, where the mod is not granted `system.notifications`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`;
3. at `call` with kind `INVALID_ARGUMENT`, where `title` and `body` are both empty.

**Note.** A notification of the machine tells a person something while the app may not be in front. One with neither a title nor a body tells nothing, as [the notifications](../DECKIT-19/SPEC.md) refuse a post of one.

### Hearing a press

A notification is **pressed** as the host hands the system a press of it, which it hands as the machine tells it one. What the host does besides, such as bringing the app to the front, is the host's.

`onPress(listener)`, a member of what `show` answered, is not a request: it adds `listener` for a press of that notification, and answers a function that removes it. It throws its refusal, an error as [the handle](../DECKIT-7/SPEC.md) fixes one.

| takes | type | required | what it is |
|---|---|---|---|
| `listener` | function | yes | what is called, with no values, as the notification is pressed |

It is refused at `call` with kind `INVALID_ARGUMENT`, where `listener` is not a function, and adds nothing.

A listener is added once for a notification: handed again to its `onPress`, it is still called once for a press. A press is **heard** once: each listener added for the notification is called once, with no values, as its first press is handed, and none is called for a later press. A listener added after the press was heard is not called. A listener is removed once the function `onPress` answered is called, once the press is heard, or once the lifecycle whose handle `show` was called on ends, as [the entry](../DECKIT-6/SPEC.md) fixes a lifecycle, whichever comes first. A notification whose `shown` is `false` is never heard pressed.

**Note.** A press is heard however long after the notification was shown, while the lifecycle that showed it runs: a person reads a notification in the machine's list long after it came, and the press reaches its mod then. A press the machine no longer tells the host of, as it takes a notification out of its list, is the machine's.

### The look shown and the input press

The look `shown` of [the case format](../DECKIT-1/SPEC.md) answers each notification the host is handed as a table `{ title, body, silent }`, each as the request handed it, and the input `press` hands the system a press of the one at its place.

### The permission system.notifications

The system defines this permission, in a table of the shape [the permissions](../DECKIT-3/SPEC.md) give the system's own, and in the order they give:

| id | name | description | privileged |
|---|---|---|---|
| `system.notifications` | `Notifications` | `It can show notifications in the corner of the screen, while you are looking at something else.` | `false` |

It guards `notifications.show(notification)`.

**Note.** Any mod may ask for it, since what it grants is what a person reads before installing the mod. A mod that tells a person something posts to [the notifications](../DECKIT-19/SPEC.md), whose owner, granted this permission, chooses how each is shown.

## Interactions

- The handle `notifications.show` is a member of, what a request answers, values, the error a request is rejected with and `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md).
- What a mod is granted, `NOT_PERMITTED`, the shape of a table of the system's permissions and their order: [the permissions](../DECKIT-3/SPEC.md). How a permission is asked for and answered usable: [the bundle](../DECKIT-2/SPEC.md).
- A lifecycle, and when it ends: [the entry](../DECKIT-6/SPEC.md).
- A listener added by a member that is not a request, added once, and removed as its lifecycle ends, as `events.on` adds one: [the events](../DECKIT-12/SPEC.md).
- The input `call`, which has a case's mod make the request and call `onPress`, the listener a case hands and the look `heard`, the look `shown`, whose answer this DECKIT fixes, and the input `press`: [the case format](../DECKIT-1/SPEC.md).
- The interface a mod posts a notification to, whose owner shows it, through this request among others: [the notifications](../DECKIT-19/SPEC.md).
- A notification a site a mod's web page shows makes, of which the web engine hands the machine nothing but what the mod shows through this request: [notifications of a site](../DECKIT-27/SPEC.md).

## Alternatives considered

- `notification` that may be left out. A notification left out has neither a title nor a body, so the request would be refused for every call that leaves it out; an argument that may be left out but never is would say nothing.
- The title and the body cut to a length. What of a text fits is the machine's to show, and differs from one machine to another; a cut by UTF-16 units splits a code point that takes two, and a cut the system makes the machine would make again.
- A press heard for a fixed time after the notification is shown. A person presses a notification from the machine's list long after it came, and the owner of [the notifications](../DECKIT-19/SPEC.md) runs its command then; a time would drop a press the owner must run. How long the machine keeps it is the machine's.
- A press heard as often as the host hands one. The machine takes a notification out of its list as it is pressed, and a second press handed for it would run the owner's command twice.
- `onPress` as a request that answers a promise. What it answers, the function that removes the listener, is no value, and a press handed between the call and its answer would be missed, as [the events](../DECKIT-12/SPEC.md) set aside the same for `on`.
- The listener handed to `show` beside the notification. A function is no value, so `show` would take an argument that is not one; `onPress` adds it to what `show` answered, as `on` adds one by a member that is not a request.
- `shown` meaning the machine put the notification on screen. The host is told that the machine took it, or did not, and a machine that holds it back, while a person asked for quiet, tells the host nothing more.
- The request refused where the machine has no notifications. A mod that tells a person something on every host would catch a refusal on some and not others; `shown` is `false`, and the mod tells the person another way.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That `shown` is `false` where the machine has no notifications or did not take the notification: the base `system` answers of each notification that the machine took it, as [the case format](../DECKIT-1/SPEC.md) fixes it, and no input of the case format has the machine refuse one, so a notification whose `shown` is `false` and is never heard pressed are held by none either. What the machine shows of a title or a body: the base shows nothing. That `onPress` answers a function that removes the listener, and a listener removed as that function is called or as its lifecycle ends: a case reads no function and calls none, and a case's lifecycle runs while its steps are taken. That a press is heard however long after it was shown: a case presses a notification while its steps are taken. What the host does besides as a notification is pressed: the host's.

**Note.** What this costs an implementation: it keeps, for each notification a lifecycle showed, the listeners added for its press until the press is heard or the lifecycle ends, with no time that drops them, so a lifecycle that shows many and hears few presses holds a set for each of them while it runs; and it hands the host each title and body whole.

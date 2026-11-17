# DECKIT-27: Notifications of a site

Status: draft
Area: web

## Summary

A site a mod's web page shows makes notifications with the web platform's `Notification`, as a site does in a browser. This DECKIT fixes that `Notification` in every document a page shows: its `permission` and `requestPermission()`, which ask for the name `notifications` as [what a site is let have](../DECKIT-26/SPEC.md) asks, a notification shown only while the site has `notifications` in the page's session and its `error` otherwise, what of the options it carries, and `close()`. It fixes what the mod is told of each notification shown, through the delegate's `didReceiveNotification({ title, body, silent, click })`, the title and the body whole, and `click()`, which hands a click back to the site's notification with no user activation. Nothing of a site's notification reaches the machine but what the mod shows itself.

## Motivation

A mod that shows sites, such as a browser, hears what a site would notify and shows it on the machine as its own, so that a press there brings its page forward and hands the site the click:

```js
page.delegate = {
    didReceiveNotification: async ({ title, body, silent, click }) => {
        const shown = await deckit.notifications.show({ title, body, silent });
        shown.onPress(() => { focus(page); click(); });
    },
};
```

What a site's notification comes to is the web engine's to decide, under every layer over it and in every mod, since a site is no mod and reaches the machine only as the web engine lets it. Each of these is a page two implementations could answer differently without a rule:

- A site let have notifications makes `new Notification('Hi', { body: 'There' })`. One implementation shows it on the machine itself, as a browser does, past the mod; another tells the mod; a third drops it.
- A site the mod took notifications back from, whose document still reads `granted`, makes one. One implementation fires its `show` and tells nothing; another fires its `error`, so the site knows.
- A site's title runs to 300 characters. One implementation cuts it to 200 UTF-16 units, splitting an emoji in two, and another tells it whole; one tells the body `0` as `"0"` and another as nothing.
- A mod hands a click back. On one implementation the site's `click` fires with the user activation of a press, and the site opens a popup on it; on another it fires with none, as in a browser; on a third the page has loaded again, and the click fires on a notification of the new document.
- Two notifications share a `tag`. One implementation tells the mod the second as replacing the first; another tells both.

## Rules

### The page's Notification

In every document a web page shows, its main frame's and each frame's, the web platform's `Notification` is the one this DECKIT fixes. The **site** of a document is its origin, as [what a site is let have](../DECKIT-26/SPEC.md) fixes the site of an ask; a document whose origin is opaque is no site, and shows no notification.

| member | what it is |
|---|---|
| `Notification.permission` | a string: `granted` where the site has `notifications` in the page's session as the document starts, as `allow` of [what a site is let have](../DECKIT-26/SPEC.md) lets it have it, or once `allow` lets it while the document is shown, or once the mod answers the document's ask yes; `denied` once the document's ask is refused; `default` otherwise. Once `granted` or `denied`, it stays so for the document |
| `Notification.requestPermission(callback)` | a promise of the string that `permission` comes to: where it is `default`, the site asks for the name `notifications`, as [what a site is let have](../DECKIT-26/SPEC.md) puts an ask, and it comes to `granted` where the site is let have it and `denied` otherwise; where it is not `default`, the promise answers it, unasked. A `callback` that is a function is called with the same string |
| `new Notification(title, options)` | a notification, under *A notification*. Called with no argument, it throws the web platform's `TypeError` |
| `close()` | of a notification shown and not closed, fires its `close` event; of any other, does nothing. It answers nothing |

The state the Permissions API's `navigator.permissions.query({ name: "notifications" })` reads is `permission`, but that `default` reads `prompt`.

A notification's events are `show`, `error`, `click` and `close`, each dispatched at it and handed to its handler of the same name, `onshow`, `onerror`, `onclick` and `onclose`.

### A notification

`new Notification(title, options)` makes a notification of the document's site. `title` and the `body` of `options` are converted to strings as the web platform converts a `DOMString`, `body` to the empty string where it is not given, and its `silent` to a boolean, `false` where it is not given.

After `new Notification` answers, never before, the notification is **shown** where the document's `permission` is `granted` and the site has `notifications` in the page's session, as `allow` lets it have it: its `show` event fires, and the mod is told it, under *What the mod is told*. Otherwise its `error` event fires, and the mod is told nothing. A notification is shown at most once.

The other options the web platform defines for a notification, such as `tag`, `icon`, `badge`, `image`, `lang`, `dir`, `data`, `renotify`, `requireInteraction` and `timestamp`, are held as its attributes and change nothing else: the mod is not told them, and a notification shown is told the mod whatever `tag` an earlier one has. Its `actions` are always empty.

A worker a site runs shows no notification: in a worker `Notification.permission` is `default`, and each notification made there fires its `error` event.

**Note.** A notification whose site the mod took `notifications` back from with `revoke`, made in a document that still reads `granted`, fires its `error`: the site is told it was not shown. A mod that lets a site have notifications lets it with `allow`, as it answers its ask yes; a yes alone answers the ask, as [what a site is let have](../DECKIT-26/SPEC.md) keeps no answer.

### What the mod is told

Each notification shown is told the delegate of the page whose document shows it, as [web pages](../DECKIT-25/SPEC.md) fix a delegate, by its member `didReceiveNotification(notification)`, `notification` a table:

| key | value |
|---|---|
| `title` | string: the notification's title, whole |
| `body` | string: its body, whole: the empty string where it has none |
| `silent` | boolean: whether the site asked for it to make no sound |
| `click` | function: `click()`, under *A click* |

The title and the body are told as the page's `Notification` converted them, whole: no length cuts either. A notification of a frame is told the delegate of the page the frame is in, and one of a popup's page the delegate of the popup, a page of its own. A delegate that does not hold the member is not told, and the notification is shown all the same.

### A click

`click()` answers nothing, at once. It hands a click back to the notification it was told with: the notification's `click` event fires in the document that made it, and gives the document no user activation, as the web platform gives none for a click of a notification. It fires once: `click()` again, `click()` of a notification closed, and `click()` once the document that made it is gone, because the page loaded another document or has closed, do nothing.

### The machine

The web engine hands the machine nothing of a site's notification. A site's notification reaches the machine only where the mod shows one itself, with `notifications.show` as [notifications of the machine](../DECKIT-21/SPEC.md) fix it, guarded by `system.notifications`.

## Interactions

- A site, the name `notifications`, an ask put to the mod with `system.site-permissions` and its delegate's `decidePermission`, `allow` and `revoke`, a frame as the site of its own origin, and what the web engine tells a site carrying no user activation: [what a site is let have](../DECKIT-26/SPEC.md).
- A page, its session, its delegate, a member missing or throwing answered its default, a popup taken, a page loaded again and a page closed: [web pages](../DECKIT-25/SPEC.md). A session: [the web engine](../DECKIT-23/SPEC.md).
- The notifications of the machine, `notifications.show`, `system.notifications` and the look `shown`: [notifications of the machine](../DECKIT-21/SPEC.md).
- The inputs `show` and `activate`, the host's delegate, the look `delegated`, and the key `delegated` of a `call`, which calls `click` of what the host's delegate was told: [the case format](../DECKIT-1/SPEC.md).
- A download a page starts: [downloads](../DECKIT-28/SPEC.md).

## Alternatives considered

- The web engine showing a site's notification on the machine itself. The mod would not decide what of a site reaches a person, nor make the press on the machine bring its page forward; [notifications of the machine](../DECKIT-21/SPEC.md) are a mod's to show.
- The title cut to 200 UTF-16 units and the body to 400. What of a text fits is the machine's to show, a cut by UTF-16 units splits a code point that takes two, and the mod shows it through `notifications.show`, which cuts nothing either.
- A notification shown on the document's `permission` alone. A document that read `granted` before `revoke` would go on showing what the mod took back, until it loads again.
- `show` fired as the notification is made, before the web engine decides. A site would be told a notification was shown that nobody sees.
- A document the mod answered yes showing notifications until it loads again. What a site has would be kept in two places, the session's and each document's, and a yes would last a while the mod cannot see or take back; a mod lets a site have notifications with `allow`.
- Every option told the mod: `tag`, `icon`, `data` and the others. [Notifications of the machine](../DECKIT-21/SPEC.md) show a title, a body and whether it is silent; an icon is an address the site serves, and a `tag` that replaces would need the machine to take a notification back, which it does not.
- `close()` told the mod. The mod has no way to take a notification off the machine, so it could do nothing with it.
- A click handed back with a user activation. The web platform gives none for a click of a notification, and a site would open a popup on a press a person made on the machine for the mod.
- A click handed to the document the page shows as it is clicked. A notification of a document gone would fire in another document of the site, which never made it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. A delegate member throwing: the host's delegate throws nothing. A service worker's notification: [the case format](../DECKIT-1/SPEC.md)'s sites are refused a service worker by the engine underneath. A document whose origin is opaque: its ask is held by [what a site is let have](../DECKIT-26/SPEC.md), and no case makes a notification there. The other options a site may give but `tag`, `icon`, `data` and `requireInteraction`: they are held as those are.

**Note.** A click that does nothing, of a notification closed, of a page closed or of a document gone, is held by a case that reads the document's title once the step that clicks has settled, as [the case format](../DECKIT-1/SPEC.md) settles a click handed back once the document has taken it. Such a case passes where a click fires after the step settled: an implementation that told the document nothing as it settled and fired the click later would pass it.

**Note.** What this costs an implementation: the page's `Notification` run in every document a page shows, each frame's among them, its `permission` held for the document; each notification's `show` or `error` fired only once the web engine has decided whether it is shown, by the session as the notification is made; the title and the body carried whole; a click handed back to the document that made the notification, once, without a user activation, and dropped once that document is gone. Where the page's `Notification` runs inside the site's own document, the site can write what that document tells the web engine, so the web engine takes a notification only whose title and body are strings and whose `silent` is a boolean, and a click only for a notification of the same site.

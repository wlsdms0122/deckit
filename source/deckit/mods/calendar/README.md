# Calendar

Day, week and month views of the calendars of your accounts, what is on now and next in the switcher, and a notice before a meeting. Calendar reads no calendar itself: each kind of account comes from a mod that sets a provider through its exports, and with none there is nothing to add. It runs in the background from the start (`background` in its manifest), so a meeting reminds whether or not its window is open.

A meeting's notice is posted to `deckit/notifications` (MOD.md, Standard interfaces), as is the one Send a test posts. Pressing it runs Calendar's `show-date` command with the meeting's day: Calendar comes forward on that day. A notice is marked sent only once it was posted, so while no mod owns the interface, or the owner refuses it, it is posted again on the next check while the meeting is still due.

## Settings

Declared in the manifest to `deckit/configuration` (see the Configuration mod), and read through it in `start`, where the reminders run.

| Key | Title | What it is |
|---|---|---|
| `notify` | Notify me | how long before a meeting its notice comes: `off`, or `0`, `1`, `5`, `10`, `15` or `30` minutes, as text. Until it is read, no notice comes |

Settings shows a Send a test button under it (`settings/buttons`), which runs `send-test`.

## Commands

What a CLI, the switcher, a notification or another mod runs by name: declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports Calendar opens for its id in `start`. Send a test runs with no screen; the others act on the view in Calendar's window, open or not, `show-date` opening the window, and one run while Calendar is not attached fails, saying so.

| Command | Title | Args | What it does |
|---|---|---|---|
| `send-test` | Send a Test Notification | | posts a notice now, the way a reminder looks, and answers what came of it, as text |
| `show-date` | Show Date in Calendar | `date`, as YYYY-MM-DD | brings Calendar's window forward on that day |
| `go-to-date` | Go to Date | `date`, as YYYY-MM-DD | shows that day in the view |
| `show-view` | Show Calendar View | `view` (`day`, `week` or `month`) | shows the day, the week or the month view |

The switcher (`switcher/actions`) offers the meeting on now and the next, an action for each view, Go to Today, Go to Date (a day typed as YYYY-MM-DD), Previous and Next, Add Calendar Account… and Send a Test Notification.

## Keys

The window's own shortcuts, which Calendar handles in its window while it is the key window.

| Key | Action |
|---|---|
| ⌘T | today |
| ⌘1, ⌘2, ⌘3 | the day, the week, the month view |
| ⌘←, ⌘→ | the days before, the days after, except in a text field, where they move the caret |

## Adding accounts: `calendar/accounts`

Calendar defines the interface `calendar/accounts`, and provides its major 1. Its exports open in `start`, since the reminders read through a provider where nothing is on screen, so a mod that adds accounts uses it and sets its provider in `start`, with `onConnect`, each time the interface's owner connects. They are `setProvider(provider)`, one provider for each connection. It gives no place for views.

```toml
[interfaces]
uses = { "calendar/accounts" = 1 }

[permissions]
"system.network" = "Reads your calendars from Example."
```

```js
deckit.dependencies.onConnect('calendar/accounts', (calendar) => {
    calendar.setProvider({
        name: 'Example',
        hint: 'An Example account',
        icon: `<svg …>`,
        async signIn(account, { title, ask }) {},
        async calendars(account) {},
        async events(account, calendar, from, to) {},
        async respond(account, eventId, status) {},
        async forget(account) {},
    });
});
```

The provider's data is copied and its functions are called across the connection; an object made from a class crosses with its methods, so `setProvider(new ExampleProvider())` works. Setting one again replaces it.

Calendar keeps each account as `{ id, provider, email }`, `provider` the mod's id, and hands it to every call. What the account signs in with (cookies, tokens, a web session) is the provider's, kept by `account.id` in its own mod: `web.session('account-' + account.id)` of the handle `web` its lifecycles are given is one way.

| Member | What it is |
|---|---|
| `name`, `hint`, `icon` | what the Add account sheet shows: the provider's name, a line under it, an inline SVG (drawn from its shapes alone) |
| `signIn(account, { title, ask })` | signs the account in and resolves to the address it signed in as, or to nothing when the person cancelled. The sign-in is the provider's to show, in a window of its own (`shell.web.window` of the `shell` its `attach` is given, `title` its title), with whatever it asks the person on the way (a certificate, an app to open) asked through `ask` (Asking). Adding an account, a cancelled or failed sign-in leaves nothing behind in Calendar, and the provider drops what it kept for `account.id`; signing an account in again, what it had stays. Called to add an account and to sign one in again; signing in again as another address, compared exactly, is refused |
| `calendars(account)` | `[{ id, name, primary, selected, owned }]`: the account's calendars. `id` is read as a string, and a calendar without one is left out. `primary` is the account's own, `selected` one its own calendar app shows (a new account starts with those), `owned` one the account owns, whose every event reminds, not only invitations |
| `events(account, calendar, from, to)` | the occurrences of the calendar whose `id` is `calendar` between two Dates, as an array (below). Anything else is a failure, and an answer that takes more than a minute is one too |
| `respond(account, eventId, status)` | answers an invitation (an occurrence with `invited`): `ACCEPTED`, `DECLINED` or `TENTATIVE` |
| `forget(account)` | optional: drop what the provider keeps for `account.id`, so it is signed out. Called when the account is removed (once the provider runs, if it did not then), when a sign-in for a new account turns out to be one already there, and when signing in again lands on another address |

An occurrence, one for each time an event happens, in what every provider maps its own events to:

| Field | What it is |
|---|---|
| `id` | the provider's id for this occurrence, one of its own in the calendar, what `respond` is given |
| `uid` | the same meeting across occurrences and calendars; keys the reminders |
| `summary` | its title |
| `start`, `end` | Dates, or what `new Date()` reads; local midnights for an all-day event |
| `allDay` | whether it takes whole days |
| `call` | `{ name, url }` of its video call, `url` an http or https address, or `null` |
| `rooms` | the names of the rooms booked |
| `location` | as written, less what `call` and `rooms` already say |
| `description` | plain text, links kept as addresses |
| `rsvp` | the account's answer, `ACCEPTED`, `DECLINED`, `TENTATIVE` or `NEEDS-ACTION`, or `''` when it is not a guest |
| `invited` | the account is a guest and not the organiser, so it has an answer to give |

Calendar reads an occurrence in this shape by these rules. `id` and `uid` are read as strings, and `uid` is the `id` when there is none. A text field (`summary`, `location`, `description`, `rsvp`, `call.name`, a room) of another type is read as empty. A `call` whose `url` is not an http or https address is read as none. An occurrence without an `id`, or whose `start` or `end` is not a date, is left out.

A call that fails because the account has to sign in again throws an error whose `kind` is `SIGN_IN`: Calendar shows a Sign in button that calls `signIn` again. Any other error is shown as it is, and the read is tried again a minute later.

While a provider's mod is not running its accounts stay, unread, with what was read before, and are read as soon as it starts.

## Asking

The provider signing an account in asks the person through the `ask` its `signIn` is handed:

```js
async signIn(account, { title, ask }) {
    const open = await ask({
        message: 'Open the authenticator app?',
        detail: 'It confirms the sign-in on this Mac.',
        confirmLabel: 'Open',
        cancelLabel: 'Cancel',
    });
}
```

Calendar's window comes on screen in front and asks in a dialog under the provider's name, and resolves `true` when the person confirms, `false` when they cancel or close it. It asks only while the provider has a sign-in under way: asked after, it resolves `false`, and a question still open when the provider has no sign-in left under way closes and resolves `false`. Where Calendar is not attached it resolves `false` without asking, and a question still open when it is detached closes and resolves `false`, so a sign-in reads either as a cancel. `detail`, `confirmLabel` and `cancelLabel` are optional (`''`, `OK`, `Cancel`).

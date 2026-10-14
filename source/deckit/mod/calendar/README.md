# Calendar

Day, week and month views of the calendars of your accounts, what is on now and next in the switcher, and a notice before a meeting. Calendar reads no calendar itself: each kind of account comes from a mod that extends its `accounts` point, and with none there is nothing to add.

## Providing accounts

A mod that provides accounts requires Calendar and extends `calendar:accounts`:

```toml
[requires]
calendar = "1.0.0"

[permissions]
"system.network" = "Reads your calendars from Google."
```

```js
deck.extend({
    'calendar:accounts': {
        name: 'Google',
        hint: 'A Google account',
        icon: `<svg …>`,
        async signIn(account, { title }) {},
        async calendars(account) {},
        async events(account, calendar, from, to) {},
        async respond(account, eventId, status) {},
        async forget(account) {},
    },
});
```

Calendar keeps each account as `{ id, provider, email }`, `provider` the mod's id, and hands it to every call. What the account signs in with (cookies, tokens, a web session) is the provider's, kept by `account.id` in its own mod: `deck.web.session('account-' + account.id)` is one way.

| Member | What it is |
|---|---|
| `name`, `hint`, `icon` | what the Add account sheet shows: the provider's name, a line under it, an inline SVG (drawn from its shapes alone) |
| `signIn(account, { title })` | signs the account in and resolves to the address it signed in as, or to nothing when the person cancelled. The sign-in is the provider's to show, in a window of its own (`deck.web.window`, `title` its title), with whatever it asks on the way (a certificate, an app to open). Adding an account, a cancelled or failed sign-in leaves nothing behind; signing an account in again, what it had stays. Called to add an account and to sign one in again; signing in again as another address, compared exactly, is refused |
| `calendars(account)` | `[{ id, name, primary, selected, owned }]`: the account's calendars. `primary` is the account's own, `selected` one its own calendar app shows (a new account starts with those), `owned` one the account owns, whose every event reminds, not only invitations |
| `events(account, calendar, from, to)` | the occurrences of the calendar whose `id` is `calendar` between two Dates, as an array (below). Anything else is a failure, and an answer that takes more than a minute is one too. An occurrence is read in this shape, and a field of another type is read as empty |
| `respond(account, eventId, status)` | answers an invitation (an occurrence with `invited`): `ACCEPTED`, `DECLINED` or `TENTATIVE` |
| `forget(account)` | optional: drop what the provider keeps for `account.id`, so it is signed out. Called when the account is removed (once the provider runs, if it did not then), when a sign-in for a new account turns out to be one already there, and when signing in again lands on another address |

An occurrence, one for each time an event happens, in what every provider maps its own events to:

| Field | What it is |
|---|---|
| `id` | the provider's id for this occurrence, one of its own in the calendar, what `respond` is given; an occurrence without one is left out |
| `uid` | the same meeting across occurrences and calendars; keys the reminders |
| `summary` | its title |
| `start`, `end` | Dates, or what `new Date()` reads; local midnights for an all-day event |
| `allDay` | whether it takes whole days |
| `call` | `{ name, url }` of its video call, or `null` |
| `rooms` | the names of the rooms booked |
| `location` | as written, less what `call` and `rooms` already say |
| `description` | plain text, links kept as addresses |
| `rsvp` | the account's answer, `ACCEPTED`, `DECLINED`, `TENTATIVE` or `NEEDS-ACTION`, or `''` when it is not a guest |
| `invited` | the account is a guest and not the organiser, so it has an answer to give |

A call that fails because the account has to sign in again throws an error whose `kind` is `SIGN_IN`: Calendar shows a Sign in button that calls `signIn` again. Any other error is shown as it is, and the read is tried again a minute later.

While a provider's mod is not running its accounts stay, unread, with what was read before, and are read as soon as it starts.

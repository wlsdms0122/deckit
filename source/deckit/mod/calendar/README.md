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
| `name`, `hint`, `icon` | what the Add account sheet shows: the provider's name, a line under it, an inline SVG |
| `signIn(account, { title })` | signs the account in, in a window of the provider's own (`deck.web.window`, `title` its title), and resolves to the address it signed in as, or to nothing when the person cancelled. A cancelled or failed sign-in leaves nothing behind. Called to add an account and to sign one in again; signing in again as someone else is refused by Calendar |
| `calendars(account)` | `[{ id, name, primary, selected, owned }]`: the account's calendars. `primary` is the account's own, `selected` one its own calendar app shows (a new account starts with those), `owned` one it may change |
| `events(account, calendar, from, to)` | the occurrences in `calendar` between two Dates, each in the shape `src/event.js` describes |
| `respond(account, eventId, status)` | answers an invitation: `ACCEPTED`, `DECLINED` or `TENTATIVE` |
| `forget(account)` | the account is removed: drop what the provider kept for it |

A call that fails because the account has to sign in again throws an error whose `kind` is `SIGN_IN`: Calendar shows a Sign in button that calls `signIn` again. Any other error is shown as it is, and the read is tried again a minute later.

While a provider's mod is not running its accounts stay, unread, with what was read before, and are read as soon as it starts.

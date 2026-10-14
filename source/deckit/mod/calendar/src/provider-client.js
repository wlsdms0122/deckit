const { occurrencesOf } = require('./occurrence.js');

// A provider says an account has to be signed in again by the kind of the error it throws.
const SIGN_IN = 'SIGN_IN';
// How long a provider may take to answer a read before it counts as failed, so one that never answers does not hold
// every account's refresh.
const ANSWER_LIMIT_MS = 60 * 1000;
// Accounts removed while their provider was not running, each forgotten by it once it runs.
const FORGOTTEN = 'forgotten';

// The account providers: the mods that extend the `accounts` point (README.md), by their mod id. Calendar calls a
// provider here alone, and reads what it answers into its own shapes here. An account whose provider is not running
// stays, unread.
function providerClient({ deck, ui, records, accountsPoint, onSigningIn }) {
    // provider mod id -> { name, count, asks }: its sign-ins under way, and the questions they have open
    const signingIn = new Map();

    return { providers, providerOf, isSigningIn, signIn, ask, calendars, events, respond, forget, forgetWaiting };

    function providers() {
        return accountsPoint.extensions();
    }

    function providerOf(account) {
        return providers()[account.provider] || null;
    }

    function isSigningIn() {
        return signingIn.size > 0;
    }

    // The provider signs the account in, in a window of its own, and answers the address it signed in as, or nothing
    // when it was cancelled. A cancelled or failed sign-in leaves nothing behind.
    async function signIn(provider, account, title) {
        const signing = signingIn.get(account.provider) || { name: provider.name, count: 0, asks: new Set() };
        signing.count++;
        signingIn.set(account.provider, signing);
        onSigningIn();
        try {
            return await provider.signIn(account, { title });
        } finally {
            if (--signing.count === 0) {
                signingIn.delete(account.provider);
                for (const close of signing.asks) close();
            }
            onSigningIn();
        }
    }

    // What the provider signing in asks the person on the way (README.md, Asking): Calendar comes on screen and asks in
    // a dialog under the provider's name. Resolves whether the person confirmed, and false once the provider has no
    // sign-in under way. A mod that is not signing in is refused.
    function ask({ message, detail = '', confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
        const signing = signingIn.get(deck.caller());
        if (!signing) return Promise.reject(new Error('Calendar asks only for the provider signing in'));
        deck.show();
        return new Promise((resolve) => {
            let confirmed = false;
            const dialog = ui.dialog({
                title: signing.name,
                message: [String(message ?? ''), String(detail ?? '')],
                confirmLabel: String(confirmLabel),
                cancelLabel: String(cancelLabel),
                onConfirm: () => (confirmed = true),
                // The dialog closes before it confirms.
                onClose: () => {
                    signing.asks.delete(dialog.close);
                    queueMicrotask(() => resolve(confirmed));
                },
            });
            signing.asks.add(dialog.close);
        });
    }

    async function calendars(account) {
        const provider = providerOf(account);
        if (!provider) throw new Error(`${account.provider} is not running, so its calendars cannot be read.`);
        return provider.calendars(account);
    }

    async function events(account, calendar, from, to) {
        const provider = providerOf(account);
        if (!provider) throw new Error(`${account.provider} is not running`);
        const answer = await withinLimit(provider, provider.events(account, calendar, from, to));
        if (!Array.isArray(answer)) throw new Error(`${provider.name} answered no list of events`);
        return occurrencesOf(answer);
    }

    async function respond(account, occurrenceId, status) {
        const provider = providerOf(account);
        if (!provider) throw new Error(`${account.provider} is not running`);
        await provider.respond(account, occurrenceId, status);
    }

    // What a provider keeps for an account goes with it; one that keeps nothing has no forget(). One whose provider is
    // not running waits for it.
    async function forget(account) {
        const provider = providerOf(account);
        if (!provider) return records.set(FORGOTTEN, [...records.get(FORGOTTEN, []), account]);
        await Promise.resolve(provider.forget?.(account)).catch(() => {});
    }

    function forgetWaiting() {
        const waiting = records.get(FORGOTTEN, []);
        const left = waiting.filter((account) => !providerOf(account));
        if (left.length === waiting.length) return;
        for (const account of waiting) if (providerOf(account)) forget(account);
        records.set(FORGOTTEN, left);
    }
}

function asksToSignIn(error) {
    return error?.kind === SIGN_IN;
}

function withinLimit(provider, asking) {
    let timer = null;
    const limit = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${provider.name} did not answer`)), ANSWER_LIMIT_MS);
    });
    return Promise.race([asking, limit]).finally(() => clearTimeout(timer));
}

module.exports = { providerClient, asksToSignIn };

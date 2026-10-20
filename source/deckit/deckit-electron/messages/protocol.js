// The channels of Electron's IPC every message of deck's crosses over, each carrying its channel's name beside what
// it says, as deck's router says (deckit-shell/deck/ipc/model/envelope.js).
import * as CHANNEL from '../../deckit-shell/deck/channel/index.js';
import * as ENVELOPE from '../../deckit-shell/deck/ipc/model/envelope.js';

export const pageTells = CHANNEL.pageToMain('deckit-electron:page-tells', ENVELOPE.told.fields);
export const pageAsks = CHANNEL.pageToMain('deckit-electron:page-asks', ENVELOPE.asked.fields, { reply: true });
export const pageAsksSync = CHANNEL.pageToMain('deckit-electron:page-asks-sync', ENVELOPE.askedSync.fields, {
    reply: true,
    sync: true,
});
export const mainTells = CHANNEL.mainToPage('deckit-electron:main-tells');
export const mainAsks = CHANNEL.mainToPage('deckit-electron:main-asks');
export const pageAnswers = CHANNEL.pageToMain('deckit-electron:page-answers', ENVELOPE.answer.fields);

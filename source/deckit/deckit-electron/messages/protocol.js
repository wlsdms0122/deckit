// The channels of Electron's IPC every message of deck's crosses over: what a page tells main, asks it, and asks it
// sync, and what main tells a page. A question main asks a page, and its answer, go as tells.
export const pageTells = 'deckit-electron:page-tells';
export const pageAsks = 'deckit-electron:page-asks';
export const pageAsksSync = 'deckit-electron:page-asks-sync';
export const mainTells = 'deckit-electron:main-tells';

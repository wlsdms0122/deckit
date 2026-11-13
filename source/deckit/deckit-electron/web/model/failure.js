import { KINDS } from '../../../deckit-shell/web/engine/model/load-failure.js';

// MARK: - Property
// WebKit's codes for a load that failed (the URL loading system's), by the kind the web engine tells (KINDS).
const CODES = {
    'no-connection': [-1009, -1005, -1018, -1019, -1020],
    'host-not-found': [-1003, -1006],
    refused: [-1004],
    'timed-out': [-1001],
};
// A load stopped or replaced, and a certificate refused, which the web engine tells of in its own way: no failure.
const NONE = [-999, -1200, -1201, -1202, -1203, -1204, -1205, -1206];

// MARK: - Initializer
// MARK: - Public
// The kind of a load that failed with WebKit's `code`, or null for one that is no failure of the load.
function kindOf(code) {
    if (NONE.includes(code)) return null;
    const kind = Object.keys(CODES).find((one) => CODES[one].includes(code)) ?? 'other';
    return KINDS.includes(kind) ? kind : 'other';
}

// MARK: - Private

export { kindOf };

// MARK: - Property
// What a page's main frame that failed to load is told by, in its state (`failure`), named by what the layer over the
// web engine says of it: no network to send it on, no host by its name, a host that refused the connection, one that
// did not answer in time, and any other way a load fails.
const KINDS = Object.freeze(['no-connection', 'host-not-found', 'refused', 'timed-out', 'other']);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { KINDS };

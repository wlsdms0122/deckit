// Between a party on a transport connection that arrived from outside and main: JSON-RPC 2.0, a message a line. Once
// the core verified its key the party is a run of its principal's job, and what it asks and is told is what a run's
// page asks and is told, by another name: the principal and the run are never in a message, the transport connection
// says both.
// MARK: - Property
const PROTOCOL = 1; // the version of this protocol
// How long a line may be, in bytes: before the party is verified, and after.
const LIMIT = Object.freeze({ before: 4096, after: 1048576 });
// JSON-RPC's codes, as the core answers them (deckit/core).
const CODE = Object.freeze({ invalidRequest: -32600, methodNotFound: -32601, notInitialized: -32002, failed: -32803 });
// What a party is told while its admission waits for the local seat's answer, before `authenticate` answers.
const ASKING = 'attach/asking';

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { PROTOCOL, LIMIT, CODE, ASKING };

// What a host app reads of deckit before it runs it: the version of the mod contract.
// MARK: - Property
// The version of the mod contract this deckit is written to, which a manifest's `api` is written against. Deckit runs
// mods with it where the host app names no other (connect's `config.api`).
const API = '1.0.0';

export { API };

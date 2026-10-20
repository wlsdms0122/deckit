// What a host app reads of deck before it runs it, with nothing of Electron's: the version of the mod contract and
// the scheme its pages load from.
// MARK: - Property
// The version of the mod contract this deck runs mods with, which a manifest's `api` is written against.
const API = '1.0.0';

export { API };
export { SCHEME } from '../sandbox/model/origin.js';

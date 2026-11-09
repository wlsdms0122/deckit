// MARK: - Property
// The manifest fields the shell reads of a mod, whether it runs or not, named to deckit before its core starts.
const KEYS = Object.freeze(['activationPolicy', 'view', 'icon', 'keywords']);
// What a mod is on the desktop: an app the Dock shows while it runs, or one it never shows.
const REGULAR = 'regular';
const ACCESSORY = 'accessory';

// MARK: - Initializer
// MARK: - Public
// Each reads `fields`, a mod's manifest fields by key, as far as it can: what does not read is left out.

// The mod's activation policy: ACCESSORY where its fields say so, else REGULAR.
function activationPolicyOf(fields) {
    return fields?.activationPolicy === ACCESSORY ? ACCESSORY : REGULAR;
}

// The interface whose owner's regions show the mod's view, or null for a mod whose fields give it no view in a
// region: one naming as parent an interface not in the mod's `uses` gives none.
function parentOf(fields, mod) {
    const parent = fields?.view?.parent;
    return typeof parent === 'string' && Object.hasOwn(mod?.uses ?? {}, parent) ? parent : null;
}

// The icon the mod is listed with, an SVG, or ''.
function iconOf(fields) {
    return typeof fields?.icon === 'string' ? fields.icon : '';
}

// The words the mod is found by beside its name.
function keywordsOf(fields) {
    const keywords = fields?.keywords;
    return Array.isArray(keywords) ? keywords.filter((word) => typeof word === 'string' && word) : [];
}

// MARK: - Private

export { KEYS, REGULAR, ACCESSORY, activationPolicyOf, parentOf, iconOf, keywordsOf };

// MARK: - Property
// The manifest fields the panel reads of a mod, whether it runs or not, named to deckit before its core starts.
const KEYS = Object.freeze(['view', 'icon', 'keywords']);

// MARK: - Initializer
// MARK: - Public
// Each reads `fields`, a mod's manifest fields by key, as far as it can: what does not read is left out.

// The mod's screen, `{ sidebar, parent }`, or null for a mod with none: `sidebar` whether the view lends the panel's
// sidebar, `parent` the interface whose owner's regions show it, or null. A view naming as parent an interface not in
// the mod's `uses` is left out.
function viewOf(fields, mod) {
    const view = fields?.view;
    if (!view || typeof view !== 'object' || Array.isArray(view)) return null;
    const parent = view.parent ?? null;
    if (parent !== null && (typeof parent !== 'string' || !Object.hasOwn(mod?.uses ?? {}, parent))) return null;
    return { sidebar: view.sidebar === true, parent };
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

export { KEYS, viewOf, iconOf, keywordsOf };

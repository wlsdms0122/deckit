// MARK: - Property
// The manifest fields the shell reads of a mod, whether it runs or not, named to deckit before its core starts.
const KEYS = Object.freeze(['activationPolicy', 'view', 'icon', 'keywords']);
// What a mod is on the desktop: an app the Dock shows while it runs, or one it never shows.
const REGULAR = 'regular';
const ACCESSORY = 'accessory';
// The most an icon's file holds, in bytes.
const ICON_BYTES = 32768;

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

// The path of the mod's icon file in its folder, `/` separated as a manifest writes a path, or null.
function iconPathOf(fields) {
    return typeof fields?.icon === 'string' && fields.icon ? fields.icon : null;
}

// The icon a mod is listed with, of `text`, its icon file's text, or null for no file: that text where it is an SVG
// image the shell draws, at most ICON_BYTES, its root `<svg>` with a square `viewBox`; else ''.
function iconOf(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > ICON_BYTES) return '';
    const root = /^(?:\s|<\?[^]*?\?>|<!--[^]*?-->|<!DOCTYPE[^>]*>)*<svg(?=[\s/>])([^>]*)>/i.exec(text);
    const viewBox = root && /\sviewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(root[1]);
    const box =
        viewBox &&
        (viewBox[1] ?? viewBox[2])
            .trim()
            .split(/[\s,]+/)
            .map(Number);
    const square = box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[2] === box[3];
    return square ? text : '';
}

// The words the mod is found by beside its name.
function keywordsOf(fields) {
    const keywords = fields?.keywords;
    return Array.isArray(keywords) ? keywords.filter((word) => typeof word === 'string' && word) : [];
}

// MARK: - Private

export { KEYS, REGULAR, ACCESSORY, ICON_BYTES, activationPolicyOf, parentOf, iconPathOf, iconOf, keywordsOf };

// What a mod's contributes file declares that the shell reads, whether the mod runs or not, read as far as it can
// be: what does not read is left out.

// The mod's screen, `{ sidebar, parent }`, or null for a mod with none: `sidebar` whether the view lends the panel's
// sidebar, `parent` the interface whose owner's regions show it, or null. A view naming as parent an interface not in
// the mod's `uses` is left out.
export function viewOf(contributes, mod) {
    const view = contributes?.view;
    if (!view || typeof view !== 'object' || Array.isArray(view)) return null;
    const parent = view.parent ?? null;
    if (parent !== null && (typeof parent !== 'string' || !Object.hasOwn(mod?.uses ?? {}, parent))) return null;
    return { sidebar: view.sidebar === true, parent };
}

// The icon the mod is listed with, an SVG, or ''.
export function iconOf(contributes) {
    return typeof contributes?.icon === 'string' ? contributes.icon : '';
}

// The words the mod is found by beside its name.
export function keywordsOf(contributes) {
    const keywords = contributes?.keywords;
    return Array.isArray(keywords) ? keywords.filter((word) => typeof word === 'string' && word) : [];
}

// How the mod's configuration is drawn: by each key its contributes declares under `configuration`, the hints
// `placeholder`, `unit`, `step`, `inherits`, and `choices`, the name of a list the shell has.
export function formOf(contributes) {
    const form = contributes?.form;
    if (!form || typeof form !== 'object' || Array.isArray(form)) return {};
    const configuration = Array.isArray(contributes.configuration) ? contributes.configuration : [];
    const declared = new Set(configuration.map((declaration) => declaration?.key));
    const out = {};
    for (const [key, hints] of Object.entries(form))
        if (declared.has(key) && hints && typeof hints === 'object') out[key] = hints;
    return out;
}

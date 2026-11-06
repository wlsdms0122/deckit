// A name scoped by the mod that owns it, as another mod names it: `<mod id>:<name>`. An event and an extension point
// are named so. A mod id holds no colon, as the core reads ids, so the first one ends it.
const SEPARATOR = ':';

function scopedName(modId, name) {
    return modId + SEPARATOR + name;
}

// Whether it names both a mod and a name of that mod's.
function isScoped(scoped) {
    const at = scoped.indexOf(SEPARATOR);
    return at > 0 && at < scoped.length - 1;
}

function modOf(scoped) {
    return scoped.slice(0, scoped.indexOf(SEPARATOR));
}

function nameOf(scoped) {
    return scoped.slice(scoped.indexOf(SEPARATOR) + 1);
}

export { scopedName, isScoped, modOf, nameOf };

// The manifest fields the layers on this host read: top-level keys of a manifest beside deckit's own, which the core
// accepts and hands up as written, each under `manifest.fields` by its key. One no layer names is not a manifest field.
export function createManifestField() {
    // MARK: - Property
    const named = []; // each key, in the order it was named
    let handed = false; // the core has them

    // MARK: - Initializer
    // MARK: - Public
    // A key a layer on this host reads, named once, before the core starts. The core refuses one of its own keys.
    function define(key) {
        if (handed) throw new Error(`[deckit] the manifest field ${key} is named after the core started`);
        if (typeof key !== 'string' || !key.trim()) throw new Error("[deckit] a manifest field's key is no text");
        if (named.includes(key)) throw new Error(`[deckit] the manifest field ${key} is named twice`);
        named.push(key);
    }

    // What the core reads every manifest with, as it starts.
    function all() {
        handed = true;
        return { fields: [...named] };
    }

    // MARK: - Private

    return { define, all };
}

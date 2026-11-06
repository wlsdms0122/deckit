// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What crosses a connection, as JSON: `value`, the given one's data, and `references`, `[path, number]` for each
// function in it, by the number `numberOf(function, holder)` gives it. An object's own enumerable data is copied, and
// its functions and its class's methods, up to Object's, cross as references, a method held with the object it is
// called on. A getter, a private field and what class it is do not cross. A value with `toJSON` crosses as what that
// answers, and another of the platform's own kinds (a Map, a Set, an Error) does not cross.
function describe(given, numberOf) {
    const references = [];
    const walk = (value, path, holding) => {
        if (typeof value === 'function') {
            references.push([path, numberOf(value, null)]);
            return undefined;
        }
        if (
            typeof value === 'bigint' ||
            typeof value === 'symbol' ||
            (typeof value === 'number' && !Number.isFinite(value))
        )
            throw new Error(`${named(path)} is ${String(value)}, which JSON does not hold`);
        if (!value || typeof value !== 'object') return value;
        if (typeof value.toJSON === 'function') return walk(value.toJSON(), path, holding);
        if (holding.includes(value)) throw new Error(`${named(path)} holds itself`);
        const inside = [...holding, value];
        if (Array.isArray(value)) return value.map((inner, index) => walk(inner, [...path, index], inside) ?? null);
        const kind = Object.getPrototypeOf(value)?.constructor;
        if (kind && kind !== Object && /\[native code\]/.test(Function.prototype.toString.call(kind)))
            throw new Error(`${named(path)} is a ${kind.name}, which does not cross: hand its data as JSON`);
        const out = {};
        const taken = new Set();
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
            taken.add(key);
            if (!descriptor.enumerable || !('value' in descriptor)) continue;
            const copied = walk(descriptor.value, [...path, key], inside);
            if (copied !== undefined) out[key] = copied;
        }
        for (let at = Object.getPrototypeOf(value); at && at !== Object.prototype; at = Object.getPrototypeOf(at)) {
            for (const key of Object.getOwnPropertyNames(at)) {
                const method = Object.getOwnPropertyDescriptor(at, key).value;
                if (key === 'constructor' || taken.has(key) || typeof method !== 'function') continue;
                taken.add(key);
                references.push([[...path, key], numberOf(method, value)]);
            }
        }
        return out;
    };
    return { value: walk(given, [], []) ?? null, references };
}

// The value described, with what `referenceOf(number)` answers at each reference's path. A path names the value's own
// properties, defined rather than assigned: `__proto__` is a property like any other.
function materialize({ value, references }, referenceOf) {
    let out = value;
    for (const [path, number] of references) {
        const reference = referenceOf(number);
        if (!path.length) {
            out = reference;
            continue;
        }
        let at = out;
        for (const key of path.slice(0, -1)) {
            if (!Object.hasOwn(at, key) || !at[key] || typeof at[key] !== 'object') own(at, key, {});
            at = at[key];
        }
        own(at, path.at(-1), reference);
    }
    return out;
}

// MARK: - Private
function own(at, key, value) {
    Object.defineProperty(at, key, { value, enumerable: true, writable: true, configurable: true });
}

function named(path) {
    return path.join('.') || 'it';
}

export { describe, materialize };

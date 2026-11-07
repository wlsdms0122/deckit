// The args a command takes, as a subset of JSON Schema, read as JSON Schema reads it: `type`, `properties`,
// `required`, `items`, `enum`, and `oneOf` of `const`s, with `title` and `description` anywhere. The args are an
// object.

// MARK: - Property
const KEYWORDS = new Set(['type', 'properties', 'required', 'items', 'enum', 'oneOf', 'title', 'description']);
const CHOICE_KEYWORDS = new Set(['const', 'title', 'description']);
const TYPES = ['array', 'boolean', 'integer', 'number', 'object', 'string'];

// MARK: - Initializer
// MARK: - Public
// Why `schema` cannot be a command's params, or null.
function problemOfParams(schema) {
    return problemOfSchema(schema) ?? (schema.type === 'object' ? null : "takes { type: 'object' }");
}

// Why `value`, JSON, does not fit `schema`, one `problemOfParams` took, at `path`, or null.
function problemOfValue(value, schema, path) {
    if (schema.type !== undefined && !isOfType(value, schema.type))
        return `${path} is not ${['array', 'integer', 'object'].includes(schema.type) ? 'an' : 'a'} ${schema.type}`;
    if (schema.enum && !schema.enum.some((choice) => same(choice, value))) return `${path} is not one of what it takes`;
    if (schema.oneOf && !schema.oneOf.some((choice) => same(choice.const, value)))
        return `${path} is not one of what it takes`;
    if (isObject(value)) {
        for (const name of schema.required ?? []) if (!Object.hasOwn(value, name)) return `${path} needs "${name}"`;
        for (const name of Object.keys(value).sort()) {
            const property = schema.properties?.[name];
            if (!property) continue;
            const problem = problemOfValue(value[name], property, `${path}.${name}`);
            if (problem) return problem;
        }
    }
    if (Array.isArray(value) && schema.items) {
        for (const [index, element] of value.entries()) {
            const problem = problemOfValue(element, schema.items, `${path}[${index}]`);
            if (problem) return problem;
        }
    }
    return null;
}

// MARK: - Private
function problemOfSchema(schema) {
    if (!isObject(schema)) return 'has a schema that is no object';
    const unknown = Object.keys(schema)
        .sort()
        .find((keyword) => !KEYWORDS.has(keyword));
    if (unknown) return `has "${unknown}", which commands does not read`;
    if (schema.type !== undefined && !TYPES.includes(schema.type))
        return `has a "type" that is not one of ${TYPES.join(', ')}`;
    if (schema.properties !== undefined) {
        if (!isObject(schema.properties)) return 'has "properties" that are no object';
        for (const property of Object.values(schema.properties)) {
            const problem = problemOfSchema(property);
            if (problem) return problem;
        }
    }
    if (
        schema.required !== undefined &&
        !(Array.isArray(schema.required) && schema.required.every((name) => typeof name === 'string'))
    )
        return 'has a "required" that is not a list of names';
    if (schema.items !== undefined) {
        const problem = problemOfSchema(schema.items);
        if (problem) return problem;
    }
    if (schema.enum !== undefined && !(Array.isArray(schema.enum) && schema.enum.length))
        return 'has an "enum" that is not a list of values';
    if (
        schema.oneOf !== undefined &&
        !(
            Array.isArray(schema.oneOf) &&
            schema.oneOf.length &&
            schema.oneOf.every(
                (choice) =>
                    isObject(choice) &&
                    Object.hasOwn(choice, 'const') &&
                    Object.keys(choice).every((keyword) => CHOICE_KEYWORDS.has(keyword))
            )
        )
    )
        return 'has a "oneOf" that is not a list of { const, title }';
    return null;
}

function isOfType(value, type) {
    switch (type) {
        case 'object':
            return isObject(value);
        case 'array':
            return Array.isArray(value);
        case 'integer':
            return Number.isInteger(value);
        default:
            return typeof value === type;
    }
}

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Whether two JSON values are one value.
function same(one, other) {
    if (Array.isArray(one))
        return Array.isArray(other) && one.length === other.length && one.every((each, at) => same(each, other[at]));
    if (isObject(one)) {
        if (!isObject(other)) return false;
        const keys = Object.keys(one);
        return (
            keys.length === Object.keys(other).length &&
            keys.every((key) => Object.hasOwn(other, key) && same(one[key], other[key]))
        );
    }
    return one === other;
}

module.exports = { problemOfParams, problemOfValue };

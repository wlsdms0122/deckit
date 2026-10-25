// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What the switcher reads of a command's `params`, the JSON Schema of its args, or null for one that takes none: the
// args it asks a person for and where their values come from. A command is run from the list only when each arg it
// requires can be filled, from the values the schema lists in `enum` or `oneOf`, or, for a string, from what its
// completion offers or as typed.

// Whether each arg `params` requires can be filled.
function fillable(params) {
    return requiredOf(params).every((name) => choicesOf(params, name) || takesText(params, name));
}

// The first arg `params` requires that `args` has not, or null when none is left.
function next(params, args) {
    return requiredOf(params).find((name) => !Object.hasOwn(args, name)) ?? null;
}

// The values the schema lists for the arg `name`, as completion answers them, or null where it lists none.
function choicesOf(params, name) {
    const schema = propertyOf(params, name);
    if (Array.isArray(schema?.enum)) return schema.enum.map((value) => candidate(value, String(value)));
    if (Array.isArray(schema?.oneOf))
        return schema.oneOf.map((choice) =>
            candidate(choice?.const, typeof choice?.title === 'string' ? choice.title : String(choice?.const))
        );
    return null;
}

// Whether whatever a person types is a value of the arg `name`.
function takesText(params, name) {
    return propertyOf(params, name)?.type === 'string' && !choicesOf(params, name);
}

// What a person is asked for the arg `name`.
function titleOf(params, name) {
    const title = propertyOf(params, name)?.title;
    return typeof title === 'string' && title ? title : name;
}

// MARK: - Private
function requiredOf(params) {
    return Array.isArray(params?.required) ? params.required : [];
}

function propertyOf(params, name) {
    return params?.properties?.[name] ?? null;
}

function candidate(value, title) {
    return { value, title, hint: '', keywords: [] };
}

module.exports = { fillable, next, choicesOf, takesText, titleOf };

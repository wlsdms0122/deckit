// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What a command's completion answered, as every caller reads it: `[{ value, title, hint, keywords }]`, each with a
// value, the title its value as text where it gave none.
function candidatesOf(found) {
    return (Array.isArray(found) ? found : [])
        .filter((candidate) => candidate && candidate.value !== undefined)
        .map((candidate) => ({
            value: candidate.value,
            title: typeof candidate.title === 'string' ? candidate.title : String(candidate.value),
            hint: typeof candidate.hint === 'string' ? candidate.hint : '',
            keywords: strings(candidate.keywords),
        }));
}

// MARK: - Private
function strings(list) {
    return Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : [];
}

export { candidatesOf };

// JSON-RPC 2.0, a message a line.
// MARK: - Property
const VERSION = '2.0';

// MARK: - Initializer
// MARK: - Public
// A string, a key's too, goes as the text it is: a lone surrogate, which is no text and which the core would not read,
// goes as U+FFFD.
function request(id, method, params) {
    return JSON.stringify({ jsonrpc: VERSION, id, method, params }, (_key, value) => {
        if (typeof value === 'string' || value instanceof String) return String(value).toWellFormed();
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
        if (Object.keys(value).every((key) => key.isWellFormed())) return value;
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key.toWellFormed(), inner]));
    });
}

// A response: `{ id, result }`, or `{ id, error }` with the error the core refused with, its kind put back on it.
function read(line) {
    const { id = null, result = null, error = null } = JSON.parse(line);
    return { id, result, error: error && Object.assign(new Error(error.message), { kind: error.data?.kind ?? null }) };
}

// MARK: - Private

export { request, read };

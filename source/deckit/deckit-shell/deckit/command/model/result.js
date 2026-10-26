// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What a command's run answered, as every caller reads it: a copy of it as JSON, or null for nothing. One that JSON
// does not hold is why it did not run.
function resultOf(value) {
    if (value === undefined || value === null) return null;
    let text;
    try {
        text = JSON.stringify(value);
    } catch (error) {
        throw new Error(`its result cannot be copied as JSON: ${error.message || error}`);
    }
    if (text === undefined) throw new Error('its result cannot be copied as JSON');
    return JSON.parse(text);
}

// MARK: - Private
export { resultOf };

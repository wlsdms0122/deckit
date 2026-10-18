const fieldsOf = (spec) => Object.entries(spec.inputs || {}).map(([name, raw]) => {
const body = typeof raw === "string" ? { type: raw } : raw;
return { ...body, name, optional: Object.hasOwn(body, "default") };
});


const inputsOf = (fields, draft) => {
const inputs = {};
for (const field of fields) {
const raw = draft[field.name] ?? "";
if (raw === "" && field.optional) continue;
if (field.type === "int") {
const value = Number(raw);
if (raw.trim() === "" || !Number.isSafeInteger(value)) throw new Error(`${field.name}: enter a whole number`);
inputs[field.name] = value;
} else if (field.type === "bool") {
if (raw !== "true" && raw !== "false") throw new Error(`${field.name}: choose true or false`);
inputs[field.name] = raw === "true";
} else {
inputs[field.name] = raw;
}
}
return inputs;
};

module.exports = { fieldsOf, inputsOf };

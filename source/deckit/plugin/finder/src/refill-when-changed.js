const filledSignatures = new WeakMap(); // element -> the signature it was last filled for, as JSON

// Fills `element` again only when `signature`, the values it shows, changed, so a row under the pointer or being
// dragged stays as it is.
function refillWhenChanged(element, signature, fill) {
    const key = JSON.stringify(signature);
    if (filledSignatures.get(element) === key) return;
    filledSignatures.set(element, key);
    fill();
}

module.exports = { refillWhenChanged };

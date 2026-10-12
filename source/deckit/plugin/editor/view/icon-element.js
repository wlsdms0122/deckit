// An icon's markup in a span of `className`, for a row or a button to hold.
function iconElement(ui, className, svg) {
    const element = ui.element('span', { className });
    element.innerHTML = svg;
    return element;
}

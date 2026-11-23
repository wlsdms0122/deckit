// MARK: - Property
// What the content takes a press on as its own in a title bar, by what it is: an element that matches, or one editable.
const TAKES = "button, input, textarea, select, a[href], [role='button'], [tabindex]";

// MARK: - Initializer
// MARK: - Public
// Whether a press of a document's is a drag of its window. `bar` is the height of the title bar over the document, or
// null where none lies over it; `y` the press's from the document's top; `path` the pressed element and each element
// it lies in up to the root, each `{ takes, region }`, `takes` whether it is one TAKES names or editable, `region` the
// value of its `--app-region`. Within the bar the press is the bar's, a drag, but on what the content takes, an
// element that takes or whose region is `no-drag`, or what lies in one. Anywhere else it drags where the pressed
// element's region is `drag`.
function drags({ bar, y, path }) {
    if (bar !== null && y < bar) return !path.some(({ takes, region }) => takes || region === 'no-drag');
    return path[0]?.region === 'drag';
}

// MARK: - Private

export { TAKES, drags };

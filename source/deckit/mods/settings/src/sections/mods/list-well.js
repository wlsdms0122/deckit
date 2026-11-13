// The rules of a well: a list's rows laid in a tint, with no edge, each split from the one before by a divider. The
// dependency list and the permission list are drawn in one. In an opened row the box is the well, so a list there
// draws its rows alone. The Mods section adopts them once.
const LIST_WELL_STYLE = `
    .settings-well { overflow: hidden; border-radius: var(--deckit-radius-control); background: var(--deckit-surface); }
    .settings-well > * + * { border-top: 1px solid var(--deckit-divider); }
    .settings-details-box .settings-well { border-radius: 0; background: none; }
    .settings-details-box .settings-well > * { padding-left: 0; padding-right: 0; }
`;

// A well with the class `className` besides, its rows to be put in.
function listWell(ui, className) {
    return ui.element('div', { className: `settings-well ${className}` });
}

module.exports = { LIST_WELL_STYLE, listWell };

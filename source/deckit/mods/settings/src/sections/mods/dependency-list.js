// The rules of a dependency list. The Mods section adopts them once.
const DEPENDENCY_LIST_STYLE = `
    .settings-dependencies { overflow: hidden; border: var(--deckit-border); border-radius: var(--deckit-radius-large); }
    .settings-dependency {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: 8px;
        padding: 8px 12px;
        line-height: 1.45;
    }
    .settings-dependency + .settings-dependency { border-top: var(--deckit-border); }
    .settings-dependency-name { font: 600 var(--deckit-type-body); }
    .settings-dependency-requirement {
        color: var(--deckit-muted);
        font: var(--deckit-type-small);
        font-family: var(--deckit-mono);
    }
    .settings-dependency-state { margin-left: auto; color: var(--deckit-muted); font: var(--deckit-type-small); }
    .settings-dependency-state[data-unmet] { color: var(--deckit-alert-ink); }
`;

// The mods a mod depends on: each one's name, its requirement, and the version installed, marked where the requirement
// does not take it. `dependencies` as a deckit/packages dry run answers them; `nameOf(id)` names the mod of an id.
function dependencyList({ ui, dependencies, nameOf }) {
    const element = ui.element('div', { className: 'settings-dependencies' });

    for (const { id, requirement, installed, satisfied } of dependencies) {
        const row = ui.element('div', { className: 'settings-dependency' });
        const state = ui.element('span', {
            className: 'settings-dependency-state',
            text: installed === undefined ? 'Not installed' : `${installed} installed`,
        });
        state.toggleAttribute('data-unmet', !satisfied);
        row.append(
            ui.element('span', { className: 'settings-dependency-name', text: nameOf(id) }),
            ui.element('span', { className: 'settings-dependency-requirement', text: requirement }),
            state
        );
        element.append(row);
    }
    return { element };
}

module.exports = { DEPENDENCY_LIST_STYLE, dependencyList };

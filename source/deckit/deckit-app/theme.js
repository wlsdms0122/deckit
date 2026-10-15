// Deckit.app's look, light or dark as the system's appearance is: the theme it gives deckit's shell, and the
// colour its windows' bars are drawn in.
const FONT = '-apple-system, system-ui, sans-serif';
const LOOKS = {
    dark: {
        theme: { contentBg: '#1a1d21', contentColor: '#d1d2d3', border: '1px solid rgba(121,124,129,.3)', font: FONT },
        bar: { background: [26, 29, 33], color: '#d1d2d3' },
    },
    light: {
        theme: { contentBg: '#ffffff', contentColor: '#1d1c1d', border: '1px solid rgba(29,28,29,.13)', font: FONT },
        bar: { background: [255, 255, 255], color: '#1d1c1d' },
    },
};

function createTheme() {
    // MARK: - Property
    const { nativeTheme } = require('electron');

    // MARK: - Initializer
    // MARK: - Public
    function now() {
        return LOOKS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];
    }

    // `listener` hears that the system's appearance changed.
    function onChange(listener) {
        nativeTheme.on('updated', listener);
    }

    // MARK: - Private

    return { now, onChange, FONT };
}

module.exports = { createTheme };

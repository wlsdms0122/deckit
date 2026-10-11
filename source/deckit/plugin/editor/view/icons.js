// Icon shapes are Lucide's (ISC licence).
// A dotfile with no other dot (".env") is named by what follows the dot.
const extOf = (path) => {
    const name = String(path).split('/').pop() || '';
    const i = name.lastIndexOf('.');
    return i > 0 || (i === 0 && name.length > 1) ? name.slice(i + 1).toLowerCase() : '';
};

const FILE_KINDS = (() => {
    // language is a key of the engine's language table.
    const k = (name, color, shape, language = null) => ({ name, color, shape, language });
    return {
        swift: k('Swift', '#f05138', 'code', 'swift'),
        m: k('Objective-C', '#438eff', 'code', 'objectiveC'),
        mm: k('Objective-C++', '#6866fb', 'code', 'objectiveC'),
        h: k('C Header', '#a3a3a3', 'code', 'c'),
        c: k('C', '#a3a3a3', 'code', 'c'),
        cpp: k('C++', '#f34b7d', 'code', 'cpp'),
        cc: k('C++', '#f34b7d', 'code', 'cpp'),
        hpp: k('C++ Header', '#f34b7d', 'code', 'cpp'),
        cs: k('C#', '#178600', 'code', 'csharp'),
        kt: k('Kotlin', '#a97bff', 'code', 'kotlin'),
        kts: k('Kotlin Script', '#a97bff', 'code', 'kotlin'),
        java: k('Java', '#b07219', 'code', 'java'),
        gradle: k('Gradle', '#02303a', 'code', 'kotlin'),
        js: k('JavaScript', '#e8c547', 'code', 'javascript'),
        mjs: k('JavaScript', '#e8c547', 'code', 'javascript'),
        cjs: k('JavaScript', '#e8c547', 'code', 'javascript'),
        jsx: k('JSX', '#61dafb', 'code', 'jsx'),
        ts: k('TypeScript', '#3178c6', 'code', 'typescript'),
        tsx: k('TSX', '#3178c6', 'code', 'tsx'),
        py: k('Python', '#3572a5', 'code', 'python'),
        rb: k('Ruby', '#cc342d', 'code', 'ruby'),
        go: k('Go', '#00add8', 'code', 'go'),
        rs: k('Rust', '#dea584', 'code', 'rust'),
        sh: k('Shell', '#89e051', 'code', 'shell'),
        zsh: k('Shell', '#89e051', 'code', 'shell'),
        bash: k('Shell', '#89e051', 'code', 'shell'),
        html: k('HTML', '#e34c26', 'code', 'html'),
        htm: k('HTML', '#e34c26', 'code', 'html'),
        css: k('CSS', '#663399', 'code', 'css'),
        scss: k('SCSS', '#c6538c', 'code', 'css'),
        sql: k('SQL', '#e38c00', 'code', 'sql'),
        json: k('JSON', '#cbcb41', 'text', 'json'),
        yaml: k('YAML', '#cb171e', 'text', 'yaml'),
        yml: k('YAML', '#cb171e', 'text', 'yaml'),
        toml: k('TOML', '#9c4221', 'text', 'toml'),
        xml: k('XML', '#e37933', 'text', 'xml'),
        svg: k('SVG', '#ffb13b', 'text', 'xml'),
        plist: k('Property List', '#e37933', 'text', 'xml'),
        strings: k('Strings', '#e37933', 'text', 'properties'),
        pbxproj: k('Xcode Project', '#438eff', 'text'),
        xcconfig: k('Xcode Config', '#438eff', 'text', 'properties'),
        properties: k('Properties', '#a3a3a3', 'text', 'properties'),
        env: k('Environment', '#a3a3a3', 'text', 'properties'),
        md: k('Markdown', '#519aba', 'text', 'markdown'),
        markdown: k('Markdown', '#519aba', 'text', 'markdown'),
        diff: k('Diff', '#a3a3a3', 'text', 'diff'),
        patch: k('Diff', '#a3a3a3', 'text', 'diff'),
        txt: k('Plain Text', '#a3a3a3', 'text'),
    };
})();
const kindOf = (path) => FILE_KINDS[extOf(path)] || null;

const fileIcons = (() => {
    const svg = (paths, size, color) =>
        `<svg viewBox="0 0 24 24" aria-hidden="true" width="${size}" height="${size}" style="display:block;flex:0 0 auto" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    const FILE = `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>`;
    const SHAPES = {
        code: FILE + `<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/>`,
        text: FILE + `<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
    };

    return {
        file: (name, size = 15) => {
            const kind = kindOf(name);
            return svg(kind ? SHAPES[kind.shape] : FILE, size, kind ? kind.color : '#9a9a9a');
        },
        language: (name) => kindOf(name)?.name || 'Plain Text',
    };
})();

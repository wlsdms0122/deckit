const { nameOf } = require('./path.js');

// What a file is, by its extension: the name shown for it, its colour and icon shape, and its language mode, a key of
// the engine's languages.
const FILE_TYPES = {
    swift: { name: 'Swift', color: '#f05138', shape: 'code', mode: 'swift' },
    m: { name: 'Objective-C', color: '#438eff', shape: 'code', mode: 'objectiveC' },
    mm: { name: 'Objective-C++', color: '#6866fb', shape: 'code', mode: 'objectiveC' },
    h: { name: 'C Header', color: '#a3a3a3', shape: 'code', mode: 'c' },
    c: { name: 'C', color: '#a3a3a3', shape: 'code', mode: 'c' },
    cpp: { name: 'C++', color: '#f34b7d', shape: 'code', mode: 'cpp' },
    cc: { name: 'C++', color: '#f34b7d', shape: 'code', mode: 'cpp' },
    hpp: { name: 'C++ Header', color: '#f34b7d', shape: 'code', mode: 'cpp' },
    cs: { name: 'C#', color: '#178600', shape: 'code', mode: 'csharp' },
    kt: { name: 'Kotlin', color: '#a97bff', shape: 'code', mode: 'kotlin' },
    kts: { name: 'Kotlin Script', color: '#a97bff', shape: 'code', mode: 'kotlin' },
    java: { name: 'Java', color: '#b07219', shape: 'code', mode: 'java' },
    gradle: { name: 'Gradle', color: '#02303a', shape: 'code', mode: 'kotlin' },
    js: { name: 'JavaScript', color: '#e8c547', shape: 'code', mode: 'javascript' },
    mjs: { name: 'JavaScript', color: '#e8c547', shape: 'code', mode: 'javascript' },
    cjs: { name: 'JavaScript', color: '#e8c547', shape: 'code', mode: 'javascript' },
    jsx: { name: 'JSX', color: '#61dafb', shape: 'code', mode: 'jsx' },
    ts: { name: 'TypeScript', color: '#3178c6', shape: 'code', mode: 'typescript' },
    tsx: { name: 'TSX', color: '#3178c6', shape: 'code', mode: 'tsx' },
    py: { name: 'Python', color: '#3572a5', shape: 'code', mode: 'python' },
    rb: { name: 'Ruby', color: '#cc342d', shape: 'code', mode: 'ruby' },
    go: { name: 'Go', color: '#00add8', shape: 'code', mode: 'go' },
    rs: { name: 'Rust', color: '#dea584', shape: 'code', mode: 'rust' },
    sh: { name: 'Shell', color: '#89e051', shape: 'code', mode: 'shell' },
    zsh: { name: 'Shell', color: '#89e051', shape: 'code', mode: 'shell' },
    bash: { name: 'Shell', color: '#89e051', shape: 'code', mode: 'shell' },
    html: { name: 'HTML', color: '#e34c26', shape: 'code', mode: 'html' },
    htm: { name: 'HTML', color: '#e34c26', shape: 'code', mode: 'html' },
    css: { name: 'CSS', color: '#663399', shape: 'code', mode: 'css' },
    scss: { name: 'SCSS', color: '#c6538c', shape: 'code', mode: 'css' },
    sql: { name: 'SQL', color: '#e38c00', shape: 'code', mode: 'sql' },
    json: { name: 'JSON', color: '#cbcb41', shape: 'text', mode: 'json' },
    yaml: { name: 'YAML', color: '#cb171e', shape: 'text', mode: 'yaml' },
    yml: { name: 'YAML', color: '#cb171e', shape: 'text', mode: 'yaml' },
    toml: { name: 'TOML', color: '#9c4221', shape: 'text', mode: 'toml' },
    xml: { name: 'XML', color: '#e37933', shape: 'text', mode: 'xml' },
    svg: { name: 'SVG', color: '#ffb13b', shape: 'text', mode: 'xml' },
    plist: { name: 'Property List', color: '#e37933', shape: 'text', mode: 'xml' },
    strings: { name: 'Strings', color: '#e37933', shape: 'text', mode: 'properties' },
    pbxproj: { name: 'Xcode Project', color: '#438eff', shape: 'text', mode: null },
    xcconfig: { name: 'Xcode Config', color: '#438eff', shape: 'text', mode: 'properties' },
    properties: { name: 'Properties', color: '#a3a3a3', shape: 'text', mode: 'properties' },
    env: { name: 'Environment', color: '#a3a3a3', shape: 'text', mode: 'properties' },
    md: { name: 'Markdown', color: '#519aba', shape: 'text', mode: 'markdown' },
    markdown: { name: 'Markdown', color: '#519aba', shape: 'text', mode: 'markdown' },
    diff: { name: 'Diff', color: '#a3a3a3', shape: 'text', mode: 'diff' },
    patch: { name: 'Diff', color: '#a3a3a3', shape: 'text', mode: 'diff' },
    txt: { name: 'Plain Text', color: '#a3a3a3', shape: 'text', mode: null },
};
// Icon shapes are Lucide's (ISC licence).
const FILE_SHAPE = `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>`;
const FILE_SHAPES = {
    code: FILE_SHAPE + `<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/>`,
    text: FILE_SHAPE + `<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
};
const UNKNOWN_FILE_COLOR = '#9a9a9a';

function fileTypeOf(path) {
    return FILE_TYPES[extensionOf(path)] || null;
}

function fileIconOf(ui, path, size = 15) {
    const type = fileTypeOf(path);
    return type
        ? ui.iconOf(FILE_SHAPES[type.shape], { size, color: type.color })
        : ui.iconOf(FILE_SHAPE, { size, color: UNKNOWN_FILE_COLOR });
}

// A dotfile with no other dot (".env") is named by what follows the dot.
function extensionOf(path) {
    const name = nameOf(path);
    const dot = name.lastIndexOf('.');
    return dot > 0 || (dot === 0 && name.length > 1) ? name.slice(dot + 1).toLowerCase() : '';
}

module.exports = { fileTypeOf, fileIconOf };

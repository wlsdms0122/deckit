const KIND_NAMES = {
    swift: 'Swift Source',
    m: 'Objective-C Source',
    h: 'C Header',
    c: 'C Source',
    kt: 'Kotlin Source',
    java: 'Java Source',
    js: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TSX',
    jsx: 'JSX',
    py: 'Python Script',
    rb: 'Ruby Script',
    go: 'Go Source',
    rs: 'Rust Source',
    sh: 'Shell Script',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    xml: 'XML',
    plist: 'Property List',
    md: 'Markdown',
    txt: 'Plain Text',
    html: 'HTML',
    css: 'CSS',
    csv: 'CSV',
    log: 'Log File',
    pdf: 'PDF Document',
    png: 'PNG Image',
    jpg: 'JPEG Image',
    jpeg: 'JPEG Image',
    gif: 'GIF Image',
    heic: 'HEIC Image',
    svg: 'SVG Image',
    webp: 'WebP Image',
    mov: 'QuickTime Movie',
    mp4: 'MPEG-4 Movie',
    mp3: 'MP3 Audio',
    wav: 'WAV Audio',
    zip: 'ZIP Archive',
    gz: 'GZip Archive',
    tar: 'Tar Archive',
    dmg: 'Disk Image',
    pkg: 'Installer Package',
    docx: 'Word Document',
    xlsx: 'Excel Workbook',
    pptx: 'PowerPoint',
    key: 'Keynote',
    pages: 'Pages',
    numbers: 'Numbers',
    app: 'Application',
    xcodeproj: 'Xcode Project',
    xcworkspace: 'Xcode Workspace',
    playground: 'Playground',
    ipa: 'iOS App',
    strings: 'Strings File',
    sqlite: 'SQLite Database',
};
const SIZE_UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'];
const DAY_MS = 86400000;
const TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const RELATIVE_DAY_FORMAT = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

function formatKind(entry) {
    if (entry.kind === 'folder') return 'Folder';
    if (KIND_NAMES[entry.ext]) return KIND_NAMES[entry.ext];
    if (entry.kind === 'package') return 'Package';
    return entry.ext ? entry.ext.toUpperCase() + ' File' : 'Document';
}

// Decimal, as the system's Finder counts: 1 KB is 1000 bytes.
function formatSize(entry) {
    if (entry.size == null) return '--';
    let amount = entry.size;
    let unit = 0;
    while (amount >= 1000 && unit < SIZE_UNITS.length - 1) {
        amount /= 1000;
        unit++;
    }
    if (unit === 0) return `${amount} bytes`;
    return `${amount < 10 ? amount.toFixed(1) : Math.round(amount)} ${SIZE_UNITS[unit]}`;
}

function formatDate(time) {
    const date = new Date(time);
    const clock = TIME_FORMAT.format(date);
    const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
    if (daysAgo === 0 || daysAgo === 1) {
        const day = RELATIVE_DAY_FORMAT.format(-daysAgo, 'day');
        return `${day[0].toUpperCase()}${day.slice(1)} at ${clock}`;
    }
    return `${DAY_FORMAT.format(date)} at ${clock}`;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

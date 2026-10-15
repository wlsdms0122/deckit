// What the editor reads of a workspace: its files, walked, and a file's text when it is UTF-8 text.
const fs = require('fs');
const path = require('path');
const { stat, readFile, readdir } = fs.promises;

const SKIPPED_FOLDERS = new Set([
    '.git',
    'node_modules',
    '.build',
    'build',
    'DerivedData',
    'Pods',
    'Carthage',
    '.gradle',
    'dist',
    '.next',
    '.venv',
    'venv',
    '__pycache__',
    '.idea',
    '.swiftpm',
]);
// Every write is UTF-8, so a file in another encoding would come back with its bytes replaced. ignoreBOM keeps a byte
// order mark as a character, so writing the text back writes the mark.
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function decodeText(buffer) {
    if (buffer.includes(0)) return null;
    try {
        return UTF8.decode(buffer);
    } catch {
        return null;
    }
}

// A file's text and when it changed, or null for one too big, gone or not text.
async function readText(file, limit) {
    try {
        const status = await stat(file);
        if (status.size > limit) return null;
        const text = decodeText(await readFile(file));
        return text === null ? null : { text, mtime: status.mtimeMs };
    } catch {
        return null;
    }
}

// A folder inside that cannot be read is passed over; the root itself refused (macOS privacy) is an error, not an
// empty folder. A link to a file is walked as the file; a link to a folder is not followed, so a link back up never
// walks a folder twice.
async function* walk(root) {
    const folders = [root];
    while (folders.length) {
        const folder = folders.pop();
        let entries = [];
        try {
            entries = await readdir(folder, { withFileTypes: true });
        } catch (error) {
            if (folder === root) throw new Error('the folder could not be read: ' + error.message);
            continue;
        }
        for (const entry of entries) {
            if (SKIPPED_FOLDERS.has(entry.name) || entry.name === '.DS_Store') continue;
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) folders.push(full);
            else if (entry.isFile() || (entry.isSymbolicLink() && (await isFileLink(full)))) yield full;
        }
    }
}

async function isFileLink(link) {
    try {
        return (await stat(link)).isFile();
    } catch {
        return false;
    }
}

module.exports = { decodeText, readText, walk };

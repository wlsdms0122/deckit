// The size a picture is shown at, read from its header without decoding it: PNG, GIF, BMP, WebP, JPEG, TIFF, and
// HEIF (HEIC, AVIF). JPEG, TIFF and HEIF say how the picture is turned, and one turned a quarter is shown with its
// sides swapped, as Quick Look shows it.
const fs = require('fs').promises;

// { width, height }, or null for a file this does not read.
async function imageSize(file) {
    const handle = await fs.open(file, 'r');
    const read = async (position, length) => {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, position);
        return buffer.subarray(0, bytesRead);
    };
    try {
        const head = await read(0, 32);
        const text = (from, to) => head.toString('latin1', from, to);
        if (head.readUInt32BE(0) === 0x89504e47) return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
        if (text(0, 4) === 'GIF8') return { width: head.readUInt16LE(6), height: head.readUInt16LE(8) };
        if (text(0, 2) === 'BM') return { width: head.readInt32LE(18), height: Math.abs(head.readInt32LE(22)) };
        if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return webpSize(head);
        if (head.readUInt16BE(0) === 0xffd8) return await jpegSize(read);
        if (text(0, 4) === 'II*\0' || text(0, 4) === 'MM\0*') return await tiffSize(head, read);
        if (text(4, 8) === 'ftyp') return await heifSize(read);
        return null;
    } finally {
        await handle.close();
    }
}

// A lossy picture, a lossless one, or one of either with more chunks.
function webpSize(head) {
    const chunk = head.toString('latin1', 12, 16);
    if (chunk === 'VP8 ') return { width: head.readUInt16LE(26) & 0x3fff, height: head.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
        const bits = head.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { width: head.readUIntLE(24, 3) + 1, height: head.readUIntLE(27, 3) + 1 };
    return null;
}

// Segment by segment up to the frame's header; an Exif segment before it says how the picture is turned.
async function jpegSize(read) {
    let turned = false;
    for (let position = 2; ; ) {
        const marker = await read(position, 4);
        if (marker.length < 4 || marker[0] !== 0xff) return null;
        const type = marker[1];
        const length = marker.readUInt16BE(2);
        if (type === 0xe1) {
            const segment = await read(position + 4, length - 2);
            if (segment.toString('latin1', 0, 6) === 'Exif\0\0') turned = tiffTags(segment, 6).orientation >= 5;
        } else if (type >= 0xc0 && type <= 0xcf && type !== 0xc4 && type !== 0xc8 && type !== 0xcc) {
            const frame = await read(position + 5, 4);
            return turnedSize({ width: frame.readUInt16BE(2), height: frame.readUInt16BE(0) }, turned);
        }
        position += 2 + length;
    }
}

// The first directory lies anywhere in the file, where the header says.
async function tiffSize(head, read) {
    const little = head.toString('latin1', 0, 2) === 'II';
    const at = little ? head.readUInt32LE(4) : head.readUInt32BE(4);
    const count = await read(at, 2);
    const entries = await read(at, 2 + (little ? count.readUInt16LE(0) : count.readUInt16BE(0)) * 12);
    const { width, height, orientation } = directoryTags(entries, little);
    return width && height ? turnedSize({ width, height }, orientation >= 5) : null;
}

// The first directory of a TIFF structure (an Exif segment's) starting at `base`.
function tiffTags(buffer, base) {
    const little = buffer.toString('latin1', base, base + 2) === 'II';
    const at = base + (little ? buffer.readUInt32LE(base + 4) : buffer.readUInt32BE(base + 4));
    return directoryTags(buffer.subarray(at), little);
}

// The width, height and orientation a directory holds, its entry count first.
function directoryTags(directory, little) {
    const short = (at) => (little ? directory.readUInt16LE(at) : directory.readUInt16BE(at));
    const long = (at) => (little ? directory.readUInt32LE(at) : directory.readUInt32BE(at));
    const tags = {};
    for (let index = 0; index < short(0); index++) {
        const entry = 2 + index * 12;
        tags[short(entry)] = short(entry + 2) === 3 ? short(entry + 8) : long(entry + 8);
    }
    return { width: tags[256], height: tags[257], orientation: tags[274] || 1 };
}

// The boxes at the top up to `meta`, whose item properties hold each image's extent (`ispe`) and turn (`irot`). The
// largest extent is the picture's: the others are its tiles and thumbnails.
async function heifSize(read) {
    for (let position = 0; ; ) {
        const header = await read(position, 16);
        if (header.length < 8) return null;
        const wide = header.readUInt32BE(0) === 1;
        const size = wide ? Number(header.readBigUInt64BE(8)) : header.readUInt32BE(0);
        const start = wide ? 16 : 8;
        if (header.toString('latin1', 4, 8) === 'meta')
            return heifMeta(await read(position + start + 4, size - start - 4));
        if (size < 8) return null;
        position += size;
    }
}

function heifMeta(meta) {
    let largest = null;
    let turned = false;
    const walk = (from, to) => {
        for (let at = from; at + 8 <= to; ) {
            const size = meta.readUInt32BE(at);
            const type = meta.toString('latin1', at + 4, at + 8);
            if (size < 8) return;
            if (type === 'iprp' || type === 'ipco') walk(at + 8, at + size);
            else if (type === 'irot') turned = (meta[at + 8] & 1) === 1;
            else if (type === 'ispe') {
                const extent = { width: meta.readUInt32BE(at + 12), height: meta.readUInt32BE(at + 16) };
                if (!largest || extent.width * extent.height > largest.width * largest.height) largest = extent;
            }
            at += size;
        }
    };
    walk(0, meta.length);
    return largest && turnedSize(largest, turned);
}

function turnedSize({ width, height }, turned) {
    return turned ? { width: height, height: width } : { width, height };
}

module.exports = { imageSize };

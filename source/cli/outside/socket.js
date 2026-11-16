// A local socket by its name in deckit's folder. A socket's path holds at most LIMIT bytes and a folder's may be
// longer, so a socket is bound at its name where that fits and, where it does not, at a short path in the system's
// temporary folder, which the name is a link to while it listens. Whoever connects is given the name alone.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The longest path a local socket is bound at, in bytes: the system refuses a longer one.
const LIMIT = 103;

function tooLong(place) {
    return `${place} is ${Buffer.byteLength(place)} bytes long, and a local socket's path holds at most ${LIMIT}`;
}

// `file` is taken away, a link to nothing as any file: what stays in the way is told by what is put there next.
function remove(file) {
    try {
        fs.unlinkSync(file);
    } catch {}
}

// `server` listens as the socket named `name`, which only its owner opens: what a run that did not end well left there
// is removed first. Resolves with `close()`, which takes the socket away, once it listens.
function listen(server, name) {
    const hash = crypto.createHash('sha256').update(name).digest('hex').slice(0, 16);
    const place = Buffer.byteLength(name) <= LIMIT ? name : path.join(os.tmpdir(), `deckit-${hash}.sock`);
    const close = () => {
        server.close();
        remove(name);
        remove(place);
    };
    return new Promise((resolve, reject) => {
        const fail = (error) => {
            close();
            reject(error);
        };
        server.once('error', fail);
        try {
            if (Buffer.byteLength(place) > LIMIT) throw new Error(tooLong(place));
            remove(name);
            remove(place);
            const mask = process.umask(0o177);
            try {
                server.listen(place, () => resolve(close));
            } finally {
                process.umask(mask);
            }
            if (place !== name) fs.symlinkSync(place, name);
        } catch (error) {
            fail(error);
        }
    });
}

// Where the socket named `name` is connected to: there, or where the name links to.
function placeOf(name) {
    const entry = fs.lstatSync(name, { throwIfNoEntry: false });
    if (!entry) throw new Error(`nothing listens at ${name}`);
    const place = entry.isSymbolicLink() ? path.resolve(path.dirname(name), fs.readlinkSync(name)) : name;
    if (Buffer.byteLength(place) > LIMIT) throw new Error(tooLong(place));
    return place;
}

module.exports = { LIMIT, listen, placeOf };

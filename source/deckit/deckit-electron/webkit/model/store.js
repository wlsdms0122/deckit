// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The key of a system's web data, kept in its folder `folder`: the one kept there, or a new one, kept, where the folder
// holds none. WebKit keeps every data store of an app in one place outside the system's folder, so a store is named by
// this key: a new folder, even at the place of an earlier one, has none of the stores of another.
export function keyIn(folder) {
    const fs = require('fs');
    const file = require('path').join(folder, 'webkit-key');
    try {
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(file, require('crypto').randomUUID(), { flag: 'wx' });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
    return fs.readFileSync(file, 'utf8').trim();
}

// A UUID made from the system's `key` (keyIn) and the store's `name`, as WebKit names a data store.
export function storeOf(key, name) {
    const hash = require('crypto').createHash('sha1').update(`deckit-web:${key}:${name}`).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// MARK: - Private

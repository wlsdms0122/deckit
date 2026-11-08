// The package file of a mod's folder, package.toml beside its manifest: `read(folder)` answers what its text holds, an
// empty table for a folder that has none, and is refused of kind PACKAGE, with the line, for text that is no TOML.
module.exports = ({ files }) => {
    const fs = require('fs').promises;
    const path = require('path');
    const TOML = require('../toml/toml.js');
    const FILE = 'package.toml';

    return {
        async read(folder) {
            let text;
            try {
                text = await fs.readFile(path.join(folder, FILE), 'utf8');
            } catch (error) {
                if (error.code === 'ENOENT') return {};
                throw error;
            }
            try {
                return TOML.read(text);
            } catch (error) {
                throw files.refuse('PACKAGE', `${FILE}: ${error.message}`);
            }
        },
    };
};

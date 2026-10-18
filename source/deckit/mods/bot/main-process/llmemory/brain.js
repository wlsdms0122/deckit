module.exports = ({ home }) => {
    const { execFile } = require('child_process');
    const path = require('path');

    const BRAIN_HOME = path.join(home, 'bot', 'brain');
    const LLMEMORY_BIN = path.join(home, 'bin', 'llmemory');
    const runBrain = (argv, operands) =>
        new Promise((resolve, reject) => {
            execFile(
                LLMEMORY_BIN,
                [...argv, '--json', '--home', BRAIN_HOME, '--', ...operands],
                { cwd: path.dirname(BRAIN_HOME), timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
                (error, stdout, stderr) => {
                    if (error) return reject(new Error((String(stderr).trim() || error.message).split('\n')[0]));
                    try {
                        resolve(JSON.parse(String(stdout)));
                    } catch {
                        reject(new Error('llmemory answered something that is not JSON'));
                    }
                }
            );
        });

    const noteId = (id) => {
        const checked = String(id || '');
        if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(checked)) throw new Error('bad note id: ' + checked);
        return checked;
    };

    const axisArgs = (axis) => {
        if (!axis) return [];
        const checked = String(axis);
        if (!/^[a-z][a-z0-9_-]*$/i.test(checked)) throw new Error('bad axis: ' + checked);
        return ['--axis', checked];
    };

    const methods = {};

    methods.search = async (query, limit, axis) => {
        const text = String(query || '').trim();
        if (!text) return [];
        const count = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 30));
        return (await runBrain(['query', 'search', '--limit', String(count), ...axisArgs(axis)], [text]))?.rows || [];
    };

    methods.list = async (axis, limit) => {
        const count = Math.min(500, Math.max(1, Math.floor(Number(limit)) || 200));
        const rows = await runBrain(['query', 'list', '--verbose', ...axisArgs(axis)], []);
        return (Array.isArray(rows) ? rows : [])
            .sort((first, second) => (second.edited_at || 0) - (first.edited_at || 0))
            .slice(0, count);
    };

    methods.axes = async () => {
        const stats = await runBrain(['query', 'stats'], []);
        return { total: stats?.total || 0, axes: (stats?.axes || []).map(([name, count]) => ({ name, count })) };
    };

    methods.get = async (id) => {
        const [note] = await runBrain(['query', 'get', '--verbose'], [noteId(id)]);
        return note || null;
    };

    methods.related = async (id) => {
        const rows = await runBrain(['query', 'neighbors', '--id', noteId(id), '--k', '8'], []);
        return Array.isArray(rows) ? rows : [];
    };

    return methods;
};

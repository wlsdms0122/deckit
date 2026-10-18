// The PATH of the person's login shell, asked once: an app opened from the Finder has only the system's, and the
// commands the bot runs, and those they run in turn, are found on this one. null when the shell does not answer.
module.exports = (track) => {
    const { execFile } = require('child_process');
    const MARK = '__bot_path__';
    let asked;
    return () =>
        (asked ??= new Promise((resolve) => {
            track(
                execFile(
                    process.env.SHELL || '/bin/zsh',
                    ['-lic', `printf '${MARK}%s${MARK}' "$PATH"`],
                    { timeout: 8000, maxBuffer: 1024 * 1024 },
                    (error, stdout) => {
                        const parts = String(stdout || '').split(MARK);
                        resolve(error || parts.length < 3 ? null : parts[1].trim() || null);
                    }
                )
            );
        }));
};

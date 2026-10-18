// How the bot runs its commands: on the PATH of the person's login shell, asked once, for an app opened from the Finder
// has only the system's, and the commands, and those they run in turn, are found on it.
module.exports = () => {
    const { execFile } = require('child_process');
    const MARK = '__bot_path__';
    let shell = null;
    let asked;
    const loginPath = () =>
        (asked ??= new Promise((resolve) => {
            shell = execFile(
                process.env.SHELL || '/bin/zsh',
                ['-lic', `printf '${MARK}%s${MARK}' "$PATH"`],
                { timeout: 8000, maxBuffer: 1024 * 1024 },
                (error, stdout) => {
                    const parts = String(stdout || '').split(MARK);
                    resolve(error || parts.length < 3 ? null : parts[1].trim() || null);
                }
            );
        }));
    // This process's environment, on the login shell's PATH when the shell answers.
    const environment = async () => ({ ...process.env, PATH: (await loginPath()) || process.env.PATH });
    // A command that could not be run at all, `program` naming it.
    const notRun = (program, error) =>
        Object.assign(new Error(`${program} could not be run: ${error.message}`), { notRun: true });
    // Runs `command` and answers what it wrote. One that fails says the first line of what it wrote to stderr, with its
    // exit status as `code`. `track(child)` is handed the command.
    const run = async ({ program, command, argv, env, timeout = 15000, track }) => {
        const given = env || (await environment());
        return new Promise((resolve, reject) => {
            track(
                execFile(
                    command,
                    argv,
                    { env: given, timeout, maxBuffer: 8 * 1024 * 1024 },
                    (error, stdout, stderr) => {
                        if (!error) return resolve(String(stdout));
                        if (error.syscall) return reject(notRun(program, error));
                        const said = (String(stderr).trim() || error.message).split('\n')[0];
                        reject(Object.assign(new Error(said), { code: error.code }));
                    }
                )
            );
        });
    };
    return { environment, notRun, run, end: () => shell?.kill() };
};

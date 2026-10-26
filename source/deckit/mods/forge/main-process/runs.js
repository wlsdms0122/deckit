// The runs dispatched from here, each followed to its end over forge's stream, whatever settings come after. A run is
// `{ id, name, session, status, step, startedAt, endedAt, outputs, error }`: `status` is forge's, `running` and then
// `ok` or `failed`, `step` the step of the run itself it last started, and `error` forge's `{ type, message }`.
// `changed(run)` hears each change until `stop()`, which ends the following.
module.exports = ({ changed, acceptWithin = 15000 }) => {
    // Ended runs are still answered by id, the oldest let go past this many.
    const KEPT = 100;
    const runs = new Map(); // workflow id -> run
    const following = new Set(); // the streams followed
    let stopped = false;

    // `child` is `forge workflow dispatch --stream`. Answers forge's acceptance, `{ workflow_id, name, status }`, or
    // rejects with what forge said when it took no run, or when it took none in `acceptWithin` ms; a run taken goes on
    // as long as it runs.
    const follow = (session, child) =>
        new Promise((resolve, reject) => {
            let run = null;
            let pending = '';
            let said = '';
            following.add(child);
            const late = setTimeout(() => {
                reject(new Error(`forge took no run in ${acceptWithin / 1000}s`));
                child.kill();
            }, acceptWithin);
            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');
            child.stdout.on('data', (chunk) => {
                pending += chunk;
                for (let newline; (newline = pending.indexOf('\n')) >= 0; ) {
                    const line = pending.slice(0, newline);
                    pending = pending.slice(newline + 1);
                    take(line);
                }
            });
            child.stderr.on('data', (chunk) => {
                if (!run) said += chunk;
            });
            child.once('error', (error) => {
                clearTimeout(late);
                reject(error);
            });
            child.once('close', (code) => {
                clearTimeout(late);
                following.delete(child);
                if (!run)
                    return reject(
                        Object.assign(new Error(said.trim().split('\n')[0] || 'forge took no run'), { code })
                    );
                if (run.status === 'running')
                    end(run, {
                        status: 'failed',
                        error: { type: 'unfollowed', message: 'forge stopped reporting the run' },
                    });
            });

            function take(line) {
                let message;
                try {
                    message = JSON.parse(line);
                } catch {
                    return;
                }
                if (!run && message.result?.workflow_id) {
                    const { workflow_id: id, name } = message.result;
                    run = {
                        id,
                        name,
                        session,
                        status: 'running',
                        step: null,
                        startedAt: Date.now(),
                        endedAt: null,
                        outputs: null,
                        error: null,
                    };
                    runs.set(id, run);
                    clearTimeout(late);
                    report(run);
                    return resolve({ workflow_id: id, name, status: 'running' });
                }
                if (!run) return;
                if (message.kind === 'workflow.result') return end(run, message.result || {});
                if (message.event === 'step.started' && message.workflow_id === run.id) {
                    run.step = message.step;
                    report(run);
                }
            }
        });

    function end(run, { status, outputs, error }) {
        if (run.status !== 'running') return;
        Object.assign(run, { status: status || 'failed', outputs: outputs || {}, error: error || null });
        run.endedAt = Date.now();
        report(run);
        let over = [...runs.values()].filter((each) => each.status !== 'running').length - KEPT;
        for (const [id, each] of runs) {
            if (over <= 0) break;
            if (each.status === 'running') continue;
            runs.delete(id);
            over -= 1;
        }
    }

    function report(run) {
        if (!stopped) changed({ ...run });
    }

    return {
        follow,
        get: (id) => (runs.has(id) ? { ...runs.get(id) } : null),
        stop() {
            stopped = true;
            for (const child of following) child.kill();
        },
    };
};

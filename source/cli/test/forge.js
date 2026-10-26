// The Forge mod's runs (mods/forge/main-process/runs.js) over a stand-in for `forge workflow dispatch --stream`: a
// dispatch answers once forge has taken the run, the run tells the steps of its own it starts and its end, whole
// characters however the pipe splits them, one whose stream ends first ends failed, and one forge took no run for, or
// none in time, rejects with what forge said.
// Exits 1 with a line for each check that failed.
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const path = require('path');

const makeRuns = require(path.join(__dirname, '..', '..', 'deckit', 'mods', 'forge', 'main-process', 'runs.js'));

function stream() {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.line = (message) => child.stdout.write(JSON.stringify(message) + '\n');
    child.kill = () => setImmediate(() => child.emit('close', null));
    return child;
}

const event = (id, name, extra) => ({
    kind: 'workflow.event',
    event: name,
    workflow_id: id,
    root_id: 'wf-1',
    ...extra,
});

async function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const heard = [];
    const runs = makeRuns({ changed: (run) => heard.push(run), acceptWithin: 300 });
    const tick = () => new Promise((resolve) => setImmediate(resolve));

    const child = stream();
    const taken = runs.follow('default', child);
    child.line({ id: 'fc-1', result: { workflow_id: 'wf-1', name: 'merge-gate', status: 'streaming' } });
    const answer = await taken;
    check('a dispatch answers once forge has taken the run', answer.workflow_id === 'wf-1', answer);
    check('a run taken is running', runs.get('wf-1')?.status === 'running', runs.get('wf-1'));

    // A step comes split across two writes, as a pipe may hand it.
    const started = Buffer.from(JSON.stringify(event('wf-1', 'step.started', { step: '검토' })) + '\n');
    const inside = started.indexOf(Buffer.from('검')) + 1;
    child.stdout.write(started.subarray(0, inside));
    child.stdout.write(started.subarray(inside));
    await tick();
    check('a step the run starts is its step, split as it may be', runs.get('wf-1')?.step === '검토', runs.get('wf-1'));
    child.line(event('wf-2', 'step.started', { step: 'inside' }));
    await tick();
    check('a step of a run it dispatched is not its step', runs.get('wf-1')?.step === '검토', runs.get('wf-1'));

    child.line({
        kind: 'workflow.result',
        result: { workflow_id: 'wf-1', status: 'ok', outputs: { verdict: 'pass' } },
    });
    await tick();
    child.emit('close', 0);
    const ended = runs.get('wf-1');
    check('a run ends as forge says', ended?.status === 'ok' && ended.outputs.verdict === 'pass', ended);
    check('each change is heard', heard.map((run) => run.status).join() === 'running,running,ok', heard);

    const cut = stream();
    const cutTaken = runs.follow('default', cut);
    cut.line({ id: 'fc-2', result: { workflow_id: 'wf-3', name: 'merge-gate', status: 'streaming' } });
    await cutTaken;
    cut.emit('close', null);
    const lost = runs.get('wf-3');
    check(
        'a run whose stream ends first ends failed, unfollowed',
        lost?.status === 'failed' && lost.error.type === 'unfollowed',
        lost
    );

    const refused = stream();
    const refusal = runs.follow('default', refused).then(
        () => null,
        (error) => error
    );
    refused.stderr.write('forge: workflow dispatch: denied by policy\nmore\n');
    await tick();
    refused.emit('close', 6);
    const error = await refusal;
    check('a run forge did not take rejects with what forge said', /denied by policy$/.test(error?.message), error);
    check('the rejection keeps the exit status forge gave', error?.code === 6, error?.code);

    const silent = stream();
    const waited = await runs.follow('default', silent).then(
        () => null,
        (error) => error
    );
    check('a run forge takes not in time rejects', /took no run/.test(waited?.message), waited?.message);

    for (const line of failed) console.error(line);
    if (failed.length) process.exit(1);
    console.log(`ok: ${count} forge run checks`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

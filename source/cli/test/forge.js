// The Forge mod's runs (mods/forge/main-process/runs.js) over a stand-in for `forge workflow dispatch --stream`: a
// dispatch answers once forge has taken the run, the run tells the steps of its own it starts and its end, one cut off
// ends failed, and one forge took no run for rejects with what forge said.
// Exits 1 with a line for each check that failed.
const { EventEmitter } = require('events');
const path = require('path');

const makeRuns = require(path.join(__dirname, '..', '..', 'deckit', 'mods', 'forge', 'main-process', 'runs.js'));

function stream() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.line = (message) => child.stdout.emit('data', JSON.stringify(message) + '\n');
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
    const runs = makeRuns({ changed: (run) => heard.push(run) });

    const child = stream();
    const taken = runs.follow('default', child);
    child.line({ id: 'fc-1', result: { workflow_id: 'wf-1', name: 'merge-gate', status: 'streaming' } });
    const answer = await taken;
    check('a dispatch answers once forge has taken the run', answer.workflow_id === 'wf-1', answer);
    check('a run taken is running', runs.get('wf-1')?.status === 'running', runs.get('wf-1'));

    // A step comes split across two writes, as a pipe may hand it.
    const started = JSON.stringify(event('wf-1', 'step.started', { step: 'review' })) + '\n';
    child.stdout.emit('data', started.slice(0, 20));
    child.stdout.emit('data', started.slice(20));
    check('a step the run starts is its step', runs.get('wf-1')?.step === 'review', runs.get('wf-1'));
    child.line(event('wf-2', 'step.started', { step: 'inside' }));
    check('a step of a run it dispatched is not its step', runs.get('wf-1')?.step === 'review', runs.get('wf-1'));

    child.line({
        kind: 'workflow.result',
        result: { workflow_id: 'wf-1', status: 'ok', outputs: { verdict: 'pass' } },
    });
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
    check('a run cut off ends failed, unfollowed', lost?.status === 'failed' && lost.error.type === 'unfollowed', lost);

    const refused = stream();
    const refusal = runs.follow('default', refused).then(
        () => null,
        (error) => error
    );
    refused.stderr.emit('data', 'forge: workflow dispatch: denied by policy\nmore\n');
    refused.emit('close', 6);
    const error = await refusal;
    check('a run forge did not take rejects with what forge said', /denied by policy$/.test(error?.message), error);
    check('the rejection keeps the exit status forge gave', error?.code === 6, error?.code);

    for (const line of failed) console.error(line);
    if (failed.length) process.exit(1);
    console.log(`ok: ${count} forge run checks`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

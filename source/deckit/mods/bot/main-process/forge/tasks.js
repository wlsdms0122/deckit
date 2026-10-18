



module.exports = ({ forge, send }) => {
const { dispatch, look } = require("./workflow.js")(forge);


const LOOK_LIMIT = 10 * 60 * 1000;
const SYNC_LIMIT = 30 * 60 * 1000;


const status = look("task-status", LOOK_LIMIT, () => changed(), ({ tasks_path: _scratch, ...report }) => report);
const state = Object.assign(status.state, { syncing: false, lastSync: null });

let revision = 0;
const snapshot = () => ({ ...state, revision });
const changed = () => { revision += 1; send(snapshot()); };

const runSync = async () => {
state.syncing = true;
changed();
try {
const outputs = await dispatch("task-sync", {}, SYNC_LIMIT);
state.lastSync = { at: Date.now(), summary: String(outputs.summary || ""), failed: Number(outputs.failed) || 0, error: null };
} catch (error) {
state.lastSync = { at: Date.now(), summary: "", failed: 0, error: error.message };
} finally {
state.syncing = false;
changed();
}

if (state.checking) await status.look();
await status.look();
};

return {
state: snapshot,
check: () => { status.look(); return snapshot(); },
sync: () => { if (!state.syncing) runSync(); return snapshot(); },
};
};

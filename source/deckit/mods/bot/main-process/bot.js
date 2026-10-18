

module.exports = ({ emit }) => {
const path = require("path");
const { app } = require("electron");
const home = process.env.SLACKIT_BOT_HOME || path.join(app.getPath("home"), "workspace/agent/jineun-bot");
const forge = require("./forge/supervisor.js")({ home });
return {
forge: {
supervisor: forge.methods,
tasks: require("./forge/tasks.js")({ forge, send: (state) => emit("tasks", state) }),
release: require("./forge/release.js")({ forge, send: (state) => emit("release", state) }),
},
brain: require("./llmemory/brain.js")({ home }),
};
};

DeckitModule.define("deckit/feature/app/main", {
  uses: [
    // First, so the log hears everything after it: the build orders modules as listed here.
    "deckit/service/log",
    "deckit/service/home/model/config",
    "deckit/service/runtime/server",
    "deckit/service/notify/server",
    "deckit/feature/window/main",
    "deckit/service/web/server",
    "deckit/feature/panel/main",
    "deckit/feature/switcher/main",
    "deckit/service/switcher/server",
    "deckit/service/plugin/server",
    // Provides nothing; listed so it starts and answers the pages.
    "deckit/module/clipboard/server",
  ],
  provides: ["connect"],
}, (_log, CONFIG, RUNTIME, NOTIFY, FRAME, WEB, PANEL, SWITCHER, ENTRIES, PLUGINS) => {
  const { app } = require("electron");

  const ANSWERS = ["start", "showsPanel", "reveal", "dismiss", "summonSwitcher", "noticeClicked", "restart"];
  let shell = null;

  WEB.connect({
    mayShowFile: (space) => PLUGINS.permissions.has(space, "system.files"),
    agent: CONFIG.agent || [],
    frame: FRAME,
  });
  PLUGINS.start({ frame: FRAME });
  ENTRIES.connect({ sources: PANEL.page, list: SWITCHER.page });

  const connect = ({ assets, shell: s } = {}) => {
    if (shell) throw new Error("[deckit] connect is called once");
    const missing = ANSWERS.filter((name) => typeof s?.[name] !== "function");
    if (missing.length) throw new Error(`[deckit] the shell does not answer ${missing.join(", ")}`);
    if (!assets) throw new Error("[deckit] connect needs the assets deckit's page is loaded from");
    shell = s;
    PANEL.connect({ assets, shell });
    NOTIFY.connect({ clicked: () => shell.noticeClicked() });
    RUNTIME.connect({ restart: () => shell.restart() });
    // Deferred a tick so the app's own ready listeners are in place before the shell places anything.
    app.whenReady().then(() => setImmediate(() => {
      try { shell.start(Object.freeze({ panel: PANEL.deck, switcher: SWITCHER.deck })); }
      catch (e) { console.error("[deckit] the shell did not start", e); }
    }));
  };

  return Object.freeze({ connect });
});

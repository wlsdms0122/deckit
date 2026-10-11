DeckitModule.define("deckit/service/log", {
  uses: ["deckit/service/home/model/config", "deckit/service/home", "deckit/module/log"],
  provides: ["file", "dir", "keep"],
  runs: "main",
}, (CONFIG, home, LOG) => {
  const { app } = require("electron");
  const path = require("path");

  const DIR = path.join(home.folder, "logs");
  const log = LOG.open({ dir: DIR, name: CONFIG.id });
  log.write("main", "info", `[deckit] start, ${app.getName()} ${app.getVersion()}, Electron ${process.versions.electron}`);

  /* Installed, main's stdout is read by nobody. Only lines starting "[deckit]", the prefix all our
     code uses, are kept: the app's own lines are its own. */
  for (const [method, level] of [["log", "info"], ["info", "info"], ["warn", "warn"], ["error", "error"]]) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      original(...args);
      if (typeof args[0] === "string" && args[0].startsWith("[deckit]")) log.write("main", level, LOG.text(args));
    };
  }

  // Only pages registered through keep() are ours; a site a plugin shows prints noise.
  const kept = new Set();
  const keep = (wc) => {
    const id = wc.id;
    kept.add(id);
    wc.once("destroyed", () => kept.delete(id));
  };
  const ours = (wc) => kept.has(wc.id);
  const LEVEL = { info: "info", warning: "warn", error: "error", debug: "debug" };

  app.on("web-contents-created", (_e, wc) => {
    wc.on("console-message", (e) => {
      if (!ours(wc)) return;
      const level = LEVEL[e.level] || "info";
      const message = String(e.message ?? "");
      if (level === "info" || level === "debug") { if (!message.startsWith("[deckit]")) return; }
      log.write("panel", level, message + (e.sourceId && level !== "info" ? ` (${path.basename(String(e.sourceId))}:${e.lineNumber})` : ""));
    });
    wc.on("preload-error", (_e, file, error) => {
      log.write(ours(wc) ? "panel" : "page", "error", `[deckit] preload failed: ${path.basename(String(file))}: ${error?.stack || error}`);
    });
    wc.on("render-process-gone", (_e, details) => {
      if (ours(wc)) log.write("panel", "error", `[deckit] page process gone: ${details?.reason} (${details?.exitCode})`);
    });
  });

  return { file: log.file, dir: DIR, keep };
});

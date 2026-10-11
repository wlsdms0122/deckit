DeckitModule.define("deckit/service/open/model/protocol", {
  uses: ["deckit/module/ipc"],
  provides: ["external", "path", "reveal", "config", "setConfig", "url"],
  runs: "electron",
}, (IPC) => Object.freeze({
  // `activates`: whether the browser comes forward.
  external: IPC.ask("deckit:open-external", { url: "string", activates: "boolean" }),
  // `userInitiated`: a person asked for it, so it may be opened rather than only shown in Finder.
  path: IPC.ask("deckit:open-path", { file: "string", userInitiated: "boolean" }),
  reveal: IPC.ask("deckit:reveal-path", { file: "string" }),
  // Synchronous: a page reads it as it starts.
  config: IPC.ask("deckit:open-config", {}, { now: true }),
  setConfig: IPC.ask("deckit:open-config-set", { config: "object" }),
  url: IPC.tell("deckit:open-url", { url: "string", activates: "boolean", target: "string" }),
}));

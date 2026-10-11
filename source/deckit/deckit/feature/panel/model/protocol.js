DeckitModule.define("deckit/feature/panel/model/protocol", {
  uses: ["deckit/module/ipc"],
  provides: ["setup", "ready", "visible", "play", "played", "hidden", "look", "bar", "show", "hide"],
  runs: "electron",
}, (IPC) => Object.freeze({
  // Answers { role, theme, shown, look }, role "panel" or "switcher": one bundle makes both pages.
  setup: IPC.ask("deckit:panel-setup", {}, { now: true }),
  ready: IPC.report("deckit:panel-ready", { running: "array" }),
  // `token` is set when main waits for the exit, and comes back with hidden.
  visible: IPC.tell("deckit:panel-visible", { open: "boolean", token: "number?" }),
  // direction "out" (its token comes back with played) or "in", around a move.
  play: IPC.tell("deckit:panel-play", { direction: "string", token: "number?" }),
  played: IPC.report("deckit:panel-played", { token: "number?" }),
  hidden: IPC.report("deckit:panel-hidden", { token: "number?" }),
  look: IPC.tell("deckit:panel-look", { floating: "boolean", dismissible: "boolean" }),
  bar: IPC.tell("deckit:bar", { inset: "number" }),
  show: IPC.report("deckit:panel-show", {}),
  hide: IPC.report("deckit:panel-hide", {}),
}));

DeckitModule.define("deckit/module/clipboard/model/protocol", {
  uses: ["deckit/module/ipc"],
  provides: ["read", "write"],
  runs: "electron",
}, (IPC) => Object.freeze({
  read: IPC.ask("deckit:clipboard-read", {}),
  write: IPC.ask("deckit:clipboard-write", { text: "string" }),
}));

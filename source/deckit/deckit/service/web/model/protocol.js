DeckitModule.define("deckit/service/web/model/protocol", {
  uses: ["deckit/module/ipc"],
  provides: [
    "window", "fetchText", "clear", "trust", "allow", "revoke",
    "act", "permit", "state", "certificate", "found", "leave", "opens", "permission", "notification", "closed",
  ],
  runs: "electron",
}, (IPC) => Object.freeze({
  // By partition. Answers the new page's webContents id, or 0 when it may not be shown.
  window: IPC.ask("deckit:web-window", { partition: "string", url: "string", title: "string" }),
  fetchText: IPC.ask("deckit:web-fetch-text", { partition: "string", url: "string" }),
  clear: IPC.ask("deckit:web-clear", { partition: "string" }),
  // entries: [{ host, fingerprint }]
  trust: IPC.ask("deckit:web-trust", { partition: "string", entries: "array" }),
  // entries: [{ origin, permission }]
  allow: IPC.ask("deckit:web-allow", { partition: "string", entries: "array" }),
  revoke: IPC.ask("deckit:web-revoke", { partition: "string", entries: "array" }),

  /* Between a page and the document that holds it; `id` is the page's webContents id, and main
     holds the page. op: load, back, forward, reload, stop, state, mute, find, find-stop, close,
     notification-click. */
  act: IPC.report("deckit:page-do", { id: "number", op: "string", arg: "any?" }),
  // Answers the `permission` ask of that number.
  permit: IPC.report("deckit:page-permit", { ask: "number", allow: "boolean" }),
  state: IPC.tell("deckit:page-state", { id: "number", state: "object" }),
  // certificate: { url, host, error, fingerprint, subject, issuer }
  certificate: IPC.tell("deckit:page-cert", { id: "number", certificate: "object" }),
  found: IPC.tell("deckit:page-found", { id: "number", matches: "number", active: "number", final: "boolean" }),
  // A file page's link to the web, not followed in place.
  leave: IPC.tell("deckit:page-leave", { id: "number", url: "string" }),
  opens: IPC.tell("deckit:page-window", { id: "number", url: "string", activates: "boolean", target: "string" }),
  // Permissions, or opening an app (`app`, `url`); answered with permit.
  permission: IPC.tell("deckit:page-permission", {
    id: "number", ask: "number", origin: "string", permissions: "array", app: "string?", url: "string?",
  }),
  // A click on it goes back as act's notification-click.
  notification: IPC.tell("deckit:page-notify", { id: "number", notification: "number", title: "string", body: "string", silent: "boolean" }),
  closed: IPC.tell("deckit:page-closed", { id: "number" }),
}));

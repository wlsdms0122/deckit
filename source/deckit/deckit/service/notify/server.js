DeckitModule.define("deckit/service/notify/server", {
  uses: [
    "deckit/module/log",
    "deckit/service/notify/model/protocol",
  ],
  provides: ["connect"],
}, (log, PROTOCOL) => {
  const { guard } = log;

  let clicked = () => {};
  const asked = new Map();   // id -> the webContents that asked

  /* Every notice that is up. A Notification nothing refers to is garbage collected, and macOS then
     withdraws it or never delivers it, silently. The cap covers a close that never comes. */
  const live = new Set();
  const HOLD_MS = 24 * 3600 * 1000;

  PROTOCOL.notify.answer(({ id, title, body, silent }, sender) => {
    const { Notification } = require("electron");
    if (!Notification.isSupported()) {
      console.warn("[deckit] notifications are not supported here");
      return false;
    }
    const note = new Notification({ title: title.slice(0, 200), body: body.slice(0, 400), silent });
    live.add(note);
    const cap = setTimeout(() => live.delete(note), HOLD_MS);
    const letGo = () => { clearTimeout(cap); live.delete(note); if (id) asked.delete(id); };

    if (id) {
      asked.set(id, sender);
      guard(note, "click", () => {
        // The app forward first: the page's handler almost always shows something.
        try { clicked(); } catch (err) { console.error("[deckit] the app's answer to a clicked notice threw", err); }
        PROTOCOL.clicked.send(asked.get(id), { id });
        letGo();
      });
    }
    guard(note, "close", letGo);

    /* Resolves whether it was shown, which a page may record. A platform that fires neither
       `show` nor `failed` within a moment is taken as success. */
    return new Promise((resolve) => {
      let settled = false;
      const settle = (ok, why) => {
        if (settled) return;
        settled = true;
        if (!ok) { console.warn("[deckit] notification failed", why || ""); letGo(); }
        resolve(ok);
      };
      guard(note, "show", () => settle(true), { once: true });
      guard(note, "failed", (_ev, err) => settle(false, err), { once: true });
      setTimeout(() => settle(true), 1500);
      try { note.show(); } catch (err) { settle(false, err); }
    });
  });

  return Object.freeze({
    connect: ({ clicked: answer }) => { if (typeof answer === "function") clicked = answer; },
  });
});

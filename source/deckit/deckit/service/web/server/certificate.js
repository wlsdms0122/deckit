DeckitModule.define("deckit/service/web/server/certificate", {
  uses: [
    "deckit/module/log",
    "deckit/service/web/server/pages",
    "deckit/service/web/server/session",
    "deckit/service/web/model/protocol",
  ],
  provides: [],
}, (log, PAGES, SESSION, PROTOCOL) => {
  const { app } = require("electron");
  const { guard } = log;

  /* Electron gives no interstitial, only a failed load: refused by default, the tab is told and
     hands back what it accepts (trust()). Trust is per session, host and fingerprint. Main reloads
     what was refused: it may be a window the tab opened, or one of the page's parts. */
  const TRUSTED = new Set();
  const certKey = (partition, host_, fingerprint) => partition + "|" + host_ + "|" + fingerprint;
  const refused = new Map();   // certKey -> Map<webContents id, the address it was loading>

  PROTOCOL.trust.answer(({ partition, entries }) => {
    const { webContents } = require("electron");
    SESSION.of(partition);   // throws for anything but a session of storage's
    for (const entry of entries) {
      if (!entry || !entry.host || !entry.fingerprint) continue;
      const key = certKey(partition, entry.host, entry.fingerprint);
      TRUSTED.add(key);
      for (const [id, url] of refused.get(key) || []) {
        const wc = webContents.fromId(id);
        if (!wc || wc.isDestroyed()) continue;
        // A page that never got past the refusal has nothing to reload, so it is loaded again.
        const at = wc.getURL();
        try { if (!at || at === "about:blank") wc.loadURL(url); else wc.reload(); } catch {}
      }
      refused.delete(key);
    }
    return TRUSTED.size;
  });

  guard(app, "certificate-error", (event, wc, url, error, cert, callback) => {
    const at = PAGES.tabOf(wc);
    if (!at) return;
    const { h } = at;
    const partition = SESSION.partitionOf(wc);
    let name = "";
    try { name = new URL(url).hostname; } catch {}
    if (name && cert && TRUSTED.has(certKey(partition, name, cert.fingerprint))) {
      event.preventDefault();
      callback(true);
      return;
    }
    callback(false);
    if (cert) {
      const key = certKey(partition, name, cert.fingerprint);
      if (!refused.has(key)) refused.set(key, new Map());
      refused.get(key).set(wc.id, url);
      const id = wc.id;
      wc.once("destroyed", () => { refused.get(key)?.delete(id); if (!refused.get(key)?.size) refused.delete(key); });
    }
    PAGES.send(h, PROTOCOL.certificate, { id: at.tab.id, certificate: {
      url, host: name, error,
      fingerprint: cert ? cert.fingerprint : "",
      subject: cert ? cert.subjectName : "",
      issuer: cert ? cert.issuerName : "",
    } });
  });
  return Object.freeze({});
});

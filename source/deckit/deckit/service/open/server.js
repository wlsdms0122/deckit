DeckitModule.define("deckit/service/open/server", {
  uses: [
    "deckit/service/storage",
    "deckit/service/open/model/protocol",
  ],
  provides: ["open"],
}, (storage, PROTOCOL) => {
  const fs = require("fs");
  const path = require("path");
  const { shell } = require("electron");
  const { read: readData, write: writeData } = storage.host;

  // Only web addresses: any other scheme handed to the system starts a program on the page's say-so.
  PROTOCOL.external.answer(async ({ url, activates }) => {
    if (!/^https?:\/\//i.test(url)) return false;
    await shell.openExternal(url, { activate: activates });
    return true;
  });

  const open = (page, url, { activates, target }) => PROTOCOL.url.send(page, { url: String(url || ""), activates, target });

  // path.resolve makes "Foo.app/" the same as "Foo.app".
  const existingPath = (file) => {
    const raw = String(file || "");
    if (!path.isAbsolute(raw)) return "";
    const p = path.resolve(raw);
    try { fs.statSync(p); return p; } catch { return ""; }
  };

  /* Opened only when a person asked; otherwise shown in Finder, whatever it is, because no list of
     which files are programs is complete. `userInitiated` is the caller's word, not a proof: it
     guards against a plugin running a file by mistake, not on purpose. */
  PROTOCOL.path.answer(async ({ file, userInitiated }) => {
    const p = existingPath(file);
    if (!p) return false;
    if (!userInitiated) { shell.showItemInFolder(p); return true; }
    const failed = await shell.openPath(p);
    return !failed;
  });

  PROTOCOL.reveal.answer(async ({ file }) => {
    const p = existingPath(file);
    if (!p) return false;
    shell.showItemInFolder(p);
    return true;
  });


  // In the app's own store, so the order outlives a reinstall.
  PROTOCOL.config.answer(() => {
    try { return JSON.parse(readData("open-with") || "{}"); } catch { return {}; }
  });
  PROTOCOL.setConfig.answer(({ config }) => {
    writeData("open-with", JSON.stringify(config));
    return true;
  });

  return Object.freeze({ open });
});

DeckitModule.define("deckit/module/store", {
  uses: [],
  provides: ["read", "write"],
  runs: "node",
}, () => {
  const fs = require("fs");
  const path = require("path");

  const read = (file) => { try { return fs.readFileSync(file, "utf8"); } catch { return null; } };
  // Through a temporary file and a rename, so a crash mid-write leaves the previous version whole.
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = file + ".tmp";
    fs.writeFileSync(temporary, String(text));
    fs.renameSync(temporary, file);
  };

  return { read, write };
});

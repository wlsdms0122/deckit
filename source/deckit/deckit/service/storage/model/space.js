/* Main, the panel's page and the command line all load this, so they agree on the rules; the page
 * cannot load service/storage/index.js, which touches the disk. */
DeckitModule.define("deckit/service/storage/model/space", {
  uses: ["deckit/service/home/model/config"],
  provides: ["RESERVED", "nameProblem", "keyProblem", "count", "COUNT_CAP", "jar", "isJar", "ownerOf"],
  runs: "any",
}, (CONFIG) => {
  // The core's own space; the plugin system refuses it as an id too (service/plugin/model/manifest.js).
  const RESERVED = "host";

  // The reserved name in any case: a Mac's disk ignores case, so "Host" is the folder "host".
  const nameProblem = (raw) => {
    const name = String(raw == null ? "" : raw);
    if (!name || name === "." || name === ".." || /[/\\]/.test(name)) return `"${name}" is no folder name`;
    if (name.toLowerCase() === RESERVED) return `"${RESERVED}" is the app's own name; choose another`;
    return "";
  };

  /* The renderer names the key: main checks it before every read and write, the panel before its
     cache changes. */
  const keyProblem = (raw) => {
    const name = String(raw == null ? "" : raw);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name) || name.includes("..")) return "bad data key: " + name;
    return "";
  };

  /* Every file counts, not only data keys: removing the data removes the whole folder, a plugin's
     own files included. fs and path are handed in so the page can load this file. */
  const COUNT_CAP = 1000;
  const count = (dir, { fs, path }, { depth = 8 } = {}) => {
    const seen = { count: 0, capped: false, hidden: false };
    const walk = async (at, level) => {
      let entries = [];
      try { entries = await fs.promises.readdir(at, { withFileTypes: true }); } catch { return; }
      for (const d of entries) {
        if (seen.capped) return;
        if (d.name.startsWith(".")) { seen.hidden = true; continue; }
        if (d.isFile()) { if (seen.count >= COUNT_CAP) { seen.capped = true; return; } seen.count++; }
        else if (d.isDirectory() && level < depth) await walk(path.join(at, d.name), level + 1);
      }
    };
    return walk(dir, 0).then(() => seen);
  };

  /* Under CONFIG.id, so two apps' jars in one profile stay apart. The colons keep two plugins apart:
     neither an id nor a name can hold one, so "mail" + "work-x" and "mail-work" + "x" differ. */
  const prefix = () => `persist:${CONFIG.id}:`;
  const jar = (pluginId, name) => prefix() + pluginId + ":" + name;
  const isJar = (partition) => String(partition).startsWith(prefix()) && /^[\w.-]+:[a-z0-9-]+$/.test(String(partition).slice(prefix().length));
  const ownerOf = (partition) => (isJar(partition) ? String(partition).slice(prefix().length).split(":")[0] : null);

  return { RESERVED, nameProblem, keyProblem, count, COUNT_CAP, jar, isJar, ownerOf };
});

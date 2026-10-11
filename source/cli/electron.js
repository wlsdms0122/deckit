const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// SlacKit's Electron. Exact, not a range, so npx resolves it once and runs from its cache.
const VERSION = "44.4.5";
const root = path.join(__dirname, "..", "..");

const electronApp = () => {
  // The first require downloads the binary and reports it on stdout, so the path comes back through a file.
  const out = path.join(root, ".build", ".electron-app");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.rmSync(out, { force: true });
  const find = `
    const path = require("path"), fs = require("fs");
    const cli = require("child_process").execFileSync("sh", ["-c", "command -v electron"]).toString().trim();
    const binary = require(path.dirname(fs.realpathSync(cli)));
    fs.writeFileSync(process.argv[1], binary.replace(/\\/Contents\\/MacOS\\/[^/]+$/, ""));
  `;
  spawnSync("npx", ["--yes", "-p", `electron@${VERSION}`, "node", "-e", find, out], { stdio: ["ignore", 2, 2] });
  let app = "";
  try { app = fs.readFileSync(out, "utf8"); } catch {}
  fs.rmSync(out, { force: true });
  if (!app || !fs.existsSync(path.join(app, "Contents", "Info.plist"))) throw new Error(`no Electron ${VERSION} app came from npx`);
  return app;
};

module.exports = { VERSION, electronApp };
if (require.main === module) {
  try { process.stdout.write(electronApp() + "\n"); } catch (e) { console.error(e.message); process.exit(1); }
}

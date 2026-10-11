DeckitModule.define("cli/commands", {
  uses: [
    "deckit/service/home/model/config",
    "deckit/service/home",
    "deckit/service/storage",
    "deckit/service/storage/model/space",
    "deckit/service/plugin/model/manifest",
    "deckit/service/plugin/folder",
    "deckit/service/plugin/install",
    "deckit/service/plugin/remove",
  ],
  provides: ["run"],
}, (CONFIG, home, storage, SPACE, MANIFEST, FOLDER, INSTALL, REMOVE) => {
  const fs = require("fs");
  const path = require("path");

  const idOf = (folder) => path.basename(path.resolve(folder));
  const say = (line) => process.stdout.write(line + "\n");
  const restart = () => say(`restart ${CONFIG.name} to pick them up`);
  const shipping = (ship) => {
    if (!ship.length) throw new Error("no --ship given: the plugin folders the app ships, each with --ship, before the command");
    return ship;
  };

  const report = (outcomes) => {
    for (const { id, outcome, version } of outcomes) {
      if (outcome === "installed") say(`installed  ${id.padEnd(12)} ${version}`);
      else if (outcome === "left out") say(`left out   ${id} (removed)`);
      else say(`dropped    ${id} (no longer shipped)`);
    }
    say("→ " + home.pluginInstall.root);
    if (outcomes.some((o) => o.outcome === "installed")) restart();
  };

  // An option { name: "meaning" } is a flag; { name: ["<value>", "meaning"] } takes a value.
  const COMMANDS = {
    where: {
      about: "deckit's folder, and where plugins are installed",
      run: () => {
        say(home.folder);
        say(home.pluginInstall.root);
      },
    },

    list: {
      about: "the installed plugins: each version, or why it would not load",
      run: () => {
        const root = home.pluginInstall.root;
        for (const folder of INSTALL.folders()) {
          const { manifest, problem } = FOLDER.loadable(path.join(root, folder));
          say(problem ? `${folder.padEnd(12)} not loaded: ${problem}` : `${folder.padEnd(12)} ${manifest.version}`);
        }
        say("→ " + root);
      },
    },

    install: {
      operands: "<folder>...", least: 1,
      about: "plugin folders, held to what the app loads, installed",
      run: ({ operands }) => {
        const found = operands.map((folder) => {
          const { manifest, problem } = FOLDER.loadable(folder);
          if (problem) throw new Error(`${folder}: ${problem}`);
          const why = INSTALL.copyProblem(folder, manifest.id);
          if (why) throw new Error(`${folder}: ${why}`);
          return { folder, manifest };
        });
        for (const { folder, manifest } of found) {
          INSTALL.install(folder, manifest.id);
          say(`installed  ${manifest.id.padEnd(12)} ${manifest.version}`);
        }
        say("→ " + home.pluginInstall.root);
        restart();
      },
    },

    remove: {
      operands: "<id>", least: 1, most: 1,
      options: { data: "what it stored too" },
      about: "an installed plugin taken away",
      run: ({ operands: [id], options }) => {
        const removed = REMOVE.remove(id, { data: !!options.data });
        say(`removed    ${id}${removed.data ? ", and what it stored" : ""}`);
      },
    },

    ship: {
      about: "the plugins the app ships (--ship), installed by the rule: updated, new ones installed, ones the person removed left out",
      run: ({ ship }) => report(INSTALL.installShipped(shipping(ship))),
    },

    restore: {
      operands: "<id>...", least: 1,
      about: "plugins the app ships, brought back whatever was decided before",
      run: ({ operands, ship }) => report(INSTALL.installShipped(shipping(ship), { only: operands.map(idOf) })),
    },

    new: {
      operands: "<id>", least: 1, most: 1,
      options: { in: ["<folder>", "where it is started (required)"], main: "with a main half" },
      about: "a plugin started in <folder>/<id>: its manifest and a view that runs",
      run: ({ operands: [id], options, ship }) => {
        if (!options.in) throw new Error("new: --in <folder>, where it is started");
        // The folder name is the id, so it is held to the manifest's id rule.
        const why = MANIFEST.idProblem(id);
        if (why) throw new Error(why);
        const taken = ship.find((folder) => idOf(folder) === id);
        if (taken) throw new Error(`"${id}" is already a plugin the app ships (${taken})`);
        const dir = path.join(options.in, id);
        if (fs.existsSync(dir)) throw new Error("already there: " + dir);

        const name = id.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
        // Placeholders rather than template strings: a view is full of ${…} of its own.
        const fill = (file) => fs.readFileSync(path.join(__dirname, "template", file), "utf8").replace(/@@NAME@@/g, name).replace(/@@ID@@/g, id);
        const manifest = [`id = "${id}"`, `name = "${name}"`, `version = "1.0.0"`, `api = "${MANIFEST.HOST_API}"`];
        // The value is the reason Settings shows to whoever installs the plugin.
        if (options.main) manifest.push("", "[permissions]", `"${MANIFEST.MAIN_PERMISSION}" = "Answers ping from the view."`);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "manifest.toml"), manifest.join("\n") + "\n");
        fs.writeFileSync(path.join(dir, "view.js"), fill("view.js"));
        if (options.main) fs.writeFileSync(path.join(dir, "main.js"), fill("main.js"));
        const { problem } = FOLDER.loadable(dir);
        if (problem) throw new Error(`what new wrote does not load (${problem}): that is a bug in deckit-cli`);
        say("wrote " + dir);
        for (const file of fs.readdirSync(dir).sort()) say("  " + file);
      },
    },

    manifest: {
      operands: "<folder> [<field>]", least: 1, most: 2,
      about: `a plugin folder held to what the app loads: a field of its manifest, "requires" (ids, a line each), "json" (all of it), or "problem"`,
      run: ({ operands: [folder, want] }) => {
        const { manifest, problem } = FOLDER.loadable(folder);
        if (want === "problem") { if (problem) say(problem); return; }
        if (problem) throw new Error(`${folder}: ${problem}`);
        if (!want || want === "json") say(JSON.stringify(manifest));
        else if (want === "requires") { for (const id of Object.keys(manifest.requires)) say(id); }
        else if (manifest[want] != null) say(String(manifest[want]));
      },
    },

    data: {
      operands: "[<folder>]", most: 1,
      about: `what is stored under deckit's data/ (or <folder>), counted: "<count> <capped> <hidden>"`,
      run: async ({ operands: [folder] }) => {
        const { count, capped, hidden } = await SPACE.count(folder || storage.root, { fs, path }, { depth: 9 });
        say(`${count} ${capped} ${hidden}`);
      },
    },
  };

  const written = (name, { operands, options = {} }) => [
    name, operands,
    ...Object.entries(options).map(([option, said]) => `[--${option}${Array.isArray(said) ? " " + said[0] : ""}]`),
  ].filter(Boolean).join(" ");

  const usage = () => [
    "deckit-cli: the plugins of an app that embeds deckit",
    "",
    "  deckit-cli [--config <app config.js>] [--ship <plugin folder>]... <command>",
    "",
    ...Object.entries(COMMANDS).flatMap(([name, command]) => [
      "  " + written(name, command),
      "      " + command.about,
      ...Object.entries(command.options || {}).map(([option, said]) => `      --${option}: ${Array.isArray(said) ? said[1] : said}`),
    ]),
    "",
  ].join("\n");

  const read = (name, { options = {}, least = 0, most = null }, args) => {
    const operands = [];
    const given = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!arg.startsWith("--")) { operands.push(arg); continue; }
      const option = arg.slice(2);
      if (!Object.prototype.hasOwnProperty.call(options, option)) {
        const where = option === "config" || option === "ship" ? " (it goes before the command)" : "";
        throw new Error(`${name} takes no ${arg}${where}`);
      }
      if (!Array.isArray(options[option])) { given[option] = true; continue; }
      const value = args[i + 1];
      if (value == null || value.startsWith("--")) throw new Error(`${arg} needs ${options[option][0]}`);
      given[option] = value;
      i++;
    }
    if (operands.length < least || (most != null && operands.length > most)) throw new Error(`usage: deckit-cli ${written(name, COMMANDS[name])}`);
    return { operands, options: given };
  };

  // What throws here is a rule or a usage error for the person to act on, so only the message is printed.
  const run = async ({ command, args = [], ship = [] } = {}) => {
    const declared = Object.prototype.hasOwnProperty.call(COMMANDS, command) ? COMMANDS[command] : null;
    if (!declared) { process.stderr.write((command ? `unknown command: ${command}\n\n` : "") + usage()); return 1; }
    try {
      await declared.run({ ...read(command, declared, args), ship });
      return 0;
    } catch (e) {
      process.stderr.write(String(e?.message || e) + "\n");
      return 1;
    }
  };

  return { run };
});

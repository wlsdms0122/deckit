// Deckit.app's own files around each library bundle ({ bundle }), in load order. Paths are from this folder.
module.exports = {
  main: ["config.js", { bundle: "main" }, "shell.js"],
  page: ["config.js", { bundle: "page" }],
  entry: "main.js",
};

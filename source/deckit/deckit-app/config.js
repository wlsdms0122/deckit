DeckitModule.define("app/config", {
  uses: [],
  provides: ["id", "name", "restore"],
}, () => Object.freeze({
  id: "deckit",
  name: "Deckit",
  restore: "Or, in the deckit package: open-package plugins {id}",
}));

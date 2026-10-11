/* From main, not the page: a page reaches the clipboard only while it has focus, and a command
 * picked in the switcher runs in the panel while the switcher's page has it. */
DeckitModule.define("deckit/module/clipboard/server", {
  uses: ["deckit/module/clipboard/model/protocol"],
  provides: [],
}, (PROTOCOL) => {
  const { clipboard } = require("electron");
  PROTOCOL.read.answer(() => clipboard.readText());
  PROTOCOL.write.answer(({ text }) => {
    clipboard.writeText(text);
    return true;
  });
});

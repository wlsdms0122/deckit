export { EditorState, EditorSelection, Compartment, Transaction, RangeSetBuilder, Prec } from "@codemirror/state";
export { EditorView, keymap, drawSelection, dropCursor, Decoration, ViewPlugin, WidgetType, placeholder } from "@codemirror/view";
export { defaultKeymap, history, historyKeymap, indentMore, indentLess, undo, redo } from "@codemirror/commands";
export { syntaxTree, syntaxHighlighting, HighlightStyle, indentUnit, LanguageDescription, StreamLanguage } from "@codemirror/language";
export { markdown, markdownLanguage, markdownKeymap, insertNewlineContinueMarkup, deleteMarkupBackward } from "@codemirror/lang-markdown";
export { tags } from "@lezer/highlight";

import { LanguageDescription, LanguageSupport, StreamLanguage } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { yaml } from "@codemirror/lang-yaml";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { kotlin, java } from "@codemirror/legacy-modes/mode/clike";

// A fenced block in any other language is shown as plain monospaced text.
// A description loads language support, not a bare language: a legacy mode is wrapped to be one.
const legacy = (mode) => () => new LanguageSupport(StreamLanguage.define(mode));
const describe = (name, alias, load) => LanguageDescription.of({ name, alias, load: async () => load() });
export const codeLanguages = [
  describe("javascript", ["js", "jsx", "mjs", "cjs"], () => javascript({ jsx: true })),
  describe("typescript", ["ts", "tsx"], () => javascript({ typescript: true, jsx: true })),
  describe("json", ["json5"], () => json()),
  describe("python", ["py"], () => python()),
  describe("yaml", ["yml"], () => yaml()),
  describe("swift", [], legacy(swift)),
  describe("kotlin", ["kt", "kts"], legacy(kotlin)),
  describe("java", [], legacy(java)),
  describe("shell", ["sh", "bash", "zsh", "console"], legacy(shell)),
];

export { EditorState, Compartment, Transaction } from '@codemirror/state';
export {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    dropCursor,
    rectangularSelection,
    crosshairCursor,
    highlightSpecialChars,
} from '@codemirror/view';
export { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
export {
    syntaxHighlighting,
    HighlightStyle,
    indentOnInput,
    bracketMatching,
    codeFolding,
    foldGutter,
    foldKeymap,
    foldedRanges,
    StreamLanguage,
    LanguageSupport,
    syntaxTree,
} from '@codemirror/language';
export {
    search,
    searchKeymap,
    openSearchPanel,
    closeSearchPanel,
    highlightSelectionMatches,
    gotoLine,
    SearchQuery,
    getSearchQuery,
    setSearchQuery,
    findNext,
    findPrevious,
    replaceNext,
    replaceAll,
} from '@codemirror/search';
export { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
export { tags, tagHighlighter, highlightTree } from '@lezer/highlight';

import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { go } from '@codemirror/legacy-modes/mode/go';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { kotlin, java, c, cpp, objectiveC, csharp } from '@codemirror/legacy-modes/mode/clike';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { diff } from '@codemirror/legacy-modes/mode/diff';

const legacy = (mode) => () => StreamLanguage.define(mode);

/* Keyed by the `mode` of each type in src/file-type.js.
   Built on first use, so one Swift file does not load every parser. */
export const languages = {
    javascript: () => javascript(),
    jsx: () => javascript({ jsx: true }),
    typescript: () => javascript({ typescript: true }),
    tsx: () => javascript({ typescript: true, jsx: true }),
    json: () => json(),
    css: () => css(),
    html: () => html(),
    markdown: () => markdown(),
    python: () => python(),
    rust: () => rust(),
    sql: () => sql(),
    xml: () => xml(),
    yaml: () => yaml(),
    swift: legacy(swift),
    shell: legacy(shell),
    toml: legacy(toml),
    go: legacy(go),
    ruby: legacy(ruby),
    kotlin: legacy(kotlin),
    java: legacy(java),
    c: legacy(c),
    cpp: legacy(cpp),
    objectiveC: legacy(objectiveC),
    csharp: legacy(csharp),
    properties: legacy(properties),
    diff: legacy(diff),
};

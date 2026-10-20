import * as PANEL from './panel/renderer.js';
import * as FRAME from './panel/frame.js';
import * as SWITCHER from './switcher/renderer.js';

// The shell's renderer side, as deckit's boot asks for it: `page(name, context)` draws a page the shell made,
// `mod(context)` is what it gives each mod, and `questions` are what main asks the shell's pages, which deckit hears
// from a page's start, so one asked before the page has drawn waits for its answer.
const questions = Object.freeze([...PANEL.questions, ...FRAME.questions, ...SWITCHER.questions]);

export { questions };
export { page } from './page/renderer.js';
export { mod } from './mod/renderer.js';

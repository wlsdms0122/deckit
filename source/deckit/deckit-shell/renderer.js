// The shell's renderer side, as deckit's boot asks for it: `page(name)` draws a page the shell made, and
// `mod(context)` is what it gives each mod.
export { page } from './page/renderer.js';
export { mod } from './mod/renderer.js';

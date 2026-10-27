# Human interface guidelines

Deckit is one app to the person using it, however many mods it runs. These guidelines are how a mod's view looks and behaves so that it reads as part of that app: where things go, how they answer the pointer and the keyboard, and what they are drawn with. [MOD.md](MOD.md) is the contract a mod is held to and [UI.md](UI.md) is the kit it draws with; this is how to use the two well.

A mod is an app and the panel is the screen it shares. A person moves between mods all day, so what is the same in two mods should look and work the same, and what is a mod's own should be in its content, not in how its frame works.

## The view

A view is two areas (MOD.md, `deck.view`): the sidebar, laid in the panel's sidebar under the mod list, and the content, beside it and up to the panel's top.

- **The sidebar is a navigator.** It lists what the content can show (files, tabs, notes, calendars, sections) and lets the person pick, add, rename and arrange them. It never holds the controls of what is shown.
- **The content is what is shown**, with its title bar on top.
- A view works with the sidebar folded. Nothing reachable only from the sidebar is needed to use what is already shown; what the sidebar adds has a key or a switcher action too.

## The title bar

The top of the content is its title bar (`ui.titleBar`). Where the window's own bar lies over the panel, the window is dragged by it, and when the sidebar is folded the window's buttons stand at its start.

- **Every view has one.** A view with nothing to put there still lays an empty bar, so the window can be dragged from the top of any mod.
- **Nothing that takes presses reaches up under the window's bar.** A web page, an editor, a canvas or a map starts below the title bar. A view drawn to the top edge leaves the person with no place to drag the window from.
- **It is a toolbar, not a band left over.** Lay it out in three parts:

| Part | What goes there | Examples |
|---|---|---|
| Leading | moving through what was shown: Back, Forward, Up, Previous, Next | Browser, Finder, Note, Calendar |
| Middle | what is shown: its title, its path, its address | the address field, a breadcrumb, a month |
| Trailing | acting on what is shown: search, a view switch, the mod's main action | Finder's view menu and filter, Calendar's Today and Day, Week, Month |

- **Leave empty room in it.** The empty parts are what drags the window. A field or a strip of tabs does not run edge to edge.
- **Height:** as tall as the window's bar where there is one (`--deckit-title-bar-area-height`, which `ui.titleBar` gives as the bar's minimum), and at least 44px where there is none.
- **Buttons are icon buttons**, `medium` with 16px icons, and each has a tooltip with its name and its key (Keys). A control with a label of its own (Today, a segmented control) is a text button or a segmented control, the same height.
- **A field in the bar is 32px tall and rounded** (`--deckit-radius-round`), on `--deckit-fill`, ringed with `--deckit-focus` while it is edited. What it controls goes in it: the Browser's Reload and bookmark star are about the page in the field, so they are inside the field.
- **Do not repeat the sidebar.** An action the sidebar's section already offers (a new tab, a new note) is not in the bar too.
- **Tabs of the content**, where a mod has them (the Editor's open files), may be the bar: the tab strip is then the title bar, with room left at its end.

## The sidebar

- **Sections.** The sidebar is made of `ui.section`s, each with a title and its actions at the end of its header: New folder, then the section's main add action (`plus`). The section's menu holds the rest.
- **Lists are trees.** What can nest is a `ui.tree`; what cannot is rows (`ui.row`). Both select on press and open on the open keys (Lists).
- **One selection**, shown with `--deckit-selected`. The row of what the content shows is the selected one.
- **Colour belongs to the thing**, not the row: a folder's colour is on the folder's row, from where it is indented, and not on what is in it.

## Content

- **Empty.** A view with nothing to show draws `ui.emptyState`: an icon, a title that says what is missing ("This folder is empty", "No notes yet"), at most one line of hint, and the one or two actions that fill it, as `small` buttons with their keys in their tooltips.
- **Loading.** `ui.loading` where the content waits on something slow.
- **Failure.** What the person asked for and could not be done is a `ui.dialog` that says what failed and why, with OK. A failure the person did not ask for (a sync, a background fetch) is shown where its result would be, not in a dialog. A command that fails shows on the mod's row in Settings (MOD.md, `deck.commands`).

## Lists

Every list in every mod answers the same keys and presses. The kit's `tree` gives most of them; a mod gives the rest the same way.

- **Open:** ⌃↩ opens the selected item where it opens in the mod (the tree's `onOpen`); ⌥↩ opens it in the app the system gives it, where there is one (Finder).
- **Rename:** `ui.inlineEdit` in place. Enter keeps the name; Escape, or Enter with the name cleared, cancels. A name is never put back to a default.
- **Delete:** ⌘⌫ and Move to Trash in the context menu. Moving a folder to the Trash, with everything in it, asks first with `ui.confirmTrash`. Deleting what cannot come back asks with a `ui.dialog` whose confirm button is destructive.
- **Context menu:** the same items as the row's actions and the keys that act on the row, in that order: open, then make, then change, then remove.
- **Drag:** a row is dragged to reorder it or move it into a folder. A folder takes a drop on its row, and the row shows `--deckit-target` while it would take it.

## What floats

Menus, popovers, dialogs, modals and quick picks float on one stack (UI.md, What floats). The top one has the keys; Escape and a press outside put it away.

- **Menu** for a choice of actions; **popover** for a small form about one thing, opened from what it is about (the bookmark editor from the star); **modal** for a form that is a task of its own (adding an account); **quick pick** for finding one of many by typing.
- **Ask only before what is hard to undo:** what goes to the Trash with more in it, what is deleted for good. Closing a tab or leaving a form does not ask.
- A float never opens on its own. It answers a press or a key.

## Keys

`mod` is ⌘ on macOS. A mod's keys are in `deck.keys`; the person can change them in Settings, so a mod reads a key with `deck.chordOf` and never writes a chord into its own text.

| Key | What it does, in any mod that has it |
|---|---|
| ⌘N, ⇧⌘N | a new item, a new folder |
| ⌘T, ⌘W, ⇧⌘T | a new tab, close the tab, reopen the closed one |
| ⌘1 to ⌘8, ⌘9 | the tab or the mode at that place, the last one |
| ⌘[, ⌘] | Back, Forward |
| ⌘F | find in what is shown |
| ⌘L | go to a place by typing it: the address, a folder, a line |
| ⌘R | reload |
| ⌘⌫ | move the selection to the Trash |
| ⌃↩, ⌥↩ | open, open with the system's app |

- Use the key in the table for its action, and no other key for it.
- **Show a key only where typing it works.** A button's tooltip shows the key of what it does (`ui.tooltip(element, { text, chord: () => deck.chordOf(name) })`). A list of actions from another place, such as the switcher, does not.
- Keys that are the shell's (⌥Space for the switcher, ⌘\ for the sidebar) are not taken by a mod.

## The look

Draw only with the kit and its tokens (UI.md, The theme). A new theme or new fonts change every token in place, and a mod drawn with them follows by itself.

- **Type:** the `--deckit-type-*` scale: caption 11, small 12, body 13, medium 14, large 15, heading 16, title 18. No sizes between them. Body is the default; small is for what sits beside something more important (a count, a time); heading and title are for the content's own titles.
- **Text the person reads and writes** (a note, a file, a message being written) is in `--deckit-text-font` at `--deckit-text-size`, or `--deckit-mono` for code, so it follows the fonts the person chose in Settings. The UI around it stays on the type scale.
- **Colour:** `text` for what is read, `muted` for what is secondary, `disabled`; `fill` for fields, `hover`, `pressed` and `selected` for state; `accent` for the one thing to press and for what is on; `ok`, `warn` and `alert` for status only. A colour of the content's own (a calendar's colour, a file type's) is data, not chrome.
- **Shape:** `--deckit-radius-*`: control 6 for buttons and rows, medium 8, card 12 for surfaces, round for pills and fields in a bar.
- **Icons** are the kit's (`ui.icon`): 16px in the title bar and in section headers, 15px in rows, 13px beside text in a line.
- **Motion:** `--deckit-fast` for state (hover, press), `--deckit-base` for something that moves or changes size, `--deckit-slow` for something that enters, all with `--deckit-easing`. With reduced motion they are 0 and nothing animates: read `theme.motion` before animating in code.

## Words

- **Title Case** for the names of things chosen from a list or pressed by their label: menu items, keys in Settings, labelled buttons, section titles (New Tab, Move to Trash, Show Hidden Files, All Notes).
- **Sentence case** for what is read: tooltips, hints, empty states, messages (New folder, Site permissions, "This folder is empty").
- Name things as the person sees them (a tab, a note, a folder), never as the code holds them.
- An ellipsis (…) ends the name of an action that asks for more before it acts (Rename…, Edit Bookmark…).

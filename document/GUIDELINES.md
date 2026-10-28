# Mod guidelines

What a mod takes care of so that it works as part of Deckit for the person using it: what shape it takes, and where each of its features goes. [MOD.md](MOD.md) is the contract deck holds a mod to and what each part of its handles, `deckit` and `shell`, does; [UI.md](UI.md) is the kit a mod draws with. This document says which of them to use for what, and names them without explaining them again.

A person meets a mod through its view, its actions in the switcher, its keys, its settings and its notifications. A headless mod has no view, and everything here but the view applies to it. The view, switcher actions and `local` keys are registered in `attach`, with what the mod shows (MOD.md, Lifecycles).

## Where things go

| What the mod has | Where it goes |
|---|---|
| What it shows and lets the person work in | the view's content (`shell.view.register`), or a window of its own (`shell.window.register`) for a mod that stands apart from the panel, such as one over every app |
| The things the content can show (files, tabs, notes, calendars) | the sidebar, in sections |
| Moving through what is shown, and acting on it | the title bar |
| Something it does | a key (`deckit.keys.register`) and a switcher action; also a button in the title bar or in a section's header when it is done while looking at the view |
| Something other mods, the host app or an automation runs by name, its args saying it in full | a command (`deckit.commands.register`). What only means something where the person is (Save, Next Tab) stays a key |
| Something due now | the switcher's `now`, and a notification when the person may be elsewhere |
| A choice set once that holds from then on | a setting (`static configuration`). One switched while working is a control in the view |
| A view shown inside another mod's | a region of that mod (`parent`, MOD.md, `shell.region`) |

## Checklist

- [ ] The view lays a title bar with `ui.titleBar`, and nothing in the view that takes presses reaches above it.
- [ ] The view can be used with the sidebar folded.
- [ ] What the mod does from a button or a menu has a key in `deckit.keys.register`, and the button's tooltip shows it with `deckit.keys.chordOf`.
- [ ] Lists are `ui.tree` or `ui.row`, and answer the keys under Lists.
- [ ] Empty, loading and failed content is drawn (`ui.emptyState`, `ui.loading`, `ui.dialog`).
- [ ] Colours, type, radii and motion come from the theme's tokens, and text the person writes follows `shell.fonts`.
- [ ] Nothing animates with reduced motion (`theme.motion`).
- [ ] Switcher actions, settings and notifications are written as Words says.

## The view

`shell.view.register` lays two areas: `sidebar`, under the mod list, and `content`, beside it and up to the panel's top.

- The sidebar lists what the content can show (files, tabs, notes, calendars) and lets the person pick, add, rename and arrange them. Controls for what is shown go in the content's title bar.
- What the sidebar does has a key or a switcher action too, so the view works with the sidebar folded.

## The title bar

The bar along the top of the content, laid with `ui.titleBar`, which lies in the window's title bar area and drags the window by its empty room (MOD.md, `shell.view.register`).

- Every view lays one, empty if it has nothing to put there, so the window can be dragged from the top of any mod.
- A web page, an editor, a canvas or a map starts below it. Pressed content drawn to the top edge leaves nowhere to drag the window from.
- Leave empty room in it: a field or a strip of tabs does not run edge to edge.
- Lay it in three parts:

| Part | What goes there | Examples |
|---|---|---|
| Start | moving through what was shown: Back, Forward, Up, Previous, Next | Browser, Finder, Note, Calendar |
| Middle | what is shown: its title, its path, its address | the address field, a breadcrumb, a month |
| End | acting on what is shown: search, a view switch, the mod's main action | Finder's view menu and filter, Calendar's Today and Day, Week, Month |

- Buttons are `ui.iconButton` at `medium` with 16px icons. A control with a label of its own (Today, a segmented control) is a text button or `ui.segmented` of the same height.
- A field in the bar is 32px tall, `--deckit-radius-round`, on `--deckit-fill`, ringed with `--deckit-focus` while it is edited. Buttons about what is in the field go inside it (the Browser's Reload and bookmark star).
- An action the sidebar's section already has (a new tab, a new note) is not in the bar too.
- Where the mod has tabs of its content (the Editor's open files), the tab strip may be the title bar, with room left at its end.

## The sidebar

- Build it of `ui.section`s. A section's header holds its actions at the end: New folder, then its add action (`plus`). The section's menu holds the rest.
- What can nest is a `ui.tree`; what cannot is `ui.row`s.
- One row is selected (`--deckit-selected`): the one the content shows.
- A folder's colour is on the folder's row, from where it is indented, and not on what is in it.

## Content

- **Empty:** `ui.emptyState` with an icon, a title that says what is missing ("This folder is empty", "No notes yet"), at most one line of hint, and the one or two actions that fill it, as `small` buttons with their keys in their tooltips.
- **Loading:** `ui.loading` where the content waits on something slow.
- **Failed:** what the person asked for and could not be done is a `ui.dialog` saying what failed and why, with OK. What failed without being asked for (a sync, a background fetch) is shown where its result would be. A command that fails is shown on the mod's row in Settings by deck.

## Lists

Every list answers the same keys and presses. `ui.tree` gives most of them; give the rest the same way.

- **Open:** ⌃↩ opens the selected item in the mod (`onOpen`); ⌥↩ opens it in the app the system gives it, where there is one.
- **Rename:** `ui.inlineEdit` in place, on Return (`onRename`).
- **Delete:** ⌘⌫ and Move to Trash in the context menu. A folder going to the Trash with what it holds asks first with `ui.confirmTrash`. What cannot come back asks with a `ui.dialog` whose confirm button is destructive.
- **Context menu:** the row's actions and the keys that act on it, in the order open, make, change, remove.
- **Drag:** a row is dragged to reorder it or move it into a folder. A folder's row shows `--deckit-target` while it would take the drop.

## What floats

- `ui.menu` for a choice of actions, `ui.popover` for a small form about one thing opened from it (the bookmark editor from the star), `ui.modal` for a form that is a task of its own (adding an account), `ui.quickPick` for finding one of many by typing.
- Ask before what is hard to undo: a folder going to the Trash with more in it, what is deleted for good. Closing a tab or leaving a form does not ask.
- A float opens from a press or a key, never on its own.

## The switcher

What a mod hands the switcher (the Switcher's `setActions`, MOD.md) is what it does, found by typing. The shell already lists a Show item for each mod, so do not add an action that only shows the mod.

- **Label:** the key's name when the action has a key; otherwise a verb first, in Title Case (New Tab, Reopen Closed Tab, Find in Page).
- **`hint`:** the few words the label leaves out, which one (the closed tab's title) or where (In a new tab), with no full stop.
- **`keywords`:** words a person would type for it that the label does not hold, in Korean and in English.
- An action that needs one more thing before it acts (which tab, which bookmark) `opens` a list of those. Something typed that the mod can act on directly (an address) is answered by `search`.
- **`now`:** what is due now, such as an event about to start or a run that failed, with `tone` for its status.
- An action whose work is seen in the view calls `shell.show()` once it knows it can be done, so a refusal is read under the switcher's list, and before it waits on anything the person answers in the view. One whose work is done out of sight does not, and its row says done, or why not.

## Settings

A mod's settings (`static configuration` in its class) are shown in Settings under the mod, drawn as its `static form` says.

- **`title`:** what the setting holds, in sentence case (Search engine, Forge command).
- **`description`:** one or two sentences, each with a full stop, saying what the setting changes and what an empty or default value does ("Empty: the forge on your login shell's PATH.", "Default follows the Fonts section.").
- A path the person types takes `~` for the home folder.
- A button on the mod's settings (Settings' `setButtons`, MOD.md) is labelled as a button is (Words), and what it answers shows under it.

## Notifications

`deckit.notify` tells the person what happened while they may be elsewhere: a reminder, a site's message, a run that ended.

- The title is what it is about (the event, the site), and the body is the rest.
- `onClick` brings the mod to the front at what it is about.
- The result of what the person just did where they are looking is shown there, in the view or on the switcher's row.

## Keys

A mod's keys are registered with `deckit.keys.register`, and the person can change them in Settings: read a key with `deckit.keys.chordOf` and never write a chord into the mod's own text. `mod` is ⌘ on macOS.

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
- A key is shown only where typing it works: in the tooltip of the button that does the same (`ui.tooltip(element, { text, chord: () => deckit.keys.chordOf(name) })`), not in a list of actions from elsewhere such as the switcher.
- The shell's keys (⌥Space for the switcher, ⌘\ for the sidebar) are not taken by a mod.

## The theme

Draw with the kit and its tokens (UI.md, The theme). A new theme or new fonts change every token in place, and a mod drawn with them follows.

- **Type:** the `--deckit-type-*` scale, and no sizes between. Body is the default; small is for what sits beside something more important (a count, a time); heading and title are for the content's own titles.
- **Text the person reads and writes** (a note, a file, a message being written) is in `--deckit-text-font` at `--deckit-text-size`, or `--deckit-mono` for code. The UI around it stays on the type scale.
- **Colour:** `text`, `muted` for what is secondary, `disabled`; `fill` for fields; `hover`, `pressed` and `selected` for state; `accent` for the one thing to press and for what is on; `ok`, `warn` and `alert` for status only. A colour of the content's own (a calendar's, a file type's) is data.
- **Radius:** `--deckit-radius-*`: `control` for buttons and rows, `card` for surfaces, `round` for pills and fields in a bar.
- **Icons:** `ui.icon`, 16px in the title bar and section headers, 15px in rows, 13px beside text in a line.
- **Motion:** `--deckit-fast` for state (hover, press), `--deckit-base` for what moves or changes size, `--deckit-slow` for what enters, all with `--deckit-easing`. An animation in code reads `theme.motion`, which is 0 with reduced motion.

## Words

- **Title Case** for what is chosen from a list or pressed by its label: menu items, keys, switcher actions, labelled buttons, section titles (New Tab, Move to Trash, Show Hidden Files, All Notes).
- **Sentence case** for what is read: tooltips, hints, setting labels, empty states, messages (New folder, Site permissions, Search engine, "This folder is empty").
- Name things as the person sees them (a tab, a note, a folder), not as the code holds them.
- An ellipsis (…) ends an action that asks for more before it acts (Rename…, Edit Bookmark…).

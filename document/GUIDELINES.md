# Mod guidelines

What a mod takes care of so that it works as part of Deckit for the person using it: what shape it takes, and where each of its features goes. [MOD.md](MOD.md) is the contract deck holds a mod to and what each part of its handles, `deckit` and `shell`, does; [UI.md](UI.md) is the kit a mod draws with. This document says which of them to use for what, and names them without explaining them again.

A person meets a mod through its window, its actions in the switcher, its keys, its settings and its notifications. A headless mod has no window, and everything here but the window applies to it. Windows and switcher actions are made in `attach`, with what the mod shows (MOD.md, Lifecycles).

## Where things go

| What the mod has | Where it goes |
|---|---|
| What it shows and lets the person work in | a window's content (`shell.windows.open`), at the `overlay` level for one over every app, at the `panel` level for one in the bar across the top of the app's window, or for a view under an item of the bar or at a place of the stage, for what the person reads and clears for a while, as the notification center |
| The things the content can show (files, tabs, notes, calendars) | the sidebar, in sections |
| Moving through what is shown, and acting on it | the title bar |
| Something it does | a command with a key (`[[contributes."deckit/keys"]]`) and a switcher action; also a button in the title bar or in a section's header when it is done while looking at the window |
| Something other mods or an automation runs by name, its args saying it in full | a command (`[[contributes."deckit/commands"]]`, MOD.md, Commands and addresses). What only means something where the person is (Save, Next Tab) is a key of the page's |
| Something due now | the switcher's `now`, and a notification when the person may be elsewhere |
| A choice set once that holds from then on | a setting (`[[contributes."deckit/configuration"]]`). One switched while working is a control in the window |
| A view shown inside another mod's | a region of that mod (`parent`, MOD.md, `shell.region`) |
| Something to glance at or reach from anywhere in the app (the time, a state, the way to a list) | an item in the status bar (The status bar) |

## Checklist

- [ ] The window lays a title bar with `ui.titleBar`, and nothing in the window that takes presses reaches above it.
- [ ] The window can be used with the sidebar folded.
- [ ] What the mod does from a button or a menu has a key declared to `deckit/keys`, and the button's tooltip shows it with the Keymap's `chordOf`.
- [ ] Lists are `ui.tree` or `ui.row`, and answer the keys under Lists.
- [ ] Empty, loading and failed content is drawn (`ui.emptyState`, `ui.loading`, a failure where its result has a place).
- [ ] Colours, type, radii and motion come from the theme's tokens, and text the person writes follows `shell.fonts`.
- [ ] Motion takes its role's spring (`--deckit-<role>`, `theme.motion.<role>`), moves only `transform` and `opacity`, and can be turned back mid-way; nothing moves with reduced motion (`length`), fades keep `fade`; what a key does comes at once.
- [ ] Switcher actions, settings and notifications are written as Words says.

## The window

A mod's window lays two areas with `ui.splitView`: the sidebar, and the content beside it.

- The sidebar lists what the content can show (files, tabs, notes, calendars) and lets the person pick, add, rename and arrange them. Controls for what is shown go in the content's title bar.
- What the sidebar does has a key or a switcher action too, so the window works with the sidebar folded.
- The shell moves the window: the person tiles it into a half, a quarter or the whole desktop by dragging its title bar to an edge or by a key, its edges meet the desktop's and other windows' as it is dragged near them, and its frame glides to each new place. The content is laid at the window's new size at once and shown through the frame as it goes, so a layout that follows its size (`ResizeObserver`, CSS) is all a mod needs; it never animates its own window.

## The title bar

The bar along the top of the content, laid with `ui.titleBar`, which lies in the window's title bar area and drags the window by its empty room. It is 48px tall, as the window's title bar is, its row centred on the window's buttons, which stand as far in from the window's left as from its top; its `title` is `heading` at 600, and a breadcrumb that names the view is its title too, its current part drawn the same. While the window is not the key one its text and glyphs go to `muted`, and a button turned off keeps its own look. A `primary` button anywhere in such a window draws as a plain one until the window is key again: the default answer is the key window's.

- Every window under the default title bar lays one, empty if it has nothing to put there, so the window can be dragged from the top of any mod.
- A web page, an editor, a canvas or a map starts at the safe area's top (`--deckit-safe-area-inset-top`). Pressed content drawn to the top edge leaves nowhere to drag the window from.
- Every mod's window keeps the default title bar. `windows.open`'s title bar options (MOD.md) are for a role the default does not serve: a toolbar taller than one row, a window with nothing to put in a bar, which takes `'titled'` instead of an empty bar, or one that cannot be resized or closed by the person. Lay out against the safe area and the title bar area, never their numbers.
- Leave empty room in it: a field or a strip of tabs does not run edge to edge.
- Where the bar is narrow, what names the view is never cut: a field gives way first and then folds into a button that opens it (Finder's filter), a segmented control becomes a `ui.select` of the same height (Calendar's Day, Week, Month), and only what is said in passing (a status) is cut.
- Lay it in three parts:

| Part | What goes there | Examples |
|---|---|---|
| Start | moving through what was shown: Back, Forward, Up, Previous, Next | Browser, Finder, Note, Calendar |
| Middle | what is shown: its title, its path, its address | the address field, a breadcrumb, a month |
| End | acting on what is shown: search, a view switch, the mod's main action | Finder's view menu and filter, Calendar's Today and Day, Week, Month |

- Buttons are `ui.iconButton` at `medium` (32px) with 16px icons. A control with a label of its own (Today, a segmented control) is a text button or `ui.segmented` of the same height. `small` (24px) is for rows and section headers, never the bar.
- A field in the bar is 32px tall, `--deckit-radius-round`, on `--deckit-fill`, ringed with `--deckit-focus` while it is edited. Buttons about what is in the field go inside it (the Browser's Reload and bookmark star).
- An action the sidebar's section already has (a new tab, a new note) is not in the bar too.
- Where the mod has tabs of its content (the Editor's open files), the tab strip may be the title bar, with room left at its end.

## The sidebar

- Build it of `ui.section`s. A section's header holds its actions at the end: New folder, then its add action (`plus`). The section's menu holds the rest.
- An action on the whole sidebar, not on one section, sits at its foot, a small labelled button (Note's New Folder).
- What can nest is a `ui.tree`; what cannot is `ui.row`s.
- A row's glyph is in the kit's slot (`ui.row({ glyph })`): `--deckit-muted`, in the row's text while it is selected. A mod does not colour it; a coloured mark (a folder, a file type, a favicon) keeps its own colours.
- One row is selected (`--deckit-selected`): the one the content shows. While the list has the keyboard (`ui.tree`), the kit draws it in `--deckit-selected-focused`, the accent's tint, so the person sees where the arrows go; a list with the keyboard and no row selected is ringed in `--deckit-focus`. While the window is not the key one, the kit draws it in `--deckit-fill`. A list draws no focus look of its own and never turns the kit's off.
- A section's heading is `--deckit-type-body` at 600 in `--deckit-muted`, never larger than the window's title.
- A folder's colour is on the folder's row, from where it is indented, and not on what is in it.

## Content

- **Empty:** `ui.emptyState` with an icon, a title that says what is missing ("This folder is empty", "No notes yet"), at most one line of hint, and the one or two actions that fill it, as `small` buttons with their keys in their tooltips; a lone action is `primary`. An empty section of a sidebar says it in one `muted` line under its heading, `ui.section({ empty })`: what is missing, then how the first is made ("No bookmarks yet. The star in the address field adds the page you are on.").
- **Loading:** where the shape of what comes is known (the rows of a list, the chips of a grid), `ui.loading.skeleton` in that shape, at the list's row height; elsewhere `ui.loading`. Both show once the wait passes 200ms and then stay at least 400ms: await `settled()` before the content replaces them. A spinner stands only in a button or in a row's icon slot (`ui.spinner({ wait })`).
- **Failed:** a failure of what the person asked is said where its result has a place, in a `ui.notice` in the view it is about (over Finder's footer) or in `alertInk` on its row, with what to do next (a Try Again button, where to set what is missing), until the next try. Only what has no such place is a `ui.toast` with `kind: 'failure'` and its one action (Notifications). A `ui.dialog` is for a decision the person has to make, never to say that something failed. A command that fails is recorded against the run, which Settings shows on the mod's row.
- **State:** what is ordinary (a mod that is not running) is said in `muted`; `alertInk` is for what went wrong. What the person should look out for and can still act on is a `ui.notice` with `kind: 'warning'`, in the view it is about.

## Lists

Every list answers the same keys and presses. `ui.tree` gives most of them; give the rest the same way.

- **Open:** ⌃↩ opens the selected item in the mod (`onOpen`); ⌥↩ opens it in the app the system gives it, where there is one.
- **Rename:** `ui.inlineEdit` in place, on Return (`onRename`).
- **Delete:** ⌘⌫ and Move to Trash in the context menu. A folder going to the Trash with what it holds asks first with `ui.confirmTrash`. What cannot come back asks with a `ui.dialog` whose confirm button is destructive.
- **Context menu:** the row's actions and the keys that act on it, in the order open, make, change, remove.
- **Drag:** a row is dragged to reorder it or move it into a folder. A folder's row shows `--deckit-target` while it would take the drop.

## What is presented

- `ui.menu` for a choice of actions, `ui.popover` for a small view or form about one thing opened from it (an event's details from its block), `ui.modal` for a form that is a task of its own (adding an account), `ui.quickPick` for finding one of many by typing.
- Nothing of a view's page is drawn over a web page it shows: what is drawn over it goes on a layer (`ui.layer`), as the Browser's find bar does, and what is presented is on one already.
- Ask before what is hard to undo: a folder going to the Trash with more in it, what is deleted for good. Closing a tab or leaving a form does not ask.
- What is presented opens from a press or a key, never on its own.
- A mod asks a seat from its window's content, never from its own page: the mod's page is shown in no window, so its `alert`, `confirm` and `prompt` are answered at once and ask nothing.

## The switcher

What a mod hands the switcher (the Switcher's `setActions`, MOD.md) is what it does, found by typing. The shell already lists a Show item for each mod, so do not add an action that only shows the mod.

- **Label:** the key's name when the action has a key; otherwise a verb first, in Title Case (New Tab, Reopen Closed Tab, Find in Page).
- **`hint`:** the few words the label leaves out, which one (the closed tab's title) or where (In a new tab), with no full stop.
- **`keywords`:** words a person would type for it that the label does not hold, in Korean and in English.
- **`icon`:** a glyph only where it says something the label does not. An action with none leads with the Switcher's own action glyph in its mod's section, and with the mod's app icon on the Now strip, where the mod is the information. In its section the app icon means the mod, as on its Show row.
- An action that needs one more thing before it acts (which tab, which bookmark) `opens` a list of those. Something typed that the mod can act on directly (an address) is answered by `search`.
- **`now`:** what is due now, such as an event about to start or a run that failed, with `tone` for its status.
- An action whose work is seen in a window brings the window forward (`makeKeyAndOrderFront()`) once it knows it can be done, so a refusal is read under the switcher's list, and before it waits on anything the person answers in the window. One whose work is done out of sight does not, and its row says done, or why not.

## Settings

A mod's settings (`[[contributes."deckit/configuration"]]`) are shown in Settings under the mod, drawn as each declaration says.

- **`title`:** what the setting holds, in sentence case (Search engine, Forge command).
- **`description`:** one or two sentences, each with a full stop, saying what the setting changes and what an empty or default value does ("Empty: the forge on your login shell's PATH.", "Default follows the General section.").
- A path the person types takes `~` for the home folder.
- A button on the mod's settings (Settings' `setButtons`, MOD.md) is labelled as a button is (Words), and what it answers shows under it.

## Notifications

A post to `deckit/notifications` (MOD.md, Standard interfaces) tells the person what happened while they may be elsewhere: a reminder, a site's message, a run that ended.

- The title is what it is about (the event, the site), and the body is the rest.
- Its `token` runs a command of the mod's that brings it to the front at what it is about.
- The result of what the person just did where they are looking is shown there, in the view or on the switcher's row. A failure is said where its result has a place, in `alert` on the row it is about (a setting that did not apply, a mod that did not restart), until the next try. What has no place of its own in the view to stay (a mod removed, a folder that holds no mod) is a `ui.toast`, a failure one (`kind: 'failure'`) with its one action.

## The status bar

A mod gives the status bar, the capsule at the top right of the app, one item: a glyph of the kit, a short label, a count, or any of them together. An item that is always there is declared in the manifest and stands whether the mod runs or not; one that comes and goes is set and removed while the mod runs ([README](../source/deckit/mods/status-bar/README.md)). An item takes a press only where it names a command of the mod's, and what it opens is a view of the mod's own under the item: a panel window bound to the anchor the bar tells for it, which the command toggles. The `attention` tone is for what waits for the person, and goes once they have seen it.

```toml
[interfaces]
uses = { "status-bar/items" = 2 }

[[contributes."status-bar/items"]]
name = "Seats"
icon = "users"
command = "show"
```

## Keys

A mod's keys are declared to `deckit/keys`, each running one of its commands, and the person can change them in Settings: read a key's chord with `chordOf(command)` on the Keymap's exports (`uses = { "deckit/keys" = 1 }`) and never write a chord into the mod's own text. `mod` is ⌘.

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
- A key is shown only where typing it works: in the tooltip of the button that does the same (`ui.tooltip(element, { text, chord: () => keys.chordOf(command) })`, `keys` the Keymap's exports), not in a list of actions from elsewhere such as the switcher.
- The shell's keys (⌘W, ⌘M and ⌘` on the key window, ⌃⌥ with an arrow or U, I, J, K to tile it, ⌃⌥↓ to put it back) and the Switcher's (⌥Space) are not taken by another mod.

## The theme

Draw with the kit and its tokens (UI.md, The theme). A new theme or new fonts change every token in place, and a mod drawn with them follows.

- **Type:** the `--deckit-type-*` scale, and no sizes between, at weight 400 or 600. Body is the default; small is for what sits beside something more important (a count, a time beside a line of text); caption is for what is packed into a dense place: a time or a stamp in a card's title row or under a title, the hours of a time grid, the label of a chip or a badge; heading and title are for the content's own titles, title with `--deckit-tracking-title`. What names a group or a column is `--deckit-type-label` in `--deckit-muted`, in sentence case and never in capitals.
- **Text the person reads and writes** (a note, a file, a message being written) is in `--deckit-text-font` at `--deckit-text-size`, or `--deckit-mono` for code. A page's text is in them too where nothing chooses another. The UI around it stays on the type scale.
- **Colour:** `text`, `muted` for what is secondary, `tertiary` for a mark that only supports what is beside it, `disabled`, never a lowered opacity on text; `fill` for fields; `hover`, `pressed` and `selected` for state; `accentFill` under `onAccent` for the one thing to press and for what is on, `accent` for text and glyphs in it; `ok`, `warn` and `alert` for status only, as dots and washes, and `okInk`, `warnInk` and `alertInk` for status as text or a glyph; `elevated` for what floats, edged by `--deckit-rim` under `--deckit-shadow-float` and no border. A colour of the content's own (a calendar's, a file type's) is data, with `ui.onColor` for the text over it.
- **Radius:** `--deckit-radius-*`: `control` for rows and `small` controls, `medium` for `medium` controls and the sidebar's card, `large` for a menu and a popover, `card` for a dialog's card and a toast, `round` for fields and pills. An inner corner is the outer one less the room between them.
- **Icons:** `ui.icon`, 16px in the title bar, section headers and sidebar rows, 15px in other rows, 13px beside text in a line. These are glyphs, for actions and places; a mod is drawn with its app icon (App icons, below).
- **Material:** glass is for navigation and floating controls: the desktop, the panel windows' material (the status bar's capsule, the notification center, whose rows lie on cards), the Dock, menus, popovers and the switcher. Where glass lies over other views of the host window (the Dock, menus, popovers, a panel window over a normal window), the host lays a material under it that blurs them (EMBEDDING.md, `stage.lay`); the surface keeps its colour as a tint over it, at `--deckit-glass`. Something that moves (the Dock sliding, a menu opening) is opaque until it stands still, and is opaque again as it goes. What is read or worked in stays opaque: window bodies, sidebars, dialogs and toasts. While the system asks for less transparency or more contrast nothing is glass: no material is laid, and every one of these surfaces is opaque. Text on glass is in the glass inks: the kit marks each of these surfaces `data-deckit-glass` (a panel window's content too), and in it `text`, `muted` and the placeholder, `tertiary`, `disabled`, `accent` and the status inks are their `glass` inks, which hold on the tint over any backdrop and keep the ladder: each a step (1.5 times the contrast) above the next, `disabled` a step below `tertiary`. An opaque part on glass (a notification's card, a field or card with its own fill) is not glass: mark it `data-deckit-solid` and it takes the plain inks. Glyphs drawn in `currentColor` or these properties follow; a colour resolved in code does not, so a glyph on glass is drawn with the custom property. A part in a page that floats over the page's own content (a minimap, a drop target) lays its colour at `--deckit-glass` over `--deckit-blur`, both opaque while the system asks for less transparency.
- **Motion:** every motion is a spring with damping 1, so nothing bounces or goes past where it is going, one for each role: `enter` for what comes on screen (a popover, a menu, a sheet, a toast), `exit` for what leaves, quicker, `move` for what is on screen and moves to another place there (a sidebar, a knob, a segmented thumb, a caret), `press` for what follows a press or the pointer (a tint, a colour, a hover). Each is `--deckit-<role>` for what moves or changes size, `--deckit-<role>-fade` for what fades or changes colour, and `--deckit-<role>-curve`, the spring as an easing; never a length or a curve written out. An animation in code reads `theme.motion.<role>` (`length`, `fade`, `easing`), and `theme.motion.over(role, px)` for a travel of known size, which takes longer the farther it goes. Only `transform` and `opacity` move. A motion is interruptible: a transition turns back from where it is, a motion in code starts again from where it stands. `length` is 0 with reduced motion, `fade` keeps its length. What a key opens or toggles comes and goes at once. A part of a mod's own moves by the kit's (`ui.motion`: `come`, `go`, `glide`, `swell`, `fold`, `appear`); rows are data and stay put, but where the person closed one by a press and the rest close up. A loop (an attention breath) keeps its own pace, each swell and ebb on the `press` spring.

## App icons

Two kinds of icon, by role. An **app icon** names a mod: a white symbol on a tile of the mod's colour, drawn as an image with `ui.appIcon`. A **glyph** names an action or a place inside a mod: the kit's line set, `currentColor`. An app icon never stands on a button, and a glyph never stands in for a mod.

- **The file:** an SVG in the mod's folder, named by the manifest's `icon` (MOD.md), `viewBox="0 0 128 128"`, at most 32 KB. One file serves every size and look: there is no dark variant.
- **The grid:** a tile 112 by 112 at an inset of 8, corner radius 26, one flat hue, 3 percent lighter at the top than at the bottom, with no highlight, inner shadow or second colour. No shadow outside the tile: the surface lays `shadow.icon` at 32px and up. The symbol sits in the middle 72 by 72, one white symbol of two or three plain shapes that reads at 16px: lines about 10 units wide, never under 8 (1px at 16), and holes cut through to the tile. A tile as dark as the dark look's `elevated` (under 1.6:1 against it) carries a faint light edge inside it, 4 units of white at 16 percent, so it holds on the dark Dock; no tile is so light it needs a dark one.
- **No text** in the file (a font that is not there changes it), nothing it would load, and no purple-to-blue gradient or glow.
- **Sizes:** the token's `appIcon`, one per role.

| Size | Where |
|---|---|
| `small` 16 | a heading in the switcher's list, the scope chip of a quick pick |
| `row` 20 | a row of the switcher or of Settings, a notification |
| `lead` 32 | a row of the switcher's Now strip |
| `dock` 40 | the Dock |
| `grid` 56 | the Mods launcher |

A mod without an icon, or with one the shell cannot draw, is drawn with the default icon, a grey tile with a white outlined cube.

## Words

- **Title Case** for what is chosen from a list or pressed by its label: menu items, keys, switcher actions, labelled buttons, section titles (New Tab, Move to Trash, Show Hidden Files, All Notes).
- **Sentence case** for what is read: tooltips, hints, setting labels, empty states, messages (New folder, Site permissions, Search engine, "This folder is empty").
- Name things as the person sees them (a tab, a note, a folder), not as the code holds them.
- An ellipsis (…) ends an action that asks for more before it acts (Rename…, Edit Bookmark…).

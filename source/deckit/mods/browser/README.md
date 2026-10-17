# Browser

Web pages in tabs, in folders, with bookmarks, an address bar that floats over the page, and find in page. What a site asks for (the camera, notifications, a certificate this Mac cannot verify) is asked of you. The Browser opens the `http` and `https` addresses other mods ask to open.

## Records

The Browser keeps what must not be lost in its records, one JSON file a key under `records/browser/` in deckit's folder, and reads these shapes only.

### Folders

The open tabs and the bookmarks are two trees of the same nodes, each a folder or an item. A folder is

```json
{ "id": 2, "title": "Work", "color": "blue", "collapsed": false, "children": [] }
```

and an item, a tab or a bookmark, is

```json
{ "id": 3, "url": "https://example.com/", "title": "Example", "icon": "https://example.com/favicon.ico" }
```

A node with `children` is a folder: its children are nodes, in order, and it stands with none. `title` may be `''`. `color` is `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange` or `grey`, or a hex `#rrggbb`. `collapsed` is whether its rows are folded away. `id` is a positive integer, one node's in its tree. `icon` is the address of the page's icon, or `''`.

### session

The open tabs, as they come back at the next start:

```json
{
    "tabs": [
        { "id": 1, "url": "https://example.com/", "title": "Example", "icon": "" },
        { "id": 2, "title": "Work", "color": "blue", "collapsed": false, "children": [] }
    ],
    "front": 1,
    "closed": [{ "url": "https://example.org/", "title": "Example", "icon": "", "parent": 2, "index": 0 }]
}
```

| Field | What it is |
|---|---|
| `tabs` | the top level of the tree of open tabs |
| `front` | the id of the tab in front |
| `closed` | the last 20 tabs closed, the newest last, for Reopen Closed Tab: `parent` is the id of the folder it was in, or `null` at the top level, and `index` its place there |

### bookmarks

The top level of the tree of bookmarks: `[{ "id": 1, "url": "https://example.com/", "title": "Example", "icon": "" }]`. One address may be bookmarked in more than one place; the star in the address bar is lit while any bookmark has the page's address. Pressed, it opens the page's bookmark added last, to change its name and folder or to remove it; a page not bookmarked is bookmarked at the end of the top level first. Add Bookmark… and Edit Bookmark… in a tab's menu do the same.

### certificates and site-permissions

What you allowed, given back to the web session at each start: `certificates` is `[{ "host", "fingerprint" }]`, a certificate this Mac cannot verify that you trusted for its host; `site-permissions` is `[{ "origin", "permission" }]`, what a site may use.

### Records written before folders

`session` and `bookmarks` kept their names and changed shape. The Browser does not read the shape before: whoever keeps a record in it writes it again in the shape above.

| Record | Before | Now |
|---|---|---|
| `session` | `{ tabs: [{ url, title, icon, group }], front, closed: [{ url, title, icon, group, at }], groups: [{ id, title, color, collapsed }] }`: `group` a group's id or `null`, `front` and `at` indexes into `tabs` | `{ tabs, front, closed }` as above. A group is a folder with its `id`, `title`, `color` and `collapsed`, at the place of its first tab, holding its tabs in the order they stood; every tab and folder has an `id`, one in the tree; `front` is the id of the tab in front; a closed tab's `group` is its `parent`, and its `index` is its place in that folder (or at the top level) |
| `bookmarks` | `[{ url, label, icon }]` | the tree of bookmarks: every bookmark and folder has an `id`, one in the tree, and a bookmark's `label` is its `title` |

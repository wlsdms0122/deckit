# Browser

Web pages in tabs, in folders, with bookmarks, an address bar in its title bar, and find in page. What a site asks for (the camera, notifications, a certificate this Mac cannot verify) is asked of you. What a site hands over as a file goes to the Downloads folder once you say to download it, and the download button at the toolbar's end lists what was downloaded: press a finished one to open it.

## Addresses

The Browser declares the `http` and `https` addresses in its manifest to `deckit/urls` (see the URLs mod), and opens one another mod asks to open from `openURL(url, { activates })` in the exports it opens for its id in `start`: in a new tab at the end, the Browser's window coming to the front unless `activates` is false. An address that comes while the Browser is not attached is passed on.

## Notifications

A site's notification, once you let the site have them, is posted to `deckit/notifications` (MOD.md, Standard interfaces), titled by the site and naming it. Pressing it runs the Browser's `show-notification` command with the tab it came from and the notification: the tab comes forward, and the site hears the press. While no mod owns the interface, a site's notification is dropped.

## Settings

Declared in the manifest to `deckit/configuration` (see the Configuration mod), and read through it.

| Key | Title | What it is |
|---|---|---|
| `homepage` | Homepage | the address a new tab opens; empty, the start page, the bookmarks as tiles |
| `searchEngine` | Search engine | where words typed in the address bar are searched: Google, DuckDuckGo or Bing |

## Commands

What a CLI, the switcher, a notification or another mod runs by name: declared in the manifest to `deckit/commands` (see the Commands mod), and run from `runCommand(id, args)` in the exports the Browser opens for its id in `start`. Each acts on the tabs in the Browser's window, open or not, `show-notification` bringing the window to the front and `new-tab` at no address opening it where it is closed; one run while the Browser is not attached fails, saying so.

| Command | Title | Args | What it does |
|---|---|---|---|
| `new-tab` | New Tab | `url`? | opens a new tab, at the address given or the homepage, its address edited when none is given |
| `reopen-tab` | Reopen Closed Tab | | opens the tab closed last again, where it was |
| `show-notification` | Show a Site's Notification | `tab`, `notification` | brings forward the tab a site's notification came from, and tells the site it was pressed |
| `switch-to-tab` | Switch to Tab | `tab`, a tab's id | brings an open tab to the front |
| `open-bookmark` | Open Bookmark | `bookmark`, a bookmark's id | opens a bookmark in a new tab |

The switcher (`switcher/actions`) offers New Tab, Reopen Closed Tab, Switch to Tab and Open Bookmark, the last two searching the tabs and the bookmarks, what the keys below do, and an address typed there, which opens in a new tab.

## Keys

The window's own shortcuts, which the Browser handles in its window while it is the key window.

| Key | Action |
|---|---|
| ⌘T | new tab |
| ⇧⌘T | reopen closed tab |
| ⌘W | close tab |
| ⌘L | edit address |
| ⌘F | find in page |
| ⌘R | reload |
| ⌘[, ⌘] | back, forward |
| ⌘1 to ⌘8 | the tab of that number |
| ⌘9 | the last tab |

## Records

The Browser keeps what must not be lost in its records, one JSON file a key under `records/browser/` in deckit's folder.

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

# Status Bar

A capsule at the top right of the app, in the bar across the top of its window, that holds in a row what other mods show there: the clock, which opens the notification center. It runs in the background from the start, and is the app's own chrome, not an app: it has no Dock item and is not listed among the apps.

## Joining it: `status-bar/items`

Status Bar defines the interface `status-bar/items`, and provides its major 1. A mod joins the status bar by naming the interface as its view's parent, and using it:

```toml
view = { parent = "status-bar/items" }

[interfaces]
uses = { "status-bar/items" = 1 }
```

The mod is then a child of the bar, whether it runs or not: the bar gives it an item, in the mods' order, and launches it to show its view there (`shell.view.register`, MOD.md). Its view fills the item, 24px tall, and draws it with the kit's `ui.barItem` (UI.md), which washes it under the pointer where it takes a press. An item is 32px wide, a 16px glyph with 8 on each side, until the mod tells another width on the exports the bar opens in `attach`; it is laid 320px wide at most:

```js
const item = shell.ui.barItem({ content, title });
shell.view.register({ content: item.element });
deckit.dependencies.onConnect('status-bar/items', (bar) => {
    bar.setWidth(item.width());
});
```

| Export | What it is |
|---|---|
| `setWidth(width)` | lays the mod's item `width` px wide, a number above 0; any other value is not taken |

A press in an item is the person's input reaching its mod, and leaves the keyboard where it was: a window the mod opens next may take it. A mod that leaves the interface, or is removed, leaves the bar, and the capsule closes while it holds no item.

## The capsule

A panel window (`level: 'panel'`, MOD.md), 28px tall and as wide as its row, the items 4px apart, 2px in from its round ends. The shell stands it in the bar at the top right, on the panel material.

## Permissions

| Permission | Why |
|---|---|
| `deckit.panel-windows` | stands in the bar across the top of the app's window, holding what other mods show there |

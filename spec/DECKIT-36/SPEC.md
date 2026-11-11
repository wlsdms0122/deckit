# DECKIT-36: Regions and drops

Status: draft
Area: shell

## Summary

A mod's window may show another mod's view in a place it gives, and take the files a person drops on it from outside the app. This DECKIT fixes the manifest field `view`, by which a mod names the interface of the mod whose places show its view; `view.register(view)`, through which its run gives that view; `region(element, interface)`, a **region**, a place over an element of a window's content where a mod shows the view of one of its **children**, the mods that name an interface it owns, and the region's `place(id)` and `clear()`; which child is shown where, laid over what of the element is seen and cut to its window, and what a child's view is told as it comes on screen and leaves; `children.list(interface)` and `children.onChange(listener)`, through which a mod reads its children and is told they changed; and `dropDestination(element, options)`, through which a mod takes the paths dropped on an element, the innermost of destinations one inside another first, at a point from the element's top left.

## Motivation

A mod that lays out other mods' views, a sidebar of panels or a host for tools, cannot draw them itself: each runs in a sandbox of its own and reaches only its own page. Only the shell can lay one mod's page over another's window, and only through rules both mods are written against:

```toml
# mod-b, a panel
view = { parent = "mod-a/panels" }

[interfaces]
uses = { "mod-a/panels" = 1 }
```

```js
// mod-a, which provides mod-a/panels
const region = shell.region(element, "mod-a/panels");
await region.place("mod-b");
```

Each of these is a run two implementations could answer differently without a rule:

- `mod-a` places `mod-b`, which does not run. One implementation launches it; another refuses, and the panel is empty until the person opens `mod-b` some other way.
- `mod-a` places `mod-b` in a second region. One implementation shows it in both; another moves it, and a third refuses.
- The element scrolls half out of its window. One implementation lays `mod-b` over the whole element, over what of `mod-a` lies beside the window; another cuts it to the window.
- A person drops two files on an element inside another element, each a destination. One implementation calls both, the outer first; another calls the inner alone, with the point from the window's top left.
- `mod-a` calls `shell.region(element, "mod-a/other")`, an interface it does not provide. One implementation throws with no kind; another answers a region that never shows anything.

## Rules

### The field view

The shell adds the field `view`, among the fields it adds, as [the bundle](../DECKIT-2/SPEC.md) lets a layer add one, and reads it of a mod the system took, as [the Dock](../DECKIT-33/SPEC.md) reads the fields the shell adds: the system judges no value of it, and a value that does not read as the table gives is read as the field left out.

| field | read as | what it says |
|---|---|---|
| `view` | a table whose key `parent` is bound to a string, the name of an interface the mod uses, as [the interfaces](../DECKIT-10/SPEC.md) fix `uses`; any other value, and a `parent` that names no interface the mod uses, read as none | the interface whose owner shows the mod's view |

A mod whose field `view` names an interface is a **child** of that interface, whether its run is `running` or not. It is a child of the mod that owns the interface, as [the interfaces](../DECKIT-10/SPEC.md) fix the owner, where that mod provides the major the child uses, and of no mod otherwise. A mod's **children** of an interface it provides are the children of that interface whose parent it is: none where it is not the interface's owner.

### view.register(view)

`view.register(view)` is a registration, as [the shell](../DECKIT-29/SPEC.md) fixes the shape: it answers nothing and is never refused. It registers only on the handle handed to `attach`, from the call of `attach` until the shell's lifecycle has started, once: a call after it registers nothing, and so does one by a mod whose field `view` names no interface, and one handed what does not fit what it takes:

| key of `view` | takes | required | what it says |
|---|---|---|---|
| `content` | element | yes | what the mod's view shows; it fills the mod's page |
| `didAppear`, `didDisappear` | function | no | the parts under *What a child is told* |

A key of `view` the table does not give is not read, as [the handle](../DECKIT-7/SPEC.md) reads a table. A child that registers no view is shown nowhere.

### region(element, interface)

`region(element, interface)` answers at once, as [the shell](../DECKIT-29/SPEC.md) fixes a member that does, a **region**: a place over `element` where the mod's run shows the view of one of its children of `interface`. It throws, and makes nothing, at `call`: with kind `INVALID_ARGUMENT` where `element` is no element or `interface` is no string naming an interface the mod's manifest provides, as [the interfaces](../DECKIT-10/SPEC.md) fix `provides`; then as [the shell](../DECKIT-29/SPEC.md) refuses a member of a cut handle, with kind `ENDED`.

A region **ends** as its element, once in the mod's page or its windows' content, leaves it, and as the handle `shell` that made it is cut. A region shows at most one child, and a child is shown in at most one region. The region's members are requests, as [the shell](../DECKIT-29/SPEC.md) fixes the shape:

| member | takes | answers | what it does |
|---|---|---|---|
| `place(id)` | `id`, a string | nothing | the region shows the mod `id`, out of any other region it was in, and launches it, as [the lifecycle](../DECKIT-5/SPEC.md) launches a mod, where its run is not `running` |
| `clear()` | nothing | nothing | the region shows no child |

Each is refused, and does nothing, at `call`: with kind `INVALID_ARGUMENT` where what it is handed does not fit what it takes; then as a member of a cut handle, with kind `ENDED`; then with kind `ENDED` where the region has ended; then, `place`, with kind `INVALID_ARGUMENT` where `id` names no child of `interface` of the mod's.

A region that showed a child shows none once the child is a child of it no more: once another mod owns the interface, or the child's field `view` names another, as the system reads the bundles again.

**Note.** A child is placed by the mod it names in its own manifest, so its launch is what showing it takes, as a client's connection launches the owner of the interface it uses. A parent reaches no mod but its children.

### Where a child is shown

A region's **rect** is what of its element is seen: the element's rect in its window's content, cut to each element it lies in that cuts what overflows it, and nothing while the element is hidden. A region in a window on screen, normal or overlay, as [windows](../DECKIT-31/SPEC.md) fix them, whose rect is not empty, shows its child where the child's run is `running` and has registered a view: the shell lays the child's page over the rect, the rect in the window's frame, cut to the window's frame, over the window's content and in the window's place in the order. A region whose element is in no window shows nothing.

So the child's view is drawn over what of the parent lies under the rect, and nothing of the parent's is drawn over it; and as the window moves, comes in front or goes behind another, the child's view moves with it.

### What a child is told

A child's view comes **on screen** as the shell lays it over a region's rect, and leaves it as the shell lays it there no more: as the region is cleared, shows another child or ends, as its rect becomes empty, as its window closes or goes off screen, and as the parent's or the child's run ends. It calls the part its `view` gave under each name as it is told:

| part | told as the child's view |
|---|---|
| `didAppear` | comes on screen |
| `didDisappear` | leaves the screen |

A view moved from one region on screen to another stays on screen and is told nothing. As the child's shell lifecycle ends, its view on screen is told `didDisappear` before `detach()` is called.

### Children

| member | shape | takes | answers |
|---|---|---|---|
| `children.list(interface)` | a request, as [the shell](../DECKIT-29/SPEC.md) fixes the shape | `interface`, a string | an array of the mod's children of `interface`, in [the catalog's](../DECKIT-4/SPEC.md) order, each a table `{ id, name, icon }`: `id` its id, `name` the name it is listed by, as [the bundle](../DECKIT-2/SPEC.md) fixes `name`, and `icon` its icon, as [the Dock](../DECKIT-33/SPEC.md) reads the field `icon`, or `""` where it has none |
| `children.onChange(listener)` | answers at once, as [the shell](../DECKIT-29/SPEC.md) fixes the shape | `listener`, a function | its off, a function that answers nothing: once called, the listener is called no more |

`children.list` is refused at `call` with kind `INVALID_ARGUMENT` where `interface` is no string naming an interface the mod's manifest provides; then as a request of a cut handle, with kind `ENDED`. `children.onChange` throws at `call` with kind `INVALID_ARGUMENT` where `listener` is no function, then as a member of a cut handle, with kind `ENDED`. The listener is called `listener(interface, children)` once each time the mod's children of an interface it provides change, `children` as `children.list(interface)` answers them then. It is called no more as the handle that made it is cut.

### dropDestination(element, options)

`dropDestination(element, options)` answers at once, as [the shell](../DECKIT-29/SPEC.md) fixes a member that does, its off, a function that answers nothing: once called, the destination is told nothing more. It makes `element` a **drop destination**, which takes the files a person drags from outside the app and drops on it:

| key of `options` | takes | required | what it says |
|---|---|---|---|
| `onDrop` | function | yes | called `onDrop(paths, point)` as files are dropped on the element: `paths` an array of the path of each file, as [files outside the app](../DECKIT-30/SPEC.md) write a path, in the order dropped, and `point` a table `{ x, y }`, where they were dropped, from the element's top left |
| `onTargeted` | function | no | called `onTargeted(true)` as a drag of files comes over the element, and `onTargeted(false)` as it leaves it or is dropped |

It throws, and makes nothing, at `call`: with kind `INVALID_ARGUMENT` where `element` is no element, `options` is no table or a key it holds does not fit the table; then as [the shell](../DECKIT-29/SPEC.md) refuses a member of a cut handle, with kind `ENDED`. A key of `options` the table does not give is not read.

Files are dropped on the page laid where they are dropped, a child's view over a region's rect among them, and of the destinations in that page whose elements hold the point, one inside another, the innermost alone is told. A destination is told nothing more once the handle that made it is cut.

## Interactions

- The handle `shell`, the shapes of its members, a registration, a cut handle and `ENDED`: [the shell](../DECKIT-29/SPEC.md). A request, a table it takes and a key past it, `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md).
- A field a layer adds and `name`: [the bundle](../DECKIT-2/SPEC.md). How the shell reads the fields it adds, and `icon`: [the Dock](../DECKIT-33/SPEC.md). The catalog's order, and the bundles read again as one is installed or removed: [the catalog](../DECKIT-4/SPEC.md).
- `provides`, `uses`, the owner of an interface, a major and `mods.pin`: [the interfaces](../DECKIT-10/SPEC.md).
- A launch and a run's end: [the lifecycle](../DECKIT-5/SPEC.md). A registration open while a start runs, as `exports.register` is: [the connections](../DECKIT-9/SPEC.md).
- The desktop, a window's content, its frame, the order, on screen and off it, and overlay windows: [windows](../DECKIT-31/SPEC.md). A path of a file outside the app: [files outside the app](../DECKIT-30/SPEC.md).
- The input `drop` and the look `regions`: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- A child shown in every region that places it. A mod's page is one document, laid in one place; a second region would show a copy that takes no input, or the same page twice.
- `place` refused for a child that does not run, or guarded by a permission. The child named the interface to be shown by its owner, and a region would stay empty until the person launched it another way.
- The child's view laid over the element's whole rect. What of the element is cut away, scrolled out of its list or out of the window, would be covered by a view that floats over the parent's other content and other windows.
- `children.list` a value of the handle, read at once. Which mods are children is the catalog's, read as the bundles are, as `mods.list` reads the apps; the page holds it no more than the catalog.
- Every destination holding the point told, the outer first. A drop is one act of the person on one place, and a destination inside another is the place the mod drew for it.
- `dropDestination` with [files outside the app](../DECKIT-30/SPEC.md). Where a drop lands on a page, the element, the innermost destination and a child's view laid over a region, is this DECKIT's; what it hands, a path, is that one's.
- A region in an overlay window showing nothing, as an overlay window floats apart from the desktop. The region is a place in the parent's page, and the window is the parent's at either level; a rule that named the level would be one more thing a mod's author learns, and would hold for no reason of the region's.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. `ENDED` of a cut handle, and a region ended, a listener called no more or a destination told nothing more as the handle is cut: a case reads what the mod's code reaches through the host's layer, whose lifecycle ends last, as [the shell](../DECKIT-29/SPEC.md) says of its cases. That a child's content fills its page, that the child's view is laid over the window's content and in the window's place in the order, and what is drawn over what: no look reads a page's layout or what is drawn. A registration on a handle not handed to `attach`, or by a mod whose field `view` names no interface: a case's mod is handed the handle `shell` in `attach` alone, and a mod that is no child is shown nowhere whatever it registers. The off `children.onChange` answers: no step calls a function a call answered. A region that shows a child no more as the child's field `view` names another interface: no step changes a bundle a case ships. A drag that leaves an element without a drop: the input `drop` drops what it drags.

**Note.** What this costs an implementation: it follows each region's element as the page lays it out, frame by frame, and lays each child's page over the window it is in as the window moves and the order changes; it reads every mod's field `view` and the owner of each interface again as the bundles are read again and a pin is set, and tells each parent's listeners; and it finds, for each drop, the page laid at its point and the innermost destination there.

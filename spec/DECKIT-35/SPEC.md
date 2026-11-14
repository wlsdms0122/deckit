# DECKIT-35: The look

Status: draft
Area: shell

## Summary

Every page the shell draws in wears one **look**: the host app's, light or dark, with the fonts the person chose. This DECKIT fixes the pages the shell draws in; `theme`, a value of [the handle `shell`](../DECKIT-29/SPEC.md), what of it every implementation holds (whether it is dark, the font and the size text is written in, the person's fonts, and the colours of text, of its ground and of what is chosen) and the custom properties a page's styles read it by; `theme.onChange(listener)`, through which a mod is told it changed; `fonts.set(fonts)`, through which a mod granted `deckit.fonts` sets the person's fonts, which the shell keeps; the manifest field `styles` and `styles.register(styles)`, through which a mod granted `deckit.styles` lays styles over the pages of the app, and the order each page wears them in; and `ui`, the kit, whose components are the implementation's.

## Motivation

A mod draws its view in the app's look, and a settings mod lets the person choose the size text is written in:

```js
attach(shell) {
    this.view.style.background = shell.theme.color.background;
    shell.theme.onChange(() => this.redraw());
}
```

```js
await shell.fonts.set({ size: 16 });
```

Without this DECKIT, `theme.dark` is the host app's look on one implementation and always `true` on another; a mod that draws in `--deckit-background` finds it on one and nothing on the other; the person sets the size to 16, and one implementation writes every mod's text at 16 while another changes only the settings mod's page, or forgets it as the app starts again. A mod that themes the app declares a style for every page, and one implementation lays it over the desktop's own page and another over the mods' pages alone; two mods style one page, and which one wins depends on the implementation. What the pages wear is the shell's to fix, since every page a mod's view is drawn in is the shell's.

## Rules

### The pages the shell draws in

The shell **draws in** these pages: the desktop's own page and what it lays over it, as [windows](../DECKIT-31/SPEC.md) fix the desktop; the page of a mod's run, from before the shell first hands a lifecycle of the run the handle `shell`, as [the shell](../DECKIT-29/SPEC.md) hands it, `attach` among them; and the content of each of the run's windows, which wears what the run's page wears. Each wears the theme, the person's fonts and the styles below, and wears each anew, in place, as it changes.

### The theme

The host app has a **look**, light or dark, which the host hands the shell as the shell starts and again each time it changes. The **theme** is the look with the person's fonts. `theme`, a value of the handle `shell`, holds at least these members, each read as it is now:

| member | value | what it is |
|---|---|---|
| `dark` | boolean | whether the host app's look is dark |
| `textFont` | string, a CSS `font-family` value | the font text is written in where nothing chooses another: the face of the person's fonts first, where they chose one |
| `textSize` | integer | the size in CSS pixels text is written in where nothing chooses another: the size of the person's fonts, where they chose one |
| `fonts` | table `{ text, size }` | the person's fonts, under *The person's fonts*, each left out where they chose none |
| `color.text` | string, a CSS colour | the colour of text |
| `color.background` | string, a CSS colour | the colour of the ground text lies on |
| `color.accent` | string, a CSS colour | the colour of what is chosen, and of what a press acts on |

Every page the shell draws in wears the theme: its colour scheme is dark where `dark` is `true` and light otherwise, and the root of its document holds these custom properties, each the member's value as CSS writes it:

| custom property | value |
|---|---|
| `--deckit-text` | `color.text` |
| `--deckit-background` | `color.background` |
| `--deckit-accent` | `color.accent` |
| `--deckit-text-font` | `textFont` |
| `--deckit-text-size` | `textSize`, in `px` |

The text of a page that nothing styles is written in `textFont` at `textSize`.

The theme **changes** as the host hands a look that is not the one before, and as the person's fonts change. Every page the shell draws in wears the new theme, and `theme` reads it, on the handle of every mod.

**Note.** What else `theme` holds, and the values of the colours and of the font where the person chose none, are the implementation's: they are its look on screen, as the sizes, corners and shadows of its own components are. The members above are what a mod needs to draw in the app's look and to follow the person's fonts.

| member | takes | answers |
|---|---|---|
| `theme.onChange(listener)` | `listener`, a function, required | `off`, a function that answers nothing |

`theme.onChange` answers at once, as [the shell](../DECKIT-29/SPEC.md) fixes the shape, and throws at `call` with kind `INVALID_ARGUMENT` where `listener` is no function, then with kind `ENDED` once its lifecycle has ended. From then, each change of the theme calls `listener` once, with no arguments, once `theme` reads the new theme. A listener is called no more once `off()` is called and once the lifecycle whose handle it was handed to ends.

### The person's fonts

The **person's fonts** are a table `{ text, size }`: `text` a string, the name of a font family, of 1 to 256 Unicode scalar values, none a control character (general category `Cc`); `size` an integer from 11 to 22, the size in CSS pixels. Each is not required, and one left out is the implementation's default. The shell keeps them as the host app's, no mod's: they stand as the host app starts again, and removing a mod, its data erased or not, leaves them as they are.

| member | takes | answers | guarded by |
|---|---|---|---|
| `fonts.set(fonts)` | `fonts`, a table `{ text, size }`, required: `text` a string, not required; `size` an integer, not required | the person's fonts as kept, each left out where it is the default | `deckit.fonts` |

`fonts.set` is a request. It sets the person's fonts whole, to `fonts`: a font `fonts` leaves out is the default. It answers once what it set is kept, and from then the theme reads it. It is refused at `call`, and nothing of it is done, with the first of these that is so:

1. with kind `NOT_PERMITTED`, where the mod is not granted `deckit.fonts`;
2. with kind `INVALID_ARGUMENT`, where `fonts` does not fit what the member takes, or `text` or `size` is not one of the person's fonts above;
3. with kind `ENDED`, once the lifecycle whose handle it was called through has ended, as [the shell](../DECKIT-29/SPEC.md) cuts a handle.

**Note.** The person's fonts are read in `theme.fonts`, and their change heard through `theme.onChange`, by any mod: every page wears them, so what they are is in every page already. `deckit.fonts` guards changing them, which changes how every mod's text is written.

### Styles

A **style** is a text of CSS. A mod granted `deckit.styles` lays styles over the pages the shell draws in, each style for one **target**: the string `"*"`, every page the shell draws in, or a mod's `id`, as [the bundle](../DECKIT-2/SPEC.md) writes one, the pages it draws in for that mod's run, its page and its windows' content. A mod gives its styles in two ways:

| | where | what it gives | worn while |
|---|---|---|---|
| **declared** | the manifest field `styles`, which the shell adds | a table, each key a target, bound to a string, a `path` of a file in the bundle, as [the bundle](../DECKIT-2/SPEC.md) writes one, whose text is the style | the system holds the bundle taken, the mod's run running or not |
| **registered** | `styles.register(styles)`, a registration of the handle `shell` | `styles`, a table, each key a target, bound to a string, the style | the mod's run runs |

The shell reads the field `styles` of a mod the system took, as [the Dock](../DECKIT-33/SPEC.md) reads the fields the shell adds: the system judges no value of it. A key that is no target, a key bound to no string, and a path that names no file of the bundle are each read as left out, and the rest is read. A mod not granted `deckit.styles` declares nothing.

`styles.register` is a registration, as [the shell](../DECKIT-29/SPEC.md) fixes the shape: it answers nothing and is never refused. It registers only on the handle handed to `attach`, from the call of `attach` until the shell's lifecycle has started, once: a call after it registers nothing, and so does one by a mod not granted `deckit.styles` and one handed what does not fit what it takes.

Each page the shell draws in wears every style whose target is it, laid over the page's own styles and over the theme, in this order, each over the ones before it, as CSS lays a style sheet over those before it:

1. by the mods that give them, in the catalog's order, as [the catalog](../DECKIT-4/SPEC.md) fixes it;
2. of one mod, its declared styles before its registered ones;
3. of one mod's declared or registered styles, the one of `"*"` before the one of the mod's `id` the page is drawn for.

**Note.** A mod's declared styles are the look it gives the app whether or not it runs; what its run registers is laid over them while it runs. A mod's styles go over those of a mod before it in the catalog.

### The kit

`ui`, a value of the handle `shell`, is the **kit**: the components the shell draws its own pages with, drawn in the theme, which a mod's view is drawn with as the shell's own pages are.

**Note.** What the kit holds, each component and what it takes, is the implementation's: an implementation's kit is its own, as its look on screen is. A mod that draws with the kit is drawn as that implementation draws, and one that draws with the theme alone is drawn alike on every implementation.

### The permissions

The shell defines these permissions, as [the permissions](../DECKIT-3/SPEC.md) define one, after those of [the shell's keys](../DECKIT-34/SPEC.md), in this order:

| id | name | description | privileged |
|---|---|---|---|
| `deckit.styles` | `Styles` | `It can change how every page in the app looks, other mods' among them, and so read what they show.` | `false` |
| `deckit.fonts` | `Fonts` | `It can change the fonts and the text size every mod writes text in.` | `false` |

## Interactions

- The handle `shell`, the shapes of its members, a registration, a value, a cut handle and `ENDED`: [the shell](../DECKIT-29/SPEC.md). A request, a table it takes and a key past it, `INVALID_ARGUMENT`: [the handle](../DECKIT-7/SPEC.md). `NOT_PERMITTED` and how a permission is defined: [the permissions](../DECKIT-3/SPEC.md).
- A field a layer adds, `id` and `path`: [the bundle](../DECKIT-2/SPEC.md). How the shell reads the fields it adds: [the Dock](../DECKIT-33/SPEC.md). The catalog's order, a bundle taken and removing it with `erase`: [the catalog](../DECKIT-4/SPEC.md).
- What a layer keeps of a mod, which the person's fonts are not: [the embedding](../DECKIT-22/SPEC.md).
- A mod's run and its end: [the lifecycle](../DECKIT-5/SPEC.md). A registration open while a start runs, as `exports.register` is: [the connections](../DECKIT-9/SPEC.md).
- The desktop and a window's content: [windows](../DECKIT-31/SPEC.md).
- The host app's look as the base `shell` hands it, the input `appearance` and the look `worn`: [the case format](../DECKIT-1/SPEC.md).

## Alternatives considered

- `fonts.get()`, a member that answers the person's fonts at once, or a request. The fonts change as any mod sets them, and a value read at once is read where its change is told: `theme.fonts`, with `theme.onChange`, which every page wears already.
- `fonts.set` that changes only the fonts it names, a null putting one back to its default. No value is null, as [the handle](../DECKIT-7/SPEC.md) fixes values, so a font once chosen could not be put back; set whole, the default is the font left out.
- `fonts.onChange`, a listener of the fonts apart from the theme's. A change of the fonts is a change of the theme every page wears, and a mod would hear one change twice.
- Every member of the theme fixed, its type sizes, corners, shadows and colours of each state among them. Each implementation's look on screen would be fixed by the specification, and a host could not draw its own; the members fixed are those a mod needs to draw in the app's look.
- The values of the colours fixed, or handed by the host as they are. The colours a host app draws its content in are its own look, and a mod reads them where it draws.
- A field `styles` that does not read refused at `read`. The system judges no value of a field a layer adds, and the mod runs without what it gives.
- A mod's registered styles before its declared ones, or every mod's declared styles before every mod's registered ones. A mod's run could not adjust its own look, or a mod's run would go over a mod after it in the catalog, which the person installed to go over it.
- `styles.register` that a later call replaces. The styles of a run are given once, as its exports are, and a mod that changes its look as it runs writes styles that read a custom property it sets.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The values of `color.text`, `color.background`, `color.accent` and `textFont`, and of their custom properties: they are the implementation's, and `textFont` holds the host's face. A window's content, and what the desktop lays over its own page: no look reads either. That the text of a page that nothing styles is in `textFont` and `textSize`: no look reads a page's text. A page of a run whose lifecycles are never handed `shell`: every run of a case's base `shell` hands one to the host's layer. A listener called no more after `off()` or its lifecycle's end, and `ENDED`: a case reads the listener's calls through the host's layer, whose lifecycle ends last, as [the shell](../DECKIT-29/SPEC.md) says of its cases. A size that is no integer, such as 14.5: the manifest text has no number with a decimal, so no case hands one. Removing a mod with `erase`: what [the catalog](../DECKIT-4/SPEC.md) erases is read by its own cases, and the person's fonts are kept apart from every mod. That `ui` is on the handle: a call answers no function. A style laid over the theme: a case's style sets no custom property the theme holds, since what the theme holds there is the implementation's.

**Note.** What this costs an implementation: it hands every page it draws in the theme before the mod's code draws, and each change of it in place; it keeps the person's fonts across starts; it reads each style file of every mod granted `deckit.styles` that the system holds, running or not, and lays the styles over each page in the order above as mods are installed, removed, launched and quit.

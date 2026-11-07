# DECKIT-2: The bundle

Status: draft
Area: system

## Summary

A mod arrives as a bundle: a folder holding a manifest, `manifest.toml`, and the files it names. This DECKIT fixes what a bundle is, the text a manifest is written in, every field the system reads and what each means, how a layer or a host adds fields and permissions of its own, what the system answers of a bundle it read, and which bundles it refuses. Every refusal here is at `read`, before any of the mod's code runs, but the two that refuse a host's own definitions as the app starts.

## Motivation

The system reads a bundle before anything of the mod runs, and a mod author writes one bundle for every implementation. Two implementations that disagree about a bundle make one mod run on one and not on the other. Each of these is a bundle two implementations could answer differently without a rule:

```toml
id = "Notes"           # Notes and notes are one folder on a file system that ignores case
version = "1.0"        # read as 1.0.0, or refused
api = "1.3.0"          # taken by a host that runs 1.2.0, or refused
main = "../shared.js"  # a file outside the bundle
color = "blue"         # a key no one reads: passed over, or refused
```

Three more, each a whole bundle read in place. A mod that is not a system mod asks for a permission its host defines privileged, and is refused as its bundle is read, or taken and refused only when it first calls:

```toml
id = "notes"
version = "1.0.0"
api = "1.0.0"
main = "main.js"

[permissions]
"case.drive" = "Drives the other mods."   # the host defines case.drive privileged
```

A bundle that is taken is answered to the host, and what the answer holds decides what every host can show of it: its name where none is written, its reason as written or trimmed, its permissions in which order:

```toml
id = "notes"
version = "1.0.0"
api = "1.0.0"
main = "main.js"

[permissions]
zeta = " Syncs the pages. "
alpha = "Takes a photo of a page."
```

A bundle that is refused is still a mod the host finds, and must be listed under some name for the host to say why it does not run: the id it writes, its folder's name, or none:

```toml
id = "notes"           # in a folder named shelf
api = "1.0.0"          # no version: refused
main = "main.js"
```

A layer on the system and a host add fields and permissions of their own (the shell adds the fields it draws a mod with), and a mod written for a host with more layers is read by a host with fewer. What such a bundle comes to cannot be left to each implementation either.

## Rules

### What a bundle is

A bundle is a folder that holds a file named `manifest.toml` at its top. The folder's name says nothing about the mod: the manifest says who the mod is. What else the folder holds, and how it is laid out, is the mod's.

A folder that holds no `manifest.toml` is not a bundle. Where the system looks through a folder of bundles, it passes over every folder in it that is not a bundle and every name that begins with `.`, and lists nothing for them. Where it is handed one folder to read as a bundle, and that folder is not one, it refuses at `read` with kind `NOT_LOADABLE`.

A **path** a manifest names is a file inside the bundle:

```
path    = segment *( "/" segment )
segment = 1*( any code point but "/" and "\" )      ; and not "." or ".."
```

A path is resolved from the bundle's folder, following every link, and names a regular file whose resolved place is inside the bundle's resolved folder.

A name the system looks up in a folder, each segment of a path and the name `manifest.toml`, names the entry of that folder whose name is the same sequence of Unicode scalar values. No case is folded and nothing is normalized.

**Note.** On a file system that ignores case, or that takes two normalizations of a name as one, opening a name may find an entry of another spelling. An implementation there lists the folder and compares the names itself, for each segment of a path and for `manifest.toml`, which costs a listing for each name looked up.

### The manifest's text

A manifest is UTF-8 text in a language based on TOML, which the grammar below gives whole. A leading U+FEFF is dropped, the text is split into lines at LF, and a CR that ends a line is dropped. The notation is ABNF's; `ws` is any code point with the Unicode property White_Space, but LF.

```
manifest       = line *( LF line )
line           = ws [ entry ws ] [ comment ]
entry          = table-header / array-header / key-value
table-header   = "[" ws key-path ws "]"
array-header   = "[[" ws key-path ws "]]"
key-path       = key *( ws "." ws key )
key-value      = key ws "=" ws value
key            = bare-key / quoted-key
bare-key       = 1*( ALPHA / DIGIT / "_" / "-" )
quoted-key     = basic-string
value          = basic-string / literal-string / boolean / integer / array / inline-table
basic-string   = DQUOTE *( basic-char / escape ) DQUOTE
basic-char     = any code point but DQUOTE and "\"
escape         = "\" ( "n" / "t" / "r" / "b" / "f" / DQUOTE / "\" / "u" 4HEXDIG / "U" 8HEXDIG )
literal-string = "'" *( any code point but "'" ) "'"
boolean        = "true" / "false"
integer        = [ "+" / "-" ] 1*DIGIT
array          = "[" vs [ value vs *( "," vs value vs ) [ "," vs ] ] "]"
inline-table   = "{" vs [ key vs "=" vs value vs *( "," vs key vs "=" vs value vs ) ] "}"
vs             = *( ws / LF )
comment        = "#" *( any code point but LF )
```

A key is the string it writes: a `bare-key` its code points, a `quoted-key` the string its `basic-string` gives. Two keys are the same key when they are the same sequence of Unicode scalar values, and nothing is normalized.

What the grammar does not hold refuses the bundle at `read` with kind `NOT_LOADABLE`, and so does each of these:

- An entry is one line. A `key-value` whose value holds more `[` than `]` outside its strings goes on to the next lines until they balance, and a comment may end each of those lines.
- The key of a `key-value` is the text before the first `=` of its line, so a `quoted-key` there holds no `=`.
- A `\u` or `\U` escape gives a Unicode scalar value.
- An integer lies from -(2^53 - 1) to 2^53 - 1, that is from -9007199254740991 to 9007199254740991.
- Arrays and inline tables nest at most 32 deep.
- A `key-value` sets its key in the table the last header opened, or in the root before any header. A key set twice in one table, an inline table among them, refuses.
- A `table-header` opens the table its path reaches, making each table on the way. A table opened by a `table-header` twice refuses, and so does a `table-header` whose path ends at an array of tables.
- An `array-header` adds a new table at the end of the array of tables at its path, making the array the first time. One whose path holds a value that no `array-header` made, or a table a `table-header` opened, refuses.
- A header's path that goes through an array of tables goes on in its last table. A header's path that reaches a key holding any value but a table or an array of tables refuses.

A table holds no order: two manifests whose tables hold the same keys bound to the same values are the same manifest.

**Note.** The grammar has no floats, dates, times, multi-line strings, literal keys or dotted keys. A key that holds a `.` is quoted, `"system.network" = "…"`, because a bare `a.b = 1` would read in TOML as a table inside a table, and this reader reads no such thing rather than read it otherwise.

**Note.** Beyond what the grammar leaves out, the language takes some text TOML 1.0 refuses and refuses some it takes, so a TOML library does not read it as the rules above do. These are every such difference:

- `ws` is every code point with White_Space but LF, where TOML has only space and tab.
- A string and a comment take control characters, which TOML refuses.
- A value with more `[` than `]` goes on over lines, so an inline table inside an open `[` may span lines, where TOML holds an inline table on one line.
- A header may go on in a table an inline table wrote, `extra = { a = 1 }` then `[extra]`, where TOML refuses it.
- An integer with leading zeros, `007`, is read as 7, where TOML refuses it.
- An integer lies within ±(2^53 - 1), where TOML takes every integer a signed 64-bit integer holds.

**Note.** The bound on integers is the widest range in which every integer is a double-precision number that no other integer rounds to, so an integer is handed as the same number in every host language and on the web, and a case can measure it on both sides. A layer that needs a larger integer reads it written as a string.

### A manifest's values as values

What the system hands on as written (an added field, a declared entry) is handed as a value, each TOML kind as one kind:

| written | handed as |
|---|---|
| a string | a string |
| an integer | a number |
| a boolean | a boolean |
| an array | an array of the values it holds |
| a table, by a header or inline | a table of the keys it holds, each bound to its value |

### The fields

A manifest's top-level keys are these fields and the fields the layers on the system and the host add (*What a layer or a host adds*, below), and no others. A key that is neither refuses.

| field | value | required | what it says |
|---|---|---|---|
| `id` | string, an `id` | yes | who the mod is, to the system and to every other mod |
| `name` | string, not blank | no | the name the mod is listed by; the id where it is not written |
| `version` | string, a `version` | yes | the mod's own release |
| `api` | string, a `version` | yes | the version of the mod contract the mod is written against |
| `main` | string, a `path` | yes | the entry: the file the system evaluates as the mod's run launches |
| `background` | string, not blank | no | why the mod runs in the background. A mod whose manifest writes it is a background mod |
| `interfaces` | table, under *interfaces* | no | the interfaces the mod provides and those it uses |
| `permissions` | table, under *permissions* | no | each permission the mod asks for, with why |
| `contributes` | table, under *contributes* | no | the entries the mod declares to interfaces |

A string is **not blank** when it holds a code point without the property White_Space.

```
id        = name-part
interface = name-part "/" name-part
name-part = ( lower / DIGIT ) *63( lower / DIGIT / "." / "_" / "-" )   ; holding no ".."
lower     = %x61-7A                                                     ; a to z
version   = number "." number "." number                               ; MAJOR.MINOR.PATCH
number    = 1*DIGIT                                                     ; at most 2^53 - 1, 9007199254740991
major     = an integer, at least 0
```

**Note.** An id is in lower case because each mod keeps what it stores under its id, and on a file system that ignores case `Notes` and `notes` are one folder while comparing as two ids.

#### interfaces

A table, whether a header or an inline table writes it, of `provides` and `uses` and no other key:

| key | value | what it says |
|---|---|---|
| `provides` | table: `interface` → a non-empty array of `major`, each greater than the one before it | the interfaces the mod provides, each with the majors of it the mod speaks |
| `uses` | table: `interface` → a `major` | the interfaces the mod uses, each with the one major of it the mod speaks |

```toml
[interfaces]
provides = { "notes/pages" = [1, 2] }
uses = { "switcher/actions" = 1 }
```

An interface is named `<mod id>/<name>`: the id of the mod that defines it, and a name. What providing and using come to (an interface's owner, the connections, a major that does not match) is the connections' DECKIT.

#### permissions

A table: a permission's id → a string, not blank, that says why the mod asks for it.

```toml
[permissions]
"system.network" = "Syncs the pages."
```

A permission's id is any string a `key` writes. Where a permission asked for is one that neither the system, a layer nor the host on this host defines, the bundle is still taken, and the permission is **not usable**: the mod runs without what it guards. A bundle that asks for a permission defined **privileged** is taken only when it is a system mod's, and any other refuses at `read` with kind `NOT_LOADABLE`. A **system mod** is one whose bundle the host ships and marks system, and no other: a bundle read in place, or installed from a folder, is not one.

#### contributes

A table: an `interface` → an array of tables, each an entry the mod declares to that interface. An array may be empty.

```toml
[[contributes."switcher/actions"]]
title = "New Page"
command = "new-page"
```

Each entry is handed as a value to the interface's owner, in the order written. What an entry holds is the interface's to define, and the system reads none of it.

### Versions

A version is `MAJOR.MINOR.PATCH`, each part a number. A version **satisfies** another when the two have the same major, and its minor is greater, or its minor is the same and its patch is at least the other's.

The host runs mods with one version of the mod contract. A bundle is taken only when that version satisfies the bundle's `api`.

### What a layer or a host adds

Before the app starts, each layer on the system and the host may add manifest fields and define permissions. The system defines permissions of its own, which the permissions' DECKIT fixes.

A **field** is added by its name, any string a `key` writes. The field is then a top-level key a manifest may write, with any value, and the system judges nothing of its value: it hands it on as written, as a value, to whatever reads it, and the layer or host that added it judges it where it reads it.

A field added refuses the app's start at `call` with kind `FIELD` where its name is not a string, is one of the fields above, or is added twice.

A **permission** is defined as:

| key | value | required | what it says |
|---|---|---|---|
| `id` | string: any string a `key` writes | yes | the permission's id, the key a manifest asks for it by |
| `name` | string, not blank | yes | the name the permission is listed by |
| `means` | string, not blank | yes | what the permission grants, shown wherever it is listed |
| `privileged` | boolean | no | whether only a system mod may ask for it; `false` where not given |

A permission defined refuses the app's start at `call` with kind `PERMISSION` where it is not as the table gives, or where its id is defined twice, by the system, a layer or the host.

Two field names are one name, and two permission ids one id, when they are the same sequence of Unicode scalar values, as two keys are, wherever they are written, asked for or defined.

**Note.** No case holds a definition whose `privileged` is not a boolean, or whose name or id is not a string a `key` writes, because [the case format](../DECKIT-1/SPEC.md) types each of them and a case cannot hand one.

**Note.** A host with fewer layers than the one a mod was written for still takes its bundle: a permission no layer defines is not usable, and a mod reads what it reaches as it runs. A field no layer adds is refused, because a field is read where the bundle is read and a misspelled one would otherwise pass unseen.

### What the system answers of a bundle

A bundle is **taken** when every rule above holds and the file `main` names is in it, and is then answered as this table, the manifest as read:

| key | value |
|---|---|
| `id` | string: the `id` |
| `name` | string: the `name` as written, or the `id` where none is |
| `version`, `api`, `main` | string: as written |
| `background` | string: as written; absent where not written |
| `provides` | table: each interface → its array of majors, as written; empty where not written |
| `uses` | table: each interface → its major; empty where not written |
| `permissions` | array of tables, one for each permission asked for, in the order below |
| `contributes` | table: each interface → its array of entries, each as a value; empty where not written |
| `fields` | table: each added field the manifest writes → its value; empty where it writes none |

Each permission asked for is answered as:

| key | value |
|---|---|
| `id` | string: the id |
| `reason` | string: what the manifest writes, without the code points with White_Space at its ends |
| `usable` | boolean: whether a layer or the host on this host, or the system, defines it |
| `name`, `means`, `privileged` | as the permission is defined; absent where it is not usable |

The usable permissions come first, in the order they were defined, the system's own first. Then come the ones not usable, by their ids compared as Unicode scalar values: at the first place two ids differ, the one whose scalar value there is smaller comes first, and where one id is the other's beginning, the shorter comes first.

A bundle the system does not take is refused at `read` with kind `NOT_LOADABLE`, and no run of it starts. Where it was found in a folder of bundles or shipped by the host, it is still listed, under the id its manifest writes where the manifest's text reads and its `id` is a non-empty string, and otherwise under its folder's name.

## Interactions

- When a background mod launches, what launching evaluates of `main`, and what an entry that does not evaluate refuses at `launch`: the lifecycle's DECKIT.
- What `provides`, `uses` and `contributes` come to: the connections' DECKIT.
- The permissions the system defines and what each one grants: the permissions' DECKIT.
- What a host ships and marks system, and when it adds fields and defines permissions: the embedding DECKIT.
- Two bundles of one id, which one is read, installing and removing: the catalog's DECKIT.
- The fields the shell adds and what it reads of them: the shell's DECKITs.

## Alternatives considered

- What a mod declares in a JSON file of its own, named by a field. A bundle would have two texts and two readers, and a field would name a file whose shape is judged only once that file is read. One text says each thing one way.
- Refusing a permission no layer on this host defines. A mod written for a host with more layers would not run on one with fewer, though it can run without what the permission guards.
- Passing over a top-level key no one reads. A misspelled field (`backgound`) would be taken and do nothing, and the mod's author would never be told.
- Ids compared without case. A mod's id would have two spellings, and two mods could not be told apart by comparing their ids as strings.

## Notes

**Note.** A refusal's message is not measured, and an implementation says it as it likes. The cases under `conformance/` measure that a bundle is taken or refused at `read` with kind `NOT_LOADABLE`, and what it is answered.

**Note.** Four sentences above are held by no case under `conformance/`, and each waits on what will hold it. That a folder of bundles passes over every name that begins with `.` waits on [the case format](../DECKIT-1/SPEC.md), whose `bundle-name` cannot begin with one. That a bundle installed from a folder is not a system mod waits on the catalog's DECKIT, which gives installing. That no run of a refused bundle starts waits on the lifecycle's DECKIT, whose states the `run` look reads. That the system's own permissions come first waits on the permissions' DECKIT, which fixes them.

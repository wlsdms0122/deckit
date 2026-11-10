# DECKIT-18: Packages

Status: draft
Area: system

## Summary

`deckit/packages` is the standard interface through which a mod is installed from a folder once the mods it depends on are installed. A folder names what its mod depends on in a package file beside its manifest, `package.toml`: each mod by its id, with the versions of it the mod takes. A client granted `deckit.mods` asks the interface's owner to install the folder: a dry run answers what [the catalog](../DECKIT-4/SPEC.md)'s dry run answers, with each dependency, the version installed and whether it is met, and an install is refused while one is not met. This DECKIT fixes the package file and the requirements it writes, the request `install` with its answer and refusals, and that no dependency is fetched or installed by it. Which mod ships as the owner is the embedding's.

## Motivation

A mod that calls an interface another mod provides runs on a host only once that mod is installed at a version that provides what it calls. Its folder says so:

```toml
# package.toml
[dependencies]
forge = "1.2"
notes = ">=2.1, <3"
```

and a settings mod, written once for every mod, installs the folder for a person. Without a rule, `forge` installed as `1.9.0` meets `1.2` on one implementation and not on another, which reads `1.2` as `1.2.x`; `notes = ">2"` is refused on one, read as `>=2` on another and passed over on a third; and the folder is installed with `forge` missing on one host and refused on another, so a settings mod could not tell a person before installing what is missing. A mod's manifest is the system's, and what it depends on is not: the system takes a bundle on what the bundle alone holds, as [the bundle](../DECKIT-2/SPEC.md) fixes it, and a mod installed while another is missing still runs and is refused where it calls. What a dependency is, the versions a requirement takes and what `install` answers are the interface's to fix, so that every client and every owner read a package file alike.

## Rules

### The package file

A folder **holds** a package file where `package.toml` is a file in it, beside its manifest, read as [the bundle](../DECKIT-2/SPEC.md) reads a manifest's text. It is a table, and its key `dependencies`, where it is written, a table: each key the id of a mod the folder's mod **depends on**, bound to a `requirement`, a string. A key of the file other than `dependencies` is not read. A folder that holds no package file, and a package file with no `dependencies`, depend on nothing.

```
requirement = comparator *( *WS "," *WS comparator )
comparator  = [ operator *WS ] version
operator    = "^" / "~" / "=" / ">=" / "<"
version     = part [ "." part [ "." part ] ]
part        = 1*DIGIT
WS          = a white space code point
```

White space may stand before and after the requirement too. A part is a whole number no greater than 2^53 - 1, and a part left out of a version reads as 0. A requirement **takes** a version, `MAJOR.MINOR.PATCH` as [the bundle](../DECKIT-2/SPEC.md) writes one, where every comparator of it takes it, and parts are compared in order, major first:

| comparator | the versions it takes |
|---|---|
| `v`, `^v` | `v` and each version above it, below the one past the leftmost part `v` writes that is not 0, or past its last part written where every part it writes is 0: that part one more and each part after it 0. `1.2` takes `1.2.0` to below `2.0.0`, `0.2.3` takes `0.2.3` to below `0.3.0`, `0.0` takes `0.0.0` to below `0.1.0` |
| `~v` | `v` and each above it, below the next minor where `v` writes its minor, and the next major where not |
| `=v` | each version whose parts `v` writes are those of `v`: `=1.2` takes `1.2.0` to below `1.3.0` |
| `>=v` | `v` and each version above it |
| `<v` | each version below `v` |

### The request

The owner of `deckit/packages`, as [the interfaces](../DECKIT-10/SPEC.md) fix one, provides major `1`, and its exports hold the member `install` on every connection, a function a call of which is a request, as [calls across a connection](../DECKIT-11/SPEC.md) fix one. The client's **own mod** is the one the credential the connection hands the owner names, and its permissions are the client's:

| member | takes | answers | guarded by |
|---|---|---|---|
| `install(folder, options)` | `folder`, a string, required; `options`, a table `{ dryRun }`, not required, `dryRun` a boolean, not required, `false` where it is left out | what the install of [the catalog](../DECKIT-4/SPEC.md), `mods.install(folder, options)`, answers; with `dryRun` true, that with one more key, `dependencies`, below | `deckit.mods` |

`install` asks the install of the catalog, through the owner's own handle, with `folder` and `options`, and answers what it answers, once the dependencies are read. With `dryRun` true it installs nothing, as the catalog's dry run does, and answers whether or not each dependency is met. No mod a folder depends on is fetched or installed by it.

`dependencies` is an array, one table `{ id, requirement, installed, satisfied }` for each mod the folder depends on, in the order written: `id` its id, `requirement` its requirement as written, `installed` the `version` of the bundle the catalog lists under `id`, as [the catalog](../DECKIT-4/SPEC.md)'s `list` answers it, left out where none is listed or the bundle listed is refused, and `satisfied` a boolean, whether the requirement takes `installed`, `false` where it is left out. A dependency is **met** where `satisfied` is `true`.

A request is refused with the first of these that is so, at `call`:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, with kind `NOT_PERMITTED`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, with kind `INVALID_ARGUMENT`;
3. with kind `NOT_LOADABLE`, where `folder` holds a package file that does not read as a manifest's text does, whose `dependencies` is not a table, or with a dependency whose value is not a `requirement`;
4. where `dryRun` is not true, with kind `UNMET_DEPENDENCY`, where a dependency is not met, and nothing is installed;
5. with the kind the install of [the catalog](../DECKIT-4/SPEC.md) refuses it with.

**Note.** The refusal `NOT_LOADABLE` is the kind [the bundle](../DECKIT-2/SPEC.md) refuses a folder with whose manifest does not read: a package file that does not read is the same condition, of the same folder. It is refused at `call`, where the catalog's is at `read`, since it crosses a connection, as [calls across a connection](../DECKIT-11/SPEC.md) fix one.

## Interactions

- A manifest's text, a bundle's `version` and the kind `NOT_LOADABLE`: [the bundle](../DECKIT-2/SPEC.md).
- `deckit.mods` and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- The install of a folder and its dry run, what they answer and refuse, and what `list` answers: [the catalog](../DECKIT-4/SPEC.md).
- `INVALID_ARGUMENT`, and what a value is: [the handle](../DECKIT-7/SPEC.md).
- The owner of an interface and the connection to it: [the interfaces](../DECKIT-10/SPEC.md). A call of a member of the exports and a refusal across a connection: [calls across a connection](../DECKIT-11/SPEC.md).
- The bundle a step hands as a folder, and the owner a case's host ships: [the case format](../DECKIT-1/SPEC.md).
- Which mod a host ships as the owner: the embedding DECKIT.

## Alternatives considered

- Dependencies in the manifest, read by the system. The system takes a bundle on what it alone holds, and a bundle taken on one host and refused on another for what is installed beside it would make the catalog depend on the order mods arrive in; what a mod needs of another is the package manager's to say.
- The owner fetching and installing what is missing. Where a mod comes from is a host's and a person's to choose, and an install that installs others would do what the person did not ask.
- A requirement of the ranges of every package manager, with `>`, `<=`, `*` and pre-releases. A version is `MAJOR.MINOR.PATCH` and nothing else, as [the bundle](../DECKIT-2/SPEC.md) writes it, and each comparator here is one range, so a requirement is one range and is read the same way by every owner.
- A dry run refused while a dependency is unmet. A settings mod tells a person what is missing before the install, and could not read it from a refusal, whose message is not measured.
- A kind of the interface's own for a package file that does not read, such as `PACKAGE`. A kind names the condition that refused it, and the folder's manifest that does not read is already `NOT_LOADABLE`.
- `options.dryRun` read as true for any value but `false`. A value is never read as another, as [the handle](../DECKIT-7/SPEC.md) fixes it.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. That nothing is fetched: no rule says from where it would be. A part past 2^53 - 1 and a key of the file other than `dependencies`: each is a way a requirement or a file is read that a case writes the same way as those it writes. That `install` asks the catalog through the owner's own handle: a case reads what it answers and refuses, which the cases of [the catalog](../DECKIT-4/SPEC.md) hold.

**Note.** What this costs an implementation's owner: it reads the folder's package file itself, before the catalog reads the folder, so it reaches the folder's files on the host, and it reads the catalog's `list` on each request.

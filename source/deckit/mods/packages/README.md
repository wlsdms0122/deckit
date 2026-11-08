# Packages

The package manager: a mod installs from a folder once the mods it depends on are installed at versions it takes. It has no view, and launches as a client connects to it. It neither fetches nor installs a dependency.

## The package file

A mod's folder may hold `package.toml` beside its manifest. Its `[dependencies]` table names each mod it depends on by id, with a version requirement:

```toml
[dependencies]
forge = "1.0"
notes = ">=2.1, <3"
```

A requirement is one or more comparators separated by commas, all of which a version meets. A comparator is an operator and a version of one to three whole numbers, the parts left out read as 0:

| Comparator        | Versions it takes                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.2.3`, `^1.2.3` | those from it up to the next change of its leftmost part that is not 0, or of its last part written: `1.2` takes `1.2.0` to below `2.0.0`, `0.2.3` takes `0.2.3` to below `0.3.0`, `0.0` takes `0.0.0` to below `0.1.0` |
| `~1.2.3`          | those from it up to the next minor where the minor is written, the next major where not                                                                                                                                 |
| `=1.2.3`          | those whose parts written are these: `=1.2` takes `1.2.0` to below `1.3.0`                                                                                                                                              |
| `>=1.2.3`         | it and every one above it                                                                                                                                                                                               |
| `<1.2.3`          | every one below it                                                                                                                                                                                                      |

A folder with no package file depends on nothing. The file is read as TOML by a reader of the mod's own, the one its manifest is written in.

## Providing `deckit/packages`

Packages provides `deckit/packages` major 1. A client calls it when it holds `deckit.mods`, which installing takes anyway; any other call rejects with kind `REFUSED`.

| Call              | What it does                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plan(folder)`    | what `deckit.mods.plan(folder)` answers, with `dependencies` `[{ id, requirement, installed, satisfied }]` in the order written, `installed` the version of the mod of that id now, or null for none, and `satisfied` whether the requirement takes it |
| `install(folder)` | installs through `deckit.mods.install(folder)` and answers what it answers, once every dependency is satisfied                                                                                                                                         |

Besides what `deckit.mods` rejects with, each rejects with why, the `kind` saying which:

| Kind               | Why                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------- |
| `PACKAGE`          | `package.toml` is no TOML, or its `dependencies` is no table                        |
| `REQUIREMENT`      | a requirement is not written as the comparators above                               |
| `UNMET_DEPENDENCY` | `install` only: a dependency is not installed at a version it takes, each one named |

# The Deckit specification

Deckit is an operating system for mods that a host app embeds, and this is where what it does is written down. An implementation follows these DECKITs, and nothing it does beyond them is Deckit. Where a decision lands a cost on an implementation, or where the cases cannot hold a rule, the DECKIT that makes the decision says so in a **Note.**, so a second implementation is told rather than left to find it.

This describes the mod contract **1.0.0**, the version a manifest's `api` names.

These DECKITs are written the way a protocol is written: they say what a conforming implementation **must** do, field by field and input by input, and the cases under each DECKIT's `conformance/` are the same statements as data.

## What Deckit is

A host app is built once and shipped. A mod is what is added to it after that, the way a game takes mods: a view, a command, a few keys, a way to open an address, an interface other mods use, work in the background, in any mix. The host app is the machine: the process and its windows. Deckit is what runs mods on it.

Everything the system does follows from that one fact, that a mod **arrives after the host was built**:

- **A mod comes from elsewhere**, so nothing about it is known until its bundle is read, and the system reads the bundle before any of its code runs and refuses there what it cannot take.
- **A mod reaches only what it is given.** Each mod runs in a sandbox of its own and reaches the system, other mods and the machine only through the handle its code is handed, and only as far as its permissions say.
- **A mod is written once for every host**, so what a bundle and a handle are cannot depend on the host. A host adds to them only by the means the system gives it: manifest fields, permissions and interfaces of its own.
- **Two implementations run the same mods** (another host language, the web), so agreement cannot mean the same code. It means these DECKITs and their cases.

## What the specification fixes

Every function of Deckit, in four areas. Each DECKIT names the one it is in.

| area | what it is | what its DECKITs fix |
|---|---|---|
| `system` | the operating system for mods | the bundle, the handle a mod's code is given, permissions, a mod's lifecycle (launch, background, stop, the relaunch limit), interfaces and connections, events, storage, the standard interfaces (`deckit/*`), and embedding: what a host ships, marks system and adds |
| `shell` | the GUI on the system | the panel, the Dock, the mod in front, a mod's windows, the surfaces over the app, the shell's keys, the manifest fields the shell adds, and the `shell` handle |
| `app` | Deckit.app, the host app that embeds the system with the shell on | what it ships and marks system, its windows, and its own answers to what the system asks a host |
| `mods` | the mods the app ships | what each one does, one or more DECKITs titled by the mod |

**An area is built on the ones before it.** A DECKIT states its rules in terms of its own area and the areas listed before it, and never in terms of an area after it. A host may run the system with no shell on; Deckit.app is one host among any; a shipped mod is a mod like any other, and its DECKIT states what it does through the surfaces the areas under it fix.

**Not the specification:** how this implementation is split inside, such as the Swift packages Deck and Deckit, the protocol between the core's process and the shell's main side, and Electron. A second implementation follows the DECKITs and passes the same cases without knowing any of it.

## Conformance language

**must / must not** are requirements. **refuses** means the implementation answers an error that carries a kind and does nothing else of what was asked: no bundle half read, no run started on a bundle it refused, no call half done.

A refusal happens at one of three stages, and the stage is part of the behaviour:

1. **`read`**. The bundle is not one the system takes: its manifest does not parse, a field is not one this host reads, a permission is privileged and the mod is not marked system, the file `main` names is not in the bundle. Nothing of the mod has run.
2. **`launch`**. The bundle was taken, and its run does not start: its entry does not evaluate, or does not give what a run needs.
3. **`call`**. A request the system is handed is refused: through a mod's handle, on a connection, or through what the system gives a host.

The stage of a rule is the earliest stage that has what the rule needs. What the bundle alone decides refuses at `read`; what needs the entry's code refuses at `launch`; what needs a request refuses at `call`. Two implementations that run the same mods alike and refuse at different stages are not the same system: a refusal at `launch` where another refuses at `read` lists a mod as installed that can never run.

A refusal's **kind** is an upper-case name, `[A-Z][A-Z_]*`, fixed by the DECKIT that states the refusal. The stage and the kind are measured. A refusal's message is not, and no DECKIT states one.

**Note.** A paragraph opening with **Note.** is not a requirement. It says what a rule is for, what an implementation is likely to get wrong, or what the rule would cost written another way. Removing every one of them removes nothing an implementation is held to, and the cases never measure one.

**How the DECKITs write examples.** A block of TOML is manifest text as [the bundle](DECKIT-2/SPEC.md) reads it. An inline table, `{ id = "notes" }`, shows a value, and brackets, `[1, 2]`, a list.

## How DECKITs work

The rules are a series of DECKITs. A DECKIT is one rule family: `DECKIT-N/SPEC.md` states it, and `DECKIT-N/conformance/` holds the cases that measure it, each a folder named by the case under [conformance](DECKIT-1/SPEC.md). A case's name is unique across the specification, so a case is found by its name without its DECKIT. A number is never reused.

A `SPEC.md` takes the shape [the template](TEMPLATE.md) gives: a summary, the motivation, the rules, which are its only normative part, where they meet the rest of the specification, the alternatives not taken, and notes. Every `SPEC.md` holds every section, and a section with nothing to say is left empty. It opens with `# DECKIT-N:` and its title, then its status and its area:

- **`draft`**: not part of the specification. It is changed freely and nothing is held to it. A draft that is not accepted is deleted.
- **`accepted`**: part of the specification. A draft is accepted when it meets [the acceptance criteria](../review/CRITERIA.md), which a review checks one by one.

**How a rule is written.** A rule gives a form whole, the way a drawing gives a part's dimensions and not only its material. A manifest's fields are a table, a name or a text is a grammar, a call is a signature with its answer and its refusal kinds, and the prose beside each says what each part means. A rule says what a thing is. It is not written against the one input that raised it, such as "an id holds no capital": that input is a case, and why the form is what it is goes in a **Note.** A rule never tells apart who sent an input: what one sender may do and another may not is a permission.

An accepted DECKIT is supplemented in place: its prose made clearer, its cases added to or corrected. A change that would give any of its existing cases another answer is not a supplement. It is a new DECKIT that replaces the old one whole and says so on the line after its area, `Supersedes: DECKIT-a, DECKIT-b`. Nothing replaces part of a DECKIT. A DECKIT is superseded when an accepted DECKIT names it under `Supersedes`, and the superseded DECKIT does not say so itself, so the fact has one place.

The specification is every accepted DECKIT that no accepted DECKIT supersedes: the live set. A runner runs the cases of those and no others. Which DECKITs they are is worked out from the series by a tool and never written down. An implementation that pins a version of this specification conforms to it when it passes the cases of every DECKIT in the live set at that version.

The DECKITs can be read in any order and cannot be *built* in any order. Their numbers follow the order in which each one's questions can be decided, which is also the order in which an implementation can keep its cases passing as it grows. Conformance comes first, since every other DECKIT's cases are written in it. Then the system, from the bundle up: permissions, the lifecycle, connections and events, storage, the handle, the standard interfaces and embedding. Then the shell, then the app, then each shipped mod.

A reader looking for *why* rather than *what* has two entry points that are neither forms nor rules: **What Deckit is** above, which says what the system is for, and the **Note.** paragraphs, which say what a rule is for and where a decision lands a cost on an implementation.

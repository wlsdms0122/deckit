# The Deckit specification

This is where what is decided about Deckit is kept. Deckit is an operating system for mods that a host app embeds. An implementation follows these DECKITs, and nothing it does beyond them is Deckit. Where a decision lands a cost on an implementation, or where it cannot be measured, the DECKIT that makes the decision says so in a **Note.**, so a second implementation is told rather than left to find it.

**This describes the mod contract 1.0.0, the version a manifest's `api` names.**

## What Deckit is

A host app is built once and shipped. A mod is what is added to it after that, the way a game takes mods: a view, a command, a few keys, a way to open an address, an interface other mods use, work in the background, in any mix. The host app is the machine: the process and its windows. Deckit is what runs mods on it.

Everything the system does follows from that one fact, that a mod **arrives after the host was built**:

- **A mod comes from elsewhere**, so nothing about it is known until its bundle is read, and the system reads the bundle before any of its code runs and refuses there what it cannot take.
- **A mod reaches only what it is given.** Each mod runs in a sandbox of its own and reaches the system, other mods and the machine only through the handle its code is handed, and only as far as its permissions say.
- **A mod is written once for every host**, so what a bundle and a handle are cannot depend on the host. A host adds to them only by the means the system gives it: manifest fields, permissions and interfaces of its own.
- **Two implementations run the same mods** (another host language, the web), so agreement cannot mean the same code. It means these DECKITs and their cases.
- **It is an operating system**, so where operating systems settle a question alike, such as how often a failed service starts again or how long a launch may take, Deckit takes their answer, stated in its own terms.

Every function of Deckit is in one of four areas, and each DECKIT names the one it is in:

| area | what it is | what its DECKITs fix |
|---|---|---|
| `system` | the operating system for mods | the bundle, the handle a mod's code is given, permissions, a mod's lifecycle (launch, background, stop, the relaunch limit), interfaces and connections, events, storage, the standard interfaces (`deckit/*`), and embedding: what a host ships, marks system and adds |
| `shell` | the GUI on the system | the panel, the Dock, the mod in front, a mod's windows, the surfaces over the app, the shell's keys, the manifest fields the shell adds, and the `shell` handle |
| `app` | Deckit.app, the host app that embeds the system with the shell on | what it ships and marks system, its windows, and its own answers to what the system asks a host |
| `mods` | the mods the app ships | what each one does, one or more DECKITs titled by the mod |

**An area is built on the ones before it.** A DECKIT states its rules in terms of its own area and the areas listed before it, and never in terms of an area after it. A host may run the system with no shell on; Deckit.app is one host among any; a shipped mod is a mod like any other, and its DECKIT states what it does through the surfaces the areas under it fix.

**Not the specification:** how this implementation is split inside, such as the Swift packages Deck and Deckit, the protocol between the core's process and the shell's main side, and Electron. A second implementation follows the DECKITs and passes the same cases without knowing any of it.

## How the specification works

The specification is a record of decisions, kept as DECKITs. A DECKIT is not rewritten once it is decided. When what it decides has to change, a new DECKIT replaces it, and the old one stays where it was: what held before is still there to read, it is plain that it no longer holds, and the DECKIT that replaced it says what holds instead. So the specification is also the project's history, and it can be read in the order things were decided.

`spec/` is one series, the DECKITs, since it holds [the template](TEMPLATE.md), which gives the prefix, the fields a DECKIT's head may write and the sections every DECKIT holds. Beside the DECKITs, `spec/` holds this page and the review in [`review/`](review/README.md), and nothing else.

A DECKIT is a folder `DECKIT-N/`: its `SPEC.md`, and beside it `conformance/`, the cases that measure it, each a folder named by the case under [the case format](DECKIT-1/SPEC.md). What the project uses everywhere, its tools and its code, is not a DECKIT's to hold. `DECKIT-N` is its key. N is the next number free when it is drafted, it is never used again, and it says nothing else about the DECKIT.

A `SPEC.md` opens with `# DECKIT-N:` and its title, then the fields the template declares, in the template's order. Status and Area are always written:

- **`draft`**: proposed, not decided. It is changed freely and nothing is held to it. A draft that is not accepted is deleted.
- **`accepted`**: decided. A draft is accepted when it meets [the acceptance criteria](review/CRITERIA.md), which a review checks one by one.

Every `SPEC.md` holds every section of the template, in order, and a section with nothing to say is left empty.

**How a rule is written.** A rule gives a form whole, the way a drawing gives a part's dimensions and not only its material. A manifest's fields are a table, a name or a text is a grammar, a call is a signature with its answer and its refusal kinds, and the prose beside each says what each part means. A rule says what a thing is. It is not written against the one input that raised it, such as "an id holds no capital": that input is a case, and why the form is what it is goes in a **Note.** A rule never tells apart who sent an input: what one sender may do and another may not is a permission.

**Supplement or supersede.** An accepted DECKIT is supplemented in place while what it decides stays as it was: its prose made clearer, its cases added to or corrected, every case keeping its answer. A change to what it decides is not a supplement. It is a new DECKIT that replaces the old one whole and says so on the line after its area, `Supersedes: DECKIT-a, DECKIT-b`. Nothing replaces part of a DECKIT. A DECKIT is superseded when an accepted DECKIT names it under `Supersedes`, and when that DECKIT is accepted, the superseded one says so on its own head, `Superseded-By: DECKIT-c`, so whoever opens it sees at once that it no longer holds. Its text is not touched. The tool that accepts a draft writes that line, and the tool that checks the specification sees that the two agree. Until Deckit's first release, an accepted DECKIT is changed in place even when what it decides moves.

A draft that changes accepted DECKITs lists the changes in `IMPACT.md`, beside its `SPEC.md`: each accepted DECKIT, the sentence, the change, and whether it is a supplement or a supersession. The list is what a review checks the draft's reach against. It is removed when the draft is accepted, since by then each change it lists is made.

Deckit as it stands is every accepted DECKIT that no accepted DECKIT supersedes, the live set. Which DECKITs those are is worked out by a tool and never written down.

The DECKITs can be read in any order and cannot be *built* in any order. Their numbers follow the order in which each one's questions can be decided, which is also the order in which an implementation can keep its cases passing as it grows. The case format comes first, since every other DECKIT's cases are written in it. Then the system, from the bundle up: permissions, the catalog, the lifecycle, the entry, the handle, connections and events, storage, the standard interfaces and embedding. Then the shell, then the app, then each shipped mod.

**How the DECKITs write examples.** A block of TOML is manifest text as [the bundle](DECKIT-2/SPEC.md) reads it. An inline table, `{ id = "mod-a" }`, shows a value, and brackets, `[1, 2]`, a list.

## Conformance

Every DECKIT is measured. Its cases hold its rules, and whether an implementation conforms is a fact a run prints and never a judgement. A sentence no case can hold says why in a **Note.**

**must / must not** are requirements. **refuses** means the implementation answers an error that carries a kind and does nothing else of what was asked: no bundle half read, no run started on a bundle it refused, no call half done.

**Note.** A paragraph opening with **Note.** is not a requirement. It says what a rule is for, what an implementation is likely to get wrong, or what the rule would cost written another way. Removing every one of them removes nothing an implementation is held to, and no case measures one.

The cases are the rules written as data, in the format [the case format](DECKIT-1/SPEC.md) fixes, in each DECKIT's `conformance/`. A case has a name, a note saying which rule it measures and how, the host it sets up, the inputs it hands the host app and what each step must come to: an answer, or a refusal at a stage with a kind. One case breaks one rule. A case's name is unique across the specification, so a case is found by its name without its DECKIT. The runner is `deckit conformance`, which reads each case, sets up its host, hands it the inputs and compares what comes back. An implementation that pins a version of this specification conforms to it when it passes the cases of every live DECKIT at that version.

A refusal happens at one of three stages, and the stage is part of the behaviour:

1. **`read`**. The bundle is not one the system takes: its manifest does not parse, a field is not one this host reads, a permission is privileged and the mod is not marked system, the file `main` names is not in the bundle. Nothing of the mod has run.
2. **`launch`**. The bundle was taken, and its run does not come to run: its entry does not evaluate, does not give what a run needs, or does not start in time.
3. **`call`**. A request the system is handed is refused: through a mod's handle, on a connection, or through what the system gives a host.

The stage of a rule is the earliest stage that has what the rule needs. What the bundle alone decides refuses at `read`; what needs the entry's code refuses at `launch`; what needs a request refuses at `call`. Two implementations that run the same mods alike and refuse at different stages are not the same system: a refusal at `launch` where another refuses at `read` lists a mod as installed that can never run.

A refusal's **kind** is an upper-case name, `[A-Z][A-Z_]*`, fixed by the DECKIT that states the refusal. The stage and the kind are measured. A refusal's message is not, and no DECKIT states one.

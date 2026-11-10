# Acceptance criteria

A DECKIT moves from `draft` to `accepted` when every criterion below holds, and a review says which hold and which do not. Each criterion is a yes or a no with evidence beside it: a DECKIT sentence, a case, or a line a runner printed. A criterion nobody checked is a no. Where `spec-series lint` checks a criterion, its passing is the evidence.

The same criteria judge a change to accepted DECKITs (`change` mode) and the live set (`series` mode). There a no is a finding against what is already accepted.

## A. It is its area's to do

A no that shows the work is not this area's rejects the DECKIT, whatever else holds: the work belongs to a mod, a host, or another layer. A no the text answers in place, a Motivation not yet written or a general rule not yet stated where the DECKIT already does the work, is revised like any other.

- **A1. A mod or a host could not do it with the live set.** For each rule the DECKIT adds, its Motivation names what a mod or a host could not do with the live set alone, or what two implementations would answer differently without it, with a concrete bundle, input or call. A rule for what a mod can already build from what exists (a list it keeps in its own storage, a check it makes before it calls) fails.
- **A2. It lands in its layer.** A rule that holds without knowing what anything means is mechanism, and is the system's. What a permission grants, or what a standard interface means, is policy, and is written as such, in the DECKIT of the layer that defines it. A choice one mod can make for itself is that mod's, and is in no DECKIT but that mod's. For a shipped mod's DECKIT, every behaviour it states is that mod's own: one that a layer under it does for every mod (the shell's list rows, the system's refusal of a call) is stated by that layer and linked to, and one that every mod of its kind would need belongs to a layer, not to the mod.
- **A3. One general rule.** One rule covers the feature. A rule that adds a branch for one mod, one shape or one host, where a general rule would cover it, fails until the general rule is found.
- **A4. No rule tells who asked.** No rule's answer depends on who sent an input: a person or a program, a key pressed or a call made, one mod or another by its name. Where one sender may do what another may not, that is a permission, and the DECKIT says which.

## B. What it says is right

- **B0. It has the template's shape.** Every section of `spec/TEMPLATE.md`, in its order, its Status and Area lines, and every rule under Rules.
- **B1. Every answer is decided.** No bundle, input or call exists for which two conforming implementations could answer differently: an order, a spelling, a version compared, a winner between two writes, a stage, a kind. A reviewer who finds one shows it and the two answers.
- **B2. It agrees with the live set.** No sentence contradicts a live DECKIT, and no rule is stated in two places. Every link resolves, and the DECKIT it reaches says what the linking sentence claims. A DECKIT states its rules in terms of its own area and the areas before it, never of one after it.
- **B3. A bundle says each thing one way.** The DECKIT adds no second spelling, field or call for something that already has one.
- **B4. Each refusal has its stage and its kind, and the stage is the earliest that has what it needs.** The bundle alone gives `read`, the entry's code gives `launch`, a request gives `call`.
- **B5. The words are standard and single.** The field's term (bundle, manifest, launch, lifecycle, sandbox, IPC, credential), one sense per word across the specification. No other operating system named. No history, and no rule hidden in a **Note.**
- **B6. Another implementation could follow it.** Someone implementing Deckit in another host language, or on the web, could implement it from the text alone, without knowing Swift, Node or Electron.
- **B7. A form is given whole and stated as what it is.** Every field, name, text, call and thing shown the DECKIT adds or touches is a table, a grammar, or a signature with its answer and its refusal kinds, not prose alone. No rule is phrased against the input that raised it ("an id holds no capital") where the form it belongs to can be stated instead.
- **B8. It takes the operating systems' policy.** Where operating systems settle a question alike (how often a failed service starts again, how long a launch may take, what a failed start reports), the DECKIT takes that answer and states it in its own terms. A rule that departs from it says why in Alternatives considered.

## C. The cases are enough

- **C1. Every rule sentence is held by a case.** Each refusal has a case at its stage and kind. Each answer has a case that reads it. A sentence no case can hold says why, in a **Note.**
- **C2. Each case breaks one rule.** A refusing case is refused by the rule it names, checked by running it rather than by reading its name: every other part of its bundles and its steps is one the system takes.
- **C3. The edges are held.** Where a rule draws a line, there is a case just inside it and a case just outside it.
- **C4. It is held against what it meets.** For each accepted DECKIT the feature reaches, there is a case where the two meet (for a permission: a bundle that asks for it, a system mod, a call it guards, a host that does not define it).
- **C5. The implementation passes them.** Every case is in the case format of DECKIT-1, and passes on the implementation pinned at this commit, run by a runner that reaches inside nothing. Accepted means implemented: a DECKIT is accepted once the implementation is built against it and its cases pass.

## D. The series stays straight

- **D1. What it changes is made and classed.** Every accepted DECKIT whose text must change is changed in the diff under review: each place `spec-series impact` prints that restates or relies on what changes, and each link `spec-series lint --as` prints. A change made in place is a supplement, and a DECKIT whose decision moves is superseded. A supplement is shown by running the whole suite with the change and seeing no existing answer move.
- **D2. Supersession is whole.** A superseding DECKIT restates everything it keeps. `Supersedes` names exactly the DECKITs it replaces, and no live DECKIT links to a superseded one.

## E. Nothing is left open

- **E1.** No critical or major finding is open.
- **E2.** Nothing in the DECKIT is marked **Open.**
- **E3.** Every question it raised for the owner has an answer, and the answer is in the text.

## Verdict

- **accept**: every criterion holds.
- **revise**: A holds, or each no in A is one the text answers in place, and something else does not. The review lists each no with what would turn it into a yes.
- **reject**: a no in A shows the work is not this area's. The review says where the work belongs instead.

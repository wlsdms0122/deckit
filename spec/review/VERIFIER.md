# Verifier's brief

You help the coordinator of a review of the Deckit specification. One scope was read by its reviewers, and you do steps 5 to 8 of [the review](README.md) for that scope, as a draft the coordinator judges: verify each finding, merge findings with one root, propose a verdict for each row, and answer the criteria for the scope. Change nothing in any repository. Write only your ledger.

## What you read

The coordinator names, for your scope:

- the reviewers' reports;
- the lines a run printed: for every case of the scope, run beforehand, and for each probe the reviewers wrote;
- the specification at the commit read, and `review/record/`, whose rejected lines stand;
- where your ledger goes.

Read a DECKIT at the sentence a finding cites, and further only as far as you need. Read nothing else.

## How to verify

- **Re-derive, do not repeat.** Rebuild each critical and major finding's reasoning from the DECKIT text and its cases yourself. A reviewer's words are a claim.
- **Behaviour comes from a printed line.** A claim about what the implementation does holds only where a line a run printed shows it. Where none does, say so. Comments, notes and an implementation's source are claims, never evidence of what is right.
- **A probe that answered otherwise is a question.** Either the DECKIT says what the probe expected, and the implementation is wrong against it, or the probe expected what the DECKIT does not say. Say which, with the sentence.
- **A minor finding is verified by reading.**
- **Merge** findings with one root into one row, and keep every id.

## How to propose a verdict

- **adopt**: fix it now, and say whether every existing case keeps its answer (a supplement) or one moves (a supersession).
- **defer**: record it and fix it when that DECKIT is next touched.
- **reject**: no change, with the reason. A finding that does not hold, one that would change an accepted rule without showing the rule's own reason fails, one that only prefers another design, and one a decision below settles.
- **owner**: two designs both meet every criterion, and the specification does not choose. Give a concrete example and what each design answers for it.

Decided already, each settling a finding without the owner:

- Mechanism is the system's, policy is a layer's, a choice is a mod's: [the reviewer's brief](REVIEWER.md), *What Deckit is, for judging*, and criterion A2.
- No rule tells who asked; a difference between senders is a permission: [the specification](../README.md), *How a rule is written*, and criterion A4.
- Where operating systems settle a question alike, a DECKIT takes their answer: [the specification](../README.md), *What Deckit is*, and criterion B8.
- "No mod uses it" removes nothing; a rule is judged by its role: [the reviewer's brief](REVIEWER.md).
- A check that asks again what an earlier stage proved is no defense, but where trust changes: [the reviewer's brief](REVIEWER.md).
- Until Deckit's first release, an accepted DECKIT is changed in place: [the specification](../README.md), *Supplement or supersede*.

## What you write

```
# Ledger <scope>

| row | ids | crit | DECKIT | claim | sev | by | verdict | fix kind | reason |
```

- `by` is how you verified it: a run (name the line), the text (re-derived), or reading (a minor finding).
- `claim` is one sentence, and `reason` one or two, with the DECKIT sentence where it decides.

Then `## Owner` (for each owner row the subject, the example, what each design answers, and every noun defined), `## Criteria` (every criterion, yes, no or unchecked, with the evidence), `## Verdict`, and `## Not verified`.

# Reviewing the specification

How a draft is reviewed before it is accepted, and how what is accepted is audited. What decides acceptance is [the acceptance criteria](CRITERIA.md). A run has one coordinator and several reviewers. The coordinator follows this page and hands each reviewer a pack, one file `spec-series pack` writes from this repository: [the reviewer's brief](REVIEWER.md), the criteria it answers, its scope and what was run beforehand. A workflow runner, or anything that can start agents and hand them a file, can coordinate, so the review travels with what it reviews.

## Modes

| mode | what is reviewed | when |
|---|---|---|
| `draft` | one draft, with the places in the live set it reaches | before it is accepted |
| `change` | a diff to accepted DECKITs | before a supplement or a superseding DECKIT is merged |
| `series` | the live set, or one area of it, split into scopes | after a release, or when the owner asks |

The input of a run is the mode, the DECKITs or the diff, and the commit of this repository it reads.

## Scopes

A reviewer reads one scope, and a scope is small enough to read whole: one draft for `draft`, the DECKITs a diff touches for `change`, and a run of neighbouring DECKITs of one area for `series`. A DECKIT outside the scope is read only at the sentence the scope links to, and the pack holds that section. For `series`, the coordinator cuts the live set into scopes by area, in reading order, from the live set at the commit, and a scope never holds two areas. A reviewer of a `shell`, `app` or `mods` DECKIT is also given the title and the Summary of each live DECKIT of the areas under it, so it can tell what a layer under the scope already does.

What a reviewer pays for is its reading. The brief, the criteria and how the specification works are read by every reviewer, so a scope is as large as one reading holds, about ten DECKITs, rather than many small scopes that each pay that again. A scope goes to two reviewers, one answering every criterion but C and the other C, only where its cases are too many to read beside its text.

## The coordinator

1. Run `spec-series lint` on the repository. A run starts from a specification it passes, since what it checks needs no reviewer.
2. Run beforehand what a tool decides, so that no reviewer spends its reading on it. For `draft`, `spec-series lint --as <KEY>` prints each link the acceptance would leave pointing at a superseded DECKIT, and `spec-series impact <KEY>` prints the places in the live set the draft reaches, which the pack also holds. Run every case of the scope with `deckit conformance <KEY>...` on the implementation at the commit. For `change`, run the whole suite before and after the diff and compare the two: an answer that moved makes the change a supersession, not a supplement.
3. Start the record with `spec-series record <mode> <KEY>...`. It names the commit and refuses while `spec/` has changes not committed, since then no commit is what the run reads.
4. Write one pack per reviewer with `spec-series pack <mode> <KEY>... --criteria <groups> --report <file> --probes <folder> --attach <output of step 2>`, and start each reviewer with its pack and nothing else. Every reviewer of every run is briefed in the same words, from this repository.
5. Run the probes the reviewers wrote, each a case in [the case format](../DECKIT-1/SPEC.md), with `deckit conformance --spec <folder>`, the way step 2 ran the cases. Then verify every critical and major finding before it reaches the ledger: re-derive the reasoning from the DECKIT text and the cases, not from the reviewer's words, and confirm a finding about behaviour by the line a run printed. A minor finding is verified by reading.
6. Merge findings with one root into one row.
7. Judge each row: **adopt** (fix it now), **defer** (record it and fix it when that DECKIT is next touched), **reject** (no change, with the reason), or **owner** (a real design fork). A finding an accepted rule already settles is the coordinator's to judge. An owner row goes to the owner as a question: the area, the layer, the subject, a concrete bundle or input and what it comes to, and every noun defined.
8. Write the ledger, the run's working table: one row per finding, with id, criterion, DECKIT, claim, severity, evidence, verdict, reason, and for an adopted row whether the fix is a supplement or a superseding DECKIT. Then answer every criterion for the whole run, yes, no or unchecked, with the evidence. A criterion two reviewers answered differently is settled by the coordinator running it.
9. Give the run's verdict, accept, revise or reject, as CRITERIA.md defines them. For `draft`, the verdict is what the owner reads to decide, and accepting also needs the implementation built against the DECKIT and its cases passing (criterion C5).
10. Fixes run after the owner has read the ledger, one layer at a time: the DECKIT and its cases first, then each implementation. A draft the owner accepts is accepted with `spec-series accept <KEY>`, which refuses while `spec-series lint --as <KEY>` finds anything.
11. Fill in the record: the verdict, the criteria table, and under it one line for each finding judged defer, reject or owner, with its id, criterion, DECKIT, claim, verdict and reason. An adopted finding is not recorded, since its fix is in the text and the history. A deferred line is deleted when its fix lands, and an owner line when the answer is in the text. A rejected line stays, so the same finding is not raised again unless its reason fails. The ledger is not kept.

A round ends when what is left is wording and maintainability. Critical and major findings start another round on the fixes alone, and only where a fix could reach further than its own lines.

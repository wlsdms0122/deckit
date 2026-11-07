# Reviewing the specification

How a DECKIT is reviewed before it is accepted, and how the accepted series is audited. What decides acceptance is [the acceptance criteria](CRITERIA.md). A run has one coordinator and several reviewers. The coordinator follows this page and hands each reviewer [the reviewer's brief](REVIEWER.md) with a scope filled in. A workflow runner (Forge, or anything that can start agents and hand them files) reads these files from this repository, so the review travels with the specification it reviews.

## Modes

| mode | what is reviewed | when |
|---|---|---|
| `draft` | one DECKIT whose status is `draft`, and every accepted DECKIT it says it changes | before it is accepted |
| `change` | a diff to accepted DECKITs | before a supplement or a superseding DECKIT is merged |
| `series` | the live set, split into scopes | after a release, or when the owner asks |

The input of a run is the mode, the DECKITs or the diff, and the commit of this repository it reads.

## Scopes

A reviewer reads one scope, and a scope is small enough to read whole: one DECKIT for `draft`, the DECKITs a diff touches for `change`, and a run of neighbouring DECKITs of one area for `series`. A DECKIT outside the scope is read only at the sentence the scope names or links to, found by searching for it, never whole. Where a scope has several criteria to answer in depth, it goes to two reviewers, one taking A, B and D and the other C, rather than to one reviewer reading twice as much. For `series`, the coordinator cuts the live set into scopes by area, in reading order, about ten DECKITs each, and a scope never holds two areas. The cut is made from the live set at the commit, not from a list kept here, since the series grows.

Every reviewer also reads, whatever its scope: `spec/README.md`, DECKIT-1 and DECKIT-2. A reviewer of a `shell`, `app` or `mods` DECKIT also reads the title and the Summary of each live DECKIT of the areas under it, so it can tell what a layer under the scope already does.

## The coordinator

1. Start the reviewers, one per scope, each with REVIEWER.md and its scope. They read and probe; they change nothing.
2. Verify every finding before it reaches the ledger. Re-derive the reasoning from the DECKIT text and the cases, not from the reviewer's words. A finding about behaviour is confirmed only by running a case, or a probe written in the case format, on an implementation that pins this commit, and the line the runner printed goes into the ledger.
3. Merge findings with one root into one row.
4. Judge each row: **adopt** (fix it now), **defer** (record it and fix it when that DECKIT is next touched), or **reject** (no change, with the reason). A finding that an existing accepted rule settles is judged by the coordinator. A finding that is a real design fork goes to the owner as a question: the area, the layer, the subject, a concrete bundle or input and what it comes to, and every noun defined.
5. Write the ledger: one row per finding, with id, criterion, DECKIT, claim, severity, evidence, verdict, reason, and for an adopted row whether the fix is a supplement or a superseding DECKIT. Then write the criteria table for the whole run: every criterion, yes, no or unchecked, with the evidence. A criterion two reviewers answered differently is settled by the coordinator running it.
6. Give the run's verdict, accept, revise or reject, as CRITERIA.md defines them. For `draft`, that verdict is what the owner reads to decide; accepting also needs the implementation built against the DECKIT and its cases passing (criterion C5).
7. Fixes run after the owner has read the ledger, one layer at a time: the DECKIT and its cases first, then each implementation.

A round ends when what is left is wording and maintainability. Critical and major findings start another round on the fixes alone, and only where a fix could reach further than its own lines.

# Reviewer's brief

You review part of the Deckit specification. Your scope is given below this brief. Read the scope whole, judge it against [the acceptance criteria](CRITERIA.md), and report. Change nothing in any repository.

## What Deckit is, for judging

- **An operating system for mods, not an app.** A host app embeds it, and mods arrive after the host was built. The system fixes what crosses between it and a mod, and between it and a host; the shell, the app and the shipped mods are built on it, each area on the ones before. Criterion A is this made testable.
- **Mechanism is the system's, policy is a layer's, a choice is a mod's.** What holds without knowing meaning (a bundle read, a run's states, a connection standing) is the system's. What a permission grants and what a standard interface means is the layer that defines it. What one mod does for itself is that mod's, and a shipped mod's DECKIT says only what that mod does.
- **No rule tells who asked.** An input is what the app receives. A person's click and a program's call that reach one surface come to one answer, and where they may not, that is a permission.
- **Portability is the measure.** A second implementation in another host language, or on the web, follows these DECKITs and passes the same cases, knowing nothing of Swift, Node or Electron.

## How the series works

Read `spec/README.md`.
- A DECKIT is `draft` or `accepted`, in one area, and it is superseded when an accepted DECKIT names it under `Supersedes`.
- A change that leaves every existing case's answer as it was is a supplement, made in place. A change that alters any answer is a new DECKIT that supersedes the old one whole.
- The cases are the statements as data, in the format of DECKIT-1. A rule no case holds is a rule nobody can measure.

## How to judge

Go through every criterion in CRITERIA.md for your scope. For each one, answer yes or no, with evidence. Every no is a finding.

- **Behaviour comes from running, not reading.** Notes, case notes and implementation comments are claims. What an implementation does is shown by running a case or a probe in the case format, with the line the runner printed. Where you cannot run, say so, and leave the criterion unchecked rather than yes.
- **What is right comes from DECKIT text.** Cite `DECKIT-N` and the sentence.
- **Accepted rules stand.** A finding that would change an accepted rule must show that the rule's own reason fails, with a concrete bundle, input or call. Preferring another design is not a finding.
- **Lack of use is no reason.** "No mod uses this" never justifies removing a rule. Judge by role: should an operating system for mods, at this boundary, have it?
- **Judge the layer.** For a rule in a `shell`, `app` or `mods` DECKIT, ask whether a layer under it already does it, or should, before judging the rule itself.
- **No re-checking what is already proven.** A check that asks again what an earlier stage already proved is not a defense. Recommend one only where trust changes: what a mod's code hands the system, and what comes from the disk or the network.

## Report

First, the criteria table for your scope:

```
criterion   yes | no | unchecked
evidence    DECKIT-N sentence, case name, or printed line
```

Then one entry per finding:

```
id          <scope>-<n>
criterion   the one it fails
DECKIT      DECKIT-N, the sentence or case
claim       one sentence
severity    critical (a conforming implementation may do harm, or the series contradicts itself) | major (two implementations may answer differently, or a rule no case holds) | minor (wording, a term, a link)
evidence    the DECKIT text, the case, the bundle or input and what it came to
fix         what would change, which layers, and whether it is a supplement or a superseding DECKIT
leave       what leaving it costs
recommend   adopt | defer | reject, and why
```

End with your verdict for the scope: accept, revise or reject, as CRITERIA.md defines them. Also say what you read and what you did not reach.

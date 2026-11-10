# DECKIT-N: Title

Status: draft
Area: system
Supersedes: DECKIT-a, DECKIT-b
Superseded-By: DECKIT-c

<!--
The shape of a DECKIT's SPEC.md. Start one with `spec-series draft`, which takes the next number and copies this file.

- The heading, the Status line and the Area line are required. Area is one of `system`, `shell`, `app` and `mods`. Supersedes is written only by a DECKIT that replaces others whole, and it may name DECKITs of any series. Superseded-By is written into a replaced DECKIT by `spec-series accept`, never by hand.
- The lines under the heading are the fields a DECKIT's head may write, in this order. Add a field here, and a DECKIT writes it when it applies.
- Every section below is written in every DECKIT, in this order. A section with nothing to say keeps its heading and is left empty. Rename, add or remove one here, and every DECKIT is held to the new list.
- Rules is the only normative section. Everything else explains it and binds nothing.
-->

## Summary

One paragraph: what this DECKIT adds to the specification or decides about it, for a mod author or an implementer reading it first.

## Motivation

Why this is its area's to do, and not a mod's, a host's or a layer's under it. Name what a mod or a host could not do with the live set alone, or what two implementations would answer differently without it, and show it with a concrete bundle, input or call.

## Rules

The normative text. Every sentence here is one a conforming implementation follows, and each is held by a case under `conformance/`. Subsections (`###`) by construct, as the rules need them. A `**Note.**` paragraph may stand beside the rule it is about, and binds nothing. A form (a field, a name, a text, a call, what is shown) is given whole as a table, a grammar or a signature with its answer and its refusal kinds, and each rule says what a thing is, never only the one input that raised it. Each refusal names its stage and its kind.

## Interactions

Where these rules meet what the live set already has: the bundle, permissions, the lifecycle, connections, events, storage, the handle, the shell. A rule another DECKIT states is linked to, not restated.

## Alternatives considered

The designs not taken, each with the rule or principle that set it aside.

## Notes

`**Note.**` paragraphs about the DECKIT as a whole: what it costs an implementation, and what no case can hold.

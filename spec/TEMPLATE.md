# DECKIT-N: Title

Status: draft
Area: system
Supersedes: DECKIT-a, DECKIT-b

<!--
The shape of a DECKIT's SPEC.md. Copy this file to spec/DECKIT-N/SPEC.md and replace each part.

- The heading, the Status line and the Area line are required. Area is one of `system`, `shell`, `app` and `mods`. Supersedes is written only by a DECKIT that replaces others whole.
- Every section below is written in every DECKIT, in this order. A section with nothing to say keeps its heading and is left empty.
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

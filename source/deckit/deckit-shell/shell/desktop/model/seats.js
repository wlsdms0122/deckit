// MARK: - Property
// A chip of the seats at the desktop's bottom right, px: how wide and high one of a seat is, how far one is from the
// next and from the desktop's edges, how wide one that asks is, and how wide each of its two answers is, `inset` from
// its edges and from one another.
const CHIP = Object.freeze({ width: 148, height: 28, gap: 6, margin: 12, ask: 276, answer: 56, inset: 4 });

// MARK: - Initializer
// MARK: - Public
// The chips at the bottom right of a desktop of the size `stage`, from the bottom up: one for each of `seats`, the
// ids of the seats that have one, then one for each of `asks`, the ids of the users that ask to sit. Each is
// `{ kind, id, rect }`, `kind` 'seat' or 'ask', and one that asks has `allow` and `deny`, the rects of its two answers.
function chipsOf(stage, seats, asks) {
    const rows = [...seats.map((id) => ({ kind: 'seat', id })), ...asks.map((id) => ({ kind: 'ask', id }))];
    return rows.map((row, at) => {
        const width = row.kind === 'ask' ? CHIP.ask : CHIP.width;
        const rect = {
            x: stage.width - CHIP.margin - width,
            y: stage.height - CHIP.margin - (at + 1) * CHIP.height - at * CHIP.gap,
            width,
            height: CHIP.height,
        };
        if (row.kind === 'seat') return { ...row, rect };
        const answer = (nth) => ({
            x: rect.x + rect.width - nth * (CHIP.answer + CHIP.inset),
            y: rect.y + CHIP.inset,
            width: CHIP.answer,
            height: CHIP.height - 2 * CHIP.inset,
        });
        return { ...row, rect, allow: answer(1), deny: answer(2) };
    });
}

// What of `chips` a point is on: `{ part, id }`, 'chip' for a seat's chip, 'allow' or 'deny' for an answer of one that
// asks; null for any other point, the rest of a chip that asks too.
function partAt(chips, point) {
    const holds = ({ x, y, width, height }) =>
        point.x >= x && point.y >= y && point.x < x + width && point.y < y + height;
    for (const { kind, id, rect, allow, deny } of chips) {
        if (kind === 'seat' && holds(rect)) return { part: 'chip', id };
        if (kind === 'ask' && holds(allow)) return { part: 'allow', id };
        if (kind === 'ask' && holds(deny)) return { part: 'deny', id };
    }
    return null;
}

// MARK: - Private

export { CHIP, chipsOf, partAt };

// MARK: - Property
const SEARCH_LIMIT = 60;
const RECENT_SHOWN = 8;
const NUMBERED = 9;

// MARK: - Initializer
// MARK: - Public
// What the switcher shows and what its keys do, apart from how it is drawn. `items` are what the list holds, `now`
// the rows of the Now strip; an item with `run` can be chosen, one with `submenu` opens a list to search inside it.
// `onQuery(raw, submenuId)` asks for answers, which come back through `setResolved`; `onPick(item)` runs a choice,
// and `say(text, { alert })` puts what came of it under the list until something is typed. `state()` is what to
// draw; `onChange` hears that it changed. `util` is deck's, whose matching ranks what is typed.
function make({ util, placeholder, items, now, onQuery, onPick }) {
    const { TIER, matchFields } = util;
    let nowItems = now.map((item) => ({ ...item, lead: true }));
    let shown = [];
    let headings = new Map(); // row index -> the headings over it, outermost first
    let lit = new Map(); // item -> the letters of its label the query matched
    let numbers = []; // the row indexes ⌘1 to ⌘9 take
    let active = -1;
    let asked = '';
    // Once the person has typed or moved, a late Now answer no longer redraws the list.
    let touched = false;
    // A row was aimed at since the query changed, so a late answer does not move the choice.
    let aimed = false;
    const answers = new Map(); // submenu id and query -> the entries answered
    // A submenu opened to search inside it: { id, label, icon, placeholder, ranked }.
    let inside = null;
    // While a searching submenu has not answered what is typed, its last answer stays up and the list is
    // provisional: a row aimed at is only remembered (`aimedId`), and Enter or a number waits for the answer
    // (`held`).
    let lastAnswer = [];
    let aimedId = null;
    let held = null;
    let said = null; // { text, alert }
    const listeners = new Set();

    browse();
    active = firstActionable();

    function state() {
        const seen = new Map();
        const rows = shown.map((item, index) => {
            const count = (seen.get(item.id) || 0) + 1;
            seen.set(item.id, count);
            return {
                key: count > 1 ? `${item.id}#${count}` : String(item.id),
                item,
                headings: headings.get(index) || [],
                lit: lit.get(item) || [],
                number: numbers.indexOf(index) + 1,
                actionable: isActionable(item),
                // Laid out, a heading says whose a row is; ranked, the row says it itself.
                hint: item.hint || (headings.size || item.lead ? '' : ownerOf(item)),
            };
        });
        return {
            placeholder: inside ? inside.placeholder : placeholder,
            submenu: inside && { id: inside.id, label: inside.label, icon: inside.icon },
            query: asked,
            rows,
            active,
            said,
        };
    }

    function type(raw) {
        touched = true;
        aimed = false;
        asked = raw.trim();
        said = null;
        held = null;
        aimedId = null;
        // A ranked submenu already gave its whole list; only a search is asked again.
        if (!inside?.ranked) onQuery?.(asked, inside?.id || null);
        apply();
    }

    // Steps over the rows that cannot be chosen.
    function move(by) {
        touched = true;
        for (let offset = 1; offset <= shown.length; offset++) {
            const index = (((active + by * offset) % shown.length) + shown.length) % shown.length;
            if (!isActionable(shown[index])) continue;
            active = index;
            aim();
            break;
        }
        changed();
    }

    function point(index) {
        if (index === active || !isActionable(shown[index])) return;
        touched = true;
        active = index;
        aim();
        changed();
    }

    // Enter: the active row, or once the provisional list has its answer.
    function confirm() {
        chooseOrHold(null);
    }

    function takeNumber(number) {
        chooseOrHold(number);
    }

    function choose(index) {
        const item = shown[index];
        if (!isActionable(item)) return;
        if (!item.submenu) return onPick?.(item);
        // Through onPick too, so opening a submenu counts as a use.
        onPick?.(item);
        enter(item);
    }

    // Leaves the submenu searched in, if one is open. Whether it did.
    function back() {
        if (!inside) return false;
        inside = null;
        reset();
        apply();
        return true;
    }

    function setNow(rows) {
        if (touched) return;
        nowItems = rows.map((item) => ({ ...item, lead: true }));
        browse();
        active = firstActionable();
        changed();
    }

    // Drawn only for the query it answers and only while nothing is aimed at: answers can go on top, and
    // folding them in would move the choice out from under Enter.
    function setResolved(raw, entries, submenuId) {
        answers.set(answerKey(submenuId, raw), entries);
        if (aimed || (submenuId || null) !== (inside?.id || null)) return;
        // A ranked submenu's answer is for the empty query, ranked for whatever is typed now.
        if (inside?.ranked ? raw !== '' : raw !== asked) return;
        apply();
        if (aimedId != null) {
            const index = shown.findIndex((item) => item.id === aimedId && isActionable(item));
            if (index >= 0) {
                active = index;
                aimed = true;
                changed();
            }
            // What Enter was held for is not in the answer: nothing to run. A number picks by place, so it
            // still runs.
            else if (held?.number == null) held = null;
            aimedId = null;
        }
        if (held && held.raw === raw) {
            const { number } = held;
            held = null;
            chooseOrHold(number);
        }
    }

    function say(text, { alert = false } = {}) {
        said = { text, alert };
        changed();
    }

    function onChange(listener) {
        listeners.add(listener);
    }

    // MARK: - Private
    function changed() {
        for (const listener of listeners) listener();
    }

    function enter(item) {
        inside = {
            id: item.id,
            label: item.label,
            icon: item.submenu.icon || '',
            placeholder: item.submenu.placeholder || 'Search…',
            ranked: !!item.submenu.ranked,
        };
        reset();
        touched = true;
        onQuery?.('', inside.id); // what the submenu shows before anything is typed
        apply();
    }

    function reset() {
        lastAnswer = [];
        held = null;
        aimedId = null;
        said = null;
        asked = '';
        aimed = false;
    }

    function apply() {
        // Resolvers get the query as typed: lowercasing is for ranking and would break an id in a URL.
        const query = asked.toLowerCase();
        if (inside) {
            // A searching submenu's list is its answer to the raw text; a ranked submenu gave one list as it opened,
            // ranked here.
            const key = answerKey(inside.id, inside.ranked ? '' : asked);
            if (answers.has(key)) lastAnswer = answers.get(key);
            lit = new Map();
            setList(inside.ranked && query ? rank(lastAnswer, query) : lastAnswer);
        } else if (!query) {
            browse();
        } else {
            // Answers for this query go on top unranked (a pasted URL is in no list to rank), and `fallback`
            // ones (somewhere else to look) go last so they never stand over every command. The Now strip is
            // left out under a query.
            const offered = answers.get(answerKey(null, asked)) || [];
            setList(
                offered
                    .filter((item) => !item.fallback)
                    .concat(
                        rank(items, query),
                        offered.filter((item) => item.fallback)
                    )
            );
        }
        active = firstActionable();
        changed();
    }

    // On a provisional list the aimed row is only remembered; otherwise a later answer does not move it.
    function aim() {
        if (isProvisional()) aimedId = shown[active]?.id ?? null;
        else aimed = true;
    }

    function chooseOrHold(number) {
        if (isProvisional()) {
            held = { raw: asked, number };
            return;
        }
        if (number == null) choose(active);
        else if (numbers[number - 1] != null) choose(numbers[number - 1]);
    }

    function isProvisional() {
        return !!inside && !inside.ranked && !answers.has(answerKey(inside.id, asked));
    }

    function firstActionable() {
        return shown.findIndex(isActionable);
    }

    function browse() {
        lit = new Map();
        const { list, at } = layout();
        setList(list, at);
    }

    function setList(list, at = null) {
        shown = at ? list : list.slice(0, SEARCH_LIMIT);
        headings = at || new Map();
        numbers = shown
            .map((item, index) => (isActionable(item) ? index : -1))
            .filter((index) => index >= 0)
            .slice(0, NUMBERED);
    }

    // Now, then Recent, then every mod's section with its groups.
    function layout() {
        const list = [];
        const at = new Map();
        const heading = (entry) => {
            if (!at.has(list.length)) at.set(list.length, []);
            at.get(list.length).push(entry);
        };
        if (nowItems.length) {
            heading({ kind: 'block', label: 'Now' });
            list.push(...nowItems);
        }
        const recent = items
            .filter((item) => item.used > 0)
            .sort((left, right) => right.used - left.used)
            .slice(0, RECENT_SHOWN);
        if (recent.length) {
            heading({ kind: 'block', label: 'Recent' });
            list.push(...recent);
        }
        const sections = new Map();
        for (const item of items) {
            const mod = item.mod?.id || '';
            if (!sections.has(mod)) sections.set(mod, { mod: item.mod, groups: new Map([['', []]]) });
            const { groups } = sections.get(mod);
            if (!groups.has(item.group || '')) groups.set(item.group || '', []);
            groups.get(item.group || '').push(item);
        }
        for (const { mod, groups } of sections.values()) {
            heading({ kind: 'section', label: mod?.name || '', icon: mod?.icon || '' });
            for (const [group, members] of groups) {
                if (!members.length) continue;
                if (group) heading({ kind: 'group', label: group });
                list.push(...members);
            }
        }
        return { list, at };
    }

    // Sets `lit` too: the letters each row draws heavier.
    function rank(list, query) {
        const ranked = list
            .map((item) => ({ item, found: matchFields(fieldsOf(item, TIER), query) }))
            .filter((candidate) => candidate.found)
            .sort((left, right) => byRelevance(left, right, TIER));
        lit = new Map(ranked.map((candidate) => [candidate.item, candidate.found.at]));
        return ranked.map((candidate) => candidate.item);
    }

    return { state, type, move, point, confirm, takeNumber, choose, back, setNow, setResolved, say, onChange };
}

// MARK: - Private
function answerKey(submenuId, raw) {
    return (submenuId || '') + '\0' + raw;
}

function isActionable(item) {
    return typeof item?.run === 'function';
}

function ownerOf(item) {
    return [item.mod?.name, item.group].filter(Boolean).join(' › ');
}

// Whose it is and its group may fill a word but never beat a match found in a name.
function fieldsOf(item, TIER) {
    return [
        { text: item.label, name: true },
        { text: [item.mod?.name, item.group].filter(Boolean).join(' '), weight: 0.9, cap: TIER.WORD },
        { text: item.keywords || '', weight: 0.8, cap: TIER.INSIDE },
    ];
}

// Tier first, so the order is predictable. Use counts only when the query is at least a word of the name (its
// tier before any cap), so a used entry whose letters are merely scattered does not jump ahead. Then the score,
// then the shorter label.
function byRelevance(left, right, TIER) {
    return (
        right.found.tier - left.found.tier ||
        (Math.min(left.found.raw, right.found.raw) >= TIER.WORD ? (right.item.used || 0) - (left.item.used || 0) : 0) ||
        right.found.score - left.found.score ||
        left.item.label.length - right.item.label.length
    );
}

module.exports = { make };

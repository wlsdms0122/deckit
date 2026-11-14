const supervisorView = ({ shell, deckit, forge, picker }) => {
    const { ui } = shell;
    const store = deckit.storage.values;

    let session = picker.current();

    const forgeOf = (name) => ({
        call: (operation, args) => forge.call(operation, args, { session: name }),
        start: () => forge.start(name),
        stop: () => forge.stop(name),
        restart: () => forge.restart(name),
        log: (lines) => forge.log(lines, { session: name }),
    });
    const REFRESH_MS = 3000;

    const TONE = {
        ok: 'var(--deckit-ok)',
        warn: 'var(--deckit-warn)',
        alert: 'var(--deckit-alert)',
        idle: `color-mix(in srgb, var(--deckit-text) 45%, var(--deckit-background))`,
        // Not running, and not because it failed.
        off: 'var(--deckit-disabled)',
    };
    // A tone as text, where it is read.
    const INK = {
        ...TONE,
        ok: 'var(--deckit-ok-ink)',
        warn: 'var(--deckit-warn-ink)',
        alert: 'var(--deckit-alert-ink)',
    };

    const CALLS_FORGE = new Set(['runner']);

    const EMPTY = { daemon: null, services: [], authority: false, controls: {}, error: '', loading: true };
    let state = { ...EMPTY };
    let actionError = '',
        actionNote = '';
    let timer = null,
        visible = false;

    const bar = document.createElement('div');
    Object.assign(bar.style, { display: 'flex', flex: '1 1 auto', minWidth: '0', alignItems: 'center', gap: '10px' });

    const LOG_MIN = 90,
        LOG_DEFAULT = 240,
        LOG_KEY = 'log-height';
    // The table keeps the height of what it shows and the log gives way to it, down to its least; past that the table
    // scrolls.
    const body = document.createElement('div');
    Object.assign(body.style, {
        flex: '1 0 auto',
        maxHeight: `calc(100% - ${LOG_MIN}px)`,
        boxSizing: 'border-box',
        overflowY: 'auto',
        padding: '16px',
    });
    ui.edgeFade(body);

    const logPane = document.createElement('div');
    Object.assign(logPane.style, {
        flex: '0 1 auto',
        minHeight: LOG_MIN + 'px',
        display: 'flex',
        flexDirection: 'column',
        height: Math.max(LOG_MIN, store.get(LOG_KEY, LOG_DEFAULT)) + 'px',
    });

    const setLogHeight = (height) => {
        logPane.style.height = height + 'px';
    };

    const logHead = document.createElement('div');
    Object.assign(logHead.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: '0 0 auto',
        // 24 under what is above it, with the body's own 16.
        padding: '8px 16px',
        color: 'var(--deckit-muted)',
        font: 'var(--deckit-type-label)',
        cursor: 'row-resize',
    });
    const logTitle = document.createElement('span');
    logTitle.textContent = 'Daemon log';
    logHead.appendChild(logTitle);
    logHead.title = 'Drag to resize';

    ui.resizer(logHead, {
        axis: 'y',
        grow: -1,
        size: () => logPane.getBoundingClientRect().height,
        min: LOG_MIN,
        max: () => Math.max(LOG_MIN, pane.getBoundingClientRect().height - 100),
        onResize: setLogHeight,
        onCommit: (pixels) => {
            setLogHeight(pixels);
            store.set(LOG_KEY, Math.round(pixels));
        },
    });

    const logBody = document.createElement('div');
    Object.assign(logBody.style, {
        flex: '1 1 auto',
        minHeight: '0',
        overflow: 'auto',
        margin: '0 16px 16px',
        padding: '12px',
        borderRadius: 'var(--deckit-radius-medium)',
        background: 'var(--deckit-surface)',
        color: 'var(--deckit-text)',
    });
    ui.edgeFade(logBody);
    ui.selectable(logBody);

    // What went wrong in words that say what to do, with a retry and the system's own words under Details.
    // Drawn anew only when what it says changes, so a refresh does not read it out again or close its Details.
    const notice = ui.notice({});
    let told = '';
    notice.element.style.display = 'none';
    notice.element.style.marginBottom = '16px';
    // The system's words for forge not found, and what they mean to the person.
    const NOT_FOUND = /could not be run: .*ENOENT/;
    const NOT_FOUND_TEXT =
        'Forge is not installed, or not on the PATH this app sees. Set where it is in Settings, under Mod ' +
        'Settings, Forge command.';
    // Nothing to tell hides it.
    const tell = (text = '', { tone = '', raw = '', retry = false } = {}) => {
        notice.element.style.display = text ? '' : 'none';
        const said = [tone, text, raw, retry].join('\n');
        if (!text || said === told) return;
        told = said;
        notice.set({
            kind: tone === 'alert' ? 'failure' : 'warning',
            text,
            details: raw,
            action: retry ? { label: 'Try Again', run: () => load() } : null,
        });
    };

    const tree = document.createElement('div');
    // Rows in the shape of the table while the first answer is on its way.
    let skeleton = null;

    const rows = new Map();

    const empty = document.createElement('div');
    empty.textContent = 'This session runs no services. Add a [service] to its config to see it here.';
    Object.assign(empty.style, {
        display: 'none',
        padding: '10px 0 0 30px',
        color: 'var(--deckit-muted)',
        font: 'var(--deckit-type-body)',
    });

    logPane.append(logHead, logBody);
    body.append(notice.element, tree, empty);
    const pane = document.createElement('div');
    Object.assign(pane.style, { flex: '1 1 auto', minHeight: '0', display: 'flex', flexDirection: 'column' });
    pane.append(body, logPane);

    const dot = (tone) => {
        const span = document.createElement('span');
        Object.assign(span.style, {
            flex: '0 0 auto',
            width: '8px',
            height: '8px',
            borderRadius: 'var(--deckit-radius-round)',
            background: TONE[tone],
        });
        return span;
    };

    const chip = (label, tone) => {
        const span = document.createElement('span');
        span.textContent = label;
        Object.assign(span.style, {
            flex: '0 0 auto',
            padding: '1px 7px',
            borderRadius: 'var(--deckit-radius-round)',
            font: 'var(--deckit-type-caption)',
            color: INK[tone],
            border: `1px solid ${INK[tone]}`,
        });
        return span;
    };

    const button = (glyph, title, onClick, enabled = true) => {
        const made = ui.iconButton({ icon: ui.icon(glyph, { size: 15 }), title, onClick });
        made.setEnabled(enabled);
        return made.element;
    };

    const since = (iso) => {
        if (!iso) return '';
        const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };

    // The rows share the tree's columns, so a column is as wide as its widest cell: the name gives way first, and
    // the actions keep their place at the end at any width.
    const COLUMNS = '14px minmax(0, 1fr) auto auto auto auto';
    const CELL = { flex: '0 0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
    ui.addStyle('.bot-service-row:hover { background: var(--deckit-hover); }');
    Object.assign(tree.style, { display: 'grid', gridTemplateColumns: COLUMNS, columnGap: '12px' });

    const gridRow = (extra = {}) => {
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'grid',
            gridColumn: '1 / -1',
            gridTemplateColumns: 'subgrid',
            alignItems: 'center',
            padding: '0 8px',
            minHeight: '36px',
            borderRadius: 'var(--deckit-radius-control)',
            ...extra,
        });
        return row;
    };

    const headerRow = () => {
        const row = gridRow({ minHeight: '24px', borderBottom: 'var(--deckit-border)', borderRadius: '0' });
        ['', 'Name', 'State', 'PID', 'Uptime', ''].forEach((label) => {
            const heading = document.createElement('span');
            heading.textContent = label;
            Object.assign(heading.style, { ...CELL, color: 'var(--deckit-muted)', font: 'var(--deckit-type-label)' });
            row.appendChild(heading);
        });
        return row;
    };

    const cell = (text, style = {}) => {
        const span = document.createElement('span');
        span.textContent = text == null ? '' : String(text);
        if (span.textContent) span.title = span.textContent;
        Object.assign(span.style, { ...CELL, font: 'var(--deckit-type-body)', ...style });
        return span;
    };

    // A row whose state changed lights once: its tone is on its dot.
    const flash = (row) => {
        const wash = document.createElement('span');
        Object.assign(wash.style, {
            position: 'absolute',
            inset: '0',
            borderRadius: 'var(--deckit-radius-control)',
            pointerEvents: 'none',
            background: 'var(--deckit-selected)',
            opacity: '0',
        });
        row.appendChild(wash);
        const done = () => wash.remove();
        const play = ui.motion.swell(wash, { opacity: 0 }, { opacity: 1 }, { rise: 'enter', fall: 'exit' });
        play.finished.then(done, done);
    };

    const treeRow = (indent = false) => {
        const element = gridRow({ position: 'relative' });
        element.classList.add('bot-service-row');
        const muted = { color: 'var(--deckit-muted)', font: 'var(--deckit-type-small)' };

        const cells = ['name', 'state', 'pid', 'uptime'].map((_, index) =>
            cell(
                '',
                index === 0
                    ? { flex: '0 1 auto', minWidth: '0', font: (indent ? '400 ' : '600 ') + 'var(--deckit-type-body)' }
                    : index === 2
                      ? { ...muted, fontFamily: 'var(--deckit-mono)', fontVariantNumeric: 'tabular-nums' }
                      : muted
            )
        );

        const guide = document.createElement('span');
        Object.assign(guide.style, {
            position: 'relative',
            flex: '0 0 auto',
            alignSelf: 'stretch',
            width: indent ? '20px' : '0',
            display: indent ? 'block' : 'none',
        });
        const stem = document.createElement('span');
        Object.assign(stem.style, {
            position: 'absolute',
            left: '7px',
            top: '0',
            bottom: '0',
            borderLeft: 'var(--deckit-border)',
        });
        const elbow = document.createElement('span');
        Object.assign(elbow.style, {
            position: 'absolute',
            left: '7px',
            top: '50%',
            width: '9px',
            borderTop: 'var(--deckit-border)',
        });
        guide.append(stem, elbow);

        const nameCell = document.createElement('span');

        Object.assign(nameCell.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: '0',
            alignSelf: 'stretch',
        });
        // What is said of it follows its name.
        const chipCell = document.createElement('span');
        Object.assign(chipCell.style, { display: 'flex', flex: '0 0 auto', alignItems: 'center', gap: '4px' });
        nameCell.append(guide, cells[0], chipCell);

        const actionCell = document.createElement('span');
        Object.assign(actionCell.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
        });

        const marker = dot('idle');
        element.append(marker, nameCell, ...cells.slice(1), actionCell);

        let actionSignature = '';
        let lastSnapshot = '';
        const update = ({
            tone,
            name,
            state: stateText,
            pid,
            uptime,
            chips = [],
            actions = null,
            signature = '',
            last = false,
        }) => {
            const snapshot = [tone, stateText || '', pid || ''].join('|');
            if (lastSnapshot && snapshot !== lastSnapshot) flash(element);
            lastSnapshot = snapshot;

            stem.style.bottom = last ? '50%' : '0';
            marker.style.background = TONE[tone];
            cells[0].textContent = name;
            cells[1].textContent = stateText || '';
            cells[2].textContent = pid ? 'pid ' + pid : '';
            cells[3].textContent = uptime || '';
            for (const each of cells) each.title = each.textContent;

            chipCell.textContent = '';
            chips.forEach((made) => chipCell.appendChild(made));

            if (actions && signature !== actionSignature) {
                actionSignature = signature;
                actionCell.textContent = '';
                actions().forEach((action) => actionCell.appendChild(action));
            }
        };

        return { element, update };
    };

    const snapshot = async (entry) => {
        const { daemon, authority, controls } = entry;
        if (!daemon || !authority) return { daemon, authority, controls, services: [], error: '' };
        try {
            const answer = await forgeOf(entry.name).call('service.status');
            return { daemon, authority, controls, services: answer?.services || [], error: '' };
        } catch (error) {
            return {
                daemon,
                authority,
                controls,
                services: null,
                error: 'Could not read the services: ' + String(error?.message || error),
            };
        }
    };

    let generation = 0;
    const load = async () => {
        const mine = ++generation;
        const asked = session;
        let entry, next;
        try {
            entry = await forge.session(asked);
            next = { ...(await snapshot(entry)), loading: false };
        } catch (error) {
            entry = { name: asked, up: false, authority: false };
            next = { ...state, error: String(error?.message || error), loading: false };
        }
        // A skeleton that showed stays its least, so it does not flash.
        await skeleton?.settled();
        if (mine !== generation) return;
        picker.told(entry);
        state = next;
        render();
    };

    // Another session is shown: what was drawn for the last one goes.
    const setSession = (name) => {
        session = name;
        state = { ...EMPTY };
        actionError = actionNote = '';
        for (const row of rows.values()) row.element.remove();
        rows.clear();
        logBody.textContent = '';
        render();
        load();
        renderLog();
    };

    // What an action answers, `{ note, failure }`, is shown only while its session is.
    const act = async (action) => {
        actionError = actionNote = '';
        const target = session;
        let note = '',
            failure = '';
        try {
            note = (await action(forgeOf(target)))?.note || '';
        } catch (error) {
            failure = String(error?.message || error);
        }
        if (target !== session) return { note, failure };
        actionNote = note;
        actionError = failure;
        await load();
        return { note, failure };
    };

    const render = () => {
        const { daemon, authority, controls, loading } = state;
        const services = state.services || [];
        const error = actionError || state.error;
        const up = !!daemon;

        if (error && NOT_FOUND.test(error)) tell(NOT_FOUND_TEXT, { tone: 'alert', raw: error, retry: true });
        else if (error) tell(error, { tone: 'alert', retry: true });
        else if (actionNote) tell(actionNote, { tone: 'warn' });
        else if (up && !authority)
            tell(
                'Started elsewhere: forge hands its boot token only to the process that started it, ' +
                    'so the services it supervises cannot be read or run from here. Stop and Restart work; ' +
                    'restart it from here and its services can be run from here too.',
                { tone: 'warn' }
            );
        else tell();

        tree.style.display = loading ? 'none' : 'grid';
        if (loading && !skeleton) {
            skeleton = ui.loading.skeleton({ rows: 3, height: 36 });
            body.insertBefore(skeleton.element, tree);
        }
        empty.style.display = 'none';
        if (loading) return;
        skeleton?.element.remove();
        skeleton = null;

        if (!tree.firstChild) tree.appendChild(headerRow());

        const wanted = [{ key: 'forge', indent: false }];
        if (up && authority) for (const service of services) wanted.push({ key: service.name, indent: true });

        for (const key of [...rows.keys()]) {
            if (!wanted.some((want) => want.key === key)) {
                rows.get(key).element.remove();
                rows.delete(key);
            }
        }

        let previous = tree.firstChild;
        for (const { key, indent } of wanted) {
            let row = rows.get(key);
            if (!row) {
                row = treeRow(indent);
                rows.set(key, row);
            }
            if (previous.nextSibling !== row.element) tree.insertBefore(row.element, previous.nextSibling);
            previous = row.element;
        }

        rows.get('forge').update({
            tone: up ? 'ok' : error ? 'alert' : 'off',
            name: 'forge',
            state: up ? 'running' : 'stopped',
            pid: daemon?.pid,
            uptime: up ? since(daemon.started_at) : '',
            chips: up && !authority ? [chip('started elsewhere', 'warn')] : [],
            signature: `${up}|${authority}|${controls.stop}`,
            actions: () =>
                up
                    ? [
                          button(
                              'reload',
                              authority
                                  ? 'Restart forge: the services it supervises come with it'
                                  : 'Restart: launching it from here puts it under control from here',
                              () => act((forge) => forge.restart()),
                              controls.restart
                          ),
                          button(
                              'square',
                              'Stop forge: the services it supervises go down with it',
                              () => act((forge) => forge.stop()),
                              controls.stop
                          ),
                      ]
                    : [button('play', 'Start forge', () => act((forge) => forge.start()), controls.start)],
        });

        empty.style.display = up && authority && state.services && !services.length ? 'block' : 'none';

        if (!up || !authority) return;

        for (const service of services) {
            const running = service.state === 'running';
            const expectsHandler = !CALLS_FORGE.has(service.name);
            const tone = running
                ? expectsHandler && !service.registered
                    ? 'warn'
                    : 'ok'
                : service.state === 'backoff'
                  ? 'warn'
                  : service.state === 'failed'
                    ? 'alert'
                    : 'off';

            const chips = [];
            if (running && expectsHandler)
                chips.push(service.registered ? chip('registered', 'ok') : chip('unregistered', 'warn'));
            if (service.crashes > 0)
                chips.push(chip(`×${service.crashes}`, service.state === 'failed' ? 'alert' : 'warn'));

            rows.get(service.name).update({
                tone,
                name: service.name,
                state: service.state,
                pid: service.pid,
                uptime: since(service.started_at),
                chips,
                signature: service.state,
                last: service === services[services.length - 1],
                actions: () =>
                    running
                        ? [
                              button('reload', `Restart ${service.name}`, () =>
                                  act((forge) => forge.call('service.restart', { name: service.name }))
                              ),
                              button('square', `Shutdown ${service.name}`, () =>
                                  act((forge) => forge.call('service.shutdown', { name: service.name }))
                              ),
                          ]
                        : [
                              button(
                                  'play',
                                  service.state === 'failed'
                                      ? `${service.name}: crash loop, try again`
                                      : `Run ${service.name}`,
                                  () => act((forge) => forge.call('service.run', { name: service.name }))
                              ),
                          ],
            });
        }
    };

    let drawn = [],
        drawnFor = null;
    const logLine = (line) => {
        const row = document.createElement('div');
        row.textContent = line;
        Object.assign(row.style, {
            padding: '1px 0',
            font: 'var(--deckit-type-small)',
            fontFamily: 'var(--deckit-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
        });
        return row;
    };

    const overlap = (lines) => {
        for (let cut = 0; cut <= drawn.length; cut++) {
            const kept = drawn.length - cut;
            if (kept > lines.length) continue;
            let same = true;
            for (let index = 0; index < kept && same; index++) same = drawn[cut + index] === lines[index];
            if (same && (kept > 0 || cut === drawn.length)) return kept > 0 ? cut : -1;
        }
        return -1;
    };
    const renderLog = async () => {
        const asked = session;
        if (!asked) return;
        const lines = await forgeOf(asked)
            .log(200)
            .catch(() => []);
        if (asked !== session) return;
        if (!lines.length) {
            drawn = [];
            drawnFor = asked;
            logBody.textContent = '';
            const nothing = document.createElement('div');
            nothing.textContent = 'No log output';
            Object.assign(nothing.style, {
                color: 'var(--deckit-muted)',
                font: 'var(--deckit-type-small)',
            });
            logBody.appendChild(nothing);
            return;
        }

        const atBottom = logBody.scrollHeight - logBody.scrollTop - logBody.clientHeight < 24;
        const cut = drawnFor === asked ? overlap(lines) : -1;
        if (cut < 0) {
            logBody.textContent = '';
            for (const line of lines) logBody.appendChild(logLine(line));
        } else {
            for (let index = 0; index < cut; index++) logBody.firstChild?.remove();
            for (const line of lines.slice(drawn.length - cut)) logBody.appendChild(logLine(line));
        }
        drawn = lines.slice();
        drawnFor = asked;
        if (atBottom) logBody.scrollTop = logBody.scrollHeight;
    };

    const tick = () => {
        if (visible) {
            load();
            renderLog();
        }
    };
    const startPolling = () => {
        stopPolling();
        timer = setInterval(tick, REFRESH_MS);
    };
    const stopPolling = () => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    };

    render();

    return {
        bar,
        pane,
        setSession,
        show: () => {
            visible = true;
            tick();
            startPolling();
        },
        hide: () => {
            visible = false;
            stopPolling();
        },

        // What is wrong with the main session's daemon, as readouts for the switcher's Now strip, each showing its
        // services.
        now: async () => {
            const entry = await forge.session();
            const { daemon, services, authority, error } = await snapshot(entry);
            const value = { action: 'show', view: 'supervisor', session: entry.name };
            if (!daemon) {
                return [
                    {
                        label: 'forge is down',
                        hint: 'The daemon is not running · open to start it',
                        icon: ui.icon('power', { size: 18 }),
                        tone: 'alert',
                        attention: true,
                        value,
                    },
                ];
            }
            if (!authority) return [];

            if (!services)
                return [
                    {
                        label: "forge's services could not be read",
                        hint: error,
                        icon: ui.icon('server', { size: 18 }),
                        tone: 'warn',
                        value,
                    },
                ];
            const bad = services.filter((service) => service.state !== 'running');
            if (!bad.length) return [];
            return [
                {
                    label: bad.length === 1 ? `${bad[0].name} is unhealthy` : `${bad.length} services unhealthy`,
                    hint: bad.map((service) => `${service.name} · ${service.state}`).join(', '),
                    icon: ui.icon('server', { size: 18 }),
                    tone: bad.some((service) => service.state === 'failed') ? 'alert' : 'warn',
                    attention: bad.some((service) => service.state === 'failed'),
                    value,
                },
            ];
        },

        // The chosen session's daemon restarted with its services, or started: a throw says why it could not be.
        restart: async () => {
            const { failure } = await act((forge) => forge.restart());
            if (failure) throw new Error(failure);
        },

        actions: () => [
            {
                label: 'Restart Forge',
                hint: `The ${session} session's daemon, with the services it supervises; started if it is not running`,
                icon: ui.icon('reload', { size: 16 }),
                group: 'Forge',
                keywords: ['forge', '데몬', '재시작', '기동', 'restart', 'start'],
                value: { action: 'restart-forge' },
            },
        ],
    };
};

module.exports = { supervisorView };

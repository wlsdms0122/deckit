const { styled } = require('../../dom/dom.js');
const { fieldsOf } = require('../workflows/workflow-inputs.js');
const { workflowForm } = require('../workflows/workflow-form.js');
const { scheduleTree } = require('../workflows/workflow-tree.js');
const { listDivider } = require('../pane/list-divider.js');

const { triggerOf, triggerSummary } = require('./schedule-trigger.js');
const { installContent, actions, section, values, feedback } = require('../pane/content-ui.js');

const schedulesView = ({ deck, bot, picker }) => {
    const { ui } = deck,
        store = deck.storage.values;
    installContent(ui);
    let detailId = null,
        detailParts = null,
        form = null,
        preview = null,
        triggerFields = new Map();
    let session = picker.current();
    let visible = false,
        epoch = 0,
        pending = null,
        timer = null,
        specRequest = 0;
    let schedules = [],
        workflows = [],
        selected = null,
        creating = false,
        busy = false,
        available = false,
        spec = null,
        save = null;
    const draft = {
        workflow: '',
        kind: 'every',
        value: '1h',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        days: [],
        concurrency: 'skip',
    };
    const inputDrafts = new Map();
    const call = (target, operation, args) => bot.forge.supervisor.call(target, operation, args);
    const muted = (text) =>
        styled('div', { color: 'var(--deckit-muted)', font: '12px var(--deckit-font)', whiteSpace: 'pre-wrap' }, text);
    const bar = styled('div', { display: 'none', flex: '1', gap: '8px', alignItems: 'center', minWidth: '0' });
    const search = ui.field({
        placeholder: 'Search schedules',
        icon: ui.icon('search', { size: 14 }),
        onInput: paintList,
    });
    const add = ui.button({
        label: 'New schedule',
        icon: ui.icon('plus', { size: 14 }),
        onClick: () => {
            creating = true;
            selected = null;
            feedback(notice, '');
            paintList();
            paintCreate();
        },
    });
    const refreshButton = ui.iconButton({
        icon: ui.icon('reload', { size: 15 }),
        title: 'Refresh schedules',
        onClick: () => {
            refresh();
            if (creating && draft.workflow) loadSpec();
        },
    });
    bar.append(search.element, add.element, refreshButton.element);
    const pane = styled('div', {
        display: 'none',
        flex: '1',
        minWidth: '0',
        minHeight: '0',
        borderTop: 'var(--deckit-border)',
    });
    const list = styled('div', { overflow: 'auto', padding: '8px', borderRight: 'var(--deckit-border)' });
    const divider = listDivider({ ui, store, pane, list, key: 'schedule-list-width' });
    const body = styled('div', { flex: '1', minWidth: '0', overflow: 'auto', padding: '24px' });
    const status = muted(''),
        notice = styled('div');
    feedback(notice, '');
    const detail = styled('div');
    detail.className = 'bot-detail';
    status.setAttribute('data-catalog-status', '');
    const page = styled('div');
    page.className = 'bot-content';
    page.append(notice, detail, status);
    body.append(page);
    pane.append(list, divider, body);
    ui.edgeFade(list);
    ui.edgeFade(body);
    const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
    const draftInputs = () => {
        if (!inputDrafts.has(draft.workflow)) inputDrafts.set(draft.workflow, {});
        return inputDrafts.get(draft.workflow);
    };
    const select = (options, value, changed) => {
        const made = ui.select({
            options,
            value,
            onChange: (next) => {
                made.set(next);
                changed(next);
            },
        });
        return made.element;
    };
    const field = (label, value, changed, placeholder = '', type = 'text', key = null) => {
        const row = styled('div', {}, label),
            error = styled('div');
        error.className = 'bot-field-error';
        error.setAttribute('role', 'alert');
        row.className = 'bot-label';
        const made = ui.field({
            value,
            placeholder,
            onInput: (next) => {
                changed(next);
                error.textContent = '';
                made.input.removeAttribute('aria-invalid');
                updatePreview();
            },
        });
        made.input.setAttribute('aria-label', label);
        made.input.type = type;
        if (type === 'time' || type === 'datetime-local') made.input.step = '60';
        if (key) triggerFields.set(key, { input: made.input, error });
        row.append(made.element, error);
        return row;
    };
    const stateBadge = (item) => {
        const label = item.spent ? 'Spent' : item.enabled ? 'Enabled' : 'Paused';
        const color = item.spent ? 'var(--deckit-muted)' : item.enabled ? 'var(--deckit-ok)' : 'var(--deckit-warn)';
        const badge = styled('span', {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: '0',
            padding: '3px 6px',
            borderRadius: '5px',
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            font: '600 11px var(--deckit-font)',
            whiteSpace: 'nowrap',
        });
        badge.innerHTML = item.spent
            ? ui.icon('clock', { size: 12 })
            : item.enabled
              ? ui.icon('check', { size: 12 })
              : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
        badge.append(styled('span', {}, label));
        return badge;
    };
    function paintList() {
        const scroll = list.scrollTop;
        list.replaceChildren();
        const rows = scheduleTree(schedules, {
            query: search.input.value,
            folded: store.get('schedule-folds', {})[session] || [],
        });
        for (const entry of rows) {
            const item = entry.item;
            const row = ui.treeRow({
                depth: entry.depth,
                folder: !!entry.folder,
                open: entry.open,
                name: entry.folder ? `${entry.name} · ${entry.count}` : item.id,
                glyph: ui.icon('calendar', { size: 14 }),
            });
            row.element.title =
                entry.folder ||
                `${item.workflow} · ${item.spent ? 'Spent' : item.enabled ? 'Enabled' : 'Paused'}\n${item.source || ''}`;
            if (item) row.element.append(stateBadge(item));
            row.setActive(!entry.folder && !creating && item.id === selected);
            row.element.addEventListener('click', () => {
                if (!entry.folder) {
                    creating = false;
                    selected = item.id;
                    paintList();
                    paintDetail();
                    return;
                }
                if (search.input.value.trim()) return;
                const all = store.get('schedule-folds', {}),
                    folded = new Set(all[session] || []);
                if (folded.has(entry.folder)) folded.delete(entry.folder);
                else folded.add(entry.folder);
                store.set('schedule-folds', { ...all, [session]: [...folded] });
                paintList();
            });
            list.append(row.element);
        }
        if (!list.children.length) list.append(muted(schedules.length ? 'No matching schedules' : 'No schedules'));
        list.scrollTop = scroll;
    }
    function setSession(name) {
        session = name;
        epoch++;
        specRequest++;
        pending = null;
        available = false;
        schedules = [];
        workflows = [];
        selected = null;
        creating = false;
        spec = null;
        save = null;
        add.setEnabled(false);
        status.title = '';
        draft.workflow = '';
        inputDrafts.clear();
        feedback(notice, '');
        status.textContent = 'Loading schedules…';
        paintList();
        paintDetail();
        clearTimeout(timer);
        refresh();
    }
    function paintDetail() {
        const item = schedules.find((item) => item.id === selected);
        if (!item) {
            detailId = null;
            detailParts = null;
            form = null;
            detail.replaceChildren(muted('Choose a schedule or create one.'));
            return;
        }
        if (detailId !== item.id || !detailParts) {
            detailId = item.id;
            form = null;
            detail.replaceChildren();
            const id = item.id,
                target = session;
            const header = styled('header', {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            });
            header.append(styled('h2', {}, id));
            const toggle = ui.button({
                label: '',
                onClick: () =>
                    act(target, async () => {
                        const enabled = schedules.find((row) => row.id === id).enabled;
                        await call(target, enabled ? 'schedule.disable' : 'schedule.enable', { id });
                        return `${enabled ? 'Paused' : 'Enabled'} ${id}`;
                    }),
            });
            const run = ui.button({
                label: 'Run now',
                variant: 'primary',
                icon: ui.icon('play', { size: 14 }),
                onClick: () =>
                    act(target, async () => {
                        const result = await bot.forge.supervisor.runSchedule(target, id);
                        return `Dispatched ${id} · ${result.workflow_id}`;
                    }),
            });
            const controls = actions();
            controls.append(toggle.element, run.element);
            header.append(controls);
            const state = styled('div'),
                workflow = muted(''),
                trigger = styled('div', { font: '600 15px var(--deckit-font)' });
            const next = styled('div', { font: '600 18px var(--deckit-font)' }),
                history = styled('div'),
                inputs = styled('div'),
                definition = styled('div');
            history.append(values({ 'Last attempt': '—', Outcome: '—' }));
            const remove = ui.button({
                label: 'Delete schedule',
                variant: 'destructive',
                onClick: () =>
                    ui.dialog({
                        title: 'Delete schedule',
                        message: `Delete ${id}?`,
                        confirmLabel: 'Delete',
                        destructive: true,
                        onConfirm: () =>
                            act(target, async () => {
                                await call(target, 'schedule.delete', { id });
                                return `Deleted ${id}`;
                            }),
                    }),
            });
            const intro = styled('div');
            intro.className = 'bot-intro';
            intro.append(header, state, workflow);
            detail.append(
                intro,
                section(
                    'Schedule',
                    next,
                    trigger,
                    muted('Times shown in ' + Intl.DateTimeFormat().resolvedOptions().timeZone)
                ),
                section('Last execution', history),
                section('Inputs', inputs),
                section('Definition', definition),
                section('Management', remove.element)
            );
            detailParts = {
                toggle,
                run,
                remove,
                state,
                workflow,
                trigger,
                next,
                history,
                inputs,
                definition,
                inputsKey: null,
                definitionKey: null,
            };
        }
        const part = detailParts;
        part.state.replaceChildren(stateBadge(item));
        part.workflow.textContent = item.workflow;
        part.trigger.textContent = triggerSummary(item.trigger);
        part.next.textContent = item.spent
            ? 'Completed · no further runs'
            : !item.enabled
              ? 'Paused · no scheduled runs'
              : 'Next: ' + when(item.next_fire_at);
        part.next.title = 'Times shown in ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
        const historyValues = part.history.querySelectorAll('dd');
        if (historyValues[0].textContent !== when(item.last_attempt_at))
            historyValues[0].textContent = when(item.last_attempt_at);
        if (historyValues[1].textContent !== (item.last_outcome || '—'))
            historyValues[1].textContent = item.last_outcome || '—';
        const inputsKey = JSON.stringify(item.inputs || {});
        if (part.inputsKey !== inputsKey) {
            part.inputsKey = inputsKey;
            part.inputs.replaceChildren(
                Object.keys(item.inputs || {}).length ? values(item.inputs) : muted('No inputs.')
            );
        }
        const definitionKey = JSON.stringify([item.source, item.runtime, item.concurrency]);
        if (part.definitionKey !== definitionKey) {
            part.definitionKey = definitionKey;
            part.definition.replaceChildren(
                values({
                    Source: item.source || '—',
                    Origin: item.runtime ? 'Created in Forge' : 'Configuration',
                    'When already running':
                        {
                            skip: 'Skip this occurrence',
                            queue: 'Queue the next run',
                            replace: 'Replace the active run',
                        }[item.concurrency] || item.concurrency,
                })
            );
        }
        updateBusy();
    }
    function updateBusy() {
        detail.setAttribute('aria-busy', String(busy));
        save?.setLabel(busy ? 'Creating…' : 'Create schedule');
        add.setEnabled(!busy && available);
        save?.setEnabled(!busy && available && !!spec);
        form?.setBusy(busy);
        if (detailParts && !creating) {
            const item = schedules.find((row) => row.id === detailId);
            if (!item) return;
            detailParts.toggle.setLabel(item.enabled ? 'Pause' : 'Enable');
            for (const button of [detailParts.toggle, detailParts.run, detailParts.remove])
                button.setEnabled(!busy && available);
            detailParts.run.setEnabled(!busy && available && item.workflow !== '<inline>');
            detailParts.run.element.title =
                item.workflow === '<inline>' ? 'This inline workflow runs on its schedule.' : '';
        }
        if (creating) for (const control of detail.querySelectorAll('input, button')) control.disabled = busy;
        save?.setEnabled(!busy && available && !!spec);
    }
    async function loadSpec() {
        spec = null;
        const request = ++specRequest,
            target = session,
            workflow = draft.workflow;
        paintCreate();
        if (!workflow) return;
        try {
            const next = await call(target, 'workflow.describe', { name: workflow });
            if (request !== specRequest || target !== session || workflow !== draft.workflow) return;
            spec = next;
            if (creating) paintCreate();
        } catch (error) {
            if (request === specRequest && target === session) feedback(notice, error.message, true);
        }
    }
    function updatePreview() {
        if (!preview) return;
        try {
            preview.textContent = triggerSummary(triggerOf(draft));
        } catch (error) {
            preview.textContent = error.message;
        }
    }
    function paintCreate() {
        detail.replaceChildren();
        save = null;
        detailId = null;
        detailParts = null;
        triggerFields = new Map();
        detail.append(styled('h2', {}, 'New schedule'));
        const workflow = styled('div', {}, 'Workflow');
        workflow.className = 'bot-label';
        workflow.append(
            select(
                [
                    { value: '', label: 'Choose workflow…' },
                    ...workflows.map((item) => ({ value: item.name, label: item.name })),
                ],
                draft.workflow,
                (value) => {
                    draft.workflow = value;
                    loadSpec();
                }
            )
        );
        workflow.lastChild.setAttribute('aria-label', 'Workflow');
        detail.append(workflow);
        const trigger = section('Schedule'),
            kind = styled('div', {}, 'Repeat');
        kind.className = 'bot-label';
        kind.append(
            select(
                [
                    { value: 'every', label: 'Every interval' },
                    { value: 'at', label: 'At a time on selected days' },
                    { value: 'after', label: 'Once after a delay' },
                    { value: 'once', label: 'Once at a date and time' },
                ],
                draft.kind,
                (value) => {
                    draft.kind = value;
                    draft.value = { every: '1h', at: '09:00', after: '1h', once: '' }[value];
                    paintCreate();
                }
            )
        );
        kind.lastChild.setAttribute('aria-label', 'Repeat');
        trigger.append(
            kind,
            field(
                { every: 'Interval', at: 'Time', after: 'Delay', once: 'Date and time' }[draft.kind],
                draft.value,
                (value) => {
                    draft.value = value;
                },
                '30s, 5m, 1h',
                draft.kind === 'at' ? 'time' : draft.kind === 'once' ? 'datetime-local' : 'text',
                'value'
            )
        );
        if (['at', 'once'].includes(draft.kind))
            trigger.append(
                field(
                    'Timezone',
                    draft.timezone,
                    (value) => {
                        draft.timezone = value;
                    },
                    'Asia/Seoul',
                    'text',
                    'timezone'
                )
            );
        if (draft.kind === 'at') {
            const days = actions();
            days.setAttribute('role', 'group');
            days.setAttribute('aria-label', 'Days of week');
            for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
                const button = ui.button({
                    label: day[0].toUpperCase() + day.slice(1),
                    size: 'small',
                    onClick: () => {
                        draft.days = draft.days.includes(day)
                            ? draft.days.filter((item) => item !== day)
                            : [...draft.days, day];
                        button.element.setAttribute('aria-pressed', String(draft.days.includes(day)));
                        updatePreview();
                    },
                });
                button.element.setAttribute('aria-pressed', String(draft.days.includes(day)));
                days.append(button.element);
            }
            trigger.append(days, muted('No days selected means every day.'));
        }
        preview = styled('div', {
            padding: '12px',
            borderRadius: '6px',
            background: 'var(--deckit-fill)',
            font: '600 13px var(--deckit-font)',
        });
        trigger.append(preview);
        detail.append(trigger);
        updatePreview();
        const concurrency = styled('div', {}, 'When another run is active');
        concurrency.className = 'bot-label';
        concurrency.append(
            select(
                [
                    { value: 'skip', label: 'Skip this occurrence' },
                    { value: 'queue', label: 'Queue the next run' },
                    { value: 'replace', label: 'Replace the active run' },
                ],
                draft.concurrency,
                (value) => {
                    draft.concurrency = value;
                }
            )
        );
        concurrency.lastChild.setAttribute('aria-label', 'When another run is active');
        trigger.insertBefore(concurrency, preview);
        form = spec ? workflowForm({ ui, fields: fieldsOf(spec), draft: draftInputs() }) : null;
        detail.append(
            section(
                'Inputs',
                form
                    ? form.element
                    : muted(draft.workflow ? 'Loading workflow inputs…' : 'Choose a workflow to configure inputs.')
            )
        );
        const target = session;
        save = ui.button({
            label: 'Create schedule',
            variant: 'primary',
            onClick: () => {
                let trigger;
                try {
                    trigger = triggerOf(draft);
                } catch (error) {
                    const field = triggerFields.get(error.field);
                    if (field) {
                        field.error.textContent = error.message;
                        field.input.setAttribute('aria-invalid', 'true');
                        field.input.focus();
                    }
                    return;
                }
                const inputs = form?.read();
                if (!inputs) return;
                const workflow = draft.workflow,
                    concurrency = draft.concurrency;
                act(target, async () => {
                    const result = await call(target, 'schedule.create', { workflow, trigger, concurrency, inputs });
                    if (target === session) {
                        creating = false;
                        selected = result.id;
                        paintList();
                        paintDetail();
                    }
                    return `Created ${result.id}`;
                });
            },
        });
        const cancel = ui.button({
            label: 'Cancel',
            onClick: () => {
                creating = false;
                save = null;
                feedback(notice, '');
                paintList();
                paintDetail();
            },
        });
        const footer = actions();
        Object.assign(footer.style, {
            position: 'sticky',
            bottom: '0',
            padding: '12px 0',
            background: 'var(--deckit-background)',
        });
        footer.append(save.element, cancel.element);
        detail.append(footer);
        updateBusy();
    }
    async function act(target, action) {
        if (busy) return;
        busy = true;
        feedback(notice, '');
        updateBusy();
        try {
            const message = await action();
            if (target === session) feedback(notice, message);
        } catch (error) {
            if (target === session) {
                form?.showError(error.message);
                feedback(notice, error.message, true);
            }
        } finally {
            busy = false;
            updateBusy();
            if (target === session) {
                epoch++;
                pending = null;
            }
            refresh();
        }
    }
    async function refresh() {
        if (!visible || pending?.epoch === epoch) return;
        clearTimeout(timer);
        const request = { epoch, session };
        pending = request;
        const current = () => visible && epoch === request.epoch && session === request.session;
        try {
            const chosen = await bot.forge.supervisor.session(session);
            if (!current()) return;
            if (!chosen?.up || !chosen.authority)
                throw new Error(
                    !chosen?.up
                        ? 'Daemon stopped. Start it in Services.'
                        : 'No token for this daemon. Manage its authority in Services.'
                );
            const [listing, catalog] = await Promise.all([
                call(session, 'schedule.list'),
                call(session, 'workflow.list'),
            ]);
            if (!current()) return;
            schedules = listing.schedules || [];
            workflows = catalog.workflows || [];
            available = true;
            status.textContent = `${schedules.length} schedules · ${schedules.filter((item) => item.enabled && !item.spent).length} enabled`;
            const failures = [...(listing.failures || []), ...(catalog.failures || [])];
            if (failures.length) status.textContent += ` · ${failures.length} definitions could not load`;
            status.title = failures.map((item) => `${item.path}: ${item.reason}`).join('\n');
            add.setEnabled(!busy);
            paintList();
            if (creating) {
                if (draft.workflow && !workflows.some((item) => item.name === draft.workflow)) {
                    spec = null;
                    specRequest++;
                    paintCreate();
                } else if (draft.workflow && !spec) loadSpec();
                updateBusy();
            } else {
                if (!schedules.some((item) => item.id === selected)) selected = null;
                paintDetail();
            }
        } catch (error) {
            if (current()) {
                available = false;
                status.textContent = error.message;
                add.setEnabled(false);
                updateBusy();
            }
        } finally {
            if (pending === request) {
                pending = null;
                if (visible) timer = setTimeout(refresh, 3000);
            }
        }
    }
    add.setEnabled(false);
    paintDetail();
    return {
        bar,
        pane,
        setSession,
        show: () => {
            visible = true;
            epoch++;
            refresh();
        },
        hide: () => {
            visible = false;
            epoch++;
            specRequest++;
            clearTimeout(timer);
        },
    };
};
module.exports = { schedulesView };

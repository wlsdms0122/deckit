// A `font` shorthand resets `line-height`, so in every rule `line-height` comes after `font`.
const STYLE = `
    .settings-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
        color: var(--deckit-text);
        font: var(--deckit-type-medium);
    }
    .settings-title { flex: 0 0 auto; padding: 12px 14px 8px; font: 700 var(--deckit-type-large); }
    .settings-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 14px 16px; }
    .settings-sidebar { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
    .settings-contents-label {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .settings-section { margin-bottom: 22px; }
    .settings-section-head { display: flex; align-items: center; gap: 8px; min-height: 24px; padding: 0 0 6px; }
    .settings-section-title {
        flex: 1 1 auto;
        font: 700 11.5px var(--deckit-font);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.45;
    }
    .settings-section-description {
        padding: 0 0 8px;
        font: 12.5px var(--deckit-font);
        line-height: 1.5;
        opacity: 0.45;
    }

    .settings-chip {
        flex: 0 0 auto;
        padding: 1px 7px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-round);
        font: 11.5px var(--deckit-font);
        opacity: 0.75;
    }
    .settings-chip[data-muted] { opacity: 0.45; }
    .settings-card {
        margin-bottom: 10px;
        padding: 8px 0 4px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-medium);
    }
    .settings-card-title { padding: 0 12px 4px; font: 600 var(--deckit-type-body); }
    .settings-quiet { padding: 0 8px; font: 12.5px var(--deckit-font); opacity: 0.45; }

    .settings-notice {
        margin: 8px 0 0;
        padding: 8px 10px;
        border: var(--deckit-border);
        border-radius: 7px;
        font: 12.5px var(--deckit-font);
        line-height: 1.6;
        opacity: 0.8;
    }
    .settings-restart {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 8px 0 0;
        padding: 8px 8px 8px 10px;
        border: var(--deckit-border);
        border-radius: 7px;
        font: 12.5px var(--deckit-font);
        line-height: 1.5;
    }
    .settings-restart[hidden] { display: none; }
    .settings-restart-text { flex: 1 1 auto; min-width: 0; opacity: 0.85; }

    .settings-plugin-columns {
        display: grid;
        grid-template-columns: minmax(96px, 180px) 56px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
    }
    .settings-plugin-head {
        padding: 0 8px 5px;
        border-bottom: var(--deckit-border);
        font: 700 11px var(--deckit-font);
        letter-spacing: 0.05em;
        text-transform: uppercase;
        opacity: 0.35;
    }
    .settings-plugin { cursor: pointer; }
    .settings-plugin-row { min-height: 34px; font: inherit; white-space: normal; }
    .settings-plugin-name-cell { display: flex; align-items: center; gap: 4px; min-width: 0; }
    .settings-caret {
        display: flex;
        flex: 0 0 auto;
        margin-left: -4px;
        opacity: 0.45;
        transition: transform var(--deckit-fast) var(--deckit-easing);
    }
    .settings-plugin[data-open] .settings-caret { transform: rotate(90deg); }
    .settings-plugin-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .settings-plugin-name[data-not-loaded] { opacity: 0.45; }
    .settings-plugin-version {
        flex: 0 0 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: 11.5px var(--deckit-font);
        font-variant-numeric: tabular-nums;
        opacity: 0.5;
    }
    .settings-plugin-version[data-missing] { opacity: 0.25; }
    .settings-plugin-contributions { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
    .settings-plugin-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; }
    .settings-plugin-failure {
        margin-top: -6px;
        padding: 0 8px 8px 21px;
        color: var(--deckit-alert);
        font: var(--deckit-type-small);
        line-height: 1.5;
        word-break: break-word;
    }

    .settings-details {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        cursor: default;
        transition:
            grid-template-rows var(--deckit-base) var(--deckit-easing),
            opacity var(--deckit-base) var(--deckit-easing);
    }
    .settings-details[data-open] { grid-template-rows: 1fr; opacity: 1; }
    .settings-details-clip { min-height: 0; overflow: hidden; }
    .settings-details-box {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 2px 8px 8px 21px;
        padding: 10px 12px;
        border-radius: var(--deckit-radius-medium);
        background: rgba(128, 128, 128, 0.08);
        font: 12.5px var(--deckit-font);
    }
    .settings-details-part { display: flex; flex-direction: column; gap: 5px; }
    .settings-details-heading {
        font: 700 10.5px var(--deckit-font);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.4;
    }
    .settings-details-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .settings-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-round);
        white-space: nowrap;
    }
    .settings-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--deckit-alert); }
    .settings-status[data-ok] .settings-status-dot { background: var(--deckit-ok); }
    .settings-details-keys {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 4px 14px;
    }
    .settings-details-key { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .settings-details-chord {
        flex: 0 0 auto;
        min-width: 26px;
        padding: 0 5px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-small);
        font: 11.5px var(--deckit-font);
        line-height: 18px;
        text-align: center;
        opacity: 0.8;
    }
    .settings-details-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.85;
    }
    .settings-details-place { display: flex; flex-direction: column; gap: 2px; }
    .settings-details-line { overflow-wrap: anywhere; font: 12.5px var(--deckit-font); opacity: 0.85; }
    .settings-details-line[data-quiet] { font: var(--deckit-type-small); opacity: 0.45; }

    .settings-permissions { overflow: hidden; border: var(--deckit-border); border-radius: var(--deckit-radius-large); }
    .settings-permission {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        column-gap: 11px;
        padding: 10px 12px;
    }
    .settings-permission + .settings-permission { border-top: var(--deckit-border); }
    .settings-permission-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: color-mix(in srgb, var(--deckit-accent) 16%, transparent);
        color: var(--deckit-accent);
    }
    .settings-permission-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: 8px;
        line-height: 1.45;
    }
    .settings-permission-name { font: 600 13.5px var(--deckit-font); }
    .settings-permission-id { overflow-wrap: anywhere; font: 11.5px var(--deckit-mono); opacity: 0.5; }
    .settings-permission-reason {
        margin-top: 2px;
        overflow-wrap: anywhere;
        font: var(--deckit-type-body);
        opacity: 0.85;
    }
    .settings-permission-means {
        margin-top: 4px;
        overflow-wrap: anywhere;
        font: var(--deckit-type-small);
        opacity: 0.5;
    }
    .settings-install-note { margin-top: 10px; font: var(--deckit-type-small); line-height: 1.5; opacity: 0.5; }

    .settings-setting-card { transition: background var(--deckit-slow) var(--deckit-easing); }
    .settings-setting-card[data-highlighted] { background: color-mix(in srgb, var(--deckit-accent) 12%, transparent); }
    .settings-setting { display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 4px 12px; }
    .settings-setting-words { display: flex; flex: 1 1 auto; flex-direction: column; gap: 1px; min-width: 0; }
    .settings-setting-label { font: var(--deckit-type-body); }
    .settings-setting-hint { font: var(--deckit-type-small); line-height: 1.45; opacity: 0.5; }
    .settings-setting-answer { font: var(--deckit-type-small); line-height: 1.45; opacity: 0.6; }
    .settings-setting-field { flex: 0 0 220px; }

    .settings-scheme-name { padding: 0 12px; font: 600 var(--deckit-type-body); }
    .settings-scheme-when { padding: 1px 12px 6px; font: var(--deckit-type-small); opacity: 0.5; }
    .settings-scheme-none { padding: 4px 12px 6px 44px; font: 12.5px var(--deckit-font); opacity: 0.4; }
    .settings-handler {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        margin: 0 4px;
        padding: 0 8px 0 6px;
        border-radius: var(--deckit-radius-control);
        cursor: default;
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .settings-handler[data-draggable] { cursor: grab; }
    .settings-handler[data-draggable]:hover { background: var(--deckit-hover); }
    .settings-handler-grip { display: flex; flex: 0 0 14px; opacity: 0.35; }
    .settings-handler-place {
        flex: 0 0 16px;
        font: var(--deckit-type-small);
        font-variant-numeric: tabular-nums;
        text-align: right;
        opacity: 0.4;
    }
    .settings-handler-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--deckit-type-body);
    }
    .settings-handler[data-muted] .settings-handler-name { opacity: 0.55; }

    .settings-conflicts {
        border-color: color-mix(in srgb, var(--deckit-alert) 50%, transparent);
        color: var(--deckit-alert);
        opacity: 1;
    }
    .settings-shortcut-card { padding-bottom: 6px; }
    .settings-shortcuts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        column-gap: 8px;
        padding: 0 4px;
    }
    .settings-shortcut { min-width: 0; padding: 0 8px; border-radius: var(--deckit-radius-control); }
    .settings-shortcut-line { display: flex; align-items: center; gap: 8px; min-height: 30px; }
    .settings-shortcut-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--deckit-type-body);
    }
    .settings-shortcut-scope { flex: 0 0 auto; font: 11.5px var(--deckit-font); opacity: 0.4; }
    .settings-chord {
        flex: 0 0 auto;
        min-width: 56px;
        height: 22px;
        padding: 0 8px;
        border: var(--deckit-border);
        border-radius: 5px;
        background: transparent;
        color: inherit;
        font: var(--deckit-type-small);
        cursor: pointer;
    }
    .settings-chord[data-unset] { opacity: 0.45; }
    .settings-chord[data-level='warning'] { border: 1px solid var(--deckit-warn); color: var(--deckit-warn); }
    .settings-chord[data-level='error'] { border: 1px solid var(--deckit-alert); color: var(--deckit-alert); }
    .settings-chord[data-recording] { border-color: var(--deckit-accent); color: var(--deckit-accent); opacity: 1; }
    .deckit-row-action.settings-reset { opacity: 0.6; }
    .deckit-row-action.settings-reset[data-unchanged] { opacity: 0; pointer-events: none; }
    .settings-issue { padding: 0 0 5px; color: var(--deckit-warn); font: 11.5px var(--deckit-font); line-height: 1.45; }
    .settings-issue[data-error] { color: var(--deckit-alert); }
`;

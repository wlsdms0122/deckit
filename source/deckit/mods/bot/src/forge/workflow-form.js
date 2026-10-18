const { styled } = require('../dom.js');
const { inputsOf } = require('./workflow-inputs.js');
const { muted } = require('./content-ui.js');
let nextError = 0;
const workflowForm = ({ ui, fields, draft }) => {
    const element = styled('div', { display: 'flex', flexDirection: 'column', gap: '14px' });
    const controls = new Map();
    for (const field of fields) {
        const label = styled('div');
        label.className = 'bot-label';
        label.append(styled('span', {}, field.name + (field.optional ? ' · optional' : '')));
        const error = styled('div');
        error.className = 'bot-field-error';
        error.setAttribute('role', 'alert');
        error.id = 'bot-input-error-' + ++nextError;
        const changed = (value) => {
            draft[field.name] = value;
            error.textContent = '';
            focus.removeAttribute('aria-invalid');
        };
        let input, focus;
        if (field.type === 'bool' || field.oneOf) {
            const options = field.oneOf || ['true', 'false'];
            const select = ui.select({
                options: [
                    { value: '', label: field.optional ? 'Use default' : 'Choose…' },
                    ...options.map((value) => ({ value: String(value), label: String(value) })),
                ],
                value: draft[field.name] ?? '',
                onChange: (value) => {
                    changed(value);
                    select.set(value);
                },
            });
            input = select.element;
            focus = input;
        } else if (field.multiline) {
            input = styled('textarea', {
                resize: 'vertical',
                minHeight: '90px',
                padding: '8px',
                border: 'var(--deckit-border)',
                borderRadius: '6px',
                background: 'var(--deckit-fill)',
                color: 'var(--deckit-text)',
                font: '13px var(--deckit-font)',
            });
            input.value = draft[field.name] ?? '';
            input.addEventListener('input', () => changed(input.value));
            focus = input;
        } else {
            const made = ui.field({
                placeholder: field.type === 'int' ? 'Whole number' : '',
                value: draft[field.name] ?? '',
                onInput: changed,
            });
            input = made.element;
            focus = made.input;
            if (field.type === 'int') made.input.inputMode = 'numeric';
        }
        focus.setAttribute('aria-describedby', error.id);
        focus.setAttribute('aria-label', field.name);
        label.append(input);
        if (field.optional) label.append(muted('Default: ' + JSON.stringify(field.default)));
        if (field.hint) label.append(muted(field.hint));
        label.append(error);
        element.append(label);
        controls.set(field.name, { input, focus, error });
    }
    if (!fields.length) element.append(muted('No inputs required.'));
    return {
        element,
        read() {
            const result = {};
            let first = null;
            for (const field of fields) {
                const control = controls.get(field.name);
                control.error.textContent = '';
                control.focus.removeAttribute('aria-invalid');
                try {
                    Object.assign(result, inputsOf([field], draft));
                } catch (error) {
                    control.error.textContent = error.message;
                    control.focus.setAttribute('aria-invalid', 'true');
                    first ||= control.focus;
                }
            }
            if (first) {
                first.focus();
                return null;
            }
            return result;
        },
        showError(message) {
            const entry = [...controls].find(([name]) => message.startsWith(name + ':'));
            if (!entry) return false;
            const [, control] = entry;
            control.error.textContent = message;
            control.focus.setAttribute('aria-invalid', 'true');
            control.focus.focus();
            return true;
        },
        setBusy(on) {
            for (const control of element.querySelectorAll('input, textarea, button')) control.disabled = on;
        },
    };
};
module.exports = { workflowForm };
